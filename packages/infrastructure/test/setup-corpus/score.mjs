// Field-level scoring of one reading against a person's labels (extraction audit E1). A label set is
// GOLDEN = { facts: { name: "..." }, lists: { places: { key: "name", items: [{ name: "Baidoa" }] } } }; a null label means the
// document leaves it blank. The headline is `wrongShown`: a value shown as if read that differs from the document.
const norm = (x) => String(x ?? "").toLowerCase().replace(/[\s,]+/g, " ").trim();
const val = (i) => (i && typeof i === "object" && "value" in i ? i.value : i);

export function scoreReading(golden, reading) {
  const score = { correct: 0, wrongShown: 0, missed: 0, invented: 0, details: [] };
  const note = (kind, what) => { score[kind] += 1; score.details.push(`${kind}: ${what}`); };
  for (const [key, want] of Object.entries(golden.facts ?? {})) {
    const raw = val(reading.facts?.[key]);
    const got = Array.isArray(raw) ? raw.join(" ") : raw;
    if (want === null) { if (got) note("invented", `facts.${key}=${got}`); else score.correct += 1; }
    else if (!got) note("missed", `facts.${key}`);
    else if (norm(got) === norm(want)) score.correct += 1;
    else note("wrongShown", `facts.${key}: ${got} (label ${want})`);
  }
  for (const [field, { key, items }] of Object.entries(golden.lists ?? {})) {
    const read = (reading[field] ?? []).map(val);
    const used = new Set();
    for (const want of items) {
      const at = read.findIndex((r, i) => !used.has(i) && norm(r?.[key]) === norm(want[key]));
      if (at < 0) { note("missed", `${field}: ${want[key]}`); continue; }
      used.add(at);
      const wrong = Object.keys(want).filter((k) => k !== key && norm(read[at]?.[k]) !== norm(want[k]));
      if (wrong.length > 0) note("wrongShown", `${field}: ${want[key]}: ${wrong.join(", ")}`); else score.correct += 1;
    }
    read.forEach((r, i) => { if (!used.has(i)) note("invented", `${field}: ${r?.[key]}`); });
  }
  return score;
}
