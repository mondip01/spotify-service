import { AppError } from './AppError';

export const COMMON_ERRORS = {
  DUPLICATE_REQUEST: {
    code: 'DUPLICATE_REQUEST',
    message: 'Duplicate request',
    statusCode: 409,
  },
} as const;

export function createAppError(
  definition: { code: string; message: string; statusCode: number },
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(definition.statusCode, definition.code, definition.message, details);
}

export { AppError };
