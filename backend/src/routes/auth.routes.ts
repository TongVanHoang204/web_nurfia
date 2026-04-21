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

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post('/change-password/request-otp', authenticate, validate(requestChangePasswordOtpSchema), authController.requestChangePasswordOtp);
router.post('/change-password/confirm-otp', authenticate, validate(confirmChangePasswordOtpSchema), authController.confirmChangePasswordOtp);

export default router;
