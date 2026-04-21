import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.cartItem.deleteMany({
    where: { variantId: null }
  });
  console.log('Deleted corrupted cart items:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
