"""
ODR Mermaid Exporter (Version 2.0).
Serializes CanonicalDiagram into valid Mermaid syntax for:
- Flowcharts (flowchart TD with accurate shape brackets & branch labels)
- Sequence diagrams (sequenceDiagram with participants & message arrows)
- Entity-Relationship diagrams (erDiagram)
- Data Flow Diagrams (flowchart TD with DFD shapes)
- Bar and Pie charts (xychart-beta and pie)
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
        family = diagram.family.value if hasattr(diagram.family, "value") else str(diagram.family)
        family = family.lower()

        if family in ("pie_chart", "bar_chart", "chart") and diagram.chart_data:
            return cls._export_chart(diagram)
        elif family == "sequence":
            return cls._export_sequence(diagram)
        elif family == "erd":
            return cls._export_erd(diagram)
        else:
            return cls._export_flowchart(diagram)

    @classmethod
    def _export_sequence(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        lines = ["sequenceDiagram"]
        element_map = {el.id: el for el in diagram.elements}

        # 1. Participants
        for el in diagram.elements:
            safe_id = cls._sanitize_id(el.id)
            label = el.label.replace('"', "'").strip() or safe_id
            lines.append(f'    participant {safe_id} as {label}')

        # 2. Messages
        for conn in diagram.connectors:
            if conn.source_id not in element_map or conn.target_id not in element_map:
                continue
            src_id = cls._sanitize_id(conn.source_id)
            tgt_id = cls._sanitize_id(conn.target_id)
            lbl = conn.label.replace('"', "'").strip() or "message"
            arrow = "-->>" if conn.style.is_dashed else "->>"
            lines.append(f"    {src_id}{arrow}{tgt_id}: {lbl}")

        return "\n".join(lines), True, "Sequence diagram exported"

    @classmethod
    def _export_erd(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        lines = ["erDiagram"]
        element_map = {el.id: el for el in diagram.elements}
        entities = [el for el in diagram.elements if el.type == ElementType.ENTITY]

        if not entities:
            # Fallback to standard flowchart if no distinct entities
            return cls._export_flowchart(diagram)

        for el in entities:
            safe_name = cls._sanitize_id(el.label or el.id).upper()
            lines.append(f"    {safe_name} {{")
            # Find attached attributes
            for conn in diagram.connectors:
                other_id = conn.target_id if conn.source_id == el.id else (conn.source_id if conn.target_id == el.id else None)
                if other_id and other_id in element_map:
                    other_el = element_map[other_id]
                    if other_el.type in (ElementType.ATTRIBUTE, ElementType.KEY_ATTRIBUTE):
                        pk_marker = " PK" if other_el.type == ElementType.KEY_ATTRIBUTE else ""
                        attr_name = cls._sanitize_id(other_el.label or other_el.id)
                        lines.append(f"        string {attr_name}{pk_marker}")
            lines.append("    }")

        # Connectors between entities or via relationship diamonds
        for conn in diagram.connectors:
            if conn.source_id in element_map and conn.target_id in element_map:
                s_el = element_map[conn.source_id]
                t_el = element_map[conn.target_id]
                if s_el.type == ElementType.ENTITY and t_el.type == ElementType.ENTITY:
                    s_name = cls._sanitize_id(s_el.label or s_el.id).upper()
                    t_name = cls._sanitize_id(t_el.label or t_el.id).upper()
                    rel_lbl = conn.label or "relates"
                    lines.append(f"    {s_name} ||--o{{ {t_name} : {rel_lbl}")

        return "\n".join(lines), True, "ER diagram exported"

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
        if el_type in (ElementType.DECISION, ElementType.RELATIONSHIP):
            return f'{safe_id}{{"{label}"}}'
        elif el_type in (ElementType.TERMINAL, ElementType.ROUNDED_RECTANGLE):
            return f'{safe_id}(["{label}"])'
        elif el_type == ElementType.CIRCLE:
            return f'{safe_id}(("{label}"))'
        elif el_type in (ElementType.DATABASE, ElementType.DATA_STORE):
            return f'{safe_id}[("{label}")]'
        elif el_type == ElementType.EXTERNAL_ENTITY:
            return f'{safe_id}["[ {label} ]"]'
        elif el_type in (ElementType.ATTRIBUTE, ElementType.KEY_ATTRIBUTE):
            return f'{safe_id}(["{label}"])'
        elif el_type == ElementType.IO:
            return f'{safe_id}[/"{label}"/]'
        elif el_type == ElementType.MANUAL_OPERATION:
            return f'{safe_id}[/"{label}"\\]'
        elif el_type == ElementType.PREDEFINED_PROCESS:
            return f'{safe_id}[["{label}"]]'
        elif el_type == ElementType.PREPARATION:
            return f'{safe_id}{{{{"{label}"}}}}'
        elif el_type in (ElementType.OFF_PAGE_CONNECTOR, ElementType.DOCUMENT):
            return f'{safe_id}>"{label}"]'
        elif el_type == ElementType.FINAL_STATE:
            return f'{safe_id}(("{label}"))'
        elif el_type == ElementType.CLOUD:
            return f'{safe_id}["☁️ {label}"]'
        elif el_type == ElementType.SERVER:
            return f'{safe_id}["🖥️ {label}"]'
        elif el_type == ElementType.QUEUE:
            return f'{safe_id}["🔀 {label}"]'
        elif el_type == ElementType.ACTOR:
            return f'{safe_id}["👤 {label}"]'
        elif el_type == ElementType.PACKAGE:
            return f'{safe_id}["📦 {label}"]'
        elif el_type in (ElementType.DELAY, ElementType.DISPLAY, ElementType.CARD):
            return f'{safe_id}(["{label}"])'
        else:
            return f'{safe_id}["{label}"]'

    @classmethod
    def _sanitize_id(cls, raw_id: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", raw_id)
        if clean and clean[0].isdigit():
            clean = f"n_{clean}"
        return clean
