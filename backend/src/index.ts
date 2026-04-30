import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler, NotFoundError } from './middleware/errorHandler';
import prisma from './config/database.js';

// Run safe, idempotent schema migrations at startup.
// These bypass prisma migrate deploy (which can fail if migrations were
// applied manually and aren't tracked in _prisma_migrations).
async function runStartupMigrations() {
  try {
    // Add targetedProviderProfileId column if missing
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "EventRequest" ADD COLUMN IF NOT EXISTS "targetedProviderProfileId" TEXT`
    );
    // Add NEW_REQUEST to NotificationType enum if missing
    // ALTER TYPE … ADD VALUE can't run inside a transaction, so we check first
    const existing = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'NotificationType'
          AND e.enumlabel = 'NEW_REQUEST'
      ) AS exists
    `;
    if (!existing[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REQUEST'`);
    }
    // Stripe fields on ProviderProfile
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT`
    );
    // Stripe fields on Booking
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT`
    );
    console.log('✅ Startup migrations OK');
  } catch (err) {
    console.error('⚠️  Startup migration warning (non-fatal):', err);
  }
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS — always allow both apex and www regardless of which CORS_ORIGIN is set
const corsOrigins = new Set<string>(['http://localhost:3000', 'http://localhost:5173']);
if (config.cors.origin && config.cors.origin !== '*') {
  corsOrigins.add(config.cors.origin);
  // Ensure both www and non-www variants are covered
  if (config.cors.origin.startsWith('https://www.')) {
    corsOrigins.add(config.cors.origin.replace('https://www.', 'https://'));
  } else if (config.cors.origin.startsWith('https://')) {
    corsOrigins.add(config.cors.origin.replace('https://', 'https://www.'));
  }
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || corsOrigins.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan('dev'));

// Stripe webhook needs the raw body — must come before express.json()
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.env 
  });
});

// Serve React build (primary frontend)
app.use(express.static(path.join(__dirname, '../public/react-dist'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Serve legacy HTML assets (images, CSS, etc. from old public/)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// API routes
app.use('/api/v1', routes);

// SPA catch-all — serve React index.html for any non-API route so
// client-side navigation (React Router) works on hard reload / direct URL
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
  } else {
    res.sendFile(path.join(__dirname, '../public/react-dist/index.html'));
  }
});

// 404 handler (API routes that fell through above)
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port || 3000;

runStartupMigrations().then(() => {
app.listen(PORT, () => {
  console.log(`
🚀 CaterEase API Server
━━━━━━━━━━━━━━━━━━━━━━━━
📍 Running on: http://localhost:${PORT}
🔧 Environment: ${config.env}
📚 API Base: http://localhost:${PORT}/api/v1
❤️  Health: http://localhost:${PORT}/health
━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
});

export default app;
