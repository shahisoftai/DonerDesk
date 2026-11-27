import type { AnalyticsParams } from "../domain/events.ts";
import type { AnalyticsPort } from "../ports/analytics-port.ts";

type Gtag = (...args: unknown[]) => void;
interface TagWindow {
  dataLayer?: unknown[];
  gtag?: Gtag;
  location: { origin: string; hostname: string; pathname: string };
  [key: string]: unknown;
}
interface TagDocument {
  cookie: string;
  title: string;
  referrer: string;
  createElement(tag: "script"): { async: boolean; src: string };
  head: { appendChild(node: unknown): unknown };
  querySelector(selector: string): unknown;
}

const FLUSH_WAIT_MS = 500;

/**
 * Google Analytics 4 through gtag.js. This is the only file that knows about Google's tag: every other file talks to
 * AnalyticsPort. No advertising features are switched on, and nothing is loaded until start() is called.
 */
export class GoogleTagAdapter implements AnalyticsPort {
  private started = false;
  private readonly measurementId: string;
  private readonly win: TagWindow;
  private readonly doc: TagDocument;

  constructor(measurementId: string, win: TagWindow, doc: TagDocument) {
    this.measurementId = measurementId;
    this.win = win;
    this.doc = doc;
  }

  start(): void {
    this.win[`ga-disable-${this.measurementId}`] = false;
    if (this.started) return;
    this.started = true;
    this.win.dataLayer = this.win.dataLayer ?? [];
    // gtag.js only understands queue entries that are `arguments` objects, not arrays, so this must be a plain function.
    const layer = this.win.dataLayer;
    this.win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
    this.win.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    this.win.gtag("js", new Date());
    this.win.gtag("config", this.measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...this.where(this.win.location.pathname) });
    if (!this.doc.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      const script = this.doc.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
      this.doc.head.appendChild(script);
    }
  }

  stop(): void {
    this.win[`ga-disable-${this.measurementId}`] = true;
    const host = this.win.location.hostname;
    const domains = ["", `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, "")}`];
    for (const name of this.doc.cookie.split(";").map((c) => c.split("=")[0]!.trim()).filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid")) {
      for (const domain of domains) this.doc.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }

  pageView(path: string): void {
    if (!this.started || !this.win.gtag) return;
    // `set` makes the clean address apply to every later event too, including the ones Google measures by itself
    // (scrolls, outbound clicks), so a query string in the address bar never reaches Google.
    this.win.gtag("set", this.where(path));
    this.win.gtag("event", "page_view");
  }

  /** The address and title Google is told: the path only, and the referrer without its query. */
  private where(path: string): Record<string, string> {
    return { page_path: path, page_location: `${this.win.location.origin}${path}`, page_title: this.doc.title, page_referrer: this.cleanReferrer() };
  }

  private cleanReferrer(): string {
    try {
      const url = new URL(this.doc.referrer);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  }

  event(name: string, params: AnalyticsParams = {}): Promise<void> {
    if (!this.started || !this.win.gtag) return Promise.resolve();
    const gtag = this.win.gtag;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, FLUSH_WAIT_MS);
      gtag("event", name, { ...params, event_callback: () => { clearTimeout(timer); resolve(); } });
    });
  }
}
