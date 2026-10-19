"""
Generates synthetic sample diagram images for testing and benchmarking ODR.
Creates:
1. samples/flowchart_order.png - A clean business process flowchart.
2. samples/multi_diagram_page.png - A single page containing two distinct diagrams.
3. samples/barchart_quarterly.png - A coordinate axis bar chart.
"""

import os
import cv2
import numpy as np


def generate_samples(output_dir: str = "samples"):
    os.makedirs(output_dir, exist_ok=True)

    # 1. Flowchart Order Processing (800x700)
    img1 = np.ones((700, 800, 3), dtype=np.uint8) * 255

    # Start terminal (oval/rounded)
    cv2.rectangle(img1, (300, 40), (500, 95), (43, 58, 66), 2)
    cv2.putText(img1, "Start Order", (340, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (15, 23, 42), 2)

    # Arrow 1
    cv2.arrowedLine(img1, (400, 95), (400, 160), (43, 58, 66), 2, tipLength=0.2)

    # Process step 1 (rectangle)
    cv2.rectangle(img1, (260, 160), (540, 230), (43, 58, 66), 2)
    cv2.putText(img1, "Verify Account & Balance", (280, 202), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)

    # Arrow 2
    cv2.arrowedLine(img1, (400, 230), (400, 300), (43, 58, 66), 2, tipLength=0.2)

    # Decision diamond
    pts = np.array([[400, 300], [530, 360], [400, 420], [270, 360]], np.int32)
    cv2.polylines(img1, [pts], isClosed=True, color=(43, 58, 66), thickness=2)
    cv2.putText(img1, "Sufficient Funds?", (305, 366), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 23, 42), 2)

    # Arrow Yes (downward)
    cv2.arrowedLine(img1, (400, 420), (400, 490), (43, 58, 66), 2, tipLength=0.2)
    cv2.putText(img1, "Yes", (410, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 118, 110), 2)

    # Process Fulfill
    cv2.rectangle(img1, (300, 490), (500, 560), (43, 58, 66), 2)
    cv2.putText(img1, "Fulfill Order", (345, 532), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (15, 23, 42), 2)

    # Arrow No (rightward)
    cv2.arrowedLine(img1, (530, 360), (640, 360), (43, 58, 66), 2, tipLength=0.2)
    cv2.putText(img1, "No", (565, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (185, 28, 28), 2)

    # Process Reject
    cv2.rectangle(img1, (640, 325), (780, 395), (43, 58, 66), 2)
    cv2.putText(img1, "Reject Order", (650, 366), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (15, 23, 42), 2)

    # End terminal
    cv2.arrowedLine(img1, (400, 560), (400, 620), (43, 58, 66), 2, tipLength=0.2)
    cv2.rectangle(img1, (320, 620), (480, 675), (43, 58, 66), 2)
    cv2.putText(img1, "End Order", (355, 655), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (15, 23, 42), 2)

    p1 = os.path.join(output_dir, "flowchart_order.png")
    cv2.imwrite(p1, img1)
    print(f"Generated {p1}")

    # 2. Multi-Diagram Page (900x1200) with 2 diagrams
    img2 = np.ones((1200, 900, 3), dtype=np.uint8) * 255

    # Diagram 1: Auth flow (top half)
    cv2.rectangle(img2, (100, 80), (800, 520), (200, 200, 200), 1)
    cv2.putText(img2, "Figure 1: Authentication Workflow", (120, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 2)

    cv2.rectangle(img2, (350, 140), (550, 190), (43, 58, 66), 2)
    cv2.putText(img2, "User Login", (390, 172), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)
    cv2.arrowedLine(img2, (450, 190), (450, 250), (43, 58, 66), 2, tipLength=0.2)

    cv2.rectangle(img2, (300, 250), (600, 310), (43, 58, 66), 2)
    cv2.putText(img2, "Hash Password & Check DB", (325, 287), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)
    cv2.arrowedLine(img2, (450, 310), (450, 380), (43, 58, 66), 2, tipLength=0.2)

    cv2.rectangle(img2, (340, 380), (560, 440), (43, 58, 66), 2)
    cv2.putText(img2, "Generate JWT Token", (360, 417), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)

    # Diagram 2: Cache Refresh flow (bottom half)
    cv2.rectangle(img2, (100, 600), (800, 1100), (200, 200, 200), 1)
    cv2.putText(img2, "Figure 2: Cache Synchronization", (120, 635), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 2)

    cv2.rectangle(img2, (350, 670), (550, 730), (43, 58, 66), 2)
    cv2.putText(img2, "Check Redis Cache", (370, 706), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)
    cv2.arrowedLine(img2, (450, 730), (450, 810), (43, 58, 66), 2, tipLength=0.2)

    cv2.rectangle(img2, (320, 810), (580, 875), (43, 58, 66), 2)
    cv2.putText(img2, "Update Dirty Keys", (365, 848), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)

    p2 = os.path.join(output_dir, "multi_diagram_page.png")
    cv2.imwrite(p2, img2)
    print(f"Generated {p2}")

    # 3. Bar Chart (700x500)
    img3 = np.ones((500, 700, 3), dtype=np.uint8) * 255
    cv2.putText(img3, "Quarterly Revenue (2026)", (200, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (15, 23, 42), 2)

    # Coordinate Axes
    cv2.line(img3, (100, 400), (620, 400), (43, 58, 66), 2)  # X axis
    cv2.line(img3, (100, 400), (100, 80), (43, 58, 66), 2)   # Y axis

    # Bars: Q1 (h=140), Q2 (h=220), Q3 (h=180), Q4 (h=290)
    bars = [("Q1", 140, 160), ("Q2", 220, 270), ("Q3", 180, 380), ("Q4", 290, 490)]
    for label, h, x in bars:
        cv2.rectangle(img3, (x, 400 - h), (x + 60, 400), (59, 130, 246), -1)
        cv2.rectangle(img3, (x, 400 - h), (x + 60, 400), (29, 78, 216), 2)
        cv2.putText(img3, label, (x + 15, 425), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (15, 23, 42), 2)

    p3 = os.path.join(output_dir, "barchart_quarterly.png")
    cv2.imwrite(p3, img3)
    print(f"Generated {p3}")


if __name__ == "__main__":
    generate_samples()
