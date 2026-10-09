import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import prisma from '../models/prisma.js';
import config from '../config/index.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { resolveTrustedAppOrigin } from '../utils/security.js';
import { momoCallbackSchema } from '../validators/commerce.validator.js';

const STRIPE_API_VERSION = '2026-04-22.dahlia';

type StripeCheckoutSession = {
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
};

const getStripeClient = () => {
  if (!config.stripe.secretKey) {
    throw new AppError('Stripe payment is not configured.', 503);
  }

  return new Stripe(config.stripe.secretKey, { apiVersion: STRIPE_API_VERSION });
};

const getOrderAmountInSmallestUnit = (amount: unknown) => Math.round(Number(amount) * 100);

const shouldUseStripeDemoMode = () =>
  config.env !== 'production' && (config.stripe.demoMode || !config.stripe.secretKey);

const markOrderPaid = async (order: { id: number; status: string }) => {
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      ...(order.status === 'PENDING' ? { status: 'CONFIRMED' as const } : {}),
    },
  });
};

const markStripeOrderPaid = async (session: StripeCheckoutSession) => {
  const orderId = Number(session.metadata?.orderId || session.client_reference_id || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (
    !order
    || order.paymentMethod !== 'STRIPE'
    || order.status === 'CANCELLED'
    || order.paymentStatus === 'PAID'
  ) {
    return;
  }

  const expectedAmount = getOrderAmountInSmallestUnit(order.totalAmount);
  const receivedAmount = Number(session.amount_total || 0);
  const receivedCurrency = String(session.currency || '').toLowerCase();
  if (receivedAmount !== expectedAmount || receivedCurrency !== config.stripe.currency) {
    console.warn('[Stripe] Ignored payment with mismatched amount or currency', {
      orderId: order.id,
      expectedAmount,
      receivedAmount,
      expectedCurrency: config.stripe.currency,
      receivedCurrency,
    });
    return;
  }

  await markOrderPaid(order);
};

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

  createStripeCheckoutSession: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (config.env === 'production' && config.stripe.demoMode) {
        throw new AppError('Stripe demo mode is disabled in production.', 503);
      }
      const orderId = req.body.orderId;
      if (!orderId) throw new AppError('Order ID is required.', 400);

      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId as string) },
      });

      if (!order) throw new AppError('Order not found.', 404);
      if (order.userId !== req.userId!) throw new AppError('Unauthorized.', 403);
      if (order.status === 'CANCELLED' || order.paymentStatus === 'PAID') {
        throw new AppError('Order is already paid or cancelled.', 400);
      }
      if (order.paymentMethod !== 'STRIPE') {
        throw new AppError('This order is not configured for Stripe payment.', 400);
      }

      const appOrigin = resolveTrustedAppOrigin(String(req.headers.origin || req.body.returnUrl || ''));
      const successUrl = `${appOrigin}/order-confirmation/${order.id}?stripe_session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${appOrigin}/order-confirmation/${order.id}`;
      const amount = getOrderAmountInSmallestUnit(order.totalAmount);

      if (amount < 50) {
        throw new AppError('Order total is too small for Stripe Checkout.', 400);
      }

      if (shouldUseStripeDemoMode()) {
        await markOrderPaid(order);
        res.json({
          success: true,
          data: {
            url: `${appOrigin}/order-confirmation/${order.id}?stripe_demo=paid`,
            sessionId: `demo_${order.id}_${Date.now()}`,
            demo: true,
          },
        });
        return;
      }

      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: String(order.id),
        customer_email: order.shippingEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: config.stripe.currency,
            unit_amount: amount,
            product_data: {
              name: `Order ${order.orderNumber}`,
            },
          },
        }],
        metadata: {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
          userId: String(order.userId),
        },
        payment_intent_data: {
          metadata: {
            orderId: String(order.id),
            orderNumber: order.orderNumber,
            userId: String(order.userId),
          },
        },
      });

      res.json({ success: true, data: { url: session.url, sessionId: session.id } });
    } catch (err) { next(err); }
  },

  handleStripeWebhook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.stripe.webhookSecret) {
        throw new AppError('Stripe webhook is not configured.', 503);
      }

      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        throw new AppError('Missing Stripe signature.', 400);
      }

      const stripe = getStripeClient();
      const event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);

      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object as StripeCheckoutSession;
        if (session.payment_status === 'paid') {
          await markStripeOrderPaid(session);
        }
      }

      res.status(204).send();
    } catch (err) { next(err); }
  },

  handleIpn: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessKey, secretKey, partnerCode: configuredPartnerCode } = config.momo;
      if (!accessKey || !secretKey || !configuredPartnerCode) {
        throw new AppError('Momo payment is not configured.', 503);
      }

      const parsed = momoCallbackSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Invalid Momo callback payload.', 400);
      }
      const {
        partnerCode, orderId, requestId, amount, orderInfo,
        orderType, transId, resultCode, message, payType, responseTime,
        extraData, signature
      } = parsed.data;

      if (partnerCode !== configuredPartnerCode) {
        throw new AppError('Invalid Momo partner code.', 400);
      }
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const expectedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
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
