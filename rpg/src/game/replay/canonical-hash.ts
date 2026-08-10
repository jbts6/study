import canonicalize from "canonicalize";

/** Returns the SHA-256 digest of a JSON Canonicalization Scheme value. */
export async function canonicalSha256(value: unknown): Promise<string> {
  const text = canonicalize(value);
  if (text === undefined) throw new TypeError("Cannot canonicalize hash input");

  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hexadecimal = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hexadecimal}`;
}
