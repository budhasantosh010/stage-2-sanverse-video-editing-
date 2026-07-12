from __future__ import annotations

import importlib
from pathlib import Path

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
    )

    assert 'data-composition-id="main"' in plan.preview_document
    assert 'src="source.mp4"' in plan.preview_document
    assert "Santosh" in plan.preview_document
    assert plan.export_command[0] == "ffmpeg"
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
    )

    assert isinstance(command, list)
    assert all(isinstance(argument, str) for argument in command)
    assert command[command.index("-i") + 1] == str(
        Path("work/source with spaces.mp4")
    )
    assert command[-1] == str(Path("work/output with spaces.mp4"))
