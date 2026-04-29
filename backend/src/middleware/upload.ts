import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// ─── Logo upload ──────────────────────────────────────────────────────────────
// square, 400×400, max 2 MB
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'festv/logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill' }],
  } as any,
});

export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// ─── Banner upload ────────────────────────────────────────────────────────────
// wide, 1200×400, max 5 MB
const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'festv/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 400, crop: 'fill' }],
  } as any,
});

export const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Package image upload ─────────────────────────────────────────────────────
// landscape, 800×600, max 5 MB
const packageImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'festv/packages',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 600, crop: 'fill' }],
  } as any,
});

export const uploadPackageImage = multer({
  storage: packageImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
