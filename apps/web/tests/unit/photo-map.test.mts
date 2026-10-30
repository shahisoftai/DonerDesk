import test from "node:test";
import assert from "node:assert/strict";
import { isPhoto, photoMapData, photoMapSummary, photoPoints, type PhotoInput } from "../../src/features/maps/domain/photo-map.ts";

const ph = (id: string, location: string | undefined, o: Partial<PhotoInput> = {}): PhotoInput => ({ id, title: `Photo ${id}`, fileName: `${id}.jpg`, fileType: "image/jpeg", fileUrl: `/v1/files/t/${id}.jpg`, location, ...o });
const PLACES = [{ name: "Um Gargur Camp", aliases: ["Um Gargur"], latitude: 13.2, longitude: 32.7 }, { name: "No Pin Village", aliases: [] }, { name: "Retired", aliases: [], latitude: 1, longitude: 1, archived: true }];

test("only images count; a photo goes where the places list says first, then the bundled gazetteer; the rest is said", () => {
  const d = photoMapData([ph("1", "um gargur"), ph("2", "Um Gargur Camp"), ph("3", "Addis Ababa", { fileType: "image/png" }), ph("4", "Zzzz Nowhere"), ph("5", undefined), ph("6", "No Pin Village"), { ...ph("7", "Addis Ababa"), fileType: "application/pdf" }], PLACES, "Ethiopia");
  assert.equal(d.total, 6, "the PDF is not a photo");
  assert.deepEqual(d.sites.map((s) => [s.name, s.photos.length]), [["Um Gargur Camp", 2], ["Addis Ababa", 1]]);
  assert.deepEqual(d.unplaced.map((p) => p.id), ["4", "6"], "a place with no pin is not guessed at");
  assert.equal(d.withoutLocation, 1);
  assert.match(photoMapSummary(d), /3 of 6 photos are on the map, at 2 places\. 2 have locations no place matches\. 1 has no location written\./);
});

test("a retired place is not used, an empty set says so, and the dots carry the photos", () => {
  assert.equal(photoMapData([ph("1", "Retired")], PLACES).sites.length, 0);
  assert.match(photoMapSummary(photoMapData([], [])), /No photos/);
  const pts = photoPoints(photoMapData([ph("1", "Um Gargur"), ph("2", "Um Gargur")], PLACES));
  assert.deepEqual([pts.length, pts[0]!.items.length, pts[0]!.items[0]!.label], [1, 2, "photo"]);
  assert.equal(isPhoto({ fileType: "IMAGE/JPEG" }), true);
});
