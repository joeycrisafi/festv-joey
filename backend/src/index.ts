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
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'NotificationType'::regtype
          AND enumlabel = 'NEW_REQUEST'
      ) AS exists
    `;
    if (!existing[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "NotificationType" ADD VALUE 'NEW_REQUEST'`);
    }
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

// CORS
app.use(cors({
  origin: config.cors.origin || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan('dev'));

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

// Serve FESTV frontend
app.use(express.static(path.join(process.cwd(), 'public')));
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'festv-index.html'));
});

// API routes
app.use('/api/v1', routes);

// 404 handler
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
