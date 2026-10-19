"""
ODR Unit and Integration Tests.
Tests Canonical Models, Preprocessor, Region Detector, Shape Detector,
Connector Extractor, Exporters, and Project Manager.
"""

import os
import json
import zipfile
import io
import pytest
import numpy as np
import cv2

from backend.core.models import (
    CanonicalDiagram,
    DiagramElement,
    DiagramConnector,
    ElementType,
    DiagramFamily,
    ConnectorDirection,
    ValidationIssue,
    IssueSeverity
)
from backend.core.validator import DiagramValidator
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter
from backend.exporters.json_exporter import JSONExporter
from backend.exporters.png_exporter import PNGExporter
from backend.exporters.bundle_exporter import BundleExporter
from backend.storage.project_manager import ProjectManager
from backend.pipeline.preprocessor import ImagePreprocessor
from backend.pipeline.region_detector import RegionDetector
from backend.pipeline.shape_detector import ShapeDetector
from backend.pipeline.ocr_engine import OCRTextBlock


@pytest.fixture
def sample_flowchart():
    return CanonicalDiagram(
        id="test_diag_1",
        name="Test Flowchart",
        family=DiagramFamily.FLOWCHART,
        elements=[
            DiagramElement(
                id="node_1",
                type=ElementType.TERMINAL,
                role="start",
                label="Start Process",
                x=100.0,
                y=50.0,
                width=140.0,
                height=60.0
            ),
            DiagramElement(
                id="node_2",
                type=ElementType.PROCESS,
                role="process",
                label="Execute Step",
                x=100.0,
                y=180.0,
                width=140.0,
                height=60.0
            ),
            DiagramElement(
                id="node_3",
                type=ElementType.DECISION,
                role="decision",
                label="Success?",
                x=100.0,
                y=310.0,
                width=140.0,
                height=80.0
            ),
            DiagramElement(
                id="node_4",
                type=ElementType.TERMINAL,
                role="end",
                label="Finish",
                x=100.0,
                y=460.0,
                width=140.0,
                height=60.0
            )
        ],
        connectors=[
            DiagramConnector(
                id="conn_1",
                source_id="node_1",
                target_id="node_2",
                direction=ConnectorDirection.DIRECTED
            ),
            DiagramConnector(
                id="conn_2",
                source_id="node_2",
                target_id="node_3",
                direction=ConnectorDirection.DIRECTED
            ),
            DiagramConnector(
                id="conn_3",
                source_id="node_3",
                target_id="node_4",
                direction=ConnectorDirection.DIRECTED,
                label="Yes"
            )
        ]
    )


def test_validator_detects_issues(sample_flowchart):
    # Add a dangling connector
    sample_flowchart.connectors.append(
        DiagramConnector(id="dangling_1", source_id="node_nonexistent", target_id="node_2")
    )
    validated = DiagramValidator.validate(sample_flowchart)
    
    # Must flag the dangling connector
    dangling_issues = [iss for iss in validated.validation_issues if iss.connector_id == "dangling_1"]
    assert len(dangling_issues) > 0
    assert dangling_issues[0].severity == IssueSeverity.WARNING


def test_mermaid_exporter(sample_flowchart):
    code, is_valid, msg = MermaidExporter.export(sample_flowchart)
    assert is_valid
    assert "flowchart TD" in code
    assert 'node_1(["Start Process"])' in code
    assert 'node_2["Execute Step"]' in code
    assert 'node_3{"Success?"}' in code
    assert "node_1 --> node_2" in code
    assert "node_3 -->|Yes| node_4" in code


def test_plantuml_exporter(sample_flowchart):
    code, is_valid, msg = PlantUMLExporter.export(sample_flowchart)
    assert is_valid
    assert "@startuml" in code
    assert "@enduml" in code
    assert 'circle "Start Process" as node_1' in code
    assert 'rectangle "Execute Step" as node_2' in code
    assert 'node_1 --> node_2' in code


def test_json_exporter(sample_flowchart):
    code, is_valid, msg = JSONExporter.export(sample_flowchart)
    assert is_valid
    parsed = json.loads(code)
    assert parsed["id"] == "test_diag_1"
    assert len(parsed["elements"]) == 4
    assert len(parsed["connectors"]) == 3


def test_png_exporter(sample_flowchart):
    png_bytes, is_valid, msg = PNGExporter.export(sample_flowchart, scale=1.5)
    assert is_valid
    assert len(png_bytes) > 500
    # Verify PNG header
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"


def test_bundle_exporter(sample_flowchart):
    zip_bytes, is_valid, msg = BundleExporter.export_zip(sample_flowchart)
    assert is_valid
    assert len(zip_bytes) > 1000
    
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        namelist = zf.namelist()
        assert any("diagram.json" in name for name in namelist)
        assert any("diagram.mmd" in name for name in namelist)
        assert any("diagram.puml" in name for name in namelist)
        assert any("diagram.png" in name for name in namelist)
        assert any("manifest.json" in name for name in namelist)


def test_project_manager(tmp_path, sample_flowchart):
    pm = ProjectManager(base_dir=str(tmp_path / "projects"))
    project = pm.create_project(name="Test Suite Project")
    assert project.metadata.id.startswith("proj_")
    
    # Add diagram
    pm.add_diagram(project.metadata.id, sample_flowchart)
    loaded = pm.get_project(project.metadata.id)
    assert loaded is not None
    assert sample_flowchart.id in loaded.diagrams

    # Create checkpoint
    snapshot = pm.create_snapshot(project.metadata.id, sample_flowchart.id, "Milestone 1", "Checkpoint test")
    assert snapshot is not None
    assert snapshot.label == "Milestone 1"

    # Compare
    diff = pm.compare_diagrams(sample_flowchart, sample_flowchart)
    assert diff["added_nodes_count"] == 0
    assert diff["removed_nodes_count"] == 0


def test_image_preprocessing_and_region_detection():
    # Create synthetic test image with two distinct rectangles
    img = np.ones((600, 800, 3), dtype=np.uint8) * 255
    # Draw diagram 1 (rectangle with inner box)
    cv2.rectangle(img, (50, 50), (350, 400), (0, 0, 0), 2)
    cv2.rectangle(img, (100, 100), (300, 200), (0, 0, 0), 2)
    cv2.putText(img, "Step A", (120, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)

    # Draw diagram 2
    cv2.rectangle(img, (450, 50), (750, 400), (0, 0, 0), 2)
    cv2.circle(img, (600, 200), 60, (0, 0, 0), 2)
    cv2.putText(img, "Step B", (560, 205), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)

    regions = RegionDetector.detect_diagram_regions(img, "test_page.png")
    assert len(regions) >= 1
    for r in regions:
        assert r.width > 50
        assert r.height > 50
