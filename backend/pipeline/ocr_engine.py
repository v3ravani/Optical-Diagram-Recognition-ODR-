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
        Returns a list of detected text blocks with coordinates and confidence.
        """
        if self._engine is None:
            return []

        try:
            results, elapse = self._engine(image)
            if not results:
                return []

            blocks: List[OCRTextBlock] = []
            for item in results:
                # item is [box, text, score]
                poly, text, score = item[0], item[1], float(item[2])
                
                # poly is [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                poly_arr = np.array(poly, dtype=np.int32)
                x = int(np.min(poly_arr[:, 0]))
                y = int(np.min(poly_arr[:, 1]))
                w = int(np.max(poly_arr[:, 0]) - x)
                h = int(np.max(poly_arr[:, 1]) - y)

                clean_text = str(text).strip()
                if clean_text:
                    blocks.append(OCRTextBlock(
                        text=clean_text,
                        confidence=score,
                        x=max(0, x),
                        y=max(0, y),
                        width=max(1, w),
                        height=max(1, h),
                        polygon=poly_arr.tolist()
                    ))

            return blocks
        except Exception as e:
            print(f"[OCREngine] OCR processing exception: {e}")
            return []
