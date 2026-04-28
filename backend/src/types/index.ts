import { Request } from 'express';
import { User, UserRole, ProviderType, EventType, MediaType } from '@prisma/client';

// ServiceStyle is an orphaned enum in the new schema — define locally to keep types compilable
type ServiceStyle = 'BUFFET' | 'PLATED' | 'FAMILY_STYLE' | 'FOOD_STATIONS' | 'COCKTAIL' | 'DROP_OFF' | 'FOOD_TRUCK' | 'CUSTOM';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    roles: UserRole[];
    firstName: string;
    lastName: string;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search/Filter Types
export interface ProviderSearchParams extends PaginationParams {
  providerTypes?: ProviderType[];
  cuisineTypes?: string[];
  eventThemes?: string[];
  minRating?: number;
  maxBudget?: number;
  minBudget?: number;
  guestCount?: number;
  city?: string;
  state?: string;
  serviceRadius?: number;
  availableDate?: Date;
}

export interface EventRequestFilters extends PaginationParams {
  status?: string;
  eventType?: EventType;
  dateFrom?: Date;
  dateTo?: Date;
  minBudget?: number;
  maxBudget?: number;
  minGuests?: number;
  maxGuests?: number;
}

// Auth Types
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phoneNumber?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Event Request Types
export interface CreateEventRequestInput {
  title: string;
  eventType: EventType;
  description?: string;
  guestCount: number;
  budgetMin: number;
  budgetMax: number;
  eventDate: Date;
  venueName?: string;
  venueAddress: string;
  venueCity: string;
  venueState: string;
  venueZipCode: string;
  venueNotes?: string;
  cuisineTypeIds?: string[];
  eventThemeIds?: string[];
  equipmentIds?: string[];
  dietaryRestrictions?: string[];
  allergies?: string[];
  serviceStyle?: ServiceStyle;
  needsStaffing?: boolean;
  staffCount?: number;
  needsCleanup?: boolean;
  needsSetup?: boolean;
  servicesWanted?: ProviderType[];
}

// Provider Profile Types
export interface CreateProviderProfileInput {
  businessName: string;
  businessDescription: string;
  providerTypes: ProviderType[];
  serviceRadius?: number;
  serviceAreas?: string[];
  minimumBudget?: number;
  maximumBudget?: number;
  pricePerPerson?: number;
  depositPercentage?: number;
  minGuestCount?: number;
  maxGuestCount?: number;
  operatingDays?: string[];
  leadTimeDays?: number;
}

// Service Types
export interface CreateServiceInput {
  name: string;
  description: string;
  providerType: ProviderType;
  priceType: 'FLAT_RATE' | 'PER_PERSON' | 'PER_HOUR' | 'CUSTOM';
  basePrice: number;
  pricePerPerson?: number;
  pricePerHour?: number;
  minGuests?: number;
  maxGuests?: number;
  minHours?: number;
  maxHours?: number;
  features?: string[];
  includes?: string[];
  excludes?: string[];
}

// Quote Types
export interface CreateQuoteInput {
  message?: string;
  items: QuoteItemInput[];
  discount?: number;
  validDays?: number;
}

export interface QuoteItemInput {
  serviceId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

// Portfolio Types
export interface CreatePortfolioItemInput {
  title: string;
  description?: string;
  mediaType: MediaType;
  eventType?: string;
  guestCount?: number;
  eventDate?: Date;
  tags?: string[];
}

// Review Types
export interface CreateReviewInput {
  bookingId: string;
  overallRating: number;
  foodQuality?: number;
  presentation?: number;
  punctuality?: number;
  communication?: number;
  valueForMoney?: number;
  title?: string;
  content: string;
}

// Message Types
export interface SendMessageInput {
  recipientId: string;
  content: string;
  attachmentUrls?: string[];
}

// WebSocket Event Types
export interface WSMessage {
  type: 'NEW_MESSAGE' | 'NEW_QUOTE' | 'QUOTE_UPDATE' | 'BOOKING_UPDATE' | 'NOTIFICATION';
  payload: any;
}
