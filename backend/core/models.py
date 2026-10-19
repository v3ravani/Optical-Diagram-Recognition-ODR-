"""
ODR Canonical Diagram Models and Schemas (PRD Version 2.0).
Provides stable ID tracking, type-aware elements, connectors, chart data,
validation issues, project structures, and version history snapshots.
"""

from __future__ import annotations
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
import uuid
import time


class ElementType(str, Enum):
    # Flowchart / Process
    TERMINAL = "terminal"            # Start / End / Oval / Rounded rect
    PROCESS = "process"              # Action / Step / Rectangle
    DECISION = "decision"            # Condition / Diamond
    IO = "io"                        # Input / Output / Parallelogram
    PREDEFINED_PROCESS = "predefined"# Subroutine / Double-bordered box
    DOCUMENT = "document"            # Report / Wave bottom
    DATABASE = "database"            # Cylinder / Storage
    
    # Generic shapes
    RECTANGLE = "rectangle"
    ROUNDED_RECTANGLE = "rounded_rectangle"
    DIAMOND = "diamond"
    ELLIPSE = "ellipse"
    CIRCLE = "circle"
    TEXT_BLOCK = "text_block"
    
    # Chart elements
    BAR = "bar"
    SLICE = "slice"
    AXIS = "axis"
    
    # UML / Architecture
    ACTOR = "actor"
    PARTICIPANT = "participant"
    CLASS_BOX = "class_box"
    NOTE = "note"

    # DFD (Data Flow Diagram)
    EXTERNAL_ENTITY = "external_entity"
    DATA_STORE = "data_store"
    DATA_FLOW = "data_flow"

    # Sequence Diagram
    LIFELINE = "lifeline"
    ACTIVATION = "activation"
    MESSAGE = "message"
    RETURN_MESSAGE = "return_message"

    # ERD (Entity-Relationship Diagram)
    ENTITY = "entity"
    ATTRIBUTE = "attribute"
    RELATIONSHIP = "relationship"
    KEY_ATTRIBUTE = "key_attribute"


class DiagramFamily(str, Enum):
    FLOWCHART = "flowchart"
    DFD = "dfd"
    SEQUENCE = "sequence"
    ERD = "erd"
    BAR_CHART = "bar_chart"
    PIE_CHART = "pie_chart"
    CHART = "chart"      # Backwards compatibility alias
    UML = "uml"          # Backwards compatibility alias
    GENERIC = "generic"


class ConnectorDirection(str, Enum):
    DIRECTED = "directed"            # Source -> Target
    BIDIRECTIONAL = "bidirectional"  # Source <-> Target
    UNDIRECTED = "undirected"        # Source --- Target


class ConnectorStyle(str, Enum):
    STRAIGHT = "straight"
    ORTHOGONAL = "orthogonal"
    CURVED = "curved"


class UncertaintyStatus(str, Enum):
    LIKELY_CORRECT = "likely_correct"
    NEEDS_REVIEW = "needs_review"
    UNCERTAIN = "uncertain"
    UNSUPPORTED = "unsupported"


class IssueSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class IssueCategory(str, Enum):
    TEXT = "text"
    SHAPE = "shape"
    CONNECTOR = "connector"
    DIRECTION = "direction"
    CHART = "chart"
    EXPORT = "export"
    STRUCTURAL = "structural"


class Point(BaseModel):
    x: float
    y: float


class ElementStyle(BaseModel):
    fill: str = "#ffffff"
    stroke: str = "#2b3a42"
    stroke_width: float = 2.0
    text_color: str = "#1e293b"
    font_size: int = 14
    text_align: str = "center"
    is_dashed: bool = False
    corner_radius: float = 4.0


class DiagramElement(BaseModel):
    id: str = Field(default_factory=lambda: f"node_{uuid.uuid4().hex[:8]}")
    type: ElementType = ElementType.PROCESS
    role: Optional[str] = "process"  # start, end, decision, process, io
    label: str = ""
    raw_text: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    width: float = 140.0
    height: float = 70.0
    style: ElementStyle = Field(default_factory=ElementStyle)
    confidence: float = 1.0
    uncertainty_status: UncertaintyStatus = UncertaintyStatus.LIKELY_CORRECT
    source_box: Optional[List[float]] = None  # [x, y, w, h] in image pixels
    provenance: Dict[str, Any] = Field(default_factory=dict)
    locked: bool = False


class ConnectorStyleProps(BaseModel):
    stroke: str = "#2b3a42"
    stroke_width: float = 2.0
    arrow_head: str = "classic"  # classic, filled, none
    is_dashed: bool = False


class DiagramConnector(BaseModel):
    id: str = Field(default_factory=lambda: f"conn_{uuid.uuid4().hex[:8]}")
    source_id: str
    target_id: str
    source_handle: Optional[str] = "auto"  # top, bottom, left, right, auto
    target_handle: Optional[str] = "auto"
    label: str = ""
    direction: ConnectorDirection = ConnectorDirection.DIRECTED
    routing: ConnectorStyle = ConnectorStyle.ORTHOGONAL
    waypoints: List[Point] = Field(default_factory=list)
    style: ConnectorStyleProps = Field(default_factory=ConnectorStyleProps)
    confidence: float = 1.0
    uncertainty_status: UncertaintyStatus = UncertaintyStatus.LIKELY_CORRECT
    provenance: Dict[str, Any] = Field(default_factory=dict)


class ChartSeries(BaseModel):
    name: str = "Series 1"
    values: List[float] = Field(default_factory=list)
    color: Optional[str] = "#3b82f6"


class ChartData(BaseModel):
    chart_type: str = "bar"  # bar, pie, line
    title: str = ""
    x_axis_label: str = ""
    y_axis_label: str = ""
    categories: List[str] = Field(default_factory=list)
    series: List[ChartSeries] = Field(default_factory=list)
    is_estimated: bool = False
    confidence: float = 1.0


class ValidationIssue(BaseModel):
    id: str = Field(default_factory=lambda: f"iss_{uuid.uuid4().hex[:8]}")
    category: IssueCategory = IssueCategory.STRUCTURAL
    severity: IssueSeverity = IssueSeverity.WARNING
    element_id: Optional[str] = None
    connector_id: Optional[str] = None
    message: str
    suggested_action: str


class ExportCapability(BaseModel):
    mermaid: bool = True
    mermaid_notes: Optional[str] = None
    plantuml: bool = True
    plantuml_notes: Optional[str] = None
    canonical_json: bool = Field(default=True, alias="json")
    png: bool = True


class CanonicalDiagram(BaseModel):
    schema_version: str = "2.0"
    id: str = Field(default_factory=lambda: f"diag_{uuid.uuid4().hex[:8]}")
    project_id: str = "default_project"
    name: str = "Untitled Diagram"
    family: DiagramFamily = DiagramFamily.FLOWCHART
    subtype: str = "standard_flowchart"
    source_file_name: Optional[str] = None
    source_region_id: Optional[str] = None
    source_dimensions: Dict[str, int] = Field(default_factory=lambda: {"width": 1200, "height": 900})
    elements: List[DiagramElement] = Field(default_factory=list)
    connectors: List[DiagramConnector] = Field(default_factory=list)
    chart_data: Optional[ChartData] = None
    validation_issues: List[ValidationIssue] = Field(default_factory=list)
    export_capabilities: ExportCapability = Field(default_factory=ExportCapability)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    version: int = 1


class DiagramRegion(BaseModel):
    id: str = Field(default_factory=lambda: f"reg_{uuid.uuid4().hex[:6]}")
    file_name: str
    page_number: int = 1
    x: int
    y: int
    width: int
    height: int
    confidence: float = 0.95
    suggested_type: DiagramFamily = DiagramFamily.FLOWCHART
    suggested_subtype: str = "flowchart"
    label: str = "Diagram Candidate"
    selected: bool = True
    is_manual_crop: bool = False


class VersionSnapshot(BaseModel):
    id: str = Field(default_factory=lambda: f"v_{uuid.uuid4().hex[:8]}")
    version_number: int
    label: str
    description: str
    origin: str = "user_edit"  # recognition, user_edit, auto_layout, checkpoint, restore
    timestamp: float = Field(default_factory=time.time)
    diagram: CanonicalDiagram
    thumbnail_data: Optional[str] = None  # Base64 thumbnail if available


class ProjectMetadata(BaseModel):
    id: str = Field(default_factory=lambda: f"proj_{uuid.uuid4().hex[:8]}")
    name: str = "New Project"
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    source_files: List[str] = Field(default_factory=list)
    diagram_count: int = 0
    active_diagram_id: Optional[str] = None
    last_export_format: Optional[str] = None


class ProjectData(BaseModel):
    metadata: ProjectMetadata
    diagrams: Dict[str, CanonicalDiagram] = Field(default_factory=dict)
    history: Dict[str, List[VersionSnapshot]] = Field(default_factory=dict)  # diagram_id -> snapshots
    regions: List[DiagramRegion] = Field(default_factory=list)
