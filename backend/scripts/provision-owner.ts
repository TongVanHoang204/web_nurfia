import 'dotenv/config';
import prisma from '../src/models/prisma.js';
import { provisionOwner } from '../src/services/owner.service.js';

async function main() {
  const username = process.env.OWNER_USERNAME || '';
  const password = process.env.OWNER_PASSWORD || '';
  if (!username || !password) throw new Error('Set OWNER_USERNAME and OWNER_PASSWORD for this command.');
  const result = await provisionOwner(username, password);
  console.log(JSON.stringify({ success: true, account: result }));
}

main().catch(error => {
  console.error(JSON.stringify({ success: false, code: error?.code || 'OWNER_PROVISIONING_FAILED' }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
