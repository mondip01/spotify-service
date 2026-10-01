import mongoose, { Types } from "mongoose";
import { Playlist, PlaylistTrack } from "../models/playlist.schema";
import { Track } from "../models/catalog.schema";
import { AppError } from "../errors/AppError";

export const playlistRepository = {
  create: (userId: string, name: string, description?: string) =>
    Playlist.create({ userId, name, description: description ?? null }),

  findByUser: (userId: string) => Playlist.find({ userId }).sort({ updatedAt: -1 }).lean(),

  async findOwned(playlistId: string, userId: string) {
    const playlist = await Playlist.findOne({ _id: playlistId, userId }).lean();
    if (!playlist) throw AppError.notFound("PLAYLIST_NOT_FOUND", "Playlist not found");
    return playlist;
  },

  async update(playlistId: string, userId: string, patch: { name?: string; description?: string }) {
    await this.findOwned(playlistId, userId);
    await Playlist.updateOne({ _id: playlistId }, { $set: patch, $inc: { version: 1 } });
  },

  async remove(playlistId: string, userId: string) {
    await this.findOwned(playlistId, userId);
    await PlaylistTrack.deleteMany({ playlistId });
    await Playlist.deleteOne({ _id: playlistId });
  },

  async orderedTracks(playlistId: string) {
    const rows = await PlaylistTrack.find({ playlistId }).sort({ position: 1 }).lean();
    const tracks = await Track.find({ _id: { $in: rows.map((r) => r.trackId) } }).lean();
    const byId = new Map(tracks.map((t) => [String(t._id), t]));
    return rows.map((r) => ({ ...byId.get(String(r.trackId)), position: r.position, addedAt: r.addedAt }));
  },

  /**
   * Adds tracks atomically: validates existence, enforces the
   * unique-per-playlist constraint (section 14), and keeps trackCount /
   * totalDurationSec consistent with the actual rows in the same
   * transaction (section 4: "denormalized... must be updated atomically").
   */
  async addTracks(playlistId: string, userId: string, trackIds: string[]) {
    const playlist = await this.findOwned(playlistId, userId);
    const tracks = await Track.find({ _id: { $in: trackIds }, status: "PUBLISHED" }).lean();
    if (tracks.length !== trackIds.length) {
      throw AppError.unprocessable("TRACK_NOT_PLAYABLE", "One or more tracks are not available");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existingCount = await PlaylistTrack.countDocuments({ playlistId }).session(session);
        let position = existingCount;
        let addedDuration = 0;

        for (const track of tracks) {
          try {
            await PlaylistTrack.create(
              [{ playlistId, trackId: track._id, position, addedBy: userId }],
              { session }
            );
            position += 1;
            addedDuration += track.durationSec;
          } catch (err: any) {
            if (err?.code === 11000) continue; // duplicate policy: silently skip already-present track
            throw err;
          }
        }

        await Playlist.updateOne(
          { _id: playlistId },
          { $inc: { trackCount: position - existingCount, totalDurationSec: addedDuration, version: 1 } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return this.findOwned(playlistId, userId);
  },

  async removeTrack(playlistId: string, userId: string, trackId: string) {
    await this.findOwned(playlistId, userId);
    const track = await Track.findById(trackId).lean();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const removed = await PlaylistTrack.deleteOne({ playlistId, trackId }).session(session);
        if (removed.deletedCount > 0) {
          await Playlist.updateOne(
            { _id: playlistId },
            { $inc: { trackCount: -1, totalDurationSec: -(track?.durationSec ?? 0), version: 1 } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }
  },

  /**
   * Reorder with optimistic concurrency (section 5/14): caller must pass
   * the version they last read. A stale version is rejected with 409
   * rather than silently overwriting a newer order from another device.
   */
  async reorder(playlistId: string, userId: string, expectedVersion: number, orderedTrackIds: string[]) {
    const playlist = await this.findOwned(playlistId, userId);
    if (playlist.version !== expectedVersion) {
      throw AppError.conflict("PLAYLIST_VERSION_CONFLICT", "Playlist was modified by another device");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const ops = orderedTrackIds.map((trackId, index) => ({
          updateOne: {
            filter: { playlistId, trackId },
            update: { $set: { position: index } },
          },
        }));
        await PlaylistTrack.bulkWrite(ops, { session });

        const result = await Playlist.updateOne(
          { _id: playlistId, version: expectedVersion },
          { $inc: { version: 1 } },
          { session }
        );
        if (result.matchedCount === 0) {
          throw AppError.conflict("PLAYLIST_VERSION_CONFLICT", "Playlist was modified concurrently");
        }
      });
    } finally {
      await session.endSession();
    }
  },
};
