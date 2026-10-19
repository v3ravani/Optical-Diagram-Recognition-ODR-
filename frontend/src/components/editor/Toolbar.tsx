import React from 'react';
import {
  MousePointer,
  Hand,
  ArrowUpRight,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookmarkPlus,
  Download,
  SplitSquareVertical,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface ToolbarProps {
  activeTool: 'select' | 'pan' | 'connector' | 'text';
  onToolChange: (tool: 'select' | 'pan' | 'connector' | 'text') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  saveStatus: 'saved' | 'saving' | 'failed';
  onSaveCheckpoint: () => void;
  onOpenExport: () => void;
  onToggleReview: () => void;
  isReviewOpen: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  saveStatus,
  onSaveCheckpoint,
  onOpenExport,
  onToggleReview,
  isReviewOpen
}) => {
  return (
    <div className="editor-toolbar">
      {/* Left tool selection */}
      <div className="toolbar-group">
        <button
          className={`btn-icon ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => onToolChange('select')}
          title="Select Tool (V)"
        >
          <MousePointer size={16} />
        </button>
        <button
          className={`btn-icon ${activeTool === 'pan' ? 'active' : ''}`}
          onClick={() => onToolChange('pan')}
          title="Pan Canvas Tool (H / Space+Drag)"
        >
          <Hand size={16} />
        </button>
        <button
          className={`btn-icon ${activeTool === 'connector' ? 'active' : ''}`}
          onClick={() => onToolChange('connector')}
          title="Connector Tool (C)"
        >
          <ArrowUpRight size={16} />
        </button>

        <div className="toolbar-separator" />

        {/* Undo / Redo */}
        <button
          className="btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.4 }}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.4 }}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        <div className="toolbar-separator" />

        {/* Zoom */}
        <button className="btn-icon" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="btn-icon" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="btn-icon" onClick={onZoomFit} title="Reset Zoom / Fit">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Right actions & save indicator */}
      <div className="toolbar-group">
        {/* Auto-save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', marginRight: '8px' }}>
          {saveStatus === 'saved' && (
            <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          {saveStatus === 'saving' && (
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} className="animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'failed' && (
            <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={13} /> Save failed
            </span>
          )}
        </div>

        <button
          className={`btn btn-secondary ${isReviewOpen ? 'btn-primary' : ''}`}
          onClick={onToggleReview}
          title="Compare reconstructed diagram with source image"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          <SplitSquareVertical size={14} />
          <span>Source Review</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onSaveCheckpoint}
          title="Create a version checkpoint"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          <BookmarkPlus size={14} />
          <span>Checkpoint</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onOpenExport}
          title="Export diagram (Mermaid, PlantUML, JSON, PNG, ZIP)"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
