#!/usr/bin/env bash
# Gated (Phase E): stage a pinned Kestra as a native service on Contabo.
#
# Requirements (run first):
#   - infra/kestra/setup-kestra-db.sh  (creates donordesk_kestra role + db)
#   - kestra.application.yml + donordesk-kestra.service staged on the host
#   - /opt/donordesk/shared/kestra.env (mode 0600) with KESTRA_ADMIN_PASSWORD / KESTRA_DB_PASSWORD
#
# This stages the binary and unit but does NOT enable the service: first
# load-test the JVM/resource impact on the shared host (contabo-ops §3/§15).
set -euo pipefail

KESTRA_VERSION="${KESTRA_VERSION:?KESTRA_VERSION must be pinned (e.g. 0.20.x-lts, not latest)}"
KESTRA_DIR="${KESTRA_DIR:-/opt/donordesk/kestra}"
SRC_DIR="${SRC_DIR:?SRC_DIR must point to the staged repo files (infra/kestra, infra/systemd)}"
KESTRA_URL="${KESTRA_URL:-https://github.com/kestra-io/kestra/releases/download/v${KESTRA_VERSION}/kestra-${KESTRA_VERSION}.zip}"

id donordesk_kestra >/dev/null 2>&1 || useradd --system --home "${KESTRA_DIR}" --shell /usr/sbin/nologin donordesk_kestra
mkdir -p "${KESTRA_DIR}/storage"
mkdir -p "${KESTRA_DIR}/plugins"

cd "${KESTRA_DIR}"
curl -fsSL -o kestra.zip "${KESTRA_URL}"
unzip -oq kestra.zip
rm -f kestra.zip

install -o donordesk_kestra -g donordesk_kestra -m 0640 "${SRC_DIR}/infra/kestra/kestra.application.yml" "${KESTRA_DIR}/kestra.application.yml"
install -o root -g root -m 0644 "${SRC_DIR}/infra/systemd/donordesk-kestra.service" /etc/systemd/system/donordesk-kestra.service
chown -R donordesk_kestra:donordesk_kestra "${KESTRA_DIR}"
systemctl daemon-reload

# Stage the pinned free plugins (Tika, Redis, JDBC-Postgres, GDrive, SFTP) from
# the manifest into ${KESTRA_DIR}/plugins. Kestra's server is passed this dir via
# --plugins (donordesk-kestra.service). Version-gated; see plugins.manifest.tsv.
PLUGINS_DIR="${KESTRA_DIR}/plugins" bash "${SRC_DIR}/infra/kestra/install-plugins.sh"

echo "Kestra ${KESTRA_VERSION} staged under ${KESTRA_DIR}."
echo "Before first start, run as donordesk_kestra with kestra.env loaded:"
echo "  ${KESTRA_DIR}/kestra-${KESTRA_VERSION} sys database migrate --config=${KESTRA_DIR}/.kestra/config.yml"
echo "Plugins are staged under ${KESTRA_DIR}/plugins; pass it to the server via --plugins."
echo "Then load-test JVM impact and: systemctl enable --now donordesk-kestra"
echo "Verify: curl -fsS http://127.0.0.1:8093/api/v1/configs"
