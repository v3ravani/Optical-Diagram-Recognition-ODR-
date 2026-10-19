# Contributing to Optical Diagram Recognition (ODR)

Thank you for your interest in contributing to Optical Diagram Recognition (ODR). We welcome contributions from developers, computer vision researchers, and open-source practitioners.

This document outlines our contribution philosophy, development workflow, testing requirements, and quality standards.

## Table of Contents

- [Contribution Philosophy](#contribution-philosophy)
- [Prerequisites and Environment](#prerequisites-and-environment)
- [Repository Structure](#repository-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing and Verification Requirements](#testing-and-verification-requirements)
- [Reporting Recognition Bugs](#reporting-recognition-bugs)
- [Extending the Recognition Engine](#extending-the-recognition-engine)
  - [Adding a New Diagram Type](#adding-a-new-diagram-type)
  - [Modifying OCR or Text Normalization](#modifying-ocr-or-text-normalization)
  - [Modifying Shape Detection](#modifying-shape-detection)
  - [Modifying Connector and Arrow Extraction](#modifying-connector-and-arrow-extraction)
- [Pull Request Process](#pull-request-process)
- [Commit Message Conventions](#commit-message-conventions)
- [External Dependencies and Models](#external-dependencies-and-models)
- [License and Intellectual Property](#license-and-intellectual-property)

---

## Contribution Philosophy

1. **Strict Offline Privacy**: ODR must run entirely locally. Contributions that introduce external cloud API dependencies, telemetry, or remote inference will not be accepted.
2. **Topological and Structural Fidelity**: Recognition logic must prioritize diagram topology—nodes, directed edges, feedback loops, crossings, and branch labels—over cosmetic approximations.
3. **Reproducibility and Test Coverage**: Every bug fix or accuracy improvement must be accompanied by automated unit or regression tests.

---

## Prerequisites and Environment

Ensure you have the following installed:

- Python 3.10+
- Node.js 18+ and npm 9+
- Git 2.30+

Setup commands:

```bash
# Clone the repository
git clone https://github.com/v3ravani/Optical-Diagram-Recognition-ODR-.git
cd Optical-Diagram-Recognition-ODR-

# Backend environment setup
python -m venv venv
# Linux/macOS: source venv/bin/activate
# Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install -r backend/requirements-dev.txt

# Frontend environment setup
cd frontend
npm install
cd ..
```

---

## Repository Structure

```text
ODR/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── assets/
│   ├── architecture.md
│   └── development.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│   ├── public/
│   └── package.json
├── backend/
│   ├── core/
│   │   ├── models.py
│   │   └── validator.py
│   ├── pipeline/
│   │   ├── preprocessor.py
│   │   ├── region_detector.py
│   │   ├── ocr_engine.py
│   │   ├── shape_detector.py
│   │   └── connector_extractor.py
│   ├── exporters/
│   ├── storage/
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
├── models/
│   └── README.md
├── scripts/
│   └── generate_samples.py
├── samples/
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── run_odr.py
└── SECURITY.md
```

---

## Development Workflow

1. Create a feature or fix branch from `main`:
   ```bash
   git checkout -b fix/connector-branch-binding
   ```
2. Start the backend development server:
   ```bash
   python run_odr.py
   ```
3. Start the frontend development server:
   ```bash
   cd frontend && npm run dev
   ```
4. Verify changes by running automated tests:
   ```bash
   python -m pytest backend/tests/ -v
   cd frontend && npm run build
   ```

---

## Coding Standards

### Python

- Follow PEP 8 guidelines.
- Use explicit type annotations for function signatures.
- Document classes and public functions with clear docstrings.
- Keep computer vision algorithms deterministic and mathematically sound.

### TypeScript and React

- Enable strict type checks (`noImplicitAny: true`, `strict: true`).
- Ensure all interactive elements have unique, descriptive `id` or `data-testid` attributes.
- Use Vanilla CSS modules or scoped CSS for UI styling.

---

## Testing and Verification Requirements

Pull requests must pass all existing tests and add new tests covering any modified functionality:

```bash
# Execute complete backend test suite
python -m pytest backend/tests/ -v

# Verify frontend TypeScript build
cd frontend && npm run build
```

Specific test requirements by subsystem:
- **Connector Extraction**: Verify edge deduplication, arrow polarity, intermediate occlusion suppression, and branch label snapping.
- **OCR Enhancements**: Ensure character normalization handles technical keywords without degrading unrelated strings.
- **Exporters**: Ensure valid syntax for Mermaid (`flowchart TD`, `pie`, `xychart-beta`) and PlantUML.

---

## Reporting Recognition Bugs

When reporting an issue where a diagram fails to recognize correctly:

1. **Provide a Reproducible Sample**: Attach the test image or screenshot (redacting sensitive corporate or personal data).
2. **Describe Expected Topology**: State the expected nodes, connectors, directions, and labels.
3. **Describe Observed Result**: State the actual recognized nodes, missing connections, reversed arrows, or misclassified shapes.
4. **Environment**: Specify your OS, Python version, and browser version.

---

## Extending the Recognition Engine

### Adding a New Diagram Type

1. **Model Definition**: Add new node and connector roles in `backend/core/models.py` (`ElementType`, `DiagramFamily`).
2. **Region Heuristics**: Update `backend/pipeline/region_detector.py` to identify the diagram family from visual contours and aspect ratios.
3. **Shape Extraction**: Add contour detection and classification rules in `backend/pipeline/shape_detector.py`.
4. **Reconstruction**: Add dedicated reconstruction logic in `backend/pipeline/reconstruction.py`.
5. **Exporters**: Update `backend/exporters/` to generate appropriate Mermaid or PlantUML representations.
6. **Tests**: Add unit and regression tests in `backend/tests/`.

### Modifying OCR or Text Normalization

- Edits to `backend/pipeline/ocr_engine.py` must preserve scale limits (maximum upscale $2.0\times$ to prevent stroke blurring).
- Vocabulary replacements in `_normalize_diagram_text` must be bounded to specific technical contexts.

### Modifying Shape Detection

- Bounding box adjustments in `backend/pipeline/shape_detector.py` must account for polygon approximation tolerances (`cv2.approxPolyDP`) and contour convex hull solidity.
- Outer container filtering (`_filter_containers_and_duplicates`) must ensure child shapes are not swallowed by enclosing boxes or return loop strokes.

### Modifying Connector and Arrow Extraction

- Avoid adding multiple parallel edges for the same stroke; group edges by pair `(min(A, B), max(A, B))`.
- Test directional polarity against flowchart rules: top-to-bottom hierarchy, decision-to-branch hierarchy, and role markers.
- Ensure conditional branch labels (`Yes`, `No`, `True`, `False`) attach exclusively to connectors leaving decision diamond elements.

---

## Pull Request Process

1. Rebase your feature branch against the latest `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Run all tests locally and ensure clean execution.
3. Submit a pull request using the provided [pull request template](.github/PULL_REQUEST_TEMPLATE.md).
4. Include before/after recognition examples or test output in the PR description.
5. Address any review feedback. Maintainers will verify tests in continuous integration prior to merging.

---

## Commit Message Conventions

Use conventional commit messages:

- `feat:` Adds a new feature or capability.
- `fix:` Fixes a defect, inaccurate recognition, or export bug.
- `docs:` Documentation improvements or additions.
- `test:` Adds or updates automated tests.
- `refactor:` Code improvements without behavioral changes.
- `chore:` Maintenance tasks, dependency updates, or git hygiene.

Example:
```text
fix(connector): prune intermediate occlusion bypass lines in technical flowcharts
```

---

## External Dependencies and Models

- Do not commit large binary weights directly to git.
- All new Python dependencies must be vetted for license compatibility (MIT, Apache 2.0, BSD) and recorded in `backend/requirements.txt`.
- All new npm dependencies must be recorded in `frontend/package.json`.

---

## License and Intellectual Property

By contributing to ODR, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
