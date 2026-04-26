import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest, TokenPayload, AuthTokens } from '../types/index.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../utils/validators.js';
import { asyncHandler, AppError, ConflictError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler.js';
import { sendPasswordResetEmail } from '../services/verification.js';
import { seedTestAccounts, TEST_ACCOUNTS } from '../seedTestAccounts.js';
import { isDevAccess, isRealAdmin } from '../routes/adminRoutes.js';

// Generate JWT tokens
const generateTokens = (payload: TokenPayload): AuthTokens => {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  
  const refreshToken = jwt.sign(
    { ...payload, tokenId: uuidv4() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  return { accessToken, refreshToken };
};

// Register new user
export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = registerSchema.parse(req.body);
  
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(data.password, config.bcrypt.rounds);
  
  // Determine roles - users can register with both roles
  const roles = data.roles || [data.role];
  const primaryRole = data.role;
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: primaryRole,
      roles: roles,
      phoneNumber: data.phoneNumber,
      status: 'PENDING_VERIFICATION',
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
      createdAt: true,
    },
  });
  
  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  
  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt,
    },
  });
  
  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  
  res.status(201).json({
    success: true,
    data: {
      user,
      ...tokens,
    },
    message: 'Registration successful',
  });
});

// Login
export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = loginSchema.parse(req.body);
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
      avatarUrl: true,
      bannerUrl: true,
      phoneNumber: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  // Check password
  const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
  
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  // Check account status
  if (user.status === 'SUSPENDED') {
    throw new UnauthorizedError('Account suspended. Please contact support.');
  }
  
  if (user.status === 'INACTIVE') {
    throw new UnauthorizedError('Account is inactive');
  }
  
  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  
  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt,
    },
  });
  
  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  
  const { passwordHash, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    data: {
      user: userWithoutPassword,
      ...tokens,
    },
    message: 'Login successful',
  });
});

// Refresh token
export const refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = refreshTokenSchema.parse(req.body);
  
  // Verify refresh token
  let payload: TokenPayload & { tokenId: string };
  try {
    payload = jwt.verify(data.refreshToken, config.jwt.refreshSecret) as TokenPayload & { tokenId: string };
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
  
  // Check if token exists in database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: data.refreshToken },
    include: { user: true },
  });
  
  if (!storedToken) {
    throw new UnauthorizedError('Refresh token not found');
  }
  
  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new UnauthorizedError('Refresh token expired');
  }
  
  // Delete old refresh token
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });
  
  // Generate new tokens
  const tokens = generateTokens({
    id: storedToken.user.id,
    email: storedToken.user.email,
    role: storedToken.user.role,
  });
  
  // Store new refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: storedToken.user.id,
      expiresAt,
    },
  });
  
  res.json({
    success: true,
    data: tokens,
    message: 'Token refreshed successfully',
  });
});

// Logout
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
  
  // If user is authenticated, delete all their refresh tokens (logout everywhere)
  if (req.user) {
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id },
    });
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Get current user profile
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
      phoneNumber: true,
      avatarUrl: true,
      bannerUrl: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      lastLoginAt: true,
      providerProfiles: {
        select: {
          id: true,
          businessName: true,
          verificationStatus: true,
          providerTypes: true,
          primaryType: true,
          averageRating: true,
          totalReviews: true,
        },
      },
    },
  });
  
  res.json({
    success: true,
    data: user,
  });
});

// Update password
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const { currentPassword, newPassword } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true },
  });
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  
  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
  
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });
  
  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId: req.user.id },
  });
  
  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again.',
  });
});

// Add role to user (e.g., become a provider when already a client)
export const addRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const { role } = req.body;
  
  if (!['CLIENT', 'PROVIDER'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { roles: true },
  });
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  if (user.roles.includes(role)) {
    throw new ConflictError(`You already have the ${role} role`);
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      roles: {
        push: role,
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
    },
  });
  
  res.json({
    success: true,
    data: updatedUser,
    message: `${role} role added successfully`,
  });
});

// Switch active role (update primary role)
export const switchRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const { role } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { roles: true },
  });
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  if (!user.roles.includes(role)) {
    throw new AppError(`You don't have the ${role} role`, 400);
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { role },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
      providerProfiles: {
        select: {
          id: true,
          businessName: true,
          providerTypes: true,
          primaryType: true,
        },
      },
    },
  });
  
  // Generate new tokens with updated role
  const tokens = generateTokens({
    id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
  });
  
  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: updatedUser.id,
      expiresAt,
    },
  });
  
  res.json({
    success: true,
    data: {
      user: updatedUser,
      ...tokens,
    },
    message: `Switched to ${role} mode`,
  });
});

// Forgot password - generate reset token
export const forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    throw new AppError('Email is required', 400);
  }
  
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  // Always return success to prevent email enumeration
  if (!user) {
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
    return;
  }
  
  // Generate a reset token (6 digit code for simplicity)
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetToken = jwt.sign(
    { userId: user.id, code: resetCode },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  
  // Store reset token hash in user record (using passwordResetToken field)
  // For demo purposes, we'll store it temporarily
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
    },
  });
  
  // Send password reset email
  try {
    await sendPasswordResetEmail(email, resetCode, user.firstName || 'there');
  } catch (emailError) {
    console.error('Failed to send reset email:', emailError);
    // Don't expose the error to the client
  }

  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset code has been sent.',
  });
});

// Reset password with token
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { email, code, newPassword } = req.body;
  
  if (!email || !code || !newPassword) {
    throw new AppError('Email, reset code, and new password are required', 400);
  }
  
  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }
  
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
    throw new AppError('Invalid or expired reset code', 400);
  }
  
  if (user.passwordResetExpires < new Date()) {
    throw new AppError('Reset code has expired', 400);
  }
  
  // Verify the token and code
  try {
    const decoded = jwt.verify(user.passwordResetToken, config.jwt.secret) as { userId: string; code: string };
    if (decoded.code !== code) {
      throw new AppError('Invalid reset code', 400);
    }
  } catch {
    throw new AppError('Invalid or expired reset code', 400);
  }
  
  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
  
  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  
  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });
  
  res.json({
    success: true,
    message: 'Password reset successfully. Please log in with your new password.',
  });
});

// Lightweight check: does this user have access to the DEV section
// (Planner + Database admin pages)? True for ADMIN_EMAILS and any test
// account (test-*@festv.app). Used by the dropdown menu to decide whether
// to render the DEV links.
export const getDevAccessHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const email = req.user?.email || '';
    res.json({
      success: true,
      data: {
        canAccessDev: isDevAccess(email),
        isAdmin: isRealAdmin(email),
        email,
      },
    });
  }
);

// Seed test accounts (dev only). Gated by ENABLE_TEST_ACCOUNTS=true.
// Creates/refreshes the fixed set of test users and returns their credentials
// so the frontend TestAccountsPicker can autofill the login form.
export const seedTestAccountsHandler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    if (process.env.ENABLE_TEST_ACCOUNTS !== 'true') {
      // Return a 404 so the route looks non-existent when the feature is off.
      throw new NotFoundError('Route');
    }

    const results = await seedTestAccounts(prisma);

    res.json({
      success: true,
      data: {
        accounts: TEST_ACCOUNTS.map((a) => ({
          email: a.email,
          password: a.password,
          firstName: a.firstName,
          lastName: a.lastName,
          role: a.role,
          label: a.label,
          emoji: a.emoji,
        })),
        results,
      },
    });
  }
);
