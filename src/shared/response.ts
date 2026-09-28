import { Request, Response } from "express";
import { v4 as uuid } from "uuid";

// Matches section 8 (API Contract) of the design doc exactly:
// { success, data, meta } / { success:false, error:{code,message,details}, meta }

export function requestId(req: Request): string {
  return (req.headers["x-request-id"] as string) || `req_${uuid()}`;
}

export function ok(req: Request, res: Response, data: unknown, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: { requestId: requestId(req) },
  });
}

export function fail(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {}
) {
  return res.status(status).json({
    success: false,
    error: { code, message, details },
    meta: { requestId: requestId(req) },
  });
}
