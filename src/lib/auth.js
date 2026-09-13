// Shared auth helpers for the admin panel.
// Uses the Web Crypto API (SubtleCrypto), which is available natively
// in the Cloudflare Workers / Cloudflare Worker runtime — no extra deps.

const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

// ---------- password hashing (PBKDF2-SHA256) ----------
export async function hashPassword(password, saltHex) {
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(bits);
}

export function randomSaltHex() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toHex(salt);
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const computed = await hashPassword(password, saltHex);
  return computed === expectedHashHex;
}

// ---------- signed session tokens (HMAC-SHA256) ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(payload, secret, expiresInSeconds = 60 * 60 * 12) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const bodyStr = b64urlEncode(JSON.stringify(body));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
  const sigStr = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
  return `${bodyStr}.${sigStr}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [bodyStr, sigStr] = token.split(".");
  const key = await hmacKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
  const expectedSigStr = b64urlEncode(String.fromCharCode(...new Uint8Array(expectedSig)));
  if (expectedSigStr !== sigStr) return null;
  try {
    const payload = JSON.parse(b64urlDecode(bodyStr));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- cookie helpers ----------
export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token, maxAgeSeconds = 60 * 60 * 12) {
  return `session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader() {
  return `session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}
