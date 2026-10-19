import React from 'react';
import { ElementType } from '../../types/diagram';
import { Square, Diamond, Circle, Database, FileText, ArrowRightCircle, BarChart3, PieChart } from 'lucide-react';

interface ShapePaletteProps {
  onAddShape: (type: ElementType, label: string) => void;
  onAddChart?: (type: 'bar' | 'pie') => void;
}

export const ShapePalette: React.FC<ShapePaletteProps> = ({ onAddShape, onAddChart }) => {
  const shapes: Array<{ type: ElementType; label: string; icon: React.ReactNode }> = [
    {
      type: 'terminal',
      label: 'Start / End',
      icon: <ArrowRightCircle size={16} />
    },
    {
      type: 'process',
      label: 'Process Step',
      icon: <Square size={16} />
    },
    {
      type: 'decision',
      label: 'Decision',
      icon: <Diamond size={16} />
    },
    {
      type: 'io',
      label: 'Input / Output',
      icon: <Square size={16} style={{ transform: 'skewX(-15deg)' }} />
    },
    {
      type: 'database',
      label: 'Database',
      icon: <Database size={16} />
    },
    {
      type: 'circle',
      label: 'Connector Pin',
      icon: <Circle size={16} />
    },
    {
      type: 'text_block',
      label: 'Text Note',
      icon: <FileText size={16} />
    }
  ];

  return (
    <aside className="shape-palette">
      <div className="palette-section-title">Shapes</div>
      {shapes.map((s) => (
        <div
          key={s.type}
          className="palette-item"
          onClick={() => onAddShape(s.type, s.label)}
          title={`Click to add ${s.label}`}
        >
          <div className="palette-shape-icon">{s.icon}</div>
          <span>{s.label}</span>
        </div>
      ))}

      {onAddChart && (
        <>
          <div className="palette-section-title" style={{ marginTop: '16px' }}>Data Charts</div>
          <div
            className="palette-item"
            onClick={() => onAddChart('bar')}
            title="Create Bar Graph"
          >
            <div className="palette-shape-icon"><BarChart3 size={16} /></div>
            <span>Bar Graph</span>
          </div>
          <div
            className="palette-item"
            onClick={() => onAddChart('pie')}
            title="Create Pie Chart"
          >
            <div className="palette-shape-icon"><PieChart size={16} /></div>
            <span>Pie Chart</span>
          </div>
        </>
      )}
    </aside>
  );
};
