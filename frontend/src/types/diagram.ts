export type ElementType =
  | 'terminal'
  | 'process'
  | 'decision'
  | 'io'
  | 'predefined'
  | 'document'
  | 'database'
  | 'rectangle'
  | 'rounded_rectangle'
  | 'diamond'
  | 'ellipse'
  | 'circle'
  | 'text_block'
  | 'bar'
  | 'slice'
  | 'axis'
  | 'actor'
  | 'participant'
  | 'class_box'
  | 'note';

export type DiagramFamily = 'flowchart' | 'chart' | 'uml' | 'generic';

export type ConnectorDirection = 'directed' | 'bidirectional' | 'undirected';

export type ConnectorStyle = 'straight' | 'orthogonal' | 'curved';

export type UncertaintyStatus = 'likely_correct' | 'needs_review' | 'uncertain' | 'unsupported';

export type IssueSeverity = 'info' | 'warning' | 'error';

export type IssueCategory =
  | 'text'
  | 'shape'
  | 'connector'
  | 'direction'
  | 'chart'
  | 'export'
  | 'structural';

export interface Point {
  x: number;
  y: number;
}

export interface ElementStyle {
  fill: string;
  stroke: string;
  stroke_width: number;
  text_color: string;
  font_size: number;
  text_align: string;
  is_dashed: boolean;
  corner_radius: number;
}

export interface DiagramElement {
  id: string;
  type: ElementType;
  role?: string;
  label: string;
  raw_text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: ElementStyle;
  confidence: number;
  uncertainty_status: UncertaintyStatus;
  source_box?: [number, number, number, number];
  provenance: Record<string, any>;
  locked?: boolean;
}

export interface ConnectorStyleProps {
  stroke: string;
  stroke_width: number;
  arrow_head: string;
  is_dashed: boolean;
}

export interface DiagramConnector {
  id: string;
  source_id: string;
  target_id: string;
  source_handle?: string;
  target_handle?: string;
  label: string;
  direction: ConnectorDirection;
  routing: ConnectorStyle;
  waypoints: Point[];
  style: ConnectorStyleProps;
  confidence: number;
  uncertainty_status: UncertaintyStatus;
  provenance: Record<string, any>;
}

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface ChartData {
  chart_type: string;
  title: string;
  x_axis_label: string;
  y_axis_label: string;
  categories: string[];
  series: ChartSeries[];
  is_estimated: boolean;
  confidence: number;
}

export interface ValidationIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  element_id?: string;
  connector_id?: string;
  message: string;
  suggested_action: string;
}

export interface ExportCapability {
  mermaid: boolean;
  mermaid_notes?: string;
  plantuml: boolean;
  plantuml_notes?: string;
  json: boolean;
  png: boolean;
}

export interface CanonicalDiagram {
  schema_version: string;
  id: string;
  project_id: string;
  name: string;
  family: DiagramFamily;
  subtype: string;
  source_file_name?: string;
  source_region_id?: string;
  source_dimensions: { width: number; height: number };
  elements: DiagramElement[];
  connectors: DiagramConnector[];
  chart_data?: ChartData;
  validation_issues: ValidationIssue[];
  export_capabilities: ExportCapability;
  created_at: number;
  updated_at: number;
  version: number;
}

export interface DiagramRegion {
  id: string;
  file_name: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  suggested_type: DiagramFamily;
  suggested_subtype: string;
  label: string;
  selected: boolean;
  is_manual_crop: boolean;
}

export interface VersionSnapshot {
  id: string;
  version_number: number;
  label: string;
  description: string;
  origin: string;
  timestamp: number;
  diagram: CanonicalDiagram;
  thumbnail_data?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  source_files: string[];
  diagram_count: number;
  active_diagram_id?: string;
  last_export_format?: string;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  diagrams: Record<string, CanonicalDiagram>;
  history: Record<string, VersionSnapshot[]>;
  regions: DiagramRegion[];
}
