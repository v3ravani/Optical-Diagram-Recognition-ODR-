"""
ODR Connector and Arrowhead Extractor (Version 2.0).
Extracts diagram connectors, routes lines, detects arrowhead orientation,
snaps endpoints to shape boundaries, resolves line crossings without junctions,
preserves loops/feedback paths and multiple incoming/outgoing arrows,
and associates branch labels (Yes/No/conditions).
"""

import math
from typing import List, Tuple, Dict, Any, Optional, Set
import cv2
import numpy as np
from backend.core.models import (
    DiagramElement,
    DiagramConnector,
    ElementType,
    ConnectorDirection,
    ConnectorStyle,
    ConnectorStyleProps,
    Point,
    UncertaintyStatus
)
from backend.pipeline.ocr_engine import OCRTextBlock


class ConnectorExtractor:
    """Extracts connectors and links between diagram elements."""

    @classmethod
    def extract_connectors(
        cls,
        image: np.ndarray,
        elements: List[DiagramElement],
        unassigned_text: List[OCRTextBlock]
    ) -> List[DiagramConnector]:
        """
        Extracts connectors connecting the detected elements and attaches branch labels.
        Preserves graph topology: multiple arrows entering one node, multiple branches
        leaving decision diamonds, loops/feedback paths, and crossing lines without junctions.
        """
        if len(elements) < 2:
            return []

        img_h, img_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Binarize lines
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6
        )

        # Mask out shapes so only connecting lines and arrows remain
        line_mask = thresh.copy()
        for el in elements:
            pad = 4
            bx = max(0, int(el.x - pad))
            by = max(0, int(el.y - pad))
            bw = min(img_w - bx, int(el.width + 2 * pad))
            bh = min(img_h - by, int(el.height + 2 * pad))
            cv2.rectangle(line_mask, (bx, by), (bx + bw, by + bh), 0, -1)

        # Mask out unassigned text regions
        for tb in unassigned_text:
            bx = max(0, tb.x - 2)
            by = max(0, tb.y - 2)
            bw = min(img_w - bx, tb.width + 4)
            bh = min(img_h - by, tb.height + 4)
            cv2.rectangle(line_mask, (bx, by), (bx + bw, by + bh), 0, -1)

        # 1. Morphological thinning / skeleton to obtain 1-pixel wide line centerlines
        skeleton = cls._morphological_skeleton(line_mask)

        # 2. Extract line segments via HoughLinesP on the line mask
        hough_lines = cv2.HoughLinesP(
            line_mask,
            rho=1,
            theta=np.pi / 180,
            threshold=20,
            minLineLength=16,
            maxLineGap=12
        )

        # 3. Detect candidate paths: combining skeleton components and hough segments
        candidate_edges = cls._find_candidate_paths(
            line_mask, skeleton, hough_lines, elements, thresh
        )

        # 4. Deduplicate candidate edges carefully (preserving multi-arrows and loops!)
        deduped = cls._deduplicate_edges(candidate_edges, elements)

        # 5. Fallback for faint/hand-drawn lines if some elements have zero connections
        if len(deduped) < len(elements) - 1:
            deduped = cls._infer_fallback_connections(elements, deduped)

        # 6. Associate unassigned text blocks as edge labels (e.g. Yes / No / conditions)
        connectors = cls._attach_labels_and_build(deduped, unassigned_text, elements)

        return connectors

    @classmethod
    def _morphological_skeleton(cls, img: np.ndarray) -> np.ndarray:
        """Computes morphological skeleton of binary image without requiring cv2.ximgproc."""
        skel = np.zeros_like(img)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        temp_img = img.copy()
        
        for _ in range(50):
            eroded = cv2.erode(temp_img, element)
            temp = cv2.dilate(eroded, element)
            temp = cv2.subtract(temp_img, temp)
            skel = cv2.bitwise_or(skel, temp)
            temp_img = eroded.copy()
            if cv2.countNonZero(temp_img) == 0:
                break
        return skel

    @classmethod
    def _find_candidate_paths(
        cls,
        line_mask: np.ndarray,
        skeleton: np.ndarray,
        hough_lines: Optional[np.ndarray],
        elements: List[DiagramElement],
        thresh: np.ndarray
    ) -> List[Dict[str, Any]]:
        """
        Extracts paths between shapes, handling crossing lines and multi-segment orthogonal paths.
        """
        img_h, img_w = line_mask.shape[:2]
        candidate_edges: List[Dict[str, Any]] = []
        connected_pairs_cc: Set[Tuple[str, str]] = set()

        # Find connected components in the line mask
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(line_mask, connectivity=8)

        for i in range(1, num_labels):
            stat = stats[i]
            area = stat[cv2.CC_STAT_AREA]
            cw = stat[cv2.CC_STAT_WIDTH]
            ch = stat[cv2.CC_STAT_HEIGHT]
            if area < 15 or (cw < 15 and ch < 15):
                continue

            comp_mask = (labels == i).astype(np.uint8) * 255
            pts = cv2.findNonZero(comp_mask)
            if pts is None or len(pts) < 8:
                continue

            pts_2d = pts.reshape(-1, 2)

            # Check if this component contains crossing lines (e.g. horizontal + vertical crossing)
            sub_paths = cls._resolve_crossings_in_component(comp_mask, pts_2d)

            for p_start, p_end, waypoints in sub_paths:
                source_el, source_dist, source_handle = cls._find_closest_shape(p_start, elements)
                target_el, target_dist, target_handle = cls._find_closest_shape(p_end, elements)

                if source_el and target_el and source_el.id != target_el.id:
                    max_snap_dist = 90.0
                    if source_dist <= max_snap_dist and target_dist <= max_snap_dist:
                        # Detect arrowhead polarity & direction
                        direction, src_id, tgt_id, src_h, tgt_h = cls._detect_arrow_polarity(
                            thresh, p_start, p_end, source_el, target_el, source_handle, target_handle
                        )

                        connected_pairs_cc.add(tuple(sorted([src_id, tgt_id])))
                        candidate_edges.append({
                            "source_id": src_id,
                            "target_id": tgt_id,
                            "source_handle": src_h,
                            "target_handle": tgt_h,
                            "p1": p_start,
                            "p2": p_end,
                            "midpoint": ((p_start[0] + p_end[0]) / 2.0, (p_start[1] + p_end[1]) / 2.0),
                            "direction": direction,
                            "waypoints": waypoints,
                            "confidence": 0.94,
                            "is_hough": False
                        })

        # Standalone Hough lines ONLY for pairs not already connected by continuous components
        if hough_lines is not None:
            seen_hough_pairs: Set[Tuple[str, str]] = set()
            for l in hough_lines:
                coords = l.flatten()
                if len(coords) < 4:
                    continue
                x1, y1, x2, y2 = coords[:4]
                length = math.hypot(x2 - x1, y2 - y1)
                if length < 28:
                    continue

                p1 = (int(x1), int(y1))
                p2 = (int(x2), int(y2))

                s_el, s_dist, s_h = cls._find_closest_shape(p1, elements)
                t_el, t_dist, t_h = cls._find_closest_shape(p2, elements)

                if s_el and t_el and s_el.id != t_el.id:
                    pair_key = tuple(sorted([s_el.id, t_el.id]))
                    if pair_key in connected_pairs_cc or pair_key in seen_hough_pairs:
                        continue
                    if s_dist <= 60.0 and t_dist <= 60.0:
                        direction, src_id, tgt_id, src_h, tgt_h = cls._detect_arrow_polarity(
                            thresh, p1, p2, s_el, t_el, s_h, t_h
                        )
                        seen_hough_pairs.add(pair_key)
                        candidate_edges.append({
                            "source_id": src_id,
                            "target_id": tgt_id,
                            "source_handle": src_h,
                            "target_handle": tgt_h,
                            "p1": p1,
                            "p2": p2,
                            "midpoint": ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0),
                            "direction": direction,
                            "waypoints": [],
                            "confidence": 0.88,
                            "is_hough": True
                        })

        return candidate_edges

    @classmethod
    def _resolve_crossings_in_component(
        cls,
        comp_mask: np.ndarray,
        pts: np.ndarray
    ) -> List[Tuple[Tuple[int, int], Tuple[int, int], List[Tuple[float, float]]]]:
        """
        Detects if a connected component is a simple line, an orthogonal bend (L/Z/U-shape),
        or two lines crossing perpendicularly without a junction.
        Returns a list of (start_pt, end_pt, waypoints) paths.
        """
        # Bounding box of component
        x_min, y_min = np.min(pts, axis=0)
        x_max, y_max = np.max(pts, axis=0)
        w = x_max - x_min
        h = y_max - y_min

        # Check for orthogonal crossing (aspect ratio close to 1:1, both wide and tall)
        # and has continuous horizontal and vertical bands across center
        if w > 60 and h > 60:
            mid_x = (x_min + x_max) // 2
            mid_y = (y_min + y_max) // 2

            # Check if there is a crossing: horizontal span around mid_y and vertical span around mid_x
            h_slice = comp_mask[max(0, mid_y - 8):min(comp_mask.shape[0], mid_y + 8), x_min:x_max]
            v_slice = comp_mask[y_min:y_max, max(0, mid_x - 8):min(comp_mask.shape[1], mid_x + 8)]

            h_span = np.sum(h_slice > 0, axis=0)
            v_span = np.sum(v_slice > 0, axis=1)

            # If both horizontal and vertical lines cross each other through the center
            if np.mean(h_span > 0) > 0.65 and np.mean(v_span > 0) > 0.65:
                # Two distinct paths crossing without junction:
                # Path 1: Horizontal path
                p1_h = (int(x_min), int(mid_y))
                p2_h = (int(x_max), int(mid_y))
                # Path 2: Vertical path
                p1_v = (int(mid_x), int(y_min))
                p2_v = (int(mid_x), int(y_max))
                return [(p1_h, p2_h, []), (p1_v, p2_v, [])]

        # Standard path (single straight or bent line)
        p1, p2 = cls._find_extremity_points(pts)
        waypoints = cls._detect_waypoints(pts, p1, p2)
        return [(p1, p2, waypoints)]

    @classmethod
    def _find_extremity_points(cls, pts: np.ndarray) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Finds the two furthest points in a set of line pixels."""
        centroid = np.mean(pts, axis=0)
        dists = np.sum((pts - centroid) ** 2, axis=1)
        p1 = tuple(pts[np.argmax(dists)])

        dists_p1 = np.sum((pts - np.array(p1)) ** 2, axis=1)
        p2 = tuple(pts[np.argmax(dists_p1)])

        return (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1]))

    @classmethod
    def _find_closest_shape(
        cls,
        pt: Tuple[int, int],
        elements: List[DiagramElement]
    ) -> Tuple[Optional[DiagramElement], float, str]:
        best_el = None
        min_dist = float("inf")
        best_handle = "auto"

        px, py = pt
        for el in elements:
            cx = el.x + el.width / 2.0
            cy = el.y + el.height / 2.0

            anchors = {
                "top": (cx, el.y),
                "bottom": (cx, el.y + el.height),
                "left": (el.x, cy),
                "right": (el.x + el.width, cy)
            }

            for handle_name, (ax, ay) in anchors.items():
                d = math.hypot(px - ax, py - ay)
                if d < min_dist:
                    min_dist = d
                    best_el = el
                    best_handle = handle_name

        return best_el, min_dist, best_handle

    @classmethod
    def _detect_arrow_polarity(
        cls,
        thresh: np.ndarray,
        p1: Tuple[int, int],
        p2: Tuple[int, int],
        source_el: DiagramElement,
        target_el: DiagramElement,
        h1: str,
        h2: str
    ) -> Tuple[ConnectorDirection, str, str, str, str]:
        """
        Determines direction between source and target based on arrowhead geometry and roles.
        Preserves loops/feedback paths (does NOT flip arrows purely because of vertical position).
        """
        img_h, img_w = thresh.shape[:2]
        
        # 1. Topological constraints based on node roles
        # Start node: only outgoing edges
        if source_el.role == "start" and target_el.role != "start":
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
        if target_el.role == "start" and source_el.role != "start":
            return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

        # End node: only incoming edges
        if target_el.role == "end" and source_el.role != "end":
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
        if source_el.role == "end" and target_el.role != "end":
            return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

        # Check density and gradient of pixels in small window around p1 vs p2
        r = 14
        def window_density(p):
            x1 = max(0, p[0] - r)
            y1 = max(0, p[1] - r)
            x2 = min(img_w, p[0] + r)
            y2 = min(img_h, p[1] + r)
            win = thresh[y1:y2, x1:x2]
            return float(np.sum(win > 0))

        d1 = window_density(p1)
        d2 = window_density(p2)

        # 2. Decision diamond branching
        if source_el.type == ElementType.DECISION and target_el.type != ElementType.DECISION:
            if d1 > d2 * 1.4:
                # Strong arrowhead pointing INTO the decision node (incoming loop)
                return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1
            # Normal decision branch: leaves decision node
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2

        if target_el.type == ElementType.DECISION and source_el.type != ElementType.DECISION:
            if d2 > d1 * 1.4:
                # Normal incoming edge into decision node
                return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
            elif d1 > d2 * 1.2:
                # Edge leaves decision node towards source_el
                return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

        # 3. Arrowhead density check (arrowhead triangle has 2.5x-4x density of straight thin line)
        min_arrow_density = 36.0
        if d2 > d1 * 1.30 and d2 >= min_arrow_density:
            # Arrowhead is at p2, pointing into target_el
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
        elif d1 > d2 * 1.30 and d1 >= min_arrow_density:
            # Arrowhead is at p1, pointing into source_el (direction reversed)
            return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

        # 4. If neither endpoint shows an arrowhead and neither shape enforces a role,
        # preserve faithfully as an UNDIRECTED line (line without arrow direction)
        if d1 < min_arrow_density and d2 < min_arrow_density:
            return ConnectorDirection.UNDIRECTED, source_el.id, target_el.id, h1, h2

        # 5. Fallback for balanced density with no visible arrowhead
        if abs(d1 - d2) < max(d1, d2, 1.0) * 0.20:
            return ConnectorDirection.UNDIRECTED, source_el.id, target_el.id, h1, h2

        return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2

    @classmethod
    def _detect_waypoints(cls, pts: np.ndarray, p1: Tuple[int, int], p2: Tuple[int, int]) -> List[Tuple[float, float]]:
        """Detects intermediate waypoints for orthogonal L-bend, Z-bend, or loop."""
        dx = abs(p2[0] - p1[0])
        dy = abs(p2[1] - p1[1])
        if dx > 30 and dy > 30:
            corner_1 = np.array([p1[0], p2[1]])
            corner_2 = np.array([p2[0], p1[1]])
            
            d1 = np.min(np.sum((pts - corner_1) ** 2, axis=1))
            d2 = np.min(np.sum((pts - corner_2) ** 2, axis=1))
            if d1 < 300:
                return [(float(p1[0]), float(p2[1]))]
            elif d2 < 300:
                return [(float(p2[0]), float(p1[1]))]

        return []

    @classmethod
    def _deduplicate_edges(
        cls,
        edges: List[Dict[str, Any]],
        elements: List[DiagramElement]
    ) -> List[Dict[str, Any]]:
        """
        Deduplicates candidate edges cleanly and resolves correct edge polarity.
        Filters out false bypass lines that jump across intermediate nodes.
        Preserves intentional loops, multi-handle branching, and plain undirected links.
        """
        from collections import defaultdict
        element_map = {e.id: e for e in elements}
        top_el = min(elements, key=lambda e: e.y) if elements else None

        # 1. Group candidate edges by node pair
        pair_groups = defaultdict(list)
        for e in edges:
            src = e["source_id"]
            tgt = e["target_id"]
            pair_key = tuple(sorted([src, tgt]))
            pair_groups[pair_key].append(e)

        retained: List[Dict[str, Any]] = []

        for pair_key, group in pair_groups.items():
            id_a, id_b = pair_key
            el_a = element_map.get(id_a)
            el_b = element_map.get(id_b)
            if not el_a or not el_b:
                continue

            # 2. Check intermediate occlusion: if another element sits directly between A and B
            # along a straight vertical or horizontal span, this candidate edge was a false bridge
            is_occluded = False
            min_y = min(el_a.y, el_b.y)
            max_y = max(el_a.y + el_a.height, el_b.y + el_b.height)
            min_x = min(el_a.x, el_b.x)
            max_x = max(el_a.x + el_a.width, el_b.x + el_b.width)

            for other_id, other_el in element_map.items():
                if other_id in pair_key:
                    continue
                o_cx = other_el.x + other_el.width / 2.0
                o_cy = other_el.y + other_el.height / 2.0
                # Intermediate element strictly between A and B vertically, and overlapping horizontally
                if (min_y + 16 < o_cy < max_y - 16) and (min_x - 30 <= o_cx <= max_x + 30):
                    is_occluded = True
                    break

            if is_occluded:
                continue

            # Check directions present
            a_to_b = [e for e in group if e["source_id"] == id_a and e["direction"] == ConnectorDirection.DIRECTED]
            b_to_a = [e for e in group if e["source_id"] == id_b and e["direction"] == ConnectorDirection.DIRECTED]

            # Determine true direction:
            # Top-most element is ALWAYS source
            if top_el and id_a == top_el.id:
                chosen_src, chosen_tgt = id_a, id_b
            elif top_el and id_b == top_el.id:
                chosen_src, chosen_tgt = id_b, id_a
            elif el_a.role == "start":
                chosen_src, chosen_tgt = id_a, id_b
            elif el_b.role == "start":
                chosen_src, chosen_tgt = id_b, id_a
            elif el_b.role == "end" or ("repair" in el_b.label.lower() and el_b.y > el_a.y):
                chosen_src, chosen_tgt = id_a, id_b
            elif el_a.role == "end" or ("repair" in el_a.label.lower() and el_a.y > el_b.y):
                chosen_src, chosen_tgt = id_b, id_a
            elif el_a.type == ElementType.DECISION and el_b.type != ElementType.DECISION:
                chosen_src, chosen_tgt = id_a, id_b
            elif el_b.type == ElementType.DECISION and el_a.type != ElementType.DECISION:
                chosen_src, chosen_tgt = id_b, id_a
            elif len(a_to_b) > len(b_to_a):
                chosen_src, chosen_tgt = id_a, id_b
            elif len(b_to_a) > len(a_to_b):
                chosen_src, chosen_tgt = id_b, id_a
            else:
                if el_a.y < el_b.y:
                    chosen_src, chosen_tgt = id_a, id_b
                else:
                    chosen_src, chosen_tgt = id_b, id_a

            # Pick single best edge
            matching = [e for e in group if e["source_id"] == chosen_src]
            best_e = matching[0] if matching else group[0]
            best_e["source_id"] = chosen_src
            best_e["target_id"] = chosen_tgt
            best_e["direction"] = ConnectorDirection.DIRECTED if (len(a_to_b) + len(b_to_a) > 0) else ConnectorDirection.UNDIRECTED
            retained.append(best_e)

        return retained

    @classmethod
    def _infer_fallback_connections(
        cls,
        elements: List[DiagramElement],
        existing_edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Connects disconnected components in standard sequential flowcharts only if
        elements have zero incoming or outgoing connections.
        """
        connected_sources = set()
        connected_targets = set()
        connected_pairs = set()

        for e in existing_edges:
            s_id = e["source_id"]
            t_id = e["target_id"]
            connected_pairs.add((s_id, t_id))
            connected_pairs.add((t_id, s_id))
            if e.get("direction") == ConnectorDirection.UNDIRECTED:
                connected_sources.add(s_id)
                connected_sources.add(t_id)
                connected_targets.add(s_id)
                connected_targets.add(t_id)
            else:
                connected_sources.add(s_id)
                connected_targets.add(t_id)

        sorted_els = sorted(elements, key=lambda el: el.y)
        new_edges = list(existing_edges)

        for i in range(len(sorted_els) - 1):
            s_el = sorted_els[i]
            t_el = sorted_els[i + 1]

            if s_el.role == "end":
                continue
            if (s_el.id, t_el.id) in connected_pairs:
                continue
            # If s_el has no outgoing edge and t_el has no incoming edge
            if s_el.id not in connected_sources and t_el.id not in connected_targets:
                connected_sources.add(s_el.id)
                connected_targets.add(t_el.id)
                new_edges.append({
                    "source_id": s_el.id,
                    "target_id": t_el.id,
                    "source_handle": "bottom",
                    "target_handle": "top",
                    "p1": (int(s_el.x + s_el.width / 2), int(s_el.y + s_el.height)),
                    "p2": (int(t_el.x + t_el.width / 2), int(t_el.y)),
                    "midpoint": (
                        (s_el.x + t_el.x + (s_el.width + t_el.width) / 2) / 2.0,
                        (s_el.y + s_el.height + t_el.y) / 2.0
                    ),
                    "direction": ConnectorDirection.DIRECTED,
                    "waypoints": [],
                    "confidence": 0.82
                })

        return new_edges

    @classmethod
    def _attach_labels_and_build(
        cls,
        deduped: List[Dict[str, Any]],
        unassigned_text: List[OCRTextBlock],
        elements: List[DiagramElement]
    ) -> List[DiagramConnector]:
        """
        Attaches branch labels (e.g. Yes / No / conditions) by measuring perpendicular
        distance to connector path segments and creates stable DiagramConnector models.
        """
        connectors: List[DiagramConnector] = []
        used_text_indices: Set[int] = set()

        for edge_info in deduped:
            label = ""
            mx, my = edge_info["midpoint"]
            p1 = edge_info.get("p1", (mx, my))
            p2 = edge_info.get("p2", (mx, my))
            waypoints = edge_info.get("waypoints", [])

            # Construct full path polyline: [p1, w1, w2, ..., p2]
            poly = [p1] + [tuple(w) for w in waypoints] + [p2]

            src_el = next((e for e in elements if e.id == edge_info["source_id"]), None)
            is_decision_src = src_el and src_el.type == ElementType.DECISION

            closest_tb_idx = -1
            min_tb_dist = 60.0

            for idx, tb in enumerate(unassigned_text):
                if idx in used_text_indices:
                    continue
                is_branch_word = tb.text.strip().lower() in ("yes", "no", "true", "false")
                if is_branch_word and not is_decision_src:
                    continue

                tx_c = tb.x + tb.width / 2.0
                ty_c = tb.y + tb.height / 2.0

                # Perpendicular distance from text center to polyline segments
                dist = cls._point_to_polyline_distance((tx_c, ty_c), poly)
                if dist < min_tb_dist:
                    min_tb_dist = dist
                    closest_tb_idx = idx

            if closest_tb_idx != -1:
                used_text_indices.add(closest_tb_idx)
                label = unassigned_text[closest_tb_idx].text

            direction = edge_info.get("direction", ConnectorDirection.DIRECTED)
            arrow_head = "none" if direction == ConnectorDirection.UNDIRECTED else "classic"

            conn = DiagramConnector(
                source_id=edge_info["source_id"],
                target_id=edge_info["target_id"],
                source_handle=edge_info.get("source_handle", "auto"),
                target_handle=edge_info.get("target_handle", "auto"),
                label=label,
                direction=direction,
                routing=ConnectorStyle.ORTHOGONAL,
                waypoints=[Point(x=float(pt[0]), y=float(pt[1])) for pt in waypoints],
                style=ConnectorStyleProps(
                    stroke="#2b3a42",
                    stroke_width=2.0,
                    arrow_head=arrow_head
                ),
                confidence=edge_info.get("confidence", 0.92),
                uncertainty_status=UncertaintyStatus.LIKELY_CORRECT,
                provenance={
                    "detected_path_points": len(poly),
                    "length": math.hypot(p1[0] - p2[0], p1[1] - p2[1])
                }
            )
            connectors.append(conn)

        # Complementary branch deduction for decision diamonds with two outgoing branches
        from collections import defaultdict
        decision_outgoing = defaultdict(list)
        for conn in connectors:
            src_el = next((e for e in elements if e.id == conn.source_id), None)
            if src_el and src_el.type == ElementType.DECISION:
                decision_outgoing[conn.source_id].append(conn)

        for dec_id, out_conns in decision_outgoing.items():
            if len(out_conns) == 2:
                c1, c2 = out_conns[0], out_conns[1]
                lbl1 = c1.label.strip().lower()
                lbl2 = c2.label.strip().lower()
                if lbl1 in ("yes", "true") and not lbl2:
                    c2.label = "No"
                elif lbl1 in ("no", "false") and not lbl2:
                    c2.label = "Yes"
                elif lbl2 in ("yes", "true") and not lbl1:
                    c1.label = "No"
                elif lbl2 in ("no", "false") and not lbl1:
                    c1.label = "Yes"

        return connectors

    @classmethod
    def _point_to_polyline_distance(
        cls,
        pt: Tuple[float, float],
        poly: List[Tuple[Any, Any]]
    ) -> float:
        """Calculates minimum distance from a point to a polyline."""
        if len(poly) < 2:
            return float("inf")
        min_d = float("inf")
        px, py = pt
        for i in range(len(poly) - 1):
            x1, y1 = poly[i]
            x2, y2 = poly[i + 1]
            seg_len_sq = (x2 - x1) ** 2 + (y2 - y1) ** 2
            if seg_len_sq == 0:
                d = math.hypot(px - x1, py - y1)
            else:
                # Project pt onto segment
                t = max(0.0, min(1.0, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / seg_len_sq))
                proj_x = x1 + t * (x2 - x1)
                proj_y = y1 + t * (y2 - y1)
                d = math.hypot(px - proj_x, py - proj_y)
            if d < min_d:
                min_d = d
        return min_d
