import { z } from 'zod';

const passwordWithoutSpaces = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/^\S+$/, 'Password cannot contain spaces');

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: passwordWithoutSpaces,
  username: z.string().trim().min(1, 'Username is required').max(50),
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  phone: z.string().trim().optional(),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordWithoutSpaces,
});

export const requestChangePasswordOtpSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordWithoutSpaces,
});

export const confirmChangePasswordOtpSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordWithoutSpaces,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordWithoutSpaces,
});
