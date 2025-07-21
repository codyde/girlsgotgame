import { Router } from 'express';
import { auth } from '../config/auth';

const router = Router();

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

    console.log('🔍 Session data:', {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name
    });

    res.json({
      user: session.user,
      session: session.session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;