from __future__ import annotations

import argparse
import json
import math
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = REPO_ROOT / "oil-bottle-frames"
NATURAL_ROOT = DATA_ROOT / "oil-bottle-frames"
AUGMENTED_ROOT = DATA_ROOT / "oil-bottle-augmented"
RUN_ROOT = REPO_ROOT / "runs" / "curated-svg-kitchen-augmentations"
SVG_TARGET = {"left": 0.30, "top": 0.15, "width": 0.40, "height": 0.56}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class BottleBox:
    left: float
    top: float
    width: float
    height: float

    @property
    def center_x(self) -> float:
        return self.left + self.width / 2

    @property
    def center_y(self) -> float:
        return self.top + self.height / 2

    @property
    def aspect_h_over_w(self) -> float:
        return self.height / max(self.width, 1e-6)


@dataclass
class Candidate:
    path: Path
    volume: str
    box: BottleBox
    score: float
    target_score: float
    quality_score: float
    glare_ratio: float
    blur_score: float
    exposure_score: float


VARIANTS = [
    {
        "name": "normal_kitchen",
        "brightness": 1.02,
        "contrast": 1.04,
        "saturation": 1.02,
        "temperature": 4,
        "light": "neutral",
    },
    {
        "name": "warm_window",
        "brightness": 1.08,
        "contrast": 1.02,
        "saturation": 1.04,
        "temperature": 10,
        "light": "warm",
    },
    {
        "name": "cool_evening",
        "brightness": 0.94,
        "contrast": 1.07,
        "saturation": 0.98,
        "temperature": -7,
        "light": "cool",
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Select SVG-aligned natural bottle frames and create curated kitchen-condition augmentations."
    )
    parser.add_argument("--candidates", type=int, default=3, help="Candidate natural frames per volume.")
    parser.add_argument("--variants", type=int, default=3, help="Augmented variants per candidate.")
    parser.add_argument("--seed", type=int, default=1500)
    parser.add_argument("--force", action="store_true", help="Overwrite curated images from a previous run.")
    args = parser.parse_args()

    random.seed(args.seed)
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    summary = {
        "seed": args.seed,
        "target": SVG_TARGET,
        "variantCountPerCandidate": min(args.variants, len(VARIANTS)),
        "volumes": [],
    }
    review_items: list[tuple[Path, Path, str, str]] = []

    for volume_dir in sorted(p for p in NATURAL_ROOT.iterdir() if p.is_dir()):
        volume = volume_dir.name
        if volume == "1.5L_refs":
            continue
        candidates = select_candidates(volume_dir, args.candidates)
        out_dir = AUGMENTED_ROOT / volume / "curated_svg_kitchen"
        out_dir.mkdir(parents=True, exist_ok=True)
        volume_report = {
            "volume": volume,
            "candidateCount": len(candidates),
            "candidates": [],
            "generated": [],
        }

        for candidate_index, candidate in enumerate(candidates):
            volume_report["candidates"].append(candidate_record(candidate, candidate_index))
            for variant in VARIANTS[: args.variants]:
                out_path = out_dir / f"curated-svg-{volume}-c{candidate_index:02d}-{variant['name']}.jpg"
                if out_path.exists() and not args.force:
                    generated = review_generated(candidate.path, out_path, candidate.box)
                else:
                    generated = create_augmentation(candidate, variant, out_path, args.seed + candidate_index)
                volume_report["generated"].append(
                    {
                        "path": rel(out_path),
                        "source": rel(candidate.path),
                        "variant": variant["name"],
                        **generated,
                    }
                )
                review_items.append((candidate.path, out_path, volume, variant["name"]))

        summary["volumes"].append(volume_report)

    manifest_path = RUN_ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_review_sheet(review_items, RUN_ROOT / "review_contact_sheet.jpg")
    print(f"Wrote manifest: {manifest_path}")
    print(f"Wrote review sheet: {RUN_ROOT / 'review_contact_sheet.jpg'}")
    print(f"Generated/reviewed images: {sum(len(v['generated']) for v in summary['volumes'])}")


def image_files(path: Path) -> list[Path]:
    return sorted(
        p
        for p in path.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS and "non_eligable" not in p.parts
    )


def select_candidates(volume_dir: Path, count: int) -> list[Candidate]:
    scored: list[Candidate] = []
    for path in image_files(volume_dir):
        candidate = score_candidate(path, volume_dir.name)
        if candidate is not None:
            scored.append(candidate)

    scored.sort(key=lambda c: c.score, reverse=True)
    return scored[:count]


def score_candidate(path: Path, volume: str) -> Candidate | None:
    bgr = cv2.imread(str(path))
    if bgr is None:
        return None
    box = detect_bottle_box(bgr)
    if box is None:
        return None
    quality = image_quality(bgr)
    target_score = score_against_target(box)
    upright_bonus = clamp((box.aspect_h_over_w - 1.25) / 1.2, 0, 1)
    edge_penalty = 0.18 if touches_edge(box) else 0
    score = 0.58 * target_score + 0.30 * quality["score"] + 0.12 * upright_bonus - edge_penalty
    return Candidate(
        path=path,
        volume=volume,
        box=box,
        score=round(score, 4),
        target_score=round(target_score, 4),
        quality_score=round(quality["score"], 4),
        glare_ratio=round(quality["glareRatio"], 4),
        blur_score=round(quality["blurScore"], 4),
        exposure_score=round(quality["exposureScore"], 4),
    )


def detect_bottle_box(bgr: np.ndarray) -> BottleBox | None:
    height, width = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    red = (((hsv[:, :, 0] < 12) | (hsv[:, :, 0] > 165)) & (hsv[:, :, 1] > 35) & (hsv[:, :, 2] > 60))
    green = ((hsv[:, :, 0] > 35) & (hsv[:, :, 0] < 95) & (hsv[:, :, 1] > 30) & (hsv[:, :, 2] > 50))
    yellow = ((hsv[:, :, 0] > 14) & (hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 30) & (hsv[:, :, 2] > 65))
    mask = (red | green | yellow).astype("uint8") * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [c for c in contours if cv2.contourArea(c) > 35]
    if not contours:
        return None

    def contour_rank(contour: np.ndarray) -> float:
        x, y, w, h = cv2.boundingRect(contour)
        cx = (x + w / 2) / width
        area = cv2.contourArea(contour)
        center_penalty = abs(cx - 0.5) * 220
        return area - center_penalty

    contour = max(contours, key=contour_rank)
    x, y, w, h = cv2.boundingRect(contour)
    cx = x + w / 2
    cy = y + h / 2

    expanded_w = max(w * 1.45, width * 0.18)
    expanded_h = max(h * 1.75, height * 0.30)
    left = clamp((cx - expanded_w / 2) / width, 0, 1)
    top = clamp((cy - expanded_h * 0.52) / height, 0, 1)
    right = clamp((cx + expanded_w / 2) / width, 0, 1)
    bottom = clamp((cy + expanded_h * 0.48) / height, 0, 1)
    if right - left <= 0.05 or bottom - top <= 0.12:
        return None
    return BottleBox(left, top, right - left, bottom - top)


def score_against_target(box: BottleBox) -> float:
    target_center_x = SVG_TARGET["left"] + SVG_TARGET["width"] / 2
    target_center_y = SVG_TARGET["top"] + SVG_TARGET["height"] / 2
    shape_error = max(
        abs(box.center_x - target_center_x) / 0.18,
        abs(box.center_y - target_center_y) / 0.18,
        abs(box.width - SVG_TARGET["width"]) / 0.28,
        abs(box.height - SVG_TARGET["height"]) / 0.28,
    )
    return clamp(1 - shape_error, 0, 1)


def touches_edge(box: BottleBox) -> bool:
    return box.left <= 0.035 or box.top <= 0.035 or box.left + box.width >= 0.965 or box.top + box.height >= 0.965


def image_quality(bgr: np.ndarray) -> dict[str, float]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mean = float(gray.mean())
    glare_ratio = float((gray > 248).mean())
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    exposure_score = 1 - min(abs(mean - 178) / 120, 1)
    glare_score = 1 - min(glare_ratio / 0.12, 1)
    blur_score = min(blur_variance / 85, 1)
    score = 0.42 * exposure_score + 0.33 * glare_score + 0.25 * blur_score
    return {
        "score": clamp(score, 0, 1),
        "glareRatio": glare_ratio,
        "blurScore": blur_score,
        "exposureScore": exposure_score,
    }


def create_augmentation(candidate: Candidate, variant: dict[str, object], out_path: Path, seed: int) -> dict[str, object]:
    source = Image.open(candidate.path).convert("RGB")
    width, height = source.size
    background = make_kitchen_background(width, height, str(variant["light"]), seed)
    adjusted = adjust_foreground(source, variant)
    alpha = make_soft_bottle_alpha(candidate.box, width, height)
    shadow = make_shadow(candidate.box, width, height)

    composed = background.convert("RGBA")
    composed.alpha_composite(shadow)
    composed.alpha_composite(Image.composite(adjusted, background, alpha).convert("RGBA"))
    final = composed.convert("RGB").filter(ImageFilter.GaussianBlur(radius=0.08))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.save(out_path, quality=92, subsampling=1)
    return review_generated(candidate.path, out_path, candidate.box)


def adjust_foreground(source: Image.Image, variant: dict[str, object]) -> Image.Image:
    image = ImageEnhance.Brightness(source).enhance(float(variant["brightness"]))
    image = ImageEnhance.Contrast(image).enhance(float(variant["contrast"]))
    image = ImageEnhance.Color(image).enhance(float(variant["saturation"]))
    temp = int(variant["temperature"])
    arr = np.asarray(image).astype(np.int16)
    arr[:, :, 0] = np.clip(arr[:, :, 0] + temp, 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] - temp, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def make_soft_bottle_alpha(box: BottleBox, width: int, height: int) -> Image.Image:
    alpha = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(alpha)
    left = int((box.left - box.width * 0.10) * width)
    top = int((box.top - box.height * 0.04) * height)
    right = int((box.left + box.width * 1.10) * width)
    bottom = int((box.top + box.height * 1.06) * height)
    left, top = max(0, left), max(0, top)
    right, bottom = min(width, right), min(height, bottom)

    body_top = top + int((bottom - top) * 0.18)
    neck_w = int((right - left) * 0.34)
    cx = (left + right) // 2
    draw.rounded_rectangle([left, body_top, right, bottom], radius=max(18, (right - left) // 4), fill=226)
    draw.rounded_rectangle([cx - neck_w // 2, top, cx + neck_w // 2, body_top + 20], radius=max(8, neck_w // 4), fill=226)
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=9))
    return alpha.point(lambda p: min(238, int(p * 1.06)))


def make_shadow(box: BottleBox, width: int, height: int) -> Image.Image:
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = int(box.center_x * width)
    y = int((box.top + box.height * 1.02) * height)
    rx = int(box.width * width * 0.42)
    ry = max(12, int(box.height * height * 0.04))
    draw.ellipse([cx - rx, y - ry, cx + rx, y + ry], fill=(40, 33, 25, 56))
    return shadow.filter(ImageFilter.GaussianBlur(radius=12))


def make_kitchen_background(width: int, height: int, light: str, seed: int) -> Image.Image:
    rng = random.Random(seed + hash(light) % 10_000)
    if light == "warm":
        wall = (232, 221, 203)
        counter = (238, 235, 228)
        cabinet = (179, 137, 88)
    elif light == "cool":
        wall = (210, 220, 224)
        counter = (224, 229, 231)
        cabinet = (132, 150, 154)
    else:
        wall = (225, 224, 216)
        counter = (236, 236, 231)
        cabinet = (158, 145, 124)

    image = Image.new("RGB", (width, height), wall)
    draw = ImageDraw.Draw(image)
    horizon = int(height * 0.48)
    draw.rectangle([0, horizon, width, height], fill=counter)

    tile_h = max(44, height // 16)
    tile_w = max(55, width // 9)
    grout = tuple(max(0, c - 18) for c in wall)
    for y in range(0, horizon, tile_h):
        draw.line([(0, y), (width, y)], fill=grout, width=1)
    for x in range(0, width + tile_w, tile_w):
        offset = tile_w // 2 if (x // tile_w) % 2 else 0
        draw.line([(x - offset, 0), (x - offset, horizon)], fill=grout, width=1)

    for i in range(3):
        x0 = int(width * (0.04 + i * 0.31 + rng.uniform(-0.025, 0.025)))
        x1 = x0 + int(width * rng.uniform(0.20, 0.29))
        y0 = int(height * rng.uniform(0.03, 0.11))
        y1 = int(height * rng.uniform(0.23, 0.34))
        draw.rounded_rectangle([x0, y0, x1, y1], radius=6, fill=cabinet)
        draw.rectangle([x0 + 6, y0 + 6, x1 - 6, y1 - 6], outline=tuple(max(0, c - 38) for c in cabinet), width=2)

    window_x = int(width * rng.uniform(0.60, 0.76))
    window_y = int(height * rng.uniform(0.08, 0.16))
    window_w = int(width * 0.18)
    window_h = int(height * 0.12)
    draw.rounded_rectangle([window_x, window_y, window_x + window_w, window_y + window_h], radius=4, fill=(205, 225, 232))
    draw.line([(window_x + window_w // 2, window_y), (window_x + window_w // 2, window_y + window_h)], fill=(150, 165, 168), width=2)
    draw.line([(window_x, window_y + window_h // 2), (window_x + window_w, window_y + window_h // 2)], fill=(150, 165, 168), width=2)

    for i, color in enumerate([(82, 108, 88), (190, 185, 170), (110, 92, 74)]):
        cx = int(width * (0.12 + i * 0.08 + rng.uniform(-0.02, 0.02)))
        cy = int(horizon + height * rng.uniform(0.04, 0.12))
        draw.rounded_rectangle([cx - 16, cy - 26, cx + 16, cy + 26], radius=7, fill=color)

    for _ in range(900):
        x = rng.randrange(width)
        y = rng.randrange(height)
        base = image.getpixel((x, y))
        delta = rng.randrange(-7, 8)
        image.putpixel((x, y), tuple(clamp_int(c + delta) for c in base))

    return image.filter(ImageFilter.GaussianBlur(radius=1.1))


def review_generated(source_path: Path, generated_path: Path, expected_box: BottleBox | None = None) -> dict[str, object]:
    source = cv2.imread(str(source_path))
    generated = cv2.imread(str(generated_path))
    if source is None or generated is None:
        return {"reviewPassed": False, "reviewReason": "image_read_failed"}

    source_box = expected_box or detect_bottle_box(source)
    if source_box is None:
        return {"reviewPassed": False, "reviewReason": "bottle_detection_failed"}

    same_size = source.shape == generated.shape
    target_alignment = score_against_target(source_box)
    color_delta = foreground_color_delta(source, generated, source_box)
    background_delta = background_color_delta(source, generated, source_box)
    generated_box = detect_bottle_box(generated)
    detector_iou = box_iou(source_box, generated_box) if generated_box is not None else 0.0
    detector_aspect_delta = (
        abs(source_box.aspect_h_over_w - generated_box.aspect_h_over_w) if generated_box is not None else 999.0
    )
    passed = same_size and target_alignment >= 0.33 and color_delta <= 38 and background_delta >= 5
    reason = "passed" if passed else "foreground_or_context_delta"
    return {
        "reviewPassed": passed,
        "reviewReason": reason,
        "sameFrameGeometry": same_size,
        "targetAlignmentScore": round(target_alignment, 4),
        "detectorBboxIou": round(detector_iou, 4),
        "detectorAspectDelta": round(detector_aspect_delta, 4),
        "foregroundColorDelta": round(color_delta, 4),
        "backgroundDelta": round(background_delta, 4),
    }


def foreground_color_delta(source: np.ndarray, generated: np.ndarray, box: BottleBox) -> float:
    h, w = source.shape[:2]
    x0 = int(box.left * w)
    y0 = int(box.top * h)
    x1 = int((box.left + box.width) * w)
    y1 = int((box.top + box.height) * h)
    source_crop = source[y0:y1, x0:x1]
    gen_crop = generated[y0:y1, x0:x1]
    if source_crop.size == 0 or gen_crop.size == 0:
        return 999.0
    source_hsv = cv2.cvtColor(source_crop, cv2.COLOR_BGR2HSV)
    mask = (source_hsv[:, :, 1] > 28) & (source_hsv[:, :, 2] > 45)
    if mask.mean() < 0.02:
        mask = np.ones(source_hsv.shape[:2], dtype=bool)
    return float(np.mean(np.abs(source_crop[mask].astype(np.int16) - gen_crop[mask].astype(np.int16))))


def background_color_delta(source: np.ndarray, generated: np.ndarray, box: BottleBox) -> float:
    h, w = source.shape[:2]
    x0 = int(max(0, (box.left - box.width * 0.18) * w))
    y0 = int(max(0, (box.top - box.height * 0.10) * h))
    x1 = int(min(w, (box.left + box.width * 1.18) * w))
    y1 = int(min(h, (box.top + box.height * 1.10) * h))
    mask = np.ones((h, w), dtype=bool)
    mask[y0:y1, x0:x1] = False
    if mask.mean() < 0.10:
        return 0.0
    return float(np.mean(np.abs(source[mask].astype(np.int16) - generated[mask].astype(np.int16))))


def box_iou(a: BottleBox, b: BottleBox) -> float:
    ax1, ay1, ax2, ay2 = a.left, a.top, a.left + a.width, a.top + a.height
    bx1, by1, bx2, by2 = b.left, b.top, b.left + b.width, b.top + b.height
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    union = a.width * a.height + b.width * b.height - inter
    return inter / union if union else 0


def write_review_sheet(items: Iterable[tuple[Path, Path, str, str]], out_path: Path) -> None:
    rows = list(items)
    if not rows:
        return
    thumb_w, thumb_h = 150, 267
    label_h = 32
    cols = 6
    pair_w = thumb_w * 2
    sheet_rows = math.ceil(len(rows) / cols)
    sheet = Image.new("RGB", (cols * pair_w, sheet_rows * (thumb_h + label_h)), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for idx, (source_path, aug_path, volume, variant) in enumerate(rows):
        x = (idx % cols) * pair_w
        y = (idx // cols) * (thumb_h + label_h)
        for offset, path in [(0, source_path), (thumb_w, aug_path)]:
            image = Image.open(path).convert("RGB")
            image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            sheet.paste(image, (x + offset + (thumb_w - image.width) // 2, y))
        draw.text((x + 4, y + thumb_h + 2), f"{volume} {variant}", fill=(0, 0, 0), font=font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=88)


def candidate_record(candidate: Candidate, index: int) -> dict[str, object]:
    return {
        "index": index,
        "path": rel(candidate.path),
        "score": candidate.score,
        "targetScore": candidate.target_score,
        "qualityScore": candidate.quality_score,
        "glareRatio": candidate.glare_ratio,
        "blurScore": candidate.blur_score,
        "exposureScore": candidate.exposure_score,
        "box": {
            "left": round(candidate.box.left, 4),
            "top": round(candidate.box.top, 4),
            "width": round(candidate.box.width, 4),
            "height": round(candidate.box.height, 4),
        },
    }


def frame_number(name: str) -> int | None:
    match = re.search(r"_f(\d+)", name)
    return int(match.group(1)) if match else None


def rel(path: Path) -> str:
    return path.resolve().relative_to(REPO_ROOT).as_posix()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def clamp_int(value: int) -> int:
    return int(max(0, min(255, value)))


if __name__ == "__main__":
    main()
