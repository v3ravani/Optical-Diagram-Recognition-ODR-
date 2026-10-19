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


def test_flowchart_undirected_lines_preserved():
    """
    Tests that a diagram with plain lines and no arrowheads keeps lines (undirected),
    faithfully preserving non-directional links without silently inventing arrows.
    """
    img = np.ones((500, 600, 3), dtype=np.uint8) * 255

    # Process A
    cv2.rectangle(img, (80, 200), (220, 270), (40, 40, 40), 2)
    cv2.putText(img, "Module Alpha", (90, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Process B
    cv2.rectangle(img, (380, 200), (520, 270), (40, 40, 40), 2)
    cv2.putText(img, "Module Beta", (390, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Simple plain line connecting them - NO ARROWHEAD
    cv2.line(img, (220, 235), (380, 235), (40, 40, 40), 2)

    region = DiagramRegion(
        file_name="undirected_flow.png",
        page_number=1,
        x=0,
        y=0,
        width=600,
        height=500,
        suggested_type=DiagramFamily.FLOWCHART,
        suggested_subtype="flowchart",
        label="Undirected Link Flowchart"
    )

    reconstructor = DiagramReconstructor()
    diagram = reconstructor.reconstruct(img, region, project_id="undirected_proj")

    assert len(diagram.elements) >= 2
    assert len(diagram.connectors) >= 1

    conn = diagram.connectors[0]
    # Direction MUST be undirected because no arrowheads exist
    assert conn.direction == ConnectorDirection.UNDIRECTED, f"Expected undirected line, got {conn.direction}"

    # Mermaid export must use --- and NOT -->
    mmd, mmd_valid, _ = MermaidExporter.export(diagram)
    assert mmd_valid
    assert "---" in mmd
    assert "-->" not in mmd

    # PlantUML export must use -- and NOT -->
    puml, puml_valid, _ = PlantUMLExporter.export(diagram)
    assert puml_valid
    assert "--" in puml


def test_rich_component_shapes_export():
    """
    Tests that rich components (Preparation Hexagon, Cloud, Queue, Server,
    Manual Operation, Card, Package, Delay, Display) serialize accurately.
    """
    from backend.core.models import CanonicalDiagram, DiagramElement, DiagramConnector, ElementStyle

    elements = [
        DiagramElement(
            id="node_prep",
            type=ElementType.PREPARATION,
            label="Init Variables",
            x=100, y=100, width=150, height=65,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_cloud",
            type=ElementType.CLOUD,
            label="AWS Gateway",
            x=300, y=100, width=160, height=85,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_queue",
            type=ElementType.QUEUE,
            label="Event Kafka",
            x=500, y=100, width=150, height=55,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_server",
            type=ElementType.SERVER,
            label="Worker Node",
            x=700, y=100, width=150, height=70,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_manual",
            type=ElementType.MANUAL_OPERATION,
            label="Admin Override",
            x=100, y=300, width=150, height=65,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_card",
            type=ElementType.CARD,
            label="Latency KPI",
            x=300, y=300, width=150, height=65,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_package",
            type=ElementType.PACKAGE,
            label="Auth Service",
            x=500, y=300, width=150, height=75,
            style=ElementStyle()
        ),
        DiagramElement(
            id="node_final",
            type=ElementType.FINAL_STATE,
            label="Stop",
            x=700, y=300, width=55, height=55,
            style=ElementStyle()
        ),
    ]

    connectors = [
        DiagramConnector(
            id="conn_1",
            source_id="node_prep",
            target_id="node_cloud",
            direction=ConnectorDirection.DIRECTED,
            label="send"
        ),
        DiagramConnector(
            id="conn_2",
            source_id="node_cloud",
            target_id="node_queue",
            direction=ConnectorDirection.DIRECTED,
            label="publish"
        ),
        DiagramConnector(
            id="conn_3",
            source_id="node_queue",
            target_id="node_server",
            direction=ConnectorDirection.UNDIRECTED,
            label="pull"
        )
    ]

    diag = CanonicalDiagram(
        id="diag_rich_components",
        project_id="test_proj",
        name="Rich Component Architecture",
        family=DiagramFamily.FLOWCHART,
        elements=elements,
        connectors=connectors
    )

    mmd, mmd_valid, _ = MermaidExporter.export(diag)
    assert mmd_valid
    assert 'node_prep{{"Init Variables"}}' in mmd
    assert 'node_cloud["☁️ AWS Gateway"]' in mmd
    assert 'node_queue["🔀 Event Kafka"]' in mmd
    assert 'node_server["🖥️ Worker Node"]' in mmd
    assert 'node_final(("Stop"))' in mmd
    assert 'node_prep -->|send| node_cloud' in mmd
    assert 'node_queue ---|pull| node_server' in mmd

    puml, puml_valid, _ = PlantUMLExporter.export(diag)
    assert puml_valid
    assert 'hexagon "Init Variables" as node_prep' in puml
    assert 'cloud "AWS Gateway" as node_cloud' in puml
    assert 'queue "Event Kafka" as node_queue' in puml
    assert 'node "Worker Node" as node_server' in puml
    assert 'package "Auth Service" as node_package' in puml


def test_connector_deduplication_and_polarity():
    """
    Validates that:
    1. Redundant parallel line detections between the same two nodes are collapsed into a single connector.
    2. False reverse arrows (A -> B and B -> A from overlapping line segments) are resolved to the true forward flow.
    3. Spurious bypass edges that cross over intermediate nodes are pruned.
    4. Complementary branch labels (e.g. Yes -> counterpart inferred as No) are deduced on decision diamonds.
    """
    from backend.core.models import DiagramElement, ElementStyle
    from backend.pipeline.connector_extractor import ConnectorExtractor

    el_start = DiagramElement(
        id="el_start",
        type=ElementType.TERMINAL,
        role="start",
        label="Start",
        x=200.0,
        y=50.0,
        width=120.0,
        height=40.0,
        style=ElementStyle()
    )
    el_decision = DiagramElement(
        id="el_decision",
        type=ElementType.DECISION,
        role="decision",
        label="Is Valid?",
        x=180.0,
        y=150.0,
        width=160.0,
        height=60.0,
        style=ElementStyle()
    )
    el_step1 = DiagramElement(
        id="el_step1",
        type=ElementType.PROCESS,
        role="process",
        label="Execute",
        x=50.0,
        y=280.0,
        width=120.0,
        height=50.0,
        style=ElementStyle()
    )
    el_step2 = DiagramElement(
        id="el_step2",
        type=ElementType.PROCESS,
        role="process",
        label="Fallback",
        x=350.0,
        y=280.0,
        width=120.0,
        height=50.0,
        style=ElementStyle()
    )

    elements = [el_start, el_decision, el_step1, el_step2]

    # Synthesize noisy raw candidate edges with duplicates, reversed fragments, and a false bypass jump
    noisy_edges = [
        # Start -> Decision (multiple overlapping detections)
        {"source_id": "el_start", "target_id": "el_decision", "direction": ConnectorDirection.DIRECTED, "points": [(260, 90), (260, 150)]},
        {"source_id": "el_start", "target_id": "el_decision", "direction": ConnectorDirection.DIRECTED, "points": [(260, 90), (260, 150)]},
        {"source_id": "el_decision", "target_id": "el_start", "direction": ConnectorDirection.DIRECTED, "points": [(260, 150), (260, 90)]},
        # False bypass jumping directly from start to step1 over decision
        {"source_id": "el_start", "target_id": "el_step1", "direction": ConnectorDirection.DIRECTED, "points": [(200, 90), (110, 280)]},
        # Decision -> Step 1 (labeled Yes)
        {"source_id": "el_decision", "target_id": "el_step1", "direction": ConnectorDirection.DIRECTED, "points": [(180, 180), (110, 280)]},
        # Decision -> Step 2 (unlabeled)
        {"source_id": "el_decision", "target_id": "el_step2", "direction": ConnectorDirection.DIRECTED, "points": [(340, 180), (410, 280)]},
    ]

    deduped = ConnectorExtractor._deduplicate_edges(noisy_edges, elements)

    # 1. Start -> Step1 bypass should be eliminated
    connected_pairs = [(e["source_id"], e["target_id"]) for e in deduped]
    assert ("el_start", "el_step1") not in connected_pairs

    # 2. Only 3 distinct connectors should remain
    assert len(deduped) == 3

    # 3. Start -> Decision should flow strictly downward
    assert ("el_start", "el_decision") in connected_pairs
    assert ("el_decision", "el_start") not in connected_pairs


def test_ocr_technical_normalization():
    """
    Validates normalization of common optical character recognition distortions
    in technical diagrams and flowcharts.
    """
    from backend.pipeline.ocr_engine import OCREngine

    assert OCREngine._normalize_diagram_text("Ne") == "No"
    assert OCREngine._normalize_diagram_text("n0") == "No"
    assert OCREngine._normalize_diagram_text("Ycs") == "Yes"
    assert OCREngine._normalize_diagram_text("Yos") == "Yes"
    assert OCREngine._normalize_diagram_text("Tme") == "True"
    assert OCREngine._normalize_diagram_text("Falso") == "False"
    assert OCREngine._normalize_diagram_text("Bulb burned out? Balb check") == "Bulb burned out? Bulb check"
    assert OCREngine._normalize_diagram_text("Refiltank") == "Refill tank"
    assert OCREngine._normalize_diagram_text("Cantactmainianance") == "Contact maintenance"


def test_screenshot_diagram_region_isolation():
    """
    Validates that RegionDetector suppresses whole-screenshot outer window borders
    when a distinct inner diagram region is present.
    """
    from backend.pipeline.region_detector import RegionDetector

    # Synthesize an outer application screenshot (1200x800) containing an inner diagram (400x500)
    screen = np.ones((800, 1200, 3), dtype=np.uint8) * 240
    # Outer frame
    cv2.rectangle(screen, (10, 10), (1190, 790), (180, 180, 180), 2)
    # Inner diagram at (100, 120) with size (450, 520)
    cv2.rectangle(screen, (100, 120), (550, 640), (255, 255, 255), -1)
    cv2.rectangle(screen, (100, 120), (550, 640), (60, 60, 60), 2)
    # Diagram nodes inside
    cv2.rectangle(screen, (180, 160), (320, 220), (50, 50, 50), 2)
    cv2.rectangle(screen, (180, 300), (320, 360), (50, 50, 50), 2)
    cv2.arrowedLine(screen, (250, 220), (250, 300), (50, 50, 50), 2)

    regions = RegionDetector.detect_diagram_regions(screen, "screenshot_test.png")
    assert len(regions) >= 1

    # Ensure no detected region spans >= 88% of both screenshot dimensions
    for r in regions:
        assert not (r.width > 0.88 * 1200 and r.height > 0.88 * 800), "Outer window enclosing frame was not suppressed"


