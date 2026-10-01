import { Track } from "../models/catalog.schema";
import { Artist, Album } from "../models/catalog.schema";
import { withCache } from "../utils/cache";
import crypto from "node:crypto";

export type SearchType = "TRACK" | "ALBUM" | "ARTIST" | "ALL";

// Section 12: music:search:{hash} cached 30-120 sec - search results
// change slowly relative to request volume, and a short cache absorbs
// bursts of the same query (e.g. autocomplete-style typing).
function hashQuery(q: string, type: string, cursor?: string): string {
  return crypto.createHash("sha1").update(`${q}::${type}::${cursor ?? ""}`).digest("hex");
}

export const searchService = {
  async search(q: string, type: SearchType, limit: number, cursor?: string) {
    const cacheKey = `music:search:${hashQuery(q, type, cursor)}`;
    return withCache(cacheKey, 60, async () => {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const [tracks, albums, artists] = await Promise.all([
        type === "ALL" || type === "TRACK"
          ? Track.find({ title: regex, status: "PUBLISHED" }).limit(limit).lean()
          : [],
        type === "ALL" || type === "ALBUM"
          ? Album.find({ title: regex, status: "PUBLISHED" }).limit(limit).lean()
          : [],
        type === "ALL" || type === "ARTIST"
          ? Artist.find({ name: regex, status: "ACTIVE" }).limit(limit).lean()
          : [],
      ]);
      return { tracks, albums, artists };
    });
  },
};
