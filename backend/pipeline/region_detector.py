"""
ODR Diagram Region Detector.
Segments pages into multiple candidate diagram regions using morphological clustering,
contour hierarchy analysis, and density heuristics.
"""

from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from backend.core.models import DiagramRegion, DiagramFamily


class RegionDetector:
    """Detects multiple diagram regions on a page and proposes candidates."""

    @classmethod
    def detect_diagram_regions(
        cls,
        image: np.ndarray,
        file_name: str,
        page_number: int = 1
    ) -> List[DiagramRegion]:
        """
        Detects individual candidate diagrams in an image or page.
        Returns a list of DiagramRegion models.
        """
        img_h, img_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Adaptive threshold to isolate lines, shapes, and diagram elements
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
        )

        # Morphological dilation to group tightly connected components of a diagram together
        # while keeping distinct diagrams apart
        kernel_size = max(15, int(min(img_w, img_h) * 0.02))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates: List[Tuple[int, int, int, int]] = []
        min_area = (img_w * img_h) * 0.03  # At least 3% of the page area
        min_dim = min(img_w, img_h) * 0.12

        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            area = w * h
            if area >= min_area and w >= min_dim and h >= min_dim:
                # Add padding around the bounding box (safely clamped)
                pad_x = int(w * 0.04)
                pad_y = int(h * 0.04)
                bx = max(0, x - pad_x)
                by = max(0, y - pad_y)
                bw = min(img_w - bx, w + 2 * pad_x)
                bh = min(img_h - by, h + 2 * pad_y)
                candidates.append((bx, by, bw, bh))

        # If overlapping or nested candidates exist, merge or sort them
        merged_candidates = cls._non_max_suppression(candidates, iou_thresh=0.3)

        # Classify and build DiagramRegion objects
        regions: List[DiagramRegion] = []
        
        # If no candidates met the threshold, fallback to full image region
        if not merged_candidates:
            merged_candidates = [(int(img_w * 0.02), int(img_h * 0.02), int(img_w * 0.96), int(img_h * 0.96))]

        for idx, (bx, by, bw, bh) in enumerate(merged_candidates):
            crop = image[by:by+bh, bx:bx+bw]
            suggested_type, suggested_subtype = cls._infer_diagram_type(crop)
            
            region = DiagramRegion(
                file_name=file_name,
                page_number=page_number,
                x=bx,
                y=by,
                width=bw,
                height=bh,
                confidence=0.92 if len(merged_candidates) > 1 else 0.98,
                suggested_type=suggested_type,
                suggested_subtype=suggested_subtype,
                label=f"Diagram {idx + 1} ({suggested_subtype.replace('_', ' ').title()})",
                selected=True,
                is_manual_crop=False
            )
            regions.append(region)

        return regions

    @classmethod
    def _infer_diagram_type(cls, crop: np.ndarray) -> Tuple[DiagramFamily, str]:
        """
        Infers whether a region looks like a Flowchart vs Bar Chart vs Pie Chart.
        """
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Check for circular shapes (pie chart indicator - requires strict param2=80)
        min_dim = min(crop.shape[:2])
        circles = cv2.HoughCircles(
            gray,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=min_dim // 2,
            param1=120,
            param2=80,
            minRadius=int(min_dim * 0.25),
            maxRadius=int(min_dim * 0.48)
        )
        if circles is not None and len(circles[0]) >= 1:
            return DiagramFamily.CHART, "pie_chart"

        # Check for coordinate axes (horizontal and vertical prominent lines meeting at an origin)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80, minLineLength=int(min(crop.shape[:2]) * 0.3), maxLineGap=10)
        has_horizontal_axis = False
        has_vertical_axis = False
        if lines is not None:
            for line in lines:
                l = line[0] if len(line.shape) > 1 else line
                x1, y1, x2, y2 = int(l[0]), int(l[1]), int(l[2]), int(l[3])
                dx = abs(x2 - x1)
                dy = abs(y2 - y1)
                if dy < 5 and dx > crop.shape[1] * 0.4:
                    has_horizontal_axis = True
                if dx < 5 and dy > crop.shape[0] * 0.4:
                    has_vertical_axis = True

        if has_horizontal_axis and has_vertical_axis:
            return DiagramFamily.CHART, "bar_chart"

        # Default standard is flowchart
        return DiagramFamily.FLOWCHART, "standard_flowchart"

    @classmethod
    def _non_max_suppression(cls, boxes: List[Tuple[int, int, int, int]], iou_thresh: float = 0.3) -> List[Tuple[int, int, int, int]]:
        if not boxes:
            return []
        
        # Convert to [x1, y1, x2, y2]
        converted = np.array([[x, y, x + w, y + h] for x, y, w, h in boxes])
        x1 = converted[:, 0]
        y1 = converted[:, 1]
        x2 = converted[:, 2]
        y2 = converted[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = areas.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter)

            inds = np.where(ovr <= iou_thresh)[0]
            order = order[inds + 1]

        res = [boxes[k] for k in keep]
        # Sort top-to-bottom, left-to-right
        res.sort(key=lambda b: (b[1], b[0]))
        return res
