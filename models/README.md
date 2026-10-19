# ODR Model Runtimes and Local Weights

ODR operates completely offline without sending images or data to any external cloud API or proprietary remote model endpoint.

## Local Inference Engine

ODR uses the **RapidOCR ONNX Runtime** (`rapidocr-onnxruntime`) for local optical character recognition and text detection.

### Architecture

- **Detection Model**: PP-OCRv4 text detection ONNX model. Identifies bounding quadrilaterals for text blocks within diagrams.
- **Direction Classification Model**: Angle classification ONNX model. Handles 0, 90, 180, and 270 degree text orientations.
- **Recognition Model**: PP-OCRv4 recognition ONNX model. Performs character sequence recognition on detected cropped text regions.

### Model Storage and Caching

The default ONNX models are bundled directly with the `rapidocr-onnxruntime` package upon `pip install` or downloaded on first run into the local user cache directory:

- Windows: `%USERPROFILE%\.rapidocr\`
- Linux/macOS: `~/.rapidocr/`

Once cached, all inferences execute locally via ONNX Runtime using CPU acceleration.

### Verification of Offline Execution

To verify that OCR functions without network access:

```bash
# Disable network or test in an isolated offline environment
python -c "from rapidocr_onnxruntime import RapidOCR; engine = RapidOCR(); print('Local OCR Engine Ready:', engine is not None)"
```
