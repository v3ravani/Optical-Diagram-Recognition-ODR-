import React, { useState, useEffect } from 'react';
import { CanonicalDiagram } from '../../types/diagram';
import { api } from '../../services/api';
import { X, Download, Copy, Check, FileCode, Image, Archive, AlertCircle } from 'lucide-react';

interface ExportModalProps {
  diagram: CanonicalDiagram;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ diagram, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'mermaid' | 'plantuml' | 'json' | 'png' | 'bundle'>('mermaid');
  const [mermaidCode, setMermaidCode] = useState('');
  const [plantumlCode, setPlantumlCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.exportMermaid(diagram).then((res) => setMermaidCode(res.code));
    api.exportPlantUML(diagram).then((res) => setPlantumlCode(res.code));
  }, [diagram, isOpen]);

  if (!isOpen) return null;

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = async () => {
    setIsExporting(true);
    try {
      await api.downloadPNG(diagram);
    } catch (err: any) {
      alert(`PNG export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBundle = async () => {
    setIsExporting(true);
    try {
      await api.downloadBundle(diagram);
    } catch (err: any) {
      alert(`Bundle export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="modal-title">Export Diagram</span>
            <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              {diagram.name}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Format Selection Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', padding: '0 12px' }}>
          <button
            className={`drawer-tab ${activeTab === 'mermaid' ? 'active' : ''}`}
            onClick={() => setActiveTab('mermaid')}
            style={{ padding: '8px 14px', borderRadius: '0', borderBottom: activeTab === 'mermaid' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            Mermaid
          </button>
          <button
            className={`drawer-tab ${activeTab === 'plantuml' ? 'active' : ''}`}
            onClick={() => setActiveTab('plantuml')}
            style={{ padding: '8px 14px', borderRadius: '0', borderBottom: activeTab === 'plantuml' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            PlantUML
          </button>
          <button
            className={`drawer-tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
            style={{ padding: '8px 14px', borderRadius: '0', borderBottom: activeTab === 'json' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            Canonical JSON
          </button>
          <button
            className={`drawer-tab ${activeTab === 'png' ? 'active' : ''}`}
            onClick={() => setActiveTab('png')}
            style={{ padding: '8px 14px', borderRadius: '0', borderBottom: activeTab === 'png' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            PNG Image
          </button>
          <button
            className={`drawer-tab ${activeTab === 'bundle' ? 'active' : ''}`}
            onClick={() => setActiveTab('bundle')}
            style={{ padding: '8px 14px', borderRadius: '0', borderBottom: activeTab === 'bundle' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            ZIP Bundle
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeTab === 'mermaid' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Flowchart syntax generated from canonical model
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => copyCode(mermaidCode)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadFile(mermaidCode, `${diagram.name.replace(/\s+/g, '_')}.mmd`, 'text/plain')}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    <Download size={13} />
                    <span>Download .mmd</span>
                  </button>
                </div>
              </div>
              <pre className="drawer-content" style={{ borderRadius: '6px', maxHeight: '320px' }}>{mermaidCode}</pre>
            </>
          )}

          {activeTab === 'plantuml' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  PlantUML syntax with monochrome styling
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => copyCode(plantumlCode)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadFile(plantumlCode, `${diagram.name.replace(/\s+/g, '_')}.puml`, 'text/plain')}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    <Download size={13} />
                    <span>Download .puml</span>
                  </button>
                </div>
              </div>
              <pre className="drawer-content" style={{ borderRadius: '6px', maxHeight: '320px' }}>{plantumlCode}</pre>
            </>
          )}

          {activeTab === 'json' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Canonical Diagram Schema v2.0 JSON
                </span>
                <button className="btn btn-primary" onClick={() => api.downloadJSON(diagram)} style={{ padding: '4px 12px', fontSize: '12px' }}>
                  <Download size={13} />
                  <span>Download .json</span>
                </button>
              </div>
              <pre className="drawer-content" style={{ borderRadius: '6px', maxHeight: '320px' }}>
                {JSON.stringify(diagram, null, 2)}
              </pre>
            </>
          )}

          {activeTab === 'png' && (
            <div style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image size={28} />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600 }}>High-Resolution Raster PNG</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px' }}>
                Direct Pillow rendering excluding all editor handles, selection outlines, and debug markers.
              </p>
              <button className="btn btn-primary" onClick={handleDownloadPNG} disabled={isExporting} style={{ padding: '8px 18px', fontSize: '13px', gap: '8px' }}>
                <Download size={15} />
                <span>{isExporting ? 'Generating PNG...' : 'Download PNG Image'}</span>
              </button>
            </div>
          )}

          {activeTab === 'bundle' && (
            <div style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Archive size={28} />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Complete Diagram ZIP Archive</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px' }}>
                Includes <code>diagram.json</code>, <code>diagram.mmd</code>, <code>diagram.puml</code>, <code>diagram.png</code>, and <code>manifest.json</code>.
              </p>
              <button className="btn btn-primary" onClick={handleDownloadBundle} disabled={isExporting} style={{ padding: '8px 18px', fontSize: '13px', gap: '8px' }}>
                <Download size={15} />
                <span>{isExporting ? 'Packaging ZIP...' : 'Download ZIP Bundle'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
