# ODR — Optical Diagram Recognition (v2.0)

**Local-first, accuracy-oriented diagram recognition, reconstruction, visual editing, and export workbench.**

[![Tests](https://img.shields.io/badge/tests-11%20passed-success)](backend/tests/)
[![Python](https://img.shields.io/badge/python-3.10%20%7C%203.14-blue)](https://www.python.org/)
[![Vite](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript%20%2B%20Vite-teal)](frontend/)
[![Offline](https://img.shields.io/badge/privacy-100%25%20Local%20Only-emerald)](IMPLEMENTATION_STATUS.md)

---

## 1. Overview

**ODR (Optical Diagram Recognition)** converts flowcharts, decision trees, process maps, and data charts from photographs, scans, whiteboard drawings, and multi-page PDFs into structured, editable digital diagrams.

Unlike generic cloud AI wrappers, ODR runs **completely offline on your local computer**:
- **Zero Cloud API Calls**: No user images, diagrams, or sensitive corporate architectures are ever uploaded to third-party services.
- **Accurate Structural Pipeline**: Combines image preprocessing, contour analysis, RapidOCR (local ONNX runtime), geometric shape classification, connector tracing, and arrowhead polarity inference.
- **Multi-Diagram Detection**: Detects multiple separate diagrams on a single page, provides interactive candidate review, and supports manual crop fallbacks.
- **Interactive Visual Editor**: Drag-and-drop canvas with resizable nodes, smart orthogonal connectors that follow node movements, inline label editing, undo/redo, and property inspection.
- **Multi-Format Exporters**: Generates Mermaid.js, PlantUML, Canonical JSON, rendered PNGs, and structured ZIP bundles with manifests.
- **Project Persistence & History**: Local project files with atomic writes, debounced auto-save, milestone checkpoints, and semantic version diff comparisons.

---

## 2. Key Features

### 🔍 Recognition Pipeline
- **Input Formats**: PNG, JPEG, WebP, BMP, and multi-page PDFs (rendered with PyMuPDF).
- **Preprocessing**: Automatic orientation assessment, Hough minAreaRect deskewing, and CLAHE contrast normalization.
- **Multi-Diagram Segmentation**: Morphological clustering with non-maximum suppression (NMS) isolates individual diagrams from surrounding document text.
- **Local OCR**: Bundled RapidOCR ONNX models for high-accuracy text extraction without cloud network traffic.
- **Shape Classification**: Distinguishes start/end terminals, process rectangles, decision diamonds, input/output parallelograms, database cylinders, and pins.
- **Connector Reconstruction**: Traces lines, detects arrowhead polarity, snaps endpoints to nearest shape boundaries, detects orthogonal waypoints, and binds branch labels (e.g., *Yes*, *No*).

### 🎨 Visual Diagram Editor
- **Interactive Canvas**: Pan (Space+Drag or Pan tool), Zoom (wheel or toolbar controls), and Snap-to-Grid.
- **Node Editing**: Move nodes smoothly; resize from 4 corner handles; double-click to edit text inline; customize colors and borders.
- **Connector Editing**: Smart orthogonal or straight routing; toggle directions (*Directed*, *Bidirectional*, *Undirected*); reconnect endpoints; edit edge conditions.
- **Session Undo/Redo**: Fast fine-grained reversible operations with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).
- **Source Review Workspace**: Side-by-side comparison between source image crops and recognized diagrams with synchronized element highlighting.

### 💾 Persistence & Version Control
- **Local Storage**: Saves project metadata, canonical diagrams, and history snapshots under `data/projects/`.
- **Auto-Save**: Debounced background writing with explicit UI feedback (*Saving...*, *Saved*, *Save failed*).
- **Version Checkpoints**: Create milestone snapshots and roll back to earlier versions without losing subsequent history.
- **Semantic Diff Engine**: Visual comparison highlighting added, removed, and modified nodes between snapshots.

### 📤 Exporters
- **Mermaid.js**: Exports `flowchart TD`, `pie`, and `xychart-beta` with live code preview and syntax verification.
- **PlantUML**: Exports monochrome activity and component diagram syntax.
- **Canonical JSON**: Full type-safe JSON representation conforming to PRD Version 2.0 schema.
- **High-Resolution PNG**: Local raster image rendering using Pillow without editor handles, cursors, or debug artifacts.
- **ZIP Bundle**: Clean directory packaging with output files and a structured `manifest.json`.

---

## 3. Technology Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2, Pytest.
- **Computer Vision & OCR**: OpenCV 5.0, RapidOCR (ONNX Runtime), PyMuPDF (Fitz), Pillow, NumPy, SciPy.
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS Design System, Lucide React icons.
- **Local Storage**: Atomic JSON persistence under `data/projects/`.

---

## 4. Getting Started

### Prerequisites
- Python 3.10+ (tested on Python 3.14 on Windows)
- Node.js 18+ and npm

### 1. Clone & Setup Backend
```bash
# Clone the repository
git clone https://github.com/v3ravani/Optical-Diagram-Recognition-ODR-.git
cd Optical-Diagram-Recognition-ODR-

# Install Python dependencies
pip install fastapi uvicorn pydantic opencv-python rapidocr-onnxruntime pymupdf pypdf pillow numpy scipy pytest
```

### 2. Setup Frontend
```bash
cd frontend
npm install
cd ..
```

### 3. Generate Test Samples (Optional)
```bash
python samples/generate_samples.py
```
This generates:
- `samples/flowchart_order.png` (Business process flowchart)
- `samples/multi_diagram_page.png` (Page with two distinct diagrams)
- `samples/barchart_quarterly.png` (Coordinate axis bar chart)

---

## 5. Running the Application

### Start the Backend Server:
```bash
python run_odr.py
```
The FastAPI backend starts at `http://127.0.0.1:8000` (API documentation at `http://127.0.0.1:8000/docs`).

### Start the Frontend Dev Server:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Running Tests

### Run Backend Unit & Integration Tests:
```bash
python -m pytest backend/tests/ -v
```
All 11 tests pass with 0 failures:
- Structural validator & issue detection
- Mermaid, PlantUML, JSON, and PNG exporters
- ZIP bundle packaging & manifest generation
- Project persistence, snapshots, and diff comparison
- Image preprocessing and multi-diagram candidate proposal
- End-to-end sample image recognition pipeline

### Run Frontend Typecheck & Build:
```bash
cd frontend
npm run build
```

---

## 7. Privacy & Offline Policy

ODR operates under an **Accuracy-First, Local-First** mandate:
1. All OCR and CV models run on your local CPU / GPU via ONNX Runtime.
2. No telemetry, tracking, or network requests are dispatched during recognition or editing.
3. Source images and project files remain in local directories on your computer.

---

## 8. License

MIT License. Developed for privacy-first technical documentation and diagram engineering.
