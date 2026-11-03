/**
 * Pins: the rules for a point a person puts on the map. Pure.
 * A pin is both coordinates or none, in range, rounded to about a metre. A map click past the date line is wrapped back
 * into range; a typed value out of range is refused with a sentence, never silently corrected.
 */
export interface Pin { latitude: number; longitude: number }

/** How a pin came to be: shown in the audit trail and used to judge how exact it is. */
export type PlacedBy = "MAP_PIN" | "GPS" | "TYPED";

export const PIN_DIGITS = 5;
export const MAX_HISTORY = 50;
/** A phone fix worse than this is said to be rough, never refused. */
export const VAGUE_GPS_METRES = 100;

export const PIN_PROBLEMS = ["NOT_A_NUMBER", "LATITUDE_RANGE", "LONGITUDE_RANGE", "ONE_MISSING"] as const;
export type PinProblem = (typeof PIN_PROBLEMS)[number];
export type PinResult = { ok: true; pin: Pin } | { ok: false; problem: PinProblem };

const round = (n: number): number => { const f = 10 ** PIN_DIGITS; return Math.round(n * f) / f; };
/** A click on a repeated copy of the world gives a longitude past 180; bring it back. */
export const wrapLongitude = (lng: number): number => ((((lng + 180) % 360) + 360) % 360) - 180;

export function makePin(latitude: number, longitude: number, options: { wrap?: boolean } = {}): PinResult {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ok: false, problem: "NOT_A_NUMBER" };
  const lng = options.wrap ? wrapLongitude(longitude) : longitude;
  if (latitude < -90 || latitude > 90) return { ok: false, problem: "LATITUDE_RANGE" };
  if (lng < -180 || lng > 180) return { ok: false, problem: "LONGITUDE_RANGE" };
  return { ok: true, pin: { latitude: round(latitude), longitude: round(lng) } };
}

/** Two text boxes to a pin: both empty is "no pin" (null), one empty is a problem, anything else is read as a number. */
export function parsePin(latitudeText: string, longitudeText: string): PinResult | null {
  const lat = latitudeText.trim().replace(",", "."), lng = longitudeText.trim().replace(",", ".");
  if (lat === "" && lng === "") return null;
  if (lat === "" || lng === "") return { ok: false, problem: "ONE_MISSING" };
  return makePin(Number(lat), Number(lng));
}

export const formatPin = (pin: Pin): string => `${pin.latitude.toFixed(PIN_DIGITS)}, ${pin.longitude.toFixed(PIN_DIGITS)}`;
export const samePin = (a: Pin | null, b: Pin | null): boolean => (a === null || b === null ? a === b : a.latitude === b.latitude && a.longitude === b.longitude);

export type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";
const METRES_PER_DEGREE = 111_320;

/** Moves a pin by `metres` for a keyboard or button nudge; the result stays in range. */
export function nudge(pin: Pin, direction: Direction, metres = 10): Pin {
  const dLat = metres / METRES_PER_DEGREE;
  const dLng = metres / (METRES_PER_DEGREE * Math.max(0.01, Math.cos((pin.latitude * Math.PI) / 180)));
  const next = direction === "NORTH" ? { latitude: pin.latitude + dLat, longitude: pin.longitude }
    : direction === "SOUTH" ? { latitude: pin.latitude - dLat, longitude: pin.longitude }
    : direction === "EAST" ? { latitude: pin.latitude, longitude: pin.longitude + dLng }
    : { latitude: pin.latitude, longitude: pin.longitude - dLng };
  const made = makePin(Math.max(-90, Math.min(90, next.latitude)), next.longitude, { wrap: true });
  return made.ok ? made.pin : pin;
}

// ---- undo -----------------------------------------------------------------------------------------------

export interface PinHistory { past: ReadonlyArray<Pin | null>; present: Pin | null }
export const startHistory = (pin: Pin | null): PinHistory => ({ past: [], present: pin });

/** A change that leaves the pin where it was is not a step. */
export function record(history: PinHistory, next: Pin | null): PinHistory {
  if (samePin(history.present, next)) return history;
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present: next };
}
export const canUndo = (history: PinHistory): boolean => history.past.length > 0;
export function undo(history: PinHistory): PinHistory {
  if (!canUndo(history)) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1]! };
}

// ---- the phone's own fix -------------------------------------------------------------------------------

export interface GpsReading { latitude: number; longitude: number; accuracy?: number | undefined }
export type GpsOutcome = { ok: true; pin: Pin; accuracyMetres: number | null; vague: boolean } | { ok: false; problem: PinProblem };

export function fromGps(reading: GpsReading): GpsOutcome {
  const made = makePin(reading.latitude, reading.longitude);
  if (!made.ok) return made;
  const accuracy = reading.accuracy !== undefined && Number.isFinite(reading.accuracy) ? Math.round(reading.accuracy) : null;
  return { ok: true, pin: made.pin, accuracyMetres: accuracy, vague: accuracy !== null && accuracy > VAGUE_GPS_METRES };
}

export const GPS_FAILURES = ["DENIED", "UNAVAILABLE", "TIMEOUT", "UNSUPPORTED"] as const;
export type GpsFailure = (typeof GPS_FAILURES)[number];
/** The browser's numeric error code (1 denied, 2 unavailable, 3 timeout) to a failure. The words are in the catalogue (`maps.pin.gps.<code>`). */
export const gpsFailureFor = (code: number | undefined): GpsFailure => (code === 1 ? "DENIED" : code === 3 ? "TIMEOUT" : "UNAVAILABLE");
