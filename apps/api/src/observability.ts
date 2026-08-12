import * as Sentry from "@sentry/node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metrics = new Registry();
collectDefaultMetrics({ register: metrics, prefix: "donordesk_" });

export const httpRequests = new Counter({
  name: "donordesk_http_requests_total",
  help: "HTTP requests by route, method, and status",
  labelNames: ["route", "method", "status"] as const,
  registers: [metrics],
});

export const httpDuration = new Histogram({
  name: "donordesk_http_request_duration_seconds",
  help: "HTTP request duration by route and method",
  labelNames: ["route", "method"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metrics],
});

let sdk: NodeSDK | undefined;
let initialized = false;

export function initializeObservability(): void {
  if (initialized) return;
  initialized = true;
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });
  }

  if (process.env.OTEL_ENABLED === "true") {
    sdk = new NodeSDK({
      serviceName: "donordesk-api",
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces",
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
  }
}

export async function shutdownObservability(): Promise<void> {
  await sdk?.shutdown();
}

export function captureException(error: unknown): void {
  if (process.env.SENTRY_DSN) Sentry.captureException(error);
}
