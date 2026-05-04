import dotenv from 'dotenv';
dotenv.config();

const parseOrigins = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const requireEnv = (key: string) => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
};

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigins = parseOrigins(corsOrigin);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  db: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    refreshSecret: String(process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '').trim(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    cookieName: process.env.JWT_COOKIE_NAME || 'nurfia_session',
  },

  cors: {
    origin: corsOrigin,
    origins: (process.env.NODE_ENV || 'development') === 'development'
      ? [...new Set([...corsOrigins, 'http://localhost:5173', 'http://localhost:4000'])]
      : corsOrigins,
  },

  app: {
    publicUrl: process.env.PUBLIC_APP_URL || corsOrigins[0] || 'http://localhost:5173',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '26214400', 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@nurfia.com',
  },

  momo: {
    partnerCode: String(process.env.MOMO_PARTNER_CODE || '').trim(),
    accessKey: String(process.env.MOMO_ACCESS_KEY || '').trim(),
    secretKey: String(process.env.MOMO_SECRET_KEY || '').trim(),
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:5173/checkout/success',
    ipnUrl: process.env.MOMO_IPN_URL || 'https://your-domain.ngrok.io/api/payment/momo/ipn',
  }
} as const;

export default config;
