import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

// Every request gets a requestId (Section 21 - Observability: "Every request gets
// requestId/correlationId"). Downstream integration clients and queue publishers
// reuse this as the correlationId so a single playback/media flow can be traced
// end-to-end across services and workers.
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.length > 0 ? incoming : uuidv4();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
