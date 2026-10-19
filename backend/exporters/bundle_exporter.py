"""
ODR Bundle Exporter.
Creates a complete ZIP archive bundle containing JSON, Mermaid, PlantUML,
rendered PNG, and a manifest.json file.
"""

import io
import json
import zipfile
import time
from typing import Tuple
from backend.core.models import CanonicalDiagram
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter
from backend.exporters.json_exporter import JSONExporter
from backend.exporters.png_exporter import PNGExporter


class BundleExporter:
    """Exports an entire diagram package as a structured ZIP file."""

    @classmethod
    def export_zip(cls, diagram: CanonicalDiagram) -> Tuple[bytes, bool, str]:
        try:
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                # 1. Canonical JSON
                json_str, _, _ = JSONExporter.export(diagram)
                zf.writestr(f"{diagram.id}/diagram.json", json_str)

                # 2. Mermaid code
                mmd_str, _, mmd_warn = MermaidExporter.export(diagram)
                zf.writestr(f"{diagram.id}/diagram.mmd", mmd_str)

                # 3. PlantUML code
                puml_str, _, puml_warn = PlantUMLExporter.export(diagram)
                zf.writestr(f"{diagram.id}/diagram.puml", puml_str)

                # 4. Rendered PNG
                png_bytes, _, png_warn = PNGExporter.export(diagram)
                if png_bytes:
                    zf.writestr(f"{diagram.id}/diagram.png", png_bytes)

                # 5. Manifest JSON
                manifest = {
                    "schema_version": diagram.schema_version,
                    "diagram_id": diagram.id,
                    "diagram_name": diagram.name,
                    "family": diagram.family.value,
                    "subtype": diagram.subtype,
                    "element_count": len(diagram.elements),
                    "connector_count": len(diagram.connectors),
                    "validation_issues_count": len(diagram.validation_issues),
                    "export_timestamp": time.time(),
                    "exported_files": [
                        "diagram.json",
                        "diagram.mmd",
                        "diagram.puml",
                        "diagram.png",
                        "manifest.json"
                    ]
                }
                zf.writestr(f"{diagram.id}/manifest.json", json.dumps(manifest, indent=2))

            return buf.getvalue(), True, "Bundle exported successfully"
        except Exception as e:
            return b"", False, f"ZIP export failed: {e}"
