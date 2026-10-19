import React from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  ElementType,
  ConnectorDirection,
  ConnectorStyle
} from '../../types/diagram';
import { Trash2, Lock, Unlock, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

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
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  diagram,
  selectedElementId,
  selectedConnectorId,
  onUpdateElement,
  onDeleteElement,
  onUpdateConnector,
  onDeleteConnector,
  onUpdateDiagramName,
  onFocusIssueElement
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
                onChange={(e) => onUpdateElement({ ...selectedElement, width: Math.max(40, parseFloat(e.target.value) || 40) })}
              />
            </div>
            <div className="inspector-field">
              <label className="field-label">Height</label>
              <input
                type="number"
                className="field-input"
                value={selectedElement.height}
                onChange={(e) => onUpdateElement({ ...selectedElement, height: Math.max(30, parseFloat(e.target.value) || 30) })}
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

  // 2. Connector Inspector
  if (selectedConnector) {
    return (
      <aside className="property-inspector">
        <div className="inspector-header">
          <span className="inspector-title">Connector Properties</span>
          <button
            className="btn-icon"
            onClick={() => onDeleteConnector(selectedConnector.id)}
            title="Delete Connector"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="inspector-body">
          <div className="inspector-field">
            <label className="field-label">Branch / Edge Label</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Yes, No, True"
              value={selectedConnector.label}
              onChange={(e) => onUpdateConnector({ ...selectedConnector, label: e.target.value })}
            />
          </div>

          <div className="inspector-field">
            <label className="field-label">Direction</label>
            <select
              className="field-input"
              value={selectedConnector.direction}
              onChange={(e) => onUpdateConnector({ ...selectedConnector, direction: e.target.value as ConnectorDirection })}
            >
              <option value="directed">Directed (Source → Target)</option>
              <option value="bidirectional">Bidirectional (Source ↔ Target)</option>
              <option value="undirected">Undirected (Line)</option>
            </select>
          </div>

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

  // 3. Diagram Overview Inspector
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
