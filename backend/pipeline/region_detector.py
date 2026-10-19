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

        contours, hierarchy = cv2.findContours(dilated, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

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

        # Filter out full-window enclosing frames if distinct inner diagram regions exist
        inner_candidates = [
            (bx, by, bw, bh) for (bx, by, bw, bh) in merged_candidates
            if not (bw > 0.88 * img_w and bh > 0.88 * img_h)
        ]
        if inner_candidates:
            merged_candidates = inner_candidates

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
        Accurately detects printed and hand-drawn diagrams using contour geometry,
        circularity, baseline alignment, and coordinate axes.
        """
        import math
        from backend.pipeline.preprocessor import ImagePreprocessor
        
        # Suppress notebook lines first to prevent ruled lines from confusing detectors
        cleaned = ImagePreprocessor.suppress_notebook_lines(crop)
        gray = cv2.cvtColor(cleaned, cv2.COLOR_BGR2GRAY)
        h, w = crop.shape[:2]
        min_dim = min(h, w)

        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 1. Check for Pie Charts (Must have roughly square crop aspect ratio: 0.80 - 1.25)
        crop_aspect = float(w) / max(1, h)
        if 0.80 <= crop_aspect <= 1.25:
            for cnt in contours:
                c_area = cv2.contourArea(cnt)
                if c_area < (w * h) * 0.25:
                    continue
                bx, by, bw, bh = cv2.boundingRect(cnt)
                aspect = float(bw) / max(1, bh)
                if 0.85 <= aspect <= 1.18 and bw >= min_dim * 0.45:
                    peri = cv2.arcLength(cnt, True)
                    circularity = 4 * math.pi * (c_area / ((peri * peri) + 1e-5))
                    hull = cv2.convexHull(cnt)
                    solidity = c_area / (cv2.contourArea(hull) + 1e-5)
                    # Pie chart is a large dominant circular disc with high solidity
                    if circularity > 0.68 and solidity > 0.88:
                        return DiagramFamily.CHART, "pie_chart"

            edges = cv2.Canny(gray, 50, 150)
            circles = cv2.HoughCircles(
                gray,
                cv2.HOUGH_GRADIENT,
                dp=1.2,
                minDist=min_dim // 2,
                param1=100,
                param2=35,
                minRadius=int(min_dim * 0.28),
                maxRadius=int(min_dim * 0.52)
            )
            if circles is not None:
                lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 25, minLineLength=int(min_dim * 0.22), maxLineGap=10)
                for c in circles[0]:
                    cx, cy, r = int(c[0]), int(c[1]), int(c[2])
                    # Circle must be in the central region of the diagram crop
                    if 0.30 * w < cx < 0.70 * w and 0.30 * h < cy < 0.70 * h:
                        mask = np.zeros(gray.shape, dtype=np.uint8)
                        cv2.circle(mask, (cx, cy), r, 255, 10)
                        support = np.sum((edges > 0) & (mask > 0)) / (2 * math.pi * r)
                        # Verify radial slice lines radiating from (cx, cy)
                        spokes = 0
                        if lines is not None:
                            for l in lines:
                                x1, y1, x2, y2 = l[0] if len(l.shape) > 1 else l
                                if min(math.hypot(x1 - cx, y1 - cy), math.hypot(x2 - cx, y2 - cy)) < 25:
                                    spokes += 1
                        if support >= 0.85 and spokes >= 2:
                            return DiagramFamily.CHART, "pie_chart"


        # 2. Check for Bar Charts via Aligned Vertical Bars sharing a baseline
        edges = cv2.Canny(gray, 50, 150)
        tree_contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        candidate_bars: List[Tuple[int, int, int, int]] = []
        for c in tree_contours:
            bx, by, bw, bh = cv2.boundingRect(c)
            if bh >= 25 and 10 <= bw <= w * 0.35 and bh > bw * 1.1:
                candidate_bars.append((bx, by, bw, bh))

        # Deduplicate overlapping contours
        unique_bars: List[Tuple[int, int, int, int]] = []
        for b in candidate_bars:
            if not any(abs(b[0] - u[0]) < 12 and abs(b[1] - u[1]) < 12 for u in unique_bars):
                unique_bars.append(b)

        aligned_count = 0
        if unique_bars:
            bottoms = [by + bh for _, by, _, bh in unique_bars]
            for b1 in bottoms:
                matches = sum(1 for b2 in bottoms if abs(b1 - b2) < max(12, int(h * 0.04)))
                aligned_count = max(aligned_count, matches)

        if aligned_count >= 3:
            return DiagramFamily.CHART, "bar_chart"

        # 3. Check for Coordinate Axes (L-shape in lower-left quadrant)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=85, minLineLength=int(min_dim * 0.30), maxLineGap=10)
        h_axes: List[Tuple[int, int, int, int]] = []
        v_axes: List[Tuple[int, int, int, int]] = []

        if lines is not None:
            for line in lines:
                l = line[0] if len(line.shape) > 1 else line
                x1, y1, x2, y2 = int(l[0]), int(l[1]), int(l[2]), int(l[3])
                dx = abs(x2 - x1)
                dy = abs(y2 - y1)
                mid_y = (y1 + y2) / 2.0
                mid_x = (x1 + x2) / 2.0

                if dy < 8 and dx > w * 0.30 and mid_y > h * 0.55:
                    h_axes.append((x1, y1, x2, y2))
                elif dx < 8 and dy > h * 0.30 and mid_x < w * 0.45:
                    v_axes.append((x1, y1, x2, y2))

        if h_axes and v_axes:
            # Must also have at least 2 aligned vertical bars to distinguish from flowchart return loop
            if aligned_count >= 2:
                for hx1, hy1, hx2, hy2 in h_axes:
                    h_left_x = min(hx1, hx2)
                    h_y = (hy1 + hy2) / 2.0
                    for vx1, vy1, vx2, vy2 in v_axes:
                        v_bot_y = max(vy1, vy2)
                        v_x = (vx1 + vx2) / 2.0
                        if abs(h_left_x - v_x) < w * 0.20 and abs(h_y - v_bot_y) < h * 0.20:
                            return DiagramFamily.CHART, "bar_chart"

        # Default standard is Flowchart
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
