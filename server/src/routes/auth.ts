import { Router } from 'express';
import { auth } from '../config/auth';
import { db } from '../db';
import { user } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';

const router = Router();
const { logger } = Sentry;

// Better Auth is now mounted directly in index.ts at /api/auth

// Get current session
router.get('/me', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Session validated successfully

    res.json({
      user: session.user,
      session: session.session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user exists by email (for pre-OAuth validation)
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    logger.info('User existence check requested', { 
      email, 
      component: 'auth-backend',
      endpoint: '/check-user'
    });

    if (!email) {
      logger.warn('User existence check failed - no email provided', {
        component: 'auth-backend',
        endpoint: '/check-user'
      });
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists in database
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    const exists = !!existingUser;
    
    logger.info('User existence check completed', { 
      email,
      exists,
      userId: existingUser?.id,
      component: 'auth-backend' 
    });

    res.json({ exists, userId: existingUser?.id });
  } catch (error) {
    logger.error('Error checking user existence', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body?.email,
      component: 'auth-backend' 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;