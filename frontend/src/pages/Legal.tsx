import { useParams, Navigate, Link } from 'react-router-dom';

type LegalDoc = 'terms' | 'privacy' | 'vendor-agreement' | 'cancellation';

// ─── Content components ───────────────────────────────────────────────────────

function TermsContent() {
  return (
    <>
      <div className="notice">⚠️ Draft pending legal review. Not yet legally binding.</div>

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account, accessing, or using the FESTV platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform. These Terms apply to all users, including event planners ("Clients") and service providers ("Vendors").</p>

      <h2>2. Description of Services</h2>
      <p>FESTV is an online marketplace that connects event planners with vendors offering event-related services including catering, venues, photography, entertainment, and floral design. FESTV facilitates connections and transactions but is not itself a party to any service agreement between Clients and Vendors.</p>
      <p>FESTV does not guarantee the quality, safety, legality, or accuracy of any vendor listing, nor the ability of Clients to pay for services. FESTV is not responsible for any disputes arising between Clients and Vendors.</p>

      <h2>3. User Accounts</h2>
      <h3>Registration</h3>
      <p>You must provide accurate, current, and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account.</p>
      <h3>Eligibility</h3>
      <p>You must be at least 18 years of age to use the Platform. By registering, you represent and warrant that you meet this requirement and that all information you provide is truthful and accurate.</p>
      <h3>Account Termination</h3>
      <p>FESTV reserves the right to suspend or terminate any account at any time for violations of these Terms, fraudulent activity, or behavior that harms other users or the platform.</p>

      <h2>4. Client Responsibilities</h2>
      <p>Clients agree to:</p>
      <ul>
        <li>Provide accurate event details when submitting requests</li>
        <li>Communicate professionally and in good faith with Vendors</li>
        <li>Pay agreed-upon deposits and fees on time</li>
        <li>Honor confirmed bookings and cancellation policies</li>
        <li>Not circumvent the Platform to avoid service fees</li>
      </ul>

      <h2>5. Vendor Responsibilities</h2>
      <p>Vendors agree to:</p>
      <ul>
        <li>Maintain accurate and up-to-date profile, package, and pricing information</li>
        <li>Respond to client requests within a reasonable timeframe</li>
        <li>Honor confirmed bookings and quoted prices</li>
        <li>Deliver services as described in their listings and quotes</li>
        <li>Comply with all applicable laws, licenses, and health and safety regulations</li>
        <li>Not list services they are not qualified or licensed to provide</li>
      </ul>

      <h2>6. Booking & Payment</h2>
      <p>When a Client accepts a quote, a booking is created and a deposit becomes due. Deposits are processed through FESTV's payment infrastructure (Stripe). The deposit amount is set at 10% of the total booking value unless otherwise specified by the Vendor.</p>
      <p>FESTV charges a platform fee on completed transactions. Fee details are disclosed at the time of booking. FESTV is not responsible for any taxes or additional fees that may apply to the services rendered.</p>

      <h2>7. Cancellations & Refunds</h2>
      <p>Cancellation and refund terms are governed by FESTV's Cancellation & Refund Policy, which is incorporated into these Terms by reference. Please review that policy before confirming a booking.</p>

      <h2>8. Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Platform for any unlawful purpose</li>
        <li>Post false, misleading, or fraudulent content</li>
        <li>Harass, threaten, or harm other users</li>
        <li>Attempt to gain unauthorized access to any part of the Platform</li>
        <li>Use automated tools to scrape or extract data from the Platform</li>
        <li>Circumvent any security or access controls</li>
      </ul>

      <h2>9. Intellectual Property</h2>
      <p>All content on the Platform — including the FESTV name, logo, design, software, and written materials — is owned by FESTV or its licensors and protected by intellectual property laws. You may not reproduce, modify, or distribute any FESTV content without prior written permission.</p>
      <p>By uploading content to the Platform (photos, logos, descriptions), you grant FESTV a non-exclusive, worldwide, royalty-free license to use, display, and promote that content in connection with operating and marketing the Platform.</p>

      <h2>10. Disclaimer of Warranties</h2>
      <p>The Platform is provided "as is" and "as available" without warranties of any kind, express or implied. FESTV does not warrant that the Platform will be uninterrupted, error-free, or free of viruses or harmful components.</p>

      <h2>11. Limitation of Liability</h2>
      <p>To the fullest extent permitted by law, FESTV and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform or any services booked through it. FESTV's total liability to you shall not exceed the fees paid by you to FESTV in the twelve months preceding the claim.</p>

      <h2>12. Dispute Resolution</h2>
      <p>Any disputes between Clients and Vendors are the responsibility of those parties. FESTV may, at its discretion, attempt to facilitate resolution but is not obligated to do so.</p>
      <p>Any disputes between you and FESTV shall first be subject to informal negotiation. If unresolved, disputes shall be submitted to binding arbitration in accordance with the rules of [Arbitration Body — TBD], and the seat of arbitration shall be [Jurisdiction — TBD].</p>

      <h2>13. Governing Law</h2>
      <p>These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction — TBD], without regard to its conflict of law provisions.</p>

      <h2>14. Modifications</h2>
      <p>FESTV reserves the right to modify these Terms at any time. Changes will be communicated via email or platform notification. Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.</p>

      <h2>15. Contact</h2>
      <p>For questions about these Terms, contact us at <a href="mailto:legal@festv.org" style={{ color: '#C4A06A' }}>legal@festv.org</a>.</p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <div className="notice">⚠️ Draft pending legal review. Not yet legally binding.</div>

      <h2>1. Introduction</h2>
      <p>FESTV ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the FESTV platform. By using the Platform, you consent to the practices described in this Policy.</p>

      <h2>2. Information We Collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li><strong>Account information:</strong> name, email address, password, phone number</li>
        <li><strong>Profile information:</strong> profile photo, city, state, business details (for Vendors)</li>
        <li><strong>Event information:</strong> event type, date, guest count, preferences</li>
        <li><strong>Payment information:</strong> processed securely via Stripe — FESTV does not store full card numbers</li>
        <li><strong>Communications:</strong> messages sent between Clients and Vendors on the platform</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Log data (IP address, browser type, pages visited, time and date)</li>
        <li>Device information (device type, operating system)</li>
        <li>Cookies and similar tracking technologies</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Operate, maintain, and improve the Platform</li>
        <li>Create and manage your account</li>
        <li>Facilitate bookings and process payments</li>
        <li>Send transactional emails (booking confirmations, quote notifications, etc.)</li>
        <li>Send marketing communications (with your consent)</li>
        <li>Respond to support requests</li>
        <li>Detect and prevent fraud and abuse</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>4. How We Share Your Information</h2>
      <p>We do not sell your personal information. We may share your information with:</p>
      <ul>
        <li><strong>Other users:</strong> Vendor profiles are publicly visible. Client contact details are shared with Vendors upon booking confirmation.</li>
        <li><strong>Service providers:</strong> third-party tools that help us operate (Stripe for payments, Resend for email, Cloudinary for images, Render for hosting). These providers are bound by data processing agreements.</li>
        <li><strong>Legal authorities:</strong> when required by law, court order, or to protect the safety of users or the public.</li>
        <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets.</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>We use cookies and similar technologies to keep you logged in, remember your preferences, and analyse platform usage. You can control cookie settings through your browser, but disabling cookies may limit platform functionality.</p>

      <h2>6. Data Retention</h2>
      <p>We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time (see Your Rights below). We may retain certain information for legal compliance or dispute resolution purposes.</p>

      <h2>7. Data Security</h2>
      <p>We implement industry-standard security measures including encryption in transit (TLS), hashed passwords (bcrypt), and access controls. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.</p>

      <h2>8. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate or incomplete data</li>
        <li>Request deletion of your data ("right to be forgotten")</li>
        <li>Object to or restrict certain processing</li>
        <li>Data portability (receive your data in a machine-readable format)</li>
        <li>Withdraw consent at any time (where processing is based on consent)</li>
      </ul>
      <p>To exercise these rights, contact us at <a href="mailto:privacy@festv.org" style={{ color: '#C4A06A' }}>privacy@festv.org</a>.</p>

      <h2>9. Children's Privacy</h2>
      <p>The Platform is not intended for users under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a minor has provided us with personal data, we will delete it promptly.</p>

      <h2>10. International Transfers</h2>
      <p>Your data may be transferred to and processed in countries other than your own. We take steps to ensure appropriate safeguards are in place for such transfers in accordance with applicable law.</p>

      <h2>11. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or a prominent notice on the Platform. Your continued use after changes are posted constitutes acceptance.</p>

      <h2>12. Contact</h2>
      <p>Questions about this Privacy Policy? Contact our privacy team at <a href="mailto:privacy@festv.org" style={{ color: '#C4A06A' }}>privacy@festv.org</a>.</p>
    </>
  );
}

function VendorAgreementContent() {
  return (
    <>
      <div className="notice">⚠️ Draft pending legal review. Not yet legally binding.</div>

      <h2>1. Agreement Overview</h2>
      <p>This Vendor Agreement ("Agreement") governs your participation as a service provider ("Vendor") on the FESTV platform. By completing registration and listing services, you agree to be bound by this Agreement in addition to FESTV's Terms of Service and Privacy Policy.</p>

      <h2>2. Eligibility & Verification</h2>
      <p>To list on FESTV, Vendors must:</p>
      <ul>
        <li>Be a legally operating business or sole proprietor</li>
        <li>Hold all required licenses, permits, and insurance for the services offered</li>
        <li>Pass FESTV's admin verification review before appearing in search results</li>
        <li>Maintain active status by keeping profile and availability current</li>
      </ul>
      <p>FESTV reserves the right to reject any application or revoke Vendor status at its sole discretion.</p>

      <h2>3. Listing Requirements</h2>
      <p>Your vendor profile and packages must:</p>
      <ul>
        <li>Accurately describe the services you offer and your service area</li>
        <li>Use real photographs of your work (no stock photos misrepresenting your services)</li>
        <li>Reflect accurate pricing — you may not quote a price materially higher than your listed rate</li>
        <li>Disclose any exclusions, minimums, or conditions that affect pricing</li>
      </ul>

      <h2>4. Pricing & Platform Fees</h2>
      <table>
        <thead>
          <tr>
            <th>Fee Type</th>
            <th>Amount</th>
            <th>When Charged</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Platform commission</td>
            <td>[TBD]%</td>
            <td>On deposit payment</td>
          </tr>
          <tr>
            <td>Stripe processing</td>
            <td>~2.9% + $0.30</td>
            <td>On each transaction</td>
          </tr>
          <tr>
            <td>Listing fee</td>
            <td>$0 (free to list)</td>
            <td>N/A</td>
          </tr>
        </tbody>
      </table>
      <p>Payouts are processed via Stripe Connect to your connected bank account. Payout timing is subject to Stripe's standard processing schedule. FESTV is not responsible for delays caused by Stripe or your financial institution.</p>

      <h2>5. Booking Process</h2>
      <p>When a Client submits a request, FESTV may auto-generate a quote based on your package pricing. You are responsible for reviewing and approving or modifying quotes before they are presented to Clients. Once a Client accepts a quote and pays the deposit, the booking is confirmed and binding.</p>
      <p>You must not cancel a confirmed booking except in documented exceptional circumstances (force majeure, health emergency, etc.). Repeated cancellations may result in suspension or removal from the platform.</p>

      <h2>6. Cancellation by Vendor</h2>
      <p>If you must cancel a confirmed booking:</p>
      <ul>
        <li>Notify FESTV and the Client immediately</li>
        <li>The Client's deposit will be refunded in full</li>
        <li>You may be charged an administrative fee [amount TBD]</li>
        <li>Repeated cancellations will result in account review and possible removal</li>
      </ul>

      <h2>7. Disputes</h2>
      <p>In the event of a dispute with a Client, you agree to:</p>
      <ul>
        <li>First attempt resolution directly with the Client</li>
        <li>Cooperate with FESTV's dispute resolution process if escalated</li>
        <li>Abide by FESTV's determination in cases where evidence supports the Client's claim</li>
      </ul>

      <h2>8. Conduct Standards</h2>
      <p>Vendors must maintain professional conduct at all times, including:</p>
      <ul>
        <li>Responding to client messages within 48 hours</li>
        <li>Attending confirmed bookings as scheduled</li>
        <li>Delivering services at the quality level represented in your profile</li>
        <li>Treating all clients respectfully regardless of background</li>
      </ul>

      <h2>9. Intellectual Property</h2>
      <p>You retain ownership of content you upload (photos, descriptions). By uploading, you grant FESTV a license to use this content to promote your listing and the platform. You represent that you own or have rights to all content you upload.</p>

      <h2>10. Termination</h2>
      <p>Either party may terminate this Agreement with [TBD] days' written notice. FESTV may terminate immediately for material breach, fraudulent activity, or conduct harmful to clients or the platform. Upon termination, any pending confirmed bookings must still be honoured or arrangements made for the Client.</p>

      <h2>11. Independent Contractor</h2>
      <p>Vendors are independent contractors, not employees, agents, or partners of FESTV. Nothing in this Agreement creates an employment or agency relationship. Vendors are solely responsible for their own taxes, insurance, and legal compliance.</p>

      <h2>12. Contact</h2>
      <p>Questions about this Agreement? Contact us at <a href="mailto:vendors@festv.org" style={{ color: '#C4A06A' }}>vendors@festv.org</a>.</p>
    </>
  );
}

function CancellationContent() {
  return (
    <>
      <div className="notice">⚠️ Draft pending legal review. Not yet legally binding.</div>

      <h2>Overview</h2>
      <p>This policy governs cancellations and refunds for bookings made through the FESTV platform. By confirming a booking, both Clients and Vendors agree to the terms set out below. FESTV acts as a marketplace and is not a party to the service agreement; however, we enforce this policy to protect both parties.</p>

      <h2>Client Cancellations</h2>
      <p>Refund eligibility is determined by how far in advance of the event date the cancellation is made:</p>

      <table>
        <thead>
          <tr>
            <th>Cancellation Timing</th>
            <th>Deposit Refund</th>
            <th>Additional Charges</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>More than 90 days before event</td>
            <td>100% refund</td>
            <td>None</td>
          </tr>
          <tr>
            <td>30–90 days before event</td>
            <td>50% refund</td>
            <td>None</td>
          </tr>
          <tr>
            <td>14–29 days before event</td>
            <td>25% refund</td>
            <td>None</td>
          </tr>
          <tr>
            <td>Less than 14 days before event</td>
            <td>No refund</td>
            <td>None</td>
          </tr>
          <tr>
            <td>No-show / same-day cancellation</td>
            <td>No refund</td>
            <td>May owe balance per vendor contract</td>
          </tr>
        </tbody>
      </table>

      <p>All cancellations must be submitted through the FESTV platform. Verbal or email-only cancellations are not accepted. Cancellation time is calculated from the moment the request is submitted on the platform.</p>

      <h2>Vendor Cancellations</h2>
      <p>If a Vendor cancels a confirmed booking for any reason other than a documented force majeure event:</p>
      <ul>
        <li>The Client receives a 100% refund of the deposit</li>
        <li>The Vendor may be charged an administrative fee [TBD]</li>
        <li>The Vendor's profile may be flagged and subject to review</li>
        <li>Repeated cancellations may result in removal from the platform</li>
      </ul>

      <h3>Force Majeure</h3>
      <p>In the event of cancellation due to circumstances beyond either party's reasonable control (natural disaster, government-imposed restrictions, serious illness), FESTV will work with both parties to determine an equitable outcome, which may include full or partial refunds or rescheduling.</p>

      <h2>Rescheduling</h2>
      <p>Rescheduling is subject to Vendor availability and must be agreed upon by both parties. A reschedule request does not constitute a cancellation if the new date is confirmed within [TBD] days. If the new date cannot be agreed upon, standard cancellation terms apply.</p>

      <h2>Refund Processing</h2>
      <p>Approved refunds are processed through Stripe to the original payment method. Processing times:</p>
      <ul>
        <li>Credit / debit card: 5–10 business days</li>
        <li>Other payment methods: timing may vary per Stripe's schedule</li>
      </ul>
      <p>FESTV platform fees are non-refundable once a booking is confirmed, except in cases of Vendor cancellation or documented force majeure.</p>

      <h2>Disputes</h2>
      <p>If you believe a cancellation decision was made in error, or if a Vendor failed to deliver agreed services, you may submit a dispute through your FESTV dashboard within 7 days of the event date. FESTV will review evidence from both parties and issue a determination within [TBD] business days.</p>
      <p>FESTV's dispute determinations are final within the platform. Either party retains the right to pursue external legal remedies independently.</p>

      <h2>Contact</h2>
      <p>For cancellation or refund inquiries, contact us at <a href="mailto:support@festv.org" style={{ color: '#C4A06A' }}>support@festv.org</a>.</p>
    </>
  );
}

// ─── Document registry ────────────────────────────────────────────────────────

const docs: Record<LegalDoc, { title: string; content: React.ReactNode }> = {
  terms:               { title: 'Terms of Service',            content: <TermsContent /> },
  privacy:             { title: 'Privacy Policy',               content: <PrivacyContent /> },
  'vendor-agreement':  { title: 'Vendor Agreement',             content: <VendorAgreementContent /> },
  cancellation:        { title: 'Cancellation & Refund Policy', content: <CancellationContent /> },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Legal() {
  const { doc } = useParams<{ doc: string }>();
  const current = docs[doc as LegalDoc];

  if (!current) return <Navigate to="/legal/terms" replace />;

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <div className="max-w-[720px] mx-auto px-6 py-16">

        {/* Nav pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {(Object.keys(docs) as LegalDoc[]).map(key => (
            <Link
              key={key}
              to={`/legal/${key}`}
              className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-colors ${
                doc === key
                  ? 'bg-[#1A1714] text-[#F5F3EF] border-[#1A1714]'
                  : 'bg-white text-[#7A7068] border-border hover:border-[#C4A06A]'
              }`}
            >
              {docs[key].title}
            </Link>
          ))}
        </div>

        {/* Header */}
        <div className="mb-10 pb-6 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-[#C4A06A] mb-2">Legal</p>
          <h1 className="font-serif text-[36px] font-light text-[#1A1714]">{current.title}</h1>
          <p className="text-[12px] text-[#7A7068] mt-2">Last updated: May 2026 · Pending legal review</p>
        </div>

        {/* Content */}
        <div className="prose-festv">
          {current.content}
        </div>

      </div>
    </div>
  );
}
