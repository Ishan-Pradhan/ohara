import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

// Send email verification link
export const sendVerificationEmail = async (to: string, token: string) => {
  // Points at the frontend's VerifyEmailPage, which calls the API itself and
  // shows a real UI (spinner -> success/failure) — not the backend directly,
  // which would just hand the browser raw JSON. Same pattern as
  // sendPasswordResetEmail below.
  const verifyLink = `${env.FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${token}`;

  const from = env.EMAIL_FROM;

  await resend.emails.send({
    from,
    to,
    subject: 'Verify your email',
    html: verifyEmailTemplate(verifyLink),
  });

  return { verifyLink };
};

// send password reset email
export const sendPasswordResetEmail = async (to: string, token: string) => {
  const resetLink = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}`;

  const from = env.EMAIL_FROM;

  await resend.emails.send({
    from,
    to,
    subject: 'Reset your password',
    html: resetPasswordTemplate(resetLink),
  });

  return { resetLink };
};

// send an account invite email (teacher/admin one-off, or student batch invite)
export const sendStaffInviteEmail = async (
  to: string,
  name: string,
  role: 'teacher' | 'admin' | 'student',
  token: string,
  institutionName: string,
) => {
  const setPasswordLink = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}`;

  const from = env.EMAIL_FROM;

  await resend.emails.send({
    from,
    to,
    subject: `You've been added to ${institutionName}`,
    html: staffInviteTemplate(name, role, institutionName, setPasswordLink),
  });

  return { setPasswordLink };
};

const staffInviteTemplate = (
  name: string,
  role: 'teacher' | 'admin' | 'student',
  institutionName: string,
  setPasswordLink: string,
) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2aaad5;">Welcome to ${institutionName}</h2>

      <p>Hi ${name},</p>

      <p>An administrator has added you to ${institutionName} on Ohara as a <strong>${role}</strong>.</p>

      <p>Set your password to activate your account:</p>

      <a href="${setPasswordLink}"
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #2aaad5;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         Set your password
      </a>

      <p>If the button doesn't work, you can also use this link:</p>
      <p><a href="${setPasswordLink}">${setPasswordLink}</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        If you weren't expecting this, you can safely ignore this email.
      </p>
    </div>
  `;

const verifyEmailTemplate = (verifyLink: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2aaad5;">Verify your email</h2>
      
      <p>Welcome! You're almost ready to start using the platform.</p>
      
      <p>Please confirm your email address by clicking the button below:</p>
      
      <a href="${verifyLink}" 
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #2aaad5;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         Verify Email
      </a>

      <p>If the button doesn't work, you can also use this link:</p>
      <p><a href="${verifyLink}">verify</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        If you didn’t create an account, you can safely ignore this email.
      </p>
    </div>
  `;

const resetPasswordTemplate = (resetLink: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      
      <h2 style="color: #e53935;">Reset your password</h2>
      
      <p>We received a request to reset your password.</p>
      
      <p>If you made this request, click the button below to set a new password:</p>

      <a href="${resetLink}"
        style="
          display: inline-block;
          padding: 12px 20px;
          margin: 16px 0;
          background-color: #e53935;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        ">
        Reset Password
      </a>

      <p>If the button doesn’t work, you can also use this link:</p>
      <p><a href="${resetLink}">Reset your password</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        If you didn’t request this, you can safely ignore this email. Your password will remain unchanged.
      </p>

      <p style="font-size: 12px; color: #777;">
        For security, this link will expire after a limited time.
      </p>
    </div>
  `;
