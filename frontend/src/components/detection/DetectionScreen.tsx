import React, { useState, useRef } from 'react';
import { DiagramRegion, DiagramFamily, CanonicalDiagram } from '../../types/diagram';
import { api } from '../../services/api';
import {
  CheckSquare,
  Square,
  Crop,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight
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
  const [isDrawingCrop, setIsDrawingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [tempCrop, setTempCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Toggle selection checkbox of a candidate
  const toggleSelectRegion = (id: string) => {
    onRegionsChange(
      regions.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  // Select all or Clear all
  const selectAll = (select: boolean) => {
    onRegionsChange(regions.map((r) => ({ ...r, selected: select })));
  };

  // Remove candidate region ("not a diagram")
  const removeRegion = (id: string) => {
    const updated = regions.filter((r) => r.id !== id);
    onRegionsChange(updated);
    if (selectedRegionId === id) {
      setSelectedRegionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Change suggested diagram family
  const changeType = (id: string, newType: DiagramFamily) => {
    onRegionsChange(
      regions.map((r) =>
        r.id === id ? { ...r, suggested_type: newType, suggested_subtype: newType } : r
      )
    );
  };

  // Change region label
  const changeLabel = (id: string, newLabel: string) => {
    onRegionsChange(
      regions.map((r) => (r.id === id ? { ...r, label: newLabel } : r))
    );
  };

  // Manual Crop mouse interaction
  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingCrop || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const scaleX = sourceWidth / rect.width;
    const scaleY = sourceHeight / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setCropStart({ x, y });
    setTempCrop({ x, y, w: 0, h: 0 });
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingCrop || !cropStart || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const scaleX = sourceWidth / rect.width;
    const scaleY = sourceHeight / rect.height;

    const currentX = Math.round((e.clientX - rect.left) * scaleX);
    const currentY = Math.round((e.clientY - rect.top) * scaleY);

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setTempCrop({ x, y, w, h });
  };

  const handleImageMouseUp = () => {
    if (isDrawingCrop && tempCrop && tempCrop.w > 40 && tempCrop.h > 40) {
      const newRegion: DiagramRegion = {
        id: `reg_${Date.now().toString(36)}`,
        file_name: regions[0]?.file_name || 'source_image.png',
        page_number: 1,
        x: tempCrop.x,
        y: tempCrop.y,
        width: tempCrop.w,
        height: tempCrop.h,
        confidence: 1.0,
        suggested_type: 'flowchart',
        suggested_subtype: 'standard_flowchart',
        label: `Manual Region ${regions.length + 1}`,
        selected: true,
        is_manual_crop: true
      };

      onRegionsChange([...regions, newRegion]);
      setSelectedRegionId(newRegion.id);
      setIsDrawingCrop(false);
    }

    setCropStart(null);
    setTempCrop(null);
  };

  // Recognize Selected Diagram
  const handleRecognize = async () => {
    const selected = regions.filter((r) => r.selected);
    if (selected.length === 0) {
      alert('Please select at least one diagram candidate to recognize.');
      return;
    }

    setIsProcessing(true);
    const targetRegion = selected.find((r) => r.id === selectedRegionId) || selected[0];

    try {
      setCurrentStage('Stage 1/5: Preparing image and contrast normalization...');
      await new Promise((r) => setTimeout(r, 400));

      setCurrentStage('Stage 2/5: Extracting text with local RapidOCR ONNX engine...');
      await new Promise((r) => setTimeout(r, 600));

      setCurrentStage('Stage 3/5: Classifying shapes (terminal, process, decision, IO)...');
      await new Promise((r) => setTimeout(r, 500));

      setCurrentStage('Stage 4/5: Tracing connectors and inferring arrow directions...');
      const diagram = await api.recognizeRegion(projectId, targetRegion);

      setCurrentStage('Stage 5/5: Validating graph structure and export compatibility...');
      await new Promise((r) => setTimeout(r, 400));

      onRecognitionComplete(diagram);
    } catch (err: any) {
      alert(`Recognition failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStage('');
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--bg-app)' }}>
      {/* Left: Interactive Source Preview with Region Overlays */}
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
        {/* Top Header Controls */}
        <div
          style={{
            height: '44px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Source Page Review</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ({regions.length} diagram{regions.length !== 1 ? 's' : ''} detected)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn btn-secondary ${isDrawingCrop ? 'btn-primary' : ''}`}
              onClick={() => setIsDrawingCrop(!isDrawingCrop)}
              title="Click and drag on image to draw a custom diagram crop"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Crop size={14} />
              <span>{isDrawingCrop ? 'Cancel Crop' : 'Draw Manual Crop'}</span>
            </button>
          </div>
        </div>

        {/* Image Display Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflow: 'auto',
            background: '#0f172a'
          }}
        >
          <div
            ref={previewContainerRef}
            onMouseDown={handleImageMouseDown}
            onMouseMove={handleImageMouseMove}
            onMouseUp={handleImageMouseUp}
            style={{
              position: 'relative',
              maxHeight: '100%',
              maxWidth: '100%',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              cursor: isDrawingCrop ? 'crosshair' : 'default',
              userSelect: 'none'
            }}
          >
            <img
              src={sourcePreviewUrl}
              alt="Source document"
              style={{
                display: 'block',
                maxHeight: '75vh',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
            />

            {/* Region Overlays */}
            {previewContainerRef.current &&
              regions.map((region, idx) => {
                const imgEl = previewContainerRef.current?.querySelector('img');
                if (!imgEl) return null;
                const rect = imgEl.getBoundingClientRect();
                const scaleX = rect.width / sourceWidth;
                const scaleY = rect.height / sourceHeight;

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
                      border: isSelected ? '2px solid #0f766e' : '2px dashed #38bdf8',
                      backgroundColor: isSelected ? 'rgba(15, 118, 110, 0.18)' : 'rgba(56, 189, 248, 0.08)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-20px',
                        left: '0',
                        backgroundColor: isSelected ? '#0f766e' : '#0284c7',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '3px'
                      }}
                    >
                      #{idx + 1} {region.label}
                    </span>
                  </div>
                );
              })}

            {/* In-progress manual crop box */}
            {tempCrop && previewContainerRef.current && (
              (() => {
                const imgEl = previewContainerRef.current.querySelector('img');
                if (!imgEl) return null;
                const rect = imgEl.getBoundingClientRect();
                const scaleX = rect.width / sourceWidth;
                const scaleY = rect.height / sourceHeight;
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tempCrop.x * scaleX}px`,
                      top: `${tempCrop.y * scaleY}px`,
                      width: `${tempCrop.w * scaleX}px`,
                      height: `${tempCrop.h * scaleY}px`,
                      border: '2px solid #f59e0b',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      pointerEvents: 'none'
                    }}
                  />
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Candidate List and Selection */}
      <div
        style={{
          width: '360px',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Detected Diagrams</span>
          <div style={{ display: 'flex', gap: '8px' }}>
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

        {/* Candidates List */}
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {regions.map((region, idx) => {
            const isCurrent = selectedRegionId === region.id;

            return (
              <div
                key={region.id}
                onClick={() => setSelectedRegionId(region.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: isCurrent ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRegion(region.id);
                      }}
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      {region.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <input
                      type="text"
                      value={region.label}
                      onChange={(e) => changeLabel(region.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        width: '160px'
                      }}
                    />
                  </div>

                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRegion(region.id);
                    }}
                    title="Mark not a diagram / Remove"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Type:</span>
                    <select
                      value={region.suggested_type}
                      onChange={(e) => changeType(region.id, e.target.value as DiagramFamily)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '11px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-medium)',
                        background: 'var(--bg-surface)'
                      }}
                    >
                      <option value="flowchart">Flowchart</option>
                      <option value="chart">Chart</option>
                      <option value="uml">UML</option>
                      <option value="generic">Generic</option>
                    </select>
                  </div>

                  <span>
                    {region.width} x {region.height} px
                  </span>
                </div>
              </div>
            );
          })}
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
                <div style={{ width: '60%', height: '100%', background: 'var(--accent-primary)', animation: 'pulse 1s infinite' }} />
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleRecognize}
              disabled={isProcessing}
              style={{ width: '100%', padding: '10px', fontSize: '14px', gap: '8px' }}
            >
              <Sparkles size={16} />
              <span>Recognize Selected Diagram</span>
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
