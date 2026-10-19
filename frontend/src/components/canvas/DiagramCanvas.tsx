import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  ElementType,
  Point,
  ConnectorDirection
} from '../../types/diagram';

interface DiagramCanvasProps {
  diagram: CanonicalDiagram;
  onChange: (updated: CanonicalDiagram) => void;
  selectedElementId: string | null;
  selectedConnectorId: string | null;
  onSelectElement: (id: string | null) => void;
  onSelectConnector: (id: string | null) => void;
  activeTool: 'select' | 'pan' | 'connector' | 'text';
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  highlightedElementId?: string | null;
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  diagram,
  onChange,
  selectedElementId,
  selectedConnectorId,
  onSelectElement,
  onSelectConnector,
  activeTool,
  zoom,
  pan,
  onPanChange,
  highlightedElementId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resizing node
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const [resizeInitial, setResizeInitial] = useState({ x: 0, y: 0, w: 0, h: 0, mouseX: 0, mouseY: 0 });

  // Connector drawing
  const [connectorStartNodeId, setConnectorStartNodeId] = useState<string | null>(null);
  const [tempConnectorEnd, setTempConnectorEnd] = useState<{ x: number; y: number } | null>(null);

  // Inline editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Transform screen coordinate to canvas coordinate
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      };
    },
    [pan, zoom]
  );

  // Handle Pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    // If Space is pressed or Pan tool is active, start panning
    if (activeTool === 'pan' || e.button === 1 || (e as any).spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Clicking empty canvas clears selection
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectElement(null);
      onSelectConnector(null);
      setEditingNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      onPanChange({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    // Node movement
    if (draggingNodeId) {
      const updatedElements = diagram.elements.map((el) => {
        if (el.id === draggingNodeId) {
          return {
            ...el,
            x: Math.round(mousePos.x - dragOffset.x),
            y: Math.round(mousePos.y - dragOffset.y)
          };
        }
        return el;
      });
      onChange({ ...diagram, elements: updatedElements });
      return;
    }

    // Node resizing
    if (resizingNodeId && resizeHandle) {
      const dx = mousePos.x - resizeInitial.mouseX;
      const dy = mousePos.y - resizeInitial.mouseY;

      const updatedElements = diagram.elements.map((el) => {
        if (el.id === resizingNodeId) {
          let nx = resizeInitial.x;
          let ny = resizeInitial.y;
          let nw = resizeInitial.w;
          let nh = resizeInitial.h;

          if (resizeHandle === 'se') {
            nw = Math.max(60, resizeInitial.w + dx);
            nh = Math.max(40, resizeInitial.h + dy);
          } else if (resizeHandle === 'sw') {
            nw = Math.max(60, resizeInitial.w - dx);
            nh = Math.max(40, resizeInitial.h + dy);
            nx = resizeInitial.x + (resizeInitial.w - nw);
          } else if (resizeHandle === 'ne') {
            nw = Math.max(60, resizeInitial.w + dx);
            nh = Math.max(40, resizeInitial.h - dy);
            ny = resizeInitial.y + (resizeInitial.h - nh);
          } else if (resizeHandle === 'nw') {
            nw = Math.max(60, resizeInitial.w - dx);
            nh = Math.max(40, resizeInitial.h - dy);
            nx = resizeInitial.x + (resizeInitial.w - nw);
            ny = resizeInitial.y + (resizeInitial.h - nh);
          }

          return { ...el, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) };
        }
        return el;
      });
      onChange({ ...diagram, elements: updatedElements });
      return;
    }

    // Connector drawing preview
    if (connectorStartNodeId) {
      setTempConnectorEnd(mousePos);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizeHandle(null);
    setConnectorStartNodeId(null);
    setTempConnectorEnd(null);
  };

  // Node Drag Start
  const startNodeDrag = (e: React.MouseEvent, node: DiagramElement) => {
    e.stopPropagation();
    onSelectElement(node.id);
    onSelectConnector(null);

    if (activeTool === 'connector') {
      setConnectorStartNodeId(node.id);
      return;
    }

    const mousePos = screenToCanvas(e.clientX, e.clientY);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: mousePos.x - node.x,
      y: mousePos.y - node.y
    });
  };

  // Node Drag Finish (Connector linking)
  const handleNodeMouseUp = (e: React.MouseEvent, targetNode: DiagramElement) => {
    e.stopPropagation();
    if (connectorStartNodeId && connectorStartNodeId !== targetNode.id) {
      // Create new connector
      const newConn: DiagramConnector = {
        id: `conn_${Date.now().toString(36)}`,
        source_id: connectorStartNodeId,
        target_id: targetNode.id,
        source_handle: 'auto',
        target_handle: 'auto',
        label: '',
        direction: 'directed',
        routing: 'orthogonal',
        waypoints: [],
        style: { stroke: '#2b3a42', stroke_width: 2, arrow_head: 'classic', is_dashed: false },
        confidence: 1.0,
        uncertainty_status: 'likely_correct',
        provenance: { user_created: true }
      };

      onChange({
        ...diagram,
        connectors: [...diagram.connectors, newConn]
      });
    }

    setConnectorStartNodeId(null);
    setTempConnectorEnd(null);
  };

  // Start Resizing Handle
  const startResize = (e: React.MouseEvent, node: DiagramElement, handle: 'nw' | 'ne' | 'se' | 'sw') => {
    e.stopPropagation();
    const mousePos = screenToCanvas(e.clientX, e.clientY);
    setResizingNodeId(node.id);
    setResizeHandle(handle);
    setResizeInitial({
      x: node.x,
      y: node.y,
      w: node.width,
      h: node.height,
      mouseX: mousePos.x,
      mouseY: mousePos.y
    });
  };

  // Start Inline Text Edit
  const startEditingText = (node: DiagramElement) => {
    setEditingNodeId(node.id);
    setEditingText(node.label);
  };

  const commitEditingText = () => {
    if (editingNodeId) {
      const updatedElements = diagram.elements.map((el) =>
        el.id === editingNodeId ? { ...el, label: editingText } : el
      );
      onChange({ ...diagram, elements: updatedElements });
      setEditingNodeId(null);
    }
  };

  const elementMap = new Map(diagram.elements.map((el) => [el.id, el]));

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${activeTool === 'pan' ? 'pan-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <svg
        className="canvas-svg"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#2b3a42" />
          </marker>
          <marker
            id="arrowhead-selected"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#0f766e" />
          </marker>
        </defs>

        {/* 1. Render Connectors */}
        {diagram.connectors.map((conn) => {
          const src = elementMap.get(conn.source_id);
          const tgt = elementMap.get(conn.target_id);
          if (!src || !tgt) return null;

          const isSelected = selectedConnectorId === conn.id;

          // Compute start & end anchors
          const sx = src.x + src.width / 2;
          const sy = src.y + src.height;
          const tx = tgt.x + tgt.width / 2;
          const ty = tgt.y;

          // Orthogonal path routing
          const midY = (sy + ty) / 2;
          let pathD = `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
          if (conn.routing === 'straight') {
            pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
          }

          // Label center
          const labelX = (sx + tx) / 2;
          const labelY = midY;

          return (
            <g key={conn.id} onClick={(e) => { e.stopPropagation(); onSelectConnector(conn.id); onSelectElement(null); }}>
              <path
                d={pathD}
                className={`connector-line ${isSelected ? 'selected' : ''}`}
                markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
              />
              {conn.label && (
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect
                    x={-24}
                    y={-12}
                    width={48}
                    height={24}
                    className="edge-label-box"
                  />
                  <text className="edge-label-text">{conn.label}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Temp connector preview */}
        {connectorStartNodeId && tempConnectorEnd && (
          <line
            x1={(elementMap.get(connectorStartNodeId)?.x ?? 0) + (elementMap.get(connectorStartNodeId)?.width ?? 0) / 2}
            y1={(elementMap.get(connectorStartNodeId)?.y ?? 0) + (elementMap.get(connectorStartNodeId)?.height ?? 0) / 2}
            x2={tempConnectorEnd.x}
            y2={tempConnectorEnd.y}
            stroke="#0f766e"
            strokeWidth="2"
            strokeDasharray="4 4"
            markerEnd="url(#arrowhead-selected)"
          />
        )}

        {/* 2. Render Diagram Elements */}
        {diagram.elements.map((el) => {
          const isSelected = selectedElementId === el.id;
          const isHighlighted = highlightedElementId === el.id;

          return (
            <g
              key={el.id}
              className={`diagram-node ${isSelected ? 'selected' : ''}`}
              transform={`translate(${el.x}, ${el.y})`}
              onMouseDown={(e) => startNodeDrag(e, el)}
              onMouseUp={(e) => handleNodeMouseUp(e, el)}
              onDoubleClick={() => startEditingText(el)}
            >
              {/* Highlight / Outline glow if focused from issues list */}
              {isHighlighted && (
                <rect
                  x={-6}
                  y={-6}
                  width={el.width + 12}
                  height={el.height + 12}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  rx="6"
                  strokeDasharray="4 2"
                />
              )}

              {/* Render Shape based on type */}
              {el.type === 'decision' ? (
                <polygon
                  points={`${el.width / 2},0 ${el.width},${el.height / 2} ${el.width / 2},${el.height} 0,${el.height / 2}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'terminal' ? (
                <rect
                  x={0}
                  y={0}
                  width={el.width}
                  height={el.height}
                  rx={Math.min(el.width, el.height) * 0.45}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'circle' ? (
                <ellipse
                  cx={el.width / 2}
                  cy={el.height / 2}
                  rx={el.width / 2}
                  ry={el.height / 2}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'io' ? (
                <polygon
                  points={`${el.width * 0.15},0 ${el.width},0 ${el.width * 0.85},${el.height} 0,${el.height}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : (
                <rect
                  x={0}
                  y={0}
                  width={el.width}
                  height={el.height}
                  rx={el.style.corner_radius || 4}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              )}

              {/* Label text */}
              {editingNodeId === el.id ? (
                <foreignObject x={4} y={4} width={el.width - 8} height={el.height - 8}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <textarea
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={commitEditingText}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          commitEditingText();
                        } else if (e.key === 'Escape') {
                          setEditingNodeId(null);
                        }
                      }}
                      style={{
                        width: '90%',
                        height: '80%',
                        fontSize: `${el.style.font_size}px`,
                        textAlign: 'center',
                        resize: 'none',
                        border: '1px solid #0f766e',
                        borderRadius: '4px',
                        padding: '2px'
                      }}
                    />
                  </div>
                </foreignObject>
              ) : (
                <text
                  x={el.width / 2}
                  y={el.height / 2}
                  fill={el.style.text_color}
                  fontSize={el.style.font_size}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: 500 }}
                >
                  {el.label || el.id}
                </text>
              )}

              {/* Selection Box & Resize Handles */}
              {isSelected && (
                <>
                  <rect
                    x={-3}
                    y={-3}
                    width={el.width + 6}
                    height={el.height + 6}
                    className="node-selection-box"
                  />
                  <rect
                    x={-4}
                    y={-4}
                    width={8}
                    height={8}
                    className="resize-handle nw"
                    onMouseDown={(e) => startResize(e, el, 'nw')}
                  />
                  <rect
                    x={el.width - 4}
                    y={-4}
                    width={8}
                    height={8}
                    className="resize-handle ne"
                    onMouseDown={(e) => startResize(e, el, 'ne')}
                  />
                  <rect
                    x={el.width - 4}
                    y={el.height - 4}
                    width={8}
                    height={8}
                    className="resize-handle se"
                    onMouseDown={(e) => startResize(e, el, 'se')}
                  />
                  <rect
                    x={-4}
                    y={el.height - 4}
                    width={8}
                    height={8}
                    className="resize-handle sw"
                    onMouseDown={(e) => startResize(e, el, 'sw')}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
