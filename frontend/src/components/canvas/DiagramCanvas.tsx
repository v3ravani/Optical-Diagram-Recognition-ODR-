import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  ElementType,
  Point
} from '../../types/diagram';

interface DiagramCanvasProps {
  diagram: CanonicalDiagram;
  onChange: (updated: CanonicalDiagram, pushHistory?: boolean) => void;
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

const GRID_SNAP = 10;
const snapToGrid = (val: number) => Math.round(val / GRID_SNAP) * GRID_SNAP;

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
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState(false);

  // Hovered node
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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

  // Global mouseup / pointerup listener ensures dragging ALWAYS stops cleanly
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (draggingNodeId || resizingNodeId || isPanning || connectorStartNodeId) {
        setIsPanning(false);
        setDraggingNodeId(null);
        setResizingNodeId(null);
        setResizeHandle(null);
        setConnectorStartNodeId(null);
        setTempConnectorEnd(null);
        setHasMovedDuringDrag(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
    };
  }, [draggingNodeId, resizingNodeId, isPanning, connectorStartNodeId]);

  // Handle Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
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

  // Handle Mouse Move
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
      setHasMovedDuringDrag(true);
      const snappedX = Math.max(0, snapToGrid(mousePos.x - dragOffset.x));
      const snappedY = Math.max(0, snapToGrid(mousePos.y - dragOffset.y));

      const updatedElements = diagram.elements.map((el) => {
        if (el.id === draggingNodeId) {
          return {
            ...el,
            x: snappedX,
            y: snappedY
          };
        }
        return el;
      });
      onChange({ ...diagram, elements: updatedElements }, false);
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
            nw = Math.max(60, snapToGrid(resizeInitial.w + dx));
            nh = Math.max(40, snapToGrid(resizeInitial.h + dy));
          } else if (resizeHandle === 'sw') {
            nw = Math.max(60, snapToGrid(resizeInitial.w - dx));
            nh = Math.max(40, snapToGrid(resizeInitial.h + dy));
            nx = snapToGrid(resizeInitial.x + (resizeInitial.w - nw));
          } else if (resizeHandle === 'ne') {
            nw = Math.max(60, snapToGrid(resizeInitial.w + dx));
            nh = Math.max(40, snapToGrid(resizeInitial.h - dy));
            ny = snapToGrid(resizeInitial.y + (resizeInitial.h - nh));
          } else if (resizeHandle === 'nw') {
            nw = Math.max(60, snapToGrid(resizeInitial.w - dx));
            nh = Math.max(40, snapToGrid(resizeInitial.h - dy));
            nx = snapToGrid(resizeInitial.x + (resizeInitial.w - nw));
            ny = snapToGrid(resizeInitial.y + (resizeInitial.h - nh));
          }

          return { ...el, x: nx, y: ny, width: nw, height: nh };
        }
        return el;
      });
      onChange({ ...diagram, elements: updatedElements }, false);
      return;
    }

    // Connector drawing preview
    if (connectorStartNodeId) {
      setTempConnectorEnd(mousePos);
    }
  };

  // Handle Mouse Up on Container
  const handleMouseUp = () => {
    if (draggingNodeId && hasMovedDuringDrag) {
      // Commit final position to history snapshot
      onChange(diagram, true);
    }
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizeHandle(null);
    setConnectorStartNodeId(null);
    setTempConnectorEnd(null);
    setHasMovedDuringDrag(false);
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
    setHasMovedDuringDrag(false);
    setDragOffset({
      x: mousePos.x - node.x,
      y: mousePos.y - node.y
    });
  };

  // Node Drag Finish / Connector link complete
  const handleNodeMouseUp = (e: React.MouseEvent, targetNode: DiagramElement) => {
    e.stopPropagation();

    if (connectorStartNodeId && connectorStartNodeId !== targetNode.id) {
      // Create new directed connector between nodes
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
      }, true);
    } else if (draggingNodeId && hasMovedDuringDrag) {
      // Commit final position to history
      onChange(diagram, true);
    }

    // Ensure all drag & draw states are unconditionally cleared
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizeHandle(null);
    setConnectorStartNodeId(null);
    setTempConnectorEnd(null);
    setHasMovedDuringDrag(false);
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
      onChange({ ...diagram, elements: updatedElements }, true);
      setEditingNodeId(null);
    }
  };

  // Start connector from anchor port
  const startConnectorFromPort = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setConnectorStartNodeId(nodeId);
    const mousePos = screenToCanvas(e.clientX, e.clientY);
    setTempConnectorEnd(mousePos);
  };

  const elementMap = new Map(diagram.elements.map((el) => [el.id, el]));

  // Calculate smart anchor connection coordinates
  const computeConnectorAnchors = (src: DiagramElement, tgt: DiagramElement) => {
    const srcCx = src.x + src.width / 2;
    const srcCy = src.y + src.height / 2;
    const tgtCx = tgt.x + tgt.width / 2;
    const tgtCy = tgt.y + tgt.height / 2;

    const dx = tgtCx - srcCx;
    const dy = tgtCy - srcCy;

    // Determine primary relative orientation
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      // Horizontal flow
      if (dx > 0) {
        // Target is to the right
        return {
          sx: src.x + src.width,
          sy: srcCy,
          tx: tgt.x,
          ty: tgtCy,
          orientation: 'horizontal'
        };
      } else {
        // Target is to the left
        return {
          sx: src.x,
          sy: srcCy,
          tx: tgt.x + tgt.width,
          ty: tgtCy,
          orientation: 'horizontal'
        };
      }
    } else {
      // Vertical flow
      if (dy > 0) {
        // Target is below
        return {
          sx: srcCx,
          sy: src.y + src.height,
          tx: tgtCx,
          ty: tgt.y,
          orientation: 'vertical'
        };
      } else {
        // Target is above
        return {
          sx: srcCx,
          sy: src.y,
          tx: tgtCx,
          ty: tgt.y + tgt.height,
          orientation: 'vertical'
        };
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${activeTool === 'pan' ? 'pan-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ userSelect: 'none' }}
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
          const { sx, sy, tx, ty, orientation } = computeConnectorAnchors(src, tgt);

          let pathD = '';
          let labelX = (sx + tx) / 2;
          let labelY = (sy + ty) / 2;

          if (conn.routing === 'straight') {
            pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
          } else {
            // Adaptive orthogonal routing
            if (orientation === 'horizontal') {
              const midX = (sx + tx) / 2;
              pathD = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`;
              labelX = midX;
              labelY = (sy + ty) / 2;
            } else {
              const midY = (sy + ty) / 2;
              pathD = `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
              labelX = (sx + tx) / 2;
              labelY = midY;
            }
          }

          return (
            <g
              key={conn.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectConnector(conn.id);
                onSelectElement(null);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible wider stroke for easy clicking */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
              />
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

        {/* Temporary connector preview while drawing */}
        {connectorStartNodeId && tempConnectorEnd && (
          <line
            x1={(elementMap.get(connectorStartNodeId)?.x ?? 0) + (elementMap.get(connectorStartNodeId)?.width ?? 0) / 2}
            y1={(elementMap.get(connectorStartNodeId)?.y ?? 0) + (elementMap.get(connectorStartNodeId)?.height ?? 0) / 2}
            x2={tempConnectorEnd.x}
            y2={tempConnectorEnd.y}
            stroke="#0f766e"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            markerEnd="url(#arrowhead-selected)"
          />
        )}

        {/* 2. Render Diagram Elements */}
        {diagram.elements.map((el) => {
          const isSelected = selectedElementId === el.id;
          const isHighlighted = highlightedElementId === el.id;
          const isDragging = draggingNodeId === el.id;
          const isHovered = hoveredNodeId === el.id;

          return (
            <g
              key={el.id}
              className={`diagram-node ${isSelected ? 'selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
              transform={`translate(${el.x}, ${el.y})`}
              onMouseDown={(e) => startNodeDrag(e, el)}
              onMouseUp={(e) => handleNodeMouseUp(e, el)}
              onMouseEnter={() => setHoveredNodeId(el.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onDoubleClick={() => startEditingText(el)}
              style={{
                cursor: isDragging ? 'grabbing' : activeTool === 'connector' ? 'crosshair' : 'grab'
              }}
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

              {/* Render Shape Geometry */}
              {el.type === 'decision' || el.type === 'diamond' ? (
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
                        border: '1.5px solid #0f766e',
                        borderRadius: '4px',
                        padding: '4px',
                        outline: 'none',
                        background: '#ffffff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
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
                    x={-4}
                    y={-4}
                    width={el.width + 8}
                    height={el.height + 8}
                    className="node-selection-box"
                  />
                  <rect
                    x={-5}
                    y={-5}
                    width={9}
                    height={9}
                    className="resize-handle nw"
                    onMouseDown={(e) => startResize(e, el, 'nw')}
                  />
                  <rect
                    x={el.width - 4}
                    y={-5}
                    width={9}
                    height={9}
                    className="resize-handle ne"
                    onMouseDown={(e) => startResize(e, el, 'ne')}
                  />
                  <rect
                    x={el.width - 4}
                    y={el.height - 4}
                    width={9}
                    height={9}
                    className="resize-handle se"
                    onMouseDown={(e) => startResize(e, el, 'se')}
                  />
                  <rect
                    x={-5}
                    y={el.height - 4}
                    width={9}
                    height={9}
                    className="resize-handle sw"
                    onMouseDown={(e) => startResize(e, el, 'sw')}
                  />
                </>
              )}

              {/* Anchor connection ports (appear on hover, selection, or connector tool) */}
              {(isSelected || isHovered || activeTool === 'connector') && (
                <>
                  {/* Top port */}
                  <circle
                    cx={el.width / 2}
                    cy={0}
                    r={4}
                    className="anchor-port"
                    onMouseDown={(e) => startConnectorFromPort(e, el.id)}
                  />
                  {/* Right port */}
                  <circle
                    cx={el.width}
                    cy={el.height / 2}
                    r={4}
                    className="anchor-port"
                    onMouseDown={(e) => startConnectorFromPort(e, el.id)}
                  />
                  {/* Bottom port */}
                  <circle
                    cx={el.width / 2}
                    cy={el.height}
                    r={4}
                    className="anchor-port"
                    onMouseDown={(e) => startConnectorFromPort(e, el.id)}
                  />
                  {/* Left port */}
                  <circle
                    cx={0}
                    cy={el.height / 2}
                    r={4}
                    className="anchor-port"
                    onMouseDown={(e) => startConnectorFromPort(e, el.id)}
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
