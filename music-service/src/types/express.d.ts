import "express";

declare global {
  namespace Express {
    interface Actor {
      userId: string;
      isAdmin?: boolean;
      teamId?: string;
    }

    interface Request {
      user?: {
        userId: string;
        role?: string;
      };
      actor?: Actor;
    }
  }
}

export {};
