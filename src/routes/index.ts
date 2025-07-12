import { Router } from 'express';

import authRoutes from './authRoutes';
import chatRoutes from './chatRoutes';
import passwordRoutes from './passwordRoutes';
import promoRoutes from './promoRoutes';
import referralRoutes from './referralRoutes';
import userRoutes from './userRoutes';
import usersRoutes from './usersRoutes';

const router = Router();
router.use('/api/v1/user', userRoutes);
router.use('/api/v1/users', usersRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/chats', chatRoutes);
router.use('/api/v1/password', passwordRoutes);
router.use('/api/v1/promocode', promoRoutes);
router.use('/api/v1/referral', referralRoutes);

export default router;
