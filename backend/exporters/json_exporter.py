"""
ODR Canonical JSON Exporter.
Serializes CanonicalDiagram model to formatted JSON according to the PRD schema.
"""

import json
from typing import Tuple
from backend.core.models import CanonicalDiagram


class JSONExporter:
    """Exports CanonicalDiagram into standard versioned JSON."""

    @classmethod
    def export(cls, diagram: CanonicalDiagram) -> Tuple[str, bool, str]:
        try:
            data = diagram.model_dump()
            formatted = json.dumps(data, indent=2)
            return formatted, True, "Canonical JSON exported successfully"
        except Exception as e:
            return "{}", False, f"JSON export error: {e}"
