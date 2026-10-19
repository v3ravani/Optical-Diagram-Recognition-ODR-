"""
ODR Launch Runner.
Starts the FastAPI local backend server on localhost:8000.
"""

import sys
import os
import uvicorn

if __name__ == "__main__":
    host = os.getenv("ODR_HOST", "127.0.0.1")
    port = int(os.getenv("ODR_PORT", "8000"))

    print("=" * 60)
    print("Starting ODR (Optical Diagram Recognition) Server...")
    print(f"Local Backend: http://{host}:{port}")
    print(f"API Documentation: http://{host}:{port}/docs")
    print("Local-first: All CV and OCR inference is 100% offline.")
    print("=" * 60)

    # Ensure backend directory is in python path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
