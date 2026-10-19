# ODR Development Guide

This guide describes how to set up the development environment, run tests, debug the pipeline, and contribute code to Optical Diagram Recognition (ODR).

## Table of Contents

- [Development Prerequisites](#development-prerequisites)
- [Repository Setup](#repository-setup)
- [Backend Development](#backend-development)
  - [Virtual Environment Setup](#virtual-environment-setup)
  - [Running the Backend Server](#running-the-backend-server)
  - [Running Backend Tests](#running-backend-tests)
- [Frontend Development](#frontend-development)
  - [Installing Dependencies](#installing-dependencies)
  - [Running the Vite Dev Server](#running-the-vite-dev-server)
  - [Type Checking and Building](#type-checking-and-building)
- [Testing Standards](#testing-standards)
  - [Adding Test Cases](#adding-test-cases)
  - [Accuracy Regression Testing](#accuracy-regression-testing)
- [Code Conventions](#code-conventions)
  - [Python](#python)
  - [TypeScript and React](#typescript-and-react)
- [Debugging the Pipeline](#debugging-the-pipeline)

---

## Development Prerequisites

Before beginning development, ensure the following tools are installed:

- **Python**: Version 3.10 or newer (tested with Python 3.10 through 3.14).
- **Node.js**: Version 18.0 or newer (tested with Node.js 20 and 24).
- **npm**: Version 9.0 or newer.
- **Git**: Version 2.30 or newer.

---

## Repository Setup

Clone the repository:

```bash
git clone https://github.com/v3ravani/Optical-Diagram-Recognition-ODR-.git
cd Optical-Diagram-Recognition-ODR-
```

Create a safe local configuration file if custom ports or directories are required:

```bash
cp .env.example .env
```

---

## Backend Development

### Virtual Environment Setup

1. Create a Python virtual environment:

   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - **Linux / macOS**:
     ```bash
     source venv/bin/activate
     ```
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```

3. Install development and production dependencies:

   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements-dev.txt
   ```

### Running the Backend Server

Start the local FastAPI development server:

```bash
python run_odr.py
```

- **Backend Endpoint**: `http://127.0.0.1:8000`
- **Interactive OpenAPI Documentation**: `http://127.0.0.1:8000/docs`
- **Alternative Redoc Documentation**: `http://127.0.0.1:8000/redoc`

### Running Backend Tests

ODR uses `pytest` for all backend unit, regression, and end-to-end tests:

```bash
# Run all backend tests with verbose output
python -m pytest backend/tests/ -v

# Run a specific test suite
python -m pytest backend/tests/test_accuracy_upgrade.py -v
python -m pytest backend/tests/test_chart_recognition.py -v
python -m pytest backend/tests/test_hand_drawn_lamp.py -v
```

---

## Frontend Development

### Installing Dependencies

Navigate to the `frontend/` directory and install npm packages:

```bash
cd frontend
npm install
```

### Running the Vite Dev Server

Launch the development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173/`. Vite automatically proxies API requests to `http://127.0.0.1:8000` via the configuration in `vite.config.ts`.

### Type Checking and Building

Verify TypeScript types and produce the production asset bundle:

```bash
cd frontend

# Run TypeScript compilation check
npm run build
```

---

## Testing Standards

### Adding Test Cases

All pipeline changes must include automated tests:

- **Shape Detection**: Verify contour classification, convex hull metrics, and label assignments.
- **Connector Extraction**: Verify edge deduplication, arrow polarity, intermediate occlusion suppression, and branch label snapping.
- **Exporters**: Validate generated Mermaid, PlantUML, and JSON syntax.
- **Integrations**: Verify end-to-end processing from sample images to `CanonicalDiagram`.

### Accuracy Regression Testing

To prevent regressions in technical diagram fidelity:

1. Never commit changes that lower test suite pass counts.
2. Verify that synthetic samples in `samples/` pass recognition checks:
   ```bash
   python -m pytest backend/tests/test_e2e_samples.py -v
   ```
3. When improving recognition logic on difficult real-world diagrams, write a corresponding test in `backend/tests/test_accuracy_upgrade.py`.

---

## Code Conventions

### Python

- Follow PEP 8 style guidelines.
- Use explicit type annotations on public function arguments and return types.
- Avoid introducing remote network calls; maintain the 100% local-first principle.
- Use structured logging rather than raw unformatted print statements in production code.

### TypeScript and React

- Use strict TypeScript type checking (`noImplicitAny`, `strictNullChecks`).
- Separate presentation components from business logic and canvas math.
- Keep SVG coordinates synchronized with the canonical diagram coordinate space.
- Avoid unnecessary external UI component libraries; maintain vanilla CSS and lightweight custom components for maximum responsiveness and control.

---

## Debugging the Pipeline

To inspect intermediate computer vision steps (thresholding, contours, Hough lines):

```python
import cv2
from backend.pipeline.preprocessor import ImagePreprocessor
from backend.pipeline.region_detector import RegionDetector
from backend.pipeline.reconstruction import DiagramReconstructor

img = cv2.imread("samples/flowchart_order.png")
regions = RegionDetector.detect_diagram_regions(img, "flowchart_order.png")
diagram = DiagramReconstructor().reconstruct(img, regions[0], "debug_project")

print(f"Elements ({len(diagram.elements)}):")
for el in diagram.elements:
    print(f"  [{el.type.value}] {el.label} at ({el.x}, {el.y})")

print(f"Connectors ({len(diagram.connectors)}):")
for c in diagram.connectors:
    print(f"  {c.source_id} -> {c.target_id} [{c.label}]")
```
