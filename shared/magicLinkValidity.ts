/**
 * One-time magic-link sign-in validity.
 *
 * Email delivery can be delayed by providers or recipients' mail systems. A
 * 24-hour validity window keeps a legitimately delivered one-time sign-in link
 * usable without making it a durable credential. Issuing another request for
 * the same active token renews this window; successful verification always
 * consumes the token immediately.
 */
export const MAGIC_LINK_VALIDITY_MS = 24 * 60 * 60 * 1000;
export const MAGIC_LINK_VALIDITY_LABEL = "24 hours";
