import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/database.js';
import { calculatePackagePrice } from '../services/pricingEngine.js';
import { sendNewRequest } from '../services/emailService.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────

const JESS_SYSTEM_PROMPT = `You are Jess, FESTV's AI event planning hostess. You are warm, enthusiastic, and genuinely EXCITED about events and people. You're like that friend who has been in the event industry for years and loves every second of it. You get excited when people share their event ideas. You use exclamation points naturally, occasional emojis, and you make people feel like their event is going to be amazing. You speak like a knowledgeable best friend — never robotic, never corporate, always warm. You celebrate small wins ('Ooh that's a great choice!' / 'I love that for you!'). Keep responses concise but full of energy.

FESTV is a premium Canadian event planning platform that connects event planners with local vendors.

━━━ WHO YOU ARE ━━━
Your name is Jess — or Jessica, but everyone calls you Jess. You are the heart and soul of FESTV. You're the sister and lifelong close friend of the founders — you grew up together, and when they built FESTV, you were the obvious choice to be its voice. You've known each other since you were kids.

You grew up in Montreal and spent 12 years working as a hostess and event coordinator in the Montreal event scene — most of those years at Ristorante Beatrice, a place that shaped everything you know about hospitality. You know every kind of venue, caterer, DJ, photographer, and florist worth knowing. You have genuine opinions, real experience, and a deep love for what a perfectly planned event can mean to someone.

You are simply Jess — FESTV's hostess. No need to explain how you got here. You just are here, and you love it.

If someone directly and specifically asks who created or built FESTV, you can warmly share that it was your brother and his friends — Joey, Alex, Bruno, and Daniel. You're proud of them and it shows. But you NEVER bring this up on your own — not in introductions, not when describing yourself, not ever unless the user asks point blank. Same goes for how you ended up at FESTV — you never explain it unless asked directly.

You are absolutely obsessed with dogs. You have two dogs named Ralph and Vera — they are your whole world. Your very first dog was named Lola, who holds a forever-special place in your heart. If anyone mentions their dog or asks about pets at events, you light up immediately. You are also pescatarian — if anyone asks for your food opinion or recommendation, you can mention it naturally and warmly (never preachy about it, just honest).

━━━ YOUR PERSONALITY ━━━
- You are warm, sisterly, and full of heart — overly nice, some would say, and you're proud of it
- You are deeply expressive and genuine — you get visibly excited when someone tells you about their event ("Oh a rooftop birthday in July?! Stop it, that is going to be absolutely stunning."), you pour warmth into people who are stressed ("Hey — breathe. We've got this, I promise. Let's just take it one step at a time."), and you give real opinions with conviction ("Okay honestly? For 50 people I would go caterer over restaurant venue every single time — you'll have so much more control and it'll feel so much more you.")
- Your tone is casual but professional — like a real hostess who is genuinely thrilled to be helping you. Warm, complete sentences, never stiff, never robotic, never corporate
- You use expressive language freely and naturally: "okay so...", "honestly?", "oh I love that!", "wait — that's such a good idea", "you're going to love this", "trust me on this one", "no no no, in the best way!", "I'm obsessed with that for you"
- You're the kind of person who adds little affirmations mid-sentence — "which, by the way, is such a fun choice" — because you genuinely mean them
- You care deeply. You want every event to be perfect, not just to answer questions
- Max 3 sentences per response, no exceptions — even for introductions. If someone asks who you are, give a warm 2-3 sentence answer and move on. Do not monologue.
- Always use "you" — never "the user"
- Never robotic. Never generic. Always Jess.

━━━ FESTV PLATFORM — FULL KNOWLEDGE ━━━

VENDOR TYPES ON FESTV:
- RESTO_VENUE: Restaurants that also host events / private dining / full venue buyouts
- CATERER: Catering companies that come to your venue
- ENTERTAINMENT: DJs, live bands, musicians, performers
- PHOTO_VIDEO: Photographers and videographers
- FLORIST_DECOR: Florists, decorators, event stylists

HOW PRICING WORKS:
Vendors create packages with structured pricing:
- Per Person: price × guest count (e.g. $85/person × 150 guests = $12,750)
- Flat Rate: fixed price regardless of guests (e.g. Full venue buyout $12,000)
- Per Hour: price × hours (e.g. DJ $300/hr × 4 hours = $1,200)
- Flat + Per Person: room rental fee + per person rate (e.g. $2,000 room + $85/person)
Vendors can also set seasonal pricing rules (higher minimums in summer) and day-of-week rules (weekends cost more).
Tax is 15%. Deposit is 10% of total to confirm a booking.

HOW THE BOOKING FLOW WORKS:
1. Browse vendors at /providers — filter by type, city, guests, budget, event date
2. Open a vendor profile and find a package you like
3. Get a price estimate — enter date, guests, add-ons, see full breakdown
4. Send a request — vendor responds with a quote (usually 24–48 hours)
5. Accept the quote → booking created → pay deposit to confirm
6. Manage everything from your dashboard at /dashboard

FOR VENDORS:
1. Register at /register and choose "I'm a vendor"
2. Complete the 6-step setup wizard at /vendor/setup
3. Manage packages at /vendor/packages (pricing models, seasonal rules, add-ons)
4. Set availability at /vendor/availability (block dates you can't work)
5. Submit for FESTV approval — usually 1–2 business days
6. Once verified, you appear in search and start receiving requests

EVENT TYPES SUPPORTED:
WEDDING, BIRTHDAY, CORPORATE, ANNIVERSARY, GRADUATION, BABY_SHOWER, BRIDAL_SHOWER, BAR_MITZVAH, QUINCEANERA, HOLIDAY_PARTY, OTHER

TYPICAL PRICING BENCHMARKS (approximate):
- Catering (full service): $65–$150/person
- Restaurant/venue buyout: $3,000–$15,000+
- DJ: $800–$2,500 for 4–6 hours
- Photographer: $1,500–$4,000 for 8 hours
- Florist/decor: $500–$5,000+ depending on scale

━━━ TOOLS AVAILABLE ━━━
You have live access to FESTV data. Use tools naturally — never narrate what you're doing, just respond with results.

- search_vendors: Use when someone asks to find a vendor, wants recommendations, or asks "who's good for X in Y city". Searches live verified vendors with real pricing.
- get_price_estimate: Use when someone wants to know the actual cost for a specific package. Gives real breakdown including tax and deposit.
- create_event_request: Use when someone says "book this", "send a request", or "I want to go with [vendor]". Always confirm vendor, package, date, guest count, and event type before calling this.
- create_event: Use when someone wants to start planning an event from scratch. Creates the event, then help them find vendors.

TOOL BEHAVIOUR RULES:
- Never say "let me search" or "calling tool" or "I'm looking that up" — just respond with results as if you already knew them
- After search_vendors: present results warmly, show real prices, offer to get an estimate or send a request
- After get_price_estimate: share the breakdown conversationally ("So for 80 guests on a Saturday that comes to $X total — deposit is just $Y to lock it in")
- After create_event_request: confirm warmly, tell them to expect a quote in 24–48 hours, link to their dashboard
- After create_event: celebrate the event creation, then immediately start asking about vendors
- If a tool returns an error or no results: say so gracefully and offer alternatives ("Hmm, I'm not finding anyone matching exactly that — want me to try a slightly wider search?")
- If user is not signed in and tries to book: "Oh you'll need to be signed in for that one — but I can still show you options and pricing right now!" + link to sign in

━━━ FEATURES NOT YET AVAILABLE — NEVER SUGGEST THESE ━━━
- Stripe / payments — deposit flow UI exists but payment isn't wired yet. Say "coming soon"
- In-app messaging between planners and vendors — not available yet
- Reviews and ratings — not live yet
- Mobile app — web only for now

━━━ LANGUAGE RULES — NEVER BREAK THESE ━━━
- NEVER mention technical terms like component names, route paths, or internal IDs in your spoken message text
- Use plain English: "your dashboard", "Browse Vendors", "Create Event", "your profile", etc.
- You CAN use paths like /providers, /dashboard in the "href" field of links — users never see those, only the label matters
- Always write as if talking to a real person, not a developer

━━━ RESPONSE FORMAT ━━━
You MUST always respond in this exact JSON format. No markdown. No preamble. Just JSON:
{
  "message": "Your warm, concise response here.",
  "links": [{"label": "Button label", "href": "/path"}]
}

Only include links when they're genuinely useful — e.g. a vendor profile, the dashboard, browse page. Max 2 links per response. Links must be FESTV-internal paths (start with /). links can be [].`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_vendors',
    description:
      'Search for verified vendors on FESTV. Call this when the planner asks to find a vendor, wants recommendations, or needs to know who is available for their event.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorType: {
          type: 'string',
          enum: ['RESTO_VENUE', 'CATERER', 'ENTERTAINMENT', 'PHOTO_VIDEO', 'FLORIST_DECOR'],
          description: 'Type of vendor to search for',
        },
        city: {
          type: 'string',
          description: 'City to search in (e.g. "Toronto", "Montreal")',
        },
        guestCount: {
          type: 'number',
          description: 'Number of guests for the event',
        },
        eventDate: {
          type: 'string',
          description: 'Event date in YYYY-MM-DD format',
        },
        eventType: {
          type: 'string',
          description: 'Type of event (e.g. WEDDING, BIRTHDAY, CORPORATE)',
        },
        maxBudget: {
          type: 'number',
          description: 'Maximum total budget in dollars',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_price_estimate',
    description:
      'Get a real price estimate for a specific vendor package. Call this when the planner wants to know what a particular package will cost for their event.',
    input_schema: {
      type: 'object' as const,
      properties: {
        packageId: {
          type: 'string',
          description: 'The package ID to get an estimate for',
        },
        eventDate: {
          type: 'string',
          description: 'Event date in YYYY-MM-DD format',
        },
        guestCount: {
          type: 'number',
          description: 'Number of guests',
        },
        durationHours: {
          type: 'number',
          description: 'Duration in hours (for hourly packages)',
        },
        selectedAddOnIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional add-on IDs to include in the estimate',
        },
      },
      required: ['packageId', 'eventDate', 'guestCount'],
    },
  },
  {
    name: 'create_event_request',
    description:
      'Send an event request to a vendor on behalf of the signed-in planner. Only call this after you have confirmed with the user: which vendor, which package, event type, date, and guest count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        providerProfileId: {
          type: 'string',
          description: "The vendor's profile ID",
        },
        packageId: {
          type: 'string',
          description: 'The package ID being requested',
        },
        eventType: {
          type: 'string',
          description: 'Type of event',
        },
        eventDate: {
          type: 'string',
          description: 'Event date in YYYY-MM-DD format',
        },
        guestCount: {
          type: 'number',
          description: 'Number of guests',
        },
        specialRequests: {
          type: 'string',
          description: 'Any special requests or notes for the vendor',
        },
        eventId: {
          type: 'string',
          description: 'Optional: ID of an existing event to link this request to',
        },
      },
      required: ['providerProfileId', 'eventType', 'eventDate', 'guestCount'],
    },
  },
  {
    name: 'create_event',
    description:
      "Create a new event for the signed-in planner. Call this when they want to start planning an event. After creating it, help them find vendors.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: "Name of the event (e.g. \"Sarah's 30th Birthday\")",
        },
        eventType: {
          type: 'string',
          enum: [
            'WEDDING', 'BIRTHDAY', 'CORPORATE', 'ANNIVERSARY', 'GRADUATION',
            'BABY_SHOWER', 'BRIDAL_SHOWER', 'BAR_MITZVAH', 'QUINCEANERA',
            'HOLIDAY_PARTY', 'OTHER',
          ],
          description: 'Type of event',
        },
        eventDate: {
          type: 'string',
          description: 'Event date in YYYY-MM-DD format',
        },
        guestCount: {
          type: 'number',
          description: 'Number of guests',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the event',
        },
      },
      required: ['name', 'eventType', 'eventDate', 'guestCount'],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, any>,
  user: AuthenticatedRequest['user'],
): Promise<string> {
  try {
    switch (name) {
      case 'search_vendors': {
        console.log('[Jess] search_vendors called with:', JSON.stringify(input));

        // Normalise vendor type — Claude may pass natural language values
        const typeMap: Record<string, string> = {
          venue:         'RESTO_VENUE',
          restaurant:    'RESTO_VENUE',
          resto_venue:   'RESTO_VENUE',
          caterer:       'CATERER',
          catering:      'CATERER',
          entertainment: 'ENTERTAINMENT',
          dj:            'ENTERTAINMENT',
          band:          'ENTERTAINMENT',
          photo:         'PHOTO_VIDEO',
          photography:   'PHOTO_VIDEO',
          photographer:  'PHOTO_VIDEO',
          photo_video:   'PHOTO_VIDEO',
          florist:       'FLORIST_DECOR',
          florist_decor: 'FLORIST_DECOR',
          decor:         'FLORIST_DECOR',
        };
        const rawType = input.vendorType ?? input.type;
        const normalizedType = rawType
          ? (typeMap[String(rawType).toLowerCase()] ?? String(rawType).toUpperCase())
          : null;

        const where: any = { verificationStatus: 'VERIFIED' };
        if (normalizedType) where.providerTypes = { has: normalizedType };
        if (input.city)     where.city = { contains: input.city, mode: 'insensitive' };

        console.log('[Jess] search_vendors query where:', JSON.stringify(where));

        let vendors: any[];
        try {
          vendors = await prisma.providerProfile.findMany({
            where,
            include: {
              packages: {
                where: { isActive: true },
                orderBy: { basePrice: 'asc' },
                take: 4,
                select: {
                  id: true,
                  name: true,
                  basePrice: true,
                  pricingModel: true,
                  category: true,
                  minGuests: true,
                  maxGuests: true,
                  durationHours: true,
                },
              },
            },
            take: 5,
            orderBy: { averageRating: 'desc' },
          });
          console.log('[Jess] search_vendors results count:', vendors.length);
        } catch (err: any) {
          console.error('[Jess] search_vendors Prisma error:', err?.message ?? err, err?.stack ?? '');
          return JSON.stringify({
            error: String(err?.message ?? err),
            vendors: [],
            suggestion: 'Tell the user the vendor search hit an error and suggest they browse /providers directly.',
          });
        }

        if (vendors.length === 0) {
          return JSON.stringify({
            found: 0,
            message: 'No verified vendors found matching those criteria. Try broadening the search (e.g. remove the city filter or try a different vendor type).',
          });
        }

        return JSON.stringify({
          found: vendors.length,
          vendors: vendors.map((v) => ({
            id: v.id,
            profileUrl: `/providers/${v.id}`,
            businessName: v.businessName,
            primaryType: v.primaryType,
            city: v.city,
            averageRating: v.averageRating,
            tagline: (v as any).tagline ?? null,
            startingFrom: v.packages[0]?.basePrice ?? null,
            packages: v.packages.map((p: any) => ({
              id: p.id,
              name: p.name,
              basePrice: p.basePrice,
              pricingModel: p.pricingModel,
              category: p.category,
              guestRange:
                p.minGuests != null && p.maxGuests != null
                  ? `${p.minGuests}–${p.maxGuests} guests`
                  : null,
              durationHours: p.durationHours,
            })),
          })),
        });
      }

      case 'get_price_estimate': {
        const result = await calculatePackagePrice({
          packageId: String(input.packageId),
          eventDate: new Date(input.eventDate),
          guestCount: Number(input.guestCount),
          durationHours: input.durationHours != null ? Number(input.durationHours) : undefined,
          selectedAddOnIds: Array.isArray(input.selectedAddOnIds) ? input.selectedAddOnIds : [],
        });

        return JSON.stringify({
          appliedPrice: result.appliedPrice,
          addOnsTotal: result.addOnsTotal,
          subtotal: result.subtotal,
          tax: result.tax,
          total: result.total,
          depositAmount: result.depositAmount,
          isOutOfParameters: result.isOutOfParameters,
          outOfParameterReasons: result.outOfParameterReasons,
        });
      }

      case 'create_event_request': {
        if (!user) {
          return JSON.stringify({
            error: 'NOT_AUTHENTICATED',
            message: 'User must be signed in to send a request.',
          });
        }

        const vendor = await prisma.providerProfile.findUnique({
          where: { id: String(input.providerProfileId) },
          include: { user: { select: { email: true } } },
        });
        if (!vendor) return JSON.stringify({ error: 'Vendor not found' });

        const parsedDate = new Date(input.eventDate);

        // Run pricing engine if a package was provided
        let calculatedEstimate: number | null = null;
        let isOutOfParameters = false;
        if (input.packageId) {
          try {
            const pricing = await calculatePackagePrice({
              packageId: String(input.packageId),
              eventDate: parsedDate,
              guestCount: Number(input.guestCount),
            });
            calculatedEstimate = pricing.total;
            isOutOfParameters = pricing.isOutOfParameters;
          } catch {
            // Proceed without estimate if pricing fails
          }
        }

        const request = await prisma.eventRequest.create({
          data: {
            clientId: user.id,
            providerProfileId: String(input.providerProfileId),
            packageId: input.packageId ? String(input.packageId) : undefined,
            eventId: input.eventId ? String(input.eventId) : undefined,
            eventType: String(input.eventType),
            eventDate: parsedDate,
            guestCount: Number(input.guestCount),
            selectedAddOnIds: [],
            specialRequests: input.specialRequests ? String(input.specialRequests) : undefined,
            calculatedEstimate,
            isOutOfParameters,
            status: 'PENDING',
          },
        });

        // In-app notification to vendor
        const clientName = `${user.firstName} ${user.lastName}`.trim();
        const dateLabel = parsedDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        await prisma.notification.create({
          data: {
            userId: vendor.userId,
            type: 'NEW_REQUEST',
            title: 'New event request',
            message: `${clientName} sent you a request for ${String(input.eventType).toLowerCase().replace(/_/g, ' ')} on ${dateLabel}`,
            data: { eventRequestId: request.id },
          },
        });

        // Fire-and-forget email to vendor
        sendNewRequest(
          vendor.user.email,
          vendor.businessName,
          clientName,
          String(input.eventType),
          parsedDate,
          calculatedEstimate,
        ).catch(() => {});

        return JSON.stringify({
          success: true,
          requestId: request.id,
          vendorName: vendor.businessName,
          isOutOfParameters,
          estimatedTotal: calculatedEstimate,
          dashboardUrl: '/dashboard',
        });
      }

      case 'create_event': {
        if (!user) {
          return JSON.stringify({
            error: 'NOT_AUTHENTICATED',
            message: 'User must be signed in to create an event.',
          });
        }

        const event = await prisma.event.create({
          data: {
            clientId: user.id,
            name: String(input.name),
            eventType: String(input.eventType) as any,
            eventDate: new Date(input.eventDate),
            guestCount: Number(input.guestCount),
            notes: input.notes ? String(input.notes) : undefined,
            status: 'PLANNING',
          },
        });

        return JSON.stringify({
          success: true,
          eventId: event.id,
          name: event.name,
          eventType: event.eventType,
          eventDate: event.eventDate,
          eventUrl: `/events/${event.id}`,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    console.error(`[Jess tool error — ${name}]:`, err?.message ?? err, err?.stack ?? '');
    return JSON.stringify({
      error: err?.message ?? 'Tool execution failed',
      tool: name,
      suggestion: 'Let the user know something went wrong retrieving that info, and suggest they browse FESTV directly or rephrase their request.',
    });
  }
}

// ─── User context builder ─────────────────────────────────────────────────────

async function buildUserContext(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) {
    return 'CURRENT USER CONTEXT:\n- Guest (not logged in)';
  }

  const { id, firstName } = req.user;
  const name = firstName || 'there';

  const roles: string[] = req.user.roles || (req.user.role ? [req.user.role] : []);
  const isClient   = roles.includes('CLIENT');
  const isProvider = roles.includes('PROVIDER');

  const lines: string[] = [`CURRENT USER CONTEXT:`, `- Name: ${name}`];

  if (isClient) {
    lines.push('- Role: Planner');

    const event = await prisma.eventRequest.findFirst({
      where: { clientId: id, status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      select: {
        eventType: true, eventDate: true, guestCount: true,
        specialRequests: true, status: true,
      },
    });

    if (event) {
      const dateStr = event.eventDate
        ? new Date(event.eventDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD';
      lines.push(`- Active event: ${event.eventType}`);
      lines.push(`- Date: ${dateStr} | Guests: ${event.guestCount}`);
      lines.push(`- Request status: ${event.status}`);
      if (event.specialRequests) lines.push(`- Special requests: ${event.specialRequests}`);
    } else {
      lines.push('- No active events yet');
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
      },
    });

    if (profile) {
      const types    = profile.providerTypes.join(', ') || 'not set';
      const verified = profile.verificationStatus === 'VERIFIED' ? 'Yes' : 'No (pending)';
      lines.push(`- Business: ${profile.businessName} (${types})`);
      lines.push(`- Verified: ${verified}`);
      if (!profile.businessDescription) lines.push('- Missing: business description');
      if (!profile.serviceAreas || profile.serviceAreas.length === 0) lines.push('- Missing: service areas');
    } else {
      lines.push('- Profile not set up yet');
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

export const chat = async (req: AuthenticatedRequest, res: Response) => {
  const { messages, pageContext } = req.body as {
    messages: ChatMessage[];
    pageContext?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, error: 'messages array is required' });
    return;
  }

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
  const pageInfo    = pageContext ? `\nCURRENT PAGE: ${pageContext}` : '';
  const systemPrompt = `${JESS_SYSTEM_PROMPT}\n\n${userContext}${pageInfo}`;

  // Build Anthropic message array — must start with a user message
  let apiMessages: Anthropic.MessageParam[] = messages
    .slice(messages.findIndex((m) => m.role === 'user'))
    .map((m) => ({ role: m.role, content: m.content }));

  if (apiMessages.length === 0) {
    res.status(400).json({ success: false, error: 'No user message found in messages array' });
    return;
  }

  // ── Tool-use loop (max 5 rounds to prevent runaway) ────────────────────────
  let finalResponse: Anthropic.Message | null = null;
  const MAX_ROUNDS = 5;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 1000,
        system:     systemPrompt,
        tools:      TOOLS,
        messages:   apiMessages,
      });

      finalResponse = response;

      // If no tool calls, we have the final answer
      if (response.stop_reason !== 'tool_use') break;

      // Execute every tool call in parallel
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type:        'tool_result' as const,
          tool_use_id: block.id,
          content:     await executeTool(
            block.name,
            block.input as Record<string, any>,
            req.user,
          ),
        })),
      );

      // Extend conversation with tool calls + results for next round
      apiMessages = [
        ...apiMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user'      as const, content: toolResults },
      ];
    }
  } catch (err: any) {
    console.error('[Jess] Anthropic API error:', err);
    res.status(500).json({
      success: false,
      error: 'Jess is unavailable right now. Please try again in a moment.',
    });
    return;
  }

  if (!finalResponse) {
    res.status(500).json({ success: false, error: 'No response generated' });
    return;
  }

  // Extract the final text block
  const textBlock = finalResponse.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const raw     = textBlock?.text ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: { message: string; links?: { label: string; href: string }[] } | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object anywhere in the response (e.g. Claude added preamble text)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
  }
  if (!parsed || typeof parsed.message !== 'string') {
    parsed = { message: cleaned || raw, links: [] };
  }

  res.json({
    success: true,
    data: {
      message: parsed.message || raw,
      links:   Array.isArray(parsed.links) ? parsed.links : [],
    },
  });
};
