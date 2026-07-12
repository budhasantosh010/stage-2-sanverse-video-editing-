from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class ContractError(ValueError):
    """The renderer spike request is unsafe or outside its explicit contract."""


def _finite_float(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise ContractError(f"{label} must be a finite number")
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ContractError(f"{label} must be a finite number") from error
    if not math.isfinite(number):
        raise ContractError(f"{label} must be finite")
    return number


def _positive_int(value: Any, label: str) -> int:
    number = _finite_float(value, f"canvas {label}")
    if not number.is_integer() or number <= 0:
        raise ContractError(f"canvas {label} must be a positive integer")
    return int(number)


@dataclass(frozen=True)
class Canvas:
    width: int
    height: int
    fps: int

    def __post_init__(self) -> None:
        values = (self.width, self.height, self.fps)
        if any(isinstance(value, bool) for value in values):
            raise ContractError("canvas values must be positive integers")
        if any(not math.isfinite(float(value)) for value in values):
            raise ContractError("canvas values must be finite")
        if any(value <= 0 for value in values):
            raise ContractError("canvas values must be positive integers")


@dataclass(frozen=True)
class Bounds:
    space: str
    x: float
    y: float
    width: float
    height: float

    def __post_init__(self) -> None:
        values = (self.x, self.y, self.width, self.height)
        if self.space != "normalized":
            raise ContractError("bounds.space must be normalized")
        if any(not math.isfinite(value) for value in values):
            raise ContractError("bounds values must be finite")
        if any(value < 0.0 or value > 1.0 for value in values):
            raise ContractError("bounds values must be between 0 and 1")
        if self.width == 0.0 or self.height == 0.0:
            raise ContractError("bounds width and height must be greater than zero")
        if self.x + self.width > 1.0 or self.y + self.height > 1.0:
            raise ContractError("bounds must stay inside the canvas")


@dataclass(frozen=True)
class Motion:
    kind: str

    def __post_init__(self) -> None:
        if self.kind != "static":
            raise ContractError(f"unsupported motion kind: {self.kind}")


@dataclass(frozen=True)
class Overlay:
    kind: str
    primary_text: str
    secondary_text: str
    bounds: Bounds
    start_seconds: float
    end_seconds: float
    motion: Motion

    def __post_init__(self) -> None:
        if self.kind != "nameplate":
            raise ContractError(f"unsupported overlay kind: {self.kind}")
        if not isinstance(self.primary_text, str) or not self.primary_text.strip():
            raise ContractError("nameplate primary_text must not be empty")
        if not isinstance(self.secondary_text, str):
            raise ContractError("nameplate secondary_text must be text")
        if not math.isfinite(self.start_seconds) or not math.isfinite(
            self.end_seconds
        ):
            raise ContractError("overlay time values must be finite")

    def active_at(self, seconds: float) -> bool:
        return self.start_seconds <= seconds < self.end_seconds


@dataclass(frozen=True)
class Source:
    kind: str
    duration_seconds: float

    def __post_init__(self) -> None:
        if self.kind != "synthetic-talking-head":
            raise ContractError(f"unsupported source kind: {self.kind}")
        if not math.isfinite(self.duration_seconds):
            raise ContractError("source duration must be finite")
        if self.duration_seconds <= 0.0:
            raise ContractError("source duration must be greater than zero")


@dataclass(frozen=True)
class RendererRequest:
    schema_version: str
    fixture_id: str
    source: Source
    canvas: Canvas
    overlay: Overlay

    def __post_init__(self) -> None:
        if self.schema_version != "renderer-spike/v1":
            raise ContractError("unsupported renderer-spike schema version")
        if self.overlay.start_seconds < 0.0:
            raise ContractError("overlay time window cannot start before the source")
        if self.overlay.start_seconds >= self.overlay.end_seconds:
            raise ContractError("overlay time window must have positive duration")
        if self.overlay.end_seconds > self.source.duration_seconds:
            raise ContractError("overlay time window must stay inside source duration")


def load_request(path: str | Path) -> RendererRequest:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    source_data = data["source"]
    canvas_data = data["canvas"]
    overlay_data = data["overlay"]
    bounds_data = overlay_data["bounds"]
    motion_data = overlay_data["motion"]

    return RendererRequest(
        schema_version=data["schema_version"],
        fixture_id=data["fixture_id"],
        source=Source(
            kind=source_data["kind"],
            duration_seconds=_finite_float(
                source_data["duration_seconds"],
                "source duration",
            ),
        ),
        canvas=Canvas(
            width=_positive_int(canvas_data["width"], "width"),
            height=_positive_int(canvas_data["height"], "height"),
            fps=_positive_int(canvas_data["fps"], "fps"),
        ),
        overlay=Overlay(
            kind=overlay_data["kind"],
            primary_text=overlay_data["primary_text"],
            secondary_text=overlay_data["secondary_text"],
            bounds=Bounds(
                space=bounds_data["space"],
                x=_finite_float(bounds_data["x"], "bounds.x"),
                y=_finite_float(bounds_data["y"], "bounds.y"),
                width=_finite_float(bounds_data["width"], "bounds.width"),
                height=_finite_float(bounds_data["height"], "bounds.height"),
            ),
            start_seconds=_finite_float(
                overlay_data["start_seconds"],
                "overlay start_seconds",
            ),
            end_seconds=_finite_float(
                overlay_data["end_seconds"],
                "overlay end_seconds",
            ),
            motion=Motion(kind=motion_data["kind"]),
        ),
    )
