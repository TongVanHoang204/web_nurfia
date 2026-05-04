import nodemailer from 'nodemailer';
import config from '../config/index.js';

let transporter: nodemailer.Transporter | null = null;

type MailSendResult = {
  delivered: boolean;
  error?: string;
  detail?: string;
};

const hasSmtpCredentials = Boolean(config.smtp.user && config.smtp.pass);

const getTransporter = () => {
  if (!hasSmtpCredentials) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      pool: true, // Reuse connections
      connectionTimeout: 10000, // 10s timeout
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      tls: {
        rejectUnauthorized: false, // Handle self-signed or untrusted certs
      },
    });
  }

  return transporter;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown SMTP error.';
};

const sendMailSafely = async (
  label: string,
  fallbackLog: string,
  sendAction: (activeTransporter: nodemailer.Transporter) => Promise<void>
): Promise<MailSendResult> => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.info(fallbackLog);
    console.warn('╔══════════════════════════════════════════════════╗');
    console.warn('║  SMTP NOT CONFIGURED — Using console fallback   ║');
    console.warn('╚══════════════════════════════════════════════════╝');
    console.warn(fallbackLog);
    return { delivered: false, error: 'SMTP is not configured.', detail: 'Set SMTP_USER and SMTP_PASS in environment variables.' };
  }

  try {
    const info = await sendAction(activeTransporter);
    const messageId = (info as any)?.messageId;
    console.info(`[mail:${label}] Delivered successfully${messageId ? `: ${messageId}` : ''}`);
    return { delivered: true };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[mail:${label}] Delivery failed: ${message}`);
    console.warn('╔══════════════════════════════════════════════════╗');
    console.warn('║  SMTP DELIVERY FAILED — See fallback below      ║');
    console.warn('╚══════════════════════════════════════════════════╝');
    console.warn(fallbackLog);
    return { delivered: false, error: message, detail: String(error) };
  }
};

export const mailService = {
  isConfigured() {
    return hasSmtpCredentials;
  },

  async sendPasswordReset(email: string, fullName: string, resetUrl: string) {
    return sendMailSafely('password-reset', `[password-reset] ${email}: ${resetUrl}`, async (activeTransporter) => {
      await activeTransporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Reset your Nurfia password',
        text: [
          `Hello ${fullName || 'there'},`,
          '',
          'We received a request to reset your password.',
          `Open this link to continue: ${resetUrl}`,
          '',
          'This link expires in 60 minutes.',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <p>Hello ${fullName || 'there'},</p>
            <p>We received a request to reset your password.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:4px;">
                Reset Password
              </a>
            </p>
            <p>This link expires in 60 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    });
  },

  async sendContactReply(email: string, fullName: string, subject: string, message: string) {
    // Strip HTML tags for the plain text version
    const plainText = message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    return sendMailSafely(
      'contact-reply',
      `[contact-reply] ${email} (${fullName || 'customer'}): ${subject}\n${plainText}`,
      async (activeTransporter) => {
        await activeTransporter.sendMail({
          from: config.smtp.from,
          to: email,
          subject,
          text: [
            `Hello ${fullName || 'there'},`,
            '',
            plainText,
            '',
            'Regards,',
            config.smtp.from.includes('gmail') ? 'Support Team' : config.smtp.from.split('@')[0],
          ].join('\n'),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
              <p>Hello ${fullName || 'there'},</p>
              <div style="margin: 16px 0;">${message}</div>
              <p>Regards,<br />Support Team</p>
            </div>
          `,
        });
      }
    );
  },

  async sendChangePasswordOtp(email: string, fullName: string, otp: string) {
    return sendMailSafely('change-password-otp', `[change-password-otp] ${email}: ${otp}`, async (activeTransporter) => {
      await activeTransporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Your Nurfia password change verification code',
        text: [
          `Hello ${fullName || 'there'},`,
          '',
          'Use the OTP below to confirm your password change request:',
          otp,
          '',
          'This OTP expires in 10 minutes.',
          'If you did not request this action, please secure your account immediately.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <p>Hello ${fullName || 'there'},</p>
            <p>Use the verification code below to confirm your password change request:</p>
            <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${otp}</p>
            <p>This OTP expires in 10 minutes.</p>
            <p>If you did not request this action, please secure your account immediately.</p>
          </div>
        `,
      });
    });
  },
};
