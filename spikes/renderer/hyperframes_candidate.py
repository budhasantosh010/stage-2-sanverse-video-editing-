from __future__ import annotations

import html
from pathlib import Path

from spikes.renderer.contract import RendererRequest


def _number(value: int | float) -> str:
    return format(value, ".15g")


def _percent(value: float) -> str:
    return f"{_number(value * 100)}%"


def _validated_local_filename(video_filename: str) -> str:
    if (
        not isinstance(video_filename, str)
        or not video_filename
        or video_filename in {".", ".."}
        or "/" in video_filename
        or chr(92) in video_filename
        or ":" in video_filename
        or "\0" in video_filename
    ):
        raise ValueError("video source must be one local filename")
    return video_filename


def build_composition(
    request: RendererRequest,
    *,
    video_filename: str = "source.mp4",
) -> str:
    """Translate the disposable renderer-spike request into local HyperFrames HTML."""

    source = html.escape(_validated_local_filename(video_filename), quote=True)
    overlay = request.overlay
    bounds = overlay.bounds
    duration = _number(request.source.duration_seconds)
    overlay_start = _number(overlay.start_seconds)
    overlay_duration = _number(overlay.end_seconds - overlay.start_seconds)
    primary_text = html.escape(overlay.primary_text)
    secondary_text = html.escape(overlay.secondary_text)

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width={request.canvas.width}, height={request.canvas.height}">
    <style>
      * {{ box-sizing: border-box; }}
      html, body {{
        margin: 0;
        width: {request.canvas.width}px;
        height: {request.canvas.height}px;
        overflow: hidden;
        background: #000;
      }}
      #root {{ position: relative; width: 100%; height: 100%; }}
      #a-roll {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      #nameplate {{
        position: absolute;
        left: {_percent(bounds.x)};
        top: {_percent(bounds.y)};
        width: {_percent(bounds.width)};
        height: {_percent(bounds.height)};
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 2.4%;
        color: #111;
        background: rgba(255, 255, 255, 0.94);
        border-left: 6px solid #111;
        font-family: Arial, sans-serif;
      }}
      #nameplate-primary {{ font-size: 30px; font-weight: 700; line-height: 1.05; }}
      #nameplate-secondary {{ margin-top: 8px; font-size: 18px; line-height: 1.1; }}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="{duration}"
      data-width="{request.canvas.width}"
      data-height="{request.canvas.height}"
    >
      <video id="a-roll" class="clip"
        src="{source}"
        muted
        playsinline
        data-start="0"
        data-duration="{duration}"
        data-track-index="0"
      ></video>
      <audio id="a-roll-audio"
        src="{source}"
        data-start="0"
        data-duration="{duration}"
        data-track-index="2"
        data-volume="1"
      ></audio>
      <div
        id="nameplate" class="clip"
        data-start="{overlay_start}"
        data-duration="{overlay_duration}"
        data-track-index="1"
      >
        <div id="nameplate-primary">{primary_text}</div>
        <div id="nameplate-secondary">{secondary_text}</div>
      </div>
    </div>
  </body>
</html>
"""


def write_composition(
    request: RendererRequest,
    project_dir: str | Path,
    *,
    video_filename: str = "source.mp4",
) -> Path:
    """Write a deterministic local composition without staging or mutating media."""

    directory = Path(project_dir)
    directory.mkdir(parents=True, exist_ok=True)
    output_path = directory / "index.html"
    output_path.write_bytes(
        build_composition(request, video_filename=video_filename).encode("utf-8")
    )
    return output_path