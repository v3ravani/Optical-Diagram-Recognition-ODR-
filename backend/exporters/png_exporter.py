"""
ODR Local PNG Exporter.
Renders CanonicalDiagram into high-resolution PNG using Pillow without editor artifacts.
Supports antialiasing, custom background, scaling, and precise shape drawing.
"""

import io
import math
from typing import Tuple, Optional
from PIL import Image, ImageDraw, ImageFont
from backend.core.models import (
    CanonicalDiagram,
    ElementType,
    ConnectorDirection,
    DiagramFamily
)


class PNGExporter:
    """Renders CanonicalDiagram directly to PNG image bytes."""

    @classmethod
    def export(
        cls,
        diagram: CanonicalDiagram,
        scale: float = 2.0,
        padding: int = 40,
        background_color: str = "#ffffff"
    ) -> Tuple[bytes, bool, str]:
        try:
            if not diagram.elements:
                # Empty diagram fallback
                img = Image.new("RGBA", (int(400 * scale), int(200 * scale)), (255, 255, 255, 255))
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return buf.getvalue(), True, "Exported empty diagram"

            # Compute bounding box of all elements
            min_x = min(el.x for el in diagram.elements)
            min_y = min(el.y for el in diagram.elements)
            max_x = max(el.x + el.width for el in diagram.elements)
            max_y = max(el.y + el.height for el in diagram.elements)

            # Include waypoints in bounds
            for conn in diagram.connectors:
                for wp in conn.waypoints:
                    min_x = min(min_x, wp.x)
                    min_y = min(min_y, wp.y)
                    max_x = max(max_x, wp.x)
                    max_y = max(max_y, wp.y)

            diag_w = max_x - min_x
            diag_h = max_y - min_y

            canvas_w = int((diag_w + 2 * padding) * scale)
            canvas_h = int((diag_h + 2 * padding) * scale)

            # Create image
            bg = (255, 255, 255, 255) if background_color == "#ffffff" else (0, 0, 0, 0)
            img = Image.new("RGBA", (canvas_w, canvas_h), bg)
            draw = ImageDraw.Draw(img)

            offset_x = -min_x + padding
            offset_y = -min_y + padding

            # Try loading a standard font
            try:
                font = ImageFont.truetype("arial.ttf", int(14 * scale))
                small_font = ImageFont.truetype("arial.ttf", int(11 * scale))
            except Exception:
                font = ImageFont.load_default()
                small_font = font

            element_map = {el.id: el for el in diagram.elements}

            # 1. Render Connectors first (underneath nodes)
            for conn in diagram.connectors:
                if conn.source_id not in element_map or conn.target_id not in element_map:
                    continue

                src_el = element_map[conn.source_id]
                tgt_el = element_map[conn.target_id]

                # Compute anchor points
                sx = (src_el.x + src_el.width / 2.0 + offset_x) * scale
                sy = (src_el.y + src_el.height + offset_y) * scale
                tx = (tgt_el.x + tgt_el.width / 2.0 + offset_x) * scale
                ty = (tgt_el.y + offset_y) * scale

                # If waypoints exist, connect through waypoints
                points = [(sx, sy)]
                for wp in conn.waypoints:
                    points.append(((wp.x + offset_x) * scale, (wp.y + offset_y) * scale))
                points.append((tx, ty))

                # Draw line segments
                stroke_color = (43, 58, 66, 255)
                line_w = int(max(1, 2 * scale))
                for idx in range(len(points) - 1):
                    draw.line([points[idx], points[idx + 1]], fill=stroke_color, width=line_w)

                # Draw Arrowhead at target
                if conn.direction in (ConnectorDirection.DIRECTED, ConnectorDirection.BIDIRECTIONAL):
                    last_seg_p1 = points[-2]
                    last_seg_p2 = points[-1]
                    angle = math.atan2(last_seg_p2[1] - last_seg_p1[1], last_seg_p2[0] - last_seg_p1[0])
                    cls._draw_arrowhead(draw, last_seg_p2, angle, scale)

                # Draw edge label if present
                if conn.label:
                    mid_idx = len(points) // 2
                    mx = (points[mid_idx - 1][0] + points[mid_idx][0]) / 2.0
                    my = (points[mid_idx - 1][1] + points[mid_idx][1]) / 2.0
                    draw.text((mx + 5, my - 15 * scale), conn.label, fill=(30, 41, 59, 255), font=small_font)

            # 2. Render Diagram Elements
            for el in diagram.elements:
                ex = int((el.x + offset_x) * scale)
                ey = int((el.y + offset_y) * scale)
                ew = int(el.width * scale)
                eh = int(el.height * scale)

                fill_color = (255, 255, 255, 255)
                border_color = (43, 58, 66, 255)
                border_w = int(max(1, 2 * scale))

                # Draw shape according to type
                if el.type == ElementType.DECISION:
                    # Diamond polygon: top, right, bottom, left
                    poly = [
                        (ex + ew // 2, ey),
                        (ex + ew, ey + eh // 2),
                        (ex + ew // 2, ey + eh),
                        (ex, ey + eh // 2)
                    ]
                    draw.polygon(poly, fill=fill_color, outline=border_color, width=border_w)
                elif el.type in (ElementType.TERMINAL, ElementType.ROUNDED_RECTANGLE):
                    r = int(min(ew, eh) * 0.45) if el.type == ElementType.TERMINAL else int(8 * scale)
                    draw.rounded_rectangle([ex, ey, ex + ew, ey + eh], radius=r, fill=fill_color, outline=border_color, width=border_w)
                elif el.type == ElementType.CIRCLE:
                    draw.ellipse([ex, ey, ex + ew, ey + eh], fill=fill_color, outline=border_color, width=border_w)
                elif el.type == ElementType.IO:
                    # Parallelogram
                    slant = int(ew * 0.15)
                    poly = [
                        (ex + slant, ey),
                        (ex + ew, ey),
                        (ex + ew - slant, ey + eh),
                        (ex, ey + eh)
                    ]
                    draw.polygon(poly, fill=fill_color, outline=border_color, width=border_w)
                else:
                    # Process rectangle
                    draw.rectangle([ex, ey, ex + ew, ey + eh], fill=fill_color, outline=border_color, width=border_w)

                # Draw text label centered
                if el.label:
                    text_bbox = draw.textbbox((0, 0), el.label, font=font)
                    tw = text_bbox[2] - text_bbox[0]
                    th = text_bbox[3] - text_bbox[1]
                    tx_pos = ex + (ew - tw) // 2
                    ty_pos = ey + (eh - th) // 2
                    draw.text((tx_pos, ty_pos), el.label, fill=(30, 41, 59, 255), font=font)

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue(), True, "PNG rendered successfully"
        except Exception as e:
            return b"", False, f"PNG render failed: {e}"

    @classmethod
    def _draw_arrowhead(cls, draw: ImageDraw.ImageDraw, tip: Tuple[float, float], angle: float, scale: float):
        arrow_len = 12 * scale
        arrow_spread = math.pi / 6
        p1 = (
            tip[0] - arrow_len * math.cos(angle - arrow_spread),
            tip[1] - arrow_len * math.sin(angle - arrow_spread)
        )
        p2 = (
            tip[0] - arrow_len * math.cos(angle + arrow_spread),
            tip[1] - arrow_len * math.sin(angle + arrow_spread)
        )
        draw.polygon([tip, p1, p2], fill=(43, 58, 66, 255))
