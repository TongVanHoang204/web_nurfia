import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import config from '../config/index.js';
import prisma from '../models/prisma.js';
import { subscribeCustomerStatusChanged, type CustomerStatusChangedEvent } from './customer-stream.service.js';
import { getAllowedOrigins, parseCookieHeader } from '../utils/security.js';

type AuthenticatedSocketUser = {
  userId: number;
  role: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedSocketUser;
  };
};

const ADMIN_ROLES = new Set(['ADMIN', 'STAFF', 'MANAGER']);
const ADMIN_ROOM = 'admin-room';

let io: Server | null = null;
let unsubscribeCustomerStatus: (() => void) | null = null;

const parseTokenFromSocket = (socket: Socket) => {
  const authToken = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : null;
  const queryToken = typeof socket.handshake.query?.token === 'string'
    ? socket.handshake.query.token
    : null;

  const authHeader = socket.handshake.headers.authorization;
  const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const cookieToken = parseCookieHeader(socket.handshake.headers.cookie, config.jwt.cookieName);

  return authToken || bearerToken || cookieToken || queryToken;
};

const broadcastCustomerStatusChanged = (payload: CustomerStatusChangedEvent) => {
  if (!io) return;

  io.to(ADMIN_ROOM).emit('customer-status-changed', payload);
  io.to(`user:${payload.customerId}`).emit('account-status-changed', {
    customerId: payload.customerId,
    isActive: payload.isActive,
    updatedAt: payload.updatedAt,
  });
};

export const initSocketServer = (httpServer: HttpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = parseTokenFromSocket(socket);
      if (!token) {
        next(new Error('Authentication required.'));
        return;
      }

      const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        next(new Error('User account not found or deactivated.'));
        return;
      }

      socket.data.user = {
        userId: user.id,
        role: user.role,
      };

      next();
    } catch {
      next(new Error('Invalid or expired authentication token.'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    socket.join(`user:${user.userId}`);
    if (ADMIN_ROLES.has(user.role)) {
      socket.join(ADMIN_ROOM);
    }

    socket.emit('socket-connected', {
      ok: true,
      timestamp: new Date().toISOString(),
      role: user.role,
    });
  });

  if (!unsubscribeCustomerStatus) {
    unsubscribeCustomerStatus = subscribeCustomerStatusChanged((payload) => {
      broadcastCustomerStatusChanged(payload);
    });
  }

  return io;
};

export const getSocketServer = () => io;
