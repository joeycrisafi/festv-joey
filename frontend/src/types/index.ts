export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

export type ProviderType = 
  | 'CATERER' 
  | 'DJ' 
  | 'DECORATOR' 
  | 'MUSICIAN' 
  | 'PHOTOGRAPHER' 
  | 'VIDEOGRAPHER' 
  | 'FLORIST' 
  | 'EVENT_PLANNER' 
  | 'BARTENDER' 
  | 'RENTAL_EQUIPMENT' 
  | 'OTHER';

export type EventType = 
  | 'WEDDING' 
  | 'CORPORATE' 
  | 'BIRTHDAY' 
  | 'ANNIVERSARY' 
  | 'GRADUATION' 
  | 'BABY_SHOWER' 
  | 'BRIDAL_SHOWER' 
  | 'HOLIDAY' 
  | 'MEMORIAL' 
  | 'FUNDRAISER' 
  | 'SOCIAL' 
  | 'OTHER';

export type BookingStatus = 
  | 'PENDING_DEPOSIT' 
  | 'DEPOSIT_PAID' 
  | 'CONFIRMED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'REFUNDED' 
  | 'DISPUTED';

export type QuoteStatus = 
  | 'DRAFT' 
  | 'SENT' 
  | 'VIEWED' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'WITHDRAWN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: UserRole[];
  avatarUrl?: string;
  bannerUrl?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  createdAt: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  providerProfiles?: ProviderProfileSummary[];
}

export interface ProviderProfileSummary {
  id: string;
  businessName: string;
  providerTypes: ProviderType[];
  primaryType?: ProviderType;
  averageRating: number;
  totalReviews: number;
}

export interface ProviderProfile {
  id: string;
  userId: string;
  businessName: string;
  businessDescription: string;
  logoUrl?: string;
  coverImageUrl?: string;
  providerTypes: ProviderType[];
  primaryType?: ProviderType;
  
  // Solo worker vs Company
  isSoloWorker?: boolean;
  
  // Stats
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  
  // Service area
  serviceRadius?: number;
  serviceAreas?: string[];
  
  // Per-person pricing
  pricePerPerson?: number;
  minimumBudget?: number;
  maximumBudget?: number;
  depositPercentage?: number;
  minGuestCount?: number;
  maxGuestCount?: number;
  
  // Hourly pricing
  hourlyRate?: number;
  minimumHours?: number;
  fixedFee?: number;
  
  isVerified: boolean;
  user: User;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  basePrice: number;
  pricePerPerson?: number;
  features: string[];
  includes: string[];
}

export interface EventRequest {
  id: string;
  title: string;
  eventType: EventType;
  description?: string;
  guestCount: number;
  budgetMin: number;
  budgetMax: number;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  venueAddress: string;
  venueCity: string;
  venueState: string;
  status: string;
  quotes?: Quote[];
}

export interface Quote {
  id: string;
  eventRequestId: string;
  providerId: string;
  status: QuoteStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  message?: string;
  validUntil: string;
  provider: ProviderProfile;
  items: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Booking {
  id: string;
  eventRequestId: string;
  quoteId: string;
  clientId: string;
  providerId: string;
  status: BookingStatus;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  balancePaid: boolean;
  eventRequest: EventRequest;
  provider: ProviderProfile;
  quote: Quote;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  mediaUrl: string;
  thumbnailUrl?: string;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
}

export interface Review {
  id: string;
  bookingId: string;
  clientId: string;
  providerId: string;
  overallRating: number;
  foodQualityRating?: number;
  presentationRating?: number;
  punctualityRating?: number;
  communicationRating?: number;
  valueForMoneyRating?: number;
  title?: string;
  content: string;
  createdAt: string;
  client: User;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
