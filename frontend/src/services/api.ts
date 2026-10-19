import {
  CanonicalDiagram,
  DiagramRegion,
  ProjectData,
  ProjectMetadata,
  VersionSnapshot
} from '../types/diagram';

const API_BASE = '/api';

export const api = {
  async getSystemInfo() {
    const res = await fetch(`${API_BASE}/system-info`);
    return res.json();
  },

  async listProjects(): Promise<ProjectMetadata[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to load projects');
    return res.json();
  },

  async getProject(projectId: string): Promise<ProjectData> {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);
    if (!res.ok) throw new Error('Failed to load project details');
    return res.json();
  },

  async createProject(name: string = 'New Project'): Promise<ProjectData> {
    const formData = new FormData();
    formData.append('name', name);
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },

  async saveProject(project: ProjectData): Promise<{ success: boolean; updated_at: number }> {
    const res = await fetch(`${API_BASE}/projects/${project.metadata.id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    if (!res.ok) throw new Error('Failed to auto-save project');
    return res.json();
  },

  async createSampleProject(): Promise<ProjectData> {
    const res = await fetch(`${API_BASE}/import/sample-project`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate sample project');
    return res.json();
  },

  async uploadFile(file: File, projectId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);

    const res = await fetch(`${API_BASE}/import/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json() as Promise<{
      file_name: string;
      page_count: number;
      previews: Array<{
        page_number: number;
        width: number;
        height: number;
        preview_data_url: string;
        skew_angle: number;
      }>;
      regions: DiagramRegion[];
    }>;
  },

  async recognizeRegion(projectId: string, region: DiagramRegion): Promise<CanonicalDiagram> {
    const res = await fetch(`${API_BASE}/import/recognize-region`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, region })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Recognition failed' }));
      throw new Error(err.detail || 'Recognition failed');
    }
    return res.json();
  },

  async validateDiagram(diagram: CanonicalDiagram): Promise<CanonicalDiagram> {
    const res = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    if (!res.ok) throw new Error('Validation request failed');
    return res.json();
  },

  async getDiagramHistory(projectId: string, diagramId: string): Promise<VersionSnapshot[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/diagrams/${diagramId}/history`);
    if (!res.ok) return [];
    return res.json();
  },

  async createSnapshot(
    projectId: string,
    diagramId: string,
    label: string,
    description: string
  ): Promise<VersionSnapshot> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/diagrams/${diagramId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, description })
    });
    if (!res.ok) throw new Error('Failed to create snapshot');
    return res.json();
  },

  async restoreSnapshot(
    projectId: string,
    diagramId: string,
    snapshotId: string
  ): Promise<CanonicalDiagram> {
    const res = await fetch(
      `${API_BASE}/projects/${projectId}/diagrams/${diagramId}/restore/${snapshotId}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error('Failed to restore snapshot');
    return res.json();
  },

  async compareSnapshots(
    projectId: string,
    diagramId: string,
    snapshotAId: string,
    snapshotBId: string
  ) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/diagrams/${diagramId}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshot_a_id: snapshotAId,
        snapshot_b_id: snapshotBId
      })
    });
    if (!res.ok) throw new Error('Failed to compare snapshots');
    return res.json();
  },

  async exportMermaid(diagram: CanonicalDiagram): Promise<{ code: string; is_valid: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/export/mermaid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    return res.json();
  },

  async exportPlantUML(diagram: CanonicalDiagram): Promise<{ code: string; is_valid: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/export/plantuml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    return res.json();
  },

  async downloadJSON(diagram: CanonicalDiagram) {
    const res = await fetch(`${API_BASE}/export/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadPNG(diagram: CanonicalDiagram) {
    const res = await fetch(`${API_BASE}/export/png`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    if (!res.ok) throw new Error('PNG export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.name.replace(/\s+/g, '_')}.png`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadBundle(diagram: CanonicalDiagram) {
    const res = await fetch(`${API_BASE}/export/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagram)
    });
    if (!res.ok) throw new Error('ZIP bundle export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.name.replace(/\s+/g, '_')}_bundle.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
