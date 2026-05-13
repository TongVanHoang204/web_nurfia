import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

const assignRequestValue = (req: Request, key: 'body' | 'query' | 'params', value: unknown) => {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

// Validate request body against a Zod schema
export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      assignRequestValue(req, 'body', schema.parse(req.body));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return next(new AppError(`Validation error: ${message}`, 400));
      }
      next(err);
    }
  };
};

// Validate query params
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      assignRequestValue(req, 'query', schema.parse(req.query));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return next(new AppError(`Query validation error: ${message}`, 400));
      }
      next(err);
    }
  };
};

// Validate route params
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      assignRequestValue(req, 'params', schema.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return next(new AppError(`Param validation error: ${message}`, 400));
      }
      next(err);
    }
  };
};
