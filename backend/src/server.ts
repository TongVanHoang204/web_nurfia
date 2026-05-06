import express from 'express';
import { createServer } from 'node:http';
import dns from 'node:dns';

// Fix ENETUNREACH / IPv6 resolution issues on Render for Node v17+
dns.setDefaultResultOrder('ipv4first');

import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import config from './config/index.js';
import prisma from './models/prisma.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import bannerRoutes from './routes/banner.routes.js';
import settingRoutes from './routes/setting.routes.js';
import blogRoutes from './routes/blog.routes.js';
import addressRoutes from './routes/address.routes.js';
import contactRoutes from './routes/contact.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import compareRoutes from './routes/compare.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { aiController } from './controllers/ai.controller.js';
import { initSocketServer } from './services/socket.service.js';
import { getAllowedOrigins } from './utils/security.js';
import { setupSwagger } from './utils/swagger.js';
import {
  cacheProtectedUploadStatus,
  getCachedProtectedUploadStatus,
  isStoredBankTransferUploadPath,
} from './utils/bankTransferProof.js';

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Setup Swagger UI
setupSwagger(app);

// Serve uploaded files
app.use('/uploads', async (req, res, next) => {
  try {
    const normalizedPath = `/uploads${decodeURIComponent(req.path || '')}`;
    if (!isStoredBankTransferUploadPath(normalizedPath)) {
      next();
      return;
    }

    const cachedStatus = getCachedProtectedUploadStatus(normalizedPath);
    if (cachedStatus === true) {
      res.status(404).end();
      return;
    }
    if (cachedStatus === false) {
      next();
      return;
    }

    const protectedProof = await prisma.order.findFirst({
      where: { bankTransferImage: normalizedPath },
      select: { id: true },
    });
    const isProtected = Boolean(protectedProof);
    cacheProtectedUploadStatus(normalizedPath, isProtected);

    if (isProtected) {
      res.status(404).end();
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
});
app.use('/uploads', express.static(path.join(process.cwd(), config.upload.dir)));

// API Routes
/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [Chat]
 *     summary: Send a message to AI chatbot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               history: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: AI response }
 */
app.post('/api/ai/chat', aiController.chat);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

// Health check
/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Settings]
 *     summary: Health check endpoint
 *     responses:
 *       200: { description: Server is healthy }
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API not-found handler to keep error shape consistent for frontend
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found.',
    message: 'API route not found.',
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] Environment: ${config.env}`);
  console.log(`[Socket] Running on ws://localhost:${config.port}`);
});

export default app;
