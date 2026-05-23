"""
apng_to_sheet.py  —  Convert an APNG to a horizontal sprite sheet PNG (alpha preserved).

Usage:
    python scripts/apng_to_sheet.py <input.png> [output.png]

Output defaults to <input>_sheet.png next to the source file.
Prints the constants to paste into your shader code.

Requirements:
    pip install Pillow
"""

import sys
from pathlib import Path
from PIL import Image


def convert(src: Path, dst: Path) -> None:
    img = Image.open(src)

    try:
        n_frames = img.n_frames
    except AttributeError:
        n_frames = 1

    w, h = img.size
    sheet = Image.new("RGBA", (w * n_frames, h), (0, 0, 0, 0))

    durations = []
    for i in range(n_frames):
        img.seek(i)
        frame = img.convert("RGBA")
        sheet.paste(frame, (i * w, 0))
        durations.append(img.info.get("duration", 100))  # ms per frame

    sheet.save(dst)

    total_ms = sum(durations)
    avg_fps  = round(1000 / (total_ms / n_frames), 1) if total_ms else 12

    print(f"[ok] {n_frames} frames  {w*n_frames}x{h}  ->  {dst.name}")
    print(f"     frame durations (ms): {durations}")
    print(f"     average fps: {avg_fps}")
    print()
    print("Paste into your shader/component:")
    print(f"  const IMPACT_FRAMES = {n_frames};")
    print(f"  const IMPACT_FPS    = {avg_fps};")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_name(src.stem + "_sheet.png")

    if not src.exists():
        print(f"File not found: {src}")
        sys.exit(1)

    convert(src, dst)
