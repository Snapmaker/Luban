"""Reproducible UF2-only installation; preserves settings and stages before writing."""
import argparse
import hashlib
import json
import pathlib
import shutil
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = HERE / "firmware" if (HERE / "firmware" / "code.py").exists() else HERE / "controller-source"
BOARD = "adafruit_feather_esp32s3_reverse_tft"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage(project, bundle, settings):
    device = project / "device"
    device.mkdir(parents=True, exist_ok=True)
    for source in SOURCE.glob("*.py"):
        shutil.copy2(source, device / source.name)
    if settings:
        shutil.copy2(settings, device / "settings.toml")
    elif not (device / "settings.toml").exists():
        shutil.copy2(HERE / "settings.example.toml", device / "settings.toml")
    prefixes = ("adafruit_display_text/", "adafruit_bitmap_font/", "adafruit_ticks.mpy")
    with zipfile.ZipFile(bundle) as archive:
        for name in archive.namelist():
            if "/lib/" not in name or name.endswith("/"):
                continue
            relative = name.split("/lib/", 1)[1]
            if not any(relative.startswith(prefix) for prefix in prefixes):
                continue
            target = device / "lib" / relative
            if not target.resolve().is_relative_to(device.resolve()):
                raise ValueError("Unsafe bundle path")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    if not (device / "lib" / "adafruit_display_text" / "label.mpy").exists():
        raise ValueError("Bundle is missing display_text/label.mpy")
    manifest = [{"path": p.relative_to(device).as_posix(), "bytes": p.stat().st_size,
                 "sha256": digest(p)} for p in sorted(device.rglob("*")) if p.is_file()]
    (project / "device-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for name in ("README.md", "deploy.py", "settings.example.toml"):
        if (HERE / name).resolve() != (project / name).resolve():
            shutil.copy2(HERE / name, project / name)
    # Keep the sources needed to rerun this script beside it.
    (project / "controller-source").mkdir(exist_ok=True)
    for source in SOURCE.glob("*.py"):
        target = project / "controller-source" / source.name
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
    print("Staged", len(manifest), "files in", device, "(settings preserved privately)")
    return device


def install(device, drive):
    boot = drive / "boot_out.txt"
    text = boot.read_text(encoding="utf-8")
    if BOARD not in text or "CircuitPython 11." not in text:
        raise ValueError("Expected the Reverse TFT Feather running CircuitPython 11")
    # Old root-level libraries shadow /lib. Preserve them outside Python's import path.
    for name in ("adafruit_display_text", "adafruit_bitmap_font", "adafruit_ticks.mpy"):
        old = drive / name
        if old.exists():
            target = drive / "legacy-libraries" / name
            if not old.resolve().is_relative_to(drive.resolve()) or not target.resolve().is_relative_to(drive.resolve()):
                raise ValueError("Library preservation path leaves the verified device drive")
            if target.exists():
                raise ValueError("Old library already archived: " + str(target))
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old), str(target))
    # code.py is last, so auto-reload cannot start the new app before dependencies exist.
    sources = [p for p in device.rglob("*") if p.is_file() and p.name != "code.py"]
    sources.append(device / "code.py")
    for source in sources:
        target = drive / source.relative_to(device)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if digest(source) != digest(target):
            raise ValueError("Device copy verification failed: " + str(target))
    print("Device files verified. Press RESET once to apply boot.py and expose USB data.")


def flash_uf2(uf2, drive):
    info = (drive / "INFO_UF2.TXT").read_text(encoding="utf-8")
    if "FeatherRevTFT" not in info:
        raise ValueError("Expected the Feather Reverse TFT boot drive")
    if "11." not in uf2.name or uf2.suffix.lower() != ".uf2":
        raise ValueError("Select the requested CircuitPython 11 UF2")
    shutil.copyfile(uf2, drive / "circuitpython.uf2")
    print("UF2 copied. Verify boot_out.txt after the board reconnects before installing files.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=pathlib.Path)
    parser.add_argument("--bundle", type=pathlib.Path)
    parser.add_argument("--settings", type=pathlib.Path)
    parser.add_argument("--drive", type=pathlib.Path)
    parser.add_argument("--uf2", type=pathlib.Path)
    parser.add_argument("--device", type=pathlib.Path)
    args = parser.parse_args()
    if args.uf2:
        if not args.drive:
            parser.error("--uf2 needs --drive (FTHRS3BOOT)")
        flash_uf2(args.uf2, args.drive)
        return
    if args.project:
        if not args.bundle:
            parser.error("--project needs --bundle (11.x-mpy)")
        if "11.x-mpy" not in args.bundle.name:
            parser.error("CircuitPython 11 needs the requested 11.x-mpy library bundle")
        device = stage(args.project, args.bundle, args.settings)
    else:
        device = args.device
    if args.drive:
        if not device:
            parser.error("--drive needs --device or --project")
        install(device, args.drive)


if __name__ == "__main__":
    main()
