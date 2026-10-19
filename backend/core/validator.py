"""
ODR Diagram Structural and Semantic Validator.
Validates canonical diagrams against structural consistency, graph topology rules,
uncertainty metrics, and export compatibility.
"""

from typing import List, Dict, Set
from backend.core.models import (
    CanonicalDiagram,
    DiagramElement,
    DiagramConnector,
    ElementType,
    DiagramFamily,
    ValidationIssue,
    IssueCategory,
    IssueSeverity,
    ExportCapability,
    UncertaintyStatus
)


class DiagramValidator:
    """Validates diagram models and updates validation issues and export capabilities."""

    @classmethod
    def validate(cls, diagram: CanonicalDiagram) -> CanonicalDiagram:
        issues: List[ValidationIssue] = []
        element_map: Dict[str, DiagramElement] = {el.id: el for el in diagram.elements}
        
        # 1. Check for dangling connectors
        valid_connectors: List[DiagramConnector] = []
        for conn in diagram.connectors:
            has_source = conn.source_id in element_map
            has_target = conn.target_id in element_map
            
            if not has_source and not has_target:
                issues.append(ValidationIssue(
                    category=IssueCategory.CONNECTOR,
                    severity=IssueSeverity.ERROR,
                    connector_id=conn.id,
                    message="Connector is disconnected from both source and target nodes.",
                    suggested_action="Reconnect both endpoints or delete the orphaned connector."
                ))
            elif not has_source:
                issues.append(ValidationIssue(
                    category=IssueCategory.CONNECTOR,
                    severity=IssueSeverity.WARNING,
                    connector_id=conn.id,
                    message=f"Connector start endpoint does not attach to any known node (ID: {conn.source_id}).",
                    suggested_action="Drag start handle to snap to an adjacent node."
                ))
            elif not has_target:
                issues.append(ValidationIssue(
                    category=IssueCategory.CONNECTOR,
                    severity=IssueSeverity.WARNING,
                    connector_id=conn.id,
                    message=f"Connector target endpoint does not attach to any known node (ID: {conn.target_id}).",
                    suggested_action="Drag target arrowhead to connect to an existing node."
                ))
            else:
                valid_connectors.append(conn)

            # Check self-loops
            if conn.source_id == conn.target_id and conn.source_id in element_map:
                issues.append(ValidationIssue(
                    category=IssueCategory.CONNECTOR,
                    severity=IssueSeverity.INFO,
                    connector_id=conn.id,
                    element_id=conn.source_id,
                    message=f"Node '{element_map[conn.source_id].label or conn.source_id}' has a loopback connector onto itself.",
                    suggested_action="Verify if this represents an intentional retry or iterative loop."
                ))

        # 2. Check node connections and graph topology for flowcharts
        if diagram.family == DiagramFamily.FLOWCHART:
            incoming_count: Dict[str, int] = {el.id: 0 for el in diagram.elements}
            outgoing_count: Dict[str, int] = {el.id: 0 for el in diagram.elements}
            outgoing_edges: Dict[str, List[DiagramConnector]] = {el.id: [] for el in diagram.elements}

            for conn in valid_connectors:
                outgoing_count[conn.source_id] += 1
                incoming_count[conn.target_id] += 1
                outgoing_edges[conn.source_id].append(conn)

            start_nodes = [el for el in diagram.elements if el.role == "start" or (el.type == ElementType.TERMINAL and incoming_count[el.id] == 0)]
            end_nodes = [el for el in diagram.elements if el.role == "end" or (el.type == ElementType.TERMINAL and outgoing_count[el.id] == 0)]

            # Check for isolated nodes
            for el in diagram.elements:
                if el.type in (ElementType.TEXT_BLOCK, ElementType.NOTE):
                    continue
                if incoming_count[el.id] == 0 and outgoing_count[el.id] == 0:
                    issues.append(ValidationIssue(
                        category=IssueCategory.STRUCTURAL,
                        severity=IssueSeverity.WARNING,
                        element_id=el.id,
                        message=f"Isolated node '{el.label or el.id}' has no incoming or outgoing connectors.",
                        suggested_action="Connect this node into the flow or remove it if spurious."
                    ))

            # Check decision nodes
            for el in diagram.elements:
                if el.type == ElementType.DECISION or el.role == "decision":
                    if outgoing_count[el.id] < 2:
                        issues.append(ValidationIssue(
                            category=IssueCategory.STRUCTURAL,
                            severity=IssueSeverity.WARNING,
                            element_id=el.id,
                            message=f"Decision diamond '{el.label or el.id}' has only {outgoing_count[el.id]} outgoing branch (expected at least 2: e.g. Yes/No).",
                            suggested_action="Add another outgoing connector for alternative branching."
                        ))
                    else:
                        # Check branch labels
                        edges = outgoing_edges[el.id]
                        unlabelled = [e for e in edges if not e.label.strip()]
                        if unlabelled:
                            issues.append(ValidationIssue(
                                category=IssueCategory.DIRECTION,
                                severity=IssueSeverity.INFO,
                                element_id=el.id,
                                connector_id=unlabelled[0].id,
                                message=f"Outgoing branch from decision '{el.label or el.id}' is missing a label (e.g. Yes, No, True, False).",
                                suggested_action="Assign a condition label to clarify branching logic."
                            ))

        # 3. Check low confidence or uncertain elements
        for el in diagram.elements:
            if el.uncertainty_status in (UncertaintyStatus.NEEDS_REVIEW, UncertaintyStatus.UNCERTAIN):
                issues.append(ValidationIssue(
                    category=IssueCategory.TEXT if "ocr_score" in el.provenance and el.provenance["ocr_score"] < 0.75 else IssueCategory.SHAPE,
                    severity=IssueSeverity.WARNING,
                    element_id=el.id,
                    message=f"Element '{el.label or el.id}' was flagged with low confidence ({int(el.confidence * 100)}%).",
                    suggested_action="Inspect the source image and confirm label or shape type."
                ))
            elif not el.label.strip() and el.type not in (ElementType.TERMINAL, ElementType.NOTE):
                issues.append(ValidationIssue(
                    category=IssueCategory.TEXT,
                    severity=IssueSeverity.INFO,
                    element_id=el.id,
                    message=f"Node '{el.id}' of type '{el.type.value}' has an empty label.",
                    suggested_action="Double-click node to enter descriptive text."
                ))

        # 4. Exporter capability evaluation
        export_caps = ExportCapability(
            mermaid=True,
            plantuml=True,
            json=True,
            png=True
        )

        if diagram.family == DiagramFamily.CHART:
            export_caps.mermaid = True
            export_caps.mermaid_notes = "Rendered as Mermaid pie or xychart."
            export_caps.plantuml = False
            export_caps.plantuml_notes = "PlantUML has limited native support for data charts."
        elif diagram.family == DiagramFamily.FLOWCHART:
            export_caps.mermaid = True
            export_caps.plantuml = True

        diagram.validation_issues = issues
        diagram.export_capabilities = export_caps
        return diagram
