from fastapi import FastAPI, UploadFile, HTTPException
import tensorflow as tf
import numpy as np
import cv2
import base64
from PIL import Image
import io

app = FastAPI()

MODEL_PATH    = "/app/models/improved_model3.0.h5"
GRADCAM_LAYER = "conv5_block3_out"   # ResNet50 last conv block — 7×7×2048

# ── Load model once at startup ────────────────────────────────────────────────
model = tf.keras.models.load_model(MODEL_PATH)
grad_model = tf.keras.Model(
    inputs=model.input,
    outputs=[model.get_layer(GRADCAM_LAYER).output, model.outputs[0]]
)


# ═════════════════════════════════════════════════════════════════════════════
# PREPROCESSING
# ═════════════════════════════════════════════════════════════════════════════

def preprocess(img_rgb: np.ndarray) -> tf.Tensor:
    """Centre-crop to square, resize to 224×224, normalise to [0,1]."""
    h, w = img_rgb.shape[:2]
    size = min(h, w)
    y0   = (h - size) // 2
    x0   = (w - size) // 2
    crop = img_rgb[y0:y0 + size, x0:x0 + size]
    resized = cv2.resize(crop, (224, 224))
    arr = resized.astype(np.float32) / 255.0
    return tf.cast(np.expand_dims(arr, 0), tf.float32)


# ═════════════════════════════════════════════════════════════════════════════
# GRADCAM
# ═════════════════════════════════════════════════════════════════════════════

def _compute_cam(conv_out, grads) -> np.ndarray:
    weights = tf.reduce_mean(grads, axis=(1, 2))          # (1, 2048)
    cam     = tf.reduce_sum(conv_out * weights[:, None, None, :], axis=-1)[0]
    cam     = tf.maximum(cam, 0) / (tf.reduce_max(cam) + 1e-8)
    return cv2.resize(cam.numpy(), (224, 224))


# ═════════════════════════════════════════════════════════════════════════════
# LABEL HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def score_to_label(score: float) -> str:
    if score > 0.7:  return "FAKE"
    if score > 0.3:  return "UNCERTAIN"
    return "REAL"

def score_to_confidence(score: float) -> float:
    return round((score if score > 0.5 else 1.0 - score) * 100, 1)


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile):
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images are accepted")

    img_bytes = await file.read()
    if len(img_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    try:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_rgb = np.array(pil_img)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not decode image")

    # ── 1. Preprocess ─────────────────────────────────────────────────────────
    img_tf  = preprocess(img_rgb)
    img_bgr = cv2.cvtColor(cv2.resize(img_rgb, (224, 224)), cv2.COLOR_RGB2BGR)

    # ── 2. Predict — Keras sorts classes alphabetically: fake=0, real=1 ───────
    #    pred[:, 0] = P(real)  →  fake_prob = 1 - P(real)
    with tf.GradientTape() as tape:
        tape.watch(img_tf)
        conv_out, pred = grad_model(img_tf)
        loss = 1.0 - pred[:, 0]    # gradient of P(fake)

    score = round(float(loss.numpy()[0]), 4)

    # ── 3. GradCAM ────────────────────────────────────────────────────────────
    grads = tape.gradient(loss, conv_out)
    if grads is None:
        raise HTTPException(status_code=500, detail="GradCAM gradient computation failed")

    heatmap       = _compute_cam(conv_out, grads)
    heatmap_color = cv2.applyColorMap(np.uint8(255 * heatmap), cv2.COLORMAP_JET)
    overlay       = cv2.addWeighted(img_bgr, 0.6, heatmap_color, 0.4, 0)

    _, buf       = cv2.imencode(".jpg", overlay)
    gradcam_b64  = base64.b64encode(buf).decode()

    return {
        "score":       score,
        "label":       score_to_label(score),
        "confidence":  score_to_confidence(score),
        "gradcam_b64": gradcam_b64,
    }
