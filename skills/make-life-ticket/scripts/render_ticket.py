#!/usr/bin/env python3
"""Render a life ticket PNG from a confirmed JSON record.

Requires Pillow. The script never calls a network service. If --image is omitted,
it creates an original procedural symbolic illustration.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
from pathlib import Path
from typing import Any, Iterable

try:
    from PIL import Image, ImageColor, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps
except ImportError as exc:
    raise SystemExit("Pillow is required: python3 -m pip install Pillow") from exc


SHAPES = {
    "intermission-stub": ((1800, 600), "stage-triptych"),
    "film-edge": ((1600, 640), "stage-triptych"),
    "chapter-pass": ((1200, 1500), "chapter-poster"),
}

SHAPES_BY_KIND = {
    "past": ("film-edge", "intermission-stub"),
    "universe": ("chapter-pass", "film-edge", "intermission-stub"),
}

SKILL_ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = SKILL_ROOT / "assets" / "fonts"
TICKET_STOCK_DIR = SKILL_ROOT / "assets" / "ticket-stock"
STATUS_STAMP_DIR = SKILL_ROOT / "assets" / "status-stamps"

STAMP_STYLES = ("floral-slip", "negative-square", "broken-ring")
EVENT_DOODLE_STYLE = "broken-ink-doodle"
EVENT_DOODLE_STATUSES = {"generated", "skipped", "none"}
STAMP_BOUNDS = {
    "stage-triptych": {
        "floral-slip": (82, 220),
        "negative-square": (142, 142),
        "broken-ring": (148, 148),
    },
    "chapter-poster": {
        "floral-slip": (82, 210),
        "negative-square": (142, 142),
        "broken-ring": (148, 148),
    },
}

PALETTES = {
    "warm": {
        "paper": "#F3EEE4",
        "ink": "#2D211C",
        "accent": "#A63D32",
        "accent2": "#D19943",
        "deep": "#5C302A",
        "light": "#F4EAD3",
        "ticketAccent": "#A63D32",
        "ticketAccentLight": "#C97868",
        "ticketAccentDark": "#6F2A25",
    },
    "calm": {
        "paper": "#F2EEE5",
        "ink": "#24302F",
        "accent": "#527A78",
        "accent2": "#B98D59",
        "deep": "#314F50",
        "light": "#F2EBDD",
        "ticketAccent": "#A63D32",
        "ticketAccentLight": "#C97868",
        "ticketAccentDark": "#6F2A25",
    },
    "night": {
        "paper": "#EFECE4",
        "ink": "#222437",
        "accent": "#4D587E",
        "accent2": "#C19A58",
        "deep": "#30344F",
        "light": "#EEE7D8",
        "ticketAccent": "#A63D32",
        "ticketAccentLight": "#C97868",
        "ticketAccentDark": "#6F2A25",
    },
    "garden": {
        "paper": "#F1EBDD",
        "ink": "#283126",
        "accent": "#65764B",
        "accent2": "#C87958",
        "deep": "#3F563C",
        "light": "#F2ECD7",
        "ticketAccent": "#A63D32",
        "ticketAccentLight": "#C97868",
        "ticketAccentDark": "#6F2A25",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a life ticket PNG and normalized JSON.")
    parser.add_argument("--input", required=True, help="Confirmed ticket JSON path")
    parser.add_argument("--output-dir", required=True, help="Directory for PNG and JSON")
    parser.add_argument("--image", help="Optional generated image or user photo")
    parser.add_argument("--doodle", help="Optional generated transparent event-doodle PNG")
    parser.add_argument("--shape", choices=sorted(SHAPES), help="Override shape style")
    parser.add_argument("--stamp-style", choices=STAMP_STYLES, help="Override status-stamp style")
    parser.add_argument("--require-image", action="store_true", help="Fail instead of using procedural art when --image is missing")
    parser.add_argument("--preview-white", help="Optional white-background PNG for material inspection")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Input JSON must contain an object")
    return data


def validate(data: dict[str, Any]) -> None:
    required = ["ticketNumber", "kind", "status", "title", "scene", "time", "place", "createdAt"]
    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    if data["kind"] not in {"past", "universe"}:
        raise ValueError("kind must be past or universe")
    if data["status"] not in {"ended", "ordered"}:
        raise ValueError("status must be ended or ordered")
    if not (4 <= len(str(data["title"]).strip()) <= 12):
        raise ValueError("title must contain 4–12 characters")
    if not isinstance(data["time"], dict) or "mode" not in data["time"]:
        raise ValueError("time must be an object containing mode")


def seed_from(data: dict[str, Any]) -> int:
    digest = hashlib.sha256(str(data["ticketNumber"]).encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def choose_design(
    data: dict[str, Any],
    shape_override: str | None,
    stamp_override: str | None,
) -> tuple[str, str, str]:
    design = data.setdefault("design", {})
    shape = shape_override or design.get("shapeStyle")
    allowed_shapes = SHAPES_BY_KIND[data["kind"]]
    if shape not in SHAPES:
        shape = allowed_shapes[seed_from(data) % len(allowed_shapes)]
    elif shape not in allowed_shapes:
        raise ValueError("chapter-pass is reserved for universe tickets; past tickets only accept film-edge or intermission-stub")
    layout = SHAPES[shape][1]
    design["shapeStyle"] = shape
    design["layoutStyle"] = layout
    stamp_style = stamp_override or design.get("stampStyle")
    if stamp_style is None:
        stamp_style = STAMP_STYLES[(seed_from(data) // 7) % len(STAMP_STYLES)]
    elif stamp_style not in STAMP_STYLES:
        raise ValueError(f"Unknown stampStyle: {stamp_style}")
    design["stampStyle"] = stamp_style
    design["imageStyle"] = "symbolic-card-illustration"
    design["finishStyle"] = "modern-vintage-editorial"
    design["typographyStyle"] = "qiji-source-han"
    return shape, layout, stamp_style


def infer_doodle_keyword(data: dict[str, Any]) -> str | None:
    """Prefer an explicit visual element before falling back to scene or place."""
    for value in data.get("visualElements", []):
        keyword = str(value).strip()
        if keyword:
            return keyword[:24]
    for value in (data.get("scene"), data.get("place")):
        keyword = str(value or "").strip()
        if keyword:
            return keyword[:24]
    return None


def resolve_event_doodle(
    data: dict[str, Any],
    layout: str,
    doodle_path: Path | None,
) -> dict[str, Any] | None:
    """Validate persistent doodle metadata and enforce explicit asset handoff."""
    design = data.setdefault("design", {})
    doodle = design.get("eventDoodle")
    placement = "place-record-side" if layout == "stage-triptych" else "place-side"
    if doodle is None:
        if doodle_path is None:
            return None
        keyword = infer_doodle_keyword(data)
        if not keyword:
            raise ValueError("Cannot generate an event doodle without a visual keyword")
        doodle = {
            "keyword": keyword,
            "style": EVENT_DOODLE_STYLE,
            "placement": placement,
            "status": "generated",
        }
        design["eventDoodle"] = doodle
    if not isinstance(doodle, dict):
        raise ValueError("design.eventDoodle must be an object")
    status = doodle.get("status", "generated")
    if status not in EVENT_DOODLE_STATUSES:
        raise ValueError(f"Unknown eventDoodle status: {status}")
    if doodle.get("style", EVENT_DOODLE_STYLE) != EVENT_DOODLE_STYLE:
        raise ValueError(f"Unknown eventDoodle style: {doodle.get('style')}")
    if status == "generated":
        if not str(doodle.get("keyword", "")).strip():
            raise ValueError("Generated eventDoodle requires a keyword")
        if doodle_path is None:
            raise ValueError("Generated eventDoodle requires --doodle")
        doodle["style"] = EVENT_DOODLE_STYLE
        doodle["placement"] = placement
    elif doodle_path is not None:
        raise ValueError(f"eventDoodle status {status} must not receive --doodle")
    return doodle


def font_candidates(role: str) -> list[str]:
    if role == "display":
        return [
            str(FONT_DIR / "qiji-combo.ttf"),
            str(FONT_DIR / "SourceHanSerifSC-Regular.otf"),
            "/System/Library/Fonts/Supplemental/Songti.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        ]
    if role == "serif":
        return [
            str(FONT_DIR / "qiji-combo.ttf"),
            str(FONT_DIR / "SourceHanSerifSC-Regular.otf"),
            "/System/Library/Fonts/Supplemental/Songti.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "C:/Windows/Fonts/simsun.ttc",
            "C:/Windows/Fonts/msyh.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ]
    return [
        str(FONT_DIR / "SourceHanSerifSC-Regular.otf"),
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ]


def resolve_font(role: str) -> str:
    for candidate in font_candidates(role):
        if Path(candidate).is_file():
            return candidate
    raise RuntimeError("No usable font found. Keep the bundled fonts or install a CJK font.")


def load_font(size: int, serif: bool = True, role: str | None = None) -> ImageFont.FreeTypeFont:
    selected = role or ("serif" if serif else "sans")
    return ImageFont.truetype(resolve_font(selected), size=size)


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text).splitlines() or [""]:
        current = ""
        for char in paragraph:
            trial = current + char
            if current and text_width(draw, trial, font) > width:
                lines.append(current.rstrip())
                current = char.lstrip()
            else:
                current = trial
        lines.append(current.rstrip())
    return [line for line in lines if line] or [""]


def fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    max_size: int,
    min_size: int,
    max_lines: int,
    serif: bool = True,
) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    width = max(1, box[2] - box[0])
    height = max(1, box[3] - box[1])
    for size in range(max_size, min_size - 1, -2):
        font = load_font(size, serif=serif)
        lines = wrap_text(draw, text, font, width)
        line_height = int(size * 1.25)
        if len(lines) <= max_lines and len(lines) * line_height <= height:
            return font, lines, line_height
    font = load_font(min_size, serif=serif)
    lines = wrap_text(draw, text, font, width)[:max_lines]
    return font, lines, int(min_size * 1.25)


def normalize_qiji_punctuation(text: str) -> str:
    """Use punctuation glyphs available in Qiji without changing stored JSON."""
    return str(text).replace("，", "、").replace(",", "、")


def draw_text_box(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    fill: str,
    max_size: int,
    min_size: int,
    max_lines: int,
    serif: bool = True,
    align: str = "left",
    valign: str = "top",
    role: str | None = None,
) -> None:
    if role in {"display", "serif"} or (role is None and serif):
        text = normalize_qiji_punctuation(text)
    if role:
        width = max(1, box[2] - box[0])
        height = max(1, box[3] - box[1])
        for size in range(max_size, min_size - 1, -2):
            font = load_font(size, role=role)
            lines = wrap_text(draw, text, font, width)
            line_height = int(size * 1.25)
            if len(lines) <= max_lines and len(lines) * line_height <= height:
                break
        else:
            font = load_font(min_size, role=role)
            lines = wrap_text(draw, text, font, width)[:max_lines]
            line_height = int(min_size * 1.25)
    else:
        font, lines, line_height = fit_text(draw, text, box, max_size, min_size, max_lines, serif)
    total = len(lines) * line_height
    y = box[1] if valign == "top" else box[1] + max(0, (box[3] - box[1] - total) // 2)
    for line in lines:
        width = text_width(draw, line, font)
        if align == "center":
            x = box[0] + max(0, (box[2] - box[0] - width) // 2)
        elif align == "right":
            x = box[2] - width
        else:
            x = box[0]
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height


def tracked_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, tracking: int) -> int:
    if not text:
        return 0
    return sum(text_width(draw, char, font) for char in text) + tracking * (len(text) - 1)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    tracking: int = 4,
) -> None:
    x, y = position
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += text_width(draw, char, font) + tracking


def choose_palette(data: dict[str, Any]) -> dict[str, str]:
    words = " ".join(map(str, data.get("emotion", []))) + " " + str(data.get("scene", ""))
    if any(word in words for word in ["夜", "星", "月", "神秘", "深邃"]):
        return PALETTES["night"]
    if any(word in words for word in ["安静", "平静", "清澈", "自由", "海"]):
        return PALETTES["calm"]
    if any(word in words for word in ["植物", "森林", "花", "春", "生长"]):
        return PALETTES["garden"]
    return PALETTES["warm"]


def shape_mask(shape: str, size: tuple[int, int]) -> Image.Image:
    width, height = size
    margin = max(24, min(width, height) // 22)
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if shape in {"intermission-stub", "film-edge"}:
        draw.rounded_rectangle((margin, margin, width - margin, height - margin), radius=18, fill=255)
    else:
        cut = 30
        polygon = [
            (margin + cut, margin),
            (width - margin - cut, margin),
            (width - margin, margin + cut),
            (width - margin, height - margin - cut),
            (width - margin - cut, height - margin),
            (margin + cut, height - margin),
            (margin, height - margin - cut),
            (margin, margin + cut),
        ]
        draw.polygon(polygon, fill=255)

    if shape == "intermission-stub":
        x = int(width * 0.79)
        radius = 21
        draw.ellipse((x - radius, margin - radius, x + radius, margin + radius), fill=0)
        draw.ellipse((x - radius, height - margin - radius, x + radius, height - margin + radius), fill=0)
    elif shape == "film-edge":
        radius = 18
        draw.ellipse((margin - radius, height // 2 - radius, margin + radius, height // 2 + radius), fill=0)
        draw.ellipse((width - margin - radius, height // 2 - radius, width - margin + radius, height // 2 + radius), fill=0)
        step = 38
        for x in range(margin + 25, width - margin - 15, step):
            draw.ellipse((x - 7, margin - 7, x + 7, margin + 7), fill=0)
            draw.ellipse((x - 7, height - margin - 7, x + 7, height - margin + 7), fill=0)
    else:
        radius = 23
        draw.ellipse((margin - radius, height // 2 - radius, margin + radius, height // 2 + radius), fill=0)
        draw.ellipse((width - margin - radius, height // 2 - radius, width - margin + radius, height // 2 + radius), fill=0)
    return mask


def add_paper_texture(image: Image.Image, mask: Image.Image, seed: int, strength: int = 18) -> None:
    rng = random.Random(seed)
    width, height = image.size
    noise = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(noise)
    # First layer: broad, low-contrast pulp variation. It reads as paper, not dirt.
    pulp = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pulp_draw = ImageDraw.Draw(pulp)
    for _ in range(max(32, width * height // 30000)):
        x = rng.randrange(-80, width + 80)
        y = rng.randrange(-80, height + 80)
        rx = rng.randrange(36, 105)
        ry = rng.randrange(14, 48)
        shade = (134, 116, 96, rng.randrange(3, 8)) if rng.random() < 0.55 else (255, 252, 244, rng.randrange(4, 10))
        pulp_draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=shade)
    noise.alpha_composite(pulp.filter(ImageFilter.GaussianBlur(18)))

    # Second layer: visible but restrained cotton fibres and tiny pulp flecks.
    draw = ImageDraw.Draw(noise)
    count = max(800, width * height // 1150)
    for _ in range(count):
        x = rng.randrange(width)
        y = rng.randrange(height)
        alpha = rng.randrange(5, max(8, strength))
        color = (81, 67, 56, alpha) if rng.random() < 0.55 else (255, 252, 246, alpha)
        radius = 1
        draw.ellipse((x, y, x + radius, y + radius), fill=color)
    for _ in range(max(220, width * height // 4200)):
        x = rng.randrange(width)
        y = rng.randrange(height)
        length = rng.randrange(8, 26)
        alpha = rng.randrange(9, 20)
        rise = rng.choice((-2, -1, 0, 0, 1, 2))
        fiber = (108, 91, 73, alpha) if rng.random() < 0.62 else (255, 253, 246, alpha)
        draw.line((x, y, min(width - 1, x + length), min(height - 1, y + rise)), fill=fiber, width=1)
    noise.putalpha(Image.composite(noise.getchannel("A"), Image.new("L", image.size, 0), mask))
    image.alpha_composite(noise)


def generated_ticket_stock(shape: str, size: tuple[int, int], fallback: str) -> Image.Image:
    """Use the image-generated cotton-paper master only as material, never as geometry.

    The deterministic mask remains the source of truth for the three ticket shapes.
    This prevents a generative model from moving the stub, perforations, or cut corners.
    """
    path = TICKET_STOCK_DIR / f"{shape}.png"
    if not path.exists():
        return Image.new("RGBA", size, fallback)
    crop_fractions = {
        # Sample the clean central paper only. Generated die-cuts/perforations are
        # deliberately excluded because exact structure is drawn by the template.
        "intermission-stub": (0.08, 0.18, 0.68, 0.82),
        "film-edge": (0.10, 0.18, 0.90, 0.82),
        "chapter-pass": (0.18, 0.10, 0.82, 0.90),
    }
    with Image.open(path) as source:
        source = ImageOps.exif_transpose(source).convert("RGB")
        left, top, right, bottom = crop_fractions[shape]
        width, height = source.size
        material = source.crop((int(width * left), int(height * top), int(width * right), int(height * bottom)))
        material = ImageOps.fit(material, size, method=Image.Resampling.LANCZOS).convert("RGB")
        # Keep the generated fibre structure legible while returning to a clean,
        # premium bone-white stock rather than a visibly rough handmade sheet.
        base = Image.new("RGB", size, fallback)
        return Image.blend(base, material, 0.52).convert("RGBA")


def crop_cover(image: Image.Image, size: tuple[int, int], centering: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("RGB")
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering).convert("RGBA")


def stylize_uploaded(image: Image.Image, size: tuple[int, int], palette: dict[str, str]) -> Image.Image:
    fitted = crop_cover(image, size)
    gray = ImageOps.grayscale(fitted)
    gray = ImageEnhance.Contrast(gray).enhance(1.35)
    toned = ImageOps.colorize(gray, black=palette["deep"], white=palette["light"], mid=palette["accent2"])
    toned = ImageEnhance.Color(toned).enhance(0.82).convert("RGBA")
    edges = gray.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.6))
    edges = ImageOps.invert(edges).point(lambda value: 255 if value > 205 else 0)
    line = Image.new("RGBA", size, palette["ink"])
    line.putalpha(ImageOps.invert(edges).point(lambda value: value // 3))
    toned.alpha_composite(line)
    return toned


def draw_star(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, fill: str, points: int = 8) -> None:
    cx, cy = center
    coords: list[tuple[float, float]] = []
    for index in range(points * 2):
        angle = -math.pi / 2 + index * math.pi / points
        r = radius if index % 2 == 0 else radius * 0.38
        coords.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))
    draw.polygon(coords, fill=fill)


def draw_person(draw: ImageDraw.ImageDraw, x: int, ground: int, scale: float, color: str) -> None:
    head = int(16 * scale)
    draw.ellipse((x - head, ground - int(120 * scale), x + head, ground - int(88 * scale)), fill=color)
    draw.polygon(
        [
            (x, ground - int(88 * scale)),
            (x - int(30 * scale), ground - int(25 * scale)),
            (x + int(30 * scale), ground - int(25 * scale)),
        ],
        fill=color,
    )
    draw.line((x - int(12 * scale), ground - int(25 * scale), x - int(18 * scale), ground), fill=color, width=max(2, int(5 * scale)))
    draw.line((x + int(12 * scale), ground - int(25 * scale), x + int(18 * scale), ground), fill=color, width=max(2, int(5 * scale)))


def scene_words(data: dict[str, Any]) -> str:
    """Combine user-provided scene fields for deterministic scene matching."""
    parts = [str(data.get("scene", "")), str(data.get("place", ""))]
    parts.extend(str(item) for item in data.get("visualElements", []))
    return " ".join(parts).lower()


def is_claw_machine_scene(data: dict[str, Any]) -> bool:
    words = scene_words(data)
    return any(token in words for token in ("娃娃机", "抓娃娃", "夹娃娃", "机械爪", "抓到玩偶"))


def draw_claw_machine_scene(
    draw: ImageDraw.ImageDraw,
    size: tuple[int, int],
    palette: dict[str, str],
) -> None:
    """Draw a generic claw-machine moment without reproducing a branded character."""
    width, height = size
    ink = palette["ink"]
    machine = (int(width * 0.08), int(height * 0.07), int(width * 0.92), int(height * 0.93))
    glass = (int(width * 0.16), int(height * 0.17), int(width * 0.84), int(height * 0.72))
    yellow = "#D9AE35"
    goggle = "#C9CDC6"

    draw.rectangle((0, 0, width, height), fill=palette["light"])
    draw.rounded_rectangle(machine, radius=max(16, width // 28), fill=palette["paper"], outline=ink, width=4)
    draw.rectangle((machine[0] + 12, machine[1] + 14, machine[2] - 12, int(height * 0.15)), fill=palette["accent"])
    draw.rounded_rectangle(glass, radius=10, fill="#E7DFC9", outline=ink, width=4)

    # A restrained set of reflections gives the glass enclosure depth without text.
    draw.line((glass[0] + 24, glass[1] + 18, glass[0] + 90, glass[1] + 96), fill=palette["light"], width=5)
    draw.line((glass[2] - 52, glass[1] + 22, glass[2] - 18, glass[1] + 70), fill=palette["light"], width=3)

    center_x = width // 2
    cord_bottom = int(height * 0.36)
    draw.line((center_x, glass[1] + 10, center_x, cord_bottom), fill=ink, width=4)
    draw.ellipse((center_x - 15, cord_bottom - 15, center_x + 15, cord_bottom + 15), fill=palette["accent"], outline=ink, width=3)
    for angle in (115, 90, 65):
        radians = math.radians(angle)
        start_x = center_x + int(math.cos(radians) * 10)
        start_y = cord_bottom + int(math.sin(radians) * 10)
        end_x = center_x + int(math.cos(radians) * 64)
        end_y = cord_bottom + int(math.sin(radians) * 64)
        draw.line((start_x, start_y, end_x, end_y), fill=ink, width=4)
        draw.line((end_x, end_y, end_x + int(math.cos(radians + 0.55) * 20), end_y + int(math.sin(radians + 0.55) * 20)), fill=ink, width=3)

    # Generic yellow plush with goggles: it conveys the user's moment but carries no logo or brand mark.
    toy_x, toy_y = center_x, int(height * 0.53)
    draw.ellipse((toy_x - 46, toy_y - 52, toy_x + 46, toy_y + 62), fill=yellow, outline=ink, width=4)
    draw.ellipse((toy_x - 42, toy_y - 78, toy_x + 42, toy_y - 2), fill=yellow, outline=ink, width=4)
    for offset in (-19, 19):
        draw.ellipse((toy_x + offset - 18, toy_y - 51, toy_x + offset + 18, toy_y - 15), fill=goggle, outline=ink, width=3)
        draw.ellipse((toy_x + offset - 8, toy_y - 41, toy_x + offset + 8, toy_y - 25), fill=palette["paper"], outline=ink, width=2)
    draw.arc((toy_x - 18, toy_y - 5, toy_x + 18, toy_y + 24), 10, 170, fill=ink, width=3)
    draw.line((toy_x - 42, toy_y + 25, toy_x - 72, toy_y + 2), fill=ink, width=4)
    draw.line((toy_x + 42, toy_y + 25, toy_x + 72, toy_y + 2), fill=ink, width=4)

    # Prize chute and scattered toy silhouettes anchor the event inside the machine.
    chute = (int(width * 0.24), int(height * 0.75), int(width * 0.76), int(height * 0.88))
    draw.rounded_rectangle(chute, radius=12, fill=palette["deep"], outline=ink, width=4)
    draw.rounded_rectangle((chute[0] + 12, chute[1] + 12, chute[2] - 12, chute[3] - 12), radius=8, fill=palette["light"], outline=palette["ticketAccentLight"], width=2)
    for x, radius in ((int(width * 0.25), 19), (int(width * 0.75), 17), (int(width * 0.19), 12)):
        y = int(height * 0.66) + (x % 17)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=palette["accent2"], outline=ink, width=2)

    for x, y in ((int(width * 0.22), int(height * 0.28)), (int(width * 0.78), int(height * 0.34)), (int(width * 0.70), int(height * 0.20))):
        draw_star(draw, (x, y), max(8, width // 40), palette["ticketAccent"], points=6)


def draw_motif(draw: ImageDraw.ImageDraw, keyword: str, x: int, y: int, scale: int, palette: dict[str, str]) -> None:
    word = keyword.lower()
    ink = palette["ink"]
    accent = palette["accent"]
    if any(token in word for token in ["星", "star", "光"]):
        draw_star(draw, (x, y), scale, accent)
    elif any(token in word for token in ["月", "moon", "夜"]):
        draw.ellipse((x - scale, y - scale, x + scale, y + scale), fill=palette["accent2"], outline=ink, width=3)
        draw.ellipse((x - scale // 3, y - scale, x + scale, y + scale), fill=palette["paper"])
    elif any(token in word for token in ["花", "樱", "flower"]):
        for angle in range(0, 360, 72):
            dx = int(math.cos(math.radians(angle)) * scale * 0.55)
            dy = int(math.sin(math.radians(angle)) * scale * 0.55)
            draw.ellipse((x + dx - scale // 2, y + dy - scale // 2, x + dx + scale // 2, y + dy + scale // 2), fill=accent, outline=ink, width=2)
        draw.ellipse((x - scale // 3, y - scale // 3, x + scale // 3, y + scale // 3), fill=palette["accent2"])
    elif any(token in word for token in ["树", "植物", "叶", "forest", "plant"]):
        draw.line((x, y + scale, x, y - scale), fill=ink, width=4)
        for offset in (-scale // 2, 0, scale // 2):
            draw.ellipse((x - scale, y + offset - scale // 2, x, y + offset + scale // 2), outline=ink, fill=palette["accent"], width=2)
            draw.ellipse((x, y + offset - scale // 2, x + scale, y + offset + scale // 2), outline=ink, fill=palette["accent2"], width=2)
    elif any(token in word for token in ["雪", "snow"]):
        for angle in range(0, 180, 60):
            dx = int(math.cos(math.radians(angle)) * scale)
            dy = int(math.sin(math.radians(angle)) * scale)
            draw.line((x - dx, y - dy, x + dx, y + dy), fill=ink, width=3)
    elif any(token in word for token in ["门", "door", "家", "房"]):
        draw.rounded_rectangle((x - scale, y - scale, x + scale, y + scale), radius=scale // 2, outline=ink, width=4, fill=palette["light"])
        draw.ellipse((x + scale // 2, y, x + scale // 2 + 5, y + 5), fill=accent)
    elif any(token in word for token in ["海", "水", "river", "ocean"]):
        for offset in (-scale // 2, 0, scale // 2):
            draw.arc((x - scale, y + offset - scale // 3, x, y + offset + scale // 3), 180, 360, fill=ink, width=3)
            draw.arc((x, y + offset - scale // 3, x + scale, y + offset + scale // 3), 0, 180, fill=ink, width=3)
    elif any(token in word for token in ["书", "book"]):
        draw.polygon([(x, y - scale), (x - scale, y - scale // 2), (x - scale, y + scale), (x, y + scale // 2)], fill=palette["light"], outline=ink)
        draw.polygon([(x, y - scale), (x + scale, y - scale // 2), (x + scale, y + scale), (x, y + scale // 2)], fill=palette["paper"], outline=ink)
    else:
        draw.ellipse((x - scale, y - scale, x + scale, y + scale), outline=ink, width=3)
        draw_star(draw, (x, y), max(5, scale // 2), accent, points=6)


def procedural_art(size: tuple[int, int], data: dict[str, Any], palette: dict[str, str], seed: int) -> Image.Image:
    width, height = size
    rng = random.Random(seed)
    image = Image.new("RGBA", size, palette["light"])
    draw = ImageDraw.Draw(image)

    if is_claw_machine_scene(data):
        draw_claw_machine_scene(draw, size, palette)
        border = max(10, min(width, height) // 30)
        draw.rectangle((border, border, width - border, height - border), outline=palette["ink"], width=max(2, border // 4))
        draw.rectangle((border * 2, border * 2, width - border * 2, height - border * 2), outline=palette["ink"], width=1)
        alpha = Image.new("L", size, 255)
        add_paper_texture(image, alpha, seed + 73, strength=15)
        return image

    horizon = int(height * 0.67)
    draw.rectangle((0, 0, width, horizon), fill=palette["paper"])
    draw.rectangle((0, horizon, width, height), fill=palette["accent2"])
    sun_radius = max(24, min(width, height) // 10)
    sun_x = int(width * (0.25 if seed % 2 else 0.75))
    draw.ellipse((sun_x - sun_radius, int(height * 0.18) - sun_radius, sun_x + sun_radius, int(height * 0.18) + sun_radius), fill=palette["accent"], outline=palette["ink"], width=4)

    hill_y = int(height * 0.58)
    draw.polygon([(0, hill_y), (int(width * 0.28), int(height * 0.36)), (int(width * 0.55), hill_y), (int(width * 0.76), int(height * 0.42)), (width, hill_y), (width, horizon), (0, horizon)], fill=palette["deep"])
    draw.polygon([(0, int(height * 0.63)), (int(width * 0.25), int(height * 0.48)), (int(width * 0.48), int(height * 0.63)), (int(width * 0.72), int(height * 0.50)), (width, int(height * 0.63)), (width, horizon), (0, horizon)], fill=palette["accent"])

    path_top = int(width * 0.49)
    draw.polygon([(path_top - 8, horizon), (path_top + 8, horizon), (int(width * 0.72), height), (int(width * 0.28), height)], fill=palette["light"])
    draw_person(draw, width // 2, int(height * 0.83), max(0.65, min(width, height) / 500), palette["ink"])

    motifs = [str(item) for item in data.get("visualElements", []) if str(item).strip()][:5]
    if not motifs:
        motifs = [str(data.get("place", "门")), str(data.get("time", {}).get("raw", "光"))]
    positions = [
        (int(width * 0.16), int(height * 0.22)),
        (int(width * 0.84), int(height * 0.28)),
        (int(width * 0.18), int(height * 0.78)),
        (int(width * 0.82), int(height * 0.76)),
        (int(width * 0.50), int(height * 0.18)),
    ]
    scale = max(18, min(width, height) // 13)
    for keyword, position in zip(motifs, positions):
        draw_motif(draw, keyword, position[0], position[1], scale, palette)

    border = max(10, min(width, height) // 30)
    draw.rectangle((border, border, width - border, height - border), outline=palette["ink"], width=max(2, border // 4))
    draw.rectangle((border * 2, border * 2, width - border * 2, height - border * 2), outline=palette["ink"], width=1)

    alpha = Image.new("L", size, 255)
    add_paper_texture(image, alpha, seed + 73, strength=15)
    return image


def get_art(
    size: tuple[int, int],
    data: dict[str, Any],
    palette: dict[str, str],
    seed: int,
    image_path: Path | None,
    require_image: bool,
) -> Image.Image:
    if image_path:
        with Image.open(image_path) as source:
            if data.get("image", {}).get("source") == "uploaded":
                return stylize_uploaded(source, size, palette)
            result = crop_cover(source, size)
            overlay = Image.new("RGBA", size, palette["paper"] + "22")
            result.alpha_composite(overlay)
            return result
    if require_image:
        raise ValueError("Missing main image: retry AI generation before allowing procedural art")
    data.setdefault("image", {})["source"] = "procedural"
    data["image"]["referenceUsed"] = False
    return procedural_art(size, data, palette, seed)


def draw_dotted_line(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str, width: int = 2, gap: int = 12) -> None:
    x1, y1 = start
    x2, y2 = end
    length = int(math.hypot(x2 - x1, y2 - y1))
    if length == 0:
        return
    ux = (x2 - x1) / length
    uy = (y2 - y1) / length
    for distance in range(0, length, gap * 2):
        a = (x1 + ux * distance, y1 + uy * distance)
        b_distance = min(length, distance + gap)
        b = (x1 + ux * b_distance, y1 + uy * b_distance)
        draw.line((a, b), fill=fill, width=width)


def created_date(data: dict[str, Any]) -> str:
    return str(data.get("createdAt", ""))[:10].replace("-", ".")


def labels(data: dict[str, Any]) -> tuple[str, str, str]:
    if data["kind"] == "past":
        return "往昔纪念票", "已落幕", "制票日"
    return "宇宙订单票", "已下单", "下单日"


def draw_vertical_text(image: Image.Image, text: str, position: tuple[int, int], max_height: int, fill: str, size: int) -> None:
    font = load_font(size, serif=False)
    temp = Image.new("RGBA", (max_height, size * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(temp)
    draw.text((0, 0), text, font=font, fill=fill)
    bbox = temp.getbbox()
    if not bbox:
        return
    temp = temp.crop(bbox).rotate(90, expand=True)
    if temp.height > max_height:
        ratio = max_height / temp.height
        temp = temp.resize((max(1, int(temp.width * ratio)), max_height), Image.Resampling.LANCZOS)
    image.alpha_composite(temp, position)


def draw_inner_frame(draw: ImageDraw.ImageDraw, size: tuple[int, int], ink: str) -> None:
    width, height = size
    inset = max(42, min(width, height) // 14)
    draw.rounded_rectangle((inset, inset, width - inset, height - inset), radius=12, outline=ink, width=3)
    draw.rounded_rectangle((inset + 10, inset + 10, width - inset - 10, height - inset - 10), radius=8, outline=ink, width=1)


def apply_embossed_frame(image: Image.Image, box: tuple[int, int, int, int], palette: dict[str, str], radius: int = 4) -> None:
    """Add a restrained press-and-shadow edge before its final drawn keyline."""
    width, height = image.size
    stroke = Image.new("L", image.size, 0)
    stroke_draw = ImageDraw.Draw(stroke)
    stroke_draw.rounded_rectangle(box, radius=radius, outline=82, width=2)
    soft = stroke.filter(ImageFilter.GaussianBlur(3))
    shadow = Image.new("RGBA", image.size, (48, 39, 31, 0))
    shadow.putalpha(soft.point(lambda value: int(value * 0.62)))
    image.alpha_composite(shadow, (2, 3))
    highlight = Image.new("RGBA", image.size, (255, 253, 247, 0))
    highlight.putalpha(stroke.point(lambda value: int(value * 0.30)))
    image.alpha_composite(highlight, (-1, -1))


def apply_separator_emboss(image: Image.Image, x: int, top: int, bottom: int) -> None:
    """Keep the tear line visibly pressed into the paper, never card-like."""
    stroke = Image.new("L", image.size, 0)
    ImageDraw.Draw(stroke).line((x, top, x, bottom), fill=72, width=2)
    soft = stroke.filter(ImageFilter.GaussianBlur(3))
    shadow = Image.new("RGBA", image.size, (48, 39, 31, 0))
    shadow.putalpha(soft.point(lambda value: int(value * 0.56)))
    image.alpha_composite(shadow, (2, 2))
    highlight = Image.new("RGBA", image.size, (255, 253, 247, 0))
    highlight.putalpha(stroke.point(lambda value: int(value * 0.26)))
    image.alpha_composite(highlight, (-1, 0))


def micro_label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, size: int = 16) -> None:
    draw_tracked(draw, (x, y), text, load_font(size, role="display"), fill, tracking=max(2, size // 6))


def draw_accent_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    palette: dict[str, str],
    width: int = 4,
) -> None:
    draw.line((start, end), fill=palette["ticketAccentDark"], width=width + 2)
    draw.line((start, end), fill=palette["ticketAccent"], width=width)
    if start[1] == end[1]:
        draw.line(((start[0], start[1] - 1), (end[0], end[1] - 1)), fill=palette["ticketAccentLight"], width=1)
    elif start[0] == end[0]:
        draw.line(((start[0] - 1, start[1]), (end[0] - 1, end[1])), fill=palette["ticketAccentLight"], width=1)


def draw_accent_frame(draw: ImageDraw.ImageDraw, size: tuple[int, int], palette: dict[str, str]) -> None:
    width, height = size
    inset = max(42, min(width, height) // 14)
    draw.rounded_rectangle((inset, inset, width - inset, height - inset), radius=12, outline=palette["ticketAccentDark"], width=2)


def place_status_stamp(
    image: Image.Image,
    center: tuple[int, int],
    layout: str,
    stamp_style: str,
    status: str,
) -> None:
    if stamp_style not in STAMP_STYLES:
        raise ValueError(f"Unknown stampStyle: {stamp_style}")
    if status not in {"ended", "ordered"}:
        raise ValueError(f"Unsupported status for stamp asset: {status}")
    path = STATUS_STAMP_DIR / f"{stamp_style}-{status}.png"
    if not path.is_file():
        raise FileNotFoundError(f"Missing status-stamp asset: {path}")
    with Image.open(path) as source:
        if "A" not in source.getbands():
            raise ValueError(f"Status-stamp asset must have transparency: {path}")
        stamp = source.convert("RGBA")
    if stamp.getchannel("A").getbbox() is None:
        raise ValueError(f"Status-stamp asset is blank: {path}")
    max_width, max_height = STAMP_BOUNDS[layout][stamp_style]
    stamp.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    x = center[0] - stamp.width // 2
    y = center[1] - stamp.height // 2
    image.alpha_composite(stamp, (x, y))


def load_event_doodle(path: Path) -> Image.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Missing event-doodle asset: {path}")
    with Image.open(path) as source:
        if "A" not in source.getbands():
            raise ValueError(f"Event-doodle asset must have transparency: {path}")
        doodle = source.convert("RGBA")
    if doodle.getchannel("A").getbbox() is None:
        raise ValueError(f"Event-doodle asset is blank: {path}")
    return doodle


def place_event_doodle(
    image: Image.Image,
    doodle: Image.Image | None,
    box: tuple[int, int, int, int] | None,
) -> bool:
    """Composite a generated transparent doodle while preserving its safe padding."""
    if doodle is None or box is None:
        return False
    left, top, right, bottom = box
    if right - left < 42 or bottom - top < 42:
        return False
    mark = doodle.copy()
    mark.thumbnail((right - left, bottom - top), Image.Resampling.LANCZOS)
    alpha = mark.getchannel("A").point(lambda value: int(value * 0.84))
    mark.putalpha(alpha)
    x = left + (right - left - mark.width) // 2
    y = top + (bottom - top - mark.height) // 2
    image.alpha_composite(mark, (x, y))
    return True


def editorial_art(art: Image.Image, size: tuple[int, int], palette: dict[str, str], centering: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    fitted = crop_cover(art, size, centering=centering)
    gray = ImageOps.grayscale(fitted)
    toned = ImageOps.colorize(gray, black=palette["deep"], white=palette["light"], mid=palette["accent2"]).convert("RGBA")
    mixed = Image.blend(fitted, toned, 0.14)
    # A warm paper veil and fine grain make the artwork feel printed into the stock,
    # rather than inserted as a glossy image.
    veil = Image.new("RGBA", size, ImageColor.getrgb(palette["paper"]) + (20,))
    mixed.alpha_composite(veil)
    rng = random.Random(size[0] * 4099 + size[1])
    grain = Image.new("RGBA", size, (0, 0, 0, 0))
    grain_draw = ImageDraw.Draw(grain)
    for _ in range(max(280, size[0] * size[1] // 1600)):
        x = rng.randrange(size[0])
        y = rng.randrange(size[1])
        alpha = rng.randrange(3, 11)
        color = (57, 43, 31, alpha) if rng.random() < 0.58 else (248, 237, 211, alpha)
        grain_draw.point((x, y), fill=color)
    mixed.alpha_composite(grain)
    return mixed


def draw_scene_thread(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str) -> None:
    x1, y1 = start
    x2, y2 = end
    points = []
    for index in range(41):
        t = index / 40
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t + math.sin(t * math.pi * 2.2) * (18 * (1 - t))
        points.append((int(x), int(y)))
    draw.line(points, fill=fill, width=2)
    draw.ellipse((x1 - 5, y1 - 5, x1 + 5, y1 + 5), fill=fill)
    draw.ellipse((x2 - 4, y2 - 4, x2 + 4, y2 + 4), fill=fill)


def render_triptych(
    image: Image.Image,
    data: dict[str, Any],
    shape: str,
    palette: dict[str, str],
    art: Image.Image,
    stamp_style: str,
    doodle: Image.Image | None,
) -> bool:
    width, height = image.size
    draw = ImageDraw.Draw(image)
    ink = palette["ink"]
    margin = max(44, height // 12)
    x_left = int(width * 0.345)
    x_art_end = int(width * 0.795)
    ticket_type, _, date_label = labels(data)
    time = data.get("time", {})
    time_hidden = time.get("mode") == "hidden"

    art_box = (x_left + 20, margin + 24, x_art_end - 24, height - margin - 18)
    art_resized = editorial_art(art, (art_box[2] - art_box[0], art_box[3] - art_box[1]), palette, centering=(0.5, 0.42))
    image.alpha_composite(art_resized, (art_box[0], art_box[1]))
    apply_embossed_frame(image, art_box, palette)

    draw = ImageDraw.Draw(image)
    # Layout lock: preserve the original vermilion intermission composition.
    draw.rectangle((art_box[0] + 10, art_box[1] - 10, art_box[2] + 10, art_box[3] - 10), outline=palette["ticketAccentDark"], width=8)
    draw.rectangle((art_box[0] + 13, art_box[1] - 7, art_box[2] + 7, art_box[3] - 13), outline=palette["ticketAccentLight"], width=2)
    draw.rectangle(art_box, outline=ink, width=2)
    draw.rectangle((art_box[0] + 10, art_box[1] + 10, art_box[2] - 10, art_box[3] - 10), outline=palette["light"], width=1)

    # Narrow accent index and editorial masthead.
    draw.rectangle((margin + 10, margin + 10, margin + 22, height - margin - 10), fill=palette["ticketAccent"])
    draw.line((margin + 13, margin + 10, margin + 13, height - margin - 10), fill=palette["ticketAccentLight"], width=2)
    micro_label(draw, margin + 42, margin + 12, "人生票根", palette["ticketAccentDark"], max(19, height // 31))
    type_font = load_font(max(23, height // 25), role="display")
    type_width = text_width(draw, ticket_type, type_font)
    draw.text((x_left - 25 - type_width, margin + 12), ticket_type, font=type_font, fill=ink)
    draw_accent_line(draw, (margin + 42, margin + 62), (x_left - 24, margin + 62), palette, width=2)

    if time_hidden:
        micro_label(draw, margin + 42, int(height * 0.23), "这一幕", palette["ticketAccentDark"], 19)
        draw_text_box(draw, str(data["title"]), (margin + 42, int(height * 0.29), x_left - 30, int(height * 0.60)), ink, max_size=68, min_size=38, max_lines=3, role="display")
    else:
        micro_label(draw, margin + 42, int(height * 0.20), "时间", palette["ticketAccentDark"], 22)
        time_display = str(time.get("display", ""))
        time_role = "sans" if any(char.isdigit() or char.isascii() and char.isalpha() for char in time_display) else "display"
        draw_text_box(draw, time_display, (margin + 42, int(height * 0.26), x_left - 28, int(height * 0.44)), ink, max_size=47, min_size=30, max_lines=2, role=time_role)

    place_y = int(height * 0.48) if not time_hidden else int(height * 0.64)
    doodle_box = (x_left - 175, place_y, x_left - 35, place_y + 140) if doodle is not None else None
    detail_right = (doodle_box[0] - 16) if doodle_box else (x_left - 30)
    micro_label(draw, margin + 42, place_y, "地点", palette["ticketAccentDark"], 21)
    draw_text_box(draw, str(data["place"]), (margin + 42, place_y + 34, detail_right, place_y + 105), ink, max_size=42, min_size=28, max_lines=2, role="display")
    note = data.get("note")
    if note:
        note_y = int(height * 0.66)
        micro_label(draw, margin + 42, note_y, "记录", palette["ticketAccentDark"], 21)
        draw_text_box(draw, str(note), (margin + 42, note_y + 34, detail_right, height - margin - 12), palette["deep"], max_size=34, min_size=23, max_lines=3, role="display")

    if not time_hidden:
        band_y = int(height * 0.67)
        band_x = x_left - 28
        band_h = max(105, height // 5)
        draw.rectangle((band_x, band_y, art_box[2] + 2, band_y + band_h), fill=palette["ticketAccent"])
        draw = ImageDraw.Draw(image)
        micro_label(draw, band_x + 22, band_y + 10, "这一幕", palette["light"], 15)
        draw_text_box(draw, str(data["title"]), (band_x + 22, band_y + 31, art_box[2] - 24, band_y + band_h - 8), palette["light"], max_size=53, min_size=28, max_lines=2, align="right", valign="center", role="display")

    divider_x = int(width * 0.80)
    apply_separator_emboss(image, divider_x, margin + 2, height - margin - 2)
    draw = ImageDraw.Draw(image)
    draw_dotted_line(draw, (divider_x, margin + 2), (divider_x, height - margin - 2), ink, width=1, gap=8)
    rail_center = ((divider_x + width - margin) // 2, int(height * 0.28))
    place_status_stamp(image, rail_center, "stage-triptych", stamp_style, str(data["status"]))
    draw = ImageDraw.Draw(image)
    rail_left = divider_x + 30
    rail_right = width - margin - 24
    date_label_y = int(height * 0.56)
    micro_label(draw, rail_left, date_label_y, date_label, palette["ticketAccentDark"], 19)
    draw.text(
        (rail_left, date_label_y + 38),
        created_date(data),
        font=load_font(max(20, height // 29), role="sans"),
        fill=ink,
    )
    separator_y = int(height * 0.73)
    draw.line((rail_left, separator_y, rail_right, separator_y), fill=palette["ticketAccentLight"], width=1)
    number_label_y = separator_y + 18
    micro_label(draw, rail_left, number_label_y, "票根编号", palette["ticketAccentDark"], 18)
    ticket_number = str(data["ticketNumber"])
    serial_font = load_font(18, role="sans")
    while text_width(draw, ticket_number, serial_font) > rail_right - rail_left and serial_font.size > 12:
        serial_font = load_font(serial_font.size - 1, role="sans")
    draw.text((rail_left, number_label_y + 38), ticket_number, font=serial_font, fill=ink)

    draw_scene_thread(draw, (margin + 48, int(height * 0.46)), (art_box[0] + 44, int(height * 0.40)), palette["ticketAccent"])
    doodle_placed = place_event_doodle(image, doodle, doodle_box)

    if shape == "intermission-stub":
        draw_dotted_line(draw, (int(width * 0.79), margin), (int(width * 0.79), height - margin), ink, width=2, gap=8)
    draw_accent_frame(draw, image.size, palette)
    return doodle_placed


def render_poster(
    image: Image.Image,
    data: dict[str, Any],
    palette: dict[str, str],
    art: Image.Image,
    stamp_style: str,
    doodle: Image.Image | None,
) -> bool:
    width, height = image.size
    draw = ImageDraw.Draw(image)
    ink = palette["ink"]
    margin = 68
    ticket_type, _, date_label = labels(data)
    time = data.get("time", {})
    time_hidden = time.get("mode") == "hidden"

    art_box = (margin + 55, 660, width - margin - 35, 1018)
    art_resized = editorial_art(art, (art_box[2] - art_box[0], art_box[3] - art_box[1]), palette, centering=(0.5, 0.36))
    image.alpha_composite(art_resized, (art_box[0], art_box[1]))
    apply_embossed_frame(image, art_box, palette)

    draw = ImageDraw.Draw(image)
    draw.rectangle((margin + 16, margin + 18, margin + 31, height - margin - 18), fill=palette["ticketAccent"])
    draw.line((margin + 19, margin + 18, margin + 19, height - margin - 18), fill=palette["ticketAccentLight"], width=2)
    header_y = 106
    micro_label(draw, margin + 55, header_y + 12, "人生票根", palette["ticketAccentDark"], 25)
    type_font = load_font(29, role="display")
    type_width = text_width(draw, ticket_type, type_font)
    draw.text((width - margin - type_width - 62, header_y + 15), ticket_type, font=type_font, fill=ink)
    draw_accent_line(draw, (margin + 55, 194), (width - margin - 24, 194), palette, width=2)
    title_label_y = 398
    title_top = 442
    title_right = width - margin - 238
    draw_dotted_line(draw, (margin + 18, 365), (width - margin - 18, 365), ink, width=1, gap=10)
    micro_label(draw, margin + 55, title_label_y, "这一幕", palette["ticketAccentDark"], 21)
    draw_text_box(draw, str(data["title"]), (margin + 55, title_top, title_right, 640), ink, max_size=110, min_size=58, max_lines=3, role="display", valign="center")
    place_status_stamp(image, (width - margin - 116, 532), "chapter-poster", stamp_style, str(data["status"]))
    draw = ImageDraw.Draw(image)

    # Layout lock: retain the original vermilion image frame for chapter tickets.
    draw.rectangle((art_box[0] - 12, art_box[1] + 12, art_box[2] - 12, art_box[3] + 12), outline=palette["ticketAccentDark"], width=8)
    draw.rectangle((art_box[0] - 8, art_box[1] + 16, art_box[2] - 16, art_box[3] + 8), outline=palette["ticketAccentLight"], width=2)
    draw.rectangle(art_box, outline=ink, width=2)
    draw.rectangle((art_box[0] + 11, art_box[1] + 11, art_box[2] - 11, art_box[3] - 11), outline=palette["light"], width=1)

    note = data.get("note")
    note_top = 1035
    info_top = 1160 if note else 1055
    if note:
        micro_label(draw, margin + 55, note_top + 4, "记录", palette["ticketAccentDark"], 21)
        draw_text_box(draw, str(note), (margin + 155, note_top, width - margin - 45, info_top - 15), palette["deep"], max_size=37, min_size=26, max_lines=3, role="display", valign="center")
        draw.line((margin + 55, info_top, width - margin - 35, info_top), fill=ink, width=1)

    info_bottom = height - margin - 25
    mid_x = int(width * 0.43)
    draw.line((margin + 55, info_top, width - margin - 35, info_top), fill=ink, width=3)
    draw.line((margin + 55, info_bottom, width - margin - 35, info_bottom), fill=ink, width=1)
    if not time_hidden:
        draw.line((mid_x, info_top + 18, mid_x, info_bottom - 18), fill=ink, width=1)
        micro_label(draw, margin + 55, info_top + 24, "时间", palette["ticketAccentDark"], 21)
        time_display = str(time.get("display", ""))
        time_role = "sans" if any(char.isdigit() or char.isascii() and char.isalpha() for char in time_display) else "display"
        draw_text_box(draw, time_display, (margin + 55, info_top + 62, mid_x - 25, info_bottom - 30), ink, max_size=59, min_size=38, max_lines=3, role=time_role, valign="center")
        right_x = mid_x + 28
    else:
        right_x = margin + 55

    doodle_box = (width - margin - 200, info_top + 32, width - margin - 45, info_top + 187) if doodle is not None else None
    place_right = (doodle_box[0] - 16) if doodle_box else (width - margin - 45)
    micro_label(draw, right_x, info_top + 24, "地点", palette["ticketAccentDark"], 21)
    draw_text_box(draw, str(data["place"]), (right_x, info_top + 62, place_right, info_top + 135), ink, max_size=47, min_size=32, max_lines=2, role="display")
    date_font = load_font(20, role="sans")
    detail_value_x = right_x + 100
    micro_label(draw, right_x, info_top + 155, date_label, palette["ticketAccentDark"], 21)
    draw_tracked(draw, (detail_value_x, info_top + 151), created_date(data), date_font, ink, tracking=2)
    micro_label(draw, right_x, info_top + 204, "编号", palette["ticketAccentDark"], 21)
    draw_tracked(draw, (detail_value_x, info_top + 197), str(data["ticketNumber"]), load_font(21, role="sans"), ink, tracking=1)

    doodle_placed = place_event_doodle(image, doodle, doodle_box)
    draw_accent_frame(draw, image.size, palette)
    return doodle_placed


def render(
    data: dict[str, Any],
    shape: str,
    stamp_style: str,
    image_path: Path | None,
    require_image: bool,
    doodle: Image.Image | None,
) -> Image.Image:
    size = SHAPES[shape][0]
    palette = choose_palette(data)
    seed = seed_from(data)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = shape_mask(shape, size)
    # The paper body comes from an image-generated blank ticket-stock master.
    # Overlay graphics never modify its geometry or simulate its core texture.
    ticket = generated_ticket_stock(shape, size, palette["paper"])
    ticket.putalpha(mask)

    layout = SHAPES[shape][1]
    if layout == "stage-triptych":
        art_size = (max(480, int(size[0] * 0.44)), max(420, int(size[1] * 0.80)))
    else:
        art_size = (max(720, int(size[0] * 0.86)), 480)
    art = get_art(art_size, data, palette, seed + 11, image_path, require_image)

    if layout == "stage-triptych":
        doodle_placed = render_triptych(ticket, data, shape, palette, art, stamp_style, doodle)
    else:
        doodle_placed = render_poster(ticket, data, palette, art, stamp_style, doodle)
    if doodle is not None and not doodle_placed:
        data["design"]["eventDoodle"]["status"] = "skipped"

    # A low-contrast environmental shadow gives the die-cut stock physical depth
    # against transparency. It is intentionally soft and shallow, never a floating card.
    shadow_mask = mask.filter(ImageFilter.GaussianBlur(5))
    outer_shadow = Image.new("RGBA", size, (46, 38, 30, 0))
    outer_shadow.putalpha(shadow_mask.point(lambda value: int(value * 0.28)))
    canvas.alpha_composite(outer_shadow, (2, 4))
    canvas.alpha_composite(ticket)
    return canvas


def ensure_output_paths(output_dir: Path, ticket_number: str, input_path: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    png_path = output_dir / f"{ticket_number}.png"
    json_path = output_dir / f"{ticket_number}.json"
    if png_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing file: {png_path}")
    if json_path.exists() and json_path.resolve() != input_path.resolve():
        raise FileExistsError(f"Refusing to overwrite existing file: {json_path}")
    return png_path, json_path


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    image_path = Path(args.image).expanduser().resolve() if args.image else None
    doodle_path = Path(args.doodle).expanduser().resolve() if args.doodle else None
    data = read_json(input_path)
    validate(data)
    shape, layout, stamp_style = choose_design(data, args.shape, args.stamp_style)
    resolve_event_doodle(data, layout, doodle_path)
    doodle = load_event_doodle(doodle_path) if doodle_path else None

    png_path, json_path = ensure_output_paths(output_dir, str(data["ticketNumber"]), input_path)
    result = render(data, shape, stamp_style, image_path, args.require_image, doodle)
    result.save(png_path, "PNG", optimize=True)
    if args.preview_white:
        preview_path = Path(args.preview_white).expanduser().resolve()
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        preview = Image.new("RGBA", result.size, "#FFFFFF")
        preview.alpha_composite(result)
        preview.convert("RGB").save(preview_path, "PNG", optimize=True)
    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({"png": str(png_path), "json": str(json_path), "shape": shape, "stampStyle": stamp_style, "size": list(result.size)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"render_ticket.py: {exc}", file=sys.stderr)
        raise SystemExit(1)
