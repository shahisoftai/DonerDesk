/**
 * Runs work after a handler has answered (e.g. drafting sections). Injected
 * so the api can keep the request's database client open until the work is
 * done, and so tests can await it.
 */
export type BackgroundRunner = (task: () => Promise<void>) => void;

export const fireAndForget: BackgroundRunner = (task) => {
  void task();
};
