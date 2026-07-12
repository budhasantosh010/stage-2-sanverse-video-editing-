from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from spikes.renderer.contract import load_request
from spikes.renderer.ffmpeg_native import render_static_fixture


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the isolated FFmpeg-native renderer spike."
    )
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--font", required=True, type=Path)
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("--repeat must be at least 1")
    return args


def _ffmpeg_version() -> str:
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-version"],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.splitlines()[0]


def main() -> int:
    args = _parse_args()
    request = load_request(args.request)
    results = [
        render_static_fixture(args.request, args.work_dir, args.font)
        for _ in range(args.repeat)
    ]
    result = results[-1]
    source_seconds_runs = [item.source_seconds for item in results]
    render_seconds_runs = [item.render_seconds for item in results]
    output_sha256_runs = [item.output_sha256 for item in results]
    report_path = args.work_dir / "ffmpeg-native-report.json"
    report = {
        "candidate": "ffmpeg-native",
        "fixture_id": request.fixture_id,
        "schema_version": request.schema_version,
        "canvas": {
            "width": request.canvas.width,
            "height": request.canvas.height,
            "fps": request.canvas.fps,
        },
        "repeat_runs": args.repeat,
        "deterministic": (
            args.repeat >= 2 and len(set(output_sha256_runs)) == 1
        ),
        "source_seconds": sum(source_seconds_runs) / len(source_seconds_runs),
        "source_seconds_runs": source_seconds_runs,
        "render_seconds": sum(render_seconds_runs) / len(render_seconds_runs),
        "render_seconds_runs": render_seconds_runs,
        "output_path": str(result.output_path.resolve()),
        "output_bytes": result.output_path.stat().st_size,
        "output_sha256": result.output_sha256,
        "output_sha256_runs": output_sha256_runs,
        "ffmpeg_version": _ffmpeg_version(),
    }
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(report_path.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
