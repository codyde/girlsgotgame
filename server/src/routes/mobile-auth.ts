import { Router } from 'express';
import { MobileAuthService } from '../services/mobileAuth';

const router = Router();
const mobileAuth = new MobileAuthService();

// 📱 PRESERVE: iOS app will call /api/mobile-auth/sign-in/mobile
router.post('/sign-in/mobile', async (req, res) => {
  try {
    const { provider, idToken } = req.body;
    
    if (provider !== 'google') {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Provider must be google' 
      });
    }

    // Delegate to service but preserve all functionality
    const response = await mobileAuth.signInWithGoogle(idToken, req);
    res.json(response);

  } catch (error) {
    console.error('📱 [MOBILE] Error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 📱 PRESERVE: iOS app will call /api/mobile-auth/sign-out/mobile
router.post('/sign-out/mobile', async (req, res) => {
  try {
    const response = await mobileAuth.signOut(req);
    res.json(response);
  } catch (error) {
    console.error('📱 [MOBILE] Sign out error:', error);
    res.status(500).json({ 
      error: 'Sign out failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;