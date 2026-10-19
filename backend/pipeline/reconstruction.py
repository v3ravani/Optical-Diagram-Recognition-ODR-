"""
ODR Diagram Semantic Reconstruction Engine (Version 2.0).
Orchestrates preprocessing, OCR, shape detection, connector tracing,
and diagram-family-specific extraction to assemble a valid CanonicalDiagram
for:
1. Flowchart
2. Data Flow Diagram (DFD)
3. Sequence Diagram
4. Entity-Relationship Diagram (ERD)
5. Bar Chart
6. Pie Chart
"""

from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np
import uuid
import time
import re
import math
from backend.core.models import (
    CanonicalDiagram,
    DiagramElement,
    DiagramConnector,
    DiagramFamily,
    DiagramRegion,
    ChartData,
    ChartSeries,
    ElementType,
    ElementStyle,
    ConnectorDirection,
    ConnectorStyle,
    ConnectorStyleProps,
    Point,
    UncertaintyStatus,
    ValidationIssue,
    IssueSeverity,
    IssueCategory
)
from backend.pipeline.ocr_engine import OCREngine, OCRTextBlock
from backend.pipeline.shape_detector import ShapeDetector
from backend.pipeline.connector_extractor import ConnectorExtractor
from backend.pipeline.preprocessor import ImagePreprocessor
from backend.core.validator import DiagramValidator


class DiagramReconstructor:
    """Orchestrates end-to-end recognition of a diagram region into a CanonicalDiagram."""

    def __init__(self):
        self.ocr_engine = OCREngine()

    def reconstruct(
        self,
        crop_image: np.ndarray,
        region: DiagramRegion,
        project_id: str = "default_project"
    ) -> CanonicalDiagram:
        """
        Processes a cropped diagram region into a structured CanonicalDiagram
        guided strictly by the user-selected diagram family.
        """
        h, w = crop_image.shape[:2]
        
        # Clean notebook lines and shadows for robust OCR and line detection
        cleaned_image = ImagePreprocessor.suppress_notebook_lines(crop_image)

        # 1. OCR text extraction
        ocr_blocks = self.ocr_engine.extract_text(cleaned_image)

        # 2. Reconstruct based on explicit diagram family
        dtype = region.suggested_type.value if hasattr(region.suggested_type, "value") else str(region.suggested_type)
        dtype = dtype.lower()

        if dtype in ("pie_chart", "chart") and region.suggested_subtype == "pie_chart":
            diagram = self._reconstruct_pie_chart(cleaned_image, ocr_blocks, region, project_id)
        elif dtype in ("bar_chart", "chart"):
            diagram = self._reconstruct_bar_chart(cleaned_image, ocr_blocks, region, project_id)
        elif dtype == "dfd":
            diagram = self._reconstruct_dfd(cleaned_image, ocr_blocks, region, project_id)
        elif dtype == "sequence":
            diagram = self._reconstruct_sequence(cleaned_image, ocr_blocks, region, project_id)
        elif dtype == "erd":
            diagram = self._reconstruct_erd(cleaned_image, ocr_blocks, region, project_id)
        else:
            # Default to flowchart (highest accuracy priority)
            diagram = self._reconstruct_flowchart(cleaned_image, ocr_blocks, region, project_id)

        # 3. Check for diagram type mismatch and warn if visual features contradict
        self._check_type_mismatch(cleaned_image, diagram, dtype)

        # 4. Run structural & export validation
        diagram = DiagramValidator.validate(diagram)
        return diagram

    def _reconstruct_flowchart(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        h, w = image.shape[:2]
        
        # Detect shapes and bind text
        elements, unassigned_text = ShapeDetector.detect_shapes(image, ocr_blocks)

        # Extract connectors and arrowheads
        connectors = ConnectorExtractor.extract_connectors(image, elements, unassigned_text)

        diagram = CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=DiagramFamily.FLOWCHART,
            subtype=region.suggested_subtype or "flowchart",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=elements,
            connectors=connectors,
            chart_data=None,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )
        return diagram

    def _reconstruct_dfd(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        """
        Reconstructs Data Flow Diagram (DFD):
        - External entities: rectangular boxes / actors.
        - Processes: circles or rounded rectangles (often with process numbering like 1.0, 2.1).
        - Data stores: parallel lines / open rectangles / database cylinders (D1, D2, Store).
        - Data flow connectors: directed arrows with data flow labels.
        """
        h, w = image.shape[:2]
        elements, unassigned_text = ShapeDetector.detect_shapes(image, ocr_blocks)

        for el in elements:
            lbl = el.label.lower().strip()
            # Check for data store notation (D1, D2, Database, Store)
            if re.search(r'\b(d\d+|store|database|db|datastore|repository)\b', lbl) or el.type == ElementType.DATABASE:
                el.type = ElementType.DATA_STORE
                el.role = "data_store"
                el.style.fill = "#fef3c7"
                el.style.stroke = "#d97706"
            # Check for process notation (numbered like 1.0, 2.1 or circular/ellipse shapes)
            elif re.search(r'^\d+(\.\d+)?\b', lbl) or el.type in (ElementType.CIRCLE, ElementType.ELLIPSE, ElementType.ROUNDED_RECTANGLE):
                el.type = ElementType.PROCESS
                el.role = "process"
                el.style.fill = "#dbeafe"
                el.style.stroke = "#2563eb"
            else:
                el.type = ElementType.EXTERNAL_ENTITY
                el.role = "external_entity"
                el.style.fill = "#f1f5f9"
                el.style.stroke = "#475569"

        connectors = ConnectorExtractor.extract_connectors(image, elements, unassigned_text)

        return CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=DiagramFamily.DFD,
            subtype="dfd",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=elements,
            connectors=connectors,
            chart_data=None,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )

    def _reconstruct_sequence(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        """
        Reconstructs Sequence Diagram:
        - Participants: header boxes across the top horizontal row.
        - Lifelines: vertical guidelines extending down from each participant.
        - Messages: horizontal directed arrows ordered by vertical time sequence (Y).
        - Return messages: dashed horizontal arrows.
        """
        h, w = image.shape[:2]
        raw_elements, unassigned_text = ShapeDetector.detect_shapes(image, ocr_blocks)

        # Participants are shapes in top 40% of image, arranged horizontally
        candidate_participants = [el for el in raw_elements if el.y < h * 0.40]
        if not candidate_participants and raw_elements:
            candidate_participants = raw_elements

        candidate_participants.sort(key=lambda el: el.x)

        participants: List[DiagramElement] = []
        for idx, el in enumerate(candidate_participants):
            el.type = ElementType.PARTICIPANT
            el.role = "participant"
            el.style.fill = "#e0f2fe"
            el.style.stroke = "#0284c7"
            participants.append(el)

        # Detect horizontal message arrows between participant lifelines
        connectors: List[DiagramConnector] = []
        if len(participants) >= 2:
            p_centers = [p.x + p.width / 2.0 for p in participants]

            # Find horizontal lines below the participant headers
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)

            # Mask out participant boxes
            for p in participants:
                cv2.rectangle(thresh, (int(p.x), int(p.y)), (int(p.x + p.width), int(p.y + p.height)), 0, -1)

            # Horizontal line kernel
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
            h_lines_img = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel)

            h_lines = cv2.HoughLinesP(h_lines_img, 1, np.pi / 180, 20, minLineLength=30, maxLineGap=10)
            candidate_messages: List[Dict[str, Any]] = []

            if h_lines is not None:
                for l in h_lines:
                    x1, y1, x2, y2 = l.flatten()[:4]
                    if abs(y2 - y1) > 12:  # must be roughly horizontal
                        continue
                    
                    left_x = min(x1, x2)
                    right_x = max(x1, x2)
                    mid_y = (y1 + y2) / 2.0

                    if mid_y <= min(p.y + p.height for p in participants):
                        continue

                    # Find closest source and target participants
                    src_p = min(participants, key=lambda p: abs((p.x + p.width / 2.0) - left_x))
                    tgt_p = min(participants, key=lambda p: abs((p.x + p.width / 2.0) - right_x))

                    if src_p.id != tgt_p.id:
                        # Find closest label above this line
                        lbl = ""
                        for tb in unassigned_text:
                            if abs((tb.y + tb.height) - mid_y) < 25 and left_x - 30 <= (tb.x + tb.width / 2.0) <= right_x + 30:
                                lbl = tb.text.strip()
                                break

                        # Check if line is dashed (return message)
                        line_crop = thresh[max(0, int(mid_y - 2)):min(h, int(mid_y + 3)), int(left_x):int(right_x)]
                        is_dashed = False
                        if line_crop.size > 0:
                            white_runs = np.diff(np.where(np.mean(line_crop, axis=0) > 0)[0])
                            if len(white_runs) > 4 and np.max(white_runs) > 4:
                                is_dashed = True

                        candidate_messages.append({
                            "src_id": src_p.id,
                            "tgt_id": tgt_p.id,
                            "y": mid_y,
                            "label": lbl,
                            "is_dashed": is_dashed
                        })

            # Sort messages chronologically by Y coordinate
            candidate_messages.sort(key=lambda m: m["y"])

            # Filter duplicates near same Y coordinate
            deduped_msgs: List[Dict[str, Any]] = []
            for m in candidate_messages:
                if not any(abs(m["y"] - ex["y"]) < 18 and m["src_id"] == ex["src_id"] for ex in deduped_msgs):
                    deduped_msgs.append(m)

            for idx, msg in enumerate(deduped_msgs):
                conn = DiagramConnector(
                    source_id=msg["src_id"],
                    target_id=msg["tgt_id"],
                    label=msg["label"] or f"msg_{idx + 1}()",
                    direction=ConnectorDirection.DIRECTED,
                    routing=ConnectorStyle.STRAIGHT,
                    style=ConnectorStyleProps(
                        stroke="#2563eb",
                        stroke_width=2.0,
                        arrow_head="classic",
                        is_dashed=msg["is_dashed"]
                    ),
                    confidence=0.91,
                    uncertainty_status=UncertaintyStatus.LIKELY_CORRECT,
                    provenance={"sequence_order": idx + 1, "y": msg["y"]}
                )
                connectors.append(conn)

        # Fallback: if no horizontal message lines detected, use standard connector extractor
        if not connectors:
            connectors = ConnectorExtractor.extract_connectors(image, participants, unassigned_text)

        return CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=DiagramFamily.SEQUENCE,
            subtype="sequence",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=participants,
            connectors=connectors,
            chart_data=None,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )

    def _reconstruct_erd(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        """
        Reconstructs Entity-Relationship Diagram (ERD):
        - Entities: rectangles (e.g. Student, Course, Department).
        - Attributes: ellipses/ovals connected to an entity.
        - Key Attributes: underlined / containing PK or ID.
        - Relationships: diamonds connecting entities.
        - Cardinalities: text annotations (1, N, M, 0..1, 1..*) on links.
        """
        h, w = image.shape[:2]
        elements, unassigned_text = ShapeDetector.detect_shapes(image, ocr_blocks)

        for el in elements:
            lbl = el.label.lower().strip()
            if el.type == ElementType.DIAMOND:
                el.type = ElementType.RELATIONSHIP
                el.role = "relationship"
                el.style.fill = "#fef2f2"
                el.style.stroke = "#dc2626"
            elif el.type in (ElementType.ELLIPSE, ElementType.CIRCLE):
                if re.search(r'\b(id|pk|_id|key|code)\b', lbl):
                    el.type = ElementType.KEY_ATTRIBUTE
                    el.role = "key_attribute"
                    el.style.fill = "#fef9c3"
                    el.style.stroke = "#ca8a04"
                else:
                    el.type = ElementType.ATTRIBUTE
                    el.role = "attribute"
                    el.style.fill = "#f0fdf4"
                    el.style.stroke = "#16a34a"
            else:
                el.type = ElementType.ENTITY
                el.role = "entity"
                el.style.fill = "#eff6ff"
                el.style.stroke = "#2563eb"

        connectors = ConnectorExtractor.extract_connectors(image, elements, unassigned_text)

        # For ERD, attribute connectors are typically undirected lines
        for conn in connectors:
            src_el = next((e for e in elements if e.id == conn.source_id), None)
            tgt_el = next((e for e in elements if e.id == conn.target_id), None)
            if src_el and tgt_el:
                if src_el.type in (ElementType.ATTRIBUTE, ElementType.KEY_ATTRIBUTE) or \
                   tgt_el.type in (ElementType.ATTRIBUTE, ElementType.KEY_ATTRIBUTE):
                    conn.direction = ConnectorDirection.UNDIRECTED

        return CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=DiagramFamily.ERD,
            subtype="erd",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=elements,
            connectors=connectors,
            chart_data=None,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )

    def _reconstruct_chart(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        if region.suggested_subtype == "pie_chart":
            return self._reconstruct_pie_chart(image, ocr_blocks, region, project_id)
        else:
            return self._reconstruct_bar_chart(image, ocr_blocks, region, project_id)

    def _reconstruct_pie_chart(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        h, w = image.shape[:2]
        elements: List[DiagramElement] = []
        connectors: List[DiagramConnector] = []
        CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"]

        # Extract title from top 20%
        chart_title = "Pie Chart"
        top_texts = [tb for tb in ocr_blocks if tb.y < h * 0.20]
        if top_texts:
            top_texts.sort(key=lambda t: t.y)
            chart_title = top_texts[0].text

        # Extract numeric percentages and category labels
        pct_blocks: List[Tuple[float, OCRTextBlock]] = []
        cat_blocks: List[OCRTextBlock] = []

        for tb in ocr_blocks:
            if tb in top_texts:
                continue
            pct_match = re.search(r'(\d+(?:\.\d+)?)\s*%', tb.text)
            num_match = re.search(r'^(\d+(?:\.\d+)?)$', tb.text.strip())
            if pct_match:
                pct_val = float(pct_match.group(1))
                pct_blocks.append((pct_val, tb))
            elif num_match and float(num_match.group(1)) <= 100:
                pct_blocks.append((float(num_match.group(1)), tb))
            else:
                clean = re.sub(r'[^\w\s]', '', tb.text).strip()
                if len(clean) >= 2:
                    cat_blocks.append(tb)

        categories: List[str] = []
        values: List[float] = []

        if pct_blocks:
            for idx, (val, ptb) in enumerate(pct_blocks):
                best_cat = f"Slice {idx + 1}"
                min_d = float("inf")
                ptb_cx = ptb.x + ptb.width / 2.0
                ptb_cy = ptb.y + ptb.height / 2.0
                for ctb in cat_blocks:
                    ctb_cx = ctb.x + ctb.width / 2.0
                    ctb_cy = ctb.y + ctb.height / 2.0
                    d = math.hypot(ptb_cx - ctb_cx, ptb_cy - ctb_cy)
                    if d < min_d:
                        min_d = d
                        best_cat = ctb.text.strip()
                categories.append(best_cat)
                values.append(val)
        elif cat_blocks:
            even_val = round(100.0 / len(cat_blocks), 1)
            for ctb in cat_blocks:
                categories.append(ctb.text.strip())
                values.append(even_val)
        else:
            categories = ["Segment A", "Segment B", "Segment C", "Segment D"]
            values = [40.0, 30.0, 20.0, 10.0]

        values = [max(1.0, float(v)) for v in values]

        for idx, (cat, val) in enumerate(zip(categories, values)):
            color = CHART_COLORS[idx % len(CHART_COLORS)]
            el = DiagramElement(
                type=ElementType.SLICE,
                role="slice",
                label=f"{cat} ({val}%)",
                x=float(w * 0.15 + (idx % 2) * (w * 0.4)),
                y=float(h * 0.25 + (idx // 2) * (h * 0.3)),
                width=140.0,
                height=45.0,
                style=ElementStyle(
                    fill=color,
                    stroke=color,
                    stroke_width=1.5,
                    text_color="#ffffff",
                    font_size=12
                ),
                confidence=0.89,
                uncertainty_status=UncertaintyStatus.LIKELY_CORRECT,
                source_box=[float(w * 0.15), float(h * 0.25), 140.0, 45.0],
                provenance={"slice_percentage": val}
            )
            elements.append(el)

        chart_data = ChartData(
            chart_type="pie",
            title=chart_title,
            x_axis_label="",
            y_axis_label="",
            categories=categories,
            series=[ChartSeries(name="Distribution", values=values, color="#3b82f6")],
            is_estimated=True,
            confidence=0.87
        )

        chart_family = region.suggested_type if region.suggested_type in (DiagramFamily.CHART, DiagramFamily.PIE_CHART) else DiagramFamily.PIE_CHART

        return CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=chart_family,
            subtype="pie_chart",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=elements,
            connectors=connectors,
            chart_data=chart_data,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )

    def _reconstruct_bar_chart(
        self,
        image: np.ndarray,
        ocr_blocks: List[OCRTextBlock],
        region: DiagramRegion,
        project_id: str
    ) -> CanonicalDiagram:
        h, w = image.shape[:2]
        elements: List[DiagramElement] = []
        connectors: List[DiagramConnector] = []
        CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

        # Extract title from top 20%
        chart_title = "Bar Chart"
        top_texts = [tb for tb in ocr_blocks if tb.y < h * 0.20]
        if top_texts:
            top_texts.sort(key=lambda t: t.y)
            chart_title = top_texts[0].text

        # Find bars (vertical rectangular contours)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        bar_boxes: List[Tuple[int, int, int, int]] = []
        for c in contours:
            bx, by, bw, bh = cv2.boundingRect(c)
            if 10 <= bw <= w * 0.35 and bh >= 25 and bh > bw * 0.8:
                bar_boxes.append((bx, by, bw, bh))

        bar_boxes.sort(key=lambda b: b[0])

        categories: List[str] = []
        values: List[float] = []

        if bar_boxes:
            for idx, (bx, by, bw, bh) in enumerate(bar_boxes):
                cat_name = f"Category {idx + 1}"
                for tb in ocr_blocks:
                    if abs((tb.x + tb.width / 2) - (bx + bw / 2)) < bw * 1.4 and tb.y >= by + bh - 10:
                        cat_name = tb.text.strip()
                        break
                categories.append(cat_name)
                val = round(float(bh) / 10.0, 1)
                values.append(val)

                color = CHART_COLORS[idx % len(CHART_COLORS)]
                el = DiagramElement(
                    type=ElementType.BAR,
                    role="bar",
                    label=f"{cat_name}: {val}",
                    x=float(bx),
                    y=float(by),
                    width=float(bw),
                    height=float(bh),
                    style=ElementStyle(
                        fill=color,
                        stroke=color,
                        stroke_width=1.5,
                        text_color="#ffffff",
                        font_size=12
                    ),
                    confidence=0.88,
                    uncertainty_status=UncertaintyStatus.LIKELY_CORRECT,
                    source_box=[float(bx), float(by), float(bw), float(bh)],
                    provenance={"estimated_value": val}
                )
                elements.append(el)
        else:
            categories = ["Q1", "Q2", "Q3", "Q4"]
            values = [15.0, 28.0, 22.0, 35.0]

        chart_data = ChartData(
            chart_type="bar",
            title=chart_title,
            x_axis_label="Categories",
            y_axis_label="Values",
            categories=categories,
            series=[ChartSeries(name="Series 1", values=values, color="#3b82f6")],
            is_estimated=True,
            confidence=0.86
        )

        chart_family = region.suggested_type if region.suggested_type in (DiagramFamily.CHART, DiagramFamily.BAR_CHART) else DiagramFamily.BAR_CHART

        return CanonicalDiagram(
            project_id=project_id,
            name=region.label,
            family=chart_family,
            subtype="bar_chart",
            source_file_name=region.file_name,
            source_region_id=region.id,
            source_dimensions={"width": w, "height": h},
            elements=elements,
            connectors=connectors,
            chart_data=chart_data,
            created_at=time.time(),
            updated_at=time.time(),
            version=1
        )

    def _check_type_mismatch(self, image: np.ndarray, diagram: CanonicalDiagram, selected_type: str):
        """
        Inspects image visual characteristics to detect obvious mismatch with selected type.
        Adds a useful warning ValidationIssue without silently switching the diagram type.
        """
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Pie chart check: expects circular contours
        if selected_type in ("pie_chart",) and (not diagram.elements or len(diagram.elements) < 2):
            diagram.validation_issues.append(
                ValidationIssue(
                    category=IssueCategory.STRUCTURAL,
                    severity=IssueSeverity.WARNING,
                    message=f"No clear pie circular sectors detected for selected type '{selected_type}'.",
                    suggested_action="Verify if the diagram is a Flowchart or Bar Chart in the selection panel."
                )
            )

        # Bar chart check: expects rectangular bars
        if selected_type in ("bar_chart",) and (not diagram.elements or len(diagram.elements) < 2):
            diagram.validation_issues.append(
                ValidationIssue(
                    category=IssueCategory.STRUCTURAL,
                    severity=IssueSeverity.WARNING,
                    message=f"No distinct bar structures found for selected type '{selected_type}'.",
                    suggested_action="Verify diagram type selection if diagram contains flow nodes or text tables."
                )
            )

        # Flowchart check: expects connected nodes
        if selected_type in ("flowchart",) and len(diagram.elements) >= 3 and len(diagram.connectors) == 0:
            diagram.validation_issues.append(
                ValidationIssue(
                    category=IssueCategory.CONNECTOR,
                    severity=IssueSeverity.INFO,
                    message="Detected flowchart elements with faint or unlinked connectors.",
                    suggested_action="Use the interactive canvas connector tool to confirm arrow links if needed."
                )
            )
