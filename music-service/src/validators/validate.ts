import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

// Section 8: "Validate path/query/body with a schema validator such as Zod."
// Usage: router.post("/x", validate({ body: schema }), controller)
type ValidationTargets = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (targets.body) req.body = targets.body.parse(req.body);
    if (targets.query) req.query = targets.query.parse(req.query) as any;
    if (targets.params) req.params = targets.params.parse(req.params) as any;
    next();
  };
}
