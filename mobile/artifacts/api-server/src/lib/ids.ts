import { randomBytes } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function newSessionId(): string {
  return randomBytes(32).toString("hex");
}
