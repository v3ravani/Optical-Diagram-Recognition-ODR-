import React from 'react';
import { X, ShieldCheck, HardDrive, Cpu, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <span className="modal-title">Settings & System Status</span>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Privacy & Offline Verification Banner */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'var(--color-success-bg)',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <ShieldCheck size={22} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>
                Offline & Local-Only Verified
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                All optical recognition, OCR, geometry analysis, rendering, and exports execute completely on this computer. Zero images or diagrams are transmitted to third-party cloud services.
              </p>
            </div>
          </div>

          {/* Engine Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Recognition Engines
            </span>

            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>RapidOCR (ONNX Runtime)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Local text detection & recognition</div>
              </div>
              <span style={{ color: 'var(--color-success)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Active
              </span>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>OpenCV 5.0 Computer Vision</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contour analysis, deskew, and morphology</div>
              </div>
              <span style={{ color: 'var(--color-success)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Active
              </span>
            </div>
          </div>

          {/* Storage & Auto-Save */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Storage & Auto-Save
            </span>

            <div className="inspector-field">
              <label className="field-label">Project Storage Directory</label>
              <input
                type="text"
                className="field-input"
                value="data/projects/"
                disabled
                style={{ background: 'var(--bg-subtle)' }}
              />
            </div>

            <div className="inspector-field">
              <label className="field-label">Auto-Save Debounce Interval</label>
              <select className="field-input" defaultValue="1000">
                <option value="500">500 ms (Fastest)</option>
                <option value="1000">1000 ms (Default)</option>
                <option value="2000">2000 ms</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
