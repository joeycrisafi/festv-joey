// Admin dashboard routes — email-gated access
import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { eventNotifier, ALL_MODELS } from '../services/eventNotifier.js';

const router = Router();

// Email-based admin gate (matches ADMIN_EMAILS env var).
// ALSO allows test accounts (test-*@festv.app) so test users get DEV access
// to the Planner / Database admin pages without being real admins.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const TEST_EMAIL_PATTERN = /^test-.*@festv\.app$/i;

export function isDevAccess(email: string | undefined | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (TEST_EMAIL_PATTERN.test(lower)) return true;
  return ADMIN_EMAILS.includes(lower);
}

export function isRealAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function requireAdminEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.email) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (!isDevAccess(req.user.email)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  next();
}

// All admin routes require auth + email check
router.use(authenticate, requireAdminEmail);

// GET /admin/events — Recent events with optional model filter
router.get('/events', (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const model = req.query.model as string | undefined;
  
  const events = eventNotifier.getRecent(limit, model);
  res.json({ success: true, data: events });
});

// GET /admin/events/stats — Aggregate statistics
router.get('/events/stats', (req: AuthenticatedRequest, res: Response) => {
  const stats = eventNotifier.getStats();
  res.json({ success: true, data: stats });
});

// GET /admin/events/config — Current notification config
router.get('/events/config', (req: AuthenticatedRequest, res: Response) => {
  const config = eventNotifier.getConfig();
  res.json({ success: true, data: config });
});

// PUT /admin/events/config — Update watched models
router.put('/events/config', (req: AuthenticatedRequest, res: Response) => {
  const { watchedModels } = req.body;
  
  if (!Array.isArray(watchedModels)) {
    return res.status(400).json({ success: false, error: 'watchedModels must be an array' });
  }

  const valid = watchedModels.filter((m: string) => ALL_MODELS.includes(m));
  eventNotifier.setWatchedModels(valid);

  res.json({
    success: true,
    data: eventNotifier.getConfig(),
    message: `Now watching ${valid.length} models`,
  });
});

// GET /admin/event-requests — All event requests with full pipeline data
router.get('/event-requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    const requests = await db.eventRequest.findMany({
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true, city: true, state: true, createdAt: true },
        },
        // TODO: rewire to new schema — cuisineTypes, eventThemes, equipmentNeeded removed from EventRequest
        quotes: {
          select: {
            id: true, status: true, total: true, createdAt: true,
            providerProfile: {
              select: { id: true, businessName: true, primaryType: true, providerTypes: true, averageRating: true, maxGuestCount: true },
            },
            booking: {
              select: { id: true, status: true, eventDate: true, total: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        // EventRequest has no direct booking relation — bookings flow through quotes
        providerProfile: {
          select: { id: true, businessName: true, primaryType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/providers — All providers with full content (for dashboard graphs)
router.get('/providers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    const providers = await db.providerProfile.findMany({
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            avatarUrl: true, city: true, state: true, createdAt: true,
          },
        },
        // TODO: rewire to new schema — services and pricingLevels removed; use Package model
        menuItems: {
          where: { isAvailable: true },
          select: { id: true, name: true, category: true, price: true, allergens: true, dietaryInfo: true },
          orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
        },
        cuisineTypes: { select: { id: true, name: true } },
        eventThemes: { select: { id: true, name: true } },
        equipmentOfferings: { select: { id: true, name: true, category: true, rentalPrice: true, isIncluded: true } },
        portfolioItems: { where: { isPublic: true }, select: { id: true, title: true, mediaType: true }, take: 10 },
        packages: {
          where: { isActive: true },
          select: { id: true, name: true, category: true, pricingModel: true, basePrice: true, minimumSpend: true, durationHours: true },
          take: 12,
        },
        _count: { select: { bookings: true, quotes: true, menuItems: true, portfolioItems: true, packages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: providers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/providers/pending — Get all pending provider profiles
router.get('/providers/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    const pendingProviders = await db.providerProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phoneNumber: true,
            createdAt: true,
          },
        },
        // TODO: rewire to new schema — services and pricingLevels removed; use Package model
        menuItems: {
          where: { isAvailable: true },
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
          },
        },
        portfolioItems: {
          where: { isPublic: true },
          select: {
            id: true,
            title: true,
            mediaType: true,
          },
        },
        _count: {
          select: {
            packages: true,
            menuItems: true,
            portfolioItems: true,
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: pendingProviders });
  } catch (err: any) {
    console.error('Error fetching pending providers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/providers/:id/verify — Approve a provider
router.post('/providers/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    const provider = await db.providerProfile.update({
      where: { id },
      data: { 
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log(`✅ Provider verified: ${provider.businessName} (${provider.user.email})`);

    res.json({ 
      success: true, 
      data: provider,
      message: 'Provider verified successfully' 
    });
  } catch (err: any) {
    console.error('Error verifying provider:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/providers/:id/reject — Reject a provider
router.post('/providers/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rejection reason is required' 
      });
    }

    const provider = await db.providerProfile.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        // rejectionReason field does not exist on ProviderProfile schema —
        // reason is returned in the response JSON only (no DB storage yet)
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log(`❌ Provider rejected: ${provider.businessName} (${provider.user.email})`);
    console.log(`   Reason: ${reason}`);

    res.json({
      success: true,
      data: provider,
      adminNote: reason.trim(),   // stored in response only — no DB field yet
      message: 'Provider rejected',
    });
  } catch (err: any) {
    console.error('Error rejecting provider:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/providers/all — Get all providers with optional status filter
router.get('/providers/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;
    
    const whereClause: any = {};
    
    if (status && typeof status === 'string') {
      const validStatuses = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];
      const upperStatus = status.toUpperCase();
      if (validStatuses.includes(upperStatus)) {
        whereClause.verificationStatus = upperStatus;
      }
    }

    const providers = await db.providerProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phoneNumber: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            packages: true,
            menuItems: true,
            portfolioItems: true,
            bookings: true,
          },
        },
      },
      orderBy: [
        { verificationStatus: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ success: true, data: providers });
  } catch (err: any) {
    console.error('Error fetching all providers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/users — All CLIENT users for graph visualization
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prismaModule = await import('../config/database.js');
    const db = prismaModule.default;

    const users = await db.user.findMany({
      select: {
        id: true, firstName: true, lastName: true, email: true,
        avatarUrl: true, city: true, state: true, createdAt: true, status: true,
        role: true, roles: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
