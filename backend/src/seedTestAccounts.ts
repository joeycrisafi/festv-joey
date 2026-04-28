/**
 * Test account definitions + idempotent DB seeder.
 *
 * Consumers:
 *   - prisma/seed.ts                 (via `npm run prisma:seed`)
 *   - POST /auth/seed-test-accounts  (dev-only, gated by ENABLE_TEST_ACCOUNTS=true)
 *   - frontend signin.html picker    (via the endpoint above)
 *
 * Behavior:
 *   - User rows are upserted on every run — auth fields (password, status)
 *     are refreshed so the picker always works.
 *   - ProviderProfile + child rows (Services, MenuItems, PortfolioItems,
 *     PricingLevels, CuisineTypes, EventThemes) are created ONCE.
 *     Subsequent seed runs find the existing profile and leave it alone,
 *     so no duplicates and manual edits are preserved.
 *
 * ⚠️  Dev only. The endpoint returns plaintext passwords so the picker can
 *     autofill the login form. NEVER set ENABLE_TEST_ACCOUNTS=true in prod.
 */
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  UserRole,
  UserStatus,
  ProviderType,
  VerificationStatus,
  MediaType,
  EventType,
  EventRequestStatus,
  QuoteStatus,
  BookingStatus,
} from '@prisma/client';
import { config } from './config/index.js';

// PriceType is an orphaned enum in the new schema (Service model was dropped).
// Prisma generate no longer exports it, so we define it locally to keep
// the legacy services data compilable without a full seeder rewrite.
const PriceType = {
  FLAT_RATE: 'FLAT_RATE',
  PER_PERSON: 'PER_PERSON',
  PER_HOUR: 'PER_HOUR',
  CUSTOM: 'CUSTOM',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// USER ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

export interface TestAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: UserRole[];
  label: string;   // UI label used in "Sign in as test {label}"
  emoji: string;   // UI emoji
  city?: string;
  state?: string;
  country?: string;
  avatarUrl?: string;
  bannerUrl?: string;
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
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    avatarUrl: 'https://picsum.photos/seed/festv-alice-avatar/300/300',
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
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    avatarUrl: 'https://picsum.photos/seed/festv-alex-avatar/300/300',
    bannerUrl: 'https://picsum.photos/seed/festv-alex-banner/1600/400',
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
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    avatarUrl: 'https://picsum.photos/seed/festv-marie-avatar/300/300',
    bannerUrl: 'https://picsum.photos/seed/festv-marie-banner/1600/400',
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
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    avatarUrl: 'https://picsum.photos/seed/festv-sam-avatar/300/300',
    bannerUrl: 'https://picsum.photos/seed/festv-sam-banner/1600/400',
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
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    avatarUrl: 'https://picsum.photos/seed/festv-jordan-avatar/300/300',
    bannerUrl: 'https://picsum.photos/seed/festv-jordan-banner/1600/400',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER PROFILE DATA
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceData {
  name: string;
  description: string;
  providerType: ProviderType;
  priceType: PriceType;
  basePrice: number;
  pricePerPerson?: number;
  pricePerHour?: number;
  minGuests?: number;
  maxGuests?: number;
  minHours?: number;
  maxHours?: number;
  features: string[];
  includes: string[];
  excludes?: string[];
}

interface PortfolioData {
  title: string;
  description?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  eventType?: string;
  isFeatured?: boolean;
}

interface MenuItemData {
  name: string;
  description: string;
  category: string;
  price: number;
  dietaryInfo?: string[];
  allergens?: string[];
}

interface PricingLevelData {
  name: string;
  description: string;
  pricePerPerson: number;
  minimumGuests?: number;
  features: string[];
}

interface ProviderProfileData {
  businessName: string;
  businessDescription: string;
  primaryType: ProviderType;
  providerTypes: ProviderType[];
  isSoloWorker: boolean;
  bannerImageUrl: string;
  logoUrl: string;
  serviceRadius: number;
  serviceAreas: string[];
  pricePerPerson: number | null;
  hourlyRate: number | null;
  minimumHours: number | null;
  fixedFee: number;
  minimumBudget: number | null;
  maximumBudget: number | null;
  depositPercentage: number;
  minGuestCount: number;
  maxGuestCount: number;
  verificationStatus: VerificationStatus;
  services: ServiceData[];
  portfolio: PortfolioData[];
  pricingLevels?: PricingLevelData[];
  menuItems?: MenuItemData[];
  cuisineTypes?: string[];
  eventThemes?: string[];
  tagline?: string;
  languages?: string[];
  yearsInBusiness?: number;
  websiteUrl?: string;
  instagramHandle?: string;
  travelOutsideRegion?: boolean;
}

// Provider profile data keyed by test account email.
// CLIENT accounts (the planner) are not in this map.
const PROVIDER_PROFILES: Record<string, ProviderProfileData> = {
  // ─── 📷 Photographer (PHOTO_VIDEO, solo, hourly) ────────────────────────
  'test-photographer@festv.app': {
    businessName: 'Alex Photo Studio',
    businessDescription:
      'Editorial wedding & event photography. Clean, candid, modern. Based in Montreal, available across Quebec.',
    primaryType: ProviderType.PHOTO_VIDEO,
    providerTypes: [ProviderType.PHOTO_VIDEO],
    isSoloWorker: true,
    bannerImageUrl: 'https://picsum.photos/seed/festv-alex-cover/1600/600',
    logoUrl: 'https://picsum.photos/seed/festv-alex-logo/400/400',
    serviceRadius: 100,
    serviceAreas: ['Montreal', 'Laval', 'Longueuil', 'Quebec City'],
    pricePerPerson: null,
    hourlyRate: 250,
    minimumHours: 4,
    fixedFee: 100,
    minimumBudget: 1000,
    maximumBudget: 5000,
    depositPercentage: 30,
    minGuestCount: 1,
    maxGuestCount: 500,
    verificationStatus: VerificationStatus.VERIFIED,
    tagline: 'Editorial wedding & event photography — candid, modern, timeless',
    languages: ['English', 'French'],
    yearsInBusiness: 8,
    instagramHandle: 'alexphoto.mtl',
    websiteUrl: 'https://alexphotostudio.ca',
    travelOutsideRegion: true,
    services: [
      {
        name: 'Half-day Wedding Coverage',
        description:
          'Up to 4 hours of coverage. Includes ceremony, key portraits, and 100+ edited photos delivered within 2 weeks.',
        providerType: ProviderType.PHOTO_VIDEO,
        priceType: PriceType.PER_HOUR,
        basePrice: 1100,
        pricePerHour: 250,
        minHours: 4,
        maxHours: 4,
        features: ['Ceremony coverage', 'Edited photos', 'Online gallery'],
        includes: ['100+ edited photos', 'Online gallery', '2-week delivery'],
      },
      {
        name: 'Full-day Wedding Coverage',
        description:
          'Up to 8 hours of coverage. Includes prep, ceremony, reception, and 400+ edited photos plus a 30-photo highlight reel.',
        providerType: ProviderType.PHOTO_VIDEO,
        priceType: PriceType.PER_HOUR,
        basePrice: 2100,
        pricePerHour: 250,
        minHours: 8,
        maxHours: 10,
        features: ['Prep + ceremony + reception', '400+ edited photos', 'Highlight reel'],
        includes: ['400+ edited photos', 'Highlight reel (30 photos)', 'Online gallery', 'Print release'],
      },
    ],
    portfolio: [
      {
        title: 'Mont-Tremblant Wedding',
        description: 'Outdoor ceremony in the Laurentians.',
        mediaUrl: 'https://picsum.photos/seed/festv-alex-port-1/1200/800',
        eventType: 'Wedding',
        isFeatured: true,
      },
      {
        title: 'Old Montreal Engagement',
        mediaUrl: 'https://picsum.photos/seed/festv-alex-port-2/1200/800',
        eventType: 'Engagement',
      },
      {
        title: 'Loft Studio Wedding',
        mediaUrl: 'https://picsum.photos/seed/festv-alex-port-3/1200/800',
        eventType: 'Wedding',
      },
      {
        title: 'Eastern Townships Brunch',
        mediaUrl: 'https://picsum.photos/seed/festv-alex-port-4/1200/800',
        eventType: 'Brunch',
      },
    ],
  },

  // ─── 🍽️ Caterer (CATERER, company, per-person) ──────────────────────────
  'test-caterer@festv.app': {
    businessName: "Marie's Kitchen",
    businessDescription:
      'Refined French-Canadian catering for weddings, corporate events, and private dinners. Locally sourced, seasonally inspired.',
    primaryType: ProviderType.CATERER,
    providerTypes: [ProviderType.CATERER],
    isSoloWorker: false,
    bannerImageUrl: 'https://picsum.photos/seed/festv-marie-cover/1600/600',
    logoUrl: 'https://picsum.photos/seed/festv-marie-logo/400/400',
    serviceRadius: 75,
    serviceAreas: ['Montreal', 'Laval', 'Longueuil'],
    pricePerPerson: 75,
    hourlyRate: null,
    minimumHours: null,
    fixedFee: 0,
    minimumBudget: 1500,
    maximumBudget: 35000,
    depositPercentage: 25,
    minGuestCount: 20,
    maxGuestCount: 300,
    verificationStatus: VerificationStatus.VERIFIED,
    tagline: 'Refined French-Canadian catering for life\'s finest moments',
    languages: ['French', 'English'],
    yearsInBusiness: 12,
    instagramHandle: 'marieskitchen.mtl',
    websiteUrl: 'https://marieskitchen.ca',
    travelOutsideRegion: false,
    services: [
      {
        name: 'Wedding Reception Catering',
        description:
          'Full-service wedding catering including plated dinner, staffing, and bar setup. Custom menu development.',
        providerType: ProviderType.CATERER,
        priceType: PriceType.PER_PERSON,
        basePrice: 75,
        pricePerPerson: 75,
        minGuests: 50,
        maxGuests: 250,
        features: ['Custom menu', 'Staff included', 'China & glassware'],
        includes: ['Plated dinner', 'Wait staff', 'China + glassware', 'Setup + cleanup'],
      },
      {
        name: 'Corporate Lunch',
        description:
          'Buffet-style corporate lunch with seasonal selections. Perfect for office events and meetings.',
        providerType: ProviderType.CATERER,
        priceType: PriceType.PER_PERSON,
        basePrice: 35,
        pricePerPerson: 35,
        minGuests: 20,
        maxGuests: 150,
        features: ['Buffet style', 'Vegetarian options', 'Drop-off available'],
        includes: ['3 mains + 4 sides', 'Disposable serveware', 'Setup'],
      },
    ],
    pricingLevels: [
      {
        name: 'Bistro',
        description: 'Casual yet elevated. 3-course plated meal with seasonal sides.',
        pricePerPerson: 50,
        minimumGuests: 30,
        features: ['3-course plated', 'House selection', 'Standard china'],
      },
      {
        name: 'Classic',
        description: 'Our most popular package. Custom menu with premium proteins and sides.',
        pricePerPerson: 75,
        minimumGuests: 30,
        features: ['Custom 3-course menu', 'Premium proteins', 'Optional wine pairing'],
      },
      {
        name: 'Signature',
        description: 'Top-tier experience. Tasting menu, premium ingredients, and dedicated chef on-site.',
        pricePerPerson: 120,
        minimumGuests: 30,
        features: ['5-course tasting menu', 'Premium ingredients', 'Dedicated chef on-site', 'Optional sommelier'],
      },
    ],
    menuItems: [
      {
        name: 'Beef Bourguignon',
        description: 'Slow-braised beef in red wine with pearl onions and mushrooms.',
        category: 'Entrees',
        price: 28,
        allergens: ['Gluten'],
        dietaryInfo: [],
      },
      {
        name: 'Salmon en Croûte',
        description: 'Atlantic salmon wrapped in puff pastry with herb butter.',
        category: 'Entrees',
        price: 32,
        allergens: ['Gluten', 'Fish', 'Dairy'],
        dietaryInfo: [],
      },
      {
        name: 'Mushroom Risotto',
        description: 'Arborio rice with wild mushrooms, parmesan, and truffle oil.',
        category: 'Entrees',
        price: 24,
        allergens: ['Dairy'],
        dietaryInfo: ['Vegetarian'],
      },
      {
        name: 'Tarte au Citron',
        description: 'Classic French lemon tart with shortbread crust.',
        category: 'Desserts',
        price: 12,
        allergens: ['Gluten', 'Dairy', 'Eggs'],
        dietaryInfo: ['Vegetarian'],
      },
      {
        name: 'Charcuterie Board',
        description: 'Selection of Quebec cured meats, artisan cheeses, fruits, and crackers.',
        category: 'Appetizers',
        price: 18,
        allergens: ['Gluten', 'Dairy'],
        dietaryInfo: [],
      },
    ],
    portfolio: [
      {
        title: 'Vineyard Wedding Reception',
        mediaUrl: 'https://picsum.photos/seed/festv-marie-port-1/1200/800',
        eventType: 'Wedding',
        isFeatured: true,
      },
      {
        title: 'Corporate Gala — 200 guests',
        mediaUrl: 'https://picsum.photos/seed/festv-marie-port-2/1200/800',
        eventType: 'Corporate',
      },
      {
        title: 'Private Birthday Dinner',
        mediaUrl: 'https://picsum.photos/seed/festv-marie-port-3/1200/800',
        eventType: 'Birthday',
      },
      {
        title: 'Charcuterie Display',
        mediaUrl: 'https://picsum.photos/seed/festv-marie-port-4/1200/800',
      },
    ],
    cuisineTypes: ['French', 'Canadian', 'Mediterranean'],
    eventThemes: ['Rustic', 'Elegant', 'Garden Party'],
  },

  // ─── 🍸 Bartender (CATERER subset, solo, hourly + per-person) ──────────
  'test-bartender@festv.app': {
    businessName: 'Sam Mix Mobile Bar',
    businessDescription:
      'Cocktail bar service for weddings, private events, and corporate functions. Mobile bar setup with custom menus.',
    primaryType: ProviderType.CATERER, // No BARTENDER enum; using CATERER
    providerTypes: [ProviderType.CATERER],
    isSoloWorker: true,
    bannerImageUrl: 'https://picsum.photos/seed/festv-sam-cover/1600/600',
    logoUrl: 'https://picsum.photos/seed/festv-sam-logo/400/400',
    serviceRadius: 60,
    serviceAreas: ['Montreal', 'Laval', 'Longueuil'],
    pricePerPerson: 22,
    hourlyRate: 150,
    minimumHours: 4,
    fixedFee: 200,
    minimumBudget: 800,
    maximumBudget: 8000,
    depositPercentage: 30,
    minGuestCount: 20,
    maxGuestCount: 200,
    verificationStatus: VerificationStatus.VERIFIED,
    tagline: 'Custom cocktail menus crafted for your event',
    languages: ['English', 'French', 'Spanish'],
    yearsInBusiness: 6,
    instagramHandle: 'sammixbar',
    travelOutsideRegion: true,
    services: [
      {
        name: 'Open Bar (4 hours)',
        description:
          'Full mobile bar setup with house cocktails, beer, wine, and a featured signature cocktail.',
        providerType: ProviderType.CATERER,
        priceType: PriceType.PER_HOUR,
        basePrice: 800,
        pricePerHour: 150,
        minHours: 4,
        maxHours: 8,
        features: ['Mobile bar', 'House cocktails', 'Signature cocktail'],
        includes: ['Mobile bar setup', 'Bartender for 4hrs', 'House cocktails', '1 signature drink', 'Glassware'],
      },
      {
        name: 'Cocktail Station with Custom Menu',
        description:
          'Custom cocktail menu designed around your event. 3–5 signature drinks tailored to your theme.',
        providerType: ProviderType.CATERER,
        priceType: PriceType.PER_PERSON,
        basePrice: 22,
        pricePerPerson: 22,
        minGuests: 30,
        maxGuests: 150,
        features: ['Custom menu', '3–5 signature cocktails', 'Themed presentation'],
        includes: ['Menu development', 'Bartender', 'Garnishes + glassware', 'Setup + cleanup'],
      },
    ],
    menuItems: [
      {
        name: 'Classic Old Fashioned',
        description: 'Bourbon, Demerara sugar, Angostura bitters, orange peel.',
        category: 'Cocktails',
        price: 14,
      },
      {
        name: 'Espresso Martini',
        description: 'Vodka, fresh espresso, coffee liqueur, simple syrup.',
        category: 'Cocktails',
        price: 15,
      },
      {
        name: 'Negroni',
        description: 'Gin, Campari, sweet vermouth, orange peel.',
        category: 'Cocktails',
        price: 14,
      },
      {
        name: 'Maple Old Fashioned',
        description: 'Local twist — bourbon, Quebec maple syrup, walnut bitters.',
        category: 'Signature',
        price: 16,
      },
    ],
    portfolio: [
      {
        title: 'Loft Wedding Bar',
        mediaUrl: 'https://picsum.photos/seed/festv-sam-port-1/1200/800',
        eventType: 'Wedding',
        isFeatured: true,
      },
      {
        title: 'Corporate Holiday Party',
        mediaUrl: 'https://picsum.photos/seed/festv-sam-port-2/1200/800',
        eventType: 'Corporate',
      },
      {
        title: 'Signature Cocktail Setup',
        mediaUrl: 'https://picsum.photos/seed/festv-sam-port-3/1200/800',
      },
    ],
  },

  // ─── 🎧 DJ (ENTERTAINMENT, solo, hourly) ────────────────────────────────
  'test-dj@festv.app': {
    businessName: 'Jordan Beats DJ',
    businessDescription:
      'Wedding & event DJ. House, indie, top-40, customizable. Premium sound and lighting included.',
    primaryType: ProviderType.ENTERTAINMENT,
    providerTypes: [ProviderType.ENTERTAINMENT],
    isSoloWorker: true,
    bannerImageUrl: 'https://picsum.photos/seed/festv-jordan-cover/1600/600',
    logoUrl: 'https://picsum.photos/seed/festv-jordan-logo/400/400',
    serviceRadius: 80,
    serviceAreas: ['Montreal', 'Laval', 'Longueuil', 'Eastern Townships'],
    pricePerPerson: null,
    hourlyRate: 200,
    minimumHours: 4,
    fixedFee: 150,
    minimumBudget: 950,
    maximumBudget: 4000,
    depositPercentage: 25,
    minGuestCount: 1,
    maxGuestCount: 500,
    verificationStatus: VerificationStatus.VERIFIED,
    tagline: 'Premium wedding & event DJ — Montreal and beyond',
    languages: ['English', 'French'],
    yearsInBusiness: 10,
    instagramHandle: 'jordanbeats.dj',
    websiteUrl: 'https://jordanbeats.ca',
    travelOutsideRegion: true,
    services: [
      {
        name: 'Wedding DJ Package (5hr)',
        description:
          'Premium wedding DJ service with sound system, lighting, MC services, and pre-event consultation.',
        providerType: ProviderType.ENTERTAINMENT,
        priceType: PriceType.PER_HOUR,
        basePrice: 1150,
        pricePerHour: 200,
        minHours: 5,
        maxHours: 8,
        features: ['Sound system', 'Lighting', 'MC services'],
        includes: [
          'Pro sound system',
          'Dance floor lighting',
          'Wireless mic',
          'MC for ceremony + reception',
          'Music consultation',
        ],
      },
      {
        name: 'Cocktail/Dinner Background Music (3hr)',
        description:
          'Tasteful background music during cocktail hour and dinner — softer mix, no full DJ setup.',
        providerType: ProviderType.ENTERTAINMENT,
        priceType: PriceType.PER_HOUR,
        basePrice: 750,
        pricePerHour: 200,
        minHours: 3,
        maxHours: 5,
        features: ['Curated playlist', 'Compact setup', 'Wireless mic'],
        includes: ['Speaker system', 'Wireless mic', 'Curated playlist'],
      },
    ],
    portfolio: [
      {
        title: 'Old Port Wedding Reception',
        mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-1/1200/800',
        eventType: 'Wedding',
        isFeatured: true,
      },
      {
        title: 'Birthday Bash — 150 guests',
        mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-2/1200/800',
        eventType: 'Birthday',
      },
      {
        title: 'Corporate Anniversary Event',
        mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-3/1200/800',
        eventType: 'Corporate',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEDER
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedResult {
  email: string;
  userCreated: boolean;
  profileCreated: boolean;  // false if profile already existed (skipped)
  profileSkipped: boolean;  // true if profile existed; false otherwise
}

/**
 * Create the ProviderProfile + all child rows (services, portfolio, menu items,
 * pricing levels, cuisine + theme connections) for a given user.
 * Idempotent: if a profile already exists for (userId, primaryType), skips
 * entirely and returns { created: false }.
 */
async function seedProviderProfile(
  prisma: PrismaClient,
  userId: string,
  data: ProviderProfileData
): Promise<{ profileId: string; created: boolean }> {
  const existing = await prisma.providerProfile.findFirst({
    where: { userId, primaryType: data.primaryType },
    select: { id: true },
  });

  // Upsert lookup-table rows (CuisineType, EventTheme are shared across providers)
  const cuisineConnect: { id: string }[] = [];
  if (data.cuisineTypes && data.cuisineTypes.length > 0) {
    for (const name of data.cuisineTypes) {
      const cuisine = await prisma.cuisineType.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      cuisineConnect.push({ id: cuisine.id });
    }
  }

  const themeConnect: { id: string }[] = [];
  if (data.eventThemes && data.eventThemes.length > 0) {
    for (const name of data.eventThemes) {
      const theme = await prisma.eventTheme.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      themeConnect.push({ id: theme.id });
    }
  }

  if (existing) {
    // Refresh core profile fields on every seed run — fixes stale/null data from old runs
    await prisma.providerProfile.update({
      where: { id: existing.id },
      data: {
        businessName: data.businessName,
        businessDescription: data.businessDescription,
        bannerImageUrl: data.bannerImageUrl,
        logoUrl: data.logoUrl,
        isSoloWorker: data.isSoloWorker,
        verificationStatus: data.verificationStatus,
        verifiedAt: data.verificationStatus === VerificationStatus.VERIFIED ? new Date() : null,
        serviceRadius: data.serviceRadius,
        serviceAreas: data.serviceAreas,
        pricePerPerson: data.pricePerPerson,
        hourlyRate: data.hourlyRate,
        minimumHours: data.minimumHours,
        fixedFee: data.fixedFee,
        minimumBudget: data.minimumBudget,
        maximumBudget: data.maximumBudget,
        depositPercentage: data.depositPercentage,
        minGuestCount: data.minGuestCount,
        maxGuestCount: data.maxGuestCount,
        tagline: data.tagline ?? null,
        languages: data.languages ?? [],
        yearsInBusiness: data.yearsInBusiness ?? null,
        websiteUrl: data.websiteUrl ?? null,
        instagramHandle: data.instagramHandle ?? null,
        travelOutsideRegion: data.travelOutsideRegion ?? false,
        cuisineTypes: cuisineConnect.length > 0 ? { set: cuisineConnect } : undefined,
        eventThemes: themeConnect.length > 0 ? { set: themeConnect } : undefined,
      },
    });

    // TODO: rewire to new schema — Service model removed; use Package model instead
    // const svcCount = await prisma.service.count({ where: { providerId: existing.id } });
    // if (svcCount === 0) { ... }

    // Create menu items if somehow missing
    if (data.menuItems && data.menuItems.length > 0) {
      const menuCount = await prisma.menuItem.count({ where: { providerId: existing.id } });
      if (menuCount === 0) {
        for (const [i, m] of data.menuItems.entries()) {
          await prisma.menuItem.create({
            data: {
              providerId: existing.id,
              name: m.name, description: m.description, category: m.category,
              price: m.price, dietaryInfo: m.dietaryInfo ?? [],
              allergens: m.allergens ?? [], isAvailable: true, displayOrder: i,
            },
          });
        }
      }
    }

    return { profileId: existing.id, created: false };
  }

  // Create profile + all nested children in a single write
  const profile = await prisma.providerProfile.create({
    data: {
      userId,
      businessName: data.businessName,
      businessDescription: data.businessDescription,
      providerTypes: data.providerTypes,
      primaryType: data.primaryType,
      bannerImageUrl: data.bannerImageUrl,
      logoUrl: data.logoUrl,
      isSoloWorker: data.isSoloWorker,
      verificationStatus: data.verificationStatus,
      verifiedAt: data.verificationStatus === VerificationStatus.VERIFIED ? new Date() : null,
      serviceRadius: data.serviceRadius,
      serviceAreas: data.serviceAreas,
      pricePerPerson: data.pricePerPerson,
      hourlyRate: data.hourlyRate,
      minimumHours: data.minimumHours,
      fixedFee: data.fixedFee,
      minimumBudget: data.minimumBudget,
      maximumBudget: data.maximumBudget,
      depositPercentage: data.depositPercentage,
      minGuestCount: data.minGuestCount,
      maxGuestCount: data.maxGuestCount,
      tagline: data.tagline ?? null,
      languages: data.languages ?? [],
      yearsInBusiness: data.yearsInBusiness ?? null,
      websiteUrl: data.websiteUrl ?? null,
      instagramHandle: data.instagramHandle ?? null,
      travelOutsideRegion: data.travelOutsideRegion ?? false,
      // TODO: rewire to new schema — Service model removed; use Package model instead
      // services: { create: data.services.map(...) },
      portfolioItems:
        data.portfolio.length > 0
          ? {
              create: data.portfolio.map((p, i) => ({
                title: p.title,
                description: p.description ?? null,
                mediaType: MediaType.IMAGE,
                mediaUrl: p.mediaUrl,
                thumbnailUrl: p.thumbnailUrl ?? p.mediaUrl,
                eventType: p.eventType ?? null,
                displayOrder: i,
                isFeatured: p.isFeatured ?? false,
                isPublic: true,
              })),
            }
          : undefined,
      menuItems:
        data.menuItems && data.menuItems.length > 0
          ? {
              create: data.menuItems.map((m, i) => ({
                name: m.name,
                description: m.description,
                category: m.category,
                price: m.price,
                dietaryInfo: m.dietaryInfo ?? [],
                allergens: m.allergens ?? [],
                isAvailable: true,
                displayOrder: i,
              })),
            }
          : undefined,
      pricingLevels:
        data.pricingLevels && data.pricingLevels.length > 0
          ? {
              create: data.pricingLevels.map((p, i) => ({
                name: p.name,
                description: p.description,
                pricePerPerson: p.pricePerPerson,
                minimumGuests: p.minimumGuests ?? null,
                features: p.features,
                displayOrder: i,
                isActive: true,
              })),
            }
          : undefined,
      cuisineTypes: cuisineConnect.length > 0 ? { connect: cuisineConnect } : undefined,
      eventThemes: themeConnect.length > 0 ? { connect: themeConnect } : undefined,
    },
    select: { id: true },
  });

  return { profileId: profile.id, created: true };
}

/**
 * Seed mock event requests, quotes, and bookings between Alice (planner) and
 * the 4 test vendors so the Provider Graph has visible connections.
 * Idempotent — skips if any [mock] requests already exist for Alice.
 */
// TODO: rewire to new schema — seedMockConnections disabled; old EventRequest/Quote/Booking fields removed
// async function seedMockConnections(prisma: PrismaClient, aliceId: string): Promise<void> {
//   ... entire body commented out — uses old schema fields (title, budgetMin, budgetMax,
//   eventStartTime, eventEndTime, venueCity, venueState, EventRequestStatus.COMPLETED/BOOKED/QUOTED,
//   providerId, totalAmount, balanceAmount, balancePaidAt, completedAt, etc.)
// }

/**
 * Create or refresh every test account. Idempotent — safe to re-run.
 *
 * - User row: refreshed on every run (password, status, role) so the test
 *   accounts always work even if tampered with.
 * - ProviderProfile + child rows: created once per (user, primaryType).
 *   Subsequent runs skip — no duplicates, manual edits are preserved.
 */
export async function seedTestAccounts(prisma: PrismaClient): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const acc of TEST_ACCOUNTS) {
    const email = acc.email.toLowerCase();
    const passwordHash = await bcrypt.hash(acc.password, config.bcrypt.rounds);

    // ─── User upsert ────────────────────────────────────────────────────
    let userId: string;
    let userCreated = false;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      // Refresh auth state (password + ACTIVE) and identity fields.
      // Do NOT touch city/state/avatar/banner — those were set at creation
      // and we want manual edits to persist.
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
      userId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          role: acc.role,
          roles: acc.roles,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          city: acc.city,
          state: acc.state,
          country: acc.country ?? 'US',
          avatarUrl: acc.avatarUrl,
          bannerUrl: acc.bannerUrl,
        },
        select: { id: true },
      });
      userId = created.id;
      userCreated = true;
    }

    // ─── Provider profile (only for accounts in PROVIDER_PROFILES) ─────
    let profileCreated = false;
    let profileSkipped = false;

    const profileData = PROVIDER_PROFILES[acc.email];
    if (profileData) {
      try {
        const result = await seedProviderProfile(prisma, userId, profileData);
        if (result.created) {
          profileCreated = true;
        } else {
          profileSkipped = true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ⚠️  Failed to seed profile for ${acc.email}: ${msg}`);
      }
    }

    results.push({
      email: acc.email,
      userCreated,
      profileCreated,
      profileSkipped,
    });
  }

  // TODO: rewire to new schema — seedMockConnections disabled; uses old schema fields
  // const aliceUser = await prisma.user.findUnique({
  //   where: { email: 'test-client@festv.app' },
  //   select: { id: true },
  // });
  // if (aliceUser) {
  //   await seedMockConnections(prisma, aliceUser.id);
  // }

  return results;
}
