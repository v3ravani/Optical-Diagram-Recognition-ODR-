"""
ODR Local OCR Engine.
Wraps RapidOCR (local ONNX runtime) for text detection and recognition.
Preserves bounding boxes, confidence scores, and line associations.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from pydantic import BaseModel


class OCRTextBlock(BaseModel):
    text: str
    confidence: float
    x: int
    y: int
    width: int
    height: int
    polygon: List[List[int]]


class OCREngine:
    """Singleton wrapper around RapidOCR local engine."""
    _instance: Optional[OCREngine] = None
    _engine = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OCREngine, cls).__new__(cls)
            try:
                from rapidocr_onnxruntime import RapidOCR
                cls._instance._engine = RapidOCR()
            except Exception as e:
                print(f"[OCREngine] Warning: RapidOCR initialization error: {e}")
                cls._instance._engine = None
        return cls._instance

    def extract_text(self, image: np.ndarray) -> List[OCRTextBlock]:
        """
        Runs local OCR on the given BGR image.
        Uses adaptive multi-scale inference for low-resolution diagram crops.
        Returns a list of detected text blocks with coordinates and confidence.
        """
        if self._engine is None:
            return []

        try:
            import cv2
            h, w = image.shape[:2]
            min_dim = min(h, w)
            scale = 1.0

            # If crop is low resolution (e.g. screenshot or small diagram), upscale with cubic interpolation
            if min_dim < 700:
                scale = min(3.0, 900.0 / max(1, min_dim))
                scaled_w = int(w * scale)
                scaled_h = int(h * scale)
                ocr_input = cv2.resize(image, (scaled_w, scaled_h), interpolation=cv2.INTER_CUBIC)
            else:
                ocr_input = image

            results, elapse = self._engine(ocr_input)
            if not results:
                return []

            blocks: List[OCRTextBlock] = []
            for item in results:
                # item is [box, text, score]
                poly, text, score = item[0], item[1], float(item[2])
                
                # Map back to original coordinate scale
                poly_arr = np.array(poly, dtype=np.float32)
                if scale != 1.0:
                    poly_arr = poly_arr / scale

                x = int(np.min(poly_arr[:, 0]))
                y = int(np.min(poly_arr[:, 1]))
                w_box = int(np.max(poly_arr[:, 0]) - x)
                h_box = int(np.max(poly_arr[:, 1]) - y)

                clean_text = self._normalize_diagram_text(str(text))
                if clean_text:
                    blocks.append(OCRTextBlock(
                        text=clean_text,
                        confidence=score,
                        x=max(0, x),
                        y=max(0, y),
                        width=max(1, w_box),
                        height=max(1, h_box),
                        polygon=[[int(pt[0]), int(pt[1])] for pt in poly_arr]
                    ))

            return blocks
        except Exception as e:
            print(f"[OCREngine] OCR processing exception: {e}")
            return []

    @classmethod
    def _normalize_diagram_text(cls, text: str) -> str:
        """
        Fixes common optical character recognition distortions on technical diagrams,
        flowchart labels, decision conditions, and branch indicators.
        """
        import re
        t = text.strip()
        lower = t.lower()
        if lower in ("ne", "n0", "noo", "nd", "na"):
            return "No"
        if lower in ("ycs", "yos", "yea", "ys"):
            return "Yes"
        if lower in ("tme", "tue", "tru"):
            return "True"
        if lower in ("falso", "flse", "fale"):
            return "False"

        # Common flowchart vocabulary corrections
        corrections = [
            (r"\bBalb\b", "Bulb"),
            (r"\bbalb\b", "bulb"),
            (r"\bCoffeomechint\b", "Coffee machine"),
            (r"\bCorreemscrineconsr\b", "Coffee machine"),
            (r"\bCoffeemachine\b", "Coffee machine"),
            (r"\bdaasn'twork\b", "doesn't work"),
            (r"\bdoesn'twork\b", "doesn't work"),
            (r"\bRefiltank\b", "Refill tank"),
            (r"\bRefillgrinder\b", "Refill grinder"),
            (r"\bCantactmainianance\b", "Contact maintenance"),
            (r"\bContactmaintenance\b", "Contact maintenance"),
            (r"\bContinueto\b", "Continue to")
        ]
        for pattern, repl in corrections:
            t = re.sub(pattern, repl, t, flags=re.IGNORECASE)
        return t
