"""
ODR Connector and Arrowhead Extractor.
Extracts diagram connectors, routes lines, detects arrowhead orientation,
snaps endpoints to shape boundaries, and associates branch labels (Yes/No).
"""

import math
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from backend.core.models import (
    DiagramElement,
    DiagramConnector,
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

        # Find line segments via Probabilistic Hough Transform
        lines = cv2.HoughLinesP(
            line_mask,
            rho=1,
            theta=np.pi / 180,
            threshold=25,
            minLineLength=20,
            maxLineGap=15
        )

        # Also find connected components in the line mask
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(line_mask, connectivity=8)

        candidate_edges: List[Dict[str, Any]] = []

        # Analyze line segments and connected clusters
        for i in range(1, num_labels):
            stat = stats[i]
            area = stat[cv2.CC_STAT_AREA]
            cw = stat[cv2.CC_STAT_WIDTH]
            ch = stat[cv2.CC_STAT_HEIGHT]
            # Must be long enough to span between nodes
            if area < 15 or (cw < 15 and ch < 15):
                continue

            comp_mask = (labels == i).astype(np.uint8) * 255
            pts = cv2.findNonZero(comp_mask)
            if pts is None or len(pts) < 10:
                continue

            # Fit line or find extremities
            pts_2d = pts.reshape(-1, 2)
            p1, p2 = cls._find_extremity_points(pts_2d)

            # Snap p1 and p2 to shapes
            source_el, source_dist, source_handle = cls._find_closest_shape(p1, elements)
            target_el, target_dist, target_handle = cls._find_closest_shape(p2, elements)

            if source_el and target_el and source_el.id != target_el.id:
                # Snap distance tolerance (within 70 pixels)
                max_snap_dist = 85.0
                if source_dist <= max_snap_dist and target_dist <= max_snap_dist:
                    # Detect arrowhead polarity
                    direction, src_id, tgt_id, src_h, tgt_h = cls._detect_arrow_polarity(
                        thresh, p1, p2, source_el, target_el, source_handle, target_handle
                    )
                    
                    # Detect intermediate waypoints for orthogonal routing
                    waypoints = cls._detect_waypoints(pts_2d, p1, p2)

                    candidate_edges.append({
                        "source_id": src_id,
                        "target_id": tgt_id,
                        "source_handle": src_h,
                        "target_handle": tgt_h,
                        "p1": p1,
                        "p2": p2,
                        "midpoint": ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0),
                        "direction": direction,
                        "waypoints": waypoints,
                        "confidence": 0.92
                    })

        # Deduplicate candidate edges (merge edges with same source and target)
        deduped = cls._deduplicate_edges(candidate_edges)

        # Fallback: If elements are vertically/horizontally aligned but lines were faint,
        # infer sequential flowchart connections based on topological flow
        if len(deduped) < len(elements) - 1:
            deduped = cls._infer_fallback_connections(elements, deduped)

        # Associate unassigned text blocks as edge labels (e.g. Yes / No)
        connectors: List[DiagramConnector] = []
        used_text_indices = set()

        for edge_info in deduped:
            label = ""
            mx, my = edge_info["midpoint"]
            
            # Find closest unassigned text within 60px of the edge midpoint or path
            closest_tb_idx = -1
            min_tb_dist = 65.0

            for idx, tb in enumerate(unassigned_text):
                if idx in used_text_indices:
                    continue
                tx_c = tb.x + tb.width / 2.0
                ty_c = tb.y + tb.height / 2.0
                dist = math.hypot(mx - tx_c, my - ty_c)
                if dist < min_tb_dist:
                    min_tb_dist = dist
                    closest_tb_idx = idx

            if closest_tb_idx != -1:
                used_text_indices.add(closest_tb_idx)
                label = unassigned_text[closest_tb_idx].text

            conn = DiagramConnector(
                source_id=edge_info["source_id"],
                target_id=edge_info["target_id"],
                source_handle=edge_info.get("source_handle", "auto"),
                target_handle=edge_info.get("target_handle", "auto"),
                label=label,
                direction=edge_info.get("direction", ConnectorDirection.DIRECTED),
                routing=ConnectorStyle.ORTHOGONAL,
                waypoints=[Point(x=float(pt[0]), y=float(pt[1])) for pt in edge_info.get("waypoints", [])],
                style=ConnectorStyleProps(
                    stroke="#2b3a42",
                    stroke_width=2.0,
                    arrow_head="classic"
                ),
                confidence=edge_info.get("confidence", 0.90),
                uncertainty_status=UncertaintyStatus.LIKELY_CORRECT,
                provenance={"detected_line_dist": math.hypot(edge_info["p1"][0] - edge_info["p2"][0], edge_info["p1"][1] - edge_info["p2"][1])}
            )
            connectors.append(conn)

        return connectors

    @classmethod
    def _find_extremity_points(cls, pts: np.ndarray) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Finds the two furthest points in a set of line pixels."""
        # Find points furthest from centroid
        centroid = np.mean(pts, axis=0)
        dists = np.sum((pts - centroid) ** 2, axis=1)
        p1 = tuple(pts[np.argmax(dists)])

        # Furthest point from p1
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
            # Calculate distance to closest border point of element bounding box
            cx = el.x + el.width / 2.0
            cy = el.y + el.height / 2.0

            # Distance to 4 anchor handles
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
        Determines direction between source and target based on arrowhead tip density.
        """
        img_h, img_w = thresh.shape[:2]
        
        # Check density of pixels in small window around p1 vs p2
        r = 12
        def window_density(p):
            x1 = max(0, p[0] - r)
            y1 = max(0, p[1] - r)
            x2 = min(img_w, p[0] + r)
            y2 = min(img_h, p[1] + r)
            win = thresh[y1:y2, x1:x2]
            return np.sum(win > 0)

        d1 = window_density(p1)
        d2 = window_density(p2)

        # Arrowheads typically have higher local triangular density
        if d2 > d1 * 1.3:
            # Arrow is at p2, pointing into target_el
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
        elif d1 > d2 * 1.3:
            # Arrow is at p1, pointing into source_el (so direction is reversed)
            return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

        # Default flow: downward / rightward flow in flowcharts
        cy_src = source_el.y + source_el.height / 2.0
        cy_tgt = target_el.y + target_el.height / 2.0
        if cy_src <= cy_tgt:
            return ConnectorDirection.DIRECTED, source_el.id, target_el.id, h1, h2
        else:
            return ConnectorDirection.DIRECTED, target_el.id, source_el.id, h2, h1

    @classmethod
    def _detect_waypoints(cls, pts: np.ndarray, p1: Tuple[int, int], p2: Tuple[int, int]) -> List[Tuple[float, float]]:
        """Detects if a connector has an orthogonal L-bend or Z-bend."""
        dx = abs(p2[0] - p1[0])
        dy = abs(p2[1] - p1[1])
        if dx > 40 and dy > 40:
            # Corner is either (p1.x, p2.y) or (p2.x, p1.y)
            corner_1 = np.array([p1[0], p2[1]])
            corner_2 = np.array([p2[0], p1[1]])
            
            d1 = np.min(np.sum((pts - corner_1) ** 2, axis=1))
            d2 = np.min(np.sum((pts - corner_2) ** 2, axis=1))
            if d1 < 250:
                return [(float(p1[0]), float(p2[1]))]
            elif d2 < 250:
                return [(float(p2[0]), float(p1[1]))]

        return []

    @classmethod
    def _deduplicate_edges(cls, edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        unique = []
        for e in edges:
            key = (e["source_id"], e["target_id"])
            if key not in seen:
                seen.add(key)
                unique.append(e)
        return unique

    @classmethod
    def _infer_fallback_connections(
        cls,
        elements: List[DiagramElement],
        existing_edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        If elements exist without connectors (e.g. hand-drawn lines with small gaps),
        infers topological flowchart sequence based on vertical ordering and start/end roles.
        """
        connected_pairs = {(e["source_id"], e["target_id"]) for e in existing_edges}
        
        # Sort elements by Y coordinate (top to bottom)
        sorted_els = sorted(elements, key=lambda el: el.y)
        
        new_edges = list(existing_edges)
        for i in range(len(sorted_els) - 1):
            s_el = sorted_els[i]
            t_el = sorted_els[i + 1]

            # Don't connect if already connected or if s_el is an End node
            if s_el.role == "end":
                continue
            if (s_el.id, t_el.id) not in connected_pairs:
                connected_pairs.add((s_el.id, t_el.id))
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
