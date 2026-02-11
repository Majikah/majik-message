import {
  base64Decode,
  base64Encode,
  isSTXExpired,
  secureReverse,
  secureTimecode,
} from "./utils";
import cryptoJS from "crypto-js";

export interface EncodedAPI {
  /** API Key */
  k: string;

  /** API Hash */
  h: string;

  /** STX Timestamp in Base64 */
  s: string;

  /** STX Hash */
  sh: string;

  /** Combined Payload Hash */
  r: string;
}

export class APIKeyManager {
  private API_KEY: string;
  private API_HASH: string;

  constructor(apiKey: string) {
    this.API_KEY = apiKey;
    this.API_HASH = hashString(apiKey);
  }

  /**
   * Initialize a new APIKeyManager instance
   */
  static initialize(apiKey: string): APIKeyManager {
    return new APIKeyManager(apiKey);
  }

  /**
   * Generate a root hash given an STX and this instance’s key/hash
   */
  private generateRootHash(stx: string): string {
    const appendedStrings = appendStrings([
      secureReverse(stx),
      this.API_KEY,
      stx,
      this.API_HASH,
    ]);

    return hashString(appendedStrings);
  }

  /**
   * Validate an encoded API payload
   */
  private static validatePayload(
    payload: EncodedAPI,
    bypassSTXCheck = false,
  ): boolean {
    const { k, h, s, sh, r } = payload;

    if (!k?.trim() || !h?.trim() || !s?.trim() || !sh?.trim() || !r?.trim()) {
      throw new Error("There seems to be a problem with this API Key.");
    }

    // Validate API key hash
    if (hashString(k) !== h) {
      throw new Error("Invalid API hash – mismatch detected.");
    }

    // Validate STX hash
    if (hashString(s) !== sh) {
      throw new Error("Invalid STX hash – mismatch detected.");
    }

    if (!bypassSTXCheck) {
      if (isSTXExpired(s, 90)) {
        throw new Error("Invalid STX – Expired.");
      }
    }

    // Validate root hash

    const appendedRootString = appendStrings([secureReverse(s), k, s, h]);
    const rootHashCheck = hashString(appendedRootString);

    if (rootHashCheck !== r) {
      throw new Error("Invalid root hash – tampering detected.");
    }

    return true;
  }

  /**
   * Encodes the current instance into a base64 string
   */
  encodeAPI(): string {
    const stx = secureTimecode();
    const rootHash = this.generateRootHash(stx);
    const payload: EncodedAPI = {
      k: this.API_KEY,
      h: this.API_HASH,
      s: stx,
      sh: hashString(stx),
      r: rootHash,
    };

    const json = JSON.stringify(payload);
    return base64Encode(json);
  }

  /**
   * Decodes a base64 string and returns the API_KEY
   */
  static decodeAPI(encoded: string, bypassSTXCheck = false): string {
    const decoded = base64Decode(encoded);
    const payload = JSON.parse(decoded) as EncodedAPI;

    this.validatePayload(payload, bypassSTXCheck);
    return payload.k;
  }

  get API(): string {
    return this.API_KEY;
  }
}

/**
 * Combines a list of strings into a single string using the given divider.
 * @param strings - An array of strings to combine.
 * @param divider - A string used to separate the strings (defaults to ':').
 * @returns A single concatenated string.
 */
function appendStrings(strings: string[], divider: string = ":"): string {
  return strings.join(divider);
}

/**
 * Generates a SHA-256 hash for a given string.
 * Validates that the input is a non-empty string.
 * @param {string} string - The string to hash.
 * @returns {string} The hash of the string in hexadecimal format.
 * @throws {Error} If the input is not a valid non-empty string.
 */
function hashString(string: string): string {
  const hash = cryptoJS.SHA256(string);
  return hash.toString(cryptoJS.enc.Hex);
}
