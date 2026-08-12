#!/usr/bin/env node
// Dev-only helper: performs a real OIDC Authorization Code + PKCE login against the
// local Keycloak realm and prints the resulting access token. Used for Phase 0
// runtime acceptance evidence.
import { createHash, randomBytes } from "node:crypto";

const issuer = process.env.OIDC_ISSUER ?? "http://localhost:8081/realms/donordesk";
const clientId = process.env.OIDC_CLIENT_ID ?? "donordesk-web";
const redirectUri = process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";
const username = process.env.OIDC_TEST_USERNAME ?? "admin@example.org";
const password = process.env.OIDC_TEST_PASSWORD ?? "password123";

const base64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = base64url(randomBytes(32));
const challenge = base64url(createHash("sha256").update(verifier).digest());
const state = base64url(randomBytes(16));

const discovery = await (await fetch(`${issuer}/.well-known/openid-configuration`)).json();

const authorizeUrl = new URL(discovery.authorization_endpoint);
authorizeUrl.searchParams.set("client_id", clientId);
authorizeUrl.searchParams.set("redirect_uri", redirectUri);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("scope", "openid profile email");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("code_challenge", challenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

const loginPage = await fetch(authorizeUrl, { redirect: "manual" });
const cookies = (loginPage.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .join("; ");
const html = await loginPage.text();
const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
if (!action) throw new Error("Could not locate Keycloak login form action");

const submission = await fetch(action, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies },
  body: new URLSearchParams({ username, password, credentialId: "" }).toString(),
});

const location = submission.headers.get("location");
if (!location) throw new Error(`Login did not redirect (status ${submission.status})`);
const code = new URL(location).searchParams.get("code");
if (!code) throw new Error(`No authorization code in redirect: ${location}`);

const tokenResponse = await fetch(discovery.token_endpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  }).toString(),
});

const tokens = await tokenResponse.json();
if (!tokens.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);
process.stdout.write(tokens.access_token);
