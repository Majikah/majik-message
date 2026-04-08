/**
 * message-parsers.ts
 *
 * Utility functions for parsing Majik system sentinel tags from decrypted
 * message strings. All parsers follow the same security philosophy as the
 * original GIF parser: strict regex → allowlist/format checks → sanitization
 * → identity check. If any layer fails, the raw string is returned untouched.
 *
 * Supported sentinels:
 *   [gif:<url>]                                  — Giphy GIF embed
 *   [majikah:sys:mm:contact:share:<contact>]     — shared contact payload
 *   [majikah:sys:mm:contact:request]             — request for contact info
 */

import DOMPurify from "dompurify";

// ─── Shared regex anchors ─────────────────────────────────────────────────────

/**
 * All system tags appear at the very end of a message, optionally preceded
 * by a newline. The message body (if any) precedes the tag.
 */

// ─── GIF ──────────────────────────────────────────────────────────────────────

const GIF_TAG_RE = /\n?\[gif:(https?:\/\/[^\]]+)\]$/;

const IMG_TAG_RE = /\n?\[img:([^\]]+)\]$/;

const CALL_TAG_RE = /\n?\[call:([^\]]+)\]$/;

const GIPHY_ORIGIN_ALLOWLIST = new Set([
  "https://media.giphy.com",
  "https://i.giphy.com",
  "https://media0.giphy.com",
  "https://media1.giphy.com",
  "https://media2.giphy.com",
  "https://media3.giphy.com",
  "https://media4.giphy.com",
]);

function isAllowedGiphyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const origin = `${parsed.protocol}//${parsed.hostname}`;
    if (!GIPHY_ORIGIN_ALLOWLIST.has(origin)) return false;
    if (!/\.(gif|webp)(\?|$)/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Contact share ────────────────────────────────────────────────────────────

/**
 * The contact payload is an opaque string (e.g. a serialised public key bundle).
 * We allow any character that is NOT a closing bracket so we never accidentally
 * swallow an injection attempt. Max length guard (2048 chars) prevents DoS via
 * crafted messages.
 */
const CONTACT_SHARE_TAG_RE =
  /\n?\[majikah:sys:mm:contact:share:([^\]]{1,2048})\]$/;

/**
 * Sanitise the contact payload: strip all HTML/tags, trim whitespace, then
 * verify the sanitised string is identical to the extracted one (no mutations).
 */
function sanitiseContactPayload(raw: string): string | null {
  const sanitised = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORCE_BODY: true,
  }).trim();
  return sanitised === raw ? sanitised : null;
}

// ─── Contact request ──────────────────────────────────────────────────────────

const CONTACT_REQUEST_TAG_RE = /\n?\[majikah:sys:mm:contact:request\]$/;

// ─── Parse result types ───────────────────────────────────────────────────────

export type MessageKind =
  | "text"
  | "gif"
  | "call"
  | "contact_share"
  | "contact_request";

interface BaseResult {
  /** The human-readable body of the message (may be empty string). */
  text: string;
}

export interface TextResult extends BaseResult {
  kind: "text";
}

export interface GifResult extends BaseResult {
  kind: "gif";
  gifUrl: string;
}

export interface ContactShareResult extends BaseResult {
  kind: "contact_share";
  /** Opaque contact payload extracted from the sentinel tag. */
  contactPayload: string;
}

export interface ContactRequestResult extends BaseResult {
  kind: "contact_request";
}

export type ParsedMessage =
  | TextResult
  | GifResult
  | ContactShareResult
  | ContactRequestResult;

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses a decrypted message string for any known Majik system sentinel tag.
 *
 * Priority (first match wins):
 *   1. [majikah:sys:mm:contact:share:<payload>]
 *   2. [majikah:sys:mm:contact:request]
 *   3. [gif:<url>]
 *   4. Plain text fallback
 *
 * If a sentinel is detected but fails security validation, it falls through
 * to the next candidate. If all fail, plain text is returned.
 *
 * @param raw - The decrypted plaintext message string.
 * @returns A discriminated-union result describing the message kind.
 */
export function parseMessage(raw: string): ParsedMessage {
  if (!raw) return { kind: "text", text: raw };

  // ── 1. Contact share ───────────────────────────────────────────────────────
  const shareMatch = raw.match(CONTACT_SHARE_TAG_RE);
  if (shareMatch) {
    const extracted = shareMatch[1];
    const sanitised = sanitiseContactPayload(extracted);
    if (sanitised !== null) {
      const text = raw.slice(0, raw.length - shareMatch[0].length);
      return { kind: "contact_share", text, contactPayload: sanitised };
    }
    // Failed validation — fall through
  }

  // ── 2. Contact request ─────────────────────────────────────────────────────
  const requestMatch = raw.match(CONTACT_REQUEST_TAG_RE);
  if (requestMatch) {
    const text = raw.slice(0, raw.length - requestMatch[0].length);
    return { kind: "contact_request", text };
  }

  // ── 3. GIF ─────────────────────────────────────────────────────────────────
  const gifMatch = raw.match(GIF_TAG_RE);
  if (gifMatch) {
    const extractedUrl = gifMatch[1];
    if (isAllowedGiphyUrl(extractedUrl)) {
      const sanitisedUrl = DOMPurify.sanitize(extractedUrl, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        FORCE_BODY: true,
      }).trim();

      if (sanitisedUrl === extractedUrl) {
        const text = raw.slice(0, raw.length - gifMatch[0].length);
        return { kind: "gif", text, gifUrl: sanitisedUrl };
      }
    }
    // Failed validation — fall through to plain text
  }

  // ── 4. Plain text ──────────────────────────────────────────────────────────
  return { kind: "text", text: raw };
}

// ─── isReserved ───────────────────────────────────────────────────────────────

/**
 * Returns `true` if the decrypted message contains any known Majik system
 * sentinel tag that should be rendered as a special UI element rather than
 * plain text.
 *
 * Covered sentinels:
 *   - [gif:<url>]
 *   - [img:<url>]
 *   - [majikah:sys:mm:contact:share:<payload>]
 *   - [majikah:sys:mm:contact:request]
 *
 * This is a lightweight pre-check (regex only, no sanitisation) intended for
 * use in list renderers, notification previews, or any context where you need
 * to know *whether* a message is reserved without paying the full parse cost.
 * For rendering, always use `parseMessage` which applies full security checks.
 *
 * @param raw - The decrypted plaintext message string.
 * @returns `true` if the message is a reserved system message.
 */
export function isReserved(raw: string): boolean {
  if (!raw) return false;
  return (
    GIF_TAG_RE.test(raw) ||
    IMG_TAG_RE.test(raw) ||
    CALL_TAG_RE.test(raw) ||
    CONTACT_SHARE_TAG_RE.test(raw) ||
    CONTACT_REQUEST_TAG_RE.test(raw)
  );
}
