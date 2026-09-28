import { TrackLyrics } from "./lyrics.schema";
import { withCache, cacheDel } from "../../shared/cache/cache";
import { AppError } from "../../shared/errors/AppError";
import { Track } from "../catalog/catalog.schema";

export const lyricsService = {
  async getForTrack(trackId: string) {
    return withCache(`music:lyrics:${trackId}`, 1800, async () => {
      const lyrics = await TrackLyrics.findOne({ trackId }).sort({ version: -1 }).lean();
      if (!lyrics) throw AppError.notFound("LYRICS_NOT_FOUND", "Lyrics not available for this track");
      return lyrics;
    });
  },

  /** Admin: create a new lyrics version (never mutates a published version in place). */
  async upsert(trackId: string, language: string, format: "PLAIN" | "TIMED", text?: string, lines?: unknown[]) {
    const latest = await TrackLyrics.findOne({ trackId, language }).sort({ version: -1 }).lean();
    const nextVersion = (latest?.version ?? 0) + 1;
    const doc = await TrackLyrics.create({ trackId, language, format, text, lines, version: nextVersion });

    await Track.updateOne({ _id: trackId }, { $set: { lyricsId: doc._id } });
    await cacheDel(`music:lyrics:${trackId}`);
    return doc;
  },
};
