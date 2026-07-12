from __future__ import annotations

import importlib
import json
import shutil
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

from spikes.renderer.contract import load_request


FIXTURE = Path(__file__).parents[1] / "fixtures" / "static-nameplate-v1.json"


def test_builds_synthetic_source_command_from_contract() -> None:
    ffmpeg_native = importlib.import_module("spikes.renderer.ffmpeg_native")
    request = load_request(FIXTURE)
    output = Path("work") / "synthetic-source.mp4"

    command = ffmpeg_native.build_synthetic_source_command(request, output)

    assert command[0] == "ffmpeg"
    assert command[-1] == str(output)
    assert "color=c=0xd8d8d3:s=1280x720:r=30:d=5.000" in command
    assert "-filter_complex" in command
    assert "libx264" in command
    assert "yuv420p" in command

def test_builds_static_nameplate_command_from_normalized_contract() -> None:
    ffmpeg_native = importlib.import_module("spikes.renderer.ffmpeg_native")
    request = load_request(FIXTURE)
    input_path = Path("work") / "synthetic-source.mp4"
    output_path = Path("work") / "ffmpeg-native-static-nameplate.mp4"
    font_path = Path("C:/Windows/Fonts/arial.ttf")

    command = ffmpeg_native.build_nameplate_command(
        request,
        input_path,
        output_path,
        font_path,
    )

    filter_graph = command[command.index("-vf") + 1]
    assert command[command.index("-i") + 1] == str(input_path)
    assert command[-1] == str(output_path)
    assert "drawbox=x=819:y=490:w=358:h=115" in filter_graph
    assert "gte(t\\,1.000)*lt(t\\,4.000)" in filter_graph
    assert "between(" not in filter_graph
    assert "text='Santosh'" in filter_graph
    assert "text='Founder'" in filter_graph

def test_renders_and_probes_static_nameplate_with_real_ffmpeg(tmp_path: Path) -> None:
    ffmpeg_native = importlib.import_module("spikes.renderer.ffmpeg_native")

    result = ffmpeg_native.render_static_fixture(
        FIXTURE,
        tmp_path,
        Path("C:/Windows/Fonts/arial.ttf"),
    )

    assert result.source_path.exists()
    assert result.output_path.exists()
    assert result.source_seconds > 0
    assert result.render_seconds > 0
    assert len(result.output_sha256) == 64

    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=width,height,r_frame_rate:format=duration",
            "-of",
            "json",
            str(result.output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    metadata = json.loads(probe.stdout)
    assert metadata["streams"][0]["width"] == 1280
    assert metadata["streams"][0]["height"] == 720
    assert metadata["streams"][0]["r_frame_rate"] == "30/1"
    assert float(metadata["format"]["duration"]) == 5.0

def test_cli_writes_reproducible_ffmpeg_measurement_report(tmp_path: Path) -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "spikes.renderer.run_ffmpeg_native",
            "--request",
            str(FIXTURE),
            "--work-dir",
            str(tmp_path),
            "--font",
            "C:/Windows/Fonts/arial.ttf",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    report_path = Path(completed.stdout.strip())
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["candidate"] == "ffmpeg-native"
    assert report["fixture_id"] == "static-nameplate-01"
    assert report["canvas"] == {"width": 1280, "height": 720, "fps": 30}
    assert report["source_seconds"] > 0
    assert report["render_seconds"] > 0
    assert report["output_bytes"] > 0
    assert len(report["output_sha256"]) == 64
    assert report["ffmpeg_version"].startswith("ffmpeg version")
    assert report["deterministic"] is False

def test_cli_proves_determinism_with_repeated_output_hashes(tmp_path: Path) -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "spikes.renderer.run_ffmpeg_native",
            "--request",
            str(FIXTURE),
            "--work-dir",
            str(tmp_path),
            "--font",
            "C:/Windows/Fonts/arial.ttf",
            "--repeat",
            "2",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    report = json.loads(
        Path(completed.stdout.strip()).read_text(encoding="utf-8")
    )
    assert report["repeat_runs"] == 2
    assert report["deterministic"] is True
    assert len(report["output_sha256_runs"]) == 2
    assert len(set(report["output_sha256_runs"])) == 1


def test_special_characters_are_safe_in_drawtext_and_font_paths(
    tmp_path: Path,
) -> None:
    ffmpeg_native = importlib.import_module("spikes.renderer.ffmpeg_native")
    request = load_request(FIXTURE)
    request = replace(
        request,
        overlay=replace(
            request.overlay,
            primary_text=r"50% %{pts}, semi; [bracket] 'quote' \\ colon:",
            secondary_text=r"%{localtime} C:\\clips\\[draft];take,2",
        ),
    )
    source_path = tmp_path / "source.mp4"
    output_path = tmp_path / "output.mp4"
    font_path = tmp_path / "font %,;[safe]'name.ttf"
    shutil.copyfile(Path("C:/Windows/Fonts/arial.ttf"), font_path)
    subprocess.run(
        ffmpeg_native.build_synthetic_source_command(request, source_path),
        check=True,
        capture_output=True,
        text=True,
    )

    command = ffmpeg_native.build_nameplate_command(
        request,
        source_path,
        output_path,
        font_path,
    )
    filter_graph = command[command.index("-vf") + 1]
    assert "expansion=none" in filter_graph
    subprocess.run(command, check=True, capture_output=True, text=True)

    assert output_path.stat().st_size > 0
