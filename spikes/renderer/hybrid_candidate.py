from __future__ import annotations

import html
import os
import re
import shutil
import subprocess
import time
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


@dataclass(frozen=True)
class StructuralFidelity:
    """Parsed structural correspondence; this is not pixel fidelity."""

    preview_text: tuple[str, str]
    export_text: tuple[str, str]
    preview_time_window: tuple[float, float]
    export_time_window: tuple[float, float]
    preview_bounds: tuple[float, float, float, float]
    export_bounds: tuple[float, float, float, float]
    maximum_normalized_bound_delta: float
    equivalent: bool


@dataclass(frozen=True)
class LocalDeploymentMeasurement:
    """Facts measured from project files and already-installed runtimes."""

    hybrid_adapter_bytes: int
    browser_adapter_bytes: int
    ffmpeg_adapter_bytes: int
    generated_preview_bytes: int
    browser_executable_path: Path | None
    browser_executable_bytes: int | None
    ffmpeg_executable_path: Path
    ffmpeg_executable_bytes: int
    ffmpeg_version: str
    ffmpeg_startup_seconds: tuple[float, float, float]
    node_executable_path: Path | None
    node_executable_bytes: int | None
    node_version: str | None
    hyperframes_runtime_executed: bool
    hyperframes_archive_bytes: int | None


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


def _required_match(pattern: str, value: str, label: str) -> re.Match[str]:
    match = re.search(pattern, value, flags=re.DOTALL)
    if match is None:
        raise ValueError(f"could not inspect {label}")
    return match


def inspect_structural_fidelity(
    request: RendererRequest,
    plan: HybridPlan,
) -> StructuralFidelity:
    """Parse both translations and compare text, timing, and normalized bounds."""

    document = plan.preview_document
    filter_graph = plan.export_command[plan.export_command.index("-vf") + 1]

    preview_bounds_match = _required_match(
        r"#nameplate\s*\{.*?left:\s*([0-9.]+)%;.*?top:\s*([0-9.]+)%;"
        r".*?width:\s*([0-9.]+)%;.*?height:\s*([0-9.]+)%;",
        document,
        "preview bounds",
    )
    preview_bounds = tuple(
        float(value) / 100 for value in preview_bounds_match.groups()
    )
    preview_timing_match = _required_match(
        r'id="nameplate"\s+class="clip"\s+data-start="([0-9.]+)"'
        r'\s+data-duration="([0-9.]+)"',
        document,
        "preview timing",
    )
    preview_start = float(preview_timing_match.group(1))
    preview_end = preview_start + float(preview_timing_match.group(2))
    primary_match = _required_match(
        r'<div id="nameplate-primary">(.*?)</div>',
        document,
        "preview primary text",
    )
    secondary_match = _required_match(
        r'<div id="nameplate-secondary">(.*?)</div>',
        document,
        "preview secondary text",
    )
    preview_text = (
        html.unescape(primary_match.group(1)),
        html.unescape(secondary_match.group(1)),
    )

    export_bounds_match = _required_match(
        r"drawbox=x=([0-9]+):y=([0-9]+):w=([0-9]+):h=([0-9]+)",
        filter_graph,
        "export bounds",
    )
    x, y, width, height = (
        int(value) for value in export_bounds_match.groups()
    )
    export_bounds = (
        x / request.canvas.width,
        y / request.canvas.height,
        width / request.canvas.width,
        height / request.canvas.height,
    )
    export_timing_match = _required_match(
        r"gte\(t\\,([0-9.]+)\)\*lt\(t\\,([0-9.]+)\)",
        filter_graph,
        "export timing",
    )
    export_time_window = (
        float(export_timing_match.group(1)),
        float(export_timing_match.group(2)),
    )
    export_text_matches = re.findall(
        r"drawtext=[^,]*?text='([^']*)'",
        filter_graph,
    )
    if len(export_text_matches) != 2:
        raise ValueError("could not inspect export text")
    export_text = (export_text_matches[0], export_text_matches[1])

    requested_bounds = (
        request.overlay.bounds.x,
        request.overlay.bounds.y,
        request.overlay.bounds.width,
        request.overlay.bounds.height,
    )
    maximum_delta = max(
        abs(preview - exported)
        for preview, exported in zip(preview_bounds, export_bounds, strict=True)
    )
    pixel_rounding_tolerance = max(
        0.5 / request.canvas.width,
        0.5 / request.canvas.height,
    )
    requested_text = (
        request.overlay.primary_text,
        request.overlay.secondary_text,
    )
    requested_time = (
        request.overlay.start_seconds,
        request.overlay.end_seconds,
    )
    equivalent = (
        preview_text == requested_text
        and export_text == requested_text
        and (preview_start, preview_end) == requested_time
        and export_time_window == requested_time
        and preview_bounds == requested_bounds
        and maximum_delta <= pixel_rounding_tolerance
    )
    return StructuralFidelity(
        preview_text=preview_text,
        export_text=export_text,
        preview_time_window=(preview_start, preview_end),
        export_time_window=export_time_window,
        preview_bounds=preview_bounds,
        export_bounds=export_bounds,
        maximum_normalized_bound_delta=maximum_delta,
        equivalent=equivalent,
    )


def _known_browser_path() -> Path | None:
    executable = next(
        (
            shutil.which(name)
            for name in ("chrome", "msedge", "chromium")
            if shutil.which(name) is not None
        ),
        None,
    )
    candidates = [Path(executable)] if executable is not None else []
    for variable, suffix in (
        ("PROGRAMFILES", "Google/Chrome/Application/chrome.exe"),
        ("PROGRAMFILES(X86)", "Microsoft/Edge/Application/msedge.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
    ):
        root = os.environ.get(variable)
        if root:
            candidates.append(Path(root) / suffix)
    return next((path.resolve() for path in candidates if path.is_file()), None)


def measure_local_deployment(
    request: RendererRequest,
) -> LocalDeploymentMeasurement:
    """Measure local files/runtimes without installing or running HyperFrames."""

    ffmpeg_value = shutil.which("ffmpeg")
    if ffmpeg_value is None:
        raise RuntimeError("ffmpeg is required for the local measurement")
    ffmpeg_path = Path(ffmpeg_value).resolve()
    startup_seconds: list[float] = []
    version = ""
    for _ in range(3):
        started = time.perf_counter()
        completed = subprocess.run(
            [str(ffmpeg_path), "-version"],
            check=True,
            capture_output=True,
            text=True,
        )
        startup_seconds.append(time.perf_counter() - started)
        version = completed.stdout.splitlines()[0]

    node_value = shutil.which("node")
    node_path = Path(node_value).resolve() if node_value is not None else None
    node_version = None
    if node_path is not None:
        completed = subprocess.run(
            [str(node_path), "--version"],
            check=True,
            capture_output=True,
            text=True,
        )
        node_version = completed.stdout.strip()

    browser_path = _known_browser_path()
    browser_adapter_path = Path(build_composition.__code__.co_filename)
    ffmpeg_adapter_path = Path(build_nameplate_command.__code__.co_filename)
    preview = build_composition(request).encode("utf-8")
    return LocalDeploymentMeasurement(
        hybrid_adapter_bytes=Path(__file__).stat().st_size,
        browser_adapter_bytes=browser_adapter_path.stat().st_size,
        ffmpeg_adapter_bytes=ffmpeg_adapter_path.stat().st_size,
        generated_preview_bytes=len(preview),
        browser_executable_path=browser_path,
        browser_executable_bytes=(
            browser_path.stat().st_size if browser_path is not None else None
        ),
        ffmpeg_executable_path=ffmpeg_path,
        ffmpeg_executable_bytes=ffmpeg_path.stat().st_size,
        ffmpeg_version=version,
        ffmpeg_startup_seconds=(
            startup_seconds[0],
            startup_seconds[1],
            startup_seconds[2],
        ),
        node_executable_path=node_path,
        node_executable_bytes=(
            node_path.stat().st_size if node_path is not None else None
        ),
        node_version=node_version,
        hyperframes_runtime_executed=False,
        hyperframes_archive_bytes=None,
    )
