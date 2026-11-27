/** Hands out a Google access token for some scopes. The only thing the readers know about authentication. */
export interface IAccessTokenProvider {
  token(scopes: readonly string[]): Promise<string>;
}

/** Calls a Google JSON endpoint as the service account and returns the parsed answer, or throws a safe error. */
export interface IGoogleJson {
  post<T>(url: string, body: unknown, scopes: readonly string[]): Promise<T>;
}
