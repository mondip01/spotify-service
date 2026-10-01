import { TrackLike, ListeningHistory, PlaybackContextType } from "../models/library.schema";
import { Track } from "../models/catalog.schema";
import { Playlist } from "../models/playlist.schema";
import { decodeCursor, encodeCursor } from "../validators/pagination";
import { Types } from "mongoose";

export const libraryRepository = {
  async like(userId: string, trackId: string) {
    // Unique index makes a duplicate like a no-op rather than an error.
    const result = await TrackLike.updateOne(
      { userId, trackId },
      { $setOnInsert: { userId, trackId } },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  },
  async unlike(userId: string, trackId: string) {
    await TrackLike.deleteOne({ userId, trackId });
  },
  async likedTrackIds(userId: string) {
    return TrackLike.find({ userId }).sort({ createdAt: -1 }).distinct("trackId");
  },
  async likedTracksPage(userId: string, limit: number, cursor?: string) {
    const decoded = decodeCursor<{ _id: string }>(cursor);
    const query: Record<string, unknown> = { userId };
    if (decoded) query._id = { $lt: new Types.ObjectId(decoded._id) };
    const likes = await TrackLike.find(query).sort({ _id: -1 }).limit(limit).lean();
    const tracks = await Track.find({ _id: { $in: likes.map((l) => l.trackId) } }).lean();
    const nextCursor = likes.length === limit ? encodeCursor({ _id: String(likes[likes.length - 1]._id) }) : null;
    return { items: tracks, nextCursor };
  },

  async recordHistory(entry: {
    userId: string;
    trackId: string;
    sessionId: string;
    contextType: PlaybackContextType;
    contextId?: string | null;
    startedAt: Date;
    playedSec: number;
    completed: boolean;
  }) {
    await ListeningHistory.create(entry);
  },

  async recentlyPlayed(userId: string, limit: number) {
    const history = await ListeningHistory.find({ userId }).sort({ createdAt: -1 }).limit(limit * 3).lean();
    // De-duplicate by trackId, keeping the most recent play only.
    const seen = new Set<string>();
    const unique = [];
    for (const h of history) {
      const key = String(h.trackId);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(h);
      if (unique.length >= limit) break;
    }
    const tracks = await Track.find({ _id: { $in: unique.map((u) => u.trackId) } }).lean();
    return tracks;
  },

  async libraryOverview(userId: string, type?: string) {
    const [playlists, likedCount] = await Promise.all([
      type && type !== "playlists" ? Promise.resolve([]) : Playlist.find({ userId }).sort({ updatedAt: -1 }).lean(),
      TrackLike.countDocuments({ userId }),
    ]);
    return { playlists, likedSongsCount: likedCount };
  },
};
