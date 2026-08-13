#!/usr/bin/env bash
# Install the pinned DonorDesk Kestra plugins (free / Apache-2.0 only).
#
# Kestra loads plugins as JARs placed in the directory passed to the server via
# `--plugins` (see infra/systemd/donordesk-kestra.service). The Kestra image and
# the standalone distribution do NOT ship these plugins, so they are staged here
# from Maven Central at pinned versions from infra/kestra/plugins.manifest.tsv.
#
# Gated: run AFTER Kestra is staged (infra/kestra/install-kestra.sh) and BEFORE
# the first start that needs a plugin-backed flow. Versions in the manifest must
# be verified against the pinned Kestra core before enabling plugin flows.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${MANIFEST:-${SCRIPT_DIR}/plugins.manifest.tsv}"
PLUGINS_DIR="${PLUGINS_DIR:-${KESTRA_DIR:-/opt/donordesk/kestra}/plugins}"
MAVEN_BASE="${MAVEN_BASE:-https://repo1.maven.org/maven2}"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Plugin manifest not found: ${MANIFEST}" >&2
  exit 1
fi

mkdir -p "${PLUGINS_DIR}"

# name group artifact version purpose
while IFS=$'\t' read -r name group artifact version purpose; do
  [[ -z "${name}" || "${name}" =~ ^# ]] && continue
  jar="${artifact}-${version}.jar"
  path="${group//./\/}/${artifact}/${version}/${jar}"
  dest="${PLUGINS_DIR}/${jar}"
  if [[ -f "${dest}" ]]; then
    echo "Present  ${jar}"
    continue
  fi
  echo "Fetch    ${jar}  (${purpose})"
  curl -fsSL -o "${dest}.tmp" "${MAVEN_BASE}/${path}"
  mv "${dest}.tmp" "${dest}"
done < "${MANIFEST}"

echo "Plugins staged in ${PLUGINS_DIR}:"
ls -1 "${PLUGINS_DIR}"
