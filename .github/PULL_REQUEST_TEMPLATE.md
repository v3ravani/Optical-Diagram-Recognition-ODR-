## Description

Provide a clear and concise summary of the changes made in this pull request and the problem they solve.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue or recognition inaccuracy)
- [ ] New feature (non-breaking change adding diagram support, exporter, or UI function)
- [ ] Breaking change (fix or feature that would cause existing functionality not to work as expected)
- [ ] Documentation update (improving guides, docstrings, or repository notes)
- [ ] Test addition / improvement (enhancing coverage or regression suites)

## Subsystems Affected

- [ ] Image Preprocessing & Deskewing (`backend/pipeline/preprocessor.py`)
- [ ] Region Detection (`backend/pipeline/region_detector.py`)
- [ ] OCR & Text Normalization (`backend/pipeline/ocr_engine.py`)
- [ ] Shape Detection & Clustering (`backend/pipeline/shape_detector.py`)
- [ ] Connector Extraction & Routing (`backend/pipeline/connector_extractor.py`)
- [ ] Exporters (`backend/exporters/`)
- [ ] Frontend Canvas & Editor (`frontend/src/components/canvas/`)
- [ ] Frontend Review & Detection UI (`frontend/src/components/review/`)

## Verification & Testing

Explain how the changes were tested. Include commands executed and results observed.

```bash
# Example verification commands:
python -m pytest backend/tests/ -v
cd frontend && npm run build
```

- [ ] All 23+ backend tests pass cleanly.
- [ ] Frontend TypeScript type check and build pass with zero errors.
- [ ] Manual verification performed on sample diagrams (attach before/after screenshots if applicable).

## Checklist

- [ ] My code adheres to the project's coding standards and conventions.
- [ ] I have added automated tests covering the changes.
- [ ] I have updated relevant documentation in `docs/` and `README.md`.
- [ ] No private images, credentials, or personal test artifacts are included.
- [ ] All new dependencies are documented in `backend/requirements.txt` or `frontend/package.json`.
