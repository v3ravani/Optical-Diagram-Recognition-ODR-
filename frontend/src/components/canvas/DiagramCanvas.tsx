import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  ElementType,
  Point,
  ConnectorDirection,
  ConnectorStyle
} from '../../types/diagram';
import {
  Copy,
  Plus,
  Trash2,
  ArrowRight,
  Minus,
  ArrowLeftRight,
  Palette,
  X,
  Link2
} from 'lucide-react';

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

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
];

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

  // Manual Connector Creation (Click-to-Click & Drag-to-Connect)
  const [connectorStartNodeId, setConnectorStartNodeId] = useState<string | null>(null);
  const [connectorStartPort, setConnectorStartPort] = useState<string>('auto');
  const [tempConnectorEnd, setTempConnectorEnd] = useState<{ x: number; y: number } | null>(null);

  // Inline node editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Inline connector label editing
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [editingConnectorText, setEditingConnectorText] = useState('');

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

  // Global pointer release for node dragging and resizing
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (draggingNodeId || resizingNodeId || isPanning) {
        setIsPanning(false);
        setDraggingNodeId(null);
        setResizingNodeId(null);
        setResizeHandle(null);
        setHasMovedDuringDrag(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
    };
  }, [draggingNodeId, resizingNodeId, isPanning]);

  // Handle Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'pan' || e.button === 1 || (e as any).spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // If connector drawing is active, clicking empty canvas cancels it
    if (connectorStartNodeId) {
      setConnectorStartNodeId(null);
      setTempConnectorEnd(null);
      return;
    }

    // Clicking empty canvas clears selection
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectElement(null);
      onSelectConnector(null);
      setEditingNodeId(null);
      setEditingConnectorId(null);
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

    // Connector drawing preview tracks cursor smoothly
    if (connectorStartNodeId) {
      setTempConnectorEnd(mousePos);
    }

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
  };

  // Handle Mouse Up on Container
  const handleMouseUp = () => {
    if (draggingNodeId && hasMovedDuringDrag) {
      onChange(diagram, true);
    }
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizeHandle(null);
    setHasMovedDuringDrag(false);
  };

  // Node Drag Start
  const startNodeDrag = (e: React.MouseEvent, node: DiagramElement) => {
    e.stopPropagation();

    // If connector tool is actively selecting target
    if (connectorStartNodeId) {
      completeConnectorConnection(node.id, 'auto');
      return;
    }

    onSelectElement(node.id);
    onSelectConnector(null);

    if (activeTool === 'connector') {
      setConnectorStartNodeId(node.id);
      setConnectorStartPort('auto');
      setTempConnectorEnd(screenToCanvas(e.clientX, e.clientY));
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

  // Node Click / Release
  const handleNodeMouseUp = (e: React.MouseEvent, targetNode: DiagramElement) => {
    e.stopPropagation();

    if (connectorStartNodeId && connectorStartNodeId !== targetNode.id) {
      completeConnectorConnection(targetNode.id, 'auto');
      return;
    }

    if (draggingNodeId && hasMovedDuringDrag) {
      onChange(diagram, true);
    }
    setDraggingNodeId(null);
    setHasMovedDuringDrag(false);
  };

  // Complete a new connector
  const completeConnectorConnection = (targetId: string, targetPort: string = 'auto') => {
    if (!connectorStartNodeId || connectorStartNodeId === targetId) {
      setConnectorStartNodeId(null);
      setTempConnectorEnd(null);
      return;
    }

    const newConn: DiagramConnector = {
      id: `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      source_id: connectorStartNodeId,
      target_id: targetId,
      source_handle: connectorStartPort || 'auto',
      target_handle: targetPort || 'auto',
      label: '',
      direction: 'directed',
      routing: 'orthogonal',
      waypoints: [],
      style: {
        stroke: '#2b3a42',
        stroke_width: 2.0,
        arrow_head: 'classic',
        is_dashed: false
      },
      confidence: 1.0,
      uncertainty_status: 'likely_correct',
      provenance: { user_created: true }
    };

    onChange({
      ...diagram,
      connectors: [...diagram.connectors, newConn]
    }, true);

    onSelectConnector(newConn.id);
    onSelectElement(null);
    setConnectorStartNodeId(null);
    setTempConnectorEnd(null);
  };

  // Start connector from explicit anchor port
  const startConnectorFromPort = (e: React.MouseEvent, nodeId: string, portName: string = 'auto') => {
    e.stopPropagation();
    setConnectorStartNodeId(nodeId);
    setConnectorStartPort(portName);
    const mousePos = screenToCanvas(e.clientX, e.clientY);
    setTempConnectorEnd(mousePos);
  };

  // Complete connector when clicking or releasing on target anchor port
  const handlePortMouseUp = (e: React.MouseEvent, targetNodeId: string, portName: string) => {
    e.stopPropagation();
    if (connectorStartNodeId && connectorStartNodeId !== targetNodeId) {
      completeConnectorConnection(targetNodeId, portName);
    }
  };

  // Duplicate selected node
  const handleDuplicateNode = (node: DiagramElement) => {
    const copyNode: DiagramElement = {
      ...node,
      id: `node_${Date.now().toString(36)}`,
      x: node.x + 30,
      y: node.y + 30,
      label: `${node.label} (Copy)`,
      confidence: 1.0
    };
    onChange({
      ...diagram,
      elements: [...diagram.elements, copyNode]
    }, true);
    onSelectElement(copyNode.id);
  };

  // Delete selected element
  const handleDeleteSelected = (nodeId: string) => {
    onChange({
      ...diagram,
      elements: diagram.elements.filter((el) => el.id !== nodeId),
      connectors: diagram.connectors.filter(
        (c) => c.source_id !== nodeId && c.target_id !== nodeId
      )
    }, true);
    onSelectElement(null);
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

  // Inline connector label edit
  const startEditingConnector = (e: React.MouseEvent, conn: DiagramConnector) => {
    e.stopPropagation();
    setEditingConnectorId(conn.id);
    setEditingConnectorText(conn.label);
  };

  const commitEditingConnector = () => {
    if (editingConnectorId) {
      const updatedConnectors = diagram.connectors.map((c) =>
        c.id === editingConnectorId ? { ...c, label: editingConnectorText } : c
      );
      onChange({ ...diagram, connectors: updatedConnectors }, true);
      setEditingConnectorId(null);
    }
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

    if (Math.abs(dx) > Math.abs(dy) * 1.1) {
      if (dx > 0) {
        return { sx: src.x + src.width, sy: srcCy, tx: tgt.x, ty: tgtCy, orientation: 'horizontal' };
      } else {
        return { sx: src.x, sy: srcCy, tx: tgt.x + tgt.width, ty: tgtCy, orientation: 'horizontal' };
      }
    } else {
      if (dy > 0) {
        return { sx: srcCx, sy: src.y + src.height, tx: tgtCx, ty: tgt.y, orientation: 'vertical' };
      } else {
        return { sx: srcCx, sy: src.y, tx: tgtCx, ty: tgt.y + tgt.height, orientation: 'vertical' };
      }
    }
  };

  // Render Chart Data (Bar Chart or Pie Chart)
  const renderChart = () => {
    const cd = diagram.chart_data;
    if (!cd) return null;

    if (cd.chart_type === 'pie') {
      const categories = cd.categories;
      const values = cd.series[0]?.values || [];
      const total = values.reduce((sum, v) => sum + Math.max(0, v), 0) || 1;
      const cx = 450;
      const cy = 340;
      const R = 180;

      let currentAngle = -Math.PI / 2;
      const slices = values.map((val, i) => {
        const sweep = (Math.max(0, val) / total) * 2 * Math.PI;
        const start = currentAngle;
        const end = currentAngle + sweep;
        currentAngle = end;

        const x1 = cx + R * Math.cos(start);
        const y1 = cy + R * Math.sin(start);
        const x2 = cx + R * Math.cos(end);
        const y2 = cy + R * Math.sin(end);
        const largeArc = sweep > Math.PI ? 1 : 0;
        const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        const mid = (start + end) / 2;
        const lx = cx + (R + 32) * Math.cos(mid);
        const ly = cy + (R + 32) * Math.sin(mid);
        const pct = Math.round((Math.max(0, val) / total) * 100);

        return {
          pathD,
          category: categories[i] || `Slice ${i + 1}`,
          value: val,
          pct,
          lx,
          ly,
          color: CHART_COLORS[i % CHART_COLORS.length]
        };
      });

      return (
        <g className="chart-group">
          <text x={cx} y={80} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="600">
            {cd.title || 'Pie Chart'}
          </text>
          {slices.map((s, idx) => (
            <g key={idx} style={{ cursor: 'pointer' }}>
              <path
                d={s.pathD}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth="2.5"
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={s.lx}
                y={s.ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#334155"
                fontSize="12"
                fontWeight="600"
              >
                {s.category} ({s.pct}%)
              </text>
            </g>
          ))}
          <g transform={`translate(${cx + R + 90}, ${cy - 120})`}>
            {slices.map((s, idx) => (
              <g key={idx} transform={`translate(0, ${idx * 28})`}>
                <rect width="14" height="14" rx="3" fill={s.color} />
                <text x="22" y="11" fill="#1e293b" fontSize="13" fontWeight="500">
                  {s.category}: {s.value} ({s.pct}%)
                </text>
              </g>
            ))}
          </g>
        </g>
      );
    } else {
      // Bar Chart
      const categories = cd.categories;
      const values = cd.series[0]?.values || [];
      const originX = 180;
      const originY = 520;
      const plotWidth = 620;
      const plotHeight = 360;
      const maxVal = Math.max(...values, 1) * 1.15;
      const n = Math.max(1, categories.length);
      const barW = Math.min(80, Math.max(28, (plotWidth - 40) / n - 20));
      const gap = (plotWidth - barW * n) / (n + 1);
      const ticks = [0, 0.25, 0.5, 0.75, 1.0];

      return (
        <g className="chart-group">
          <text x={originX + plotWidth / 2} y={80} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="600">
            {cd.title || 'Bar Chart'}
          </text>
          {ticks.map((t, idx) => {
            const gy = originY - t * plotHeight;
            const tickVal = Math.round(t * maxVal);
            return (
              <g key={idx}>
                <line x1={originX} y1={gy} x2={originX + plotWidth} y2={gy} stroke="#e2e8f0" strokeDasharray="3 3" />
                <text x={originX - 12} y={gy + 4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight="500">
                  {tickVal}
                </text>
              </g>
            );
          })}
          <line x1={originX} y1={originY} x2={originX + plotWidth} y2={originY} stroke="#475569" strokeWidth="2" />
          <line x1={originX} y1={originY} x2={originX} y2={originY - plotHeight} stroke="#475569" strokeWidth="2" />
          {categories.map((cat, i) => {
            const val = values[i] ?? 0;
            const barH = (Math.max(0, val) / maxVal) * plotHeight;
            const bx = originX + gap * (i + 1) + barW * i;
            const by = originY - barH;
            const color = CHART_COLORS[i % CHART_COLORS.length];

            return (
              <g key={i}>
                <rect x={bx} y={by} width={barW} height={barH} rx="4" fill={color} />
                <text x={bx + barW / 2} y={by - 8} textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="600">
                  {val}
                </text>
                <text x={bx + barW / 2} y={originY + 20} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="500">
                  {cat}
                </text>
              </g>
            );
          })}
        </g>
      );
    }
  };

  const selectedElement = elementMap.get(selectedElementId || '');

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${activeTool === 'pan' ? 'pan-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ userSelect: 'none', position: 'relative', overflow: 'hidden' }}
    >
      {/* Active Connecting Indicator Banner */}
      {connectorStartNodeId && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 118, 110, 0.92)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}
        >
          <Link2 size={15} />
          <span>Click any target node or handle to connect arrow</span>
          <button
            onClick={() => {
              setConnectorStartNodeId(null);
              setTempConnectorEnd(null);
            }}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <svg
        className="canvas-svg"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <defs>
          {/* Classic Forward Arrowhead */}
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

          {/* Selected Forward Arrowhead */}
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

          {/* Bidirectional Backward Arrowhead */}
          <marker
            id="arrowhead-start"
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill="#2b3a42" />
          </marker>

          {/* Selected Bidirectional Backward Arrowhead */}
          <marker
            id="arrowhead-start-selected"
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill="#0f766e" />
          </marker>
        </defs>

        {/* 1. Render Chart if Diagram is a Data Chart */}
        {diagram.chart_data && renderChart()}

        {/* 2. Render Connectors */}
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
          } else if (conn.routing === 'curved') {
            const midX = (sx + tx) / 2;
            pathD = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
          } else {
            // Orthogonal
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

          // Undirected Plain Line: no arrow markers!
          const isUndirected = conn.direction === 'undirected' || conn.style?.arrow_head === 'none';
          const isBidirectional = conn.direction === 'bidirectional';

          const markerEnd = isUndirected
            ? undefined
            : isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)';

          const markerStart = isBidirectional
            ? isSelected ? 'url(#arrowhead-start-selected)' : 'url(#arrowhead-start)'
            : undefined;

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
              {/* Wide invisible stroke for easy clicking */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
              />
              <path
                d={pathD}
                className={`connector-line ${isSelected ? 'selected' : ''}`}
                stroke={isSelected ? '#0f766e' : conn.style.stroke}
                strokeWidth={isSelected ? 3 : (conn.style.stroke_width || 2)}
                strokeDasharray={conn.style.is_dashed ? '5 4' : 'none'}
                markerEnd={markerEnd}
                markerStart={markerStart}
              />

              {/* Edge Label */}
              {(conn.label || editingConnectorId === conn.id) && (
                <g transform={`translate(${labelX}, ${labelY})`} onDoubleClick={(e) => startEditingConnector(e, conn)}>
                  {editingConnectorId === conn.id ? (
                    <foreignObject x={-40} y={-16} width={80} height={32}>
                      <input
                        autoFocus
                        type="text"
                        value={editingConnectorText}
                        onChange={(e) => setEditingConnectorText(e.target.value)}
                        onBlur={commitEditingConnector}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditingConnector();
                          else if (e.key === 'Escape') setEditingConnectorId(null);
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          fontSize: '11px',
                          textAlign: 'center',
                          border: '1.5px solid #0f766e',
                          borderRadius: '4px',
                          outline: 'none',
                          background: '#ffffff'
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <>
                      <rect
                        x={-28}
                        y={-12}
                        width={56}
                        height={24}
                        className="edge-label-box"
                      />
                      <text className="edge-label-text">{conn.label}</text>
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Temporary dynamic connector line preview while drawing */}
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

        {/* 3. Render Diagram Elements */}
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
                cursor: isDragging ? 'grabbing' : connectorStartNodeId ? 'crosshair' : 'grab'
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
              {el.type === 'decision' || el.type === 'diamond' || el.type === 'relationship' ? (
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
              ) : el.type === 'circle' || el.type === 'attribute' || el.type === 'key_attribute' ? (
                <ellipse
                  cx={el.width / 2}
                  cy={el.height / 2}
                  rx={el.width / 2}
                  ry={el.height / 2}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'final_state' ? (
                <g>
                  <ellipse
                    cx={el.width / 2}
                    cy={el.height / 2}
                    rx={el.width / 2}
                    ry={el.height / 2}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <circle
                    cx={el.width / 2}
                    cy={el.height / 2}
                    r={Math.min(el.width, el.height) * 0.28}
                    fill={isSelected ? '#0f766e' : el.style.stroke}
                  />
                </g>
              ) : el.type === 'database' ? (
                <g>
                  <path
                    d={`M 0 10 L 0 ${el.height - 10} A ${el.width / 2} 10 0 0 0 ${el.width} ${el.height - 10} L ${el.width} 10 Z`}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <ellipse
                    cx={el.width / 2}
                    cy={10}
                    rx={el.width / 2}
                    ry={10}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                </g>
              ) : el.type === 'data_store' ? (
                <g>
                  <rect x={0} y={0} width={el.width} height={el.height} fill={el.style.fill} stroke="none" />
                  <line x1={0} y1={0} x2={el.width} y2={0} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={isSelected ? 2.5 : el.style.stroke_width} />
                  <line x1={0} y1={el.height} x2={el.width} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={isSelected ? 2.5 : el.style.stroke_width} />
                  <line x1={18} y1={0} x2={18} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                </g>
              ) : el.type === 'io' ? (
                <polygon
                  points={`${el.width * 0.15},0 ${el.width},0 ${el.width * 0.85},${el.height} 0,${el.height}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'preparation' ? (
                <polygon
                  points={`${el.width * 0.18},0 ${el.width * 0.82},0 ${el.width},${el.height / 2} ${el.width * 0.82},${el.height} ${el.width * 0.18},${el.height} 0,${el.height / 2}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'manual_operation' ? (
                <polygon
                  points={`0,0 ${el.width},0 ${el.width * 0.82},${el.height} ${el.width * 0.18},${el.height}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'off_page_connector' ? (
                <polygon
                  points={`0,0 ${el.width},0 ${el.width},${el.height * 0.65} ${el.width / 2},${el.height} 0,${el.height * 0.65}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'delay' ? (
                <path
                  d={`M 0 0 L ${el.width - el.height / 2} 0 A ${el.height / 2} ${el.height / 2} 0 0 1 ${el.width - el.height / 2} ${el.height} L 0 ${el.height} Z`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'display' ? (
                <path
                  d={`M ${el.width * 0.15} 0 L ${el.width * 0.82} 0 Q ${el.width} ${el.height / 2} ${el.width * 0.82} ${el.height} L ${el.width * 0.15} ${el.height} L 0 ${el.height / 2} Z`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'merge' ? (
                <polygon
                  points={`0,0 ${el.width},0 ${el.width / 2},${el.height}`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'document' ? (
                <path
                  d={`M 0 0 L ${el.width} 0 L ${el.width} ${el.height - 10} Q ${el.width * 0.75} ${el.height + 2} ${el.width * 0.5} ${el.height - 8} T 0 ${el.height - 4} Z`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'predefined' ? (
                <g>
                  <rect
                    x={0}
                    y={0}
                    width={el.width}
                    height={el.height}
                    rx={4}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <line x1={12} y1={0} x2={12} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                  <line x1={el.width - 12} y1={0} x2={el.width - 12} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                </g>
              ) : el.type === 'cloud' ? (
                <path
                  d={`M ${el.width * 0.22} ${el.height * 0.82} C ${el.width * 0.04} ${el.height * 0.82} ${el.width * 0.04} ${el.height * 0.44} ${el.width * 0.20} ${el.height * 0.44} C ${el.width * 0.14} ${el.height * 0.18} ${el.width * 0.40} ${el.height * 0.08} ${el.width * 0.54} ${el.height * 0.24} C ${el.width * 0.70} ${el.height * 0.08} ${el.width * 0.90} ${el.height * 0.18} ${el.width * 0.86} ${el.height * 0.44} C ${el.width * 0.98} ${el.height * 0.44} ${el.width * 0.98} ${el.height * 0.82} ${el.width * 0.80} ${el.height * 0.82} Z`}
                  fill={el.style.fill}
                  stroke={isSelected ? '#0f766e' : el.style.stroke}
                  strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                />
              ) : el.type === 'server' ? (
                <g>
                  <rect
                    x={0}
                    y={0}
                    width={el.width}
                    height={el.height}
                    rx={6}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <line x1={0} y1={el.height * 0.33} x2={el.width} y2={el.height * 0.33} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1} strokeDasharray="3 2" />
                  <line x1={0} y1={el.height * 0.66} x2={el.width} y2={el.height * 0.66} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1} strokeDasharray="3 2" />
                  <circle cx={10} cy={el.height * 0.16} r={2.5} fill="#10b981" />
                  <circle cx={10} cy={el.height * 0.50} r={2.5} fill="#10b981" />
                  <circle cx={10} cy={el.height * 0.83} r={2.5} fill="#10b981" />
                </g>
              ) : el.type === 'queue' ? (
                <g>
                  <rect
                    x={0}
                    y={0}
                    width={el.width}
                    height={el.height}
                    rx={Math.min(el.height / 2, 16)}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <line x1={el.width * 0.25} y1={0} x2={el.width * 0.25} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                  <line x1={el.width * 0.50} y1={0} x2={el.width * 0.50} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                  <line x1={el.width * 0.75} y1={0} x2={el.width * 0.75} y2={el.height} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={1.5} />
                </g>
              ) : el.type === 'actor' ? (
                <g>
                  <rect x={0} y={0} width={el.width} height={el.height} rx={8} fill={el.style.fill} stroke={isSelected ? '#0f766e' : '#cbd5e1'} strokeWidth={1.5} strokeDasharray={isSelected ? 'none' : '4 3'} />
                  <circle cx={el.width / 2} cy={16} r={9} fill="none" stroke={el.style.stroke} strokeWidth={2} />
                  <line x1={el.width / 2} y1={25} x2={el.width / 2} y2={44} stroke={el.style.stroke} strokeWidth={2} />
                  <line x1={el.width / 2 - 14} y1={32} x2={el.width / 2 + 14} y2={32} stroke={el.style.stroke} strokeWidth={2} />
                  <line x1={el.width / 2} y1={44} x2={el.width / 2 - 10} y2={el.height - 8} stroke={el.style.stroke} strokeWidth={2} />
                  <line x1={el.width / 2} y1={44} x2={el.width / 2 + 10} y2={el.height - 8} stroke={el.style.stroke} strokeWidth={2} />
                </g>
              ) : el.type === 'package' ? (
                <g>
                  <path d="M 0 12 L 0 0 L 36 0 L 44 12 Z" fill={el.style.fill} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={isSelected ? 2.5 : el.style.stroke_width} />
                  <rect x={0} y={12} width={el.width} height={el.height - 12} rx={4} fill={el.style.fill} stroke={isSelected ? '#0f766e' : el.style.stroke} strokeWidth={isSelected ? 2.5 : el.style.stroke_width} />
                </g>
              ) : el.type === 'card' ? (
                <g>
                  <rect
                    x={0}
                    y={0}
                    width={el.width}
                    height={el.height}
                    rx={6}
                    fill={el.style.fill}
                    stroke={isSelected ? '#0f766e' : el.style.stroke}
                    strokeWidth={isSelected ? 2.5 : el.style.stroke_width}
                  />
                  <rect x={0} y={0} width={el.width} height={5} rx={3} fill="#0f766e" />
                </g>
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

              {/* Selection Box & Resize Corners */}
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

              {/* 4 Interactive Connection Ports (Top, Right, Bottom, Left) */}
              {(isSelected || isHovered || connectorStartNodeId) && (
                <>
                  {[
                    { name: 'top', cx: el.width / 2, cy: 0 },
                    { name: 'right', cx: el.width, cy: el.height / 2 },
                    { name: 'bottom', cx: el.width / 2, cy: el.height },
                    { name: 'left', cx: 0, cy: el.height / 2 }
                  ].map((port) => (
                    <g key={port.name}>
                      {/* Outer pulse & hit zone */}
                      <circle
                        cx={port.cx}
                        cy={port.cy}
                        r={8}
                        fill="transparent"
                        stroke="#0f766e"
                        strokeWidth="1.5"
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={(e) => startConnectorFromPort(e, el.id, port.name)}
                        onMouseUp={(e) => handlePortMouseUp(e, el.id, port.name)}
                      />
                      {/* Center dot */}
                      <circle
                        cx={port.cx}
                        cy={port.cy}
                        r={3.5}
                        fill="#0f766e"
                        style={{ cursor: 'crosshair', pointerEvents: 'none' }}
                      />
                    </g>
                  ))}
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Action Bar above selected node */}
      {selectedElement && !connectorStartNodeId && (
        <div
          style={{
            position: 'absolute',
            left: `${selectedElement.x * zoom + pan.x}px`,
            top: `${(selectedElement.y - 38) * zoom + pan.y}px`,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '6px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '2px 4px',
            zIndex: 50
          }}
        >
          <button
            className="btn-icon"
            onClick={(e) => startConnectorFromPort(e, selectedElement.id, 'right')}
            title="Add Arrow from this node"
            style={{ color: 'var(--accent-primary)', padding: '4px' }}
          >
            <ArrowRight size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={() => handleDuplicateNode(selectedElement)}
            title="Duplicate Node"
            style={{ padding: '4px' }}
          >
            <Copy size={13} />
          </button>
          <button
            className="btn-icon"
            onClick={() => handleDeleteSelected(selectedElement.id)}
            title="Delete Node (Del)"
            style={{ color: 'var(--color-error)', padding: '4px' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
