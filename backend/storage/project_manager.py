"""
ODR Local Project Manager and Version History Store.
Provides local disk persistence, atomic project writes, auto-save handling,
checkpoint snapshot management, and semantic version diffs.
"""

import os
import json
import time
import uuid
import shutil
from typing import List, Dict, Any, Optional, Tuple
from backend.core.models import (
    ProjectData,
    ProjectMetadata,
    CanonicalDiagram,
    VersionSnapshot,
    DiagramRegion,
    DiagramElement,
    DiagramConnector
)


class ProjectManager:
    """Manages local project persistence, auto-save, and version snapshots."""

    def __init__(self, base_dir: str = "data/projects"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def list_projects(self) -> List[ProjectMetadata]:
        """Lists all local projects sorted by last updated timestamp."""
        projects: List[ProjectMetadata] = []
        if not os.path.exists(self.base_dir):
            return []

        for entry in os.listdir(self.base_dir):
            proj_dir = os.path.join(self.base_dir, entry)
            proj_file = os.path.join(proj_dir, "project.json")
            if os.path.isdir(proj_dir) and os.path.exists(proj_file):
                try:
                    with open(proj_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    meta = ProjectMetadata(**data.get("metadata", {}))
                    projects.append(meta)
                except Exception as e:
                    print(f"[ProjectManager] Failed to read project {entry}: {e}")

        projects.sort(key=lambda p: p.updated_at, reverse=True)
        return projects

    def get_project(self, project_id: str) -> Optional[ProjectData]:
        """Loads complete project data from disk."""
        proj_file = os.path.join(self.base_dir, project_id, "project.json")
        if not os.path.exists(proj_file):
            return None

        try:
            with open(proj_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ProjectData(**data)
        except Exception as e:
            print(f"[ProjectManager] Error parsing project {project_id}: {e}")
            return None

    def create_project(self, name: str = "New Project") -> ProjectData:
        """Initializes a new local project."""
        proj_id = f"proj_{uuid.uuid4().hex[:8]}"
        proj_dir = os.path.join(self.base_dir, proj_id)
        os.makedirs(proj_dir, exist_ok=True)

        meta = ProjectMetadata(
            id=proj_id,
            name=name,
            created_at=time.time(),
            updated_at=time.time(),
            source_files=[],
            diagram_count=0
        )
        project = ProjectData(metadata=meta, diagrams={}, history={}, regions=[])
        self.save_project(project)
        return project

    def save_project(self, project: ProjectData) -> bool:
        """Atomically saves project data to disk."""
        proj_dir = os.path.join(self.base_dir, project.metadata.id)
        os.makedirs(proj_dir, exist_ok=True)
        target_file = os.path.join(proj_dir, "project.json")
        temp_file = os.path.join(proj_dir, "project.json.tmp")

        try:
            project.metadata.updated_at = time.time()
            project.metadata.diagram_count = len(project.diagrams)
            
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(project.model_dump(), f, indent=2)

            # Atomic replace on Windows
            if os.path.exists(target_file):
                os.replace(temp_file, target_file)
            else:
                os.rename(temp_file, target_file)
            return True
        except Exception as e:
            print(f"[ProjectManager] Failed to save project {project.metadata.id}: {e}")
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass
            return False

    def delete_project(self, project_id: str) -> bool:
        """Deletes a local project folder."""
        proj_dir = os.path.join(self.base_dir, project_id)
        if os.path.exists(proj_dir):
            try:
                shutil.rmtree(proj_dir)
                return True
            except Exception as e:
                print(f"[ProjectManager] Failed to delete project {project_id}: {e}")
                return False
        return False

    def add_diagram(self, project_id: str, diagram: CanonicalDiagram) -> Optional[ProjectData]:
        """Adds or updates a diagram in a project and creates an initial version snapshot."""
        project = self.get_project(project_id)
        if not project:
            return None

        project.diagrams[diagram.id] = diagram
        project.metadata.active_diagram_id = diagram.id

        # Create initial snapshot if not present
        if diagram.id not in project.history:
            project.history[diagram.id] = []
            snapshot = VersionSnapshot(
                version_number=1,
                label="Initial Recognition",
                description="Diagram recognized from source input",
                origin="recognition",
                timestamp=time.time(),
                diagram=diagram
            )
            project.history[diagram.id].append(snapshot)

        self.save_project(project)
        return project

    def create_snapshot(
        self,
        project_id: str,
        diagram_id: str,
        label: str,
        description: str,
        origin: str = "checkpoint"
    ) -> Optional[VersionSnapshot]:
        """Creates a named version snapshot for a diagram."""
        project = self.get_project(project_id)
        if not project or diagram_id not in project.diagrams:
            return None

        diagram = project.diagrams[diagram_id]
        history_list = project.history.setdefault(diagram_id, [])
        version_num = len(history_list) + 1

        snapshot = VersionSnapshot(
            version_number=version_num,
            label=label,
            description=description,
            origin=origin,
            timestamp=time.time(),
            diagram=diagram
        )
        history_list.append(snapshot)
        self.save_project(project)
        return snapshot

    def restore_snapshot(self, project_id: str, diagram_id: str, snapshot_id: str) -> Optional[CanonicalDiagram]:
        """
        Restores a diagram to a prior snapshot state.
        Critically, this does NOT destroy newer history; it saves the restored state as a new current version.
        """
        project = self.get_project(project_id)
        if not project or diagram_id not in project.history:
            return None

        history = project.history[diagram_id]
        target_snap = next((s for s in history if s.id == snapshot_id), None)
        if not target_snap:
            return None

        # Deep copy snapshot diagram and update timestamp
        restored = CanonicalDiagram(**target_snap.diagram.model_dump())
        restored.updated_at = time.time()
        restored.version = target_snap.version_number + 1
        project.diagrams[diagram_id] = restored

        # Create record of restoration in history
        new_snap = VersionSnapshot(
            version_number=len(history) + 1,
            label=f"Restored to '{target_snap.label}'",
            description=f"Rolled back to Version {target_snap.version_number}",
            origin="restore",
            timestamp=time.time(),
            diagram=restored
        )
        history.append(new_snap)
        self.save_project(project)
        return restored

    @classmethod
    def compare_diagrams(cls, diag_a: CanonicalDiagram, diag_b: CanonicalDiagram) -> Dict[str, Any]:
        """
        Computes semantic and layout difference between two versions of a diagram.
        """
        nodes_a = {el.id: el for el in diag_a.elements}
        nodes_b = {el.id: el for el in diag_b.elements}

        added_nodes = [el.model_dump() for nid, el in nodes_b.items() if nid not in nodes_a]
        removed_nodes = [el.model_dump() for nid, el in nodes_a.items() if nid not in nodes_b]
        
        modified_nodes = []
        for nid in nodes_a:
            if nid in nodes_b:
                na = nodes_a[nid]
                nb = nodes_b[nid]
                changes = []
                if na.label != nb.label:
                    changes.append(f"Label changed: '{na.label}' -> '{nb.label}'")
                if na.type != nb.type:
                    changes.append(f"Type changed: '{na.type}' -> '{nb.type}'")
                if abs(na.x - nb.x) > 5 or abs(na.y - nb.y) > 5:
                    changes.append("Position moved")
                if changes:
                    modified_nodes.append({"id": nid, "label": nb.label, "changes": changes})

        conns_a = {(c.source_id, c.target_id): c for c in diag_a.connectors}
        conns_b = {(c.source_id, c.target_id): c for c in diag_b.connectors}

        added_conns = [c.model_dump() for pair, c in conns_b.items() if pair not in conns_a]
        removed_conns = [c.model_dump() for pair, c in conns_a.items() if pair not in conns_b]

        return {
            "diagram_a_version": diag_a.version,
            "diagram_b_version": diag_b.version,
            "added_nodes_count": len(added_nodes),
            "removed_nodes_count": len(removed_nodes),
            "modified_nodes_count": len(modified_nodes),
            "added_nodes": added_nodes,
            "removed_nodes": removed_nodes,
            "modified_nodes": modified_nodes,
            "added_connectors": added_conns,
            "removed_connectors": removed_conns
        }
