/** The wizard asks whether a project code is free; here the page decides which codes are taken (window.__takenCodes). */
export async function checkProjectCodeAction(code: string): Promise<boolean> {
  const taken = ((globalThis as unknown as { __takenCodes?: string[] }).__takenCodes) ?? [];
  return !taken.includes(code.trim());
}
