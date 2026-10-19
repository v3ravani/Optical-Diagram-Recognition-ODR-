"""
ODR Shape and Symbol Detector.
Detects flowchart and diagram geometric shapes (terminal, process, decision, IO, database)
using contour analysis, polygonal approximation, and spatial text association.
"""

import math
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


class DetectedShape:
    def __init__(
        self,
        element_type: ElementType,
        x: int,
        y: int,
        width: int,
        height: int,
        contour: np.ndarray,
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
        
        # Adaptive thresholding to obtain binary line work
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6
        )

        # Morphological close to bridge small gaps in lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, hierarchy = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        raw_shapes: List[DetectedShape] = []
        min_shape_area = (img_w * img_h) * 0.003  # Minimum 0.3% of diagram area
        max_shape_area = (img_w * img_h) * 0.85   # Ignore outer frame

        for idx, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area < min_shape_area or area > max_shape_area:
                continue

            # Check if this contour has children that represent shapes (to avoid duplicate outer/inner borders)
            x, y, w, h = cv2.boundingRect(cnt)
            if w < 25 or h < 20:
                continue

            aspect_ratio = float(w) / h
            # Ignore extremely thin lines (those are connectors or arrows, handled later)
            if aspect_ratio > 8.0 or aspect_ratio < 0.12:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.035 * peri, True)
            num_vertices = len(approx)

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

        # Filter nested/duplicate shapes using non-maximum suppression
        filtered_shapes = cls._filter_redundant_shapes(raw_shapes)

        # Associate OCR text blocks with shapes
        elements: List[DiagramElement] = []
        remaining_text: List[OCRTextBlock] = []

        for block in ocr_blocks:
            bx_center = block.x + block.width / 2.0
            by_center = block.y + block.height / 2.0

            matched = False
            for shape in filtered_shapes:
                # Check if text center is inside shape bounding box
                if (shape.x <= bx_center <= shape.x + shape.width and
                    shape.y <= by_center <= shape.y + shape.height):
                    shape.matched_text.append(block)
                    matched = True
                    break
            
            if not matched:
                remaining_text.append(block)

        # Fallback: If a cluster of text blocks has no bounding shape detected around it,
        # it might be an unbordered node or text step in the diagram
        orphan_nodes, remaining_text = cls._cluster_orphan_text(remaining_text, img_w, img_h)

        # Build DiagramElement objects
        for shape in filtered_shapes:
            # Sort text lines top-to-bottom
            shape.matched_text.sort(key=lambda t: (t.y, t.x))
            combined_label = " ".join(t.text for t in shape.matched_text).strip()
            
            # Refine role based on text content (e.g. "Start", "Begin", "Stop", "End")
            role = shape.role
            lower_label = combined_label.lower()
            if any(k in lower_label for k in ["start", "begin"]):
                role = "start"
                shape.element_type = ElementType.TERMINAL
            elif any(k in lower_label for k in ["end", "stop", "finish"]):
                role = "end"
                shape.element_type = ElementType.TERMINAL

            ocr_conf = np.mean([t.confidence for t in shape.matched_text]) if shape.matched_text else 0.90
            overall_conf = round(float(shape.confidence * 0.4 + ocr_conf * 0.6), 2)

            uncertainty = UncertaintyStatus.LIKELY_CORRECT
            if overall_conf < 0.70 or not combined_label:
                uncertainty = UncertaintyStatus.NEEDS_REVIEW
            elif overall_conf < 0.85:
                uncertainty = UncertaintyStatus.LIKELY_CORRECT

            el = DiagramElement(
                type=shape.element_type,
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
                    corner_radius=20.0 if shape.element_type == ElementType.TERMINAL else 4.0
                ),
                confidence=overall_conf,
                uncertainty_status=uncertainty,
                source_box=[float(shape.x), float(shape.y), float(shape.width), float(shape.height)],
                provenance={
                    "shape_confidence": shape.confidence,
                    "ocr_confidence": float(ocr_conf),
                    "vertex_count": len(shape.contour)
                }
            )
            elements.append(el)

        elements.extend(orphan_nodes)
        return elements, remaining_text

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

        # 1. Diamond / Decision
        if num_v == 4:
            # Check if vertices align near midpoints of bounding box sides (characteristic of diamonds)
            pts = approx.reshape(4, 2)
            pts_x = pts[:, 0]
            pts_y = pts[:, 1]
            min_x_pt = pts[np.argmin(pts_x)]
            max_x_pt = pts[np.argmax(pts_x)]
            min_y_pt = pts[np.argmin(pts_y)]
            max_y_pt = pts[np.argmax(pts_y)]

            # In a diamond, left and right vertices are near middle Y; top and bottom are near middle X
            y_mid = y + h / 2.0
            x_mid = x + w / 2.0
            is_diamond = (
                abs(min_x_pt[1] - y_mid) < h * 0.25 and
                abs(max_x_pt[1] - y_mid) < h * 0.25 and
                abs(min_y_pt[0] - x_mid) < w * 0.25 and
                abs(max_y_pt[0] - x_mid) < w * 0.25
            )
            if is_diamond:
                return ElementType.DECISION, "decision", 0.94

            # Parallelogram / IO (slanted vertical sides)
            dx_top = abs(pts[0][0] - pts[1][0])
            dx_bottom = abs(pts[2][0] - pts[3][0])
            if abs(aspect - 1.0) < 0.5 and solidity > 0.88:
                # Could be standard process rectangle
                return ElementType.PROCESS, "process", 0.92
            return ElementType.PROCESS, "process", 0.90

        # 2. Oval / Terminal / Circle (more than 5 vertices with high circularity or smooth curvature)
        if circularity > 0.60 or num_v >= 6:
            if 0.85 <= aspect <= 1.15 and circularity > 0.75:
                return ElementType.CIRCLE, "connector", 0.93
            return ElementType.TERMINAL, "terminal", 0.91

        # 3. Default rectangle / process
        return ElementType.PROCESS, "process", 0.85

    @classmethod
    def _filter_redundant_shapes(cls, shapes: List[DetectedShape]) -> List[DetectedShape]:
        if not shapes:
            return []
        
        # Sort by area descending
        shapes.sort(key=lambda s: s.width * s.height, reverse=True)
        kept: List[DetectedShape] = []

        for shape in shapes:
            # Check if this shape is essentially identical or an inner duplicate (e.g. double border)
            is_duplicate = False
            for existing in kept:
                # Overlap calculation
                ix1 = max(shape.x, existing.x)
                iy1 = max(shape.y, existing.y)
                ix2 = min(shape.x + shape.width, existing.x + existing.width)
                iy2 = min(shape.y + shape.height, existing.y + existing.height)

                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    shape_area = shape.width * shape.height
                    exist_area = existing.width * existing.height
                    # If this shape is inside an existing shape and takes > 75% of it, it's a double line
                    if inter_area / shape_area > 0.75 and inter_area / exist_area > 0.60:
                        is_duplicate = True
                        break

            if not is_duplicate:
                kept.append(shape)

        return kept

    @classmethod
    def _cluster_orphan_text(
        cls,
        text_blocks: List[OCRTextBlock],
        img_w: int,
        img_h: int
    ) -> Tuple[List[DiagramElement], List[OCRTextBlock]]:
        """
        Detects whether any remaining text blocks constitute unbordered process blocks or annotations.
        """
        orphan_elements: List[DiagramElement] = []
        remaining: List[OCRTextBlock] = []

        for tb in text_blocks:
            # If text is very short (like "Yes", "No", "1", "0", "A"), it's likely an edge label
            clean = tb.text.strip().lower()
            if clean in ["yes", "no", "true", "false", "ok", "y", "n"]:
                remaining.append(tb)
                continue

            # Otherwise, if it has a decent size, treat as a text step / process node
            if tb.width > 40 and tb.height > 15:
                pad = 12
                orphan = DiagramElement(
                    type=ElementType.PROCESS,
                    role="process",
                    label=tb.text,
                    raw_text=tb.text,
                    x=float(max(0, tb.x - pad)),
                    y=float(max(0, tb.y - pad)),
                    width=float(tb.width + 2 * pad),
                    height=float(tb.height + 2 * pad),
                    style=ElementStyle(
                        fill="#ffffff",
                        stroke="#2b3a42",
                        stroke_width=2.0,
                        text_color="#1e293b",
                        font_size=14,
                        corner_radius=4.0
                    ),
                    confidence=round(float(tb.confidence), 2),
                    uncertainty_status=UncertaintyStatus.LIKELY_CORRECT if tb.confidence > 0.8 else UncertaintyStatus.NEEDS_REVIEW,
                    source_box=[float(tb.x), float(tb.y), float(tb.width), float(tb.height)],
                    provenance={"source": "orphan_text_detection", "ocr_confidence": tb.confidence}
                )
                orphan_elements.append(orphan)
            else:
                remaining.append(tb)

        return orphan_elements, remaining
