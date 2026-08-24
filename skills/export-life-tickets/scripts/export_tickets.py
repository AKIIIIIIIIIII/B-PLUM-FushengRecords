#!/usr/bin/env python3
"""Export static album tickets as paired PNG/JSON files in a ZIP archive."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出《浮生录》中的静态票根")
    parser.add_argument("album", help="藏本目录")
    parser.add_argument("--output", help="输出 ZIP 路径")
    return parser.parse_args()


def reconstructed_json(ticket: dict) -> dict:
    kind = ticket.get("kind", "past")
    date = ticket.get("date") or ("宇宙时区" if kind == "universe" else "日期未详")
    if kind == "universe":
        mode = "cosmic" if date == "宇宙时区" else "custom"
    else:
        mode = "unknown"
    data = {
        "schemaVersion": 1,
        "ticketNumber": ticket["ticketNumber"],
        "kind": kind,
        "status": "ordered" if kind == "universe" else "ended",
        "title": ticket.get("title") or "未题票根",
        "scene": ticket.get("title") or "未题票根",
        "time": {"mode": mode, "raw": date, "display": date},
        "place": ticket.get("place") or "地点未题",
        "createdAt": ticket.get("createdAt") or datetime.now().astimezone().isoformat(),
        "export": {"reconstructed": True},
    }
    if ticket.get("note"):
        data["note"] = ticket["note"]
    return data


def main() -> None:
    args = parse_args()
    album = Path(args.album).expanduser().resolve()
    manifest_path = album / "public" / "album-manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"找不到藏本清单：{manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    tickets = manifest.get("tickets") or []
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output = Path(args.output).expanduser().resolve() if args.output else album.parent / f"{album.name}-tickets-{timestamp}.zip"
    output.parent.mkdir(parents=True, exist_ok=True)

    exported = []
    missing_images = []
    reconstructed = 0
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for ticket in tickets:
            number = ticket.get("ticketNumber")
            kind = ticket.get("kind")
            if not number or kind not in {"past", "universe"}:
                continue
            folder = "past" if kind == "past" else "future"
            image_rel = str(ticket.get("imageUrl") or f"/tickets/{number}.png").lstrip("/")
            image_path = album / "public" / image_rel
            data_rel = str(ticket.get("dataUrl") or f"/tickets/{number}.json").lstrip("/")
            data_path = album / "public" / data_rel

            image_status = "original" if image_path.is_file() else "missing"
            if image_path.is_file():
                archive.write(image_path, f"{folder}/{number}.png")
            else:
                missing_images.append(number)

            if data_path.is_file():
                json_bytes = data_path.read_bytes()
                json_status = "original"
            else:
                json_bytes = (json.dumps(reconstructed_json(ticket), ensure_ascii=False, indent=2) + "\n").encode("utf-8")
                json_status = "reconstructed"
                reconstructed += 1
            archive.writestr(f"{folder}/{number}.json", json_bytes)
            exported.append({"ticketNumber": number, "kind": kind, "json": json_status, "image": image_status})

        export_manifest = {
            "schemaVersion": 1,
            "albumTitle": manifest.get("title", "浮生录"),
            "exportedAt": datetime.now().astimezone().isoformat(),
            "tickets": exported,
        }
        archive.writestr("export-manifest.json", json.dumps(export_manifest, ensure_ascii=False, indent=2) + "\n")

    print(json.dumps({
        "output": str(output),
        "exported": len(exported),
        "reconstructed": reconstructed,
        "missingImages": missing_images,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
