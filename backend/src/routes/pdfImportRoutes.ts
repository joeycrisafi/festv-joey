import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireProvider } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { importFromPdf } from '../controllers/pdfImportController';

const router = Router();

// In-memory storage — no files written to disk; buffer passed to pdf-parse
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

// POST /api/v1/pdf-import
// Body: multipart/form-data — file: <pdf>, vendorType: <RESTO_VENUE|CATERER|...>
router.post('/', authenticate, requireProvider, upload.single('file'), asyncHandler(importFromPdf));

export default router;
