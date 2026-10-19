"""
ODR End-to-End Sample Processing Tests.
Runs the complete local pipeline on generated sample images:
Image -> Preprocessing -> Region Detection -> OCR -> Shape/Connector Extraction -> Exporters.
"""

import os
import cv2
import pytest
from backend.pipeline.preprocessor import ImagePreprocessor
from backend.pipeline.region_detector import RegionDetector
from backend.pipeline.reconstruction import DiagramReconstructor
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter
from backend.exporters.json_exporter import JSONExporter
from backend.exporters.png_exporter import PNGExporter
from backend.exporters.bundle_exporter import BundleExporter


def test_e2e_flowchart_order():
    sample_path = "samples/flowchart_order.png"
    assert os.path.exists(sample_path), "Sample flowchart image must exist"
    
    img = cv2.imread(sample_path)
    assert img is not None

    # 1. Region detection
    regions = RegionDetector.detect_diagram_regions(img, "flowchart_order.png")
    assert len(regions) >= 1
    target_region = regions[0]

    # 2. Reconstruction
    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, target_region, project_id="test_proj")
    assert len(diagram.elements) >= 3
    assert len(diagram.connectors) >= 2

    # 3. Export validation
    mmd_code, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert "flowchart TD" in mmd_code

    puml_code, puml_valid, _ = PlantUMLExporter.export(diagram)
    assert puml_valid
    assert "@startuml" in puml_code

    json_str, json_valid, _ = JSONExporter.export(diagram)
    assert json_valid

    png_bytes, png_valid, _ = PNGExporter.export(diagram)
    assert png_valid
    assert len(png_bytes) > 1000

    zip_bytes, zip_valid, _ = BundleExporter.export_zip(diagram)
    assert zip_valid
    assert len(zip_bytes) > 2000


def test_e2e_multi_diagram_page():
    sample_path = "samples/multi_diagram_page.png"
    assert os.path.exists(sample_path), "Multi-diagram sample image must exist"

    img = cv2.imread(sample_path)
    assert img is not None

    regions = RegionDetector.detect_diagram_regions(img, "multi_diagram_page.png")
    # Must propose multiple distinct diagram candidates
    assert len(regions) >= 2


def test_e2e_barchart_quarterly():
    sample_path = "samples/barchart_quarterly.png"
    assert os.path.exists(sample_path), "Bar chart sample image must exist"

    img = cv2.imread(sample_path)
    assert img is not None

    regions = RegionDetector.detect_diagram_regions(img, "barchart_quarterly.png")
    assert len(regions) >= 1
