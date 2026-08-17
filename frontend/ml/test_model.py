from ultralytics import YOLO

MODEL_PATH = "ml/models/best.pt"
IMAGE_PATH = "ml/test_images/road1.jpg"

CONFIDENCE_THRESHOLD = 0.50

print("Loading model...")

model = YOLO(MODEL_PATH)

print("Model loaded successfully!")
print("Classes:", model.names)

print("\nRunning prediction...")

results = model(
    IMAGE_PATH,
    conf=CONFIDENCE_THRESHOLD,
    save=True
)

potholes = []
cracks = []

for result in results:

    if result.boxes is None:
        continue

    for box in result.boxes:

        class_id = int(box.cls[0])
        confidence = float(box.conf[0])

        class_name = model.names[class_id]

        detection = {
            "class": class_name,
            "confidence": round(confidence, 2)
        }

        if class_name == "pothole":
            potholes.append(detection)

        elif class_name in [
            "crocodile crack",
            "longitudinal crack"
        ]:
            cracks.append(detection)


print("\n" + "=" * 50)
print("ROAD ANALYSIS")
print("=" * 50)

print(f"Potholes detected : {len(potholes)}")
print(f"Cracks detected   : {len(cracks)}")

print("\nPotholes:")

for pothole in potholes:
    print(
        f"  Confidence = "
        f"{pothole['confidence']}"
    )

print("\nCracks:")

for crack in cracks:
    print(
        f"  {crack['class']} "
        f"confidence = "
        f"{crack['confidence']}"
    )

print("=" * 50)