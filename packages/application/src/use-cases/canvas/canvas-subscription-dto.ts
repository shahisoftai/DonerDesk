import type { StoredCanvasSubscription, SubscriptionEvery } from "../../ports/canvas-subscriptions.js";

/**
 * A person's own email subscriptions to canvases (Phase 48.16). Subscribing needs the right to see the canvas; what is sent is a short
 * note with the canvas's title and a link, never a figure, and a person who can no longer see the canvas is sent nothing. No handler
 * takes a user id: it is always the caller's.
 */
export interface CanvasSubscriptionDto { canvasId: string; every: SubscriptionEvery }
export const subscriptionDto = (s: StoredCanvasSubscription): CanvasSubscriptionDto => ({ canvasId: s.canvasId, every: s.every });
export const SUBSCRIPTION_CHOICES: readonly SubscriptionEvery[] = ["WEEKLY", "MONTHLY"];
