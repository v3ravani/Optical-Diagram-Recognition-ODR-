import React, { useState, useEffect } from 'react';
import { CanonicalDiagram } from '../../types/diagram';
import { api } from '../../services/api';
import { Copy, Download, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface BottomDrawerProps {
  diagram: CanonicalDiagram;
  isOpen: boolean;
  onToggle: () => void;
}

export const BottomDrawer: React.FC<BottomDrawerProps> = ({ diagram, isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'mermaid' | 'plantuml' | 'json' | 'validation'>('mermaid');
  const [mermaidCode, setMermaidCode] = useState('');
  const [plantumlCode, setPlantumlCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.exportMermaid(diagram).then((res) => setMermaidCode(res.code));
    api.exportPlantUML(diagram).then((res) => setPlantumlCode(res.code));
  }, [diagram, isOpen]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getActiveContent = () => {
    if (activeTab === 'mermaid') return mermaidCode;
    if (activeTab === 'plantuml') return plantumlCode;
    if (activeTab === 'json') return JSON.stringify(diagram, null, 2);
    return JSON.stringify(diagram.validation_issues, null, 2);
  };

  if (!isOpen) {
    return (
      <div
        className="drawer-header"
        style={{ cursor: 'pointer', borderTop: '1px solid var(--border-subtle)' }}
        onClick={onToggle}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Source & Validation Drawer
        </span>
        <button className="btn-icon">
          <ChevronUp size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="bottom-drawer">
      <div className="drawer-header">
        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${activeTab === 'mermaid' ? 'active' : ''}`}
            onClick={() => setActiveTab('mermaid')}
          >
            Mermaid
          </button>
          <button
            className={`drawer-tab ${activeTab === 'plantuml' ? 'active' : ''}`}
            onClick={() => setActiveTab('plantuml')}
          >
            PlantUML
          </button>
          <button
            className={`drawer-tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            Canonical JSON
          </button>
          <button
            className={`drawer-tab ${activeTab === 'validation' ? 'active' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            Validation ({diagram.validation_issues.length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            onClick={() => copyToClipboard(getActiveContent())}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="btn-icon" onClick={onToggle} title="Collapse Drawer">
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      <pre className="drawer-content">{getActiveContent()}</pre>
    </div>
  );
};
