import { PlaybackProgress, PlaybackSession, PlaybackSessionDoc } from "./playback.schema";

export const playbackRepository = {
  async getDurableProgress(userId: string, trackId: string) {
    return PlaybackProgress.findOne({ userId, trackId }).lean();
  },

  async upsertDurableProgress(userId: string, trackId: string, positionSec: number, durationSec: number, completed: boolean) {
    // version increments on every durable write; used the same way as the
    // Redis version to reject anything computed against an older read.
    await PlaybackProgress.updateOne(
      { userId, trackId },
      {
        $set: { positionSec, durationSec, completed },
        $inc: { version: 1 },
        $setOnInsert: { userId, trackId },
      },
      { upsert: true }
    );
  },

  createSession: (doc: Partial<PlaybackSessionDoc>) => PlaybackSession.create(doc),

  findSessionById: (sessionId: string) => PlaybackSession.findOne({ sessionId }),

  async updateSessionState(sessionId: string, patch: Partial<PlaybackSessionDoc>) {
    await PlaybackSession.updateOne({ sessionId }, { $set: patch, $inc: { version: 1 } });
  },
};
