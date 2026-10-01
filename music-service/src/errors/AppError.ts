// Standard error codes used across every module. Controllers throw these;
// the centralized error handler (errorHandler.ts) turns them into the
// section-8 error envelope and picks the right HTTP status.
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(code: string, message: string, details = {}) {
    return new AppError(400, code, message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "Not allowed") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(code: string, message: string) {
    return new AppError(404, code, message);
  }
  static conflict(code: string, message: string, details = {}) {
    return new AppError(409, code, message, details);
  }
  static unprocessable(code: string, message: string, details = {}) {
    return new AppError(422, code, message, details);
  }
  static tooManyRequests(message = "Rate limit exceeded") {
    return new AppError(429, "RATE_LIMITED", message);
  }
  static dependencyUnavailable(code: string, message: string) {
    return new AppError(503, code, message);
  }
  static internal(message = "Unexpected server error") {
    return new AppError(500, "INTERNAL_ERROR", message);
  }
}
