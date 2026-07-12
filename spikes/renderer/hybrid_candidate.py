from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from spikes.renderer.contract import RendererRequest
from spikes.renderer.ffmpeg_native import build_nameplate_command
from spikes.renderer.hyperframes_candidate import build_composition, write_composition


@dataclass(frozen=True)
class HybridPlan:
    """One renderer-neutral request mapped to preview and export adapters."""

    preview_document: str
    export_command: list[str]


def build_export_command(
    request: RendererRequest,
    input_path: str | Path,
    output_path: str | Path,
    font_path: str | Path,
) -> list[str]:
    """Return safe FFmpeg arguments; execution remains the caller's decision."""

    return build_nameplate_command(request, input_path, output_path, font_path)


def write_preview_document(
    request: RendererRequest,
    project_dir: str | Path,
    *,
    video_filename: str = "source.mp4",
) -> Path:
    """Write a deterministic browser preview without copying source media."""

    return write_composition(
        request,
        project_dir,
        video_filename=video_filename,
    )


def build_hybrid_plan(
    request: RendererRequest,
    input_path: str | Path,
    output_path: str | Path,
    font_path: str | Path,
    *,
    video_filename: str = "source.mp4",
) -> HybridPlan:
    """Build preview markup and export arguments from the same validated request."""

    return HybridPlan(
        preview_document=build_composition(
            request,
            video_filename=video_filename,
        ),
        export_command=build_export_command(
            request,
            input_path=input_path,
            output_path=output_path,
            font_path=font_path,
        ),
    )
