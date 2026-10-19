import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CanonicalDiagram,
  DiagramElement,
  DiagramConnector,
  DiagramRegion,
  ProjectMetadata,
  ProjectData,
  ElementType
} from './types/diagram';
import { api } from './services/api';

// Components
import { DiagramCanvas } from './components/canvas/DiagramCanvas';
import { ShapePalette } from './components/editor/ShapePalette';
import { Toolbar } from './components/editor/Toolbar';
import { PropertyInspector } from './components/editor/PropertyInspector';
import { BottomDrawer } from './components/editor/BottomDrawer';
import { DetectionScreen } from './components/detection/DetectionScreen';
import { ReviewWorkspace } from './components/review/ReviewWorkspace';
import { ExportModal } from './components/export/ExportModal';
import { VersionHistoryModal } from './components/history/VersionHistoryModal';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
import { SettingsModal } from './components/settings/SettingsModal';
import { HelpModal } from './components/help/HelpModal';

// Icons
import {
  Upload,
  FolderOpen,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Settings,
  Layers,
  History,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

export function App() {
  // Navigation & View Mode
  const [currentNav, setCurrentNav] = useState<'workspace' | 'projects'>('workspace');
  const [viewState, setViewState] = useState<'empty' | 'detection' | 'review' | 'editor'>('empty');

  // Project & Diagram State
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectData | null>(null);
  const [diagram, setDiagram] = useState<CanonicalDiagram | null>(null);

  // Undo / Redo Session Stacks
  const [undoStack, setUndoStack] = useState<CanonicalDiagram[]>([]);
  const [redoStack, setRedoStack] = useState<CanonicalDiagram[]>([]);

  // Selection & Tools
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'connector' | 'text'>('select');

  // Canvas Viewport
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Detection State
  const [detectionRegions, setDetectionRegions] = useState<DiagramRegion[]>([]);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>('');
  const [sourceDimensions, setSourceDimensions] = useState({ width: 1200, height: 900 });

  // Drawer & Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const saveTimeoutRef = useRef<number | null>(null);

  // Load Projects on Initial Mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projs = await api.listProjects();
      setProjects(projs);
      if (projs.length > 0 && !activeProject) {
        // Open the most recent project
        openProject(projs[0].id);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  };

  const openProject = async (projectId: string) => {
    try {
      const proj = await api.getProject(projectId);
      setActiveProject(proj);
      const diagramIds = Object.keys(proj.diagrams);
      if (diagramIds.length > 0) {
        const activeDiagId = proj.metadata.active_diagram_id || diagramIds[0];
        const loadedDiag = proj.diagrams[activeDiagId];
        setDiagram(loadedDiag);
        setViewState('editor');
      } else {
        setDiagram(null);
        setViewState('empty');
      }
      setCurrentNav('workspace');
    } catch (e) {
      console.error('Failed to open project:', e);
    }
  };

  const handleCreateProject = async (name: string) => {
    try {
      const proj = await api.createProject(name);
      setActiveProject(proj);
      setDiagram(null);
      setViewState('empty');
      setCurrentNav('workspace');
      loadProjects();
    } catch (e) {
      console.error('Failed to create project:', e);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      if (activeProject?.metadata.id === projectId) {
        setActiveProject(null);
        setDiagram(null);
        setViewState('empty');
      }
      loadProjects();
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const handleLoadSampleProject = async () => {
    try {
      const proj = await api.createSampleProject();
      setActiveProject(proj);
      const diagIds = Object.keys(proj.diagrams);
      if (diagIds.length > 0) {
        setDiagram(proj.diagrams[diagIds[0]]);
        setViewState('editor');
      }
      setCurrentNav('workspace');
      loadProjects();
    } catch (e) {
      console.error('Failed to load sample project:', e);
    }
  };

  // Diagram Changes with Undo/Redo & Auto-Save
  const updateDiagram = useCallback(
    (newDiagram: CanonicalDiagram, pushHistory: boolean = true) => {
      if (diagram && pushHistory) {
        setUndoStack((prev) => [...prev.slice(-30), diagram]);
        setRedoStack([]);
      }

      setDiagram(newDiagram);
      setSaveStatus('saving');

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(async () => {
        if (!activeProject) return;
        try {
          const updatedProject: ProjectData = {
            ...activeProject,
            diagrams: {
              ...activeProject.diagrams,
              [newDiagram.id]: newDiagram
            }
          };
          await api.saveProject(updatedProject);
          setActiveProject(updatedProject);
          setSaveStatus('saved');
        } catch (e) {
          console.error('Auto-save failed:', e);
          setSaveStatus('failed');
        }
      }, 1000);
    },
    [diagram, activeProject]
  );

  const handleUndo = () => {
    if (undoStack.length === 0 || !diagram) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, diagram]);
    setDiagram(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !diagram) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, diagram]);
    setDiagram(next);
  };

  // Shape Palette Add Shape
  const handleAddShape = (type: ElementType, label: string) => {
    if (!diagram) return;
    const newElement: DiagramElement = {
      id: `node_${Date.now().toString(36)}`,
      type,
      role: type === 'terminal' ? 'start' : type === 'decision' ? 'decision' : 'process',
      label,
      raw_text: label,
      x: 350 - pan.x / zoom,
      y: 250 - pan.y / zoom,
      width: type === 'decision' ? 140 : 150,
      height: type === 'decision' ? 80 : 65,
      style: {
        fill: '#ffffff',
        stroke: '#2b3a42',
        stroke_width: 2,
        text_color: '#1e293b',
        font_size: 14,
        text_align: 'center',
        is_dashed: false,
        corner_radius: type === 'terminal' ? 24 : 4
      },
      confidence: 1.0,
      uncertainty_status: 'likely_correct',
      provenance: { user_created: true }
    };

    updateDiagram({
      ...diagram,
      elements: [...diagram.elements, newElement]
    });
    setSelectedElementId(newElement.id);
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    if (!diagram) return;
    updateDiagram({
      ...diagram,
      elements: diagram.elements.filter((el) => el.id !== id),
      connectors: diagram.connectors.filter(
        (c) => c.source_id !== id && c.target_id !== id
      )
    });
    setSelectedElementId(null);
  };

  // Delete Connector
  const handleDeleteConnector = (id: string) => {
    if (!diagram) return;
    updateDiagram({
      ...diagram,
      connectors: diagram.connectors.filter((c) => c.id !== id)
    });
    setSelectedConnectorId(null);
  };

  // File Upload & Candidate Detection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let projId = activeProject?.metadata.id;
    if (!projId) {
      const newProj = await api.createProject('New Import Project');
      setActiveProject(newProj);
      projId = newProj.metadata.id;
    }

    try {
      const res = await api.uploadFile(files[0], projId);
      setDetectionRegions(res.regions);
      if (res.previews.length > 0) {
        setSourcePreviewUrl(res.previews[0].preview_data_url);
        setSourceDimensions({ width: res.previews[0].width, height: res.previews[0].height });
      }
      setViewState('detection');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) handleDeleteElement(selectedElementId);
        else if (selectedConnectorId) handleDeleteConnector(selectedConnectorId);
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('pan');
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('connector');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [diagram, selectedElementId, selectedConnectorId, undoStack, redoStack]);

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo">ODR</div>
          <span className="brand-title">Optical Diagram Recognition</span>
          <span className="brand-subtitle">v2.0 Local Workbench</span>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${currentNav === 'workspace' ? 'active' : ''}`}
            onClick={() => setCurrentNav('workspace')}
          >
            Workspace
          </button>
          <button
            className={`nav-tab-btn ${currentNav === 'projects' ? 'active' : ''}`}
            onClick={() => setCurrentNav('projects')}
          >
            Projects
          </button>
          <button
            className="nav-tab-btn"
            onClick={() => setIsHistoryOpen(true)}
            disabled={!diagram}
          >
            <History size={14} />
            <span>History</span>
          </button>
        </nav>

        <div className="nav-actions">
          {/* Offline verification badge */}
          <div className="offline-badge" title="Zero cloud calls — 100% local processing">
            <div className="pulse-dot" />
            <span>Local Only</span>
          </div>

          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} title="Settings">
            <Settings size={16} />
          </button>
          <button className="btn-icon" onClick={() => setIsHelpOpen(true)} title="Help & Shortcuts">
            <HelpCircle size={16} />
          </button>
        </div>
      </header>

      {/* Main View Router */}
      {currentNav === 'projects' ? (
        <ProjectDashboard
          projects={projects}
          activeProjectId={activeProject?.metadata.id || null}
          onOpenProject={openProject}
          onCreateProject={handleCreateProject}
          onLoadSampleProject={handleLoadSampleProject}
          onDeleteProject={handleDeleteProject}
        />
      ) : viewState === 'empty' ? (
        /* Welcome & Empty State */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            background: 'var(--bg-app)'
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-md)',
              padding: '36px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Layers size={30} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Optical Diagram Recognition</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Convert flowchart photographs, textbook diagrams, whiteboard sketches, or PDFs into accurate, editable digital diagrams without uploading images to cloud AI services.
            </p>

            {/* Drag & Drop File Input */}
            <label
              style={{
                width: '100%',
                padding: '28px 16px',
                borderRadius: '8px',
                border: '2px dashed var(--accent-border)',
                background: 'var(--accent-subtle)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px'
              }}
            >
              <Upload size={24} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                Import Diagram Images or PDF
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Supports PNG, JPEG, WebP, BMP, and multi-page PDFs
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', width: '100%' }}>
              <button
                className="btn btn-secondary"
                onClick={handleLoadSampleProject}
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              >
                <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Try Sample Project</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  const emptyDiag: CanonicalDiagram = {
                    schema_version: '2.0',
                    id: `diag_${Date.now().toString(36)}`,
                    project_id: activeProject?.metadata.id || 'default_project',
                    name: 'New Blank Diagram',
                    family: 'flowchart',
                    subtype: 'standard_flowchart',
                    source_dimensions: { width: 1200, height: 900 },
                    elements: [],
                    connectors: [],
                    validation_issues: [],
                    export_capabilities: { mermaid: true, plantuml: true, json: true, png: true },
                    created_at: Date.now() / 1000,
                    updated_at: Date.now() / 1000,
                    version: 1
                  };
                  updateDiagram(emptyDiag, false);
                  setViewState('editor');
                }}
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              >
                <span>Create Blank Diagram</span>
              </button>
            </div>
          </div>
        </div>
      ) : viewState === 'detection' ? (
        /* Detection & Multi-Diagram Candidate Review */
        <DetectionScreen
          projectId={activeProject?.metadata.id || 'default_project'}
          sourcePreviewUrl={sourcePreviewUrl}
          sourceWidth={sourceDimensions.width}
          sourceHeight={sourceDimensions.height}
          regions={detectionRegions}
          onRegionsChange={setDetectionRegions}
          onRecognitionComplete={(recognizedDiag) => {
            updateDiagram(recognizedDiag, true);
            setViewState('review');
          }}
          onCancel={() => setViewState(diagram ? 'editor' : 'empty')}
        />
      ) : viewState === 'review' && diagram ? (
        /* Source vs Reconstruction Review Workspace */
        <ReviewWorkspace
          diagram={diagram}
          sourcePreviewUrl={sourcePreviewUrl}
          onContinueToEditor={() => setViewState('editor')}
          onUpdateElementLabel={(elId, newLabel) => {
            const updated = diagram.elements.map((el) =>
              el.id === elId ? { ...el, label: newLabel } : el
            );
            updateDiagram({ ...diagram, elements: updated });
          }}
        />
      ) : diagram ? (
        /* Diagram Editor Main Layout */
        <main className="editor-layout">
          <Toolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            onZoomOut={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            onZoomFit={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            saveStatus={saveStatus}
            onSaveCheckpoint={async () => {
              if (activeProject && diagram) {
                const label = prompt('Enter a label for this milestone checkpoint:', 'User Checkpoint');
                if (label) {
                  await api.createSnapshot(activeProject.metadata.id, diagram.id, label, 'Manual checkpoint');
                  alert('Checkpoint saved to version history!');
                }
              }
            }}
            onOpenExport={() => setIsExportOpen(true)}
            onToggleReview={() => setViewState('review')}
            isReviewOpen={viewState === 'review'}
          />

          <div className="editor-body">
            <ShapePalette onAddShape={handleAddShape} />

            <DiagramCanvas
              diagram={diagram}
              onChange={(updated) => updateDiagram(updated, false)}
              selectedElementId={selectedElementId}
              selectedConnectorId={selectedConnectorId}
              onSelectElement={setSelectedElementId}
              onSelectConnector={setSelectedConnectorId}
              activeTool={activeTool}
              zoom={zoom}
              pan={pan}
              onPanChange={setPan}
              highlightedElementId={highlightedElementId}
            />

            <PropertyInspector
              diagram={diagram}
              selectedElementId={selectedElementId}
              selectedConnectorId={selectedConnectorId}
              onUpdateElement={(updatedEl) => {
                const updated = diagram.elements.map((el) => (el.id === updatedEl.id ? updatedEl : el));
                updateDiagram({ ...diagram, elements: updated });
              }}
              onDeleteElement={handleDeleteElement}
              onUpdateConnector={(updatedConn) => {
                const updated = diagram.connectors.map((c) => (c.id === updatedConn.id ? updatedConn : c));
                updateDiagram({ ...diagram, connectors: updated });
              }}
              onDeleteConnector={handleDeleteConnector}
              onUpdateDiagramName={(name) => updateDiagram({ ...diagram, name })}
              onFocusIssueElement={(elId) => {
                setSelectedElementId(elId);
                setHighlightedElementId(elId);
                setTimeout(() => setHighlightedElementId(null), 2500);
              }}
            />
          </div>

          <BottomDrawer
            diagram={diagram}
            isOpen={isDrawerOpen}
            onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
          />
        </main>
      ) : null}

      {/* Bottom Status Bar */}
      <footer className="bottom-status-bar">
        <div className="status-left">
          <div className="status-item">
            <span>Project:</span>
            <strong>{activeProject?.metadata.name || 'None'}</strong>
          </div>
          {diagram && (
            <>
              <div className="status-item">
                <span>Diagram Type:</span>
                <strong>{diagram.family.toUpperCase()}</strong>
              </div>
              <div className="status-item">
                <span>Nodes:</span>
                <strong>{diagram.elements.length}</strong>
              </div>
              <div className="status-item">
                <span>Connectors:</span>
                <strong>{diagram.connectors.length}</strong>
              </div>
            </>
          )}
        </div>

        <div className="status-right">
          {diagram && (
            <div className="status-item">
              <span
                style={{
                  color: diagram.validation_issues.length === 0 ? 'var(--color-success)' : 'var(--color-warning)'
                }}
              >
                {diagram.validation_issues.length === 0
                  ? '✓ Valid Structure'
                  : `${diagram.validation_issues.length} issue(s)`}
              </span>
            </div>
          )}
          <div className="status-item">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {diagram && (
        <ExportModal
          diagram={diagram}
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {activeProject && diagram && (
        <VersionHistoryModal
          projectId={activeProject.metadata.id}
          diagram={diagram}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onRestore={(restored) => updateDiagram(restored, true)}
        />
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

export default App;
