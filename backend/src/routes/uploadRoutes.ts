import { Router } from 'express';
import { authenticate, requireProvider } from '../middleware/auth.js';
import { uploadLogo, uploadBanner, uploadPackageImage } from '../middleware/upload.js';
import {
  uploadLogoHandler,
  uploadBannerHandler,
  uploadPackageImageHandler,
} from '../controllers/uploadController.js';

const router = Router();

// POST /upload/logo — replace/set the provider's logo
router.post(
  '/logo',
  authenticate,
  requireProvider,
  uploadLogo.single('image'),
  uploadLogoHandler,
);

// POST /upload/banner — replace/set the provider's banner photo
router.post(
  '/banner',
  authenticate,
  requireProvider,
  uploadBanner.single('image'),
  uploadBannerHandler,
);

// POST /upload/package-image — attach an image to a specific package (body: { packageId })
router.post(
  '/package-image',
  authenticate,
  requireProvider,
  uploadPackageImage.single('image'),
  uploadPackageImageHandler,
);

export default router;
