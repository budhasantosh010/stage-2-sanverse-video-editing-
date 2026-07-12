from __future__ import annotations

import html
import importlib
from dataclasses import replace
from pathlib import Path

import pytest

from spikes.renderer.contract import load_request


FIXTURE = Path(__file__).parents[1] / "fixtures" / "static-nameplate-v1.json"


def test_builds_local_hyperframes_static_nameplate_composition() -> None:
    candidate = importlib.import_module("spikes.renderer.hyperframes_candidate")
    request = load_request(FIXTURE)

    document = candidate.build_composition(request, video_filename="source.mp4")

    assert 'data-composition-id="main"' in document
    assert 'data-width="1280"' in document
    assert 'data-height="720"' in document
    assert 'data-duration="5"' in document
    assert 'src="source.mp4"' in document
    assert '<video id="a-roll" class="clip"' in document
    assert '<audio id="a-roll-audio"' in document
    assert 'id="nameplate" class="clip"' in document
    assert 'data-start="1"' in document
    assert 'data-duration="3"' in document
    assert 'data-track-index="1"' in document
    assert "left: 64%" in document
    assert "top: 68%" in document
    assert "width: 28%" in document
    assert "height: 16%" in document
    assert "Santosh" in document
    assert "Founder" in document


def test_composition_is_offline_and_frame_driven() -> None:
    candidate = importlib.import_module("spikes.renderer.hyperframes_candidate")
    document = candidate.build_composition(load_request(FIXTURE))

    assert "http://" not in document
    assert "https://" not in document
    assert "setTimeout" not in document
    assert "setInterval" not in document
    assert "requestAnimationFrame" not in document
    assert "Date.now" not in document
    assert "autoplay" not in document


def test_escapes_user_visible_text() -> None:
    candidate = importlib.import_module("spikes.renderer.hyperframes_candidate")
    request = load_request(FIXTURE)
    hostile = '<img src=x onerror="alert(1)"> & founder'
    request = replace(
        request,
        overlay=replace(
            request.overlay,
            primary_text=hostile,
            secondary_text="<script>bad()</script>",
        ),
    )

    document = candidate.build_composition(request)

    assert hostile not in document
    assert html.escape(hostile) in document
    assert "<script>bad()</script>" not in document
    assert html.escape("<script>bad()</script>") in document


@pytest.mark.parametrize(
    "video_filename",
    ["../source.mp4", "nested/source.mp4", r"nested\source.mp4", "https://example.com/a.mp4", ""],
)
def test_rejects_nonlocal_video_filename(video_filename: str) -> None:
    candidate = importlib.import_module("spikes.renderer.hyperframes_candidate")

    with pytest.raises(ValueError, match="local filename"):
        candidate.build_composition(
            load_request(FIXTURE),
            video_filename=video_filename,
        )


def test_writes_reproducible_index_file(tmp_path: Path) -> None:
    candidate = importlib.import_module("spikes.renderer.hyperframes_candidate")
    request = load_request(FIXTURE)

    first = candidate.write_composition(request, tmp_path)
    first_bytes = first.read_bytes()
    second = candidate.write_composition(request, tmp_path)

    assert first == tmp_path / "index.html"
    assert first_bytes == second.read_bytes()
    assert first_bytes.endswith(b"\n")