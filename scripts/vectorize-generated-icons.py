from __future__ import annotations

"""Vectorize a generated icon sheet into app-ready SVG icons.

Required Python packages:
  py -m pip install --user pillow opencv-python-headless
"""

import argparse
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


ICON_NAMES = [
    "nav-dashboard",
    "nav-trilhas",
    "nav-pre-requisitos",
    "nav-pratica",
    "nav-provas",
    "nav-playlists",
    "nav-importacao",
    "nav-admin",
    "playlist-practice",
    "playlist-theory",
    "playlist-prerequisite",
    "brand-mark",
]


def grouped_dark_axes(image: Image.Image, axis: str) -> list[tuple[int, int, float, int]]:
    gray = image.convert("L")
    width, height = gray.size
    items: list[tuple[int, float]] = []

    if axis == "x":
        for x in range(width):
            mean = sum(gray.getpixel((x, y)) for y in range(height)) / height
            if mean < 248:
                items.append((x, mean))
    else:
        for y in range(height):
            mean = sum(gray.getpixel((x, y)) for x in range(width)) / width
            if mean < 248:
                items.append((y, mean))

    groups: list[list[tuple[int, float]]] = []
    current: list[tuple[int, float]] = []
    previous: int | None = None
    for index, mean in items:
        if previous is None or index <= previous + 1:
            current.append((index, mean))
        else:
            if current:
                groups.append(current)
            current = [(index, mean)]
        previous = index
    if current:
        groups.append(current)

    return [
        (
            group[0][0],
            group[-1][0],
            min(mean for _, mean in group),
            round(sum(index for index, _ in group) / len(group)),
        )
        for group in groups
    ]


def detect_grid_lines(image: Image.Image) -> tuple[list[int], list[int]]:
    x_candidates = [
        center
        for start, end, mean, center in grouped_dark_axes(image, "x")
        if end - start <= 4 and mean < 240
    ]
    y_candidates = [
        center
        for start, end, mean, center in grouped_dark_axes(image, "y")
        if end - start <= 4 and mean < 240
    ]

    if len(x_candidates) < 5 or len(y_candidates) < 4:
        raise RuntimeError(
            f"Could not detect a 4x3 grid. x={x_candidates}, y={y_candidates}"
        )

    return x_candidates[:5], y_candidates[:4]


def clean_icon_cell(cell: Image.Image, output_size: int = 512) -> Image.Image:
    gray = cell.convert("L")
    mask = Image.new("L", gray.size, 0)
    mask_pixels = mask.load()
    gray_pixels = gray.load()

    for y in range(gray.height):
        for x in range(gray.width):
            value = gray_pixels[x, y]
            if value < 178:
                mask_pixels[x, y] = 255

    bbox = mask.getbbox()
    if bbox is None:
        return Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))

    pad = 18
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(mask.width, bbox[2] + pad)
    bottom = min(mask.height, bbox[3] + pad)
    cropped = mask.crop((left, top, right, bottom))

    scale = min((output_size * 0.78) / cropped.width, (output_size * 0.78) / cropped.height)
    resized_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(resized_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    black = Image.new("RGBA", resized_size, (0, 0, 0, 255))
    position = (
        (output_size - resized.width) // 2,
        (output_size - resized.height) // 2,
    )
    canvas.alpha_composite(black, position)
    canvas.putalpha(Image.new("L", (output_size, output_size), 0))
    canvas.alpha_composite(black, position)
    alpha = Image.new("L", (output_size, output_size), 0)
    alpha.paste(resized, position)
    canvas.putalpha(alpha)
    return canvas


def contour_to_path(contour: np.ndarray) -> str:
    points = contour.reshape(-1, 2)
    if len(points) < 3:
        return ""

    commands = [f"M {points[0][0]:.1f} {points[0][1]:.1f}"]
    commands.extend(f"L {point[0]:.1f} {point[1]:.1f}" for point in points[1:])
    commands.append("Z")
    return " ".join(commands)


def convert_png_to_svg(png_path: Path, svg_path: Path) -> None:
    icon = Image.open(png_path).convert("RGBA")
    alpha = np.array(icon.getchannel("A"))
    _, binary = cv2.threshold(alpha, 96, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    path_parts: list[str] = []
    for contour in contours:
        area = abs(cv2.contourArea(contour))
        if area < 12:
            continue
        epsilon = max(0.75, 0.004 * cv2.arcLength(contour, True))
        approx = cv2.approxPolyDP(contour, epsilon, True)
        path_data = contour_to_path(approx)
        if path_data:
            path_parts.append(path_data)

    path = " ".join(path_parts)
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        f'<path d="{path}" fill="#000000" fill-rule="evenodd"/>\n'
        "</svg>\n"
    )
    svg_path.write_text(svg, encoding="utf-8")


def make_preview(icon_pngs: list[Path], preview_path: Path) -> None:
    cell = 120
    columns = 4
    rows = 3
    preview = Image.new("RGB", (columns * cell, rows * cell), "#f6f8f8")
    draw = ImageDraw.Draw(preview)

    for index, icon_path in enumerate(icon_pngs):
        icon = Image.open(icon_path).convert("RGBA").resize((72, 72), Image.Resampling.LANCZOS)
        x = (index % columns) * cell + (cell - icon.width) // 2
        y = (index // columns) * cell + 18
        preview.alpha_composite(icon, (x, y)) if preview.mode == "RGBA" else preview.paste(icon, (x, y), icon)
        draw.rounded_rectangle(
            [
                (index % columns) * cell + 8,
                (index // columns) * cell + 8,
                (index % columns + 1) * cell - 8,
                (index // columns + 1) * cell - 8,
            ],
            outline="#d9e1e4",
            radius=12,
            width=1,
        )

    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(preview_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--public-dir", default=Path("public"), type=Path)
    args = parser.parse_args()

    public_dir = args.public_dir
    generated_dir = public_dir / "generated-icons"
    icons_dir = public_dir / "icons"
    generated_dir.mkdir(parents=True, exist_ok=True)
    icons_dir.mkdir(parents=True, exist_ok=True)

    source_copy = generated_dir / "icon-sheet-source.png"
    shutil.copyfile(args.source, source_copy)

    sheet = Image.open(source_copy).convert("RGB")
    x_lines, y_lines = detect_grid_lines(sheet)
    icon_pngs: list[Path] = []

    for index, name in enumerate(ICON_NAMES):
        row = index // 4
        column = index % 4
        left = x_lines[column] + 18
        top = y_lines[row] + 18
        right = x_lines[column + 1] - 18
        bottom = y_lines[row + 1] - 18
        cell = sheet.crop((left, top, right, bottom))
        cleaned = clean_icon_cell(cell)

        png_path = generated_dir / f"{name}.png"
        svg_path = icons_dir / f"{name}.svg"
        cleaned.save(png_path)
        convert_png_to_svg(png_path, svg_path)
        icon_pngs.append(png_path)

    make_preview(icon_pngs, generated_dir / "icon-preview.png")
    print(f"source={source_copy}")
    print(f"icons={icons_dir}")
    print(f"preview={generated_dir / 'icon-preview.png'}")


if __name__ == "__main__":
    main()
