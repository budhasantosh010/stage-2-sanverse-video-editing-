from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


FIXTURE = Path(__file__).parents[1] / "fixtures" / "static-nameplate-v1.json"


def _write_fixture(tmp_path: Path, data: dict[str, object]) -> Path:
    path = tmp_path / "request.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_loads_renderer_neutral_static_nameplate_request() -> None:
    contract = importlib.import_module("spikes.renderer.contract")

    request = contract.load_request(FIXTURE)

    assert request.schema_version == "renderer-spike/v1"
    assert request.fixture_id == "static-nameplate-01"
    assert request.canvas.width == 1280
    assert request.canvas.height == 720
    assert request.canvas.fps == 30
    assert request.overlay.primary_text == "Santosh"
    assert request.overlay.secondary_text == "Founder"
    assert request.overlay.bounds.space == "normalized"
    assert request.overlay.bounds.x == 0.64
    assert request.overlay.bounds.y == 0.68
    assert request.overlay.active_at(1.0)
    assert not request.overlay.active_at(4.0)

def test_rejects_bounds_that_extend_outside_canvas(tmp_path: Path) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data["overlay"]["bounds"]["x"] = 0.8
    data["overlay"]["bounds"]["width"] = 0.3
    invalid_fixture = tmp_path / "invalid-bounds.json"
    invalid_fixture.write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(contract.ContractError, match="bounds"):
        contract.load_request(invalid_fixture)

def test_rejects_overlay_time_window_beyond_source_duration(tmp_path: Path) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data["overlay"]["end_seconds"] = 5.1
    invalid_fixture = tmp_path / "invalid-time-window.json"
    invalid_fixture.write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(contract.ContractError, match="time window"):
        contract.load_request(invalid_fixture)


@pytest.mark.parametrize(
    ("field", "value"),
    [("width", 0), ("height", -1), ("fps", 0)],
)
def test_rejects_nonpositive_canvas_values(
    tmp_path: Path,
    field: str,
    value: int,
) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data["canvas"][field] = value

    with pytest.raises(contract.ContractError, match="canvas"):
        contract.load_request(_write_fixture(tmp_path, data))


@pytest.mark.parametrize("value", [0.0, -0.1])
def test_rejects_nonpositive_source_duration(
    tmp_path: Path,
    value: float,
) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data["source"]["duration_seconds"] = value

    with pytest.raises(contract.ContractError, match="source duration"):
        contract.load_request(_write_fixture(tmp_path, data))


@pytest.mark.parametrize(
    ("section", "field", "value"),
    [
        ("source", "duration_seconds", float("nan")),
        ("source", "duration_seconds", float("inf")),
        ("canvas", "width", float("inf")),
        ("canvas", "fps", float("nan")),
        ("bounds", "x", float("nan")),
        ("bounds", "height", float("inf")),
        ("overlay", "start_seconds", float("nan")),
        ("overlay", "end_seconds", float("inf")),
    ],
)
def test_rejects_nonfinite_numeric_values(
    tmp_path: Path,
    section: str,
    field: str,
    value: float,
) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    target = data["overlay"]["bounds"] if section == "bounds" else data[section]
    target[field] = value

    with pytest.raises(contract.ContractError, match="finite"):
        contract.load_request(_write_fixture(tmp_path, data))


@pytest.mark.parametrize(
    ("section", "unsupported_kind"),
    [
        ("source", "uploaded-video"),
        ("overlay", "subtitle"),
        ("motion", "spring"),
    ],
)
def test_rejects_unsupported_kinds(
    tmp_path: Path,
    section: str,
    unsupported_kind: str,
) -> None:
    contract = importlib.import_module("spikes.renderer.contract")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    target = data["overlay"]["motion"] if section == "motion" else data[section]
    target["kind"] = unsupported_kind

    with pytest.raises(contract.ContractError, match=f"unsupported {section} kind"):
        contract.load_request(_write_fixture(tmp_path, data))
