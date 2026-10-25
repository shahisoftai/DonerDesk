/**
 * Forgiving JSON parsing for model replies. A reasoning-capable model can spend part of its
 * token budget on hidden reasoning before it writes the JSON itself, so a reply is sometimes cut
 * off mid-string or mid-structure when the output budget runs out; some providers also emit a raw
 * (unescaped) control character inside a string value, which strict JSON forbids. `tryParseJson`
 * tries a direct parse first, then repairs each of those two faults in turn and retries, so a
 * truncated or lightly malformed reply still yields a best-effort object instead of nothing. It
 * never invents content: repair only closes what the model already opened.
 */

/** Escapes a literal (unescaped) ASCII control character found inside a JSON string literal. */
export function repairUnescapedControlChars(text: string): string {
  let repaired = false;
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n" || ch === "\r" || ch === "\t" || ch === "\f" || ch === "\b") {
        const hex = ch.charCodeAt(0).toString(16).padStart(4, "0");
        out += `\\u${hex}`;
        repaired = true;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return repaired ? out : text;
}

/**
 * Closes a JSON document truncated by the output token limit: walks the text tracking string and
 * structure state, then appends whatever quote/brace/bracket closers are still open. Returns null
 * when there is nothing to close (the text is already balanced, or empty).
 */
export function completeTruncatedJson(text: string): string | null {
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch as "{" | "[");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let suffix = "";
  if (inString) suffix += '"';
  while (stack.length > 0) suffix += stack.pop() === "{" ? "}" : "]";
  return suffix ? text + suffix : null;
}

/** Direct parse, then control-char repair, then truncation repair; undefined only if none of those yields valid JSON. */
export function tryParseJson(text: string): unknown {
  const attempt = (candidate: string): { ok: true; value: unknown } | undefined => {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      return undefined;
    }
  };
  const direct = attempt(text);
  if (direct) return direct.value;
  const unescaped = repairUnescapedControlChars(text);
  if (unescaped !== text) {
    const retry = attempt(unescaped);
    if (retry) return retry.value;
  }
  const completed = completeTruncatedJson(unescaped);
  if (completed !== null) {
    const retry = attempt(completed);
    if (retry) return retry.value;
  }
  return undefined;
}
