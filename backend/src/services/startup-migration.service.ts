import prisma from '../models/prisma.js';

export const ensureStartupDatabaseCompatibility = async () => {
  try {
    await prisma.$executeRawUnsafe('ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS \'STRIPE\'');
    await prisma.$executeRawUnsafe('ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "reply_subject" VARCHAR(255)');
    await prisma.$executeRawUnsafe('ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "reply_message" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "reply_delivered" BOOLEAN');
    await prisma.$executeRawUnsafe('ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMP(3)');
    console.log('[Startup] Database compatibility checks completed.');
  } catch (error) {
    console.error('[Startup] Database compatibility checks failed:', error);
  }
};
