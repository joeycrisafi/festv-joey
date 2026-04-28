const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    let errorMessage = data.message || data.error || 'An error occurred';
    if (data.details && Array.isArray(data.details)) {
      const fieldErrors = data.details
        .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
        .join(', ');
      errorMessage = `${errorMessage} (${fieldErrors})`;
    }
    throw new Error(errorMessage);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'CLIENT' | 'PROVIDER';
    roles?: ('CLIENT' | 'PROVIDER')[];
  }) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  getMe: (token: string) =>
    apiFetch('/auth/me', { token }),

  logout: (token: string, refreshToken: string) =>
    apiFetch('/auth/logout', { method: 'POST', token, body: JSON.stringify({ refreshToken }) }),

  switchRole: (role: string, token: string) =>
    apiFetch('/auth/switch-role', { method: 'POST', token, body: JSON.stringify({ role }) }),

  addRole: (role: string, token: string) =>
    apiFetch('/auth/add-role', { method: 'POST', token, body: JSON.stringify({ role }) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────
export const providersApi = {
  search: (params: Record<string, string | number | undefined>, token?: string) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    return apiFetch(`/providers/search?${searchParams.toString()}`, { token });
  },

  getById: (id: string, token?: string) =>
    apiFetch(`/providers/${id}`, { token }),

  getPortfolio: (id: string) =>
    apiFetch(`/providers/${id}/portfolio`),

  getMyProfile: (token: string) =>
    apiFetch('/providers/profile/me', { token }),

  getMyProfiles: (token: string) =>
    apiFetch('/providers/profile/all', { token }),

  createProfile: (data: Record<string, unknown>, token: string) =>
    apiFetch('/providers/profile', { method: 'POST', token, body: JSON.stringify(data) }),

  updateProfile: (data: Record<string, unknown>, token: string) =>
    apiFetch('/providers/profile', { method: 'PUT', token, body: JSON.stringify(data) }),

  getMenuItems: (providerId: string) =>
    apiFetch(`/providers/${providerId}/menu-items`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Packages
// ─────────────────────────────────────────────────────────────────────────────
export const packagesApi = {
  getEstimate: (data: Record<string, unknown>) =>
    apiFetch('/packages/estimate', { method: 'POST', body: JSON.stringify(data) }),

  getById: (id: string, token?: string) =>
    apiFetch(`/packages/${id}`, { token }),

  getMyPackages: (token: string) =>
    apiFetch('/packages/me', { token }),

  create: (data: Record<string, unknown>, token: string) =>
    apiFetch('/packages', { method: 'POST', token, body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/packages/${id}`, { method: 'PUT', token, body: JSON.stringify(data) }),

  delete: (id: string, token: string) =>
    apiFetch(`/packages/${id}`, { method: 'DELETE', token }),

  toggleActive: (id: string, token: string) =>
    apiFetch(`/packages/${id}/toggle`, { method: 'PATCH', token }),

  addSeasonalRule: (id: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/packages/${id}/seasonal-rules`, { method: 'POST', token, body: JSON.stringify(data) }),

  addDowRule: (id: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/packages/${id}/dow-rules`, { method: 'POST', token, body: JSON.stringify(data) }),

  getProviderPackages: (providerId: string) =>
    apiFetch(`/providers/${providerId}/packages`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Add-ons
// ─────────────────────────────────────────────────────────────────────────────
export const addOnsApi = {
  getMyAddOns: (token: string) =>
    apiFetch('/addons/me', { token }),

  create: (data: Record<string, unknown>, token: string) =>
    apiFetch('/addons', { method: 'POST', token, body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/addons/${id}`, { method: 'PUT', token, body: JSON.stringify(data) }),

  delete: (id: string, token: string) =>
    apiFetch(`/addons/${id}`, { method: 'DELETE', token }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────────────
export const availabilityApi = {
  getMyBlocks: (token: string) =>
    apiFetch('/availability/me', { token }),

  blockDate: (data: Record<string, unknown>, token: string) =>
    apiFetch('/availability', { method: 'POST', token, body: JSON.stringify(data) }),

  deleteBlock: (id: string, token: string) =>
    apiFetch(`/availability/${id}`, { method: 'DELETE', token }),

  check: (params: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return apiFetch(`/availability/check?${searchParams.toString()}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Event Requests
// ─────────────────────────────────────────────────────────────────────────────
export const eventRequestsApi = {
  create: (data: Record<string, unknown>, token: string) =>
    apiFetch('/event-requests', { method: 'POST', token, body: JSON.stringify(data) }),

  getMyRequestsAsClient: (token: string) =>
    apiFetch('/event-requests/me/client', { token }),

  getMyRequestsAsVendor: (token: string) =>
    apiFetch('/event-requests/me/vendor', { token }),

  getIncoming: (token: string, params?: Record<string, string>) => {
    const searchParams = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/event-requests/incoming${searchParams}`, { token });
  },

  getById: (id: string, token: string) =>
    apiFetch(`/event-requests/${id}`, { token }),

  updateStatus: (id: string, status: string, token: string) =>
    apiFetch(`/event-requests/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ status }) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────────────────
export const quotesApi = {
  autoGenerate: (data: Record<string, unknown>, token: string) =>
    apiFetch('/quotes/auto-generate', { method: 'POST', token, body: JSON.stringify(data) }),

  createManual: (data: Record<string, unknown>, token: string) =>
    apiFetch('/quotes/manual', { method: 'POST', token, body: JSON.stringify(data) }),

  getMyQuotesAsClient: (token: string) =>
    apiFetch('/quotes/me/client', { token }),

  getMyQuotesAsVendor: (token: string) =>
    apiFetch('/quotes/me/vendor', { token }),

  getById: (id: string, token: string) =>
    apiFetch(`/quotes/${id}`, { token }),

  accept: (id: string, token: string) =>
    apiFetch(`/quotes/${id}/accept`, { method: 'POST', token }),

  reject: (id: string, token: string) =>
    apiFetch(`/quotes/${id}/reject`, { method: 'POST', token }),

  revise: (id: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/quotes/${id}/revise`, { method: 'POST', token, body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────────────────────────────────────────
export const bookingsApi = {
  getMyBookingsAsClient: (token: string) =>
    apiFetch('/bookings/me/client', { token }),

  getMyBookingsAsVendor: (token: string) =>
    apiFetch('/bookings/me/vendor', { token }),

  getUpcoming: (token: string) =>
    apiFetch('/bookings/upcoming', { token }),

  getStats: (token: string) =>
    apiFetch('/bookings/stats', { token }),

  getById: (id: string, token: string) =>
    apiFetch(`/bookings/${id}`, { token }),

  markDepositPaid: (id: string, token: string) =>
    apiFetch(`/bookings/${id}/deposit-paid`, { method: 'PATCH', token }),

  confirm: (id: string, token: string) =>
    apiFetch(`/bookings/${id}/confirm`, { method: 'PATCH', token }),

  complete: (id: string, token: string) =>
    apiFetch(`/bookings/${id}/complete`, { method: 'PATCH', token }),

  cancel: (id: string, token: string) =>
    apiFetch(`/bookings/${id}/cancel`, { method: 'PATCH', token }),

  approve: (id: string, token: string) =>
    apiFetch(`/bookings/${id}/approve`, { method: 'PATCH', token }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────
export const reviewsApi = {
  create: (data: Record<string, unknown>, token: string) =>
    apiFetch('/reviews', { method: 'POST', token, body: JSON.stringify(data) }),

  getProviderReviews: (providerId: string) =>
    apiFetch(`/reviews/provider/${providerId}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Menu Items
// ─────────────────────────────────────────────────────────────────────────────
export const menuItemsApi = {
  getByProvider: (providerId: string) =>
    apiFetch(`/providers/${providerId}/menu-items`),

  create: (data: Record<string, unknown>, token: string) =>
    apiFetch('/providers/menu-items', { method: 'POST', token, body: JSON.stringify(data) }),

  update: (itemId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/providers/menu-items/${itemId}`, { method: 'PUT', token, body: JSON.stringify(data) }),

  delete: (itemId: string, token: string) =>
    apiFetch(`/providers/menu-items/${itemId}`, { method: 'DELETE', token }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile: (token: string) =>
    apiFetch('/users/profile', { token }),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }, token: string) =>
    apiFetch('/users/profile', { method: 'PUT', token, body: JSON.stringify(data) }),

  updateAvatar: (avatarUrl: string, token: string) =>
    apiFetch('/users/avatar', { method: 'PUT', token, body: JSON.stringify({ avatarUrl }) }),

  updateBanner: (bannerUrl: string | null, token: string) =>
    apiFetch('/users/banner', { method: 'PUT', token, body: JSON.stringify({ bannerUrl }) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: (token: string) =>
    apiFetch('/notifications', { token }),

  markRead: (id: string, token: string) =>
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH', token }),

  markAllRead: (token: string) =>
    apiFetch('/notifications/read-all', { method: 'PATCH', token }),
};
