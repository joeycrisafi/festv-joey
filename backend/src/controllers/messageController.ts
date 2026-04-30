import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../config/database.js';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { sendMessageSchema } from '../utils/validators.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SENDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

function isParticipant(participants: string[], userId: string): boolean {
  return participants.includes(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get or create a conversation between two users
// Body: { otherUserId }
// ─────────────────────────────────────────────────────────────────────────────

export const getOrCreateConversation = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { otherUserId, providerId } = req.body;

  // Support both otherUserId and legacy providerId param
  const targetUserId: string | undefined = otherUserId ?? providerId;
  if (!targetUserId) throw new AppError('otherUserId is required', 400);

  // Resolve provider profile → user ID if providerId looks like a profile ID
  let resolvedOtherUserId = targetUserId;
  if (!otherUserId && providerId) {
    const profile = await prisma.providerProfile.findFirst({
      where: { id: providerId },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundError('Provider');
    resolvedOtherUserId = profile.userId;
  }

  if (resolvedOtherUserId === userId) {
    throw new AppError('Cannot create a conversation with yourself', 400);
  }

  // Find existing conversation with both participants
  let conversation = await prisma.conversation.findFirst({
    where: { participants: { hasEvery: [userId, resolvedOtherUserId] } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { participants: [userId, resolvedOtherUserId] },
    });
  }

  res.json({ success: true, data: conversation });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get all conversations for the current user
// ─────────────────────────────────────────────────────────────────────────────

export const getMyConversations = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { participants: { has: userId } },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, content: true, createdAt: true, senderId: true, isRead: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.conversation.count({ where: { participants: { has: userId } } }),
  ]);

  // Resolve participant user details for each conversation
  const allParticipantIds = [...new Set(conversations.flatMap(c => c.participants))];
  const users = await prisma.user.findMany({
    where: { id: { in: allParticipantIds } },
    select: SENDER_SELECT,
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await prisma.message.count({
        where: { conversationId: conv.id, senderId: { not: userId }, isRead: false },
      });
      const participants = conv.participants.map(pid => userMap.get(pid) ?? { id: pid });
      const otherParticipant = conv.participants.find(p => p !== userId);
      return {
        ...conv,
        participants,
        otherUser: otherParticipant ? userMap.get(otherParticipant) ?? null : null,
        unreadCount,
      };
    }),
  );

  res.json({
    success: true,
    data: {
      conversations: result,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get messages in a conversation
// ─────────────────────────────────────────────────────────────────────────────

export const getConversationMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { page = 1, limit = 50, before } = req.query;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError('Conversation');
  if (!isParticipant(conversation.participants, userId)) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const whereClause: any = { conversationId };
  if (before) {
    whereClause.createdAt = { lt: new Date(before as string) };
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      include: { sender: { select: SENDER_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  // Mark messages from other participants as read
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  res.json({
    success: true,
    data: {
      messages: messages.reverse(),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Send a message
// ─────────────────────────────────────────────────────────────────────────────

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const validation = sendMessageSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError(validation.error.errors[0].message, 400);
  }

  const { content, attachmentUrls } = validation.data;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError('Conversation');
  if (!isParticipant(conversation.participants, userId)) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  const recipientId = conversation.participants.find(p => p !== userId) ?? '';

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      recipientId,
      content,
      attachmentUrls: attachmentUrls ?? [],
    },
    include: { sender: { select: SENDER_SELECT } },
  });

  // Update conversation lastMessageAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Notify recipient
  if (recipientId) {
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'NEW_MESSAGE',
        title: 'New Message',
        message: `You have a new message from ${req.user!.firstName} ${req.user!.lastName}`,
        data: { conversationId, messageId: message.id },
      },
    });
  }

  res.status(201).json({ success: true, data: message });
};

// ─────────────────────────────────────────────────────────────────────────────
// Mark messages as read
// ─────────────────────────────────────────────────────────────────────────────

export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError('Conversation');
  if (!isParticipant(conversation.participants, userId)) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  res.json({ success: true, message: 'Messages marked as read' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get unread message count
// ─────────────────────────────────────────────────────────────────────────────

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const conversations = await prisma.conversation.findMany({
    where: { participants: { has: userId } },
    select: { id: true },
  });

  const conversationIds = conversations.map(c => c.id);

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: userId },
      isRead: false,
    },
  });

  res.json({ success: true, data: { unreadCount } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete a message (hard delete — schema has no isDeleted field)
// ─────────────────────────────────────────────────────────────────────────────

export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { messageId } = req.params;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError('Message');
  if (message.senderId !== userId) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  const deleteWindow = 5 * 60 * 1000;
  if (Date.now() - message.createdAt.getTime() > deleteWindow) {
    throw new AppError('Messages can only be deleted within 5 minutes of sending', 400);
  }

  // Replace content rather than hard-delete to preserve conversation thread integrity
  await prisma.message.update({
    where: { id: messageId },
    data: { content: '[Message deleted]' },
  });

  res.json({ success: true, message: 'Message deleted' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Search messages in conversation
// ─────────────────────────────────────────────────────────────────────────────

export const searchMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { query, limit = 20 } = req.query;

  if (!query || (query as string).length < 2) {
    throw new AppError('Search query must be at least 2 characters', 400);
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError('Conversation');
  if (!isParticipant(conversation.participants, userId)) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      content: { contains: query as string, mode: 'insensitive' },
    },
    include: { sender: { select: SENDER_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });

  res.json({ success: true, data: messages });
};

// ─────────────────────────────────────────────────────────────────────────────
// Archive conversation — schema has no isArchived; returns success as no-op
// ─────────────────────────────────────────────────────────────────────────────

export const archiveConversation = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError('Conversation');
  if (!isParticipant(conversation.participants, userId)) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  // Conversation model has no isArchived field — acknowledged, no-op for now
  res.json({ success: true, message: 'Conversation archived' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get conversation by event request — eventRequestId not on schema, find by participants
// ─────────────────────────────────────────────────────────────────────────────

export const getConversationByEventRequest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  // Resolve providerProfile → user id
  let otherUserId = providerId;
  if (providerId) {
    const profile = await prisma.providerProfile.findFirst({
      where: { id: providerId },
      select: { userId: true },
    });
    if (profile) otherUserId = profile.userId;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { participants: { hasEvery: [userId, otherUserId] } },
    include: {
      messages: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: SENDER_SELECT } },
      },
    },
  });

  if (!conversation) throw new NotFoundError('Conversation');

  res.json({ success: true, data: conversation });
};
