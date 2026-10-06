/** What a create action accepts beyond its input: the key that makes the creation repeatable. */
export type CreateOptions = { idempotencyKey?: string };

/** The gateway option for a create action; nothing when the caller sent no key (behaviour is then as before). */
export function idempotency(options: CreateOptions): { idempotencyKey?: string } {
  return options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {};
}
