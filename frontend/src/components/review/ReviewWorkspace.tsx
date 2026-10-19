import React, { useState } from 'react';
import { CanonicalDiagram, DiagramElement, ValidationIssue } from '../../types/diagram';
import {
  Columns,
  Image as ImageIcon,
  Layout,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Edit3
} from 'lucide-react';

interface ReviewWorkspaceProps {
  diagram: CanonicalDiagram;
  sourcePreviewUrl?: string;
  onContinueToEditor: () => void;
  onUpdateElementLabel: (elementId: string, newLabel: string) => void;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({
  diagram,
  sourcePreviewUrl,
  onContinueToEditor,
  onUpdateElementLabel
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'source' | 'reconstructed'>('side-by-side');
  const [activeElementId, setActiveElementId] = useState<string | null>(
    diagram.elements.length > 0 ? diagram.elements[0].id : null
  );
  const [activeIssueIndex, setActiveIssueIndex] = useState(0);

  const activeElement = diagram.elements.find((el) => el.id === activeElementId);
  const issues = diagram.validation_issues;

  const navigateIssue = (direction: 'next' | 'prev') => {
    if (issues.length === 0) return;
    let nextIdx = direction === 'next' ? activeIssueIndex + 1 : activeIssueIndex - 1;
    if (nextIdx >= issues.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = issues.length - 1;
    setActiveIssueIndex(nextIdx);

    const issue = issues[nextIdx];
    if (issue.element_id) {
      setActiveElementId(issue.element_id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'var(--bg-app)' }}>
      {/* Top Header */}
      <div
        style={{
          height: '48px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Recognition Verification & Review</span>
          <span style={{ fontSize: '11px', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {diagram.family.toUpperCase()}
          </span>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-subtle)', padding: '2px', borderRadius: '6px' }}>
          <button
            className={`btn-icon ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            title="Side-by-side comparison"
          >
            <Columns size={15} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'source' ? 'active' : ''}`}
            onClick={() => setViewMode('source')}
            title="Source Image Only"
          >
            <ImageIcon size={15} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'reconstructed' ? 'active' : ''}`}
            onClick={() => setViewMode('reconstructed')}
            title="Reconstructed Diagram Only"
          >
            <Layout size={15} />
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={onContinueToEditor}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '13px' }}
        >
          <span>Continue to Editor</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Side: Source Image */}
        {(viewMode === 'side-by-side' || viewMode === 'source') && (
          <div
            style={{
              flex: 1,
              background: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              borderRight: '1px solid var(--border-subtle)',
              position: 'relative',
              overflow: 'auto'
            }}
          >
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              {sourcePreviewUrl ? (
                <img
                  src={sourcePreviewUrl}
                  alt="Source"
                  style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: 'white', fontSize: '13px' }}>Source preview loaded in session</div>
              )}

              {/* Highlight active element bounding box on source image */}
              {activeElement && activeElement.source_box && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${activeElement.source_box[0]}px`,
                    top: `${activeElement.source_box[1]}px`,
                    width: `${activeElement.source_box[2]}px`,
                    height: `${activeElement.source_box[3]}px`,
                    border: '3px solid #f59e0b',
                    boxShadow: '0 0 12px rgba(245, 158, 11, 0.8)',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>
            <span style={{ position: 'absolute', bottom: '12px', left: '16px', color: '#94a3b8', fontSize: '11px' }}>
              Source Image Overlay
            </span>
          </div>
        )}

        {/* Center / Right Side: Reconstructed Diagram Elements */}
        {(viewMode === 'side-by-side' || viewMode === 'reconstructed') && (
          <div
            style={{
              flex: 1,
              background: 'var(--bg-canvas)',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {diagram.elements.map((el) => {
                const isActive = el.id === activeElementId;
                return (
                  <div
                    key={el.id}
                    onClick={() => setActiveElementId(el.id)}
                    style={{
                      width: '180px',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {el.type.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: el.confidence >= 0.85 ? 'var(--color-success)' : 'var(--color-warning)'
                        }}
                      >
                        {Math.round(el.confidence * 100)}%
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', minHeight: '36px' }}>
                      {el.label || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Empty label</span>}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      ID: {el.id}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Sidebar: Issues & Quick Correction */}
        <aside
          style={{
            width: '320px',
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Active Element Inspector / Quick Edit */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Selected Element Correction
            </span>

            {activeElement ? (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{activeElement.id}</div>
                <div className="inspector-field">
                  <label className="field-label">Correct Label</label>
                  <input
                    type="text"
                    className="field-input"
                    value={activeElement.label}
                    onChange={(e) => onUpdateElementLabel(activeElement.id, e.target.value)}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Type: <strong>{activeElement.type}</strong> | Role: <strong>{activeElement.role}</strong>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Click any element to verify its OCR text and bounding box.
              </div>
            )}
          </div>

          {/* Validation Issues & Guided Resolution */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Issues ({issues.length})
              </span>
              {issues.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button className="btn-icon" onClick={() => navigateIssue('prev')} title="Previous issue">
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>
                    {activeIssueIndex + 1}/{issues.length}
                  </span>
                  <button className="btn-icon" onClick={() => navigateIssue('next')} title="Next issue">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {issues.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '12px', padding: '12px 0' }}>
                <CheckCircle2 size={16} />
                <span>Zero structural issues flagged!</span>
              </div>
            ) : (
              issues.map((iss, idx) => (
                <div
                  key={iss.id}
                  onClick={() => {
                    setActiveIssueIndex(idx);
                    if (iss.element_id) setActiveElementId(iss.element_id);
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: idx === activeIssueIndex ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: iss.severity === 'error' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: iss.severity === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                    <AlertTriangle size={13} />
                    <span>{iss.message}</span>
                  </div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                    {iss.suggested_action}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
