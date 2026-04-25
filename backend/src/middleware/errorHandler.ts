import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

// Validation error
export class ValidationError extends AppError {
  public errors: any[];
  
  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

// Unauthorized error
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

// Forbidden error
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

// Conflict error
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);
  
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  
  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          error: 'A record with this value already exists',
          field: (err.meta?.target as string[])?.[0],
        });
      case 'P2025':
        return res.status(404).json({
          success: false,
          error: 'Record not found',
        });
      case 'P2003':
        return res.status(400).json({
          success: false,
          error: 'Related record not found',
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'Database operation failed',
          ...(config.env !== 'production' && { code: err.code, meta: err.meta }),
        });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data provided',
      ...(config.env !== 'production' && { detail: err.message.split('\n').slice(-3).join(' ') }),
    });
  }
  
  // Custom app errors
  if (err instanceof AppError) {
    const response: any = {
      success: false,
      error: err.message,
    };
    
    if (err instanceof ValidationError && err.errors.length > 0) {
      response.details = err.errors;
    }
    
    return res.status(err.statusCode).json(response);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
    });
  }
  
  // Multer file upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  // Default error
  const statusCode = 500;
  const message = config.env === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.env !== 'production' && { stack: err.stack }),
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
