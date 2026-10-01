import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { catalogService } from "../services/catalog.service";
import { cursorPaginationQuery } from "../validators/pagination";

export const catalogController = {
  listArtists: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    const result = await catalogService.listArtists(limit, cursor);
    ok(req, res, result);
  }),

  getArtist: asyncHandler(async (req: Request, res: Response) => {
    const artist = await catalogService.getArtist(req.params.id);
    ok(req, res, artist);
  }),

  listAlbums: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    const result = await catalogService.listAlbums(limit, cursor);
    ok(req, res, result);
  }),

  getAlbum: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.getAlbumWithTracks(req.params.id);
    ok(req, res, result);
  }),

  getTrack: asyncHandler(async (req: Request, res: Response) => {
    const track = await catalogService.getTrack(req.params.id);
    ok(req, res, track);
  }),

  listCategories: asyncHandler(async (req: Request, res: Response) => {
    const categories = await catalogService.listCategories();
    ok(req, res, categories);
  }),

  getCategoryTracks: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    const result = await catalogService.getCategoryTracks(req.params.id, limit, cursor);
    ok(req, res, result);
  }),
};
