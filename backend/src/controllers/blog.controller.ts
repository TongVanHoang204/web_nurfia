import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';

export const blogController = {
  getPosts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 5;

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          where: { isPublished: true },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { publishedAt: 'desc' },
        }),
        prisma.blogPost.count({ where: { isPublished: true } })
      ]);

      res.json({
        status: 'success',
        data: posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch(e) { next(e); }
  },

  getPostBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.blogPost.findUnique({
        where: { slug: req.params.slug as string }
      });

      if (!post || !post.isPublished) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json({ status: 'success', data: post });
    } catch(e) { next(e); }
  }
};
