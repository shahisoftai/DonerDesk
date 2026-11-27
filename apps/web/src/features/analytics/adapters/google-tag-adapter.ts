import type { AnalyticsParams } from "../domain/events.ts";
import type { AnalyticsPort } from "../ports/analytics-port.ts";

type Gtag = (...args: unknown[]) => void;
interface TagWindow {
  dataLayer?: unknown[];
  gtag?: Gtag;
  location: { hostname: string };
  [key: string]: unknown;
}
interface TagDocument {
  cookie: string;
  title: string;
  createElement(tag: "script"): { async: boolean; src: string };
  head: { appendChild(node: unknown): unknown };
  querySelector(selector: string): unknown;
}

const FLUSH_WAIT_MS = 500;

/**
 * Google Analytics 4 through gtag.js. This is the only file that knows about Google's tag: every other file talks to
 * AnalyticsPort. No advertising features are switched on, and nothing is loaded until start() is called. Page views are
 * Google's own automatic ones (the stream's enhanced measurement, which also follows in-app navigation); this class only
 * decides whether the tag may send.
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
    this.win.gtag("config", this.measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    if (!this.doc.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      const script = this.doc.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
      this.doc.head.appendChild(script);
    }
  }

  pause(): void {
    this.win[`ga-disable-${this.measurementId}`] = true;
  }

  stop(): void {
    this.pause();
    const host = this.win.location.hostname;
    const domains = ["", `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, "")}`];
    for (const name of this.doc.cookie.split(";").map((c) => c.split("=")[0]!.trim()).filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid")) {
      for (const domain of domains) this.doc.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
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
