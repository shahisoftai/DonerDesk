/** Hands a text file to the browser as a download (client only). */
export function downloadTextFile(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  // A leading BOM makes Excel read UTF-8 (names with accents) correctly.
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
