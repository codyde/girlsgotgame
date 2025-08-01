import { Request } from 'express';
import { db } from '../db/index';
import { user } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Check if a user has admin permissions
 */
export function isAdmin(user: AuthenticatedUser | undefined): boolean {
  return user?.isAdmin === true;
}

/**
 * Check if a user ID has admin permissions (async database lookup)
 */
export async function isAdminById(userId: string): Promise<boolean> {
  try {
    const [userData] = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    
    return userData?.isAdmin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if an email has admin permissions (async database lookup)
 */
export async function isAdminByEmail(email: string): Promise<boolean> {
  try {
    const [userData] = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    
    return userData?.isAdmin === true;
  } catch (error) {
    console.error('Error checking admin status by email:', error);
    return false;
  }
}

/**
 * Grant admin permissions to a user
 */
export async function grantAdminPermissions(userId: string): Promise<boolean> {
  try {
    const [updatedUser] = await db
      .update(user)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id, email: user.email, isAdmin: user.isAdmin });
    
    if (updatedUser) {
      console.log('✅ Admin permissions granted to:', updatedUser.email);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error granting admin permissions:', error);
    return false;
  }
}

/**
 * Revoke admin permissions from a user
 */
export async function revokeAdminPermissions(userId: string): Promise<boolean> {
  try {
    const [updatedUser] = await db
      .update(user)
      .set({ isAdmin: false, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id, email: user.email, isAdmin: user.isAdmin });
    
    if (updatedUser) {
      console.log('⚠️ Admin permissions revoked from:', updatedUser.email);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error revoking admin permissions:', error);
    return false;
  }
}

/**
 * Get all admin users
 */
export async function getAllAdmins(): Promise<AuthenticatedUser[]> {
  try {
    const admins = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      })
      .from(user)
      .where(eq(user.isAdmin, true));
    
    return admins;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
}

/**
 * Admin check error messages
 */
export const ADMIN_ERRORS = {
  NOT_AUTHENTICATED: 'Authentication required',
  NOT_ADMIN: 'Admin permissions required',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions'
} as const;