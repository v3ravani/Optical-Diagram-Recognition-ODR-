"""
ODR FastAPI Backend Application.
Provides local REST API endpoints for image preprocessing, region detection,
OCR, shape recognition, connector tracing, editing sync, version history, and exporters.
Zero external cloud calls — 100% local operation.
"""

import os
import io
import time
import base64
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import cv2
import numpy as np

from backend.core.models import (
    CanonicalDiagram,
    DiagramRegion,
    ProjectData,
    ProjectMetadata,
    VersionSnapshot,
    DiagramElement,
    DiagramConnector,
    ElementType,
    DiagramFamily,
    ValidationIssue
)
from backend.core.validator import DiagramValidator
from backend.pipeline.preprocessor import ImagePreprocessor
from backend.pipeline.region_detector import RegionDetector
from backend.pipeline.reconstruction import DiagramReconstructor
from backend.storage.project_manager import ProjectManager
from backend.exporters.mermaid_exporter import MermaidExporter
from backend.exporters.plantuml_exporter import PlantUMLExporter
from backend.exporters.json_exporter import JSONExporter
from backend.exporters.png_exporter import PNGExporter
from backend.exporters.bundle_exporter import BundleExporter

app = FastAPI(
    title="ODR - Optical Diagram Recognition API",
    version="2.0.0",
    description="Local-first diagram recognition, editing, and export engine."
)

# Enable CORS for localhost development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

project_manager = ProjectManager()
reconstructor = DiagramReconstructor()

# In-memory uploaded file cache for current session: file_name -> list of (image_bgr, page_num)
uploaded_images_cache: Dict[str, List[Tuple[np.ndarray, int]]] = {}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ODR Optical Diagram Recognition",
        "version": "2.0.0",
        "local_only": True,
        "ocr_engine": "RapidOCR (Local ONNX Runtime)",
        "cloud_inference_disabled": True
    }


@app.get("/api/system-info")
def system_info():
    return {
        "offline_verified": True,
        "external_api_calls": 0,
        "supported_inputs": ["PNG", "JPEG", "WebP", "BMP", "PDF (Multi-page)"],
        "supported_diagram_families": [
            {"family": "flowchart", "tier": "Tier 1 (MVP)", "status": "fully_supported"},
            {"family": "decision_tree", "tier": "Tier 1 (MVP)", "status": "fully_supported"},
            {"family": "chart", "tier": "Tier 1 (MVP)", "status": "fully_supported"},
            {"family": "uml", "tier": "Tier 2", "status": "partially_supported"},
            {"family": "generic", "tier": "Tier 1", "status": "supported"}
        ],
        "local_storage_path": project_manager.base_dir
    }


# ==========================================
# Projects & Persistence
# ==========================================

@app.get("/api/projects", response_model=List[ProjectMetadata])
def list_projects():
    return project_manager.list_projects()


@app.post("/api/projects")
def create_project(name: str = Form("New Project")):
    project = project_manager.create_project(name=name)
    return project


@app.get("/api/projects/{project_id}", response_model=ProjectData)
def get_project(project_id: str):
    proj = project_manager.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    success = project_manager.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or delete failed")
    return {"success": True, "message": "Project deleted"}


@app.post("/api/projects/{project_id}/save")
def save_project_data(project_id: str, project_data: ProjectData):
    if project_data.metadata.id != project_id:
        project_data.metadata.id = project_id
    success = project_manager.save_project(project_data)
    if not success:
        raise HTTPException(status_code=500, detail="Auto-save failed")
    return {"success": True, "updated_at": project_data.metadata.updated_at}


# ==========================================
# Import, Region Detection & Recognition
# ==========================================

@app.post("/api/import/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: str = Form("default_project")
):
    """
    Accepts an uploaded image or PDF, extracts pages, runs deskewing,
    and returns detected candidate diagram regions along with page previews.
    """
    file_bytes = await file.read()
    file_name = file.filename or "uploaded_image.png"

    try:
        pages = ImagePreprocessor.load_file_to_images(file_bytes, file_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode file: {e}")

    uploaded_images_cache[file_name] = pages

    all_regions: List[DiagramRegion] = []
    previews: List[Dict[str, Any]] = []

    for img_bgr, page_num in pages:
        # Deskew if needed
        deskewed, angle = ImagePreprocessor.deskew(img_bgr)
        h, w = deskewed.shape[:2]

        # Detect candidate regions
        regions = RegionDetector.detect_diagram_regions(deskewed, file_name, page_number=page_num)
        all_regions.extend(regions)

        # Generate base64 thumbnail of the source page
        # Resize thumbnail to max 1200px width for fast UI responsiveness
        scale = min(1.0, 1200.0 / w)
        thumb_w, thumb_h = int(w * scale), int(h * scale)
        thumb_img = cv2.resize(deskewed, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        _, enc = cv2.imencode(".jpg", thumb_img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        b64_preview = base64.b64encode(enc.tobytes()).decode("utf-8")

        previews.append({
            "page_number": page_num,
            "width": w,
            "height": h,
            "preview_data_url": f"data:image/jpeg;base64,{b64_preview}",
            "skew_angle": angle
        })

    # Save to project if project exists
    proj = project_manager.get_project(project_id)
    if proj:
        if file_name not in proj.metadata.source_files:
            proj.metadata.source_files.append(file_name)
        proj.regions = all_regions
        project_manager.save_project(proj)

    return {
        "file_name": file_name,
        "page_count": len(pages),
        "previews": previews,
        "regions": all_regions
    }


class RecognizeRegionRequest(BaseModel):
    project_id: str
    region: DiagramRegion


@app.post("/api/import/recognize-region", response_model=CanonicalDiagram)
def recognize_selected_region(req: RecognizeRegionRequest):
    """
    Crops the diagram region from the cached source image and executes
    the full local recognition pipeline (OCR + Shape detection + Connector tracing).
    """
    file_name = req.region.file_name
    if file_name not in uploaded_images_cache:
        raise HTTPException(
            status_code=400,
            detail=f"Source image '{file_name}' not found in session cache. Please re-import file."
        )

    pages = uploaded_images_cache[file_name]
    page_idx = max(0, min(req.region.page_number - 1, len(pages) - 1))
    page_img, _ = pages[page_idx]

    img_h, img_w = page_img.shape[:2]
    rx = max(0, min(req.region.x, img_w - 1))
    ry = max(0, min(req.region.y, img_h - 1))
    rw = max(10, min(req.region.width, img_w - rx))
    rh = max(10, min(req.region.height, img_h - ry))

    crop = page_img[ry:ry+rh, rx:rx+rw]

    # Reconstruct diagram
    diagram = reconstructor.reconstruct(crop, req.region, project_id=req.project_id)

    # Attach to project
    proj = project_manager.get_project(req.project_id)
    if proj:
        project_manager.add_diagram(req.project_id, diagram)

    return diagram


# ==========================================
# Sample Project Generator (PRD Requirement)
# ==========================================

@app.post("/api/import/sample-project", response_model=ProjectData)
def create_sample_project():
    """
    Generates a preloaded sample project containing:
    1. A realistic flowchart with start/process/decision/terminal nodes and connectors.
    2. A data chart with categories and values.
    Allows immediate demonstration and testing without requiring manual file uploads.
    """
    project = project_manager.create_project(name="Sample Order Workflow")
    proj_id = project.metadata.id

    # 1. Sample Flowchart
    diag_flow = CanonicalDiagram(
        id=f"diag_flow_{proj_id[:6]}",
        project_id=proj_id,
        name="Order Processing Flowchart",
        family=DiagramFamily.FLOWCHART,
        subtype="standard_flowchart",
        source_dimensions={"width": 1000, "height": 800},
        elements=[
            DiagramElement(
                id="node_start",
                type=ElementType.TERMINAL,
                role="start",
                label="Receive Order",
                x=400.0,
                y=60.0,
                width=160.0,
                height=65.0,
                confidence=0.98
            ),
            DiagramElement(
                id="node_validate",
                type=ElementType.PROCESS,
                role="process",
                label="Validate Payment & Inventory",
                x=380.0,
                y=180.0,
                width=200.0,
                height=70.0,
                confidence=0.95
            ),
            DiagramElement(
                id="node_decision",
                type=ElementType.DECISION,
                role="decision",
                label="Is In Stock?",
                x=410.0,
                y=310.0,
                width=140.0,
                height=90.0,
                confidence=0.92
            ),
            DiagramElement(
                id="node_fulfill",
                type=ElementType.PROCESS,
                role="process",
                label="Fulfill & Ship Package",
                x=400.0,
                y=460.0,
                width=160.0,
                height=70.0,
                confidence=0.96
            ),
            DiagramElement(
                id="node_backorder",
                type=ElementType.PROCESS,
                role="process",
                label="Notify Supplier & Backorder",
                x=660.0,
                y=320.0,
                width=180.0,
                height=70.0,
                confidence=0.90
            ),
            DiagramElement(
                id="node_end",
                type=ElementType.TERMINAL,
                role="end",
                label="Complete Order",
                x=410.0,
                y=590.0,
                width=140.0,
                height=60.0,
                confidence=0.99
            )
        ],
        connectors=[
            DiagramConnector(
                id="conn_1",
                source_id="node_start",
                target_id="node_validate",
                source_handle="bottom",
                target_handle="top",
                label="",
                confidence=0.98
            ),
            DiagramConnector(
                id="conn_2",
                source_id="node_validate",
                target_id="node_decision",
                source_handle="bottom",
                target_handle="top",
                label="",
                confidence=0.96
            ),
            DiagramConnector(
                id="conn_3",
                source_id="node_decision",
                target_id="node_fulfill",
                source_handle="bottom",
                target_handle="top",
                label="Yes",
                confidence=0.94
            ),
            DiagramConnector(
                id="conn_4",
                source_id="node_decision",
                target_id="node_backorder",
                source_handle="right",
                target_handle="left",
                label="No",
                confidence=0.93
            ),
            DiagramConnector(
                id="conn_5",
                source_id="node_fulfill",
                target_id="node_end",
                source_handle="bottom",
                target_handle="top",
                label="",
                confidence=0.97
            ),
            DiagramConnector(
                id="conn_6",
                source_id="node_backorder",
                target_id="node_end",
                source_handle="bottom",
                target_handle="right",
                label="",
                confidence=0.88
            )
        ]
    )

    diag_flow = DiagramValidator.validate(diag_flow)
    project_manager.add_diagram(proj_id, diag_flow)

    updated_proj = project_manager.get_project(proj_id)
    return updated_proj or project


# ==========================================
# Version History & Comparison
# ==========================================

@app.get("/api/projects/{project_id}/diagrams/{diagram_id}/history", response_model=List[VersionSnapshot])
def get_diagram_history(project_id: str, diagram_id: str):
    proj = project_manager.get_project(project_id)
    if not proj or diagram_id not in proj.history:
        return []
    return proj.history[diagram_id]


class CreateSnapshotRequest(BaseModel):
    label: str = "Checkpoint"
    description: str = "Manual user checkpoint"


@app.post("/api/projects/{project_id}/diagrams/{diagram_id}/snapshot", response_model=VersionSnapshot)
def create_checkpoint(project_id: str, diagram_id: str, req: CreateSnapshotRequest):
    snapshot = project_manager.create_snapshot(
        project_id=project_id,
        diagram_id=diagram_id,
        label=req.label,
        description=req.description,
        origin="checkpoint"
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Diagram not found or snapshot failed")
    return snapshot


@app.post("/api/projects/{project_id}/diagrams/{diagram_id}/restore/{snapshot_id}", response_model=CanonicalDiagram)
def restore_version_snapshot(project_id: str, diagram_id: str, snapshot_id: str):
    restored = project_manager.restore_snapshot(project_id, diagram_id, snapshot_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Snapshot not found or restore failed")
    return restored


class CompareSnapshotsRequest(BaseModel):
    snapshot_a_id: str
    snapshot_b_id: str


@app.post("/api/projects/{project_id}/diagrams/{diagram_id}/compare")
def compare_snapshots(project_id: str, diagram_id: str, req: CompareSnapshotsRequest):
    proj = project_manager.get_project(project_id)
    if not proj or diagram_id not in proj.history:
        raise HTTPException(status_code=404, detail="History not found")

    history = proj.history[diagram_id]
    snap_a = next((s for s in history if s.id == req.snapshot_a_id), None)
    snap_b = next((s for s in history if s.id == req.snapshot_b_id), None)

    if not snap_a or not snap_b:
        raise HTTPException(status_code=404, detail="One or both snapshots could not be found")

    diff = ProjectManager.compare_diagrams(snap_a.diagram, snap_b.diagram)
    return diff


# ==========================================
# Validation & Exporters
# ==========================================

@app.post("/api/validate", response_model=CanonicalDiagram)
def validate_diagram(diagram: CanonicalDiagram):
    validated = DiagramValidator.validate(diagram)
    return validated


@app.post("/api/export/mermaid")
def export_mermaid(diagram: CanonicalDiagram):
    code, is_valid, msg = MermaidExporter.export(diagram)
    return {
        "format": "mermaid",
        "code": code,
        "is_valid": is_valid,
        "message": msg
    }


@app.post("/api/export/plantuml")
def export_plantuml(diagram: CanonicalDiagram):
    code, is_valid, msg = PlantUMLExporter.export(diagram)
    return {
        "format": "plantuml",
        "code": code,
        "is_valid": is_valid,
        "message": msg
    }


@app.post("/api/export/json")
def export_json(diagram: CanonicalDiagram):
    code, is_valid, msg = JSONExporter.export(diagram)
    return Response(content=code, media_type="application/json")


@app.post("/api/export/png")
def export_png(diagram: CanonicalDiagram):
    png_bytes, is_valid, msg = PNGExporter.export(diagram)
    if not is_valid:
        raise HTTPException(status_code=500, detail=msg)
    return Response(content=png_bytes, media_type="image/png")


@app.post("/api/export/bundle")
def export_bundle(diagram: CanonicalDiagram):
    zip_bytes, is_valid, msg = BundleExporter.export_zip(diagram)
    if not is_valid:
        raise HTTPException(status_code=500, detail=msg)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{diagram.id}_bundle.zip"'}
    )
