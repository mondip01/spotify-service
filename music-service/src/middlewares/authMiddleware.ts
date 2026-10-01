import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

// Section 3 / 16: "Do not implement login/token issuance here" and
// "Short timeout / local token verification where supported."
// The Music Service NEVER issues tokens. It only verifies the JWT that
// the Auth Service already issued, using a shared secret/public key.
// This keeps every request path free of a network hop to Auth Service
// for the common case (fast, and resilient to Auth Service being slow).

export interface AuthenticatedUser {
  userId: string;
  role?: "user" | "admin" | "content_admin" | "super_admin";
  raw: jwt.JwtPayload;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export function verifyLocalToken(token: string): AuthenticatedUser {
  try {
    const payload = jwt.verify(token, env.jwtSecretOrPublicKey, {
      algorithms: [env.jwtAlgorithm],
    }) as jwt.JwtPayload;

    const userId = (payload.sub as string) || (payload.userId as string);
    if (!userId) {
      throw AppError.unauthorized("Token missing subject/userId claim");
    }
    return { userId, role: payload.role, raw: payload };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized("Invalid or expired token");
  }
}

/** Requires a valid token. Used on every user-specific route. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return next(AppError.unauthorized("Missing bearer token"));
  req.user = verifyLocalToken(token);
  req.actor = { userId: req.user.userId, isAdmin: req.user.role === "admin" || req.user.role === "content_admin" || req.user.role === "super_admin", teamId: (req.user.raw.teamId as string | undefined) };
  next();
}

/** Attaches user if a token is present, but never rejects the request.
 * Used on public catalog/home routes that personalize when possible. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    req.user = verifyLocalToken(token);
    req.actor = { userId: req.user.userId, isAdmin: req.user.role === "admin" || req.user.role === "content_admin" || req.user.role === "super_admin", teamId: (req.user.raw.teamId as string | undefined) };
  } catch {
    // Ignore invalid token on optional routes - treat as anonymous.
  }
  next();
}
