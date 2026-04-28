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
 *   - ProviderProfile + child rows are created ONCE. Subsequent runs
 *     update core fields only (businessName, verificationStatus, etc.)
 *     and create missing packages/menu items, but do not duplicate rows.
 *
 * NOTE: Services model was removed — providers now use Package model.
 *       seedProviderProfile creates Package rows if none exist.
 *
 * DEV ONLY. Never set ENABLE_TEST_ACCOUNTS=true in production.
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
  PricingModel,
} from '@prisma/client';
import { config } from './config/index.js';

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
  label: string;
  emoji: string;
  city?: string;
  state?: string;
  country?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

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

interface PackageData {
  name: string;
  description?: string;
  category: string;
  pricingModel: PricingModel;
  basePrice: number;
  minimumSpend?: number;
  minGuests?: number;
  maxGuests?: number;
  durationHours?: number;
  included: string[];
  eventTypes: EventType[];
  isActive: boolean;
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
  tagline?: string;
  languages?: string[];
  yearsInBusiness?: number;
  websiteUrl?: string;
  instagramHandle?: string;
  travelOutsideRegion?: boolean;
  packages: PackageData[];
  portfolio: PortfolioData[];
  menuItems?: MenuItemData[];
  cuisineTypes?: string[];
  eventThemes?: string[];
}

const PROVIDER_PROFILES: Record<string, ProviderProfileData> = {

  // ── 📷 Photographer (PHOTO_VIDEO, solo, hourly) ──────────────────────────
  'test-photographer@festv.app': {
    businessName: 'Alex Photo Studio',
    businessDescription: 'Editorial wedding & event photography. Clean, candid, modern. Based in Montreal, available across Quebec.',
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
    packages: [
      {
        name: 'Half-Day Coverage',
        description: '4 hours of professional photography — ceremony, portraits, and key moments.',
        category: 'Coverage Packages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 250,
        durationHours: 4,
        minimumSpend: 1000,
        included: ['100+ edited photos', 'Online gallery', '2-week delivery', 'Print release'],
        eventTypes: [EventType.WEDDING, EventType.BIRTHDAY, EventType.CORPORATE],
        isActive: true,
      },
      {
        name: 'Full-Day Coverage',
        description: '8 hours of coverage — prep through reception. 400+ edited photos, highlight reel, and gallery.',
        category: 'Coverage Packages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 250,
        durationHours: 8,
        minimumSpend: 2000,
        included: ['400+ edited photos', 'Highlight reel', 'Online gallery', 'Print release'],
        eventTypes: [EventType.WEDDING, EventType.CORPORATE, EventType.ANNIVERSARY],
        isActive: true,
      },
      {
        name: 'Engagement Session',
        description: '2-hour portrait session for couples. 60+ edited photos, perfect for save-the-dates.',
        category: 'Production & Extras',
        pricingModel: PricingModel.FLAT_RATE,
        basePrice: 500,
        included: ['60+ edited photos', 'Online gallery', 'Print release'],
        eventTypes: [EventType.ANNIVERSARY, EventType.WEDDING, EventType.SOCIAL],
        isActive: true,
      },
    ],
    portfolio: [
      { title: 'Mont-Tremblant Wedding', description: 'Outdoor ceremony in the Laurentians.', mediaUrl: 'https://picsum.photos/seed/festv-alex-port-1/1200/800', eventType: 'Wedding', isFeatured: true },
      { title: 'Old Montreal Engagement', mediaUrl: 'https://picsum.photos/seed/festv-alex-port-2/1200/800', eventType: 'Engagement' },
      { title: 'Loft Studio Wedding', mediaUrl: 'https://picsum.photos/seed/festv-alex-port-3/1200/800', eventType: 'Wedding' },
      { title: 'Eastern Townships Brunch', mediaUrl: 'https://picsum.photos/seed/festv-alex-port-4/1200/800', eventType: 'Brunch' },
    ],
  },

  // ── 🍽️ Caterer (CATERER, company, per-person) ─────────────────────────────
  'test-caterer@festv.app': {
    businessName: "Marie's Kitchen",
    businessDescription: 'Refined French-Canadian catering for weddings, corporate events, and private dinners. Locally sourced, seasonally inspired.',
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
    tagline: "Refined French-Canadian catering for life's finest moments",
    languages: ['French', 'English'],
    yearsInBusiness: 12,
    instagramHandle: 'marieskitchen.mtl',
    websiteUrl: 'https://marieskitchen.ca',
    travelOutsideRegion: false,
    packages: [
      {
        name: 'Bistro Package',
        description: 'Casual yet elevated. 3-course plated meal with seasonal sides.',
        category: 'Food & Menu',
        pricingModel: PricingModel.PER_PERSON,
        basePrice: 50,
        minimumSpend: 1500,
        minGuests: 30,
        maxGuests: 300,
        included: ['3-course plated', 'House selection', 'Standard china', 'Staff', 'Setup + cleanup'],
        eventTypes: [EventType.CORPORATE, EventType.BIRTHDAY, EventType.SOCIAL],
        isActive: true,
      },
      {
        name: 'Classic Wedding Package',
        description: 'Our most popular option — custom 3-course menu with premium proteins and full service.',
        category: 'Food & Menu',
        pricingModel: PricingModel.PER_PERSON,
        basePrice: 75,
        minimumSpend: 3750,
        minGuests: 50,
        maxGuests: 250,
        included: ['Custom 3-course menu', 'Premium proteins', 'Wait staff', 'China + glassware', 'Setup + cleanup'],
        eventTypes: [EventType.WEDDING, EventType.ANNIVERSARY, EventType.CORPORATE],
        isActive: true,
      },
      {
        name: 'Signature Tasting Menu',
        description: '5-course tasting experience with premium ingredients and a dedicated chef on-site.',
        category: 'Food & Menu',
        pricingModel: PricingModel.PER_PERSON,
        basePrice: 120,
        minimumSpend: 6000,
        minGuests: 50,
        maxGuests: 150,
        included: ['5-course tasting menu', 'Dedicated on-site chef', 'Premium ingredients', 'China + glassware', 'Full staff'],
        eventTypes: [EventType.WEDDING, EventType.ANNIVERSARY, EventType.DINNER_PARTY],
        isActive: true,
      },
    ],
    menuItems: [
      { name: 'Beef Bourguignon', description: 'Slow-braised beef in red wine with pearl onions and mushrooms.', category: 'Entrees', price: 28, allergens: ['Gluten'], dietaryInfo: [] },
      { name: 'Salmon en Croûte', description: 'Atlantic salmon wrapped in puff pastry with herb butter.', category: 'Entrees', price: 32, allergens: ['Gluten', 'Fish', 'Dairy'], dietaryInfo: [] },
      { name: 'Mushroom Risotto', description: 'Arborio rice with wild mushrooms, parmesan, and truffle oil.', category: 'Entrees', price: 24, allergens: ['Dairy'], dietaryInfo: ['Vegetarian'] },
      { name: 'Tarte au Citron', description: 'Classic French lemon tart with shortbread crust.', category: 'Desserts', price: 12, allergens: ['Gluten', 'Dairy', 'Eggs'], dietaryInfo: ['Vegetarian'] },
      { name: 'Charcuterie Board', description: 'Quebec cured meats, artisan cheeses, fruits, and crackers.', category: 'Appetizers', price: 18, allergens: ['Gluten', 'Dairy'], dietaryInfo: [] },
    ],
    portfolio: [
      { title: 'Vineyard Wedding Reception', mediaUrl: 'https://picsum.photos/seed/festv-marie-port-1/1200/800', eventType: 'Wedding', isFeatured: true },
      { title: 'Corporate Gala — 200 guests', mediaUrl: 'https://picsum.photos/seed/festv-marie-port-2/1200/800', eventType: 'Corporate' },
      { title: 'Private Birthday Dinner', mediaUrl: 'https://picsum.photos/seed/festv-marie-port-3/1200/800', eventType: 'Birthday' },
      { title: 'Charcuterie Display', mediaUrl: 'https://picsum.photos/seed/festv-marie-port-4/1200/800' },
    ],
    cuisineTypes: ['French', 'Canadian', 'Mediterranean'],
    eventThemes: ['Rustic', 'Elegant', 'Garden Party'],
  },

  // ── 🍸 Bartender (CATERER, solo, hourly + per-person) ─────────────────────
  'test-bartender@festv.app': {
    businessName: 'Sam Mix Mobile Bar',
    businessDescription: 'Cocktail bar service for weddings, private events, and corporate functions. Mobile bar setup with custom menus.',
    primaryType: ProviderType.CATERER,
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
    packages: [
      {
        name: 'Open Bar (4 hr)',
        description: 'Full mobile bar — house cocktails, beer, wine, and one signature cocktail for your event.',
        category: 'Bar & Beverages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 150,
        durationHours: 4,
        minimumSpend: 800,
        included: ['Mobile bar setup', 'House cocktails', 'Beer + wine', '1 signature drink', 'Glassware'],
        eventTypes: [EventType.WEDDING, EventType.BIRTHDAY, EventType.CORPORATE, EventType.COCKTAIL_PARTY],
        isActive: true,
      },
      {
        name: 'Custom Cocktail Menu',
        description: '3–5 signature cocktails tailored to your event theme. Per-person pricing includes all service.',
        category: 'Bar & Beverages',
        pricingModel: PricingModel.PER_PERSON,
        basePrice: 22,
        minimumSpend: 660,
        minGuests: 30,
        maxGuests: 150,
        included: ['Custom menu design', 'Bartender', 'Garnishes + glassware', 'Setup + cleanup'],
        eventTypes: [EventType.WEDDING, EventType.BIRTHDAY, EventType.COCKTAIL_PARTY, EventType.CORPORATE],
        isActive: true,
      },
    ],
    menuItems: [
      { name: 'Classic Old Fashioned', description: 'Bourbon, Demerara sugar, Angostura bitters, orange peel.', category: 'Cocktails', price: 14, allergens: [], dietaryInfo: [] },
      { name: 'Espresso Martini', description: 'Vodka, fresh espresso, coffee liqueur, simple syrup.', category: 'Cocktails', price: 15, allergens: [], dietaryInfo: [] },
      { name: 'Negroni', description: 'Gin, Campari, sweet vermouth, orange peel.', category: 'Cocktails', price: 14, allergens: [], dietaryInfo: [] },
      { name: 'Maple Old Fashioned', description: 'Local twist — bourbon, Quebec maple syrup, walnut bitters.', category: 'Signature', price: 16, allergens: [], dietaryInfo: [] },
    ],
    portfolio: [
      { title: 'Loft Wedding Bar', mediaUrl: 'https://picsum.photos/seed/festv-sam-port-1/1200/800', eventType: 'Wedding', isFeatured: true },
      { title: 'Corporate Holiday Party', mediaUrl: 'https://picsum.photos/seed/festv-sam-port-2/1200/800', eventType: 'Corporate' },
      { title: 'Signature Cocktail Setup', mediaUrl: 'https://picsum.photos/seed/festv-sam-port-3/1200/800' },
    ],
  },

  // ── 🎧 DJ (ENTERTAINMENT, solo, hourly) ───────────────────────────────────
  'test-dj@festv.app': {
    businessName: 'Jordan Beats DJ',
    businessDescription: 'Wedding & event DJ. House, indie, top-40, customizable. Premium sound and lighting included.',
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
    packages: [
      {
        name: 'Wedding DJ Package',
        description: 'Premium wedding DJ with full sound system, dance floor lighting, MC services, and consultation.',
        category: 'Performance Packages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 200,
        durationHours: 5,
        minimumSpend: 1150,
        included: ['Pro sound system', 'Dance floor lighting', 'Wireless mic', 'MC for ceremony + reception', 'Music consultation'],
        eventTypes: [EventType.WEDDING, EventType.ANNIVERSARY],
        isActive: true,
      },
      {
        name: 'Event DJ (4 hr)',
        description: 'Full DJ setup for birthday parties, corporate events, and social functions.',
        category: 'Performance Packages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 200,
        durationHours: 4,
        minimumSpend: 950,
        included: ['Sound system', 'Lighting', 'DJ for 4 hours'],
        eventTypes: [EventType.BIRTHDAY, EventType.CORPORATE, EventType.SOCIAL, EventType.GRADUATION],
        isActive: true,
      },
      {
        name: 'Cocktail Hour Music',
        description: 'Tasteful background music for cocktail or dinner — curated playlist, compact setup.',
        category: 'Performance Packages',
        pricingModel: PricingModel.PER_HOUR,
        basePrice: 200,
        durationHours: 3,
        minimumSpend: 600,
        included: ['Speaker system', 'Wireless mic', 'Curated playlist'],
        eventTypes: [EventType.WEDDING, EventType.CORPORATE, EventType.DINNER_PARTY, EventType.COCKTAIL_PARTY],
        isActive: true,
      },
    ],
    portfolio: [
      { title: 'Old Port Wedding Reception', mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-1/1200/800', eventType: 'Wedding', isFeatured: true },
      { title: 'Birthday Bash — 150 guests', mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-2/1200/800', eventType: 'Birthday' },
      { title: 'Corporate Anniversary Event', mediaUrl: 'https://picsum.photos/seed/festv-jordan-port-3/1200/800', eventType: 'Corporate' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEDER
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedResult {
  email: string;
  userCreated: boolean;
  profileCreated: boolean;
  profileSkipped: boolean;
}

async function seedProviderProfile(
  prisma: PrismaClient,
  userId: string,
  data: ProviderProfileData,
): Promise<{ profileId: string; created: boolean }> {
  const existing = await prisma.providerProfile.findFirst({
    where: { userId, primaryType: data.primaryType },
    select: { id: true },
  });

  // Upsert CuisineType / EventTheme lookup rows
  const cuisineConnect: { id: string }[] = [];
  for (const name of data.cuisineTypes ?? []) {
    const row = await prisma.cuisineType.upsert({ where: { name }, update: {}, create: { name } });
    cuisineConnect.push({ id: row.id });
  }
  const themeConnect: { id: string }[] = [];
  for (const name of data.eventThemes ?? []) {
    const row = await prisma.eventTheme.upsert({ where: { name }, update: {}, create: { name } });
    themeConnect.push({ id: row.id });
  }

  if (existing) {
    // Refresh core fields every run so stale data (null businessName etc.) gets fixed
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

    // Create packages if none exist (idempotent)
    if (data.packages && data.packages.length > 0) {
      const pkgCount = await prisma.package.count({ where: { providerProfileId: existing.id } });
      if (pkgCount === 0) {
        for (const pkg of data.packages) {
          await prisma.package.create({
            data: {
              providerProfileId: existing.id,
              name: pkg.name,
              description: pkg.description ?? null,
              category: pkg.category,
              pricingModel: pkg.pricingModel,
              basePrice: pkg.basePrice,
              minimumSpend: pkg.minimumSpend ?? null,
              minGuests: pkg.minGuests ?? null,
              maxGuests: pkg.maxGuests ?? null,
              durationHours: pkg.durationHours ?? null,
              included: pkg.included,
              eventTypes: pkg.eventTypes,
              isActive: pkg.isActive,
            },
          });
        }
      }
    }

    // Create menu items if none exist (idempotent)
    if (data.menuItems && data.menuItems.length > 0) {
      const menuCount = await prisma.menuItem.count({ where: { providerId: existing.id } });
      if (menuCount === 0) {
        for (const [i, m] of data.menuItems.entries()) {
          await prisma.menuItem.create({
            data: {
              providerId: existing.id,
              name: m.name,
              description: m.description,
              category: m.category,
              price: m.price,
              dietaryInfo: m.dietaryInfo ?? [],
              allergens: m.allergens ?? [],
              isAvailable: true,
              displayOrder: i,
            },
          });
        }
      }
    }

    return { profileId: existing.id, created: false };
  }

  // ── CREATE new profile with all children ─────────────────────────────────
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
      packages:
        data.packages.length > 0
          ? {
              create: data.packages.map((pkg) => ({
                name: pkg.name,
                description: pkg.description ?? null,
                category: pkg.category,
                pricingModel: pkg.pricingModel,
                basePrice: pkg.basePrice,
                minimumSpend: pkg.minimumSpend ?? null,
                minGuests: pkg.minGuests ?? null,
                maxGuests: pkg.maxGuests ?? null,
                durationHours: pkg.durationHours ?? null,
                included: pkg.included,
                eventTypes: pkg.eventTypes,
                isActive: pkg.isActive,
              })),
            }
          : undefined,
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
      cuisineTypes: cuisineConnect.length > 0 ? { connect: cuisineConnect } : undefined,
      eventThemes: themeConnect.length > 0 ? { connect: themeConnect } : undefined,
    },
    select: { id: true },
  });

  return { profileId: profile.id, created: true };
}

export async function seedTestAccounts(prisma: PrismaClient): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const acc of TEST_ACCOUNTS) {
    const email = acc.email.toLowerCase();
    const passwordHash = await bcrypt.hash(acc.password, config.bcrypt.rounds);

    let userId: string;
    let userCreated = false;

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
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
      userId = existingUser.id;
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

    let profileCreated = false;
    let profileSkipped = false;

    const profileData = PROVIDER_PROFILES[acc.email];
    if (profileData) {
      try {
        const result = await seedProviderProfile(prisma, userId, profileData);
        profileCreated = result.created;
        profileSkipped = !result.created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ⚠️  Failed to seed profile for ${acc.email}: ${msg}`);
      }
    }

    results.push({ email: acc.email, userCreated, profileCreated, profileSkipped });
  }

  return results;
}
