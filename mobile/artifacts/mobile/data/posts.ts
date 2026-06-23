/**
 * Legacy alias module — driver "posts" and ride "trips" share one underlying
 * record (see `@/data/trips`). This file re-exports the canonical types as
 * `Post` / `PostReply` so older screens keep compiling. Prefer importing
 * `Trip` / `TripReply` directly in new code.
 */

export type { Trip as Post, TripReply as PostReply } from "./trips";
