import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PageResult } from './paginate';

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, message, data });
}

export function sendCreated<T>(res: Response, message: string, data: T): void {
  sendSuccess(res, message, data, 201);
}

export function sendPaginated<TRow, TOut>(
  res: Response,
  message: string,
  page: PageResult<TRow>,
  mapper: (row: TRow) => TOut,
): void {
  sendSuccess(res, message, {
    items: page.items.map(mapper),
    page: page.page,
    limit: page.limit,
    total: page.total,
    totalPages: page.totalPages,
    hasMore: page.hasMore,
  });
}

export function asyncHandler<TReq extends Request>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as unknown as TReq, res, next)).catch(next);
  };
}

/** Backwards-compatible alias used by the existing controllers. */
export function ok(req: Request, res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data, meta: { requestId: (req as any).requestId } });
}

export function okWithCursor(req: Request, res: Response, items: unknown[], nextCursor: string | null, status = 200) {
  return ok(req, res, { items, nextCursor }, status);
}

export function fail(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return res.status(status).json({
    success: false,
    error: { code, message, details },
    meta: { requestId: (req as any).requestId },
  });
}
