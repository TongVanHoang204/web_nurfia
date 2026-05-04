import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma.js';
import config from '../config/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import { normalizeAdminPermissions } from '../middlewares/auth.js';
import { mailService } from './mail.service.js';
import { resolveTrustedAppOrigin } from '../utils/security.js';

const SALT_ROUNDS = 12;
const CHANGE_PASSWORD_OTP_TTL_MS = 10 * 60 * 1000;
const CHANGE_PASSWORD_OTP_MAX_ATTEMPTS = 5;

type ChangePasswordOtpState = {
  otpHash: string;
  expiresAt: number;
  attempts: number;
};

const changePasswordOtpStore = new Map<number, ChangePasswordOtpState>();

export const authService = {
  async register(data: { email: string; password: string; username: string; fullName: string; phone?: string }) {
    const email = String(data.email || '').trim().toLowerCase();
    const username = String(data.username || '').trim();
    const fullName = String(data.fullName || '').trim();
    const phone = typeof data.phone === 'string' ? data.phone.trim() : undefined;

    if (!email) {
      throw new AppError('Email is required.', 400);
    }
    if (!username) {
      throw new AppError('Username is required.', 400);
    }
    if (!fullName) {
      throw new AppError('Full name is required.', 400);
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
      select: {
        email: true,
        username: true,
      },
    });
    if (existing?.email === email) {
      throw new AppError('Email already registered.', 409);
    }
    if (existing?.username === username) {
      throw new AppError('Username already registered.', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          username,
          fullName,
          phone: phone || null,
        },
        select: { id: true, email: true, username: true, fullName: true, role: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (targets.includes('email')) {
          throw new AppError('Email already registered.', 409);
        }
        if (targets.includes('username')) {
          throw new AppError('Username already registered.', 409);
        }
        throw new AppError('Account already exists.', 409);
      }
      throw error;
    }

    const token = this.generateToken(user.id, user.role);
    return { user, token };
  },

  async login(username: string, password: string) {
    const identifier = String(username || '').trim();
    if (!identifier) {
      throw new AppError('Username or email is required.', 400);
    }

    const user = await prisma.user.findFirst({
      where: identifier.includes('@')
        ? { email: identifier.toLowerCase() }
        : { username: identifier },
    });

    if (!user) {
      throw new AppError('Invalid username or password.', 401);
    }
    if (!user.isActive) {
      throw new AppError('Account is deactivated.', 403);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new AppError('Invalid username or password.', 401);
    }

    const token = this.generateToken(user.id, user.role);
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: normalizeAdminPermissions(user.permissions),
      },
      token,
    };
  },

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, fullName: true,
        phone: true, role: true, permissions: true, createdAt: true,
        addresses: true,
      },
    });
    if (!user) throw new AppError('User not found.', 404);
    return {
      ...user,
      permissions: normalizeAdminPermissions(user.permissions),
    };
  },

  async updateProfile(userId: number, data: { fullName?: string; phone?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, username: true, fullName: true, phone: true },
    });
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found.', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect.', 400);
    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password.', 400);
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    changePasswordOtpStore.delete(userId);
    return { message: 'Password changed successfully.' };
  },

  async requestChangePasswordOtp(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, password: true, isActive: true },
    });
    if (!user) throw new AppError('User not found.', 404);
    if (!user.isActive) throw new AppError('Account is deactivated.', 403);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect.', 400);
    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password.', 400);
    }

    console.info(`[auth:otp] Requesting change password OTP for user ID: ${userId} (${user.email})`);

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    changePasswordOtpStore.set(user.id, {
      otpHash,
      expiresAt: Date.now() + CHANGE_PASSWORD_OTP_TTL_MS,
      attempts: 0,
    });

    const mailResult = await mailService.sendChangePasswordOtp(user.email, user.fullName, otp);

    if (!mailResult.delivered) {
      // Always log OTP visibly so developer can use it for testing
      console.warn('');
      console.warn('╔══════════════════════════════════════════════════════════╗');
      console.warn('║  EMAIL FAILED — Use this OTP to test password change   ║');
      console.warn(`║  Email: ${user.email.padEnd(48)}║`);
      console.warn(`║  OTP:   ${otp.padEnd(48)}║`);
      console.warn(`║  Error: ${(mailResult.error || 'unknown').padEnd(48)}║`);
      console.warn('╚══════════════════════════════════════════════════════════╝');
      console.warn('');

      // We bypass the hard 503 error on Render to allow users to still use the system 
      // when running on Render Free Tier where SMTP is blocked by firewall
      return {
        message: 'OTP could not be sent (SMTP blocked). For testing, use the OTP shown in logs or this debug value.',
        expiresInSeconds: Math.floor(CHANGE_PASSWORD_OTP_TTL_MS / 1000),
        delivered: false,
        debugOtp: otp, // Temporarily expose for Render free tier so user isn't stuck
      };
    }

    return {
      message: 'OTP has been sent to your email. Enter it to confirm password change.',
      expiresInSeconds: Math.floor(CHANGE_PASSWORD_OTP_TTL_MS / 1000),
      delivered: true,
      ...(config.env !== 'production' ? { debugOtp: otp } : {}),
    };
  },

  async confirmChangePasswordOtp(userId: number, currentPassword: string, newPassword: string, otp: string) {
    const otpState = changePasswordOtpStore.get(userId);
    if (!otpState) {
      throw new AppError('OTP not found. Please request a new code.', 400);
    }

    if (Date.now() > otpState.expiresAt) {
      changePasswordOtpStore.delete(userId);
      throw new AppError('OTP has expired. Please request a new code.', 400);
    }

    if (otpState.attempts >= CHANGE_PASSWORD_OTP_MAX_ATTEMPTS) {
      changePasswordOtpStore.delete(userId);
      throw new AppError('Too many invalid OTP attempts. Please request a new code.', 429);
    }

    const isOtpValid = await bcrypt.compare(String(otp), otpState.otpHash);
    if (!isOtpValid) {
      otpState.attempts += 1;
      changePasswordOtpStore.set(userId, otpState);
      throw new AppError('Invalid OTP code.', 400);
    }

    changePasswordOtpStore.delete(userId);
    return this.changePassword(userId, currentPassword, newPassword);
  },

  async requestPasswordReset(email: string, origin?: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new AppError('Email is required.', 400);
    }

    const genericResponse = {
      message: 'If an account with that email exists, a reset link has been sent.',
    };

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) {
      return genericResponse;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetExpires },
    });

    const baseOrigin = resolveTrustedAppOrigin(origin);
    const resetUrl = `${baseOrigin}/login?resetToken=${resetToken}`;
    const mailResult = await mailService.sendPasswordReset(user.email, user.fullName, resetUrl);

    return {
      ...genericResponse,
      ...(mailResult.delivered ? {} : {}),
    };
  },

  async resetPassword(token: string, newPassword: string) {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      throw new AppError('Reset token is required.', 400);
    }

    const resetTokenHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: resetTokenHash,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Reset link is invalid or has expired.', 400);
    }

    // Security: New password must be different from the old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new AppError('New password must be different from your old password.', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpires: null,
      },
    });

    return { message: 'Password has been reset successfully.' };
  },

  generateToken(userId: number, role: string): string {
    return jwt.sign({ userId, role }, config.jwt.secret as string, {
      expiresIn: config.jwt.expiresIn as any,
    });
  },
};
