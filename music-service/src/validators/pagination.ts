import { z } from "zod";

// Section 8: "Use cursor pagination for tracks, history, playlists,
// episodes and search results."
export const cursorPaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPagination = z.infer<typeof cursorPaginationQuery>;

// Encodes/decodes an opaque base64 cursor around a Mongo _id + createdAt
// pair so pagination doesn't leak internal representation.
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T = Record<string, unknown>>(cursor?: string): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
