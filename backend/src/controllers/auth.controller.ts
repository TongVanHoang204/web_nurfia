import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';
import { clearAuthCookie, setAuthCookie } from '../utils/security.js';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      setAuthCookie(res, result.token);
      res.status(201).json({ success: true, data: { user: result.user } });
    } catch (err) { next(err); }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      await logActivity(result.user.id, 'LOGIN', 'AUTH', result.user.id, {
        username: result.user.username,
        role: result.user.role,
      }, req.ip);
      setAuthCookie(res, result.token);
      res.json({ success: true, data: { user: result.user } });
    } catch (err) { next(err); }
  },

  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      clearAuthCookie(res);
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) { next(err); }
  },

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.userId!);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.updateProfile(req.userId!, req.body);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.userId!, currentPassword, newPassword);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async requestChangePasswordOtp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.requestChangePasswordOtp(req.userId!, currentPassword, newPassword);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async confirmChangePasswordOtp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword, otp } = req.body;
      const result = await authService.confirmChangePasswordOtp(req.userId!, currentPassword, newPassword, otp);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const origin = req.headers.origin || req.headers.referer;
      const result = await authService.requestPasswordReset(req.body.email, origin);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.newPassword);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
};
