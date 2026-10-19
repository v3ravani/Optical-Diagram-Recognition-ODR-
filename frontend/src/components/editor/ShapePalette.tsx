import React from 'react';
import { ElementType, ConnectorDirection, ConnectorStyle } from '../../types/diagram';
import {
  Square,
  Diamond,
  Circle,
  Database,
  FileText,
  ArrowRightCircle,
  BarChart3,
  PieChart,
  User,
  Share2,
  Table,
  Key,
  Layers,
  ArrowRight,
  Minus,
  ArrowLeftRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface ShapePaletteProps {
  onAddShape: (type: ElementType, label: string) => void;
  onAddChart?: (type: 'bar' | 'pie') => void;
  onAddQuickConnector?: (direction: ConnectorDirection, routing: ConnectorStyle) => void;
}

export const ShapePalette: React.FC<ShapePaletteProps> = ({
  onAddShape,
  onAddChart,
  onAddQuickConnector
}) => {
  const flowchartShapes: Array<{ type: ElementType; label: string; icon: React.ReactNode }> = [
    {
      type: 'terminal',
      label: 'Start / End',
      icon: <ArrowRightCircle size={15} />
    },
    {
      type: 'process',
      label: 'Process Step',
      icon: <Square size={15} />
    },
    {
      type: 'decision',
      label: 'Decision',
      icon: <Diamond size={15} />
    },
    {
      type: 'io',
      label: 'Input / Output',
      icon: <Square size={15} style={{ transform: 'skewX(-15deg)' }} />
    },
    {
      type: 'database',
      label: 'Database / Store',
      icon: <Database size={15} />
    },
    {
      type: 'document',
      label: 'Document',
      icon: <FileText size={15} />
    },
    {
      type: 'predefined',
      label: 'Subroutine',
      icon: <Cpu size={15} />
    },
    {
      type: 'text_block',
      label: 'Note / Label',
      icon: <FileText size={15} />
    }
  ];

  const modelingShapes: Array<{ type: ElementType; label: string; icon: React.ReactNode }> = [
    {
      type: 'external_entity',
      label: 'External Entity',
      icon: <User size={15} />
    },
    {
      type: 'participant',
      label: 'Participant (Seq)',
      icon: <Table size={15} />
    },
    {
      type: 'entity',
      label: 'Entity (ERD)',
      icon: <Square size={15} />
    },
    {
      type: 'attribute',
      label: 'Attribute (Oval)',
      icon: <Circle size={15} style={{ transform: 'scaleX(1.3)' }} />
    },
    {
      type: 'key_attribute',
      label: 'Primary Key',
      icon: <Key size={15} />
    },
    {
      type: 'relationship',
      label: 'Relationship',
      icon: <Diamond size={15} />
    }
  ];

  return (
    <aside className="shape-palette" style={{ width: '190px', overflowY: 'auto', padding: '12px' }}>
      {/* 1. Flowchart Elements */}
      <div className="palette-section-title">Flowchart</div>
      {flowchartShapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span style={{ fontSize: '12px' }}>{s.label}</span>
        </div>
      ))}

      {/* 2. Technical / Modeling Elements */}
      <div className="palette-section-title" style={{ marginTop: '14px' }}>DFD / UML / ERD</div>
      {modelingShapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span style={{ fontSize: '12px' }}>{s.label}</span>
        </div>
      ))}

      {/* 3. Connectors & Lines */}
      {onAddQuickConnector && (
        <>
          <div className="palette-section-title" style={{ marginTop: '14px' }}>Lines & Arrows</div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('directed', 'orthogonal')}
            title="Add Directed Arrow between selected nodes"
          >
            <div className="palette-shape-icon"><ArrowRight size={15} /></div>
            <span style={{ fontSize: '12px' }}>Directed Arrow (→)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('undirected', 'orthogonal')}
            title="Add Plain Line without arrowhead"
          >
            <div className="palette-shape-icon"><Minus size={15} /></div>
            <span style={{ fontSize: '12px' }}>Plain Line (—)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('bidirectional', 'orthogonal')}
            title="Add Bidirectional Arrow"
          >
            <div className="palette-shape-icon"><ArrowLeftRight size={15} /></div>
            <span style={{ fontSize: '12px' }}>Bidirectional (↔)</span>
          </div>
        </>
      )}

      {/* 4. Data Charts */}
      {onAddChart && (
        <>
          <div className="palette-section-title" style={{ marginTop: '14px' }}>Data Charts</div>
          <div
            className="palette-item"
            onClick={() => onAddChart('bar')}
            title="Create Bar Graph"
          >
            <div className="palette-shape-icon"><BarChart3 size={15} /></div>
            <span style={{ fontSize: '12px' }}>Bar Graph</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddChart('pie')}
            title="Create Pie Chart"
          >
            <div className="palette-shape-icon"><PieChart size={15} /></div>
            <span style={{ fontSize: '12px' }}>Pie Chart</span>
          </div>
        </>
      )}
    </aside>
  );
};
