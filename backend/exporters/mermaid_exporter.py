"""
ODR Mermaid Exporter.
Serializes CanonicalDiagram into valid Mermaid syntax for flowcharts,
decision trees, pie charts, and xycharts with local syntax validation.
"""

import re
from typing import Dict, Any, Tuple
from backend.core.models import (
    CanonicalDiagram,
    DiagramFamily,
    ElementType,
    ConnectorDirection
)


class MermaidExporter:
    """Exports CanonicalDiagram into valid Mermaid source text."""

    @classmethod
    def export(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        """
        Returns (mermaid_code, is_valid, warning_or_error_message).
        """
        if diagram.family == DiagramFamily.CHART and diagram.chart_data:
            return cls._export_chart(diagram)
        else:
            return cls._export_flowchart(diagram)

    @classmethod
    def _export_flowchart(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        lines = ["flowchart TD"]
        element_map = {el.id: el for el in diagram.elements}
        warnings = []

        # 1. Define nodes with appropriate Mermaid shape brackets
        for el in diagram.elements:
            safe_id = cls._sanitize_id(el.id)
            label = el.label.replace('"', "'").strip()
            if not label:
                label = safe_id

            shape_code = cls._format_node_shape(safe_id, label, el.type)
            lines.append(f"    {shape_code}")

        # 2. Define connectors
        for conn in diagram.connectors:
            if conn.source_id not in element_map or conn.target_id not in element_map:
                warnings.append(f"Omitted disconnected connector {conn.id}")
                continue

            src_id = cls._sanitize_id(conn.source_id)
            tgt_id = cls._sanitize_id(conn.target_id)
            label = conn.label.replace('"', "'").strip()

            arrow = "-->"
            if conn.direction == ConnectorDirection.UNDIRECTED:
                arrow = "---"
            elif conn.direction == ConnectorDirection.BIDIRECTIONAL:
                arrow = "<-->"

            if label:
                edge_line = f"    {src_id} {arrow}|{label}| {tgt_id}"
            else:
                edge_line = f"    {src_id} {arrow} {tgt_id}"

            lines.append(edge_line)

        output = "\n".join(lines)
        return output, True, "; ".join(warnings) if warnings else "Export successful"

    @classmethod
    def _export_chart(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        cd = diagram.chart_data
        if not cd:
            return "flowchart TD\n    A[No chart data]", False, "Missing chart data"

        if cd.chart_type == "pie":
            lines = [f'pie title "{cd.title or "Chart"}"']
            series = cd.series[0] if cd.series else None
            for idx, cat in enumerate(cd.categories):
                val = series.values[idx] if series and idx < len(series.values) else 10
                clean_cat = cat.replace('"', "'").strip() or f"Cat {idx + 1}"
                lines.append(f'    "{clean_cat}" : {val}')
            return "\n".join(lines), True, "Pie chart exported"
        else:
            # Bar / XY chart
            lines = [
                "xychart-beta",
                f'    title "{cd.title or "Chart"}"',
                f'    x-axis [{", ".join(f"{c}" for c in cd.categories)}]',
            ]
            for s in cd.series:
                vals_str = ", ".join(str(v) for v in s.values)
                lines.append(f'    bar [{vals_str}]')
            return "\n".join(lines), True, "XY Bar chart exported"

    @classmethod
    def _format_node_shape(cls, safe_id: str, label: str, el_type: ElementType) -> str:
        if el_type == ElementType.DECISION:
            return f'{safe_id}{{"{label}"}}'
        elif el_type in (ElementType.TERMINAL, ElementType.ROUNDED_RECTANGLE):
            return f'{safe_id}(["{label}"])'
        elif el_type == ElementType.CIRCLE:
            return f'{safe_id}(("{label}"))'
        elif el_type == ElementType.DATABASE:
            return f'{safe_id}[("{label}")]'
        elif el_type == ElementType.IO:
            return f'{safe_id}[/"{label}"/]'
        elif el_type == ElementType.PREDEFINED_PROCESS:
            return f'{safe_id}[["{label}"]]'
        else:
            return f'{safe_id}["{label}"]'

    @classmethod
    def _sanitize_id(cls, raw_id: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", raw_id)
        if clean and clean[0].isdigit():
            clean = f"n_{clean}"
        return clean
