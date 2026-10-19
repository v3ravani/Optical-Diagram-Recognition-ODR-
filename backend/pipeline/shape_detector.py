"""
ODR Shape and Symbol Detector.
Detects flowchart and diagram geometric shapes (terminal, process, decision, IO, database)
using contour analysis, polygonal approximation, and spatial text association.
Supports hand-drawn, printed, and screenshot diagrams.
"""

import math
import re
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from backend.core.models import (
    DiagramElement,
    ElementType,
    ElementStyle,
    UncertaintyStatus
)
from backend.pipeline.ocr_engine import OCRTextBlock

BRANCH_WORDS = {"yes", "no", "true", "false", "y", "n", "es", "ne", "ok"}


class DetectedShape:
    def __init__(
        self,
        element_type: ElementType,
        x: int,
        y: int,
        width: int,
        height: int,
        contour: Optional[np.ndarray],
        confidence: float,
        role: str = "process"
    ):
        self.element_type = element_type
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.contour = contour
        self.confidence = confidence
        self.role = role
        self.matched_text: List[OCRTextBlock] = []


class ShapeDetector:
    """Detects geometric shapes and binds them with enclosed OCR text."""

    @classmethod
    def detect_shapes(
        cls,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock]
    ) -> Tuple[List[DiagramElement], List[OCRTextBlock]]:
        """
        Analyzes the image for shapes and binds enclosed text.
        Returns (detected_elements, remaining_unassigned_text_blocks).
        """
        img_h, img_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 1. Separate branch labels from node text blocks
        branch_labels: List[OCRTextBlock] = []
        node_text_blocks: List[OCRTextBlock] = []

        for b in ocr_blocks:
            clean = re.sub(r'[^a-zA-Z0-9]', '', b.text).lower()
            if clean in BRANCH_WORDS:
                norm = "Yes" if clean in {"yes", "y", "es"} else "No"
                b.text = norm
                branch_labels.append(b)
            else:
                node_text_blocks.append(b)

        # 2. Cluster vertically adjacent and horizontally overlapping node text blocks
        text_clusters = cls._cluster_text_lines(node_text_blocks)

        # 3. Contour detection
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        raw_shapes: List[DetectedShape] = []
        min_shape_area = (img_w * img_h) * 0.003
        max_shape_area = (img_w * img_h) * 0.65  # Strictly exclude outer frames/containers

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_shape_area or area > max_shape_area:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            if w < 25 or h < 20:
                continue

            aspect_ratio = float(w) / h
            if aspect_ratio > 8.0 or aspect_ratio < 0.12:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.035 * peri, True)
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / (hull_area + 1e-5)
            circularity = 4 * math.pi * (area / ((peri * peri) + 1e-5))

            element_type, role, confidence = cls._classify_contour(
                approx, cnt, x, y, w, h, solidity, circularity
            )

            raw_shapes.append(DetectedShape(
                element_type=element_type,
                x=x,
                y=y,
                width=w,
                height=h,
                contour=cnt,
                confidence=confidence,
                role=role
            ))

        # 4. Eliminate containers (shapes that contain >= 2 other shapes) and duplicates
        filtered_shapes = cls._filter_containers_and_duplicates(raw_shapes)

        # 5. Assign text clusters to the SMALLEST containing shape
        unmatched_clusters = []
        for cluster in text_clusters:
            cx1 = min(b.x for b in cluster)
            cy1 = min(b.y for b in cluster)
            cx2 = max(b.x + b.width for b in cluster)
            cy2 = max(b.y + b.height for b in cluster)
            c_center_x = (cx1 + cx2) / 2.0
            c_center_y = (cy1 + cy2) / 2.0

            # Find all shapes containing this cluster
            containing = [
                s for s in filtered_shapes
                if s.x <= c_center_x <= s.x + s.width and s.y <= c_center_y <= s.y + s.height
            ]

            if containing:
                # Pick the smallest containing shape
                best_shape = min(containing, key=lambda s: s.width * s.height)
                best_shape.matched_text.extend(cluster)
            else:
                unmatched_clusters.append(cluster)

        # 6. Fallback: Create shapes for unmatched text clusters (hand-drawn gaps or unbordered steps)
        for cluster in unmatched_clusters:
            cx1 = min(b.x for b in cluster)
            cy1 = min(b.y for b in cluster)
            cx2 = max(b.x + b.width for b in cluster)
            cy2 = max(b.y + b.height for b in cluster)
            bw = cx2 - cx1
            bh = cy2 - cy1
            combined = " ".join(b.text for b in cluster)

            pad_x = 24 if "?" in combined else 18
            pad_y = 16 if "?" in combined else 12

            shape = DetectedShape(
                element_type=ElementType.DECISION if "?" in combined else ElementType.PROCESS,
                x=max(0, int(cx1 - pad_x)),
                y=max(0, int(cy1 - pad_y)),
                width=int(bw + 2 * pad_x),
                height=int(bh + 2 * pad_y),
                contour=None,
                confidence=0.90,
                role="decision" if "?" in combined else "process"
            )
            shape.matched_text = cluster
            filtered_shapes.append(shape)

        # 7. Discard empty shapes that have no text and no obvious terminal role
        final_shapes = [s for s in filtered_shapes if s.matched_text or s.element_type == ElementType.TERMINAL]

        # 8. Build DiagramElement objects with semantic role/type resolution
        elements: List[DiagramElement] = []
        for shape in final_shapes:
            shape.matched_text.sort(key=lambda t: (t.y, t.x))
            combined_label = " ".join(t.text for t in shape.matched_text).strip()

            el_type = shape.element_type
            role = shape.role

            # Semantic overrides
            lower_label = combined_label.lower()
            if "?" in combined_label or any(k in lower_label for k in ["is ", "has ", "check ", "should ", "if "]):
                el_type = ElementType.DECISION
                role = "decision"
            elif any(k in lower_label for k in ["start", "begin"]):
                el_type = ElementType.TERMINAL
                role = "start"
            elif any(k in lower_label for k in ["end", "stop", "finish"]):
                el_type = ElementType.TERMINAL
                role = "end"

            ocr_conf = np.mean([t.confidence for t in shape.matched_text]) if shape.matched_text else 0.90
            overall_conf = round(float(shape.confidence * 0.4 + ocr_conf * 0.6), 2)

            uncertainty = UncertaintyStatus.LIKELY_CORRECT
            if overall_conf < 0.70:
                uncertainty = UncertaintyStatus.NEEDS_REVIEW

            el = DiagramElement(
                type=el_type,
                role=role,
                label=combined_label,
                raw_text=combined_label,
                x=float(shape.x),
                y=float(shape.y),
                width=float(shape.width),
                height=float(shape.height),
                style=ElementStyle(
                    fill="#ffffff",
                    stroke="#2b3a42",
                    stroke_width=2.0,
                    text_color="#1e293b",
                    font_size=14,
                    corner_radius=20.0 if el_type == ElementType.TERMINAL else 4.0
                ),
                confidence=overall_conf,
                uncertainty_status=uncertainty,
                source_box=[float(shape.x), float(shape.y), float(shape.width), float(shape.height)],
                provenance={
                    "shape_confidence": shape.confidence,
                    "ocr_confidence": float(ocr_conf)
                }
            )
            elements.append(el)

        return elements, branch_labels

    @classmethod
    def _cluster_text_lines(cls, blocks: List[OCRTextBlock]) -> List[List[OCRTextBlock]]:
        """Groups vertically stacked and horizontally overlapping text lines belonging to the same step."""
        if not blocks:
            return []

        used = set()
        clusters: List[List[OCRTextBlock]] = []

        for i, b1 in enumerate(blocks):
            if i in used:
                continue
            cluster = [b1]
            used.add(i)

            for j, b2 in enumerate(blocks):
                if j in used:
                    continue
                # Horizontal overlap
                overlap_x = max(0, min(b1.x + b1.width, b2.x + b2.width) - max(b1.x, b2.x))
                if overlap_x > 15:
                    # Vertical adjacency within 40px
                    if abs(b2.y - (b1.y + b1.height)) < 40 or abs(b1.y - (b2.y + b2.height)) < 40:
                        cluster.append(b2)
                        used.add(j)

            cluster.sort(key=lambda b: (b.y, b.x))
            clusters.append(cluster)

        return clusters

    @classmethod
    def _filter_containers_and_duplicates(cls, shapes: List[DetectedShape]) -> List[DetectedShape]:
        if not shapes:
            return []

        # 1. Eliminate containers that enclose >= 2 other candidate shapes
        non_containers: List[DetectedShape] = []
        for s1 in shapes:
            inside_count = 0
            for s2 in shapes:
                if s1 is s2:
                    continue
                # Center of s2 inside s1
                s2_cx = s2.x + s2.width / 2.0
                s2_cy = s2.y + s2.height / 2.0
                if s1.x <= s2_cx <= s1.x + s1.width and s1.y <= s2_cy <= s1.y + s1.height:
                    inside_count += 1

            # If s1 contains 2 or more other shapes, it is an outer frame or diagram border!
            if inside_count < 2:
                non_containers.append(s1)

        # 2. Sort by area ascending so smaller/tighter boxes are prioritized
        non_containers.sort(key=lambda s: s.width * s.height)
        kept: List[DetectedShape] = []

        for s in non_containers:
            # Check duplicate / nested border
            is_dup = False
            for existing in kept:
                ix1 = max(s.x, existing.x)
                iy1 = max(s.y, existing.y)
                ix2 = min(s.x + s.width, existing.x + existing.width)
                iy2 = min(s.y + s.height, existing.y + existing.height)

                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    s_area = s.width * s.height
                    exist_area = existing.width * existing.height
                    if inter_area / s_area > 0.70 or inter_area / exist_area > 0.70:
                        is_dup = True
                        break

            if not is_dup:
                kept.append(s)

        return kept

    @classmethod
    def _classify_contour(
        cls,
        approx: np.ndarray,
        cnt: np.ndarray,
        x: int,
        y: int,
        w: int,
        h: int,
        solidity: float,
        circularity: float
    ) -> Tuple[ElementType, str, float]:
        num_v = len(approx)
        aspect = float(w) / h

        # Diamond check (4 to 8 vertices)
        if 4 <= num_v <= 8:
            pts = approx.reshape(-1, 2)
            pts_x = pts[:, 0]
            pts_y = pts[:, 1]
            min_x_pt = pts[np.argmin(pts_x)]
            max_x_pt = pts[np.argmax(pts_x)]
            min_y_pt = pts[np.argmin(pts_y)]
            max_y_pt = pts[np.argmax(pts_y)]

            y_mid = y + h / 2.0
            x_mid = x + w / 2.0
            is_diamond = (
                abs(min_x_pt[1] - y_mid) < h * 0.25 and
                abs(max_x_pt[1] - y_mid) < h * 0.25 and
                abs(min_y_pt[0] - x_mid) < w * 0.25 and
                abs(max_y_pt[0] - x_mid) < w * 0.25
            )
            if is_diamond and 0.65 <= aspect <= 1.55:
                return ElementType.DECISION, "decision", 0.94

        if circularity > 0.68 or (num_v >= 6 and solidity > 0.92):
            if 0.85 <= aspect <= 1.15:
                return ElementType.CIRCLE, "connector", 0.93
            return ElementType.TERMINAL, "terminal", 0.91

        return ElementType.PROCESS, "process", 0.90
