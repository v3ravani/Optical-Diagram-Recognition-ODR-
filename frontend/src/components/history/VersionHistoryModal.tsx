import React, { useState, useEffect } from 'react';
import { VersionSnapshot, CanonicalDiagram } from '../../types/diagram';
import { api } from '../../services/api';
import { X, History, RotateCcw, GitCompare, Clock, CheckCircle2, Plus, Minus, Edit2 } from 'lucide-react';

interface VersionHistoryModalProps {
  projectId: string;
  diagram: CanonicalDiagram;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (restored: CanonicalDiagram) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  projectId,
  diagram,
  isOpen,
  onClose,
  onRestore
}) => {
  const [history, setHistory] = useState<VersionSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [compareDiff, setCompareDiff] = useState<any | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.getDiagramHistory(projectId, diagram.id).then((snaps) => {
      setHistory(snaps);
      if (snaps.length > 0) {
        setSelectedSnapshotId(snaps[snaps.length - 1].id);
      }
    });
  }, [projectId, diagram.id, isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (snapId: string) => {
    if (confirm('Restore this snapshot? Current state will be preserved as a prior checkpoint.')) {
      try {
        const restored = await api.restoreSnapshot(projectId, diagram.id, snapId);
        onRestore(restored);
        onClose();
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    }
  };

  const handleCompare = async (snapId: string) => {
    const latest = history[history.length - 1];
    if (!latest) return;
    try {
      const diff = await api.compareSnapshots(projectId, diagram.id, snapId, latest.id);
      setCompareDiff(diff);
      setIsComparing(true);
    } catch (err: any) {
      alert(`Compare failed: ${err.message}`);
    }
  };

  const selectedSnap = history.find((s) => s.id === selectedSnapshotId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px', height: '620px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: 'var(--accent-primary)' }} />
            <span className="modal-title">Diagram Version History & Comparison</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Snapshot Timeline List */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid var(--border-subtle)',
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'var(--bg-subtle)'
            }}
          >
            {history.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                No saved snapshots yet. Create one via Checkpoint button!
              </div>
            ) : (
              history.map((snap) => {
                const isSelected = selectedSnapshotId === snap.id;
                const dateStr = new Date(snap.timestamp * 1000).toLocaleString();

                return (
                  <div
                    key={snap.id}
                    onClick={() => {
                      setSelectedSnapshotId(snap.id);
                      setIsComparing(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--bg-surface)' : 'transparent',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid transparent',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        v{snap.version_number}: {snap.label}
                      </span>
                      <span style={{ fontSize: '10px', background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {snap.origin}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {snap.description}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <Clock size={11} />
                      <span>{dateStr}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Snapshot Details or Diff View */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {isComparing && compareDiff ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Semantic Version Diff</h4>
                  <button className="btn btn-secondary" onClick={() => setIsComparing(false)} style={{ fontSize: '12px', padding: '3px 8px' }}>
                    Back to Details
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                    +{compareDiff.added_nodes_count} nodes added
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px', fontWeight: 600 }}>
                    -{compareDiff.removed_nodes_count} nodes removed
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: '12px', fontWeight: 600 }}>
                    ~{compareDiff.modified_nodes_count} nodes modified
                  </div>
                </div>

                {compareDiff.modified_nodes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Modified Nodes:</span>
                    {compareDiff.modified_nodes.map((m: any) => (
                      <div key={m.id} style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '4px', background: 'var(--bg-subtle)' }}>
                        <strong>{m.id}</strong>: {m.changes.join(', ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedSnap ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                      Version {selectedSnap.version_number}: {selectedSnap.label}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Origin: {selectedSnap.origin} | Created: {new Date(selectedSnap.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleCompare(selectedSnap.id)}
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                    >
                      <GitCompare size={14} />
                      <span>Compare Diff</span>
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleRestore(selectedSnap.id)}
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                    >
                      <RotateCcw size={14} />
                      <span>Restore This Version</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-subtle)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elements</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                      {selectedSnap.diagram.elements.length} nodes
                    </div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-subtle)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Connectors</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                      {selectedSnap.diagram.connectors.length} edges
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Nodes in this Snapshot:
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedSnap.diagram.elements.map((el) => (
                      <span
                        key={el.id}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        {el.label || el.id} ({el.type})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
