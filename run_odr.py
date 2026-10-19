"""
ODR Launch Runner.
Starts the FastAPI local backend server on localhost:8000.
"""

import sys
import os
import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("Starting ODR (Optical Diagram Recognition) Server...")
    print("Local Backend: http://127.0.0.1:8000")
    print("API Documentation: http://127.0.0.1:8000/docs")
    print("Local-first: All CV and OCR inference is 100% offline.")
    print("=" * 60)

    # Ensure backend directory is in python path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
