"""
ODR PlantUML Exporter (Version 2.0).
Serializes CanonicalDiagram into clean PlantUML syntax for:
- Flowcharts (activity / component)
- Sequence diagrams (@startuml ... participant ... -> ...)
- Entity-Relationship diagrams (entity ... relationship ...)
- Data Flow Diagrams
"""

import re
from typing import Tuple
from backend.core.models import (
    CanonicalDiagram,
    DiagramFamily,
    ElementType,
    ConnectorDirection
)


class PlantUMLExporter:
    """Exports CanonicalDiagram to valid PlantUML diagram code."""

    @classmethod
    def export(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        family = diagram.family.value if hasattr(diagram.family, "value") else str(diagram.family)
        family = family.lower()

        if family in ("pie_chart", "bar_chart", "chart") and diagram.chart_data:
            lines = [
                "@startuml",
                "!theme plain",
                f"title {diagram.name}",
                "note over (Chart)",
                f"  Chart: {diagram.chart_data.title if diagram.chart_data else 'Chart'}",
                "  PlantUML does not have a native chart renderer.",
                "end note",
                "@enduml"
            ]
            return "\n".join(lines), True, "PlantUML note generated for chart"

        elif family == "sequence":
            lines = [
                "@startuml",
                "!theme plain",
                f"title {diagram.name}",
                ""
            ]
            element_map = {el.id: el for el in diagram.elements}
            for el in diagram.elements:
                safe_id = cls._sanitize_id(el.id)
                label = el.label.replace('"', "'").strip() or safe_id
                lines.append(f'participant "{label}" as {safe_id}')

            lines.append("")
            for conn in diagram.connectors:
                if conn.source_id not in element_map or conn.target_id not in element_map:
                    continue
                src_id = cls._sanitize_id(conn.source_id)
                tgt_id = cls._sanitize_id(conn.target_id)
                label = conn.label.replace('"', "'").strip()
                arrow = "-->" if conn.style.is_dashed else "->"
                lines.append(f"{src_id} {arrow} {tgt_id} : {label}")

            lines.append("")
            lines.append("@enduml")
            return "\n".join(lines), True, "PlantUML sequence diagram exported"

        else:
            lines = [
                "@startuml",
                "!theme plain",
                "skinparam shadowing false",
                "skinparam defaultFontName sans-serif",
                f"title {diagram.name}",
                ""
            ]

            element_map = {el.id: el for el in diagram.elements}

            # Declare nodes
            for el in diagram.elements:
                safe_id = cls._sanitize_id(el.id)
                label = el.label.replace('"', "'").strip() or safe_id
                
                if el.type in (ElementType.DECISION, ElementType.RELATIONSHIP):
                    lines.append(f'diamond "{label}" as {safe_id}')
                elif el.type in (ElementType.TERMINAL, ElementType.FINAL_STATE):
                    lines.append(f'circle "{label}" as {safe_id}')
                elif el.type in (ElementType.DATABASE, ElementType.DATA_STORE):
                    lines.append(f'database "{label}" as {safe_id}')
                elif el.type in (ElementType.IO, ElementType.EXTERNAL_ENTITY):
                    lines.append(f'entity "{label}" as {safe_id}')
                elif el.type in (ElementType.ATTRIBUTE, ElementType.KEY_ATTRIBUTE):
                    lines.append(f'storage "{label}" as {safe_id}')
                elif el.type == ElementType.PREPARATION:
                    lines.append(f'hexagon "{label}" as {safe_id}')
                elif el.type == ElementType.CLOUD:
                    lines.append(f'cloud "{label}" as {safe_id}')
                elif el.type == ElementType.QUEUE:
                    lines.append(f'queue "{label}" as {safe_id}')
                elif el.type == ElementType.SERVER:
                    lines.append(f'node "{label}" as {safe_id}')
                elif el.type == ElementType.ACTOR:
                    lines.append(f'actor "{label}" as {safe_id}')
                elif el.type == ElementType.PACKAGE:
                    lines.append(f'package "{label}" as {safe_id}')
                elif el.type == ElementType.DOCUMENT:
                    lines.append(f'file "{label}" as {safe_id}')
                elif el.type == ElementType.CARD:
                    lines.append(f'card "{label}" as {safe_id}')
                else:
                    lines.append(f'rectangle "{label}" as {safe_id}')

            lines.append("")

            # Declare connections
            for conn in diagram.connectors:
                if conn.source_id not in element_map or conn.target_id not in element_map:
                    continue

                src_id = cls._sanitize_id(conn.source_id)
                tgt_id = cls._sanitize_id(conn.target_id)
                label = conn.label.replace('"', "'").strip()

                arrow = "-->"
                if conn.direction == ConnectorDirection.UNDIRECTED:
                    arrow = "--"
                elif conn.direction == ConnectorDirection.BIDIRECTIONAL:
                    arrow = "<-->"

                if label:
                    lines.append(f'{src_id} {arrow} {tgt_id} : {label}')
                else:
                    lines.append(f'{src_id} {arrow} {tgt_id}')

            lines.append("")
            lines.append("@enduml")
            return "\n".join(lines), True, "PlantUML exported successfully"

    @classmethod
    def _sanitize_id(cls, raw_id: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", raw_id)
        if clean and clean[0].isdigit():
            clean = f"p_{clean}"
        return clean
