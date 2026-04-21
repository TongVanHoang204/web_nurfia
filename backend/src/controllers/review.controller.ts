import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { logActivity } from '../services/activity.service.js';

const recalculateProductReviewStats = async (productId: number) => {
  const allReviews = await prisma.productReview.findMany({ where: { productId, isApproved: true } });
  const avgRating = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length : 0;

  await prisma.product.update({
    where: { id: productId },
    data: { avgRating, reviewCount: allReviews.length }
  });
};

export const reviewController = {
  checkCanReview: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.productId as string);
      const userId = req.userId!;

      const existingReview = await prisma.productReview.findUnique({
        where: { productId_userId: { productId, userId } }
      });

      if (existingReview) {
        return res.json({ success: true, canReview: false, reason: 'ALREADY_REVIEWED' });
      }

      // Check if user purchased and received the product successfully
      const hasPurchased = await prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            userId,
            status: 'DELIVERED'
          }
        }
      });

      if (!hasPurchased) {
        return res.json({ success: true, canReview: false, reason: 'NOT_PURCHASED' });
      }

      res.json({ success: true, canReview: true });
    } catch (err) { next(err); }
  },

  createReview: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.productId as string);
      const rating = Number(req.body.rating);
      const title = req.body.title ? String(req.body.title).trim() : null;
      const comment = req.body.comment ? String(req.body.comment).trim() : null;
      const userId = req.userId!;

      if (!Number.isInteger(productId) || productId <= 0) {
        throw new AppError('Invalid product ID.', 400);
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new AppError('Rating must be an integer from 1 to 5.', 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, isActive: true },
      });

      if (!product || !product.isActive) {
        throw new AppError('Product not found.', 404);
      }

      const existingReview = await prisma.productReview.findUnique({
        where: { productId_userId: { productId, userId } }
      });

      if (existingReview) {
        return res.status(400).json({ success: false, error: 'You have already reviewed this product' });
      }

      // Check if user actually purchased and item was delivered before allowing creation
      const hasPurchased = await prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            userId,
            status: 'DELIVERED'
          }
        }
      });

      if (!hasPurchased) {
        return res.status(403).json({ success: false, error: 'You can only review products you have purchased and received.' });
      }

      const review = await prisma.productReview.create({
        data: { productId, userId, rating, title, comment, isApproved: true }
      });

      await recalculateProductReviewStats(productId);

      res.status(201).json({ success: true, data: review });
    } catch (err) { next(err); }
  },

  getAdminReviews: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toUpperCase();
      const rating = parseInt(req.query.rating as string, 10);
      const sort = String(req.query.sort || 'NEWEST').trim().toUpperCase();

      const where: any = {};

      if (status === 'APPROVED') {
        where.isApproved = true;
      }
      if (status === 'HIDDEN') {
        where.isApproved = false;
      }

      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        where.rating = rating;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { comment: { contains: search, mode: 'insensitive' } },
          { user: { fullName: { contains: search, mode: 'insensitive' } } },
          { user: { username: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const orderBy: any =
        sort === 'OLDEST' ? { createdAt: 'asc' }
          : sort === 'RATING_ASC' ? [{ rating: 'asc' }, { createdAt: 'desc' }]
            : sort === 'RATING_DESC' ? [{ rating: 'desc' }, { createdAt: 'desc' }]
              : { createdAt: 'desc' };

      const [reviews, total, totalReviews, approvedReviews, hiddenReviews, avgRatingResult] = await Promise.all([
        prisma.productReview.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            user: { select: { fullName: true, username: true, email: true } },
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
        prisma.productReview.count({ where }),
        prisma.productReview.count(),
        prisma.productReview.count({ where: { isApproved: true } }),
        prisma.productReview.count({ where: { isApproved: false } }),
        prisma.productReview.aggregate({ _avg: { rating: true } }),
      ]);

      res.json({
        success: true,
        data: reviews,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          totalReviews,
          approvedReviews,
          hiddenReviews,
          averageRating: Number(avgRatingResult._avg.rating || 0),
        },
      });
    } catch (err) { next(err); }
  },

  bulkApproveReviews: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0) : [];
      const isApproved = req.body?.isApproved === true;

      if (!ids.length) {
        throw new AppError('No valid review IDs provided.', 400);
      }

      const reviews = await prisma.productReview.findMany({
        where: { id: { in: ids } },
        select: { id: true, productId: true, isApproved: true },
      });

      if (!reviews.length) {
        throw new AppError('Reviews not found.', 404);
      }

      await prisma.productReview.updateMany({
        where: { id: { in: reviews.map((review) => review.id) } },
        data: { isApproved },
      });

      const affectedProductIds = Array.from(new Set(reviews.map((review) => review.productId)));
      await Promise.all(affectedProductIds.map((productId) => recalculateProductReviewStats(productId)));

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'REVIEW', null, {
          action: isApproved ? 'BULK_APPROVE' : 'BULK_HIDE',
          reviewIds: reviews.map((review) => review.id),
          affectedCount: reviews.length,
        }, req.ip);
      }

      res.json({ success: true, message: `Updated ${reviews.length} review(s).` });
    } catch (err) { next(err); }
  },

  bulkDeleteReviews: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0) : [];

      if (!ids.length) {
        throw new AppError('No valid review IDs provided.', 400);
      }

      const reviews = await prisma.productReview.findMany({
        where: { id: { in: ids } },
        select: { id: true, productId: true, rating: true },
      });

      if (!reviews.length) {
        throw new AppError('Reviews not found.', 404);
      }

      await prisma.productReview.deleteMany({ where: { id: { in: reviews.map((review) => review.id) } } });

      const affectedProductIds = Array.from(new Set(reviews.map((review) => review.productId)));
      await Promise.all(affectedProductIds.map((productId) => recalculateProductReviewStats(productId)));

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'REVIEW', null, {
          action: 'BULK_DELETE',
          reviewIds: reviews.map((review) => review.id),
          affectedCount: reviews.length,
        }, req.ip);
      }

      res.json({ success: true, message: `Deleted ${reviews.length} review(s).` });
    } catch (err) { next(err); }
  },

  approveReview: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const isApproved = req.body.isApproved === true || req.body.isApproved === 'true';
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid review ID.', 400);
      }
      const currentReview = await prisma.productReview.findUnique({ where: { id } });

      if (!currentReview) {
        throw new AppError('Review not found.', 404);
      }

      const review = await prisma.productReview.update({
        where: { id },
        data: { isApproved }
      });

      await recalculateProductReviewStats(review.productId);

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'REVIEW', review.id, {
          previousIsApproved: currentReview.isApproved,
          currentIsApproved: review.isApproved,
          productId: review.productId,
        }, req.ip);
      }

      res.json({ success: true, data: review });
    } catch (err) { next(err); }
  },
  
  deleteReview: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid review ID.', 400);
      }
      
      const review = await prisma.productReview.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ success: false, error: 'Not found' });

      await prisma.productReview.delete({ where: { id } });
      
      await recalculateProductReviewStats(review.productId);

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'REVIEW', id, {
          productId: review.productId,
          rating: review.rating,
        }, req.ip);
      }

      res.json({ success: true, message: 'Review deleted' });
    } catch (err) { next(err); }
  }
};
