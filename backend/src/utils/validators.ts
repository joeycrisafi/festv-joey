import { z } from 'zod';
import { UserRole, ProviderType, EventType, ServiceStyle, MediaType, PriceType } from '@prisma/client';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  role: z.enum(['CLIENT', 'PROVIDER']),
  roles: z.array(z.enum(['CLIENT', 'PROVIDER'])).optional(), // Support multiple roles
  phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Provider profile schemas
export const createProviderProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(100),
  businessDescription: z.string().max(5000).optional(),
  providerTypes: z.array(z.nativeEnum(ProviderType)).min(1, 'At least one provider type required'),
  primaryType: z.nativeEnum(ProviderType).optional(), // Main service type for this profile
  
  // Solo worker vs Company (for caterers/bartenders)
  isSoloWorker: z.boolean().optional(),
  
  // Service area
  serviceRadius: z.number().int().min(1).max(500).optional(),
  serviceAreas: z.array(z.string()).optional(),
  
  // Per-person pricing (for companies: caterers, florists, decorators, equipment, bartender companies)
  minimumBudget: z.number().min(0).optional(),
  maximumBudget: z.number().min(0).optional(),
  pricePerPerson: z.number().min(0).optional(),
  depositPercentage: z.number().min(0).max(100).optional(),
  minGuestCount: z.number().int().min(1).optional(),
  maxGuestCount: z.number().int().min(1).optional(),
  
  // Pricing levels (for per-person pricing models)
  pricingLevels: z.array(z.object({
    name: z.string().min(1, 'Level name is required').max(50),
    description: z.string().max(500).optional(),
    pricePerPerson: z.number().min(0, 'Price must be positive'),
    minimumGuests: z.number().int().min(1).optional(),
    features: z.array(z.string()).optional(),
  })).optional(),
  
  // Hourly pricing (for solo workers and hourly services: photographers, videographers, DJs, musicians)
  hourlyRate: z.number().min(0).optional(),
  minimumHours: z.number().int().min(1).optional(),
  fixedFee: z.number().min(0).optional(), // Optional setup/travel fee
  
  // Operating
  operatingDays: z.array(z.string()).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
});

export const updateProviderProfileSchema = createProviderProfileSchema.partial();

// Service schemas
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Service name is required').max(100),
  description: z.string().min(3, 'Description is required').max(2000),
  providerType: z.nativeEnum(ProviderType),
  priceType: z.nativeEnum(PriceType),
  basePrice: z.number().min(0, 'Base price must be positive'),
  pricePerPerson: z.number().min(0).optional(),
  pricePerHour: z.number().min(0).optional(),
  minGuests: z.number().int().min(1).optional(),
  maxGuests: z.number().int().min(1).optional(),
  minHours: z.number().min(0.5).optional(),
  maxHours: z.number().min(0.5).optional(),
  features: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// Event request schemas
const eventRequestBaseSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  eventType: z.nativeEnum(EventType),
  description: z.string().max(5000).optional(),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(10000),
  budgetMin: z.number().min(0, 'Minimum budget must be positive'),
  budgetMax: z.number().min(0, 'Maximum budget must be positive'),
  eventDate: z.string().or(z.date()).transform(val => new Date(val)),
  eventStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  eventEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  venueName: z.string().max(100).optional(),
  venueAddress: z.string().min(5, 'Venue address is required').max(200),
  venueCity: z.string().min(2, 'Venue city is required').max(100),
  venueState: z.string().min(2, 'Venue state is required').max(50),
  venueZipCode: z.string().min(5, 'Venue zip code is required').max(10),
  venueNotes: z.string().max(1000).optional(),
  cuisineTypeIds: z.array(z.string().uuid()).optional(),
  eventThemeIds: z.array(z.string().uuid()).optional(),
  equipmentIds: z.array(z.string().uuid()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  serviceStyle: z.nativeEnum(ServiceStyle).optional(),
  serviceStyles: z.array(z.nativeEnum(ServiceStyle)).optional(),
  needsStaffing: z.boolean().optional(),
  staffCount: z.number().int().min(0).optional(),
  needsCleanup: z.boolean().optional(),
  needsSetup: z.boolean().optional(),
  servicesWanted: z.array(z.nativeEnum(ProviderType)).optional(),
});

export const createEventRequestSchema = eventRequestBaseSchema.refine(data => data.budgetMax >= data.budgetMin, {
  message: 'Maximum budget must be greater than or equal to minimum budget',
  path: ['budgetMax'],
});

export const updateEventRequestSchema = eventRequestBaseSchema.partial();

// Quote schemas
export const createQuoteSchema = z.object({
  eventRequestId: z.string().uuid(),
  message: z.string().max(2000).optional(),
  items: z.array(z.object({
    serviceId: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
  })).min(1, 'At least one item is required'),
  taxRate: z.number().min(0).max(100).optional(),
  serviceFee: z.number().min(0).optional(),
  gratuity: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  validDays: z.number().int().min(1).max(90).optional(),
});

// Review schemas
export const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  overallRating: z.number().min(1).max(5),
  foodQuality: z.number().min(1).max(5).optional(),
  presentation: z.number().min(1).max(5).optional(),
  punctuality: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  valueForMoney: z.number().min(1).max(5).optional(),
  title: z.string().max(100).optional(),
  content: z.string().min(10, 'Review must be at least 10 characters').max(2000),
});

export const providerResponseSchema = z.object({
  response: z.string().min(10).max(1000),
});

// Portfolio schemas
export const createPortfolioItemSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  mediaType: z.nativeEnum(MediaType),
  eventType: z.string().max(50).optional(),
  guestCount: z.number().int().min(1).optional(),
  eventDate: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  attachmentUrls: z.array(z.string().url()).max(5).optional(),
});

// Search schemas
export const providerSearchSchema = z.object({
  providerTypes: z.array(z.nativeEnum(ProviderType)).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  eventThemes: z.array(z.string()).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  guestCount: z.coerce.number().int().min(1).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  availableDate: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(['rating', 'reviews', 'price', 'distance']).default('rating'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// User update schema
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phoneNumber: z.string().optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(10).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Cuisine and Theme schemas
export const createCuisineTypeSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
});

export const createEventThemeSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
});

// Equipment schema
export const createEquipmentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['PLATING', 'SERVING', 'COOKING', 'DISPLAY', 'FURNITURE', 'LIGHTING', 'AUDIO', 'OTHER']),
  rentalPrice: z.number().min(0).optional(),
  isIncluded: z.boolean().optional(),
});

// Availability schema
export const setAvailabilitySchema = z.object({
  dates: z.array(z.object({
    date: z.string().or(z.date()).transform(val => new Date(val)),
    isAvailable: z.boolean(),
    notes: z.string().max(200).optional(),
  })),
});
