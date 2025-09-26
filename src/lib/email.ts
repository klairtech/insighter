// Email service for sending invitation notifications
// This is a basic implementation - in production, you'd use a service like SendGrid, Resend, or AWS SES

interface InvitationEmailData {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  invitationLink: string;
  expiresAt: string;
}

export async function sendInvitationEmail(): Promise<boolean> {
  try {
    // For now, we'll just log the email data
    // In production, you would integrate with an email service
    // // TODO: Replace with actual email service integration
    // Example with Resend:
    // const response = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     from: 'noreply@insighter.com',
    //     to: data.to,
    //     subject: `You've been invited to join ${data.organizationName}`,
    //     html: generateInvitationEmailHTML(data),
    //   }),
    // });

    // For development, we'll simulate success
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateInvitationEmailHTML(data: InvitationEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Join ${data.organizationName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
        <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Join ${data.organizationName} on Insighter</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h2 style="color: #333; margin-top: 0;">Hello!</h2>
        <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <h3 style="margin-top: 0; color: #667eea;">What's Insighter?</h3>
          <p style="margin-bottom: 0;">Insighter is a powerful AI-driven data analytics platform that helps organizations make better decisions through intelligent insights and natural language conversations.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.invitationLink}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
          This invitation expires on <strong>${new Date(data.expiresAt).toLocaleDateString()}</strong>
        </p>
      </div>
      
      <div style="text-align: center; color: #666; font-size: 14px;">
        <p>If you can't click the button above, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px; font-family: monospace;">
          ${data.invitationLink}
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        <p>This email was sent by Insighter. If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

// Generate invitation link
export function generateInvitationLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/invitations/accept?token=${token}`;
}
