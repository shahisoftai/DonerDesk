"""Builds the self-hosted context layers and population grids (Phase 49.6/49.7) without the GDAL command line.

    <python with rasterio, pyogrio, numpy, rio-pmtiles> scripts/maps/build_context_layers.py KEN NGA ...

Writes under apps/web/public/tiles/context/:
  population.pmtiles          WorldPop 2020 1 km counts (100 m with WORLDPOP_RES=100m), CC BY 4.0, coloured, z0-9 (`rio pmtiles`)
  population-grid/<ISO>.bin   the same counts summed to ~1 km cells, Float32 little-endian, -1 = no data, + <ISO>.json header
  health-facilities.pmtiles   healthsites.io per country (ODbL; share-alike), layer "facilities" (tippecanoe)
  settlements.pmtiles         HOT OpenStreetMap populated places (ODbL; share-alike), layer "settlements" (tippecanoe)
Downloads go to .context-work/ (kept, so a re-run resumes). Nothing here is project data.
"""
import json, os, subprocess, sys, zipfile
from pathlib import Path

import numpy as np
import pyogrio
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio.warp import reproject

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/tiles/context"
WORK = ROOT / ".context-work"
YEAR = os.environ.get("WORLDPOP_YEAR", "2020")
CELL = 1 / 120  # 30 arc-seconds, about 1 km
BIN = Path(sys.executable).parent


def fetch(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    r = subprocess.run(["curl", "-sSL", "--fail", "--retry", "3", "--max-time", "1800", "-o", str(dest) + ".part", url])
    if r.returncode != 0:
        return False
    os.replace(str(dest) + ".part", dest)
    return True


def hdx_geojson(dataset: str) -> str | None:
    # HDX answers some clients (Python's urllib, Node's fetch) with an empty 202; curl is served.
    r = subprocess.run(["curl", "-sSL", "--fail", "--retry", "3", "--max-time", "60", f"https://data.humdata.org/api/3/action/package_show?id={dataset}"], capture_output=True, text=True)
    try:
        pkg = json.loads(r.stdout)
    except ValueError:
        return None
    if not pkg.get("success"):
        return None
    for res in pkg["result"]["resources"]:
        if res.get("format", "").lower() == "geojson" and "hxl" not in res["url"]:
            return res["url"]
    return None


def worldpop(iso: str) -> Path | None:
    """WorldPop's 1 km counts by default (a few MB; WorldPop serves slowly, ~50 KB/s); WORLDPOP_RES=100m takes the 100 m constrained
    counts instead (tens of MB per country, finer colours, the same ~1 km grid)."""
    lower = iso.lower()
    if os.environ.get("WORLDPOP_RES") != "100m":
        dest = WORK / f"{lower}_ppp_{YEAR}_1km.tif"
        if fetch(f"https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/{YEAR}/{iso}/{lower}_ppp_{YEAR}_1km_Aggregated_UNadj.tif", dest):
            return dest
        print(f"{iso}: no WorldPop 1 km raster")
        return None
    dest = WORK / f"{lower}_ppp_{YEAR}.tif"
    for flavour in ("maxar_v1", "BSGM"):
        if fetch(f"https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/{YEAR}/{flavour}/{iso}/{lower}_ppp_{YEAR}_UNadj_constrained.tif", dest):
            return dest
    print(f"{iso}: no WorldPop raster")
    return None


def grid(iso: str, tif: Path) -> None:
    """Sum the 100 m counts into ~1 km cells; a cell with no data at all stays -1 (never 0)."""
    with rasterio.open(tif) as src:
        w, s, e, n = src.bounds
        west, north = np.floor(w / CELL) * CELL, np.ceil(n / CELL) * CELL
        cols, rows = int(np.ceil((e - west) / CELL)), int(np.ceil((north - s) / CELL))
        out = np.full((rows, cols), -1, dtype=np.float32)
        transform = rasterio.transform.from_origin(west, north, CELL, CELL)
        reproject(rasterio.band(src, 1), out, src_nodata=src.nodata, dst_transform=transform, dst_crs="EPSG:4326", dst_nodata=-1, resampling=Resampling.sum)
    d = OUT / "population-grid"
    d.mkdir(parents=True, exist_ok=True)
    out.astype("<f4").tofile(d / f"{iso}.bin")
    (d / f"{iso}.json").write_text(json.dumps({"west": float(west), "north": float(north), "cellDeg": CELL, "cols": cols, "rows": rows, "source": "WorldPop (University of Southampton), CC BY 4.0", "year": YEAR}))
    print(f"{iso}: grid {cols}x{rows}, {float(out[out > 0].sum()):,.0f} people")


# People per cell -> colour (none is transparent, never drawn as 0). The steps are per km²; a 100 m cell is 1/100 of that.
SCALE = 0.01 if os.environ.get("WORLDPOP_RES") == "100m" else 1.0
RAMP = [(5 * SCALE, (254, 232, 200, 120)), (50 * SCALE, (253, 187, 132, 160)), (250 * SCALE, (239, 101, 72, 190)), (1000 * SCALE, (179, 0, 0, 215)), (5000 * SCALE, (127, 0, 0, 235))]


def colour(tifs: list[Path]) -> Path:
    mosaic, transform = merge([rasterio.open(t) for t in tifs], nodata=-1)
    v = mosaic[0]
    rgba = np.zeros((4,) + v.shape, dtype=np.uint8)
    for limit, c in RAMP:
        m = v >= limit
        for i in range(4):
            rgba[i][m] = c[i]
    path = WORK / "population-rgba.tif"
    with rasterio.open(path, "w", driver="GTiff", width=v.shape[1], height=v.shape[0], count=4, dtype="uint8", crs="EPSG:4326", transform=transform, compress="deflate") as dst:
        dst.write(rgba)
    return path


def points(kind: str, datasets: list[str], layer: str) -> None:
    lines = WORK / f"{kind}.geojsons"
    count = 0
    with open(lines, "w") as f:
        for ds in datasets:
            url = hdx_geojson(ds)
            if not url:
                print(f"{ds}: not on HDX")
                continue
            src = WORK / f"{ds}.geojson"
            if not fetch(url, src):
                print(f"{ds}: download failed")
                continue
            # Some HDX "GeoJSON" downloads (the HOT exports) are a zip holding the GeoJSON: it is unpacked first.
            with open(src, "rb") as head:
                zipped = head.read(2) == b"PK"
            if zipped:
                with zipfile.ZipFile(src) as z:
                    inner = next((n for n in z.namelist() if n.lower().endswith((".geojson", ".json"))), None)
                    if not inner:
                        print(f"{ds}: no GeoJSON inside the zip")
                        continue
                    unpacked = WORK / f"{ds}.unzipped.geojson"
                    unpacked.write_bytes(z.read(inner))
                src = unpacked
            gdf = pyogrio.read_dataframe(src)
            gdf = gdf[gdf.geometry.notna()]
            gdf["geometry"] = gdf.geometry.representative_point()
            name = next((c for c in ("name", "Name", "NAME") if c in gdf.columns), None)
            for _, row in gdf.iterrows():
                props = {"name": str(row[name])} if name and row[name] is not None else {}
                f.write(json.dumps({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [round(row.geometry.x, 6), round(row.geometry.y, 6)]}}) + "\n")
                count += 1
    if count:
        subprocess.run(["tippecanoe", "-o", str(OUT / f"{kind}.pmtiles"), "-l", layer, "-zg", "--drop-densest-as-needed", "--force", str(lines)], check=True)
    print(f"{kind}: {count} points")


def main(isos: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(exist_ok=True)
    tifs = []
    for iso in isos:
        t = worldpop(iso)
        if t:
            tifs.append(t)
            grid(iso, t)
    if tifs:
        rgba = colour(tifs)
        subprocess.run([str(BIN / "rio"), "pmtiles", str(rgba), str(OUT / "population.pmtiles"), "--format", "PNG", "--zoom-levels", "0..9", "--resampling", "average", "-j", "4"], check=True)
    names = {"KEN": "kenya", "NGA": "nigeria", "ETH": "ethiopia", "SDN": "sudan", "NPL": "nepal", "GHA": "ghana"}
    points("health-facilities", [f"{names.get(i, i.lower())}-healthsites" for i in isos], "facilities")
    points("settlements", [f"hotosm_{i.lower()}_populated_places" for i in isos], "settlements")


if __name__ == "__main__":
    main([a.upper() for a in sys.argv[1:]] or ["KEN"])
