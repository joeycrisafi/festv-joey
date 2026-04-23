import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import providerRoutes from './providerRoutes';
import eventRequestRoutes from './eventRequestRoutes';
import quoteRoutes from './quoteRoutes';
import bookingRoutes from './bookingRoutes';
import portfolioRoutes from './portfolioRoutes';
import reviewRoutes from './reviewRoutes';
import adminRoutes from './adminRoutes';
import verificationRoutes from './verificationRoutes';
import notificationRoutes from './notificationRoutes';
import pdfImportRoutes from './pdfImportRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/providers', providerRoutes);
router.use('/event-requests', eventRequestRoutes);
router.use('/quotes', quoteRoutes);
router.use('/bookings', bookingRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', adminRoutes);
router.use('/verification', verificationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/pdf-import', pdfImportRoutes);

export default router;
