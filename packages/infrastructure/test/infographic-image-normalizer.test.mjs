import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { SharpImageNormalizer } from "../dist/infographics/image-normalizer.js";

const normalizer = new SharpImageNormalizer();
const raw = (w, h, channels = 3) => ({ create: { width: w, height: h, channels, background: { r: 30, g: 120, b: 200, alpha: 1 } } });

test("a JPEG keeps its type, loses its metadata (camera, copyright, GPS block) and is bounded", async () => {
  const tagged = await sharp(raw(3000, 1500)).jpeg().withExif({ IFD0: { Copyright: "Secret Author", Make: "CameraCo" }, IFD3: { GPSLatitudeRef: "N" } }).toBuffer();
  assert.equal((await sharp(tagged).metadata()).exif !== undefined, true, "the fixture really carries EXIF");
  const out = await normalizer.normalize(tagged, { maxEdge: 1000 });
  assert.equal(out.ok, true);
  assert.equal(out.value.contentType, "image/jpeg");
  assert.deepEqual([out.value.width, out.value.height], [1000, 500]);
  const meta = await sharp(out.value.bytes).metadata();
  assert.equal(meta.exif, undefined, "no EXIF survives the re-encode");
  assert.equal(out.value.bytes.includes(Buffer.from("Secret Author")), false);
  assert.equal(out.value.bytes.includes(Buffer.from("CameraCo")), false);
});

test("a small PNG keeps its type and is never enlarged; transparency survives", async () => {
  const png = await sharp(raw(120, 80, 4)).png().toBuffer();
  const out = await normalizer.normalize(png);
  assert.equal(out.ok, true);
  assert.equal(out.value.contentType, "image/png");
  assert.deepEqual([out.value.width, out.value.height], [120, 80]);
  assert.equal((await sharp(out.value.bytes).metadata()).hasAlpha, true);
});

test("the camera's rotation is applied, then dropped", async () => {
  const rotated = await sharp(raw(200, 100)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.equal((await sharp(rotated).metadata()).orientation, 6, "the fixture carries an orientation");
  const out = await normalizer.normalize(rotated);
  assert.deepEqual([out.value.width, out.value.height], [100, 200], "a portrait photo stays portrait");
});

test("anything that is not a PNG or JPEG is refused: SVG (scripts), GIF, text, and a disguised file", async () => {
  for (const [name, bytes] of [
    ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["gif", await sharp(raw(10, 10)).gif().toBuffer()],
    ["text", Buffer.from("not a picture")],
    ["empty", Buffer.alloc(0)],
    ["truncated", (await sharp(raw(500, 500)).png().toBuffer()).subarray(0, 60)],
  ]) {
    const out = await normalizer.normalize(bytes);
    assert.equal(out.ok, false, name);
    assert.equal(out.error.code, "VALIDATION_FAILED", name);
  }
});

test("a decompression bomb is refused before it is decoded", async () => {
  const header = await sharp(raw(9000, 9000, 3)).png({ compressionLevel: 9 }).toBuffer();
  const out = await normalizer.normalize(header);
  assert.equal(out.ok, false, "81 million pixels is over the limit");
});
