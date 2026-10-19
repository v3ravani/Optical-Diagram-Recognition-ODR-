import React, { useState } from 'react';
import { ProjectMetadata } from '../../types/diagram';
import { Folder, Plus, Sparkles, Trash2, Clock, Search, ArrowRight, FileText, X } from 'lucide-react';

interface ProjectDashboardProps {
  projects: ProjectMetadata[];
  activeProjectId: string | null;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onLoadSampleProject: () => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  projects,
  activeProjectId,
  onOpenProject,
  onCreateProject,
  onLoadSampleProject,
  onDeleteProject
}) => {
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowCreateModal(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-app)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Projects Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage locally stored diagram projects, versions, and source documents.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={onLoadSampleProject}
            title="Load ready-made demo diagram project"
            style={{ gap: '6px' }}
          >
            <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>Try Sample Project</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ gap: '6px' }}
          >
            <Plus size={15} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '20px' }}>
        <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="field-input"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '32px', width: '100%' }}
        />
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px dashed var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <Folder size={36} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>No projects found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '380px' }}>
            Get started by creating a new empty project or try the preloaded sample project with realistic flowcharts.
          </p>
          <button className="btn btn-primary" onClick={onLoadSampleProject} style={{ marginTop: '8px' }}>
            Load Sample Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map((proj) => {
            const isCurrent = activeProjectId === proj.id;
            const updatedDate = new Date(proj.updated_at * 1000).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={proj.id}
                onClick={() => onOpenProject(proj.id)}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Folder size={18} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{proj.name}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {proj.id}</span>
                      </div>
                    </div>

                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${proj.name}"?`)) onDeleteProject(proj.id);
                      }}
                      title="Delete Project"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>{proj.diagram_count} diagram{proj.diagram_count !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{proj.source_files.length} source file{proj.source_files.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>{updatedDate}</span>
                  </div>

                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Dialog */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span className="modal-title">Create New Project</span>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="inspector-field">
                  <label className="field-label">Project Name</label>
                  <input
                    type="text"
                    autoFocus
                    className="field-input"
                    placeholder="e.g. User Authentication Flow"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
