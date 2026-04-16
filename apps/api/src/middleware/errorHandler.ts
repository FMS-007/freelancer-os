import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status || 500;
    const message = status < 500 ? err.message : 'Internal server error';

    if (status >= 500) {
      console.error('[Error]', err);
    }

    res.status(status).json({ error: message });
    return;
  }

  console.error('[Unknown Error]', err);
  res.status(500).json({ error: 'Internal server error' });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

export function createError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
