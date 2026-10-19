"""
Test Chart Recognition Suite for ODR.
Validates Pie Chart and Bar Graph detection, data extraction,
canonical representation, and Mermaid/JSON export formats.
"""

import cv2
import numpy as np
import pytest
from backend.core.models import DiagramFamily
from backend.pipeline.region_detector import RegionDetector
from backend.pipeline.reconstruction import DiagramReconstructor
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.json_exporter import JSONExporter


def test_pie_chart_recognition_and_export():
    # 1. Synthesize a clean pie chart with labels and percentages
    img = np.ones((600, 600, 3), dtype=np.uint8) * 255
    cx, cy, r = 300, 300, 180

    # Draw pie circle
    cv2.circle(img, (cx, cy), r, (40, 40, 40), 3)

    # Draw 3 radial divider lines
    cv2.line(img, (cx, cy), (cx, cy - r), (40, 40, 40), 2)
    cv2.line(img, (cx, cy), (int(cx + r * 0.866), int(cy + r * 0.5)), (40, 40, 40), 2)
    cv2.line(img, (cx, cy), (int(cx - r * 0.866), int(cy + r * 0.5)), (40, 40, 40), 2)

    # Add text labels & percentages
    cv2.putText(img, "Browser Market", (190, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (15, 23, 42), 2)
    cv2.putText(img, "Chrome 50%", (340, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 23, 42), 2)
    cv2.putText(img, "Safari 30%", (260, 420), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 23, 42), 2)
    cv2.putText(img, "Edge 20%", (160, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 23, 42), 2)

    # 2. Region Detection & Type Inference
    regions = RegionDetector.detect_diagram_regions(img, "test_pie.png")
    assert len(regions) >= 1
    pie_region = regions[0]
    assert pie_region.suggested_type == DiagramFamily.CHART
    assert pie_region.suggested_subtype == "pie_chart"

    # 3. Semantic Reconstruction
    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, pie_region, project_id="proj_pie")
    assert diagram.family == DiagramFamily.CHART
    assert diagram.chart_data is not None
    assert diagram.chart_data.chart_type == "pie"
    assert len(diagram.chart_data.categories) >= 3
    assert len(diagram.chart_data.series[0].values) >= 3

    # 4. Mermaid Exporter Verification
    mmd_code, is_valid, msg = MermaidExporter.export(diagram)
    assert is_valid, f"Mermaid export failed: {msg}"
    assert "pie title" in mmd_code

    # 5. JSON Exporter Verification
    json_str, json_valid, _ = JSONExporter.export(diagram)
    assert json_valid
    assert '"chart_type": "pie"' in json_str


def test_bar_chart_recognition_and_export():
    sample_path = "samples/barchart_quarterly.png"
    img = cv2.imread(sample_path)
    assert img is not None

    regions = RegionDetector.detect_diagram_regions(img, "barchart_quarterly.png")
    assert len(regions) >= 1
    bar_region = regions[0]
    assert bar_region.suggested_type == DiagramFamily.CHART
    assert bar_region.suggested_subtype == "bar_chart"

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, bar_region, project_id="proj_bar")
    assert diagram.chart_data is not None
    assert diagram.chart_data.chart_type == "bar"

    mmd_code, is_valid, msg = MermaidExporter.export(diagram)
    assert is_valid
    assert "xychart-beta" in mmd_code
