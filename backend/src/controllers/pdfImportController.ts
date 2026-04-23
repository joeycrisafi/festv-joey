import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System prompt per vendor type ──────────────────────────────────────────

const EXTRACTION_PROMPTS: Record<string, string> = {
  RESTO_VENUE: `You are extracting structured data from a restaurant/venue's menu or service PDF for the FESTV event platform.

Extract the following and return ONLY valid JSON (no markdown, no commentary):
{
  "services": [
    {
      "name": string,              // e.g. "Full Venue Buyout", "Private Dining Room"
      "description": string,
      "pricePerPerson": number|null,
      "flatPrice": number|null,
      "capacity": number|null,
      "duration": string|null      // e.g. "4 hours", "Full day"
    }
  ],
  "menuSections": [
    {
      "section": string,           // e.g. "Appetizers", "Mains", "Desserts"
      "items": [
        {
          "name": string,
          "description": string|null,
          "price": number|null,
          "dietaryTags": string[]  // e.g. ["vegan","gluten-free"]
        }
      ]
    }
  ],
  "barPackages": [
    {
      "name": string,              // e.g. "Open Bar", "Beer & Wine"
      "pricePerPerson": number|null,
      "flatPrice": number|null,
      "duration": string|null,
      "includes": string[]
    }
  ],
  "addOns": [
    {
      "name": string,
      "price": number|null,
      "unit": string|null          // e.g. "per person", "per table", "flat"
    }
  ],
  "notes": string|null             // any important policies or minimums
}`,

  CATERER: `You are extracting structured data from a caterer's menu/service PDF for the FESTV event platform.

Extract and return ONLY valid JSON:
{
  "menuSections": [
    {
      "section": string,
      "items": [
        {
          "name": string,
          "description": string|null,
          "pricePerPerson": number|null,
          "flatPrice": number|null,
          "minGuests": number|null,
          "dietaryTags": string[]
        }
      ]
    }
  ],
  "packages": [
    {
      "name": string,
      "description": string|null,
      "pricePerPerson": number|null,
      "flatPrice": number|null,
      "minGuests": number|null,
      "includes": string[]
    }
  ],
  "addOns": [
    {
      "name": string,
      "price": number|null,
      "unit": string|null
    }
  ],
  "minimums": string|null,
  "notes": string|null
}`,

  ENTERTAINMENT: `You are extracting structured data from an entertainment provider's PDF (DJ, band, performer, etc.) for the FESTV event platform.

Extract and return ONLY valid JSON:
{
  "packages": [
    {
      "name": string,              // e.g. "4-Hour DJ Package", "Live Band - Standard"
      "description": string|null,
      "flatPrice": number|null,
      "duration": string|null,
      "includes": string[],        // e.g. ["Setup/breakdown", "MC", "Light show"]
      "extras": [
        {
          "name": string,
          "price": number|null
        }
      ]
    }
  ],
  "equipmentIncluded": string[],   // list of gear included
  "genres": string[],              // music genres / performance styles
  "notes": string|null
}`,

  PHOTO_VIDEO: `You are extracting structured data from a photographer/videographer's PDF for the FESTV event platform.

Extract and return ONLY valid JSON:
{
  "packages": [
    {
      "name": string,              // e.g. "6-Hour Photo Coverage", "Full Day Photo + Video"
      "description": string|null,
      "flatPrice": number|null,
      "duration": string|null,
      "includes": string[],        // deliverables: edited photos, highlight reel, etc.
      "extras": [
        {
          "name": string,
          "price": number|null
        }
      ]
    }
  ],
  "turnaroundTime": string|null,   // e.g. "4-6 weeks"
  "travelPolicy": string|null,
  "notes": string|null
}`,

  FLORIST_DECOR: `You are extracting structured data from a florist/decorator's PDF for the FESTV event platform.

Extract and return ONLY valid JSON:
{
  "arrangements": [
    {
      "name": string,              // e.g. "Centerpiece - Garden Style", "Bridal Bouquet"
      "description": string|null,
      "pricePerUnit": number|null,
      "flatPrice": number|null,
      "unit": string|null          // e.g. "per table", "per piece", "flat"
    }
  ],
  "packages": [
    {
      "name": string,
      "description": string|null,
      "flatPrice": number|null,
      "includes": string[]
    }
  ],
  "addOns": [
    {
      "name": string,
      "price": number|null,
      "unit": string|null
    }
  ],
  "minimums": string|null,
  "notes": string|null
}`,
};

// ─── Controller ──────────────────────────────────────────────────────────────

export const importFromPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No PDF file uploaded', 400);
  }

  const vendorType = (req.body.vendorType as string || '').toUpperCase();
  const systemPrompt = EXTRACTION_PROMPTS[vendorType];
  if (!systemPrompt) {
    throw new AppError(`Invalid vendor type: ${vendorType}. Must be one of: ${Object.keys(EXTRACTION_PROMPTS).join(', ')}`, 400);
  }

  // Extract text from PDF buffer
  let pdfText: string;
  try {
    const parsed = await pdfParse(req.file.buffer);
    pdfText = parsed.text.trim();
  } catch (err) {
    throw new AppError('Failed to parse PDF. Make sure the file is a valid, text-based PDF.', 400);
  }

  if (!pdfText || pdfText.length < 50) {
    throw new AppError('PDF appears to be empty or image-based (scanned). Only text-based PDFs are supported.', 400);
  }

  // Truncate to ~80k chars to stay within Claude's context
  const truncated = pdfText.length > 80000 ? pdfText.slice(0, 80000) + '\n[truncated]' : pdfText;

  // Call Claude to extract structured data
  let extracted: Record<string, unknown>;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the PDF content:\n\n${truncated}\n\nExtract the structured data as instructed. Return ONLY valid JSON.`,
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    extracted = JSON.parse(cleaned);
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      throw new AppError('AI returned malformed data. Please try again or enter your info manually.', 500);
    }
    throw new AppError(`AI extraction failed: ${err.message}`, 500);
  }

  res.json({
    success: true,
    vendorType,
    data: extracted,
  });
});
