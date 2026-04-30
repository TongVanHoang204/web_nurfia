import { Response, NextFunction } from 'express';
import fs from 'fs/promises';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  getProtectedBankTransferProofUrl,
  getStoredUploadAbsolutePath,
  isStoredBankTransferUploadPath,
  markProtectedUploadPath,
} from '../utils/bankTransferProof.js';
import { notificationService } from '../services/notification.service.js';

const PAYMENT_METHODS = ['COD', 'BANK_TRANSFER', 'MOMO'] as const;
const CUSTOMER_CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const isUniversalZone = (zoneName: string) => {
  const normalized = normalizeText(zoneName);
  return ['all', 'default', 'nationwide', 'toan quoc', 'toàn quốc', 'everywhere'].includes(normalized);
};

const getZoneMatchScore = (
  zoneName: string,
  address: { province?: string; district?: string; ward?: string }
) => {
  const normalizedZone = normalizeText(zoneName);
  if (!normalizedZone) return -1;
  if (isUniversalZone(zoneName)) return 10;

  const candidates = [
    { value: normalizeText(address.ward), exact: 300, fuzzy: 250 },
    { value: normalizeText(address.district), exact: 200, fuzzy: 150 },
    { value: normalizeText(address.province), exact: 100, fuzzy: 50 },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    if (candidate.value === normalizedZone) return candidate.exact;
    if (candidate.value.includes(normalizedZone) || normalizedZone.includes(candidate.value)) {
      return candidate.fuzzy;
    }
  }

  return -1;
};

const getValidatedPaymentMethod = (value: unknown) => {
  const paymentMethod = String(value || 'COD').trim().toUpperCase();
  if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    throw new AppError('Invalid payment method.', 400);
  }

  return paymentMethod as (typeof PAYMENT_METHODS)[number];
};

const getCartSnapshot = async (userId: number) => {
  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: true,
      variant: true,
    },
  });

  if (cartItems.length === 0) {
    throw new AppError('Cart is empty.', 400);
  }

  let subtotal = 0;
  const orderItemsData: any[] = [];

  for (const item of cartItems) {
    const unitPrice = item.variant?.salePrice ?? item.variant?.price ?? item.product.salePrice ?? item.product.price;
    const price = Number(unitPrice);
    const total = price * item.quantity;
    subtotal += total;

    let variantInfo = null;
    if (item.variant) {
      const attrs = await prisma.productVariantAttribute.findMany({
        where: { variantId: item.variant.id },
        include: { attributeValue: { include: { attribute: true } } },
      });
      variantInfo = attrs.map((attr) => `${attr.attributeValue.attribute.name}: ${attr.attributeValue.value}`).join(', ');
    }

    orderItemsData.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.product.name,
      variantInfo,
      price,
      quantity: item.quantity,
      totalPrice: total,
    });
  }

  return { cartItems, subtotal, orderItemsData };
};

const calculateCouponDiscount = (coupon: any, subtotal: number) => {
  let discountAmount = 0;

  if (coupon.type === 'PERCENTAGE') {
    discountAmount = (subtotal * Number(coupon.value)) / 100;
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
  } else {
    discountAmount = Number(coupon.value);
  }

  return Math.min(discountAmount, subtotal);
};

const getValidCoupon = async (code: string, subtotal: number) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCode } });
  if (!coupon) throw new AppError('Invalid coupon code.', 404);
  if (!coupon.isActive) throw new AppError('Coupon is not active.', 400);

  const now = new Date();
  if (now < coupon.startDate) throw new AppError('Coupon is not yet valid.', 400);
  if (coupon.endDate && now > coupon.endDate) throw new AppError('Coupon has expired.', 400);
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon usage limit reached.', 400);
  if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
    throw new AppError(`Minimum order value is $${coupon.minOrderValue}.`, 400);
  }

  return coupon;
};

const getApplicableShippingOptions = async (
  subtotal: number,
  address: { province?: string; district?: string; ward?: string }
) => {
  const methods = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    include: { zones: true },
    orderBy: { createdAt: 'asc' },
  });

  const options = methods.flatMap((method): any[] => {
    if (method.zones.length === 0) return [];

    const matchedZone = method.zones
      .map((zone) => ({
        zone,
        score: getZoneMatchScore(zone.zoneName, address),
      }))
      .filter((candidate) => candidate.score > -1)
      .sort((a, b) => b.score - a.score)[0];

    if (!matchedZone) {
      return [];
    }

    const freeShipMinOrder = matchedZone.zone.freeShipMinOrder === null ? null : Number(matchedZone.zone.freeShipMinOrder);
    const baseCost = Number(matchedZone.zone.cost);
    const cost = freeShipMinOrder !== null && subtotal >= freeShipMinOrder ? 0 : baseCost;

    return [{
      id: method.id,
      name: method.name,
      description: method.description,
      cost,
      matchedZone: matchedZone.zone.zoneName,
      freeShipMinOrder,
    }];
  }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return options;
};

const validateShippingPayload = (body: any) => {
  const shippingName = String(body.shippingName || '').trim();
  const shippingPhone = String(body.shippingPhone || '').trim();
  const shippingEmail = String(body.shippingEmail || '').trim();
  const shippingProvince = String(body.shippingProvince || '').trim();
  const shippingDistrict = String(body.shippingDistrict || '').trim();
  const shippingWard = String(body.shippingWard || '').trim();
  const shippingStreet = String(body.shippingStreet || '').trim();

  if (!shippingName || !shippingPhone || !shippingEmail || !shippingProvince || !shippingDistrict || !shippingWard || !shippingStreet) {
    throw new AppError('Please fill in all required shipping fields.', 400);
  }

  return {
    shippingName,
    shippingPhone,
    shippingEmail,
    shippingProvince,
    shippingDistrict,
    shippingWard,
    shippingStreet,
  };
};

const validateShippingZoneRequest = (body: any) => {
  const shippingProvince = String(body.shippingProvince || '').trim();
  const shippingDistrict = String(body.shippingDistrict || '').trim();
  const shippingWard = String(body.shippingWard || '').trim();

  if (!shippingProvince || !shippingDistrict || !shippingWard) {
    throw new AppError('Shipping province, district, and ward are required.', 400);
  }

  return {
    shippingProvince,
    shippingDistrict,
    shippingWard,
  };
};

const validateBankTransferImage = (value: unknown) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError('Bank transfer proof is required.', 400);
  }

  if (!normalized.startsWith('/uploads/')) {
    throw new AppError('Bank transfer proof must be an uploaded file from this site.', 400);
  }

  return normalized;
};

const serializeOrderWithProtectedProof = <T extends { id: number; bankTransferImage?: string | null }>(order: T) => ({
  ...order,
  bankTransferImage: getProtectedBankTransferProofUrl(order.id, order.bankTransferImage),
});

const restoreInventoryForOrder = async (tx: any, order: any) => {
  for (const item of order.items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        stock: { increment: item.quantity },
        salesCount: { decrement: item.quantity },
      },
    });
  }
};

const addOrderItemsBackToCart = async (tx: any, userId: number, items: any[]) => {
  const addedItems: Array<{ productName: string; quantity: number }> = [];
  const skippedItems: Array<{ productName: string; reason: string }> = [];

  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive) {
      skippedItems.push({ productName: item.productName, reason: 'Product is no longer available.' });
      continue;
    }

    let availableStock = product.stock;
    if (item.variantId) {
      const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant || !variant.isActive) {
        skippedItems.push({ productName: item.productName, reason: 'Selected variant is no longer available.' });
        continue;
      }
      availableStock = Math.min(availableStock, variant.stock);
    }

    const existing = await tx.cartItem.findFirst({
      where: {
        userId,
        productId: item.productId,
        variantId: item.variantId,
      },
    });

    const currentQuantity = existing?.quantity ?? 0;
    const remainingCapacity = Math.max(0, availableStock - currentQuantity);
    if (remainingCapacity <= 0) {
      skippedItems.push({ productName: item.productName, reason: 'Item is out of stock.' });
      continue;
    }

    const quantityToAdd = Math.min(item.quantity, remainingCapacity);
    if (existing) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantityToAdd },
      });
    } else {
      await tx.cartItem.create({
        data: {
          userId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: quantityToAdd,
        },
      });
    }

    addedItems.push({ productName: item.productName, quantity: quantityToAdd });

    if (quantityToAdd < item.quantity) {
      skippedItems.push({
        productName: item.productName,
        reason: `Only ${quantityToAdd}/${item.quantity} item(s) were added because of current stock.`,
      });
    }
  }

  return { addedItems, skippedItems };
};

export const orderController = {
  validateCoupon: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const subtotal = Number(req.body.subtotal);
      if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw new AppError('Invalid subtotal.', 400);
      }

      const coupon = await getValidCoupon(req.body.code, subtotal);
      if (!coupon) throw new AppError('Coupon code is required.', 400);

      res.json({
        success: true,
        data: {
          discount: calculateCouponDiscount(coupon, subtotal),
          code: coupon.code,
        },
      });
    } catch (err) { next(err); }
  },

  getShippingOptions: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const address = validateShippingZoneRequest(req.body);
      const { subtotal } = await getCartSnapshot(req.userId!);
      const options = await getApplicableShippingOptions(subtotal, {
        province: address.shippingProvince,
        district: address.shippingDistrict,
        ward: address.shippingWard,
      });

      res.json({
        success: true,
        data: {
          subtotal,
          options,
          recommendedMethodId: options[0]?.id ?? null,
        },
      });
    } catch (err) { next(err); }
  },

  createOrder: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const paymentMethod = getValidatedPaymentMethod(req.body.paymentMethod);
      const couponCode = String(req.body.couponCode || '').trim();
      const note = String(req.body.note || '').trim() || null;
      const shippingMethodId = Number(req.body.shippingMethodId);

      const shippingData = validateShippingPayload(req.body);
      if (!Number.isInteger(shippingMethodId) || shippingMethodId <= 0) {
        throw new AppError('Please select a valid shipping method.', 400);
      }

      const { cartItems, subtotal, orderItemsData } = await getCartSnapshot(req.userId!);

      let discountAmount = 0;
      let couponId = null;
      if (couponCode) {
        const coupon = await getValidCoupon(couponCode, subtotal);
        if (coupon) {
          discountAmount = calculateCouponDiscount(coupon, subtotal);
          couponId = coupon.id;
        }
      }

      const shippingOptions = await getApplicableShippingOptions(subtotal, {
        province: shippingData.shippingProvince,
        district: shippingData.shippingDistrict,
        ward: shippingData.shippingWard,
      });

      const selectedShippingOption = shippingOptions.find((option) => option.id === shippingMethodId);
      if (!selectedShippingOption) {
        throw new AppError('Selected shipping method is not available for this address.', 400);
      }

      const shippingCost = selectedShippingOption.cost;
      const totalAmount = subtotal - discountAmount + shippingCost;
      const orderNumber = `NF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId: req.userId!,
            status: 'PENDING',
            paymentMethod,
            subtotal,
            shippingCost,
            discountAmount,
            totalAmount,
            couponId,
            note,
            shippingName: shippingData.shippingName,
            shippingPhone: shippingData.shippingPhone,
            shippingEmail: shippingData.shippingEmail,
            shippingProvince: shippingData.shippingProvince,
            shippingDistrict: shippingData.shippingDistrict,
            shippingWard: shippingData.shippingWard,
            shippingStreet: shippingData.shippingStreet,
            items: { create: orderItemsData },
          },
          include: { items: true },
        });

        for (const item of cartItems) {
          if (item.variantId) {
            const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
            if (!variant || variant.stock < item.quantity) {
              throw new AppError(`Insufficient stock for ${item.product.name} (variant).`, 400);
            }
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            });
          }

          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || product.stock < item.quantity) {
            throw new AppError(`Insufficient stock for ${item.product.name}.`, 400);
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              salesCount: { increment: item.quantity },
            },
          });
        }

        if (couponId) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.cartItem.deleteMany({ where: { userId: req.userId! } });

        return newOrder;
      });

      // Notify customer: order placed
      await notificationService.createNotification(
        req.userId!,
        'ORDER',
        'Order placed successfully',
        `Your order #${order.orderNumber} has been placed and is awaiting confirmation.`,
        `/orders/${order.id}`
      ).catch((err: unknown) => console.error('[Notification] Failed to notify customer on order creation:', err));

      // Notify all admin/staff about new order
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'STAFF', 'MANAGER'] }, isActive: true },
        select: { id: true },
      }).then((admins) => {
        for (const admin of admins) {
          notificationService.createNotification(
            admin.id,
            'ORDER',
            'New order received',
            `Order #${order.orderNumber} has been placed and needs processing.`,
            `/admin/orders/${order.id}`
          ).catch((err: unknown) => console.error('[Notification] Failed to notify admin on order creation:', err));
        }
      }).catch((err: unknown) => console.error('[Notification] Failed to fetch admins:', err));

      res.status(201).json({
        success: true,
        data: {
          ...order,
          shippingMethod: selectedShippingOption,
        },
      });
    } catch (err) { next(err); }
  },

  getOrders: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orders = await prisma.order.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
            },
          },
        },
      });
      res.json({ success: true, data: orders.map((order) => serializeOrderWithProtectedProof(order)) });
    } catch (err) { next(err); }
  },

  getOrderById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const order = await prisma.order.findFirst({
        where: { id, userId: req.userId! },
        include: {
          items: {
            include: {
              product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
            },
          },
          coupon: true,
        },
      });
      if (!order) throw new AppError('Order not found.', 404);
      res.json({ success: true, data: serializeOrderWithProtectedProof(order) });
    } catch (err) { next(err); }
  },

  uploadBankTransferProof: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const bankTransferImage = validateBankTransferImage(req.body.bankTransferImage);

      const order = await prisma.order.findFirst({
        where: { id, userId: req.userId! },
      });

      if (!order) throw new AppError('Order not found.', 404);
      if (order.paymentMethod !== 'BANK_TRANSFER') {
        throw new AppError('This order does not use bank transfer.', 400);
      }
      if (order.status === 'CANCELLED') {
        throw new AppError('Cannot upload payment proof for a cancelled order.', 400);
      }

      markProtectedUploadPath(bankTransferImage);

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { bankTransferImage },
      });

      res.json({
        success: true,
        data: serializeOrderWithProtectedProof(updatedOrder),
        message: 'Payment proof uploaded successfully.',
      });
    } catch (err) { next(err); }
  },

  getBankTransferProof: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid order ID.', 400);
      }

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, userId: true, bankTransferImage: true },
      });

      if (!order || !order.bankTransferImage) {
        throw new AppError('Payment proof not found.', 404);
      }

      const hasAdminAccess = ['ADMIN', 'STAFF', 'MANAGER'].includes(String(req.userRole || '').toUpperCase());
      if (!hasAdminAccess && order.userId !== req.userId) {
        throw new AppError('Unauthorized.', 403);
      }

      if (!isStoredBankTransferUploadPath(order.bankTransferImage)) {
        throw new AppError('Payment proof not found.', 404);
      }

      const absolutePath = getStoredUploadAbsolutePath(order.bankTransferImage);
      try {
        await fs.access(absolutePath);
      } catch {
        throw new AppError('Payment proof not found.', 404);
      }

      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.sendFile(absolutePath);
    } catch (err) { next(err); }
  },

  cancelOrder: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const order = await prisma.order.findFirst({
        where: { id, userId: req.userId! },
        include: { items: true },
      });

      if (!order) throw new AppError('Order not found.', 404);
      if (!CUSTOMER_CANCELLABLE_STATUSES.has(order.status)) {
        throw new AppError('This order can no longer be cancelled.', 400);
      }
      if (order.paymentStatus === 'PAID') {
        throw new AppError('Paid orders must be handled by support for refund processing.', 400);
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        await restoreInventoryForOrder(tx, order);

        if (order.couponId) {
          const coupon = await tx.coupon.findUnique({ where: { id: order.couponId } });
          if (coupon && coupon.usedCount > 0) {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { decrement: 1 } },
            });
          }
        }

        return tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });
      });

      res.json({
        success: true,
        data: updatedOrder,
        message: 'Order cancelled successfully.',
      });
    } catch (err) { next(err); }
  },

  reorder: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const order = await prisma.order.findFirst({
        where: { id, userId: req.userId! },
        include: { items: true },
      });

      if (!order) throw new AppError('Order not found.', 404);

      const result = await prisma.$transaction(async (tx) => {
        return addOrderItemsBackToCart(tx, req.userId!, order.items);
      });

      if (result.addedItems.length === 0) {
        throw new AppError('No items from this order could be re-added to the cart.', 400);
      }

      res.json({
        success: true,
        data: result,
        message: 'Selected items were added back to your cart.',
      });
    } catch (err) { next(err); }
  },
};
