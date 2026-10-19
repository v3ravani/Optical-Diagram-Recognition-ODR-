import React from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  ElementType,
  ConnectorDirection,
  ConnectorStyle,
  ChartData
} from '../../types/diagram';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Plus,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';

interface PropertyInspectorProps {
  diagram: CanonicalDiagram;
  selectedElementId: string | null;
  selectedConnectorId: string | null;
  onUpdateElement: (updated: DiagramElement) => void;
  onDeleteElement: (id: string) => void;
  onUpdateConnector: (updated: DiagramConnector) => void;
  onDeleteConnector: (id: string) => void;
  onUpdateDiagramName: (name: string) => void;
  onFocusIssueElement: (elementId: string) => void;
  onUpdateChartData?: (chartData: ChartData) => void;
}

const DEFAULT_CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
];

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  diagram,
  selectedElementId,
  selectedConnectorId,
  onUpdateElement,
  onDeleteElement,
  onUpdateConnector,
  onDeleteConnector,
  onUpdateDiagramName,
  onFocusIssueElement,
  onUpdateChartData
}) => {
  const selectedElement = diagram.elements.find((el) => el.id === selectedElementId);
  const selectedConnector = diagram.connectors.find((c) => c.id === selectedConnectorId);

  // 1. Element Inspector
  if (selectedElement) {
    return (
      <aside className="property-inspector">
        <div className="inspector-header">
          <span className="inspector-title">Node Properties</span>
          <button
            className="btn-icon"
            onClick={() => onDeleteElement(selectedElement.id)}
            title="Delete Node (Del)"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="inspector-body">
          {/* Confidence Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor:
                selectedElement.uncertainty_status === 'likely_correct'
                  ? 'var(--color-success-bg)'
                  : 'var(--color-warning-bg)',
              color:
                selectedElement.uncertainty_status === 'likely_correct'
                  ? 'var(--color-success)'
                  : 'var(--color-warning)',
              border: '1px solid currentColor'
            }}
          >
            <span>Confidence: {Math.round(selectedElement.confidence * 100)}%</span>
            <span>{selectedElement.uncertainty_status.replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="inspector-field">
            <label className="field-label">Label Text</label>
            <textarea
              className="field-input"
              rows={2}
              value={selectedElement.label}
              onChange={(e) => onUpdateElement({ ...selectedElement, label: e.target.value })}
            />
          </div>

          <div className="inspector-field">
            <label className="field-label">Shape Type</label>
            <select
              className="field-input"
              value={selectedElement.type}
              onChange={(e) => onUpdateElement({ ...selectedElement, type: e.target.value as ElementType })}
            >
              <option value="process">Process (Rectangle)</option>
              <option value="terminal">Start / End (Pill)</option>
              <option value="decision">Decision (Diamond)</option>
              <option value="io">Input / Output (Parallelogram)</option>
              <option value="database">Database (Cylinder)</option>
              <option value="circle">Circle Pin</option>
              <option value="text_block">Text Box</option>
            </select>
          </div>

          <div className="field-row">
            <div className="inspector-field">
              <label className="field-label">X Position</label>
              <input
                type="number"
                className="field-input"
                value={selectedElement.x}
                onChange={(e) => onUpdateElement({ ...selectedElement, x: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="inspector-field">
              <label className="field-label">Y Position</label>
              <input
                type="number"
                className="field-input"
                value={selectedElement.y}
                onChange={(e) => onUpdateElement({ ...selectedElement, y: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="inspector-field">
              <label className="field-label">Width</label>
              <input
                type="number"
                className="field-input"
                value={selectedElement.width}
                onChange={(e) => onUpdateElement({ ...selectedElement, width: Math.max(20, parseFloat(e.target.value) || 20) })}
              />
            </div>
            <div className="inspector-field">
              <label className="field-label">Height</label>
              <input
                type="number"
                className="field-input"
                value={selectedElement.height}
                onChange={(e) => onUpdateElement({ ...selectedElement, height: Math.max(20, parseFloat(e.target.value) || 20) })}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="inspector-field">
              <label className="field-label">Fill Color</label>
              <input
                type="color"
                className="field-input"
                style={{ padding: '2px 4px', height: '32px' }}
                value={selectedElement.style.fill}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    style: { ...selectedElement.style, fill: e.target.value }
                  })
                }
              />
            </div>
            <div className="inspector-field">
              <label className="field-label">Border Color</label>
              <input
                type="color"
                className="field-input"
                style={{ padding: '2px 4px', height: '32px' }}
                value={selectedElement.style.stroke}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    style: { ...selectedElement.style, stroke: e.target.value }
                  })
                }
              />
            </div>
          </div>

          <div className="inspector-field">
            <label className="field-label">Node ID</label>
            <input type="text" className="field-input" value={selectedElement.id} disabled style={{ background: 'var(--bg-subtle)' }} />
          </div>
        </div>
      </aside>
    );
  }

  // 2. Connector / Arrow Inspector
  if (selectedConnector) {
    const handleSwapDirection = () => {
      onUpdateConnector({
        ...selectedConnector,
        source_id: selectedConnector.target_id,
        target_id: selectedConnector.source_id
      });
    };

    return (
      <aside className="property-inspector">
        <div className="inspector-header">
          <span className="inspector-title">Arrow / Connector</span>
          <button
            className="btn-icon"
            onClick={() => onDeleteConnector(selectedConnector.id)}
            title="Delete Connector (Del)"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="inspector-body">
          <div className="inspector-field">
            <label className="field-label">Branch Label (e.g. Yes / No)</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Yes, No, True, Retry"
              value={selectedConnector.label}
              onChange={(e) => onUpdateConnector({ ...selectedConnector, label: e.target.value })}
            />
          </div>

          <div className="inspector-field">
            <label className="field-label">Direction</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                className="field-input"
                style={{ flex: 1 }}
                value={selectedConnector.direction}
                onChange={(e) => onUpdateConnector({ ...selectedConnector, direction: e.target.value as ConnectorDirection })}
              >
                <option value="directed">Directed (→)</option>
                <option value="bidirectional">Bidirectional (↔)</option>
                <option value="undirected">Undirected (—)</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0 8px' }}
                onClick={handleSwapDirection}
                title="Reverse Direction (Swap Source & Target)"
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>
          </div>

          <div className="field-row">
            <div className="inspector-field">
              <label className="field-label">Routing Style</label>
              <select
                className="field-input"
                value={selectedConnector.routing}
                onChange={(e) => onUpdateConnector({ ...selectedConnector, routing: e.target.value as ConnectorStyle })}
              >
                <option value="orthogonal">Orthogonal</option>
                <option value="straight">Straight</option>
              </select>
            </div>
            <div className="inspector-field">
              <label className="field-label">Line Style</label>
              <select
                className="field-input"
                value={selectedConnector.style.is_dashed ? 'dashed' : 'solid'}
                onChange={(e) =>
                  onUpdateConnector({
                    ...selectedConnector,
                    style: { ...selectedConnector.style, is_dashed: e.target.value === 'dashed' }
                  })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="inspector-field">
              <label className="field-label">Arrow Color</label>
              <input
                type="color"
                className="field-input"
                style={{ padding: '2px 4px', height: '32px' }}
                value={selectedConnector.style.stroke}
                onChange={(e) =>
                  onUpdateConnector({
                    ...selectedConnector,
                    style: { ...selectedConnector.style, stroke: e.target.value }
                  })
                }
              />
            </div>
            <div className="inspector-field">
              <label className="field-label">Stroke Width</label>
              <select
                className="field-input"
                value={selectedConnector.style.stroke_width}
                onChange={(e) =>
                  onUpdateConnector({
                    ...selectedConnector,
                    style: { ...selectedConnector.style, stroke_width: parseFloat(e.target.value) || 2 }
                  })
                }
              >
                <option value="1.5">1.5px (Thin)</option>
                <option value="2">2px (Default)</option>
                <option value="3">3px (Thick)</option>
                <option value="4">4px (Bold)</option>
              </select>
            </div>
          </div>

          <div className="inspector-field">
            <label className="field-label">Source Node</label>
            <select
              className="field-input"
              value={selectedConnector.source_id}
              onChange={(e) => onUpdateConnector({ ...selectedConnector, source_id: e.target.value })}
            >
              {diagram.elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label ? `${el.label} (${el.id})` : el.id}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-field">
            <label className="field-label">Target Node</label>
            <select
              className="field-input"
              value={selectedConnector.target_id}
              onChange={(e) => onUpdateConnector({ ...selectedConnector, target_id: e.target.value })}
            >
              {diagram.elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label ? `${el.label} (${el.id})` : el.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>
    );
  }

  // 3. Chart Editor Inspector (If diagram is chart family or has chart_data)
  if (diagram.chart_data || diagram.family === 'chart') {
    const cd = diagram.chart_data || {
      chart_type: 'bar',
      title: 'Data Chart',
      x_axis_label: 'Categories',
      y_axis_label: 'Values',
      categories: ['A', 'B', 'C'],
      series: [{ name: 'Series 1', values: [10, 25, 15], color: '#3b82f6' }],
      is_estimated: true,
      confidence: 0.9
    };

    const handleUpdateTitle = (title: string) => {
      if (onUpdateChartData) {
        onUpdateChartData({ ...cd, title });
      }
    };

    const handleUpdateType = (chart_type: 'bar' | 'pie') => {
      if (onUpdateChartData) {
        onUpdateChartData({ ...cd, chart_type });
      }
    };

    const handleUpdateCategory = (idx: number, name: string) => {
      const updatedCats = [...cd.categories];
      updatedCats[idx] = name;
      if (onUpdateChartData) {
        onUpdateChartData({ ...cd, categories: updatedCats });
      }
    };

    const handleUpdateValue = (idx: number, val: number) => {
      const s0 = cd.series[0] || { name: 'Series 1', values: [], color: '#3b82f6' };
      const updatedVals = [...s0.values];
      updatedVals[idx] = val;
      if (onUpdateChartData) {
        onUpdateChartData({
          ...cd,
          series: [{ ...s0, values: updatedVals }]
        });
      }
    };

    const handleDeleteItem = (idx: number) => {
      const updatedCats = cd.categories.filter((_, i) => i !== idx);
      const s0 = cd.series[0] || { name: 'Series 1', values: [], color: '#3b82f6' };
      const updatedVals = s0.values.filter((_, i) => i !== idx);
      if (onUpdateChartData) {
        onUpdateChartData({
          ...cd,
          categories: updatedCats,
          series: [{ ...s0, values: updatedVals }]
        });
      }
    };

    const handleAddItem = () => {
      const newIdx = cd.categories.length + 1;
      const updatedCats = [...cd.categories, `Item ${newIdx}`];
      const s0 = cd.series[0] || { name: 'Series 1', values: [], color: '#3b82f6' };
      const updatedVals = [...s0.values, 20.0];
      if (onUpdateChartData) {
        onUpdateChartData({
          ...cd,
          categories: updatedCats,
          series: [{ ...s0, values: updatedVals }]
        });
      }
    };

    const s0Values = cd.series[0]?.values || [];

    return (
      <aside className="property-inspector">
        <div className="inspector-header">
          <span className="inspector-title">Chart Editor</span>
        </div>

        <div className="inspector-body">
          {/* Chart Type Toggle */}
          <div className="inspector-field">
            <label className="field-label">Chart Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className={`btn ${cd.chart_type === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px' }}
                onClick={() => handleUpdateType('bar')}
              >
                <BarChart3 size={14} /> Bar Graph
              </button>
              <button
                type="button"
                className={`btn ${cd.chart_type === 'pie' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px' }}
                onClick={() => handleUpdateType('pie')}
              >
                <PieIcon size={14} /> Pie Chart
              </button>
            </div>
          </div>

          <div className="inspector-field">
            <label className="field-label">Chart Title</label>
            <input
              type="text"
              className="field-input"
              value={cd.title || ''}
              onChange={(e) => handleUpdateTitle(e.target.value)}
              placeholder="e.g. Market Share or Monthly Sales"
            />
          </div>

          {cd.chart_type === 'bar' && (
            <div className="field-row">
              <div className="inspector-field">
                <label className="field-label">X-Axis Label</label>
                <input
                  type="text"
                  className="field-input"
                  value={cd.x_axis_label || ''}
                  onChange={(e) => onUpdateChartData && onUpdateChartData({ ...cd, x_axis_label: e.target.value })}
                />
              </div>
              <div className="inspector-field">
                <label className="field-label">Y-Axis Label</label>
                <input
                  type="text"
                  className="field-input"
                  value={cd.y_axis_label || ''}
                  onChange={(e) => onUpdateChartData && onUpdateChartData({ ...cd, y_axis_label: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Slices / Categories Data Table */}
          <div className="inspector-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="field-label" style={{ margin: 0 }}>
                {cd.chart_type === 'pie' ? 'Slices & Proportions' : 'Bars & Values'}
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                onClick={handleAddItem}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
              {cd.categories.map((cat, idx) => {
                const val = s0Values[idx] ?? 0;
                const color = DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length];

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        background: color,
                        flexShrink: 0
                      }}
                    />
                    <input
                      type="text"
                      className="field-input"
                      style={{ flex: 2, padding: '4px', fontSize: '12px' }}
                      value={cat}
                      onChange={(e) => handleUpdateCategory(idx, e.target.value)}
                    />
                    <input
                      type="number"
                      className="field-input"
                      style={{ flex: 1, padding: '4px', fontSize: '12px', textAlign: 'right' }}
                      value={val}
                      onChange={(e) => handleUpdateValue(idx, parseFloat(e.target.value) || 0)}
                    />
                    {cd.chart_type === 'pie' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>}
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ color: 'var(--color-error)', padding: '2px' }}
                      onClick={() => handleDeleteItem(idx)}
                      title="Delete Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 4. Default: Diagram Overview Inspector
  return (
    <aside className="property-inspector">
      <div className="inspector-header">
        <span className="inspector-title">Diagram Overview</span>
      </div>

      <div className="inspector-body">
        <div className="inspector-field">
          <label className="field-label">Diagram Name</label>
          <input
            type="text"
            className="field-input"
            value={diagram.name}
            onChange={(e) => onUpdateDiagramName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="inspector-field">
            <label className="field-label">Nodes</label>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{diagram.elements.length}</div>
          </div>
          <div className="inspector-field">
            <label className="field-label">Connectors</label>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{diagram.connectors.length}</div>
          </div>
        </div>

        {/* Validation Issues list */}
        <div className="inspector-field" style={{ marginTop: '8px' }}>
          <label className="field-label">
            Validation Issues ({diagram.validation_issues.length})
          </label>
          {diagram.validation_issues.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0' }}>
              <CheckCircle2 size={15} /> All structural checks passed!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
              {diagram.validation_issues.map((iss) => (
                <div
                  key={iss.id}
                  onClick={() => iss.element_id && onFocusIssueElement(iss.element_id)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: iss.severity === 'error' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                    cursor: iss.element_id ? 'pointer' : 'default',
                    fontSize: '11px'
                  }}
                  title={iss.suggested_action}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: iss.severity === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                    <AlertTriangle size={12} />
                    <span>{iss.category.toUpperCase()}: {iss.message}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Tip: {iss.suggested_action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
