import { v4 as uuid } from "uuid";
import { AppError } from "../errors/AppError";
import { playbackRepository } from "./playback.repository";
import { playbackRedis, QueueItem, RepeatMode } from "./playback.redis";
import { catalogRepository } from "./catalog.repository";
import { mediaService } from "./media.service";
import { libraryRepository } from "./library.repository";
import { publish, QUEUES } from "../messaging/queueClient";
import { PlaybackSessionDoc, PlaybackContextType } from "../models/playback.schema";

interface StartSessionInput {
  userId: string;
  trackId: string;
  contextType: PlaybackContextType;
  contextId?: string;
  deviceId: string;
}

async function assertPlayable(trackId: string, userId: string) {
  const track = await catalogRepository.findTrackById(trackId);
  if (!track || track.status !== "PUBLISHED") {
    throw AppError.notFound("TRACK_NOT_FOUND", "Track not found or not playable");
  }

  return track;
}

/** Section 9.1: Redis first, Mongo fallback, clamp against real duration. */
async function resolveResumePosition(userId: string, trackId: string, durationSec: number): Promise<number> {
  const hot = await playbackRedis.getPosition(userId, trackId);
  let positionSec = hot?.positionSec;

  if (positionSec === undefined) {
    const durable = await playbackRepository.getDurableProgress(userId, trackId);
    positionSec = durable?.positionSec ?? 0;
  }

  if (positionSec < 0 || positionSec > durationSec) positionSec = 0; // clamp invalid values
  return positionSec;
}

export const playbackService = {
  /** POST /playback/sessions - Appendix A. */
  async startSession(input: StartSessionInput) {
    const track = await assertPlayable(input.trackId, input.userId);
    const resumePositionSec = await resolveResumePosition(input.userId, input.trackId, track.durationSec);
    const { url, expiresAt } = await mediaService.getPlaybackUrl(String(track.mediaAssetId));

    const sessionId = `ps_${uuid()}`;
    await playbackRepository.createSession({
      sessionId,
      userId: input.userId,
      trackId: track._id as any,
      contextType: input.contextType,
      contextId: input.contextId ?? null,
      deviceId: input.deviceId,
      positionSec: resumePositionSec,
      state: "PLAYING",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    });

    await catalogRepository.incrementPlayCount(String(track._id));
    await publish(QUEUES.ANALYTICS_EVENTS, {
      eventId: `evt_${uuid()}`,
      userId: input.userId,
      sessionId,
      eventType: "PLAY_STARTED",
      trackId: String(track._id),
      positionSec: resumePositionSec,
      contextType: input.contextType,
      contextId: input.contextId ?? null,
      occurredAt: new Date().toISOString(),
    });

    return {
      sessionId,
      trackId: String(track._id),
      stream: { type: "hls", url, expiresAt },
      resumePositionSec,
      durationSec: track.durationSec,
      state: "PLAYING" as const,
    };
  },

  async getSession(sessionId: string, userId: string) {
    const session = await playbackRepository.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw AppError.notFound("SESSION_NOT_FOUND", "Playback session not found");
    }
    return session;
  },

  /**
   * PATCH /playback/sessions/:id/progress - the resume-playback
   * heartbeat. Section 9.1 rule #7: version/timestamp checks in
   * playbackRedis.setPosition() silently drop stale writes so two
   * devices racing each other can't move the position backwards.
   */
  async heartbeat(sessionId: string, userId: string, positionSec: number) {
    const session = await this.getSession(sessionId, userId);
    const nextVersion = session.version + 1;

    await playbackRedis.setPosition(userId, String(session.trackId), positionSec, nextVersion);
    await playbackRepository.updateSessionState(sessionId, {
      positionSec,
      lastHeartbeatAt: new Date(),
    } as Partial<PlaybackSessionDoc>);

    // Durable Mongo write happens less frequently than the hot Redis
    // write per section 9.1 rule #6 - every ~6th heartbeat here as a
    // simple approximation of "on important lifecycle events".
    if (nextVersion % 6 === 0) {
      const track = await catalogRepository.findTrackById(String(session.trackId));
      await playbackRepository.upsertDurableProgress(userId, String(session.trackId), positionSec, track?.durationSec ?? 0, false);
    }

    return { sessionId, positionSec, version: nextVersion };
  },

  async pause(sessionId: string, userId: string) {
    await this.getSession(sessionId, userId);
    await playbackRepository.updateSessionState(sessionId, { state: "PAUSED" });
    return { sessionId, state: "PAUSED" as const };
  },

  async resume(sessionId: string, userId: string) {
    await this.getSession(sessionId, userId);
    await playbackRepository.updateSessionState(sessionId, { state: "PLAYING" });
    return { sessionId, state: "PLAYING" as const };
  },

  async seek(sessionId: string, userId: string, positionSec: number) {
    const session = await this.getSession(sessionId, userId);
    const nextVersion = session.version + 1;
    await playbackRedis.setPosition(userId, String(session.trackId), positionSec, nextVersion);
    await playbackRepository.updateSessionState(sessionId, { positionSec });
    return { sessionId, positionSec };
  },

  /**
   * POST /playback/sessions/:id/complete - section 9 flow step
   * "complete => history + analytics event". This is also where an
   * immediate durable progress write happens (rule #6: "important
   * lifecycle events"), independent of the every-6th-heartbeat cadence.
   */
  async complete(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId, userId);
    const track = await catalogRepository.findTrackById(String(session.trackId));

    await playbackRepository.updateSessionState(sessionId, { state: "COMPLETED", endedAt: new Date() });
    await playbackRepository.upsertDurableProgress(userId, String(session.trackId), track?.durationSec ?? session.positionSec, track?.durationSec ?? 0, true);

    await libraryRepository.recordHistory({
      userId,
      trackId: String(session.trackId),
      sessionId,
      // PlaybackSession.contextType and ListeningHistory.contextType are
            contextType: session.contextType as any,
      contextId: session.contextId,
      startedAt: session.startedAt,
      playedSec: track?.durationSec ?? session.positionSec,
      completed: true,
    });

    await publish(QUEUES.ANALYTICS_EVENTS, {
      eventId: `evt_${uuid()}`,
      userId,
      sessionId,
      eventType: "COMPLETED",
      trackId: String(session.trackId),
      occurredAt: new Date().toISOString(),
    });

    return { sessionId, state: "COMPLETED" as const };
  },

  /** POST /playback/resolve - re-authorize a stream URL mid-session (e.g. signed URL expired). */
  async resolve(userId: string, trackId: string) {
    const track = await assertPlayable(trackId, userId);
    const { url, expiresAt } = await mediaService.getPlaybackUrl(String(track.mediaAssetId));
    return { stream: { type: "hls", url, expiresAt } };
  },

  // ---------------------------------------------------------------
  // Queue (section 11) - Redis-first QueueState, forward navigation
  // respects shuffleEnabled/repeatMode exactly as documented.
  // ---------------------------------------------------------------

  async getQueue(userId: string, deviceId: string) {
    return (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
  },

  async addTrack(userId: string, deviceId: string, trackId: string, source: string) {
    await catalogRepository.findTrackById(trackId).then((t) => {
      if (!t) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    });
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    state.items.push({ trackId, source, addedAt: new Date().toISOString() });
    state.version += 1;
    await playbackRedis.saveQueue(userId, deviceId, state);
    return state;
  },

  async addTracksBulk(userId: string, deviceId: string, trackIds: string[], source: string) {
    const tracks = await catalogRepository.findTracksByIds(trackIds);
    if (tracks.length !== trackIds.length) {
      throw AppError.unprocessable("TRACK_NOT_PLAYABLE", "One or more tracks are not available");
    }
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    const now = new Date().toISOString();
    for (const trackId of trackIds) {
      state.items.push({ trackId, source, addedAt: now });
    }
    state.version += 1;
    await playbackRedis.saveQueue(userId, deviceId, state);
    return state;
  },

  async removeTrack(userId: string, deviceId: string, trackId: string) {
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    const index = state.items.findIndex((i) => i.trackId === trackId);
    if (index >= 0) {
      state.items.splice(index, 1);
      if (state.currentIndex >= index) state.currentIndex = Math.max(-1, state.currentIndex - 1);
      state.version += 1;
      await playbackRedis.saveQueue(userId, deviceId, state);
    }
    return state;
  },

  async clearQueue(userId: string, deviceId: string) {
    const state = playbackRedis.emptyQueue();
    await playbackRedis.saveQueue(userId, deviceId, state);
    return state;
  },

  async reorderQueue(userId: string, deviceId: string, orderedTrackIds: string[]) {
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    const byTrackId = new Map(state.items.map((i) => [i.trackId, i]));
    const reordered: QueueItem[] = orderedTrackIds
      .map((id) => byTrackId.get(id))
      .filter((i): i is QueueItem => Boolean(i));
    if (reordered.length !== state.items.length) {
      throw AppError.badRequest("QUEUE_REORDER_MISMATCH", "orderedTrackIds must include every existing queue item exactly once");
    }
    state.items = reordered;
    state.version += 1;
    await playbackRedis.saveQueue(userId, deviceId, state);
    return state;
  },

  async setQueueState(userId: string, deviceId: string, patch: { shuffleEnabled?: boolean; repeatMode?: RepeatMode; currentIndex?: number }) {
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    if (patch.shuffleEnabled !== undefined) state.shuffleEnabled = patch.shuffleEnabled;
    if (patch.repeatMode !== undefined) state.repeatMode = patch.repeatMode;
    if (patch.currentIndex !== undefined) state.currentIndex = patch.currentIndex;
    state.version += 1;
    await playbackRedis.saveQueue(userId, deviceId, state);
    return state;
  },

  /** Advances the queue per repeatMode (section 11: OFF=advance, ONE=replay, ALL=restart). */
  async advanceQueue(userId: string, deviceId: string) {
    const state = (await playbackRedis.getQueue(userId, deviceId)) ?? playbackRedis.emptyQueue();
    if (state.items.length === 0) return { state, nextTrackId: null };

    if (state.repeatMode === "ONE") {
      // replay current item - index unchanged
    } else if (state.currentIndex + 1 < state.items.length) {
      state.currentIndex += 1;
    } else if (state.repeatMode === "ALL") {
      state.currentIndex = 0;
    } else {
      state.currentIndex = state.items.length; // past the end -> queue exhausted
    }

    state.version += 1;
    await playbackRedis.saveQueue(userId, deviceId, state);
    const nextTrackId = state.items[state.currentIndex]?.trackId ?? null;
    return { state, nextTrackId };
  },
};
