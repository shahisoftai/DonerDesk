import type * as ML from "maplibre-gl";
import { makePin, type Pin } from "../../domain/marking/pin.ts";
import type { BasemapSource } from "../../ports/basemap-source.ts";
import type { HowPlaced, PinPlacer, PinPlacerOptions } from "../../ports/pin-placer.ts";
import { openMap } from "./base-map.ts";

/**
 * The MapLibre implementation of `PinPlacer`: click drops the pin, dragging the marker moves it. Whatever it reports has been through
 * `makePin` (rounded to about a metre, longitude wrapped), so the form never receives a value the domain would refuse.
 */
export class MapLibrePinPlacer implements PinPlacer {
  private readonly lib: typeof import("maplibre-gl");
  private readonly map: ML.Map;
  private marker: ML.Marker | null = null;
  private handler: (pin: Pin, how: HowPlaced) => void = () => {};

  private constructor(lib: typeof import("maplibre-gl"), map: ML.Map) {
    this.lib = lib;
    this.map = map;
  }

  static async create(container: HTMLElement, options: PinPlacerOptions, basemap: BasemapSource): Promise<MapLibrePinPlacer> {
    const { lib, map } = await openMap(container, options, basemap);
    const placer = new MapLibrePinPlacer(lib, map);
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", (e) => placer.report(e.lngLat.lat, e.lngLat.lng, "CLICK"));
    return placer;
  }

  setPin(pin: Pin | null): void {
    if (!pin) { this.marker?.remove(); this.marker = null; return; }
    if (!this.marker) {
      this.marker = new this.lib.Marker({ draggable: true, color: "#dc2626" }).setLngLat([pin.longitude, pin.latitude]).addTo(this.map);
      this.marker.on("dragend", () => { const at = this.marker?.getLngLat(); if (at) this.report(at.lat, at.lng, "DRAG"); });
    } else this.marker.setLngLat([pin.longitude, pin.latitude]);
    // A pin typed or fetched off screen brings the view to it; one the person just dropped is already in view.
    if (!this.map.getBounds().contains([pin.longitude, pin.latitude])) this.map.easeTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(this.map.getZoom(), 12), duration: 300 });
  }

  onPlace(handler: (pin: Pin, how: HowPlaced) => void): void { this.handler = handler; }

  dispose(): void {
    this.marker?.remove();
    this.map.remove();
  }

  private report(latitude: number, longitude: number, how: HowPlaced): void {
    const made = makePin(latitude, longitude, { wrap: true });
    if (made.ok) this.handler(made.pin, how);
  }
}
