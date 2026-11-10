#!/usr/bin/env bash
# Builds the self-hosted context layers and population grids (Phase 49.6/49.7): see build_context_layers.py.
#   PYTHON=/path/to/python-with-rasterio scripts/maps/build-context-layers.sh KEN NGA
# That python needs rasterio, pyogrio, numpy and rio-pmtiles (for example: uv venv /tmp/gdalenv && uv pip install --python
# /tmp/gdalenv/bin/python rasterio pyogrio numpy geopandas rio-pmtiles); tippecanoe must be on PATH.
set -euo pipefail
exec "${PYTHON:-python3}" "$(dirname "${BASH_SOURCE[0]}")/build_context_layers.py" "$@"
