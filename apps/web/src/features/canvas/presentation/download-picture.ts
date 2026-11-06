import { renderAllCharts } from "@/features/design/presentation/render-when-seen";

const fileSafe = (s: string): string => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "canvas";

/**
 * A picture of the page as it looks now, made in the browser from what is on the screen, so it shows exactly what this person may see and nothing
 * is sent anywhere. The date is in the file name so a picture is never mistaken for a live view. Charts the page has not drawn yet are drawn first.
 */
export async function downloadPicture(node: HTMLElement | null, name: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!node) return { ok: false, message: "There is nothing on the page to take a picture of." };
  try {
    await renderAllCharts();
    const { toPng } = await import("html-to-image");
    const dark = document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark";
    const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: dark ? "#0f172a" : "#ffffff", filter: (n) => !(n instanceof HTMLElement && n.hasAttribute("data-no-print")) });
    const a = Object.assign(document.createElement("a"), { href: url, download: `${fileSafe(name)}-${new Date().toISOString().slice(0, 10)}.png` });
    document.body.append(a); a.click(); a.remove();
    return { ok: true };
  } catch {
    return { ok: false, message: "The picture could not be made. Use Print and choose Save as PDF instead." };
  }
}
