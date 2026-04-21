import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION int_to_boolean(i integer) RETURNS boolean AS $$ BEGIN RETURN i <> 0; END; $$ LANGUAGE plpgsql;`);
    await prisma.$executeRawUnsafe(`CREATE CAST (integer AS boolean) WITH FUNCTION int_to_boolean(integer) AS IMPLICIT;`);
    console.log('✅ CAST created successfully!');
  } catch(e) {
    if (e.message.includes('already exists')) {
       console.log('✅ CAST already exists!');
    } else {
       console.error('❌ Failed:', e.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
