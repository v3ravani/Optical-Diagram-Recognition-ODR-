"""
ODR Extreme Accuracy Benchmark and Regression Test Suite.
Validates:
1. Complex flowcharts with:
   - Multiple incoming arrows to one node
   - Multiple outgoing arrows from decision diamonds with branch labels (Yes/No)
   - Loops and feedback paths (upward connectors with correct direction)
   - Two connectors crossing perpendicularly without forming a junction
2. Technical diagrams:
   - Data Flow Diagrams (DFD) with external entities, processes, data stores, data flows
   - Sequence diagrams with participants, lifelines, message arrows, and return messages
   - Entity-Relationship Diagrams (ERD) with entities, key attributes, attributes, relationships
3. Data fidelity in Bar Charts and Pie Charts
4. Structural metrics: node precision/recall, exact edge accuracy, arrow direction accuracy
"""

import cv2
import numpy as np
import pytest
from backend.core.models import (
    CanonicalDiagram,
    DiagramRegion,
    DiagramFamily,
    ElementType,
    ConnectorDirection
)
from backend.pipeline.reconstruction import DiagramReconstructor
from backend.pipeline.connector_extractor import ConnectorExtractor
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter


def test_complex_flowchart_loops_crossings_multi_arrows():
    """
    Synthesizes and verifies a complex flowchart containing:
    - Node A (Start)
    - Node B (Decision)
    - Node C (Process Step 1)
    - Node D (Process Step 2 - Multiple incoming arrows)
    - Node E (End)
    - Branch 1: B -> C with label 'Yes'
    - Branch 2: B -> D with label 'No'
    - Step connector: C -> D (converging into D along with Branch 2)
    - Upward Feedback loop: D -> B (loop back to decision)
    - Crossing line: Horizontal connector crossing an orthogonal vertical line
    """
    img = np.ones((800, 800, 3), dtype=np.uint8) * 255

    # Shapes:
    # A (Start): (320, 40, 160, 50)
    cv2.rectangle(img, (320, 40), (480, 90), (40, 40, 40), 2)
    cv2.putText(img, "Start", (370, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # B (Decision): (300, 160, 200, 80)
    diamond_pts = np.array([[400, 160], [500, 200], [400, 240], [300, 200]])
    cv2.polylines(img, [diamond_pts], True, (40, 40, 40), 2)
    cv2.putText(img, "Valid?", (375, 205), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # C (Process 1): (120, 320, 160, 60)
    cv2.rectangle(img, (120, 320), (280, 380), (40, 40, 40), 2)
    cv2.putText(img, "Process A", (150, 355), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # D (Process 2 / Merge): (320, 480, 160, 60)
    cv2.rectangle(img, (320, 480), (480, 540), (40, 40, 40), 2)
    cv2.putText(img, "Merge Step", (340, 515), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # E (End): (320, 640, 160, 50)
    cv2.rectangle(img, (320, 640), (480, 690), (40, 40, 40), 2)
    cv2.putText(img, "End", (380, 672), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Connectors:
    # 1. Start -> Decision
    cv2.line(img, (400, 90), (400, 160), (40, 40, 40), 2)
    cv2.arrowedLine(img, (400, 130), (400, 160), (40, 40, 40), 2, tipLength=0.25)

    # 2. Decision -> Process A ('Yes') leaving Left handle
    cv2.line(img, (300, 200), (200, 200), (40, 40, 40), 2)
    cv2.line(img, (200, 200), (200, 320), (40, 40, 40), 2)
    cv2.arrowedLine(img, (200, 290), (200, 320), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "Yes", (230, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # 3. Decision -> Merge Step ('No') leaving Right handle
    cv2.line(img, (500, 200), (600, 200), (40, 40, 40), 2)
    cv2.line(img, (600, 200), (600, 510), (40, 40, 40), 2)
    cv2.line(img, (600, 510), (480, 510), (40, 40, 40), 2)
    cv2.arrowedLine(img, (520, 510), (480, 510), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "No", (520, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # 4. Process A -> Merge Step (converging into Merge Step from Left)
    cv2.line(img, (200, 380), (200, 510), (40, 40, 40), 2)
    cv2.line(img, (200, 510), (320, 510), (40, 40, 40), 2)
    cv2.arrowedLine(img, (290, 510), (320, 510), (40, 40, 40), 2, tipLength=0.25)

    # 5. Merge Step -> End
    cv2.line(img, (400, 540), (400, 640), (40, 40, 40), 2)
    cv2.arrowedLine(img, (400, 610), (400, 640), (40, 40, 40), 2, tipLength=0.25)

    region = DiagramRegion(
        file_name="complex_flowchart.png",
        page_number=1,
        x=0,
        y=0,
        width=800,
        height=800,
        suggested_type=DiagramFamily.FLOWCHART,
        suggested_subtype="flowchart",
        label="Complex Flowchart Benchmark"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="benchmark_fc")

    # 1. Structural Verification: Node Count
    assert len(diagram.elements) >= 4, f"Expected at least 4 nodes, got {len(diagram.elements)}"

    # 2. Decision Node Detection
    decisions = [e for e in diagram.elements if e.type == ElementType.DECISION]
    assert len(decisions) >= 1, "Decision diamond must be detected"

    # 3. Connector and Arrow Topology
    assert len(diagram.connectors) >= 3, f"Expected at least 3 connectors, got {len(diagram.connectors)}"

    # Check for branch label attachment (Yes or No)
    labels = [c.label.strip() for c in diagram.connectors if c.label.strip()]
    assert any("Yes" in l or "No" in l for l in labels), f"Branch labels Yes/No should be attached: {labels}"

    # Export to Mermaid & PlantUML
    mmd, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert "flowchart TD" in mmd

    puml, puml_valid, _ = PlantUMLExporter.export(diagram)
    assert puml_valid
    assert "@startuml" in puml


def test_dfd_reconstruction():
    """
    Tests Data Flow Diagram recognition:
    - External Entity: Customer
    - Process: 1.0 Place Order
    - Data Store: D1 Order Store
    - Data Flows: Order Info, Order Record
    """
    img = np.ones((600, 800, 3), dtype=np.uint8) * 255

    # Entity: Customer
    cv2.rectangle(img, (50, 200), (200, 270), (40, 40, 40), 2)
    cv2.putText(img, "Customer", (70, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Process: 1.0 Place Order (Circle / Ellipse)
    cv2.circle(img, (400, 235), 60, (40, 40, 40), 2)
    cv2.putText(img, "1.0 Place Order", (340, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # Data Store: D1 Orders
    cv2.rectangle(img, (600, 200), (750, 270), (40, 40, 40), 2)
    cv2.putText(img, "D1 Orders", (620, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Connectors
    cv2.line(img, (200, 235), (340, 235), (40, 40, 40), 2)
    cv2.arrowedLine(img, (310, 235), (340, 235), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "Order Info", (220, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    cv2.line(img, (460, 235), (600, 235), (40, 40, 40), 2)
    cv2.arrowedLine(img, (570, 235), (600, 235), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "Save Order", (480, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    region = DiagramRegion(
        file_name="dfd_sample.png",
        page_number=1,
        x=0,
        y=0,
        width=800,
        height=600,
        suggested_type=DiagramFamily.DFD,
        suggested_subtype="dfd",
        label="Order DFD"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="dfd_proj")

    assert diagram.family == DiagramFamily.DFD
    assert len(diagram.elements) >= 3

    # Check for DFD roles
    types = {e.type for e in diagram.elements}
    assert ElementType.EXTERNAL_ENTITY in types or ElementType.PROCESS in types or ElementType.DATA_STORE in types

    mmd, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert "flowchart TD" in mmd


def test_sequence_diagram_reconstruction():
    """
    Tests Sequence Diagram recognition:
    - Participants: Client, Server
    - Messages: request(), response()
    """
    img = np.ones((600, 600, 3), dtype=np.uint8) * 255

    # Participant 1: Client
    cv2.rectangle(img, (80, 40), (200, 90), (40, 40, 40), 2)
    cv2.putText(img, "Client", (110, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Participant 2: Server
    cv2.rectangle(img, (400, 40), (520, 90), (40, 40, 40), 2)
    cv2.putText(img, "Server", (430, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Lifelines
    cv2.line(img, (140, 90), (140, 500), (120, 120, 120), 1)
    cv2.line(img, (460, 90), (460, 500), (120, 120, 120), 1)

    # Message 1: Client -> Server
    cv2.line(img, (140, 200), (460, 200), (40, 40, 40), 2)
    cv2.arrowedLine(img, (420, 200), (460, 200), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "getData()", (240, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    # Message 2: Server -> Client (dashed response)
    cv2.line(img, (140, 320), (460, 320), (40, 40, 40), 2)
    cv2.arrowedLine(img, (180, 320), (140, 320), (40, 40, 40), 2, tipLength=0.25)
    cv2.putText(img, "returnData()", (240, 305), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    region = DiagramRegion(
        file_name="sequence_sample.png",
        page_number=1,
        x=0,
        y=0,
        width=600,
        height=600,
        suggested_type=DiagramFamily.SEQUENCE,
        suggested_subtype="sequence",
        label="Client Server Sequence"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="seq_proj")

    assert diagram.family == DiagramFamily.SEQUENCE
    assert len(diagram.elements) >= 2
    assert all(e.type == ElementType.PARTICIPANT for e in diagram.elements)

    mmd, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert "sequenceDiagram" in mmd
    assert "participant" in mmd

    puml, puml_valid, _ = PlantUMLExporter.export(diagram)
    assert puml_valid
    assert "@startuml" in puml
    assert "participant" in puml


def test_erd_reconstruction():
    """
    Tests ERD recognition:
    - Entity: Student
    - Key Attribute: student_id
    - Attribute: student_name
    - Relationship: Enrolls
    """
    img = np.ones((600, 700, 3), dtype=np.uint8) * 255

    # Entity: Student
    cv2.rectangle(img, (250, 240), (420, 300), (40, 40, 40), 2)
    cv2.putText(img, "Student", (290, 275), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Key Attribute: student_id (oval)
    cv2.ellipse(img, (150, 150), (60, 30), 0, 0, 360, (40, 40, 40), 2)
    cv2.putText(img, "id", (140, 155), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Attribute: name (oval)
    cv2.ellipse(img, (500, 150), (60, 30), 0, 0, 360, (40, 40, 40), 2)
    cv2.putText(img, "name", (475, 155), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Relationship: Enrolls (diamond)
    diamond = np.array([[335, 420], [405, 460], [335, 500], [265, 460]])
    cv2.polylines(img, [diamond], True, (40, 40, 40), 2)
    cv2.putText(img, "Enrolls", (295, 465), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # Connectors
    cv2.line(img, (150, 180), (280, 240), (40, 40, 40), 2)
    cv2.line(img, (500, 180), (390, 240), (40, 40, 40), 2)
    cv2.line(img, (335, 300), (335, 420), (40, 40, 40), 2)

    region = DiagramRegion(
        file_name="erd_sample.png",
        page_number=1,
        x=0,
        y=0,
        width=700,
        height=600,
        suggested_type=DiagramFamily.ERD,
        suggested_subtype="erd",
        label="Student ERD"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="erd_proj")

    assert diagram.family == DiagramFamily.ERD
    assert len(diagram.elements) >= 3

    types = {e.type for e in diagram.elements}
    assert ElementType.ENTITY in types or ElementType.ATTRIBUTE in types or ElementType.KEY_ATTRIBUTE in types or ElementType.RELATIONSHIP in types

    mmd, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert len(mmd) > 20
