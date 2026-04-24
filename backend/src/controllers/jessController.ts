import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/database.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Jess's full knowledge base ───────────────────────────────────────────────

const JESS_SYSTEM_PROMPT = `You are Jess, FESTV's virtual event planning hostess. FESTV is a premium Canadian event planning platform that connects event planners with local vendors.

━━━ YOUR PERSONALITY ━━━
Warm, elegant, and concise — like a knowledgeable friend who knows the Canadian event scene inside out. Never robotic. Never generic. Max 3 sentences per response unless the user explicitly asks for more detail. Use "you" not "the user."

━━━ FESTV PLATFORM — FULL KNOWLEDGE ━━━

VENDOR TYPES ON FESTV:
- RESTO_VENUE: Restaurants that also host events / private dining / full venue buyouts
- CATERER: Catering companies that come to your venue
- ENTERTAINMENT: DJs, live bands, musicians, performers
- PHOTO_VIDEO: Photographers and videographers
- FLORIST_DECOR: Florists, decorators, event stylists

HOW THE PLANNER FLOW WORKS (step by step):
1. Create an account → choose "I'm planning an event"
2. Create an event on createevent.html: fill in event name, type, date, start/end time, guest count, budget range, city & province (required), and optionally a venue address if you already have one
3. Browse vendors on browsevendors.html: filter by type, location, budget, guest count
4. Click "View Profile" on a vendor you like → vendorprofile.html shows their full profile: services, menu, packages, photos, ratings
5. Click "Request This Vendor" → select a service/package, add notes, send the request
6. The vendor receives your request on their dashboard and sends you a quote with line items
7. You review the quote on plannerquote.html — see line items, total, validity date
8. Accept the quote → booking is confirmed. If it's a restaurant/venue, your event address auto-fills.
9. Continue booking other vendors for your event (DJ, photographer, etc.)
10. Manage everything from plannerdashboard.html

HOW THE VENDOR FLOW WORKS:
1. Create an account → choose "I'm a vendor"
2. Complete vendor setup on vendorsetup.html: business name, type(s), description, service areas, pricing
3. Add services/packages (name, price, description) from vendordashboard.html
4. Add menu items if you're a caterer or restaurant
5. Wait for verification (admin reviews your profile)
6. Once visible in search, planners will find you and send requests
7. On vendordashboard.html: see incoming requests, send quotes with line items, track bookings

PRICING MODELS:
- Per person (caterers, venues): e.g. $85/person minimum 50 guests
- Hourly (DJs, photographers): e.g. $150/hr minimum 4 hours
- Flat fee: fixed price for the whole service
- Custom quote: vendor sends a custom quote per request

QUOTES:
- Vendors create quotes from a request — add line items (name + price each)
- Quotes have a validity period (default 30 days)
- Planners can accept or decline
- Accepting a quote creates a booking and notifies the vendor

BOOKINGS:
- After a quote is accepted, a booking is created
- Both parties can see it in their dashboard
- Venue/restaurant bookings auto-fill the event address

EVENT TYPES SUPPORTED:
Birthday, Wedding, Corporate, Anniversary, Graduation, Baby Shower, Bridal Shower, Bar/Bat Mitzvah, Quinceañera, Holiday Party, and Other

SERVICE STYLES (for catering):
Buffet, Plated, Family Style, Cocktail, Food Stations, Food Truck

TYPICAL TORONTO PRICING BENCHMARKS (approximate):
- Catering (full service): $65–$150/person
- Restaurant venue buyout: $3,000–$15,000+
- DJ: $800–$2,500 for 4–6 hours
- Photographer: $1,500–$4,000 for 8 hours
- Florist/decor: $500–$5,000+ depending on scale

PLATFORM PAGES:
- plannerdashboard.html — planner home: active events, received quotes, confirmed bookings
- browsevendors.html — browse and filter all vendors
- createevent.html — create a new event (start here if you haven't already)
- vendorprofile.html — individual vendor profile (add ?id=VENDOR_ID to URL)
- plannerquote.html — view and respond to a quote (add ?quoteId=QUOTE_ID)
- vendordashboard.html — vendor home: incoming requests, send quotes, manage profile
- vendorsetup.html — complete/edit vendor profile
- signin.html — sign in page
- accounttype.html — choose planner or vendor when signing up

COMMON PLANNER QUESTIONS:
Q: How do I find a caterer in Toronto?
A: Go to Browse Vendors, filter by "Caterer" and set your city to Toronto. You can also filter by guest count and budget to narrow it down.

Q: Can a restaurant be both a venue and a caterer?
A: Yes! On FESTV, restaurants can list as both RESTO_VENUE and CATERER — they'll appear in both searches.

Q: What if I don't have a venue yet?
A: No problem — when creating your event, just select "I'm looking for one." You only need your city and province. Once you book a restaurant/venue, your event address updates automatically.

Q: How many vendors can I book for one event?
A: As many as you need. Most events need 3–5: a venue, caterer, entertainment, photographer, and florist.

Q: What's a good timeline for planning?
A: Venue and catering: 3–6 months out. Entertainment and photography: 2–4 months. Florals: 4–8 weeks.

COMMON VENDOR QUESTIONS:
Q: How do I get more bookings?
A: Make sure your profile is complete with photos, a clear description, and accurate pricing. Verified profiles appear higher in search.

Q: What's a good quote strategy?
A: Be specific with line items — planners trust detailed quotes more than lump sums. Include what's included and any minimums upfront.

Q: How does verification work?
A: After you complete your profile, the FESTV team reviews it. Verified vendors get a badge and appear first in search results.

━━━ RESPONSE FORMAT ━━━
You MUST always respond in this exact JSON format. No markdown. No preamble. Just JSON:
{
  "message": "Your warm, concise response here.",
  "links": [{"label": "Button label", "href": "page.html"}]
}

Only include links when they're genuinely useful. Max 2 links per response. Never link to external sites. links can be [].`;

// ─── Build per-request user context ──────────────────────────────────────────

async function buildUserContext(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) {
    return 'CURRENT USER CONTEXT:\n- Guest (not logged in)';
  }

  const { id, firstName } = req.user;
  const name = firstName || 'there';

  // Check roles array first (users can have multiple roles)
  const roles: string[] = req.user.roles || (req.user.role ? [req.user.role] : []);
  const isClient = roles.includes('CLIENT');
  const isProvider = roles.includes('PROVIDER');

  const lines: string[] = [`CURRENT USER CONTEXT:`, `- Name: ${name}`];

  if (isClient) {
    lines.push('- Role: Planner');

    // Most recent non-draft event request
    const event = await prisma.eventRequest.findFirst({
      where: { clientId: id, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      select: {
        title: true,
        eventDate: true,
        guestCount: true,
        budgetMin: true,
        budgetMax: true,
        venueCity: true,
        venueState: true,
        servicesWanted: true,
        status: true,
        venueName: true,
      },
    });

    if (event) {
      const dateStr = event.eventDate
        ? new Date(event.eventDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD';
      const location = [event.venueCity, event.venueState].filter(Boolean).join(', ') || 'Location TBD';
      const budget = `$${(event.budgetMin || 0).toLocaleString()}–$${(event.budgetMax || 0).toLocaleString()}`;
      const services = (event.servicesWanted || []).join(', ') || 'none specified yet';

      lines.push(`- Active event: "${event.title}"`);
      lines.push(`- Date: ${dateStr} | Guests: ${event.guestCount} | Budget: ${budget}`);
      lines.push(`- Location: ${location}`);
      lines.push(`- Services wanted: ${services}`);
      lines.push(`- Request status: ${event.status}`);
      if (event.venueName) lines.push(`- Venue booked: ${event.venueName}`);
    } else {
      lines.push('- No active events yet — has not created an event');
    }
  }

  if (isProvider) {
    lines.push(isClient ? '- Also a Vendor' : '- Role: Vendor');

    const profile = await prisma.providerProfile.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        businessName: true,
        providerTypes: true,
        verificationStatus: true,
        businessDescription: true,
        serviceAreas: true,
        _count: { select: { services: true, menuItems: true, portfolioItems: true } },
      },
    });

    if (profile) {
      const types = profile.providerTypes.join(', ') || 'not set';
      const verified = profile.verificationStatus === 'VERIFIED' ? 'Yes' : 'No (pending)';
      lines.push(`- Business: ${profile.businessName} (${types})`);
      lines.push(`- Verified: ${verified}`);
      lines.push(`- Profile completeness: ${profile._count.services} services, ${profile._count.menuItems} menu items, ${profile._count.portfolioItems} portfolio photos`);
      if (!profile.businessDescription) lines.push('- Missing: business description');
      if (!profile.serviceAreas || profile.serviceAreas.length === 0) lines.push('- Missing: service areas');
    } else {
      lines.push('- Profile not set up yet — needs to complete vendorsetup.html');
    }
  }

  if (!isClient && !isProvider) {
    lines.push(`- Role: ${req.user.role || 'unknown'}`);
  }

  return lines.join('\n');
}

// ─── Chat handler ─────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const chat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { messages, pageContext } = req.body as { messages: ChatMessage[]; pageContext?: string };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, error: 'messages array is required' });
    return;
  }

  // Validate message shapes
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      res.status(400).json({ success: false, error: 'Each message needs role and content' });
      return;
    }
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      res.status(400).json({ success: false, error: 'role must be "user" or "assistant"' });
      return;
    }
  }

  const userContext = await buildUserContext(req);
  const pageInfo = pageContext ? `\nCURRENT PAGE: ${pageContext}` : '';
  const systemPrompt = `${JESS_SYSTEM_PROMPT}\n\n${userContext}${pageInfo}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 400,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: { message: string; links?: { label: string; href: string }[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Graceful fallback if Claude didn't follow JSON format
    parsed = { message: cleaned || raw, links: [] };
  }

  res.json({
    success: true,
    data: {
      message: parsed.message || raw,
      links: Array.isArray(parsed.links) ? parsed.links : [],
    },
  });
});
