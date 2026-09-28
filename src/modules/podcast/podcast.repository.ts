import { Podcast, PodcastEpisode, PodcastFollow } from "./podcast.schema";

export const podcastRepository = {
  findPodcasts: (limit: number) => Podcast.find({ status: "PUBLISHED" }).limit(limit).lean(),
  findPodcastById: (id: string) => Podcast.findOne({ _id: id, status: "PUBLISHED" }).lean(),
  findEpisodes: (podcastId: string) =>
    PodcastEpisode.find({ podcastId, status: "PUBLISHED" }).sort({ publishedAt: -1 }).lean(),

  async follow(userId: string, podcastId: string) {
    // UNIQUE index makes this safe against duplicate/retry (section 14).
    await PodcastFollow.updateOne({ userId, podcastId }, { $setOnInsert: { userId, podcastId } }, { upsert: true });
  },
  async unfollow(userId: string, podcastId: string) {
    await PodcastFollow.deleteOne({ userId, podcastId });
  },
  findFollowedPodcastIds: (userId: string) => PodcastFollow.find({ userId }).distinct("podcastId"),
};
