from __future__ import annotations

import hashlib
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from spikes.renderer.contract import RendererRequest, load_request


def build_synthetic_source_command(
    request: RendererRequest,
    output_path: str | Path,
) -> list[str]:
    source = (
        "color="
        f"c=0xd8d8d3:s={request.canvas.width}x{request.canvas.height}:"
        f"r={request.canvas.fps}:d={request.source.duration_seconds:.3f}"
    )
    filters = ",".join(
        [
            "drawbox=x=0:y=0:w=iw:h=120:color=0xc9c9c4:t=fill",
            "drawbox=x=0:y=640:w=iw:h=80:color=0xbcbcb6:t=fill",
            "drawbox=x=560:y=190:w=160:h=170:color=0xa1a19a:t=fill",
            "drawbox=x=470:y=360:w=340:h=360:color=0x8a8a84:t=fill",
            "drawbox=x=70:y=70:w=260:h=16:color=0xb0b0aa:t=fill",
            "drawbox=x=70:y=96:w=170:h=10:color=0xb8b8b2:t=fill",
        ]
    )
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        source,
        "-filter_complex",
        filters,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(output_path),
    ]

def _pixel_bounds(request: RendererRequest) -> tuple[int, int, int, int]:
    bounds = request.overlay.bounds
    return (
        round(bounds.x * request.canvas.width),
        round(bounds.y * request.canvas.height),
        round(bounds.width * request.canvas.width),
        round(bounds.height * request.canvas.height),
    )


def _escape_filter_value(value: str) -> str:
    escaped = value
    for character in ("\\", "'", ":", ",", ";", "[", "]"):
        escaped = escaped.replace(character, f"\\{character}")
    return escaped


def _escape_filter_path(path: str | Path) -> str:
    escaped = Path(path).as_posix()
    backslash = chr(92)
    for character in (backslash, ":", ",", ";", "[", "]"):
        escaped = escaped.replace(character, backslash + character)
    escaped_quote = "'" + (backslash * 3) + "''"
    return escaped.replace("'", escaped_quote)

def _escape_drawtext_text(value: str) -> str:
    return _escape_filter_value(value)


def build_nameplate_command(
    request: RendererRequest,
    input_path: str | Path,
    output_path: str | Path,
    font_path: str | Path,
) -> list[str]:
    x, y, width, height = _pixel_bounds(request)
    enable = (
        f"gte(t\\,{request.overlay.start_seconds:.3f})"
        f"*lt(t\\,{request.overlay.end_seconds:.3f})"
    )
    font = _escape_filter_path(font_path)
    primary = _escape_drawtext_text(request.overlay.primary_text)
    secondary = _escape_drawtext_text(request.overlay.secondary_text)
    filter_graph = ",".join(
        [
            (
                f"drawbox=x={x}:y={y}:w={width}:h={height}:"
                f"color=0xffffff@0.96:t=fill:enable='{enable}'"
            ),
            (
                f"drawtext=fontfile='{font}':text='{primary}':"
                f"fontcolor=0x111111:fontsize=44:expansion=none:x={x + 24}:y={y + 16}:"
                f"enable='{enable}'"
            ),
            (
                f"drawtext=fontfile='{font}':text='{secondary}':"
                f"fontcolor=0x555555:fontsize=24:expansion=none:x={x + 24}:y={y + 70}:"
                f"enable='{enable}'"
            ),
        ]
    )
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        filter_graph,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(output_path),
    ]

@dataclass(frozen=True)
class NativeRenderResult:
    source_path: Path
    output_path: Path
    source_seconds: float
    render_seconds: float
    output_sha256: str


def _run_timed(command: list[str]) -> float:
    started = time.perf_counter()
    subprocess.run(command, check=True, capture_output=True, text=True)
    return time.perf_counter() - started


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render_static_fixture(
    request_path: str | Path,
    work_dir: str | Path,
    font_path: str | Path,
) -> NativeRenderResult:
    request = load_request(request_path)
    work = Path(work_dir)
    work.mkdir(parents=True, exist_ok=True)
    source_path = work / "synthetic-source.mp4"
    output_path = work / "ffmpeg-native-static-nameplate.mp4"

    source_seconds = _run_timed(
        build_synthetic_source_command(request, source_path)
    )
    render_seconds = _run_timed(
        build_nameplate_command(request, source_path, output_path, font_path)
    )
    return NativeRenderResult(
        source_path=source_path,
        output_path=output_path,
        source_seconds=source_seconds,
        render_seconds=render_seconds,
        output_sha256=_sha256(output_path),
    )
