/**
 * Pre-cleans HTML pasted from Word / Google Docs before the editor parses it.
 * The editor schema already drops anything it cannot represent (fonts,
 * colours, images, underline…); this step maps structure onto what the report
 * supports and removes noise the parser would otherwise turn into text:
 *   - h1/h2 → h3 and h5/h6 → h4 (sections only use two heading levels);
 *   - Word conditional comments, <style>/<script>/<meta>, <o:p> and <img>
 *     are removed.
 * Pure string transform; unit-tested.
 */
export function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<\/?o:p\b[^>]*>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<(\/?)h[12](\b[^>]*)?>/gi, "<$1h3>")
    .replace(/<(\/?)h[56](\b[^>]*)?>/gi, "<$1h4>");
}
