
import base64, io, os, json
import numpy as np
import cv2
from flask import Flask, send_from_directory
from flask_sock import Sock
import mediapipe as mp

app = Flask(__name__, static_folder="static")
sock = Sock(app)

mp_face_mesh = mp.solutions.face_mesh
mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory("static", path)

def decode_base64_image(b64):
    # b64 like: "data:image/jpeg;base64,/9j/4AAQ..."
    if ';base64,' in b64:
        b64 = b64.split(';base64,',1)[1]
    data = base64.b64decode(b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
    return img

def get_landmarks_jewelry_positions(image_bgr):
    h, w = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = mesh.process(image_rgb)
    if not results.multi_face_landmarks:
        return {"face": False}

    # Use first face
    lm = results.multi_face_landmarks[0]
    pts = [(int(p.x * w), int(p.y * h), p.z) for p in lm.landmark]

    # Compute leftmost/rightmost/top/bottom for approximations
    left = min(pts, key=lambda p: p[0])
    right = max(pts, key=lambda p: p[0])
    top = min(pts, key=lambda p: p[1])
    bottom = max(pts, key=lambda p: p[1])

    faceW = ((right[0]-left[0])**2 + (right[1]-left[1])**2)**0.5
    faceH = ((bottom[0]-top[0])**2 + (bottom[1]-top[1])**2)**0.5

    # Nose tip: choose point with minimum (closest) z value (z is negative in MP coords)
    nose = min(pts, key=lambda p: p[2])

    # Chin: highest y (bottom-most)
    chin = bottom

    # Ear anchors: approx at extreme x positions with y near lower face
    ear_y_offset = int(faceH * 0.05)
    leftEar = (left[0], int((bottom[1] + top[1])*0.6) - ear_y_offset)
    rightEar = (right[0], int((bottom[1] + top[1])*0.6) - ear_y_offset)

    return {
        "face": True,
        "w": w,
        "h": h,
        "faceW": faceW,
        "faceH": faceH,
        "nose": {"x": nose[0], "y": nose[1]},
        "chin": {"x": chin[0], "y": chin[1]},
        "leftEar": {"x": leftEar[0], "y": leftEar[1]},
        "rightEar": {"x": rightEar[0], "y": rightEar[1]},
    }

@sock.route("/ws")
def ws(ws):
    # Receives JSON: {image: <dataURL>}
    # Sends back JSON of landmarks: {face: bool, nose:{x,y}, chin:{x,y}, leftEar:{x,y}, rightEar:{x,y}, faceW, faceH}
    while True:
        msg = ws.receive()
        if msg is None:
            break
        try:
            data = json.loads(msg)
            img_b64 = data.get("image")
            if not img_b64:
                ws.send(json.dumps({"error": "no_image"}))
                continue
            img = decode_base64_image(img_b64)
            if img is None:
                ws.send(json.dumps({"error": "decode_failed"}))
                continue
            pos = get_landmarks_jewelry_positions(img)
            ws.send(json.dumps(pos))
        except Exception as e:
            ws.send(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
