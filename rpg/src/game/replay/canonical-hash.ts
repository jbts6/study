import canonicalize from "canonicalize";

function assertCanonicalInput(value: unknown, seen = new Set<object>()): void {
  if (value === undefined || typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("Hash input is not canonical JSON");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Hash input contains NaN or Infinity");
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new TypeError("Hash input contains a circular reference");

  seen.add(value);
  try {
    const toJson = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJson === "function") {
      assertCanonicalInput(toJson.call(value), seen);
      return;
    }
    for (const nested of Object.values(value)) assertCanonicalInput(nested, seen);
  } finally {
    seen.delete(value);
  }
}

/** Returns the SHA-256 digest of a JSON Canonicalization Scheme value. */
export async function canonicalSha256(value: unknown): Promise<string> {
  assertCanonicalInput(value);
  const text = canonicalize(value);
  if (text === undefined) throw new TypeError("Cannot canonicalize hash input");

  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hexadecimal = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hexadecimal}`;
}
