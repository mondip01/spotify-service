import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

// Section 16: "Admin APIs require admin role/permission from the
// authenticated identity." Role comes from the Auth Service's JWT claim;
// if the role claim isn't present the User Service should be treated as
// the authority (see integrations/userService.client.ts::getRole).
const ADMIN_ROLES = new Set(["admin", "content_admin", "super_admin"]);

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(AppError.unauthorized());
  if (!req.user.role || !ADMIN_ROLES.has(req.user.role)) {
    return next(AppError.forbidden("Admin role required"));
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(AppError.forbidden(`Requires one of roles: ${roles.join(", ")}`));
    }
    next();
  };
}
