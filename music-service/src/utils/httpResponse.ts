import { Request, Response } from "express";

// Standard success envelope from design doc Section 8.
export function ok(req: Request, res: Response, data: unknown, httpStatus = 200) {
  return res.status(httpStatus).json({
    success: true,
    data,
    meta: { requestId: (req as any).requestId },
  });
}

export function okWithCursor(
  req: Request,
  res: Response,
  items: unknown[],
  nextCursor: string | null,
  httpStatus = 200
) {
  return res.status(httpStatus).json({
    success: true,
    data: { items, nextCursor },
    meta: { requestId: (req as any).requestId },
  });
}
