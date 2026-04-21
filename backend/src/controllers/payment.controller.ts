import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../models/prisma.js';
import config from '../config/index.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { resolveTrustedAppOrigin } from '../utils/security.js';

export const paymentController = {
  createMomoPayment: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = req.body.orderId;
      if (!orderId) throw new AppError('Order ID is required.', 400);

      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId as string) }
      });

      if (!order) throw new AppError('Order not found.', 404);
      if (order.userId !== req.userId!) throw new AppError('Unauthorized.', 403);
      if (order.status === 'CANCELLED' || order.paymentStatus === 'PAID') {
        throw new AppError('Order is already paid or cancelled.', 400);
      }
      if (order.paymentMethod !== 'MOMO') {
        throw new AppError('This order is not configured for Momo payment.', 400);
      }

      const { partnerCode, accessKey, secretKey, endpoint } = config.momo;
      if (!partnerCode || !accessKey || !secretKey) {
        throw new AppError('Momo payment is not configured.', 503);
      }

      const appOrigin = resolveTrustedAppOrigin(String(req.headers.origin || req.body.redirectUrl || ''));
      const redirectUrl = `${appOrigin}/order-confirmation/${order.id}`;
      const ipnUrl = config.momo.ipnUrl;

      const requestId = partnerCode + new Date().getTime();
      const orderInfo = `Payment for order ${order.orderNumber}`;
      const amount = order.totalAmount.toString();
      const extraData = '';
      const requestType = 'captureWallet';

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${order.orderNumber}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
      const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      const requestBody = {
        partnerCode,
        partnerName: 'Test Momo',
        storeId: 'MomoTestStore',
        requestId,
        amount,
        orderId: order.orderNumber,
        orderInfo,
        redirectUrl,
        ipnUrl,
        lang: 'vi',
        requestType,
        autoCapture: true,
        extraData,
        orderGroupId: '',
        signature
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const responseBody = await response.json();

      if (!response.ok || Number(responseBody.resultCode) !== 0) {
        throw new AppError(`Momo Payment Failed: ${responseBody.message || 'Unknown error'}`, 400);
      }

      res.json({ success: true, data: { payUrl: responseBody.payUrl, deeplink: responseBody.deeplink } });
    } catch (err) { next(err); }
  },

  handleIpn: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        partnerCode, orderId, requestId, amount, orderInfo,
        orderType, transId, resultCode, message, payType, responseTime,
        extraData, signature
      } = req.body;

      const { accessKey, secretKey } = config.momo;
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const expectedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      if (signature !== expectedSignature) {
        res.status(400).json({ message: 'Invalid signature' });
        return;
      }

      if (Number(resultCode) === 0) {
        const order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
        if (
          order &&
          order.paymentMethod === 'MOMO' &&
          order.status !== 'CANCELLED' &&
          order.paymentStatus !== 'PAID' &&
          Number(order.totalAmount) === Number(amount)
        ) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              ...(order.status === 'PENDING' ? { status: 'CONFIRMED' } : {}),
            }
          });
        }
      }

      res.status(204).send();
    } catch (err) { next(err); }
  }
};
