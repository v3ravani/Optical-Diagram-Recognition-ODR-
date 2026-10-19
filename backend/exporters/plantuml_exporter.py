"""
ODR PlantUML Exporter.
Serializes CanonicalDiagram into clean PlantUML activity or component syntax.
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
        lines = [
            "@startuml",
            "!theme plain",
            "skinparam shadowing false",
            "skinparam defaultFontName sans-serif",
            f"title {diagram.name}",
            ""
        ]

        if diagram.family == DiagramFamily.CHART:
            lines.append("note over (Chart)")
            lines.append(f"  Chart: {diagram.chart_data.title if diagram.chart_data else 'Chart'}")
            lines.append("  PlantUML does not have a native chart renderer.")
            lines.append("end note")
            lines.append("@enduml")
            return "\n".join(lines), True, "PlantUML note generated for chart"

        element_map = {el.id: el for el in diagram.elements}

        # Declare nodes
        for el in diagram.elements:
            safe_id = cls._sanitize_id(el.id)
            label = el.label.replace('"', "'").strip() or safe_id
            
            if el.type == ElementType.DECISION:
                lines.append(f'diamond "{label}" as {safe_id}')
            elif el.type == ElementType.TERMINAL:
                lines.append(f'circle "{label}" as {safe_id}')
            elif el.type == ElementType.DATABASE:
                lines.append(f'database "{label}" as {safe_id}')
            elif el.type == ElementType.IO:
                lines.append(f'entity "{label}" as {safe_id}')
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
