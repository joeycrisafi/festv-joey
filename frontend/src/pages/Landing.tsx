import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Wine, Music, Camera, Flower2 } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Vendor type pills & cards ────────────────────────────────────────────────
const vendorTypes = [
  {
    label: 'Restaurant / Venue',
    Icon: UtensilsCrossed,
    type: 'RESTO_VENUE',
    desc: 'Private dining rooms, full venue buyouts, and unforgettable spaces.',
  },
  {
    label: 'Caterer',
    Icon: Wine,
    type: 'CATERER',
    desc: 'From plated dinners to grazing tables, catering for every occasion.',
  },
  {
    label: 'Entertainment',
    Icon: Music,
    type: 'ENTERTAINMENT',
    desc: 'DJs, live bands, MCs, and production for any event.',
  },
  {
    label: 'Photo & Video',
    Icon: Camera,
    type: 'PHOTO_VIDEO',
    desc: 'Photography and videography to capture every moment.',
  },
  {
    label: 'Florist & Decor',
    Icon: Flower2,
    type: 'FLORIST_DECOR',
    desc: 'Floral design and event styling that sets the scene.',
  },
];

// ── How-it-works steps ───────────────────────────────────────────────────────
const plannerSteps = [
  {
    title: 'Browse vendors',
    desc: 'Explore verified vendors and see real package prices.',
  },
  {
    title: 'Send a request',
    desc: 'Pick a package, date, and guest count. Send your request in minutes.',
  },
  {
    title: 'Receive your quote',
    desc: 'Vendors respond with a detailed quote based on your needs.',
  },
  {
    title: 'Confirm & celebrate',
    desc: 'Accept the quote, pay your deposit, and get ready for your event.',
  },
];

const vendorSteps = [
  {
    title: 'Create your packages',
    desc: 'Define your services with structured pricing, seasonal rates, and add-ons.',
  },
  {
    title: 'Get discovered',
    desc: 'Your profile goes live to planners searching for vendors like you.',
  },
  {
    title: 'Receive requests',
    desc: 'Planners send you requests with their event details and guest count.',
  },
  {
    title: 'Get booked & paid',
    desc: 'Send your quote, get confirmed, collect your deposit.',
  },
];

// ── Shared whileInView transition ─────────────────────────────────────────────
const inView = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: 'easeOut' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Landing() {
  const [activeTab, setActiveTab] = useState<'planner' | 'vendor'>('planner');
  const steps = activeTab === 'planner' ? plannerSteps : vendorSteps;

  return (
    <div className="overflow-hidden">

      {/* ── SECTION 1: HERO ─────────────────────────────────────────────────── */}
      <section className="min-h-screen bg-bg flex flex-col items-center justify-start px-6">
        <div className="w-full max-w-4xl mx-auto text-center" style={{ paddingTop: '20vh' }}>

          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="font-sans text-xs tracking-widest uppercase text-gold mb-6"
          >
            The Luxury Event Planning Marketplace
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="font-serif font-light text-6xl md:text-8xl text-dark leading-none"
          >
            Every great event<br />starts here.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="font-sans text-base md:text-lg text-muted max-w-lg mx-auto mt-6 leading-relaxed"
          >
            Browse curated vendors, see real package pricing, and book with confidence — all in one place.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <Link
              to="/events/new"
              className="bg-gold text-dark font-sans text-xs tracking-widest uppercase px-8 py-4 hover:bg-gold-dark transition-colors duration-200"
            >
              Plan an Event
            </Link>
            <Link
              to="/providers"
              className="border border-gold text-gold font-sans text-xs tracking-widest uppercase px-8 py-4 hover:bg-gold/5 transition-colors duration-200"
            >
              Find a Vendor
            </Link>
            <Link
              to="/register?role=PROVIDER"
              className="border border-gold/40 text-gold/70 font-sans text-xs tracking-widest uppercase px-8 py-4 hover:border-gold hover:text-gold transition-colors duration-200"
            >
              List Your Business
            </Link>
          </motion.div>

          {/* Vendor type pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="flex flex-wrap gap-3 justify-center mt-8"
          >
            {vendorTypes.map((v) => (
              <Link
                key={v.type}
                to={`/providers?type=${v.type}`}
                className="border border-border text-charcoal text-xs font-sans px-4 py-2 rounded-full hover:border-gold hover:text-gold transition-colors duration-200 cursor-pointer"
              >
                {v.label}
              </Link>
            ))}
          </motion.div>

          {/* Gold rule */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-12 w-16 border-t border-gold mx-auto"
          />
        </div>
      </section>

      {/* ── SECTION 2: WHY FESTV ────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">

          {/* Section heading — each element gets its own motion wrapper */}
          <motion.p
            {...inView}
            className="font-sans text-xs tracking-widest uppercase text-gold text-center mb-4"
          >
            Why FESTV
          </motion.p>
          <motion.h2
            {...inView}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="font-serif text-4xl text-dark text-center mb-16"
          >
            A smarter way to plan
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

            {/* 01 */}
            <motion.div {...inView} transition={{ duration: 0.6, ease: 'easeOut', delay: 0 }}>
              <span className="font-serif text-5xl font-light" style={{ color: 'rgba(196,160,106,0.3)' }}>
                01
              </span>
              <h3 className="font-serif text-xl text-dark mt-2">Real pricing, upfront</h3>
              <p className="text-muted text-sm leading-relaxed mt-3">
                Every vendor defines their packages with structured pricing rules. See real numbers before you
                ever reach out — no "contact for pricing."
              </p>
            </motion.div>

            {/* 02 */}
            <motion.div {...inView} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}>
              <span className="font-serif text-5xl font-light" style={{ color: 'rgba(196,160,106,0.3)' }}>
                02
              </span>
              <h3 className="font-serif text-xl text-dark mt-2">Verified vendors only</h3>
              <p className="text-muted text-sm leading-relaxed mt-3">
                Every vendor on FESTV is reviewed and approved before going live. You're browsing a curated
                network, not a directory.
              </p>
            </motion.div>

            {/* 03 */}
            <motion.div {...inView} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}>
              <span className="font-serif text-5xl font-light" style={{ color: 'rgba(196,160,106,0.3)' }}>
                03
              </span>
              <h3 className="font-serif text-xl text-dark mt-2">Booking made simple</h3>
              <p className="text-muted text-sm leading-relaxed mt-3">
                Request, receive a quote, pay your deposit. The whole process is structured and transparent
                from start to finish.
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="bg-bg py-24">
        <div className="max-w-4xl mx-auto px-6">

          {/* Section heading — split into separate motion elements */}
          <motion.p
            {...inView}
            className="font-sans text-xs tracking-widest uppercase text-gold text-center mb-4"
          >
            How It Works
          </motion.p>
          <motion.h2
            {...inView}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="font-serif text-4xl text-dark text-center mb-10"
          >
            Simple for everyone
          </motion.h2>

          {/* Tab toggle */}
          <div className="flex items-center justify-center gap-8 mb-16">
            <button
              onClick={() => setActiveTab('planner')}
              className={`font-sans text-sm tracking-wide transition-all duration-200 focus:outline-none outline-none pb-2 border-b-2 ${
                activeTab === 'planner'
                  ? 'text-gold border-gold font-medium'
                  : 'text-muted hover:text-charcoal border-transparent'
              }`}
            >
              I'm planning an event
            </button>
            <button
              onClick={() => setActiveTab('vendor')}
              className={`font-sans text-sm tracking-wide transition-all duration-200 focus:outline-none outline-none pb-2 border-b-2 ${
                activeTab === 'vendor'
                  ? 'text-gold border-gold font-medium'
                  : 'text-muted hover:text-charcoal border-transparent'
              }`}
            >
              I'm a vendor
            </button>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-4 left-1/2 w-full h-px bg-gold/30 -z-10" />

            {steps.map((step, i) => (
              <div key={step.title} className="relative z-10 flex flex-col items-center text-center px-4 mb-10 md:mb-0">
                <span className="font-serif text-4xl text-gold/40 font-light mb-3 bg-bg px-2">
                  {i + 1}
                </span>
                <h4 className="font-sans font-medium text-sm text-dark mt-3">{step.title}</h4>
                <p className="font-sans text-xs text-muted mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── SECTION 4: VENDOR TYPE SHOWCASE ────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-6">

          {/* Section heading — split into separate motion elements */}
          <motion.p
            {...inView}
            className="font-sans text-xs tracking-widest uppercase text-gold text-center mb-4"
          >
            Explore Vendors
          </motion.p>
          <motion.h2
            {...inView}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="font-serif text-4xl text-dark text-center mb-16"
          >
            Find the right vendor for your event
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {vendorTypes.map((v, i) => (
              <motion.div
                key={v.type}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: Math.min(i, 4) * 0.07 }}
              >
                <Link
                  to={`/providers?type=${v.type}`}
                  className="bg-bg border border-border rounded-2xl p-6 flex flex-col hover:border-gold hover:shadow-sm transition-all duration-200 group"
                >
                  <v.Icon size={28} strokeWidth={1.5} className="text-gold" />
                  <span className="font-serif text-lg text-dark mt-4 leading-snug">{v.label}</span>
                  <span className="text-muted text-xs mt-2 leading-relaxed flex-1">{v.desc}</span>
                  <span className="text-gold text-xs mt-4 font-sans group-hover:underline">Browse →</span>
                </Link>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ── SECTION 5: VENDOR CTA BANNER ────────────────────────────────────── */}
      <section className="bg-dark py-20">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center px-6"
        >
          <h2 className="font-serif text-4xl text-white">Are you a vendor?</h2>
          <p className="text-muted text-base mt-4 max-w-lg mx-auto leading-relaxed">
            Join FESTV and start receiving booking requests from planners looking for exactly what you offer.
          </p>
          <Link
            to="/register?role=PROVIDER"
            className="mt-8 inline-block border border-gold text-gold px-12 py-4 text-xs tracking-widest uppercase font-sans hover:bg-gold hover:text-dark transition-all duration-200"
          >
            List Your Business
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
