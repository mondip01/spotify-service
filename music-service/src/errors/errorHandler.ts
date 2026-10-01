import { NextFunction, Request, Response } from "express";
import { AppError } from "./AppError";
import { fail } from "../utils/response";
import { logger } from "../utils/logger";
import { ZodError } from "zod";

// Section 8 rule: "Never expose internal Mongo/R2 errors directly to
// clients." Everything funnels through here so the client only ever sees
// a safe, consistent envelope, while the full error is still logged.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, "app_error_5xx");
    else logger.warn({ code: err.code, path: req.path }, "app_error_4xx");
    return fail(req, res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return fail(req, res, 400, "VALIDATION_ERROR", "Request validation failed", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  logger.error({ err, path: req.path }, "unhandled_error");
  return fail(req, res, 500, "INTERNAL_ERROR", "Unexpected server error");
}

export function notFoundHandler(req: Request, res: Response) {
  return fail(req, res, 404, "ROUTE_NOT_FOUND", `No route for ${req.method} ${req.path}`);
}

// Wraps an async controller so rejected promises reach errorHandler
// instead of crashing the process or hanging the request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
