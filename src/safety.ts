import { BLOCKLIST } from "./config";

const BLOCKED_WORDS = new Set(BLOCKLIST);

export function isBlocked(title: string): boolean {
  return title
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .some((word) => BLOCKED_WORDS.has(word));
}
