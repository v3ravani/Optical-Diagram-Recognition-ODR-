import cv2
import pytest
from backend.core.models import ElementType, DiagramRegion, DiagramFamily
from backend.pipeline.reconstruction import DiagramReconstructor
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter


def test_hand_drawn_lamp_diagram():
    img = cv2.imread("samples/hand_drawn_lamp.png")
    assert img is not None

    h, w = img.shape[:2]
    region = DiagramRegion(
        file_name="hand_drawn_lamp.png",
        page_number=1,
        x=0,
        y=0,
        width=w,
        height=h,
        confidence=1.0,
        suggested_type=DiagramFamily.FLOWCHART,
        suggested_subtype="standard_flowchart",
        label="Lamp Troubleshooting"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="lamp_proj")

    print(f"Recognized {len(diagram.elements)} elements:")
    for el in diagram.elements:
        print(f"  [{el.type.value}] {el.label}")

    print(f"Recognized {len(diagram.connectors)} connectors:")
    for c in diagram.connectors:
        print(f"  {c.source_id} -> {c.target_id} (label: '{c.label}')")

    # Verify key nodes are detected
    labels = [el.label.lower() for el in diagram.elements]
    assert any("lamp" in l for l in labels)
    assert any("plug" in l for l in labels)
    assert any("bulb" in l for l in labels)

    # Verify decision nodes are detected
    decision_nodes = [el for el in diagram.elements if el.type == ElementType.DECISION]
    assert len(decision_nodes) >= 1

    # Verify exports work
    mmd, valid_mmd, _ = MermaidExporter.export(diagram)
    assert valid_mmd
    assert "flowchart TD" in mmd
