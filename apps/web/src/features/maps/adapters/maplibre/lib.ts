/** Loads MapLibre and the PMTiles protocol once, however many maps a page opens. Only adapters import these libraries. */
type Lib = typeof import("maplibre-gl");
type PmtilesModule = typeof import("pmtiles");
type Protocol = InstanceType<PmtilesModule["Protocol"]>;

let loading: Promise<Lib> | undefined;
let pmtiles: Promise<{ mod: PmtilesModule; protocol: Protocol }> | undefined;
const warmed = new Set<string>();

/**
 * MapLibre 5 exports everything under `default` (a dynamic import gives `{ default }`), and some bundlers also spread the names onto the
 * namespace. Take `default` when it is there, so the map starts under either, not only under the bundler this was first tried with.
 */
const unwrap = (mod: Lib): Lib => ((mod as unknown as { default?: Lib }).default ?? mod);

/** The PMTiles reader and the one protocol every map shares, so a header read early (`warmPmtiles`) is the header the map uses. */
function loadPmtiles(): Promise<{ mod: PmtilesModule; protocol: Protocol }> {
  return (pmtiles ??= import("pmtiles").then((mod) => ({ mod, protocol: new mod.Protocol() })));
}

/**
 * Reads a basemap file's header and root directory now, while MapLibre itself is still downloading (Phase 49.1): the two used to happen one
 * after the other. Registered with the shared protocol, so the map reuses the same reader and its cache. Never throws.
 */
export function warmPmtiles(absoluteUrl: string): void {
  if (warmed.has(absoluteUrl)) return;
  warmed.add(absoluteUrl);
  void loadPmtiles().then(({ mod, protocol }) => {
    const archive = new mod.PMTiles(absoluteUrl);
    protocol.add(archive);
    return archive.getHeader();
  }).catch(() => warmed.delete(absoluteUrl));
}

export function loadMapLibre(): Promise<Lib> {
  return (loading ??= Promise.all([import("maplibre-gl"), loadPmtiles()]).then(([mod, { protocol }]) => {
    const lib = unwrap(mod);
    lib.addProtocol("pmtiles", protocol.tile);
    // Arabic labels need MapLibre's right-to-left text plugin. Ours, from our own host; lazy, so it is fetched only when such text is first drawn.
    void lib.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.js", true).catch(() => undefined);
    return lib;
  }));
}
