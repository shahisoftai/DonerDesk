/** A redirect with a relative address. Behind the proxy the request's own address is the internal one, so a redirect built from it would send the browser there. */
export const relativeRedirect = (location: string): Response => new Response(null, { status: 307, headers: { location, "cache-control": "private, no-store" } });
