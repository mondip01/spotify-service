import { catalogRepository } from "./catalog.repository";
import { withCache, cacheDel } from "../utils/cache";
import { AppError } from "../errors/AppError";

// music:track:{id} / music:album:{id} keys per section 12; short TTL
// because catalog content changes via Admin at any time.
export const catalogService = {
  listArtists: (limit: number, cursor?: string) => catalogRepository.findArtists(limit, cursor),

  async getArtist(id: string) {
    const artist = await withCache(`music:artist:${id}`, 900, () => catalogRepository.findArtistById(id));
    if (!artist) throw AppError.notFound("ARTIST_NOT_FOUND", "Artist not found");
    return artist;
  },

  listAlbums: (limit: number, cursor?: string) => catalogRepository.findAlbums(limit, cursor),

  async getAlbumWithTracks(id: string) {
    const album = await withCache(`music:album:${id}`, 900, () => catalogRepository.findAlbumById(id));
    if (!album) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
    const tracks = await catalogRepository.findAlbumTracks(id);
    return { album, tracks };
  },

  async getTrack(id: string) {
    const track = await withCache(`music:track:${id}`, 900, () => catalogRepository.findTrackById(id));
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    return track;
  },

  listCategories: () => withCache("music:categories:all", 900, () => catalogRepository.findCategories()),

  getCategoryTracks: (categoryId: string, limit: number, cursor?: string) =>
    catalogRepository.findCategoryTracks(categoryId, limit, cursor),

  async invalidateTrackCache(trackId: string) {
    await cacheDel(`music:track:${trackId}`);
  },
};
