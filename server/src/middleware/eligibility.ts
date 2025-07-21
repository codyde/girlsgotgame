import { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user, emailWhitelist, bannedEmails } from '../db/schema';
import { AuthenticatedRequest } from './auth';

// Helper function to check user eligibility
async function checkUserEligibility(email: string): Promise<{ eligible: boolean; reason: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email is banned
    const bannedEmail = await db.query.bannedEmails.findFirst({
      where: eq(bannedEmails.email, normalizedEmail)
    });
    
    if (bannedEmail) {
      return { eligible: false, reason: 'banned' };
    }
    
    // Check if user already exists (they should if they're authenticated)
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, normalizedEmail)
    });
    
    if (!existingUser) {
      return { eligible: false, reason: 'user_not_found' };
    }
    
    // Check if email is whitelisted
    const whitelistedEmail = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, normalizedEmail)
    });
    
    if (whitelistedEmail) {
      return { eligible: true, reason: 'whitelisted' };
    }
    
    // If user exists but is not whitelisted and not banned, they might have been a legacy user
    // For now, we'll allow existing users but this could be tightened
    return { eligible: true, reason: 'existing_user' };
  } catch (error) {
    console.error('Error checking user eligibility:', error);
    return { eligible: false, reason: 'error' };
  }
}

// Middleware to check if authenticated user is still eligible
export async function requireEligibility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const eligibilityCheck = await checkUserEligibility(req.user.email);
    console.log('🔒 Eligibility check for', req.user.email, ':', eligibilityCheck);
    
    if (!eligibilityCheck.eligible) {
      // User is no longer eligible, remove their account
      try {
        await db.delete(user).where(eq(user.email, req.user.email.toLowerCase().trim()));
        console.log('🗑️ Deleted unauthorized user account:', req.user.email);
      } catch (deleteError) {
        console.error('Error deleting unauthorized user:', deleteError);
      }
      
      return res.status(403).json({ 
        error: eligibilityCheck.reason === 'banned' 
          ? 'This email address is not allowed.' 
          : 'This account is not authorized to access the application.' 
      });
    }

    next();
  } catch (error) {
    console.error('Eligibility check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}