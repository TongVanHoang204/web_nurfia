import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  requestChangePasswordOtpSchema,
  confirmChangePasswordOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();
const loginLimiter = createApiRateLimiter(15 * 60 * 1000, 8, 'Too many login attempts. Please try again later.');
const registerLimiter = createApiRateLimiter(60 * 60 * 1000, 10, 'Too many registration attempts. Please try again later.');
const passwordResetLimiter = createApiRateLimiter(15 * 60 * 1000, 6, 'Too many password reset requests. Please try again later.');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username, fullName]
 *             properties:
 *               email: { type: string, example: user@example.com }
 *               password: { type: string, example: "123456" }
 *               username: { type: string, example: johndoe }
 *               fullName: { type: string, example: "John Doe" }
 *     responses:
 *       201: { description: User registered successfully }
 *       400: { description: Validation error }
 */
router.post('/register', registerLimiter, validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: johndoe }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current session
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: user@example.com }
 *     responses:
 *       200: { description: Reset email sent }
 */
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, example: "newpassword123" }
 *     responses:
 *       200: { description: Password reset successfully }
 */
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile data }
 *       401: { description: Unauthorized }
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update current user profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);

/**
 * @swagger
 * /api/auth/change-password/request-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Request OTP for password change
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OTP sent to email }
 */
router.post('/change-password/request-otp', authenticate, validate(requestChangePasswordOtpSchema), authController.requestChangePasswordOtp);

/**
 * @swagger
 * /api/auth/change-password/confirm-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm OTP and change password
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp, newPassword]
 *             properties:
 *               otp: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200: { description: Password changed successfully }
 */
router.post('/change-password/confirm-otp', authenticate, validate(confirmChangePasswordOtpSchema), authController.confirmChangePasswordOtp);

export default router;
