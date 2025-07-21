import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};