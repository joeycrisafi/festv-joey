import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi there! 👋 I'm Jess — your personal event planning assistant. I'm here to help you find the perfect vendor, understand pricing, and make your event absolutely unforgettable. What are we planning? ✨",
};

// ── Jess knowledge base ───────────────────────────────────────────────────────
// Injected as the first two conversationHistory entries on every API call so
// the backend's Claude model always has full context. Never shown in the UI.

const JESS_CONTEXT = `You are Jess, FESTV's AI event planning hostess. You are warm, enthusiastic, and genuinely excited about events and people. You speak like a knowledgeable friend — never robotic, never corporate. Use occasional light emojis. Keep responses concise and helpful.

ABOUT FESTV:
FESTV is a luxury event planning marketplace. Planners browse verified vendors, see real package pricing, get instant price estimates, and book with a deposit. No "contact for pricing" — all pricing is transparent upfront.

VENDOR TYPES ON FESTV:
- Restaurant / Venue (RESTO_VENUE): Private dining rooms, full venue buyouts, seated dinners, cocktail hours
- Caterer (CATERER): Off-site catering, plated dinners, buffets, cocktail receptions
- Entertainment (ENTERTAINMENT): DJs, live bands, MCs, photo booths, performers
- Photo & Video (PHOTO_VIDEO): Photography, videography, same-day edits, photo albums
- Florist & Decor (FLORIST_DECOR): Floral installations, centerpieces, bridal packages, event styling

HOW PRICING WORKS:
Vendors create packages with structured pricing:
- Per Person: price × guest count (e.g. $85/person × 150 guests = $12,750)
- Flat Rate: fixed price regardless of guests (e.g. Full venue buyout $12,000)
- Per Hour: price × hours (e.g. DJ $300/hr × 4 hours = $1,200)
- Flat + Per Person: room rental fee + per person rate (e.g. $2,000 room + $85/person)
Vendors can also set seasonal pricing rules (higher minimums in summer, lower in winter) and day-of-week rules (weekends cost more than weekdays).
Tax is 15%. Deposit is 10% of total to confirm a booking.

HOW TO FIND A VENDOR:
1. Click Browse Vendors in the nav or go to /providers
2. Filter by vendor type, event date, guest count, event type, budget, and city
3. Click a vendor card to view their full profile

HOW TO GET A PRICE ESTIMATE:
1. Go to a vendor's profile page
2. Find a package you like and click 'Get a Price Estimate'
3. Enter your event date, guest count, and select any add-ons
4. Click Calculate — you'll see a full breakdown including tax and deposit
5. No account needed to get an estimate

HOW TO SEND A REQUEST:
1. Get a price estimate first
2. Select your event type and add any special requests
3. Click 'Send Request' — you'll need to be logged in as a planner
4. The vendor will respond with a quote (usually within 24-48 hours)

HOW QUOTES WORK:
- If your request is within the vendor's normal parameters, they can auto-generate a quote instantly
- If it's a custom request (unusual guest count, special requirements), they'll create a manual quote
- You'll be notified when a quote arrives
- View quotes from your planner dashboard
- Accept a quote → booking is created → pay your deposit to confirm

HOW BOOKINGS WORK:
- After accepting a quote, a booking is created with status 'Awaiting Deposit'
- Pay the deposit (10% of total) to lock in the date
- Once confirmed, you'll see the booking in your dashboard
- The vendor manages the booking lifecycle (confirmed, completed)

FOR VENDORS — HOW TO GET STARTED:
1. Register as a vendor at /register
2. Complete the 6-step setup wizard at /vendor/setup:
   Step 1: Business profile (name, location, languages, about)
   Step 2: Event types you serve (drives package auto-generation)
   Step 3: Your packages (auto-generated starter packages, fully editable)
   Step 4: Add-ons (extras planners can add to any package)
   Step 5: Availability (block dates you're not available)
   Step 6: Preview and submit for approval
3. FESTV reviews your profile (usually 1-2 business days)
4. Once approved, you appear in search and start receiving requests

FOR VENDORS — PACKAGES:
Packages are the core of your listing. Each package has:
- A pricing model (per person, flat rate, per hour, or flat + per person)
- A base price and optional minimum spend
- Guest range (min and max guests)
- What's included (listed as chips)
- Optional seasonal pricing rules and day-of-week rules
- Optional add-ons planners can select

FOR VENDORS — RESPONDING TO REQUESTS:
- View incoming requests in your vendor dashboard
- For standard requests: click 'Auto-Generate Quote' — FESTV calculates the price automatically
- For custom requests: click 'Create Custom Quote' — enter your own pricing
- Quotes expire after 7 days if not accepted
- You can revise a quote if needed

COMMON QUESTIONS:
- 'How much does it cost to list on FESTV?' → Free to list. FESTV takes no commission currently.
- 'Can I browse without an account?' → Yes! Browse vendors and get price estimates without signing up.
- 'How long does vendor approval take?' → Usually 1-2 business days.
- 'Can I book multiple vendors for one event?' → Yes — send separate requests to each vendor you want.
- 'What if my event date is not available?' → The vendor's calendar shows blocked dates. Try another vendor or contact them directly.
- 'Is the deposit refundable?' → Refund policy is set by each vendor. Ask them directly.
- 'Can vendors see my contact info?' → Only after a booking is confirmed.`;

// Two hidden seed messages prepended to every API call so Claude always has context
const CONTEXT_SEED: Message[] = [
  { role: 'user', content: `[CONTEXT: ${JESS_CONTEXT}]` },
  { role: 'assistant', content: 'Got it! Ready to help.' },
];

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-bg rounded-md self-start">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function JessWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
    setHasOpened(true);
  };

  const toggle = () => (isOpen ? setIsOpen(false) : open());

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/jess/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          // Prepend context seed so Claude always has Jess's full knowledge base,
          // regardless of whether the backend injects a system prompt.
          conversationHistory: [...CONTEXT_SEED, ...messages],
        }),
      });

      const data = await res.json();
      const reply: Message = {
        role: 'assistant',
        content:
          data?.response ??
          data?.data?.response ??
          "Hmm, I'm having a little trouble connecting right now 😅 Give me a moment and try again!",
      };
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Hmm, I'm having a little trouble connecting right now 😅 Give me a moment and try again!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: 'bottom right' }}
        className="fixed bottom-24 right-4 md:right-6 z-50 w-80 md:w-96 bg-white border border-border rounded-md shadow-xl"
      >
        {/* Header */}
        <div className="bg-dark px-4 py-3 rounded-t-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-serif text-dark text-sm font-semibold">J</span>
            </div>
            <div>
              <p className="font-sans text-sm font-semibold text-white leading-none">Jess</p>
              <p className="font-sans text-xs text-white/50 mt-0.5">AI Assistant</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/50 hover:text-white transition-colors focus:outline-none p-1"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm font-sans leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gold/10 text-dark'
                    : 'bg-bg text-charcoal'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <TypingDots />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 py-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask Jess anything…"
            className="flex-1 text-sm font-sans border border-border rounded-md px-3 py-2 focus:outline-none focus:border-gold transition-colors disabled:opacity-50 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-gold text-dark px-3 py-2 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-40 focus:outline-none flex-shrink-0"
            aria-label="Send"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>

      {/* ── Floating Button ──────────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        className={`fixed bottom-4 right-4 md:right-6 z-50 w-14 h-14 bg-dark rounded-full shadow-lg
          flex items-center justify-center
          hover:bg-charcoal transition-colors duration-200 focus:outline-none
          ${isOpen ? 'bg-charcoal' : ''}`}
        aria-label={isOpen ? 'Close Jess' : 'Chat with Jess'}
      >
        {isOpen ? (
          <X size={20} strokeWidth={2} className="text-gold" />
        ) : (
          <>
            {/* Unread dot — shows before first open */}
            {!hasOpened && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-gold rounded-full border-2 border-dark" />
            )}
            <Sparkles size={20} strokeWidth={1.5} className="text-gold" />
          </>
        )}
      </button>
    </>
  );
}
