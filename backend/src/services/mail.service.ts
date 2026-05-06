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
      pool: {
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 2000,
        rateLimit: 20, // ms between messages
      },
      connectionTimeout: 30000, // 30s timeout (was 10s, Render needs more time)
      greetingTimeout: 30000,
      socketTimeout: 30000,
      family: 4, // Force IPv4 to avoid ENETUNREACH on Render with IPv6
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      tls: {
        rejectUnauthorized: false, // Handle self-signed or untrusted certs
      },
    } as any);
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
  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const activeTransporter = getTransporter();

      if (!activeTransporter) {
        console.info(fallbackLog);
        console.warn('╔══════════════════════════════════════════════════╗');
        console.warn('║  SMTP NOT CONFIGURED — Using console fallback   ║');
        console.warn('╚══════════════════════════════════════════════════╝');
        console.warn(fallbackLog);
        return { delivered: false, error: 'SMTP is not configured.', detail: 'Set SMTP_USER and SMTP_PASS in environment variables.' };
      }

      const info = await sendAction(activeTransporter);
      const messageId = (info as any)?.messageId;
      console.info(`[mail:${label}] Delivered successfully${messageId ? `: ${messageId}` : ''}`);
      return { delivered: true };
    } catch (error) {
      lastError = error;
      const message = getErrorMessage(error);
      console.warn(`[mail:${label}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${message}`);

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, etc.
        const delayMs = Math.pow(2, attempt + 1) * 1000;
        console.warn(`[mail:${label}] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  const message = getErrorMessage(lastError);
  console.error(`[mail:${label}] All ${maxRetries + 1} delivery attempts failed: ${message}`);
  console.warn('╔══════════════════════════════════════════════════╗');
  console.warn('║  SMTP DELIVERY FAILED — See fallback below      ║');
  console.warn('╚══════════════════════════════════════════════════╝');
  console.warn(fallbackLog);
  return { delivered: false, error: message, detail: String(lastError) };
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

  async sendOrderConfirmation(email: string, fullName: string, orderNumber: string, totalAmount: number) {
    return sendMailSafely(
      'order-confirmation',
      `[order-confirmation] ${email}: ${orderNumber}`,
      async (activeTransporter) => {
        await activeTransporter.sendMail({
          from: config.smtp.from,
          to: email,
          subject: 'Nurfia - Order Confirmation',
          text: [
            `Hello ${fullName || 'there'},`,
            '',
            `Thank you for your order! Your order #${orderNumber} has been placed successfully.`,
            `Total Amount: $${totalAmount.toFixed(2)}`,
            '',
            'We will notify you again once your order is processed and shipped.',
            '',
            'Thank you for shopping with us!',
            'The Nurfia Team',
          ].join('\n'),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
              <p>Hello ${fullName || 'there'},</p>
              <p>Thank you for your order! Your order <strong>#${orderNumber}</strong> has been placed successfully.</p>
              <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
              <p>We will notify you again once your order is processed and shipped.</p>
              <br/>
              <p>Thank you for shopping with us!</p>
              <p><strong>The Nurfia Team</strong></p>
            </div>
          `,
        });
      }
    );
  },
};
