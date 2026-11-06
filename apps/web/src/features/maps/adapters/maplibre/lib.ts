/** Loads MapLibre and the PMTiles protocol once, however many maps a page opens. Only adapters import these libraries. */
type Lib = typeof import("maplibre-gl");

let loading: Promise<Lib> | undefined;

/**
 * MapLibre 5 exports everything under `default` (a dynamic import gives `{ default }`), and some bundlers also spread the names onto the
 * namespace. Take `default` when it is there, so the map starts under either, not only under the bundler this was first tried with.
 */
const unwrap = (mod: Lib): Lib => ((mod as unknown as { default?: Lib }).default ?? mod);

export function loadMapLibre(): Promise<Lib> {
  return (loading ??= Promise.all([import("maplibre-gl"), import("pmtiles")]).then(([mod, { Protocol }]) => {
    const lib = unwrap(mod);
    lib.addProtocol("pmtiles", new Protocol().tile);
    // Arabic labels need MapLibre's right-to-left text plugin. Ours, from our own host; lazy, so it is fetched only when such text is first drawn.
    void lib.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.js", true).catch(() => undefined);
    return lib;
  }));
}
