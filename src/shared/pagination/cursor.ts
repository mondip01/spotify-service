import { Types } from "mongoose";

// Simple opaque cursor pagination over _id, used across tracks/history/playlists/
// episodes/search (Section 8: "Use cursor pagination for tracks, history,
// playlists, episodes and search results"). Cursor is the base64 of the last _id
// seen, sorted descending by _id (== descending by creation time given ObjectIds
// are time-ordered).
export function encodeCursor(id: Types.ObjectId | string): string {
  return Buffer.from(String(id)).toString("base64url");
}

export function decodeCursor(cursor?: string): Types.ObjectId | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    return new Types.ObjectId(raw);
  } catch {
    return null;
  }
}

export function buildCursorFilter(cursor?: string) {
  const id = decodeCursor(cursor);
  return id ? { _id: { $lt: id } } : {};
}

export function nextCursorFrom<T extends { _id: Types.ObjectId }>(
  items: T[],
  pageSize: number
): string | null {
  if (items.length < pageSize) return null;
  return encodeCursor(items[items.length - 1]._id);
}
