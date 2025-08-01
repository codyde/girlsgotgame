import { OAuth2Client } from 'google-auth-library';
import { auth } from '../config/auth';
import crypto from 'crypto';

export class MobileAuthService {
  private googleClient = new OAuth2Client();

  async signInWithGoogle(idToken: string, req: any) {
    let payload;

    // 🧪 PRESERVE: Test token support for development
    if (idToken === 'test-id-token') {
      payload = {
        sub: 'test-user-123',
        email: 'test@girlsgotgame.app',
        name: 'Test User',
        picture: null,
        email_verified: true
      };
    } else {
      // 📱 PRESERVE: Dual client ID support (web + iOS)
      const webClientId = process.env.GOOGLE_CLIENT_ID;
      const iosClientId = '314217271573-g2do63ffpq29c0n9l6a8fcpmeb6g68l0.apps.googleusercontent.com';
      
      if (!webClientId) {
        throw new Error('Server configuration error: Google client ID not configured');
      }
      
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: [webClientId, iosClientId], // Accept both client IDs
      });

      payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid ID token: Token verification failed');
      }
    }

    // 🔄 TEMPORARY: Use fallback method directly for iOS compatibility
    // TODO: Integrate Better Auth properly after mobile flow is working
    return this.fallbackSignIn(payload, req);
  }

  // Fallback method with original logic (for compatibility)
  private async fallbackSignIn(payload: any, req: any) {
    const { db } = await import('../db/index');
    const { user, session } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Original user creation logic
    let existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, payload.email!))
      .limit(1);

    let userId;
    
    if (existingUser.length === 0) {
      const [newUser] = await db
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          email: payload.email!,
          name: payload.name!,
          image: payload.picture || null,
          emailVerified: true,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      userId = newUser.id;
    } else {
      userId = existingUser[0].id;
      
      await db
        .update(user)
        .set({
          name: payload.name!,
          image: payload.picture || null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    }

    // Create session manually
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [newSession] = await db
      .insert(session)
      .values({
        id: crypto.randomUUID(),
        userId: userId,
        token: sessionToken,
        expiresAt: expiresAt,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        image: userData.image
      },
      session: {
        id: newSession.id,
        token: newSession.token,
        expiresAt: newSession.expiresAt.toISOString()
      }
    };
  }

  async signOut(req: any) {
    // 🚪 PRESERVE: Flexible token extraction from multiple sources
    const { sessionToken } = req.body;
    let token = sessionToken;
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      throw new Error('Session token required for sign out');
    }

    // 🔄 TEMPORARY: Use direct database deletion for iOS compatibility  
    // TODO: Integrate Better Auth properly after mobile flow is working
    const { db } = await import('../db/index');
    const { session } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const deletedSessions = await db
      .delete(session)
      .where(eq(session.token, token))
      .returning();

    if (deletedSessions.length > 0) {
      return { success: true, message: 'Signed out successfully' };
    } else {
      // Still return success - session is effectively signed out
      return { success: true, message: 'Session not found (already signed out)' };
    }
  }
}