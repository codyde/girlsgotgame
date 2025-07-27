import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
import { db } from '../db';
import { user as userTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
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

    // Fetch user details including role from database
    const userDetails = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        role: userTable.role
      })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);

    if (userDetails.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: userDetails[0].role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};