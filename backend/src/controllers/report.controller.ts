import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';

const REPORT_RANGES = [7, 30, 90] as const;
const MAX_CUSTOM_RANGE_DAYS = 366;
const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const clampDays = (value: number) => {
  if (REPORT_RANGES.includes(value as (typeof REPORT_RANGES)[number])) return value;
  return 7;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const parseDateInput = (value: string) => {
  if (!DATE_PARAM_PATTERN.test(value)) return null;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateLabel = (date: Date) => {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}`;
};

const calculateTrend = (current: number, previous: number) => {
  if (previous <= 0) {
    if (current <= 0) return 0;
    return 100;
  }

  return ((current - previous) / previous) * 100;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Cho xu ly',
  CONFIRMED: 'Da xac nhan',
  SHIPPING: 'Dang giao',
  DELIVERED: 'Da thanh toan',
  CANCELLED: 'Da huy',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f43f5e',
  CONFIRMED: '#0ea5e9',
  SHIPPING: '#8b5cf6',
  DELIVERED: '#10b981',
  CANCELLED: '#f59e0b',
};

export const reportController = {
  getStatistics: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawStartDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
      const rawEndDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';
      const hasCustomRange = Boolean(rawStartDate || rawEndDate);

      let days = 7;
      let periodStart: Date;
      let periodEnd: Date;

      if (hasCustomRange) {
        if (!rawStartDate || !rawEndDate) {
          return res.status(400).json({
            success: false,
            error: 'Both startDate and endDate are required for a custom report range.',
          });
        }

        const parsedStartDate = parseDateInput(rawStartDate);
        const parsedEndDate = parseDateInput(rawEndDate);

        if (!parsedStartDate || !parsedEndDate) {
          return res.status(400).json({
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD for startDate and endDate.',
          });
        }

        periodStart = startOfDay(parsedStartDate);
        periodEnd = endOfDay(parsedEndDate);

        if (periodStart.getTime() > periodEnd.getTime()) {
          return res.status(400).json({
            success: false,
            error: 'startDate cannot be later than endDate.',
          });
        }

        const todayEnd = endOfDay(new Date());
        if (periodEnd.getTime() > todayEnd.getTime()) {
          return res.status(400).json({
            success: false,
            error: 'Custom report range cannot include future dates.',
          });
        }

        days = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (days > MAX_CUSTOM_RANGE_DAYS) {
          return res.status(400).json({
            success: false,
            error: `Custom report range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days.`,
          });
        }
      } else {
        const rawDays = Number.parseInt(String(req.query.days || '7'), 10);
        days = clampDays(Number.isFinite(rawDays) ? rawDays : 7);

        periodEnd = endOfDay(new Date());
        periodStart = startOfDay(new Date(periodEnd));
        periodStart.setDate(periodStart.getDate() - (days - 1));
      }

      const previousPeriodEnd = new Date(periodStart.getTime() - 1);
      const previousPeriodStart = startOfDay(new Date(previousPeriodEnd));
      previousPeriodStart.setDate(previousPeriodStart.getDate() - (days - 1));

      const monthStart = startOfDay(new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1));

      const currentOrderWhere = {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      };

      const currentRevenueOrderWhere = {
        ...currentOrderWhere,
        status: { not: 'CANCELLED' as const },
      };

      const previousRevenueOrderWhere = {
        createdAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
        status: { not: 'CANCELLED' as const },
      };

      const [
        newSignupsCurrent,
        newSignupsPrevious,
        currentRevenueAgg,
        previousRevenueAgg,
        currentOrders,
        previousOrders,
        activeCustomersCurrent,
        activeCustomersPrevious,
        currentOrdersRaw,
        currentOrderItems,
        currentStatusGroups,
        monthRevenueAgg,
        monthOrders,
        totalCustomers,
      ] = await Promise.all([
        prisma.user.count({
          where: {
            role: 'CUSTOMER',
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        }),
        prisma.user.count({
          where: {
            role: 'CUSTOMER',
            createdAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
        }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: currentRevenueOrderWhere,
        }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: previousRevenueOrderWhere,
        }),
        prisma.order.count({ where: currentOrderWhere }),
        prisma.order.count({
          where: {
            createdAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
        }),
        prisma.order.groupBy({
          by: ['userId'],
          where: currentRevenueOrderWhere,
          _count: { _all: true },
        }),
        prisma.order.groupBy({
          by: ['userId'],
          where: previousRevenueOrderWhere,
          _count: { _all: true },
        }),
        prisma.order.findMany({
          where: currentOrderWhere,
          select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            totalAmount: true,
          },
        }),
        prisma.orderItem.findMany({
          where: {
            order: currentRevenueOrderWhere,
          },
          select: {
            quantity: true,
            totalPrice: true,
            productId: true,
            product: {
              select: {
                name: true,
                category: { select: { name: true } },
              },
            },
            order: {
              select: {
                userId: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.order.groupBy({
          by: ['status'],
          where: currentOrderWhere,
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: { not: 'CANCELLED' as const },
            createdAt: { gte: monthStart, lte: periodEnd },
          },
        }),
        prisma.order.count({
          where: {
            createdAt: { gte: monthStart, lte: periodEnd },
          },
        }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
      ]);

      const currentRevenue = Number(currentRevenueAgg._sum.totalAmount || 0);
      const previousRevenue = Number(previousRevenueAgg._sum.totalAmount || 0);
      const currentActiveCustomers = activeCustomersCurrent.length;
      const previousActiveCustomers = activeCustomersPrevious.length;
      const averageOrderValue = currentOrders > 0 ? currentRevenue / currentOrders : 0;

      const buckets = Array.from({ length: days }, (_, index) => {
        const date = new Date(periodStart);
        date.setDate(periodStart.getDate() + index);
        const key = toDateKey(date);
        return {
          key,
          label: toDateLabel(date),
          revenue: 0,
          orders: 0,
          signups: 0,
        };
      });

      const bucketMap = buckets.reduce<Record<string, { revenue: number; orders: number; signups: number; label: string }>>((acc, item) => {
        acc[item.key] = {
          revenue: 0,
          orders: 0,
          signups: 0,
          label: item.label,
        };
        return acc;
      }, {});

      currentOrdersRaw.forEach((order) => {
        const key = toDateKey(order.createdAt);
        if (!bucketMap[key]) return;
        bucketMap[key].orders += 1;
        if (order.status !== 'CANCELLED') {
          bucketMap[key].revenue += Number(order.totalAmount || 0);
        }
      });

      const signupUsers = await prisma.user.findMany({
        where: {
          role: 'CUSTOMER',
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        select: {
          createdAt: true,
        },
      });

      signupUsers.forEach((user) => {
        const key = toDateKey(user.createdAt);
        if (!bucketMap[key]) return;
        bucketMap[key].signups += 1;
      });

      const trafficSeries = buckets.map((bucket) => ({
        date: bucket.key,
        label: bucketMap[bucket.key].label,
        revenue: bucketMap[bucket.key].revenue,
        orders: bucketMap[bucket.key].orders,
        signups: bucketMap[bucket.key].signups,
      }));

      const categoryMap = new Map<string, { units: number; revenue: number }>();
      const productMap = new Map<number, { name: string; units: number; revenue: number }>();
      const customerMap = new Map<number, { totalSpent: number; orders: number; lastOrderAt: Date }>();

      for (const item of currentOrderItems) {
        const categoryName = item.product.category?.name || 'Chua phan loai';
        const units = Number(item.quantity || 0);
        const revenue = Number(item.totalPrice || 0);

        categoryMap.set(categoryName, {
          units: (categoryMap.get(categoryName)?.units || 0) + units,
          revenue: (categoryMap.get(categoryName)?.revenue || 0) + revenue,
        });

        productMap.set(item.productId, {
          name: item.product.name,
          units: (productMap.get(item.productId)?.units || 0) + units,
          revenue: (productMap.get(item.productId)?.revenue || 0) + revenue,
        });

        const customerId = item.order.userId;
        const current = customerMap.get(customerId);
        customerMap.set(customerId, {
          totalSpent: (current?.totalSpent || 0) + revenue,
          orders: (current?.orders || 0) + 1,
          lastOrderAt: current?.lastOrderAt && current.lastOrderAt > item.order.createdAt ? current.lastOrderAt : item.order.createdAt,
        });
      }

      const salesByCategory = Array.from(categoryMap.entries())
        .map(([name, values]) => ({
          name,
          units: values.units,
          revenue: values.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const topProducts = Array.from(productMap.entries())
        .map(([productId, values]) => ({
          id: productId,
          name: values.name,
          units: values.units,
          revenue: values.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 7);

      const topCustomerIds = Array.from(customerMap.entries())
        .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
        .slice(0, 8)
        .map(([userId]) => userId);

      const featuredUsers = topCustomerIds.length
        ? await prisma.user.findMany({
            where: { id: { in: topCustomerIds } },
            select: { id: true, fullName: true, email: true },
          })
        : [];

      const userMap = new Map(featuredUsers.map((user) => [user.id, user]));
      const featuredCustomers = topCustomerIds
        .map((customerId) => {
          const user = userMap.get(customerId);
          const stats = customerMap.get(customerId);
          if (!user || !stats) return null;

          const diffDays = Math.floor((periodEnd.getTime() - stats.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24));
          const status = diffDays <= 30 ? 'Dang hoat dong' : 'Khong hoat dong';

          return {
            id: user.id,
            fullName: user.fullName || user.email,
            email: user.email,
            initials: (user.fullName || user.email).trim().slice(0, 2).toUpperCase(),
            status,
            totalSpent: stats.totalSpent,
            orders: stats.orders,
            lastOrderAt: stats.lastOrderAt,
          };
        })
        .filter(Boolean)
        .slice(0, 6);

      const statusDistribution = currentStatusGroups
        .map((item) => ({
          status: item.status,
          label: STATUS_LABELS[item.status] || item.status,
          value: item._count._all,
          color: STATUS_COLORS[item.status] || '#94a3b8',
        }))
        .sort((a, b) => b.value - a.value);

      const monthlyRevenue = Number(monthRevenueAgg._sum.totalAmount || 0);
      const revenueGoal = Math.max(10_000_000, Math.ceil((monthlyRevenue * 1.3) / 1_000_000) * 1_000_000);
      const orderGoal = Math.max(100, Math.ceil((monthOrders * 1.3) / 10) * 10);
      const conversionRate = totalCustomers > 0 ? (currentActiveCustomers / totalCustomers) * 100 : 0;

      const overview = {
        orders: currentOrders,
        avgOrderValue: averageOrderValue,
        topProducts: topProducts.length,
      };

      const traffic = {
        revenuePerDay: days > 0 ? currentRevenue / days : 0,
        ordersPerDay: days > 0 ? currentOrders / days : 0,
        visitors: currentActiveCustomers,
      };

      res.json({
        success: true,
        data: {
          range: {
            mode: hasCustomRange ? 'custom' : 'preset',
            days,
            startDate: periodStart,
            endDate: periodEnd,
          },
          kpis: {
            newSignups: {
              value: newSignupsCurrent,
              trend: calculateTrend(newSignupsCurrent, newSignupsPrevious),
            },
            activeCustomers: {
              value: currentActiveCustomers,
              trend: calculateTrend(currentActiveCustomers, previousActiveCustomers),
            },
            netRevenue: {
              value: currentRevenue,
              trend: calculateTrend(currentRevenue, previousRevenue),
            },
          },
          overview,
          traffic,
          trafficSeries,
          salesByCategory,
          statusDistribution,
          incomeComparison: trafficSeries,
          topProducts,
          featuredCustomers,
          goals: {
            revenue: {
              current: monthlyRevenue,
              target: revenueGoal,
            },
            orders: {
              current: monthOrders,
              target: orderGoal,
            },
            conversionRate,
          },
        }
      });
    } catch (err) { next(err); }
  }
};
