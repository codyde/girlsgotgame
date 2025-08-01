import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
import { db } from '../db';
import { user as userTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { isAdmin, ADMIN_ERRORS } from '../utils/adminUtils';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    isAdmin?: boolean;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try Better Auth first
    let session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (session?.user) {
      // Better Auth session found - get additional user data
      const [userData] = await db
        .select({
          role: userTable.role,
          isAdmin: userTable.isAdmin
        })
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1);

      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: userData?.role || 'player',
        isAdmin: userData?.isAdmin || false
      };

      return next();
    }

    // 📱 TEMPORARY: Mobile session fallback (until Better Auth integration is complete)
    // Extract token from various sources
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (token) {
      // Check mobile-created sessions in database
      const { session: sessionTable } = await import('../db/schema');
      const { and, gt } = await import('drizzle-orm');
      
      const dbSession = await db
        .select({
          sessionId: sessionTable.id,
          userId: sessionTable.userId,
          expiresAt: sessionTable.expiresAt,
          userEmail: userTable.email,
          userName: userTable.name,
          userRole: userTable.role,
          userIsAdmin: userTable.isAdmin
        })
        .from(sessionTable)
        .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
        .where(
          and(
            eq(sessionTable.token, token),
            gt(sessionTable.expiresAt, new Date())
          )
        )
        .limit(1);

      if (dbSession.length > 0) {
        req.user = {
          id: dbSession[0].userId,
          email: dbSession[0].userEmail,
          name: dbSession[0].userName,
          role: dbSession[0].userRole || 'player',
          isAdmin: dbSession[0].userIsAdmin || false
        };
        return next();
      }
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

// Role-based access control middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role!)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Admin-only access control middleware
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: ADMIN_ERRORS.NOT_AUTHENTICATED });
  }
  
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: ADMIN_ERRORS.NOT_ADMIN });
  }
  
  next();
};

// Combined auth + admin check middleware
export const requireAuthAndAdmin = [requireAuth, requireAdmin];

// Utility function to check if current user is admin
export const checkAdminPermissions = (req: AuthenticatedRequest): boolean => {
  return isAdmin(req.user);
};