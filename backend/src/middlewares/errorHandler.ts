import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isMulterError = err.name === 'MulterError';
  const isUploadValidationError = /Only image(?: or video)? files/i.test(err.message);

  const statusCode = err instanceof AppError
    ? err.statusCode
    : isMulterError || isUploadValidationError
      ? 400
      : 500;

  const message = err instanceof AppError
    ? err.message
    : isMulterError || isUploadValidationError
      ? err.message
      : 'Internal Server Error';

  console.error(`[Error] ${statusCode} - ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
