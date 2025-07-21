import { Resend } from 'resend';

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM || 'Girls Got Game <noreply@girlsgotgame.app>';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'codydearkland@gmail.com';