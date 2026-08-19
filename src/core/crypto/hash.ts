import { hash } from "@stablelib/sha256";

import { arrayToBase64 } from "../utils/utilities";

import { sha3_512 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// ─── Hashing ───────────────────────────────

export function sha256(input: string): string {
  const hashed = hash(new TextEncoder().encode(input));
  return arrayToBase64(hashed);
}

export function sha512(input: string): string {
  const hashed = sha3_512(new TextEncoder().encode(input));
  return bytesToHex(hashed);
}
