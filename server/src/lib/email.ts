import { resend, EMAIL_FROM, ADMIN_EMAIL } from '../config/resend';

interface AccessRequestData {
  id: string;
  email: string;
  name?: string;
  message?: string;
  createdAt: Date;
}

interface AccessRequestDecisionData {
  email: string;
  name?: string;
  approved: boolean;
  reviewerName?: string;
}

export class EmailService {
  static async sendAccessRequestNotification(requestData: AccessRequestData): Promise<boolean> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.log('📧 Resend not configured - would send access request notification:', requestData);
        return true;
      }

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: ADMIN_EMAIL,
        subject: '🏀 New Access Request - Girls Got Game',
        html: this.getAccessRequestNotificationTemplate(requestData)
      });

      if (error) {
        console.error('Failed to send access request notification:', error);
        return false;
      }

      console.log('✅ Access request notification sent:', data?.id);
      return true;

    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  static async sendAccessRequestConfirmation(email: string, name?: string): Promise<boolean> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.log('📧 Resend not configured - would send access request confirmation to:', email);
        return true;
      }

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: '🏀 Access Request Received - Girls Got Game',
        html: this.getAccessRequestConfirmationTemplate(name)
      });

      if (error) {
        console.error('Failed to send access request confirmation:', error);
        return false;
      }

      console.log('✅ Access request confirmation sent:', data?.id);
      return true;

    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  static async sendAccessRequestDecision(decisionData: AccessRequestDecisionData): Promise<boolean> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.log('📧 Resend not configured - would send access request decision to:', decisionData.email);
        return true;
      }

      const subject = decisionData.approved 
        ? '🎉 Welcome to Girls Got Game!' 
        : '🏀 Girls Got Game Access Request Update';

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: decisionData.email,
        subject,
        html: this.getAccessRequestDecisionTemplate(decisionData)
      });

      if (error) {
        console.error('Failed to send access request decision:', error);
        return false;
      }

      console.log('✅ Access request decision sent:', data?.id);
      return true;

    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  private static getAccessRequestNotificationTemplate(requestData: AccessRequestData): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>New Access Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #a855f7); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏀 New Access Request</h1>
            <p style="color: white; margin: 10px 0 0 0;">Girls Got Game Community</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #f97316; margin-top: 0;">Request Details</h2>
            <p><strong>Email:</strong> ${requestData.email}</p>
            ${requestData.name ? `<p><strong>Name:</strong> ${requestData.name}</p>` : ''}
            <p><strong>Submitted:</strong> ${requestData.createdAt.toLocaleString()}</p>
            ${requestData.message ? `
              <p><strong>Message:</strong></p>
              <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #f97316;">
                ${requestData.message}
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://girlsgotgame.app'}/admin" 
               style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Review in Admin Panel
            </a>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
            <p>Girls Got Game - Basketball Training Community</p>
          </div>
        </body>
      </html>
    `;
  }

  private static getAccessRequestConfirmationTemplate(name?: string): string {
    const greeting = name ? `Hi ${name}` : 'Hello';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Access Request Received</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #a855f7); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏀 Request Received!</h1>
            <p style="color: white; margin: 10px 0 0 0;">Girls Got Game Community</p>
          </div>
          
          <div style="padding: 20px 0;">
            <p>${greeting},</p>
            
            <p>Thanks for your interest in joining the Girls Got Game community! We've received your access request and our team will review it soon.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
              <p style="margin: 0;"><strong>What happens next?</strong></p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Our admin team will review your request</li>
                <li>You'll receive an email notification with the decision</li>
                <li>If approved, you'll be able to sign up and join our community</li>
              </ul>
            </div>
            
            <p>Girls Got Game is a basketball training community focused on helping young athletes develop their skills, connect with teammates, and track their progress.</p>
            
            <p>We appreciate your patience and look forward to potentially welcoming you to our community!</p>
            
            <p>Best regards,<br>
            The Girls Got Game Team</p>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
            <p>Girls Got Game - Basketball Training Community</p>
          </div>
        </body>
      </html>
    `;
  }

  private static getAccessRequestDecisionTemplate(decisionData: AccessRequestDecisionData): string {
    const greeting = decisionData.name ? `Hi ${decisionData.name}` : 'Hello';
    
    if (decisionData.approved) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Welcome to Girls Got Game!</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316, #a855f7); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome to the Team!</h1>
              <p style="color: white; margin: 10px 0 0 0;">Girls Got Game Community</p>
            </div>
            
            <div style="padding: 20px 0;">
              <p>${greeting},</p>
              
              <p><strong>Great news!</strong> Your access request has been approved and you're now welcome to join the Girls Got Game community!</p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #15803d;"><strong>🏀 You can now:</strong></p>
                <ul style="margin: 10px 0 0 20px; color: #15803d;">
                  <li>Create your account and join our community</li>
                  <li>Track your basketball training sessions</li>
                  <li>Connect with other players and parents</li>
                  <li>Share your progress and achievements</li>
                  <li>Join team chats and discussions</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://girlsgotgame.app'}" 
                   style="background: #f97316; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                  Get Started Now! 🚀
                </a>
              </div>
              
              <p>Ready to take your basketball journey to the next level? Click the button above to create your account and start tracking your progress!</p>
              
              <p>Welcome to the Girls Got Game family!</p>
              
              <p>Best regards,<br>
              ${decisionData.reviewerName || 'The Girls Got Game Team'}</p>
            </div>
            
            <div style="text-align: center; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
              <p>Girls Got Game - Basketball Training Community</p>
            </div>
          </body>
        </html>
      `;
    } else {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Girls Got Game Access Request Update</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316, #a855f7); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🏀 Access Request Update</h1>
              <p style="color: white; margin: 10px 0 0 0;">Girls Got Game Community</p>
            </div>
            
            <div style="padding: 20px 0;">
              <p>${greeting},</p>
              
              <p>Thank you for your interest in joining the Girls Got Game community. After reviewing your access request, we're unable to approve it at this time.</p>
              
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #dc2626;">This decision is based on our current community guidelines and capacity considerations.</p>
              </div>
              
              <p>We appreciate your interest and encourage you to:</p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Connect with existing community members who might be able to provide an invite</li>
                <li>Check back with us in the future as our community continues to grow</li>
              </ul>
              
              <p>Thank you for understanding, and we wish you the best in your basketball journey!</p>
              
              <p>Best regards,<br>
              ${decisionData.reviewerName || 'The Girls Got Game Team'}</p>
            </div>
            
            <div style="text-align: center; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
              <p>Girls Got Game - Basketball Training Community</p>
            </div>
          </body>
        </html>
      `;
    }
  }
}