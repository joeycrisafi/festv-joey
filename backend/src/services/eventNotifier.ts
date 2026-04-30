// Event Notification Service
// Captures DB events, dispatches to Discord + Email, stores for dashboard polling

import { config } from '../config/index.js';

// ── Types ───────────────────────────────────────────────────────
export interface DbEvent {
  id: string;
  model: string;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  summary: string;
  details: Record<string, any>;
  severity: 'info' | 'success' | 'warning' | 'critical';
  timestamp: Date;
}

interface NotifierConfig {
  watchedModels: Set<string>;
  discordEnabled: boolean;
  emailEnabled: boolean;
  discordWebhookUrl: string;
  emailTo: string;
}

// ── Severity + color mappings ───────────────────────────────────
const MODEL_SEVERITY: Record<string, DbEvent['severity']> = {
  User: 'success',
  ProviderProfile: 'success',
  EventRequest: 'info',
  Quote: 'info',
  Booking: 'critical',
  Payment: 'critical',
  Review: 'info',
  Message: 'info',
  MenuItem: 'info',
  MenuItemPricingTier: 'info',
  Service: 'info',
  PricingLevel: 'info',
  Favorite: 'info',
  PortfolioItem: 'info',
  Notification: 'info',
};

const SEVERITY_COLORS: Record<string, number> = {
  info: 0x3B82F6,     // blue
  success: 0x10B981,  // green
  warning: 0xF59E0B,  // amber
  critical: 0xE94560, // red
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  critical: '🔴',
};

const MODEL_EMOJI: Record<string, string> = {
  User: '👤',
  ProviderProfile: '🏪',
  EventRequest: '📋',
  Quote: '💬',
  Booking: '📅',
  Payment: '💳',
  Review: '⭐',
  Message: '💬',
  MenuItem: '🍽️',
  Service: '🔧',
  Favorite: '❤️',
  PortfolioItem: '📸',
};

// ── All trackable models ────────────────────────────────────────
export const ALL_MODELS = [
  'User', 'ProviderProfile', 'EventRequest', 'Quote', 'Booking',
  'Payment', 'Review', 'Message', 'MenuItem', 'MenuItemPricingTier',
  'Service', 'PricingLevel', 'Favorite', 'PortfolioItem', 'Notification',
  'RefreshToken', 'Availability', 'Equipment', 'BookingService', 'QuoteItem',
];

// Models that generate noise and should be off by default
const DEFAULT_IGNORED = new Set([
  'RefreshToken', 'Notification', 'Availability', 'QuoteItem', 'BookingService',
]);

// ── Summarizer ──────────────────────────────────────────────────
function summarizeEvent(model: string, action: string, data: any): string {
  const act = action === 'create' ? 'New' : action === 'update' ? 'Updated' : 'Deleted';

  switch (model) {
    case 'User':
      return `${act} user: ${data.firstName || ''} ${data.lastName || ''} (${data.email || 'unknown'}) — ${data.role || 'CLIENT'}`;
    case 'ProviderProfile':
      return `${act} provider: ${data.businessName || 'Unnamed'} (${data.primaryType || data.providerTypes?.[0] || 'unknown'})`;
    case 'EventRequest':
      return `${act} event request: ${data.title || 'Untitled'} — ${data.eventType || ''}, ${data.guestCount || '?'} guests, ${data.venueCity || ''}`;
    case 'Quote':
      return `${act} quote: $${data.totalAmount?.toFixed(2) || '?'} — status: ${data.status || 'DRAFT'}`;
    case 'Booking':
      return `${act} booking: $${data.totalAmount?.toFixed(2) || '?'} — ${data.status || 'PENDING'}, ${data.guestCount || '?'} guests`;
    case 'Payment':
      return `${act} payment: $${data.amount?.toFixed(2) || '?'} ${data.type || ''} — ${data.status || 'PENDING'}`;
    case 'Review':
      return `${act} review: ${data.overallRating || '?'}/5 — "${(data.title || data.content?.slice(0, 60) || 'No content')}"`;
    case 'Message':
      return `${act} message in conversation`;
    case 'MenuItem':
      return `${act} menu item: ${data.name || 'Unnamed'} — $${data.price?.toFixed(2) || '?'} (${data.category || 'uncategorized'})`;
    case 'Service':
      return `${act} service: ${data.name || 'Unnamed'} — ${data.providerType || ''}`;
    case 'PricingLevel':
      return `${act} pricing level: ${data.name || 'Unnamed'} — $${data.pricePerPerson?.toFixed(2) || '?'}/person`;
    case 'Favorite':
      return `${act} favorite`;
    case 'PortfolioItem':
      return `${act} portfolio: ${data.title || 'Untitled'}`;
    default:
      return `${act} ${model} record`;
  }
}

// ── Safe detail extractor (strips sensitive fields) ─────────────
function safeDetails(model: string, data: any): Record<string, any> {
  const STRIP = new Set(['passwordHash', 'passwordResetToken', 'passwordResetExpires', 'stripePaymentId', 'stripeCustomerId', 'cardLast4', 'cardBrand', 'token']);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (STRIP.has(k)) continue;
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (Array.isArray(v) && v.length > 10) { out[k] = `[${v.length} items]`; continue; }
    if (typeof v === 'object' && v !== null) continue; // skip nested objects
    out[k] = v;
  }
  return out;
}


// ── Main Service ────────────────────────────────────────────────
class EventNotifier {
  private static instance: EventNotifier;
  private events: DbEvent[] = [];
  private maxEvents = 500;
  private config: NotifierConfig;

  private constructor() {
    const discordUrl = process.env.DISCORD_WEBHOOK_URL || '';
    const emailTo = process.env.ADMIN_NOTIFICATION_EMAIL || '';
    const adminEmails = process.env.ADMIN_EMAILS || '';

    // Default watched models: everything except noise
    const watched = new Set(ALL_MODELS.filter(m => !DEFAULT_IGNORED.has(m)));

    this.config = {
      watchedModels: watched,
      discordEnabled: !!discordUrl,
      emailEnabled: !!emailTo && !!config.email.host,
      discordWebhookUrl: discordUrl,
      emailTo,
    };

    console.log(`📡 EventNotifier initialized — Discord: ${this.config.discordEnabled ? 'ON' : 'OFF'}, Email: ${this.config.emailEnabled ? 'ON' : 'OFF'}, Watching: ${watched.size} models`);
  }

  static getInstance(): EventNotifier {
    if (!EventNotifier.instance) {
      EventNotifier.instance = new EventNotifier();
    }
    return EventNotifier.instance;
  }

  // ── Core: capture and dispatch ──────────────────────────────
  async capture(model: string, action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    if (!this.config.watchedModels.has(model)) return;

    const event: DbEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      model,
      action,
      recordId: data?.id || 'unknown',
      summary: summarizeEvent(model, action, data),
      details: safeDetails(model, data),
      severity: MODEL_SEVERITY[model] || 'info',
      timestamp: new Date(),
    };

    // Store
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Dispatch (fire-and-forget, don't block the DB operation)
    this.dispatchDiscord(event).catch(err => console.error('Discord dispatch failed:', err.message));
    
    // Only email for critical events
    if (event.severity === 'critical') {
      this.dispatchEmail(event).catch(err => console.error('Email dispatch failed:', err.message));
    }
  }

  // ── Discord webhook ─────────────────────────────────────────
  private async dispatchDiscord(event: DbEvent): Promise<void> {
    if (!this.config.discordEnabled) return;

    const emoji = MODEL_EMOJI[event.model] || '📦';
    const sevEmoji = SEVERITY_EMOJI[event.severity];
    const color = SEVERITY_COLORS[event.severity];

    const detailLines = Object.entries(event.details)
      .slice(0, 8)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join('\n');

    const payload = {
      embeds: [{
        title: `${emoji} ${event.action.toUpperCase()}: ${event.model}`,
        description: `${sevEmoji} ${event.summary}`,
        color,
        fields: detailLines ? [{ name: 'Details', value: detailLines.slice(0, 1000) }] : [],
        footer: { text: `ID: ${event.recordId}` },
        timestamp: event.timestamp.toISOString(),
      }],
    };

    const res = await fetch(this.config.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook returned ${res.status}`);
    }
  }

  // ── Email (nodemailer) ──────────────────────────────────────
  private async dispatchEmail(event: DbEvent): Promise<void> {
    if (!this.config.emailEnabled) return;

    try {
      // Dynamic import so it doesn't crash if nodemailer isn't installed
      // @ts-ignore — nodemailer not in deps; only runs when emailEnabled is true
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        auth: { user: config.email.user, pass: config.email.pass },
      });

      const detailRows = Object.entries(event.details)
        .slice(0, 12)
        .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:600;color:#6b7280">${k}</td><td style="padding:4px 8px">${v}</td></tr>`)
        .join('');

      await transporter.sendMail({
        from: config.email.from,
        to: this.config.emailTo,
        subject: `[CaterEase] ${event.severity.toUpperCase()}: ${event.action} ${event.model}`,
        html: `
          <div style="font-family:system-ui;max-width:600px;margin:0 auto">
            <div style="background:#1a1a2e;padding:16px 20px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0;font-size:16px">${SEVERITY_EMOJI[event.severity]} CaterEase Event Alert</h2>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
              <p style="font-size:15px;color:#1a1a2e;font-weight:600;margin:0 0 8px">${event.summary}</p>
              <p style="font-size:12px;color:#9ca3af;margin:0 0 16px">${event.timestamp.toISOString()}</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px">${detailRows}</table>
            </div>
          </div>
        `,
      });
    } catch (err: any) {
      console.warn('Email dispatch skipped:', err.message);
    }
  }

  // ── Query methods (for dashboard API) ───────────────────────
  getRecent(limit = 100, modelFilter?: string): DbEvent[] {
    let filtered = this.events;
    if (modelFilter) {
      filtered = filtered.filter(e => e.model === modelFilter);
    }
    return filtered.slice(-limit).reverse();
  }

  getStats(): {
    total: number;
    byModel: Record<string, number>;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    last24h: number;
    lastHour: number;
  } {
    const byModel: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const now = Date.now();

    let last24h = 0, lastHour = 0;
    for (const e of this.events) {
      byModel[e.model] = (byModel[e.model] || 0) + 1;
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      const age = now - e.timestamp.getTime();
      if (age < 86400000) last24h++;
      if (age < 3600000) lastHour++;
    }

    return { total: this.events.length, byModel, byAction, bySeverity, last24h, lastHour };
  }

  getConfig() {
    return {
      watchedModels: Array.from(this.config.watchedModels),
      discordEnabled: this.config.discordEnabled,
      emailEnabled: this.config.emailEnabled,
      allModels: ALL_MODELS,
    };
  }

  setWatchedModels(models: string[]) {
    this.config.watchedModels = new Set(models.filter(m => ALL_MODELS.includes(m)));
  }
}

export const eventNotifier = EventNotifier.getInstance();
