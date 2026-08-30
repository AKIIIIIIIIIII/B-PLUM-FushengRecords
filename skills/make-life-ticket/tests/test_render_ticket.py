from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SKILL_ROOT = Path(__file__).resolve().parents[1]
RENDERER_PATH = SKILL_ROOT / "scripts" / "render_ticket.py"
SPEC = importlib.util.spec_from_file_location("fusheng_render_ticket", RENDERER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load renderer: {RENDERER_PATH}")
renderer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(renderer)


def ticket_data(shape: str) -> dict:
    return {
        "schemaVersion": 1,
        "ticketNumber": f"LT-U-20260830-{shape[:4].upper()}",
        "kind": "universe",
        "status": "ordered",
        "title": "分享被看见",
        "scene": "在房间里上传skill并被看见",
        "time": {"mode": "custom", "display": "一小时后"},
        "place": "房间内",
        "note": "我上传skill到小红书123。",
        "createdAt": "2026-08-30T20:13:01+09:00",
        "visualElements": ["上传", "闪光"],
        "image": {
            "source": "generated",
            "referenceUsed": True,
            "prompt": "无文字参考图插画",
        },
        "design": {
            "shapeStyle": shape,
            "stampStyle": "negative-square",
            "eventDoodle": {"status": "none"},
        },
    }


class FontRoutingTests(unittest.TestCase):
    def test_mixed_text_uses_qiji_and_source_han_runs(self) -> None:
        self.assertEqual(
            renderer.split_font_runs("我上传skill到小红书123。", "display"),
            [
                ("我上传", "display"),
                ("skill", "sans"),
                ("到小红书", "display"),
                ("123", "sans"),
                ("。", "display"),
            ],
        )

    def test_mixed_measure_wrap_and_draw_share_font_routing(self) -> None:
        image = Image.new("RGBA", (720, 260), "white")
        draw = ImageDraw.Draw(image)
        text = "中文，English 123。第二行skill。"
        normalized = renderer.normalize_qiji_punctuation(text)
        lines = renderer.wrap_mixed_text(draw, normalized, 42, "display", 360)
        self.assertGreaterEqual(len(lines), 2)
        renderer.draw_text_box(
            draw,
            text,
            (20, 20, 390, 240),
            "#2D211C",
            max_size=42,
            min_size=30,
            max_lines=4,
            role="display",
        )
        self.assertIsNotNone(image.getbbox())

    def test_source_han_ascii_is_scaled_to_qiji_visual_size(self) -> None:
        self.assertEqual(renderer.mixed_run_font_size(40, "display", "display"), 40)
        self.assertEqual(renderer.mixed_run_font_size(40, "display", "sans"), 28)


class TicketContractTests(unittest.TestCase):
    def test_note_is_accepted(self) -> None:
        renderer.validate(ticket_data("film-edge"))

    def test_record_is_rejected_without_aliasing(self) -> None:
        data = ticket_data("film-edge")
        data["record"] = data.pop("note")
        with self.assertRaisesRegex(ValueError, "Unknown field: record"):
            renderer.validate(data)


class RenderLayoutTests(unittest.TestCase):
    def test_all_shapes_render_mixed_note_and_full_label(self) -> None:
        expected_sizes = {
            "intermission-stub": (1800, 600),
            "film-edge": (1600, 640),
            "chapter-pass": (1200, 1500),
        }
        with tempfile.TemporaryDirectory() as directory:
            art_path = Path(directory) / "prepared-reference-art.png"
            art = Image.new("RGB", (1500, 1000), "#D7C6A7")
            art_draw = ImageDraw.Draw(art)
            art_draw.ellipse((400, 180, 1100, 880), fill="#627C76")
            art.save(art_path)

            labels: list[str] = []
            original_micro_label = renderer.micro_label

            def capture_label(draw, x, y, text, fill, size):
                labels.append(text)
                return original_micro_label(draw, x, y, text, fill, size)

            renderer.micro_label = capture_label
            try:
                for shape, expected_size in expected_sizes.items():
                    data = ticket_data(shape)
                    result = renderer.render(
                        data,
                        shape,
                        "negative-square",
                        art_path,
                        True,
                        None,
                    )
                    self.assertEqual(result.size, expected_size)
                    self.assertEqual(result.mode, "RGBA")
                    self.assertIsNotNone(result.getchannel("A").getbbox())
            finally:
                renderer.micro_label = original_micro_label

            self.assertEqual(labels.count("一句话记录"), 3)


if __name__ == "__main__":
    unittest.main()
