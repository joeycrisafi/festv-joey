/**
 * Prisma seed entry point. Run with: npm run prisma:seed
 *
 * Safeguard: refuses to run against a production database unless
 * ENABLE_TEST_ACCOUNTS=true is set explicitly.
 */
import prisma from '../src/config/database.js';
import { seedTestAccounts } from '../src/seedTestAccounts.js';

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_TEST_ACCOUNTS !== 'true'
  ) {
    console.error(
      '❌ Refusing to seed in production. Set ENABLE_TEST_ACCOUNTS=true to override.'
    );
    process.exit(1);
  }

  console.log('🌱 Seeding test accounts...');
  const results = await seedTestAccounts(prisma);
  for (const r of results) {
    const tag = r.created ? '✨ created' : '♻️  updated';
    console.log(`  ${tag}  ${r.email}`);
  }
  console.log(`✅ Done — ${results.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
