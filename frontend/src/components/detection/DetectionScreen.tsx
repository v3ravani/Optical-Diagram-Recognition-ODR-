import React, { useState, useRef, useEffect } from 'react';
import { DiagramRegion, DiagramFamily, CanonicalDiagram } from '../../types/diagram';
import { api } from '../../services/api';
import {
  CheckSquare,
  Square,
  Crop,
  RotateCcw,
  Sparkles,
  GitFork,
  Network,
  ArrowRightLeft,
  Database,
  BarChart2,
  PieChart,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  AlertTriangle,
  Move
} from 'lucide-react';

interface DetectionScreenProps {
  projectId: string;
  sourcePreviewUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  regions: DiagramRegion[];
  onRegionsChange: (regions: DiagramRegion[]) => void;
  onRecognitionComplete: (diagram: CanonicalDiagram) => void;
  onCancel: () => void;
}

const DIAGRAM_TYPES: Array<{
  id: DiagramFamily;
  title: string;
  badge: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'flowchart',
    title: 'Flowchart',
    badge: 'High Accuracy',
    desc: 'Processes, decisions, loops, merges, parallel arrows & crossing lines',
    icon: <GitFork size={16} />
  },
  {
    id: 'dfd',
    title: 'Data Flow Diagram (DFD)',
    badge: 'Specialized',
    desc: 'External entities, numbered processes, data stores & directed flows',
    icon: <Network size={16} />
  },
  {
    id: 'sequence',
    title: 'Sequence Diagram',
    badge: 'Chronological',
    desc: 'Participants, vertical lifelines, synchronous messages & return calls',
    icon: <ArrowRightLeft size={16} />
  },
  {
    id: 'erd',
    title: 'Entity-Relationship (ERD)',
    badge: 'Data Model',
    desc: 'Entities, key/regular attributes, relationship diamonds & links',
    icon: <Database size={16} />
  },
  {
    id: 'bar_chart',
    title: 'Bar Chart',
    badge: 'Data Fidelity',
    desc: 'Numerical scales, vertical/horizontal bars, categories & series',
    icon: <BarChart2 size={16} />
  },
  {
    id: 'pie_chart',
    title: 'Pie Chart',
    badge: 'Proportions',
    desc: 'Radial slices, percentages, proportions & category labels',
    icon: <PieChart size={16} />
  }
];

export const DetectionScreen: React.FC<DetectionScreenProps> = ({
  projectId,
  sourcePreviewUrl,
  sourceWidth,
  sourceHeight,
  regions,
  onRegionsChange,
  onRecognitionComplete,
  onCancel
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    regions.length > 0 ? regions[0].id : null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isDrawingNewCrop, setIsDrawingNewCrop] = useState(false);
  const [cropDrawStart, setCropDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempDrawCrop, setTempDrawCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Resize / move handle dragging state
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [initialRegionBox, setInitialRegionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) || regions[0] || null;

  // Toggle selection checkbox
  const toggleSelectRegion = (id: string) => {
    onRegionsChange(
      regions.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  // Select all or Clear all
  const selectAll = (select: boolean) => {
    onRegionsChange(regions.map((r) => ({ ...r, selected: select })));
  };

  // Remove region
  const removeRegion = (id: string) => {
    const updated = regions.filter((r) => r.id !== id);
    onRegionsChange(updated);
    if (selectedRegionId === id) {
      setSelectedRegionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Change diagram type
  const handleSelectType = (newType: DiagramFamily) => {
    if (!selectedRegionId) return;
    onRegionsChange(
      regions.map((r) =>
        r.id === selectedRegionId
          ? { ...r, suggested_type: newType, suggested_subtype: newType }
          : r
      )
    );
  };

  // Reset Crop to full original image
  const handleResetCropToFull = () => {
    if (!selectedRegionId) return;
    onRegionsChange(
      regions.map((r) =>
        r.id === selectedRegionId
          ? { ...r, x: 0, y: 0, width: sourceWidth, height: sourceHeight, is_manual_crop: true }
          : r
      )
    );
  };

  // Update region box bounds with clamping
  const updateSelectedRegionBox = (box: { x: number; y: number; w: number; h: number }) => {
    if (!selectedRegionId) return;
    const clampedX = Math.max(0, Math.min(box.x, sourceWidth - 20));
    const clampedY = Math.max(0, Math.min(box.y, sourceHeight - 20));
    const clampedW = Math.max(20, Math.min(box.w, sourceWidth - clampedX));
    const clampedH = Math.max(20, Math.min(box.h, sourceHeight - clampedY));

    onRegionsChange(
      regions.map((r) =>
        r.id === selectedRegionId
          ? {
              ...r,
              x: Math.round(clampedX),
              y: Math.round(clampedY),
              width: Math.round(clampedW),
              height: Math.round(clampedH),
              is_manual_crop: true
            }
          : r
      )
    );
  };

  // Handle pointer down on resize handles or body
  const handleHandlePointerDown = (e: React.PointerEvent, handleName: string) => {
    e.stopPropagation();
    if (!selectedRegion) return;
    setActiveHandle(handleName);
    setDragStartPoint({ x: e.clientX, y: e.clientY });
    setInitialRegionBox({
      x: selectedRegion.x,
      y: selectedRegion.y,
      w: selectedRegion.width,
      h: selectedRegion.height
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHandlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragStartPoint || !initialRegionBox || !imageElementRef.current) return;
    const imgRect = imageElementRef.current.getBoundingClientRect();
    const scaleX = sourceWidth / imgRect.width;
    const scaleY = sourceHeight / imgRect.height;

    const dx = (e.clientX - dragStartPoint.x) * scaleX;
    const dy = (e.clientY - dragStartPoint.y) * scaleY;

    let { x, y, w, h } = initialRegionBox;

    if (activeHandle === 'move') {
      x += dx;
      y += dy;
    } else {
      if (activeHandle.includes('e')) w += dx;
      if (activeHandle.includes('s')) h += dy;
      if (activeHandle.includes('w')) {
        const newW = w - dx;
        if (newW > 20) {
          x += dx;
          w = newW;
        }
      }
      if (activeHandle.includes('n')) {
        const newH = h - dy;
        if (newH > 20) {
          y += dy;
          h = newH;
        }
      }
    }

    updateSelectedRegionBox({ x, y, w, h });
  };

  const handleHandlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setActiveHandle(null);
      setDragStartPoint(null);
      setInitialRegionBox(null);
    }
  };

  // Drawing new crop
  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingNewCrop || !imageElementRef.current) return;
    const rect = imageElementRef.current.getBoundingClientRect();
    const scaleX = sourceWidth / rect.width;
    const scaleY = sourceHeight / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setCropDrawStart({ x, y });
    setTempDrawCrop({ x, y, w: 0, h: 0 });
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingNewCrop || !cropDrawStart || !imageElementRef.current) return;
    const rect = imageElementRef.current.getBoundingClientRect();
    const scaleX = sourceWidth / rect.width;
    const scaleY = sourceHeight / rect.height;

    const currentX = Math.round((e.clientX - rect.left) * scaleX);
    const currentY = Math.round((e.clientY - rect.top) * scaleY);

    const x = Math.min(cropDrawStart.x, currentX);
    const y = Math.min(cropDrawStart.y, currentY);
    const w = Math.abs(currentX - cropDrawStart.x);
    const h = Math.abs(currentY - cropDrawStart.y);

    setTempDrawCrop({ x, y, w, h });
  };

  const handleImageMouseUp = () => {
    if (isDrawingNewCrop && tempDrawCrop && tempDrawCrop.w > 30 && tempDrawCrop.h > 30) {
      const newRegion: DiagramRegion = {
        id: `reg_${Date.now().toString(36)}`,
        file_name: regions[0]?.file_name || 'source_image.png',
        page_number: 1,
        x: tempDrawCrop.x,
        y: tempDrawCrop.y,
        width: tempDrawCrop.w,
        height: tempDrawCrop.h,
        confidence: 1.0,
        suggested_type: selectedRegion?.suggested_type || 'flowchart',
        suggested_subtype: selectedRegion?.suggested_subtype || 'flowchart',
        label: `Region ${regions.length + 1}`,
        selected: true,
        is_manual_crop: true
      };

      onRegionsChange([...regions, newRegion]);
      setSelectedRegionId(newRegion.id);
      setIsDrawingNewCrop(false);
    }
    setCropDrawStart(null);
    setTempDrawCrop(null);
  };

  // Recognize Selected Diagram
  const handleRecognize = async () => {
    if (!selectedRegion) {
      alert('Please select a diagram region to recognize.');
      return;
    }

    setIsProcessing(true);
    try {
      setCurrentStage(`Stage 1/5: Normalizing cropped image resolution (${selectedRegion.width}x${selectedRegion.height})...`);
      await new Promise((r) => setTimeout(r, 350));

      setCurrentStage('Stage 2/5: Extracting text & labels with local RapidOCR ONNX engine...');
      await new Promise((r) => setTimeout(r, 450));

      const typeName = DIAGRAM_TYPES.find((t) => t.id === selectedRegion.suggested_type)?.title || 'Flowchart';
      setCurrentStage(`Stage 3/5: Applying ${typeName}-specific semantic structural recognition...`);
      await new Promise((r) => setTimeout(r, 400));

      setCurrentStage('Stage 4/5: Tracing connectors, arrows, crossings, and feedback loops...');
      const diagram = await api.recognizeRegion(projectId, selectedRegion);

      setCurrentStage('Stage 5/5: Validating graph topology and generating exports...');
      await new Promise((r) => setTimeout(r, 300));

      onRecognitionComplete(diagram);
    } catch (err: any) {
      alert(`Recognition failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStage('');
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--bg-app)', overflow: 'hidden' }}>
      {/* Left Main Viewport: Source Preview with Interactive Draggable Crop Box */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-subtle)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top Workspace Toolbar */}
        <div
          style={{
            height: '46px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Interactive Crop & Pre-Recognition</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Original: {sourceWidth} × {sourceHeight} px
            </span>
          </div>

          {/* Zoom and Crop Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.2) * 10) / 10))}
              title="Zoom out"
              style={{ padding: '4px 8px' }}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '11px', minWidth: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))}
              title="Zoom in"
              style={{ padding: '4px 8px' }}
            >
              <ZoomIn size={14} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setZoomLevel(1.0)}
              title="Fit to Screen (100%)"
              style={{ padding: '4px 8px' }}
            >
              <Maximize2 size={14} />
            </button>

            <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

            <button
              className="btn btn-secondary"
              onClick={handleResetCropToFull}
              title="Reset crop to the full original image"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <RotateCcw size={14} />
              <span>Reset to Full Page</span>
            </button>

            <button
              className={`btn btn-secondary ${isDrawingNewCrop ? 'btn-primary' : ''}`}
              onClick={() => setIsDrawingNewCrop(!isDrawingNewCrop)}
              title="Click and drag to draw a new crop region"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Crop size={14} />
              <span>{isDrawingNewCrop ? 'Cancel Draw' : 'New Crop Box'}</span>
            </button>
          </div>
        </div>

        {/* Viewport Canvas Area */}
        <div
          ref={previewContainerRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'auto',
            background: '#090d16',
            position: 'relative'
          }}
        >
          <div
            onMouseDown={handleImageMouseDown}
            onMouseMove={handleImageMouseMove}
            onMouseUp={handleImageMouseUp}
            style={{
              position: 'relative',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
              cursor: isDrawingNewCrop ? 'crosshair' : 'default',
              userSelect: 'none',
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease'
            }}
          >
            <img
              ref={imageElementRef}
              src={sourcePreviewUrl}
              alt="Source document"
              style={{
                display: 'block',
                maxHeight: '74vh',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
            />

            {/* Region Overlays & Interactive Crop Handles */}
            {imageElementRef.current &&
              regions.map((region) => {
                const imgEl = imageElementRef.current;
                if (!imgEl) return null;
                const rect = imgEl.getBoundingClientRect();
                const scaleX = rect.width / (sourceWidth * zoomLevel);
                const scaleY = rect.height / (sourceHeight * zoomLevel);

                const rx = region.x * scaleX;
                const ry = region.y * scaleY;
                const rw = region.width * scaleX;
                const rh = region.height * scaleY;
                const isSelected = selectedRegionId === region.id;

                return (
                  <div
                    key={region.id}
                    onClick={() => setSelectedRegionId(region.id)}
                    style={{
                      position: 'absolute',
                      left: `${rx}px`,
                      top: `${ry}px`,
                      width: `${rw}px`,
                      height: `${rh}px`,
                      border: isSelected ? '2px solid #0f766e' : '1.5px dashed rgba(56, 189, 248, 0.6)',
                      backgroundColor: isSelected ? 'rgba(15, 118, 110, 0.18)' : 'rgba(56, 189, 248, 0.06)',
                      borderRadius: '2px',
                      cursor: isSelected ? 'default' : 'pointer',
                      zIndex: isSelected ? 5 : 2
                    }}
                  >
                    {/* Region Label Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-22px',
                        left: '0',
                        backgroundColor: isSelected ? '#0f766e' : '#0284c7',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{region.label}</span>
                      <span style={{ opacity: 0.8, fontSize: '10px' }}>
                        ({region.width}×{region.height})
                      </span>
                    </div>

                    {/* 8 Resizing Handles & Move Body (Active for Selected Region) */}
                    {isSelected && (
                      <>
                        {/* Draggable body handle for moving */}
                        <div
                          onPointerDown={(e) => handleHandlePointerDown(e, 'move')}
                          onPointerMove={handleHandlePointerMove}
                          onPointerUp={handleHandlePointerUp}
                          title="Click and drag to move crop box"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: '#0f766e',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'move',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                          }}
                        >
                          <Move size={14} />
                        </div>

                        {/* 8 Draggable Corner & Edge Handles */}
                        {[
                          { name: 'nw', top: -5, left: -5, cursor: 'nwse-resize' },
                          { name: 'n', top: -5, left: '50%', cursor: 'ns-resize' },
                          { name: 'ne', top: -5, right: -5, cursor: 'nesw-resize' },
                          { name: 'e', top: '50%', right: -5, cursor: 'ew-resize' },
                          { name: 'se', bottom: -5, right: -5, cursor: 'nwse-resize' },
                          { name: 's', bottom: -5, left: '50%', cursor: 'ns-resize' },
                          { name: 'sw', bottom: -5, left: -5, cursor: 'nesw-resize' },
                          { name: 'w', top: '50%', left: -5, cursor: 'ew-resize' }
                        ].map((h) => {
                          const style: React.CSSProperties = {
                            position: 'absolute',
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#ffffff',
                            border: '2px solid #0f766e',
                            borderRadius: '2px',
                            cursor: h.cursor,
                            zIndex: 10
                          };
                          if (h.top !== undefined) style.top = h.top === '50%' ? 'calc(50% - 5px)' : `${h.top}px`;
                          if (h.bottom !== undefined) style.bottom = `${h.bottom}px`;
                          if (h.left !== undefined) style.left = h.left === '50%' ? 'calc(50% - 5px)' : `${h.left}px`;
                          if (h.right !== undefined) style.right = `${h.right}px`;

                          return (
                            <div
                              key={h.name}
                              onPointerDown={(e) => handleHandlePointerDown(e, h.name)}
                              onPointerMove={handleHandlePointerMove}
                              onPointerUp={handleHandlePointerUp}
                              style={style}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}

            {/* In-progress drawing crop rectangle */}
            {tempDrawCrop && imageElementRef.current && (
              (() => {
                const imgEl = imageElementRef.current;
                const rect = imgEl.getBoundingClientRect();
                const scaleX = rect.width / (sourceWidth * zoomLevel);
                const scaleY = rect.height / (sourceHeight * zoomLevel);
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tempDrawCrop.x * scaleX}px`,
                      top: `${tempDrawCrop.y * scaleY}px`,
                      width: `${tempDrawCrop.w * scaleX}px`,
                      height: `${tempDrawCrop.h * scaleY}px`,
                      border: '2px dashed #f59e0b',
                      backgroundColor: 'rgba(245, 158, 11, 0.25)',
                      pointerEvents: 'none',
                      zIndex: 8
                    }}
                  />
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Right Control Panel: Diagram Type Selection & Recognition Configuration */}
      <div
        style={{
          width: '390px',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-subtle)',
          overflowY: 'auto'
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Diagram Type & Crop</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Step 1 of 2: Guide recognition engine
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => selectAll(true)}
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              Select All
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => selectAll(false)}
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Selected Crop Area Coordinates Card */}
        {selectedRegion && (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Active Crop Box
              </span>
              <button
                className="btn-icon"
                onClick={() => removeRegion(selectedRegion.id)}
                title="Delete this region"
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { label: 'X', val: selectedRegion.x },
                { label: 'Y', val: selectedRegion.y },
                { label: 'Width', val: selectedRegion.width },
                { label: 'Height', val: selectedRegion.height }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explicit 6-Option Diagram Type Selection */}
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
              Select Diagram Type
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ODR deploys a specialized recognition pipeline tailored to each diagram family.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DIAGRAM_TYPES.map((dt) => {
              const isSelected = selectedRegion?.suggested_type === dt.id;

              return (
                <div
                  key={dt.id}
                  onClick={() => handleSelectType(dt.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        {dt.icon}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 500 }}>
                        {dt.title}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(15, 118, 110, 0.2)' : 'var(--bg-subtle)',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'
                      }}
                    >
                      {dt.badge}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                    {dt.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {isProcessing ? (
            <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
              <div style={{ marginBottom: '6px' }}>{currentStage}</div>
              <div style={{ width: '100%', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '70%', height: '100%', background: 'var(--accent-primary)', animation: 'pulse 1s infinite' }} />
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleRecognize}
              disabled={isProcessing || !selectedRegion}
              style={{ width: '100%', padding: '11px', fontSize: '14px', gap: '8px' }}
            >
              <Sparkles size={16} />
              <span>Recognize Selected Region</span>
            </button>
          )}

          <button className="btn btn-secondary" onClick={onCancel} disabled={isProcessing} style={{ width: '100%', fontSize: '12px' }}>
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
};
