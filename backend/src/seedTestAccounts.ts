/**
 * Test account definitions + idempotent DB seeder.
 *
 * Consumers:
 *   - prisma/seed.ts            (via `npm run prisma:seed`)
 *   - POST /auth/seed-test-accounts  (dev-only, gated by ENABLE_TEST_ACCOUNTS=true)
 *   - frontend TestAccountsPicker.tsx (via the endpoint above)
 *
 * ⚠️  Dev only. The endpoint returns plaintext passwords so the picker can
 *     autofill the login form. NEVER set ENABLE_TEST_ACCOUNTS=true in prod.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { config } from './config/index.js';

export interface TestAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: UserRole[];
  label: string;  // UI label used in "Sign in as test {label}"
  emoji: string;  // UI emoji
}

// Shared password — intentionally known, dev only.
// Meets registerSchema: 8+ chars, upper, lower, number.
const PASSWORD = 'Test1234!';

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'test-client@festv.app',
    password: PASSWORD,
    firstName: 'Alice',
    lastName: 'Tester',
    role: UserRole.CLIENT,
    roles: [UserRole.CLIENT],
    label: 'planner',
    emoji: '🎉',
  },
  {
    email: 'test-photographer@festv.app',
    password: PASSWORD,
    firstName: 'Alex',
    lastName: 'Photo',
    role: UserRole.PROVIDER,
    roles: [UserRole.PROVIDER],
    label: 'photographer',
    emoji: '📷',
  },
  {
    email: 'test-caterer@festv.app',
    password: PASSWORD,
    firstName: 'Marie',
    lastName: 'Kitchen',
    role: UserRole.PROVIDER,
    roles: [UserRole.PROVIDER],
    label: 'caterer',
    emoji: '🍽️',
  },
  {
    email: 'test-bartender@festv.app',
    password: PASSWORD,
    firstName: 'Sam',
    lastName: 'Mix',
    role: UserRole.PROVIDER,
    roles: [UserRole.PROVIDER],
    label: 'bartender',
    emoji: '🍸',
  },
  {
    email: 'test-dj@festv.app',
    password: PASSWORD,
    firstName: 'Jordan',
    lastName: 'Beats',
    role: UserRole.PROVIDER,
    roles: [UserRole.PROVIDER],
    label: 'DJ',
    emoji: '🎧',
  },
];

export interface SeedResult {
  email: string;
  created: boolean;
}

/**
 * Create or refresh every test account. Idempotent — safe to re-run.
 * Refreshing a user also resets password + status to ACTIVE so a tampered
 * test account always works again after re-seeding.
 */
export async function seedTestAccounts(prisma: PrismaClient): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const acc of TEST_ACCOUNTS) {
    const email = acc.email.toLowerCase();
    const passwordHash = await bcrypt.hash(acc.password, config.bcrypt.rounds);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          role: acc.role,
          roles: acc.roles,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      results.push({ email: acc.email, created: false });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          role: acc.role,
          roles: acc.roles,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      results.push({ email: acc.email, created: true });
    }
  }

  return results;
}
