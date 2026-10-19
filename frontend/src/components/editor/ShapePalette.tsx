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
  Table,
  Key,
  ArrowRight,
  Minus,
  ArrowLeftRight,
  Cpu,
  Hexagon,
  Clock,
  Tv,
  GitMerge,
  Cloud,
  Server,
  Radio,
  Box,
  CreditCard,
  Target,
  CornerDownRight
} from 'lucide-react';

interface ShapePaletteProps {
  onAddShape: (type: ElementType, label: string) => void;
  onAddChart?: (type: 'bar' | 'pie') => void;
  onAddQuickConnector?: (direction: ConnectorDirection, routing: ConnectorStyle, isDashed?: boolean) => void;
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
      type: 'preparation',
      label: 'Hexagon (Prep)',
      icon: <Hexagon size={15} />
    },
    {
      type: 'predefined',
      label: 'Subroutine',
      icon: <Cpu size={15} />
    },
    {
      type: 'manual_operation',
      label: 'Manual Input',
      icon: <Square size={15} style={{ transform: 'perspective(15px) rotateX(15deg)' }} />
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
      type: 'off_page_connector',
      label: 'Off-Page Ref',
      icon: <CornerDownRight size={15} />
    },
    {
      type: 'delay',
      label: 'Delay Step',
      icon: <Clock size={15} />
    },
    {
      type: 'display',
      label: 'Display Screen',
      icon: <Tv size={15} />
    },
    {
      type: 'merge',
      label: 'Merge Junction',
      icon: <GitMerge size={15} />
    },
    {
      type: 'text_block',
      label: 'Note / Annotation',
      icon: <FileText size={15} />
    }
  ];

  const architectureShapes: Array<{ type: ElementType; label: string; icon: React.ReactNode }> = [
    {
      type: 'cloud',
      label: 'Cloud Service',
      icon: <Cloud size={15} />
    },
    {
      type: 'server',
      label: 'Server Host',
      icon: <Server size={15} />
    },
    {
      type: 'queue',
      label: 'Message Queue',
      icon: <Radio size={15} />
    },
    {
      type: 'actor',
      label: 'Actor / Client',
      icon: <User size={15} />
    },
    {
      type: 'package',
      label: 'Package / Module',
      icon: <Box size={15} />
    },
    {
      type: 'card',
      label: 'Metric KPI Card',
      icon: <CreditCard size={15} />
    }
  ];

  const modelingShapes: Array<{ type: ElementType; label: string; icon: React.ReactNode }> = [
    {
      type: 'external_entity',
      label: 'External Entity (DFD)',
      icon: <User size={15} />
    },
    {
      type: 'data_store',
      label: 'Data Store (DFD)',
      icon: <Database size={15} />
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
    },
    {
      type: 'final_state',
      label: 'Final State / Bullseye',
      icon: <Target size={15} />
    }
  ];

  return (
    <aside className="shape-palette" style={{ width: '205px', overflowY: 'auto', padding: '12px' }}>
      {/* 1. Flowchart Elements */}
      <div className="palette-section-title">Flowchart & Logic</div>
      {flowchartShapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span style={{ fontSize: '11.5px' }}>{s.label}</span>
        </div>
      ))}

      {/* 2. Cloud & Architecture */}
      <div className="palette-section-title" style={{ marginTop: '14px' }}>Cloud & Architecture</div>
      {architectureShapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span style={{ fontSize: '11.5px' }}>{s.label}</span>
        </div>
      ))}

      {/* 3. DFD / UML / ERD Modeling Elements */}
      <div className="palette-section-title" style={{ marginTop: '14px' }}>DFD / UML / ERD</div>
      {modelingShapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span style={{ fontSize: '11.5px' }}>{s.label}</span>
        </div>
      ))}

      {/* 4. Connectors & Lines */}
      {onAddQuickConnector && (
        <>
          <div className="palette-section-title" style={{ marginTop: '14px' }}>Lines & Arrows</div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('directed', 'orthogonal')}
            title="Add Directed Arrow between nodes"
          >
            <div className="palette-shape-icon"><ArrowRight size={15} /></div>
            <span style={{ fontSize: '11.5px' }}>Directed (→)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('undirected', 'orthogonal')}
            title="Add Plain Line without arrowhead"
          >
            <div className="palette-shape-icon"><Minus size={15} /></div>
            <span style={{ fontSize: '11.5px' }}>Plain Line (—)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('bidirectional', 'orthogonal')}
            title="Add Bidirectional Arrow"
          >
            <div className="palette-shape-icon"><ArrowLeftRight size={15} /></div>
            <span style={{ fontSize: '11.5px' }}>Bidirectional (↔)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('directed', 'orthogonal', true)}
            title="Add Dashed Dependency Arrow"
          >
            <div className="palette-shape-icon" style={{ letterSpacing: '-1px' }}>- - →</div>
            <span style={{ fontSize: '11.5px' }}>Dashed (---&gt;)</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddQuickConnector('directed', 'curved')}
            title="Add Smooth Curved Arrow"
          >
            <div className="palette-shape-icon">~ →</div>
            <span style={{ fontSize: '11.5px' }}>Curved (∼→)</span>
          </div>
        </>
      )}

      {/* 5. Data Charts */}
      {onAddChart && (
        <>
          <div className="palette-section-title" style={{ marginTop: '14px' }}>Data Charts</div>
          <div
            className="palette-item"
            onClick={() => onAddChart('bar')}
            title="Create Bar Graph"
          >
            <div className="palette-shape-icon"><BarChart3 size={15} /></div>
            <span style={{ fontSize: '11.5px' }}>Bar Graph</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddChart('pie')}
            title="Create Pie Chart"
          >
            <div className="palette-shape-icon"><PieChart size={15} /></div>
            <span style={{ fontSize: '11.5px' }}>Pie Chart</span>
          </div>
        </>
      )}
    </aside>
  );
};

