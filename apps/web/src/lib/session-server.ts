import { cookies } from "next/headers";

const COOKIE = "dd_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}
