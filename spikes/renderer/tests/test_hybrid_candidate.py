from __future__ import annotations

import importlib
import os
from dataclasses import replace
from pathlib import Path

import pytest

from spikes.renderer.contract import load_request


FIXTURE = Path(__file__).parents[1] / "fixtures" / "static-nameplate-v1.json"


def test_builds_browser_preview_and_ffmpeg_export_from_same_request() -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    request = load_request(FIXTURE)

    plan = candidate.build_hybrid_plan(
        request,
        input_path=Path("work/source.mp4"),
        output_path=Path("work/output.mp4"),
        font_path=Path("C:/Windows/Fonts/arial.ttf"),
        video_filename="source.mp4",
        trusted_work_dir=Path("work"),
    )

    assert 'data-composition-id="main"' in plan.preview_document
    assert 'src="source.mp4"' in plan.preview_document
    assert "Santosh" in plan.preview_document
    assert Path(plan.export_command[0]).is_file()
    assert Path(plan.export_command[0]).name.lower() == "ffmpeg.exe"
    assert plan.export_command[plan.export_command.index("-i") + 1] == str(
        Path("work/source.mp4")
    )
    assert plan.export_command[-1] == str(Path("work/output.mp4"))
    filter_graph = plan.export_command[plan.export_command.index("-vf") + 1]
    assert "text='Santosh'" in filter_graph
    assert "gte(t\\,1.000)*lt(t\\,4.000)" in filter_graph


def test_writes_byte_reproducible_preview_without_mutating_source(
    tmp_path: Path,
) -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    request = load_request(FIXTURE)
    source = tmp_path / "source.mp4"
    source.write_bytes(b"immutable-fixture-sentinel")

    first = candidate.write_preview_document(request, tmp_path)
    first_bytes = first.read_bytes()
    second = candidate.write_preview_document(request, tmp_path)

    assert first == tmp_path / "index.html"
    assert first_bytes == second.read_bytes()
    assert source.read_bytes() == b"immutable-fixture-sentinel"


def test_export_command_is_an_argument_list_not_a_shell_string() -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    request = load_request(FIXTURE)

    command = candidate.build_export_command(
        request,
        input_path=Path("work/source with spaces.mp4"),
        output_path=Path("work/output with spaces.mp4"),
        font_path=Path("C:/Windows/Fonts/arial.ttf"),
        trusted_work_dir=Path("work"),
    )

    assert isinstance(command, list)
    assert all(isinstance(argument, str) for argument in command)
    assert command[command.index("-i") + 1] == str(
        Path("work/source with spaces.mp4")
    )
    assert command[-1] == str(Path("work/output with spaces.mp4"))


def test_proves_structural_fidelity_from_generated_preview_and_export() -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    request = load_request(FIXTURE)
    plan = candidate.build_hybrid_plan(
        request,
        input_path=Path("work/source.mp4"),
        output_path=Path("work/output.mp4"),
        font_path=Path("C:/Windows/Fonts/arial.ttf"),
        trusted_work_dir=Path("work"),
    )

    fidelity = candidate.inspect_structural_fidelity(request, plan)

    assert fidelity.preview_text == ("Santosh", "Founder")
    assert fidelity.export_text == ("Santosh", "Founder")
    assert fidelity.preview_time_window == (1.0, 4.0)
    assert fidelity.export_time_window == (1.0, 4.0)
    assert fidelity.preview_bounds == (0.64, 0.68, 0.28, 0.16)
    assert fidelity.export_bounds == (
        819 / 1280,
        490 / 720,
        358 / 1280,
        115 / 720,
    )
    assert fidelity.maximum_normalized_bound_delta <= 0.5 / 720
    assert fidelity.equivalent is True


def test_measures_local_deployment_facts_without_hyperframes_execution() -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")

    measurement = candidate.measure_local_deployment(load_request(FIXTURE))

    assert measurement.hybrid_adapter_bytes > 0
    assert measurement.browser_adapter_bytes > 0
    assert measurement.ffmpeg_adapter_bytes > 0
    assert measurement.generated_preview_bytes > 0
    assert measurement.ffmpeg_executable_path.is_file()
    assert measurement.ffmpeg_executable_bytes > 0
    assert measurement.ffmpeg_version.startswith("ffmpeg version")
    assert len(measurement.ffmpeg_startup_seconds) == 3
    assert all(seconds > 0 for seconds in measurement.ffmpeg_startup_seconds)
    assert measurement.hyperframes_runtime_executed is False
    assert measurement.hyperframes_archive_bytes is None


def test_structural_fidelity_handles_adversarial_valid_text() -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    request = load_request(FIXTURE)
    request = replace(
        request,
        overlay=replace(
            request.overlay,
            primary_text=r"O'Brien, CEO: C:\clips\<draft> & [safe]",
            secondary_text=r"50% %{pts}; backslash=\ HTML=<script>no()</script>",
        ),
    )
    plan = candidate.build_hybrid_plan(
        request,
        input_path=Path("work/source.mp4"),
        output_path=Path("work/output.mp4"),
        font_path=Path("C:/Windows/Fonts/arial.ttf"),
        trusted_work_dir=Path("work"),
    )

    fidelity = candidate.inspect_structural_fidelity(request, plan)

    assert fidelity.preview_text == (
        request.overlay.primary_text,
        request.overlay.secondary_text,
    )
    assert fidelity.export_text == (
        request.overlay.primary_text,
        request.overlay.secondary_text,
    )
    assert fidelity.equivalent is True


@pytest.mark.parametrize("alias_kind", ["same", "relative"])
def test_rejects_canonical_input_output_collisions(
    tmp_path: Path,
    alias_kind: str,
) -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    trusted = tmp_path / "trusted"
    trusted.mkdir()
    source = trusted / "source.mp4"
    source.write_bytes(b"source")
    output = (
        source
        if alias_kind == "same"
        else trusted / "nested" / ".." / "source.mp4"
    )

    with pytest.raises(ValueError, match="input and output"):
        candidate.build_export_command(
            load_request(FIXTURE),
            source,
            output,
            Path("C:/Windows/Fonts/arial.ttf"),
            trusted_work_dir=trusted,
        )


def test_rejects_existing_hardlink_collision(tmp_path: Path) -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    trusted = tmp_path / "trusted"
    trusted.mkdir()
    source = trusted / "source.mp4"
    alias = trusted / "alias.mp4"
    source.write_bytes(b"source")
    os.link(source, alias)

    with pytest.raises(ValueError, match="input and output"):
        candidate.build_export_command(
            load_request(FIXTURE),
            source,
            alias,
            Path("C:/Windows/Fonts/arial.ttf"),
            trusted_work_dir=trusted,
        )


def test_rejects_output_outside_trusted_workspace(tmp_path: Path) -> None:
    candidate = importlib.import_module("spikes.renderer.hybrid_candidate")
    trusted = tmp_path / "trusted"
    trusted.mkdir()

    with pytest.raises(ValueError, match="trusted renderer workspace"):
        candidate.build_export_command(
            load_request(FIXTURE),
            trusted / "source.mp4",
            tmp_path / "outside.mp4",
            Path("C:/Windows/Fonts/arial.ttf"),
            trusted_work_dir=trusted,
        )
