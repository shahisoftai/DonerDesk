"use client";

import { useState } from "react";

export function Login() {
  const [email, setEmail] = useState("mnpiracha@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/control/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.title || "Invalid credentials");
      location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Login failed"); setBusy(false); }
  }

  return <main className="shell"><section className="login"><div className="brand">DonorDesk SuperAdmin</div><p className="muted">Secure platform control plane · SUPER_ADMIN only</p><div className="form"><input aria-label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} /><input aria-label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => event.key === "Enter" && void login()} /><button className="primary" disabled={busy} onClick={login}>{busy ? "Signing in…" : "Sign in securely"}</button></div>{error && <p className="error">{error}</p>}</section></main>;
}
