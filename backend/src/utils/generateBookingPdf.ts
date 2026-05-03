import PDFDocument from 'pdfkit';

export interface BookingPdfData {
  booking: {
    id: string;
    eventType: string;
    eventDate: Date;
    guestCount: number;
    durationHours: number | null;
    depositAmount: number;
    depositPaidAt: Date | null;
    total: number;
    client: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string | null;
    };
    providerProfile: {
      businessName: string;
      user: { email: string; city: string | null; state: string | null };
    };
    package: { name: string; description?: string | null };
    quote: {
      packagePrice: number;
      addOns: unknown;
      addOnsTotal: number;
      adjustments: unknown;
      adjustmentsTotal: number;
      subtotal: number;
      tax: number;
      total: number;
      depositAmount: number;
    };
  };
}

export const generateBookingPdf = (data: BookingPdfData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const { booking } = data;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const gold  = '#C4A06A';
    const dark  = '#1A1714';
    const muted = '#7A7068';
    const light = '#F5F3EF';

    const formatCurrency = (n: number) =>
      new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

    const formatDate = (d: Date) =>
      new Date(d).toLocaleDateString('en-CA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.fontSize(28).font('Helvetica').fillColor(dark).text('FESTV', 50, 50);
    doc.fontSize(10).fillColor(gold).text('festv.org', 50, 82);

    doc.fontSize(10).fillColor(muted)
      .text('Booking Confirmation', 350, 50, { align: 'right' })
      .fontSize(14).fillColor(dark)
      .text(`#FESTV-${booking.id.slice(0, 8).toUpperCase()}`, 350, 65, { align: 'right' })
      .fontSize(9).fillColor(muted)
      .text(`Issued ${new Date().toLocaleDateString('en-CA')}`, 350, 82, { align: 'right' });

    doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#E2DDD6').lineWidth(0.5).stroke();

    // ── CONFIRMED BANNER ──────────────────────────────────────────────────────
    doc.rect(50, 115, 495, 36).fill('#EAF3DE');
    doc.fontSize(11).fillColor('#27500A')
      .text(
        `✓  Booking confirmed — deposit of ${formatCurrency(booking.depositAmount)} received on ${new Date(booking.depositPaidAt ?? new Date()).toLocaleDateString('en-CA')}`,
        65, 126,
      );

    // ── EVENT ─────────────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor(gold).text('EVENT', 50, 170);
    doc.fontSize(20).fillColor(dark).font('Helvetica')
      .text(booking.eventType.replace(/_/g, ' '), 50, 183);
    doc.fontSize(11).fillColor(muted)
      .text(
        `${formatDate(booking.eventDate)}  ·  ${booking.guestCount} guests${booking.durationHours ? `  ·  ${booking.durationHours}h` : ''}`,
        50, 208,
      );

    doc.moveTo(50, 230).lineTo(545, 230).strokeColor('#E2DDD6').lineWidth(0.5).stroke();

    // ── PLANNER + VENDOR ──────────────────────────────────────────────────────
    doc.fontSize(9).fillColor(gold).text('PLANNER', 50, 242);
    doc.fontSize(13).fillColor(dark)
      .text(`${booking.client.firstName} ${booking.client.lastName}`, 50, 255);
    doc.fontSize(10).fillColor(muted)
      .text(booking.client.email, 50, 271)
      .text(booking.client.phoneNumber ?? '', 50, 285);

    doc.fontSize(9).fillColor(gold).text('VENDOR', 300, 242);
    doc.fontSize(13).fillColor(dark)
      .text(booking.providerProfile.businessName, 300, 255);
    doc.fontSize(10).fillColor(muted)
      .text(booking.providerProfile.user.email, 300, 271)
      .text(
        `${booking.providerProfile.user.city ?? ''}${booking.providerProfile.user.state ? `, ${booking.providerProfile.user.state}` : ''}`,
        300, 285,
      );

    doc.moveTo(50, 308).lineTo(545, 308).strokeColor('#E2DDD6').lineWidth(0.5).stroke();

    // ── PACKAGE ───────────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor(gold).text('PACKAGE', 50, 320);
    doc.fontSize(14).fillColor(dark).text(booking.package.name, 50, 333);
    if (booking.package.description) {
      doc.fontSize(10).fillColor(muted).text(booking.package.description, 50, 351, { width: 495 });
    }

    // ── ADD-ONS ───────────────────────────────────────────────────────────────
    const quote   = booking.quote;
    const addOns  = Array.isArray(quote.addOns) ? (quote.addOns as Array<{ name: string; total: number }>) : [];
    let yPos = doc.y + 16;

    if (addOns.length > 0) {
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
      yPos += 12;
      doc.fontSize(9).fillColor(gold).text('ADD-ONS', 50, yPos);
      yPos += 14;
      for (const addon of addOns) {
        doc.fontSize(10).fillColor(dark).text(addon.name, 50, yPos);
        doc.fontSize(10).fillColor(muted).text(formatCurrency(addon.total), 400, yPos, { align: 'right', width: 145 });
        yPos += 16;
      }
    }

    // ── PRICE BREAKDOWN ───────────────────────────────────────────────────────
    yPos += 8;
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
    yPos += 12;
    doc.fontSize(9).fillColor(gold).text('PRICE BREAKDOWN', 50, yPos);
    yPos += 16;

    const priceLine = (label: string, value: number, bold = false) => {
      doc.fontSize(10).fillColor(bold ? dark : muted).text(label, 50, yPos);
      doc.fontSize(bold ? 11 : 10).fillColor(bold ? dark : muted)
        .text(formatCurrency(value), 400, yPos, { align: 'right', width: 145 });
      yPos += 16;
    };

    priceLine('Package price', quote.packagePrice);
    if (addOns.length > 0) priceLine('Add-ons total', quote.addOnsTotal);

    const adjustments = Array.isArray(quote.adjustments)
      ? (quote.adjustments as Array<{ description: string; amount: number }>)
      : [];
    for (const adj of adjustments) priceLine(adj.description, adj.amount);

    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
    yPos += 8;
    priceLine('Subtotal', quote.subtotal);
    priceLine('Tax (15%)', quote.tax);

    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
    yPos += 8;

    doc.fontSize(12).fillColor(dark).text('Total', 50, yPos);
    doc.fontSize(18).fillColor(dark).text(formatCurrency(quote.total), 350, yPos - 3, { align: 'right', width: 195 });
    yPos += 24;

    doc.fontSize(10).fillColor('#3B6D11').text('Deposit paid (10%) ✓', 50, yPos);
    doc.fontSize(10).fillColor('#3B6D11').text(formatCurrency(booking.depositAmount), 400, yPos, { align: 'right', width: 145 });
    yPos += 16;

    const balance = quote.total - booking.depositAmount;
    doc.fontSize(10).fillColor(muted).text('Balance due on event day', 50, yPos);
    doc.fontSize(10).fillColor(dark).text(formatCurrency(balance), 400, yPos, { align: 'right', width: 145 });
    yPos += 24;

    // ── CANCELLATION POLICY ───────────────────────────────────────────────────
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
    yPos += 12;
    doc.rect(50, yPos, 495, 52).fill(light);
    doc.fontSize(9).fillColor(muted).text('CANCELLATION POLICY', 62, yPos + 8);
    doc.fontSize(9).fillColor(muted).text(
      "Deposits are non-refundable within 14 days of the event date. Cancellations made more than 14 days before the event may be eligible for a partial refund at the vendor's discretion. All cancellations must be submitted through the FESTV platform.",
      62, yPos + 22, { width: 471 },
    );
    yPos += 64;

    // ── FOOTER ────────────────────────────────────────────────────────────────
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2DDD6').lineWidth(0.5).stroke();
    yPos += 10;
    doc.fontSize(9).fillColor(muted).text('FESTV · festv.org · support@festv.org', 50, yPos);
    doc.fontSize(9).fillColor(muted).text(
      'This document serves as your official booking confirmation.',
      300, yPos, { align: 'right', width: 245 },
    );

    doc.end();
  });
};
