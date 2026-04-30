import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../config/database.js';

// ─── Upload logo ──────────────────────────────────────────────────────────────
// POST /upload/logo  (requireProvider + uploadLogo multer middleware applied in routes)
export async function uploadLogoHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.user!.id;
    const logoUrl = (req.file as any).path; // Cloudinary URL

    const profile = await prisma.providerProfile.findFirst({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Provider profile not found' });
    }

    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: { logoUrl },
    });

    return res.json({ success: true, data: { logoUrl } });
  } catch (err) {
    console.error('uploadLogoHandler error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload logo' });
  }
}

// ─── Upload banner ────────────────────────────────────────────────────────────
// POST /upload/banner  (requireProvider + uploadBanner multer middleware applied in routes)
export async function uploadBannerHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.user!.id;
    const bannerImageUrl = (req.file as any).path; // Cloudinary URL

    const profile = await prisma.providerProfile.findFirst({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Provider profile not found' });
    }

    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: { bannerImageUrl },
    });

    return res.json({ success: true, data: { bannerImageUrl } });
  } catch (err) {
    console.error('uploadBannerHandler error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload banner' });
  }
}

// ─── Upload package image ─────────────────────────────────────────────────────
// POST /upload/package-image  (requireProvider + uploadPackageImage middleware applied in routes)
export async function uploadPackageImageHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { packageId } = req.body as { packageId?: string };
    if (!packageId) {
      return res.status(400).json({ success: false, error: 'packageId is required' });
    }

    const userId = req.user!.id;
    const imageUrl = (req.file as any).path; // Cloudinary URL

    // Verify the package belongs to this provider
    const profile = await prisma.providerProfile.findFirst({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Provider profile not found' });
    }

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, providerProfileId: profile.id },
    });
    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    await prisma.package.update({
      where: { id: packageId },
      data: { imageUrl } as any,
    });

    return res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    console.error('uploadPackageImageHandler error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload package image' });
  }
}
