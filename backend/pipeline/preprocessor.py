"""
ODR Image and Document Preprocessor.
Supports local image decoding (PNG, JPEG, WebP, BMP), multi-page PDF rasterization,
orientation detection, deskewing, and contrast normalization.
"""

import os
import io
import math
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF


class ImagePreprocessor:
    """Preprocesses input files (raster images & PDFs) for diagram detection and OCR."""

    @staticmethod
    def load_file_to_images(file_bytes: bytes, file_name: str) -> List[Tuple[np.ndarray, int]]:
        """
        Loads an uploaded file (image or PDF) and returns a list of (image_bgr_array, page_number).
        """
        lower_name = file_name.lower()
        results: List[Tuple[np.ndarray, int]] = []

        if lower_name.endswith(".pdf"):
            # Use PyMuPDF to render PDF pages at 200 DPI for crisp line & text recognition
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                results.append((bgr, page_idx + 1))
            doc.close()
        else:
            # Decode image using OpenCV from buffer
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                # Fallback to PIL
                pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            results.append((img, 1))

        return results

    @staticmethod
    def suppress_notebook_lines(image: np.ndarray) -> np.ndarray:
        """
        Suppresses faint blue/cyan or light gray notebook ruling lines to prevent them
        from interfering with hand-drawn shape contour detection and OCR.
        """
        if len(image.shape) < 3:
            return image
            
        b, g, r = cv2.split(image)
        # Blue/cyan notebook ruling lines: high blue, lower red/green, relatively light
        b_diff_r = b.astype(int) - r.astype(int)
        b_diff_g = b.astype(int) - g.astype(int)
        is_blue_line = (b_diff_r > 12) & (b_diff_g > 6) & (b > 110)

        cleaned = image.copy()
        cleaned[is_blue_line] = [255, 255, 255]
        return cleaned

    @staticmethod
    def deskew(image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Estimates skew angle using minAreaRect on edge contours and rotates image if angle > 0.5 degrees.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150, apertureSize=3)

        coords = np.column_stack(np.where(edges > 0))
        if len(coords) < 100:
            return image, 0.0

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # If angle is negligible, do not rotate
        if abs(angle) < 0.6 or abs(angle) > 30:
            return image, 0.0

        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, rot_mat, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated, angle

    @staticmethod
    def normalize_contrast(image: np.ndarray) -> np.ndarray:
        """Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) in LAB space."""
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        merged = cv2.merge((cl, a, b))
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

    @staticmethod
    def binarize(image: np.ndarray) -> np.ndarray:
        """Converts image to clean binary black-on-white image using Otsu and adaptive thresholding."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        thresh = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6
        )
        return thresh
