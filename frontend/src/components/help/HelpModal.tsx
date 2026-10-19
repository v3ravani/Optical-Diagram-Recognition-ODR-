import React from 'react';
import { X, Command, Keyboard, CheckCircle2, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'V', desc: 'Select / Move Tool' },
    { key: 'H / Space+Drag', desc: 'Pan Canvas' },
    { key: 'C', desc: 'Connector Tool (drag between nodes to connect)' },
    { key: 'Double-Click', desc: 'Edit node label inline' },
    { key: 'Delete / Backspace', desc: 'Delete selected element or connector' },
    { key: 'Ctrl + Z', desc: 'Undo last edit' },
    { key: 'Ctrl + Y', desc: 'Redo last edit' },
    { key: 'Mouse Wheel', desc: 'Zoom In / Out' }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} style={{ color: 'var(--accent-primary)' }} />
            <span className="modal-title">Help & Keyboard Shortcuts</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Canvas Keyboard Shortcuts
            </span>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {shortcuts.map((sc) => (
                <div
                  key={sc.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-subtle)',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{sc.desc}</span>
                  <kbd
                    style={{
                      background: 'var(--bg-surface)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px'
                    }}
                  >
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Supported Diagram Families
            </span>
            <ul style={{ marginTop: '8px', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <li><strong>Flowcharts:</strong> Start/End terminals, process rectangles, decision diamonds, IO parallelograms, directed arrows with branch labels.</li>
              <li><strong>Charts:</strong> Bar charts with extracted categories and series values; Pie charts with slices.</li>
              <li><strong>Exports:</strong> Mermaid (.mmd), PlantUML (.puml), Canonical JSON (.json), PNG raster image (.png), and ZIP bundle.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
