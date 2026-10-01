import { Types } from "mongoose";
import { Artist, Album, Category, Track } from "../models/catalog.schema";
import { decodeCursor, encodeCursor } from "../validators/pagination";

export const catalogRepository = {
  async findArtists(limit: number, cursor?: string) {
    const decoded = decodeCursor<{ _id: string }>(cursor);
    const query = decoded ? { _id: { $gt: new Types.ObjectId(decoded._id) } } : {};
    const artists = await Artist.find({ ...query, status: "ACTIVE" })
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
    const nextCursor = artists.length === limit ? encodeCursor({ _id: String(artists[artists.length - 1]._id) }) : null;
    return { items: artists, nextCursor };
  },

  async findArtistById(id: string) {
    return Artist.findOne({ _id: id, status: "ACTIVE" }).lean();
  },

  async findAlbums(limit: number, cursor?: string) {
    const decoded = decodeCursor<{ _id: string }>(cursor);
    const query = decoded ? { _id: { $gt: new Types.ObjectId(decoded._id) } } : {};
    const albums = await Album.find({ ...query, status: "PUBLISHED" })
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
    const nextCursor = albums.length === limit ? encodeCursor({ _id: String(albums[albums.length - 1]._id) }) : null;
    return { items: albums, nextCursor };
  },

  async findAlbumById(id: string) {
    return Album.findOne({ _id: id, status: "PUBLISHED" }).lean();
  },

  async findAlbumTracks(albumId: string) {
    return Track.find({ albumId, status: "PUBLISHED" }).sort({ position: 1 }).lean();
  },

  async findTrackById(id: string) {
    return Track.findOne({ _id: id, status: "PUBLISHED" }).lean();
  },

  async findTracksByIds(ids: string[]) {
    return Track.find({ _id: { $in: ids } }).lean();
  },

  async findCategories() {
    return Category.find({ status: "ACTIVE" }).sort({ position: 1 }).lean();
  },

  async findCategoryTracks(categoryId: string, limit: number, cursor?: string) {
    const decoded = decodeCursor<{ _id: string }>(cursor);
    const query = decoded ? { _id: { $gt: new Types.ObjectId(decoded._id) } } : {};
    const tracks = await Track.find({ ...query, categoryIds: categoryId, status: "PUBLISHED" })
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
    const nextCursor = tracks.length === limit ? encodeCursor({ _id: String(tracks[tracks.length - 1]._id) }) : null;
    return { items: tracks, nextCursor };
  },

  async findFeatured(limit: number) {
    return Track.find({ status: "PUBLISHED", isFeatured: true }).limit(limit).lean();
  },
  async findTrending(limit: number) {
    // See analytics module for how isTrending gets (re)computed.
    return Track.find({ status: "PUBLISHED", isTrending: true }).limit(limit).lean();
  },
  async findRecommended(limit: number) {
    return Track.find({ status: "PUBLISHED", isRecommended: true }).limit(limit).lean();
  },

  async incrementPlayCount(trackId: string) {
    await Track.updateOne({ _id: trackId }, { $inc: { playCount: 1 } });
  },
};
