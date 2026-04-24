import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { sendMessageSchema } from '../utils/validators';

// Get or create a conversation between client and provider
export const getOrCreateConversation = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId, eventRequestId } = req.body;

  if (!providerId) {
    throw new AppError('Provider ID is required', 400);
  }

  // Check if provider exists
  const provider = await prisma.providerProfile.findFirst({
    where: { id: providerId },
    include: { user: true }
  });

  if (!provider) {
    throw new NotFoundError('Provider');
  }

  // Get client user
  const client = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!client || client.role !== 'CLIENT') {
    throw new ForbiddenError('Only clients can initiate conversations');
  }

  // Check for existing conversation
  let conversation = await prisma.conversation.findFirst({
    where: {
      clientId: userId,
      providerId: provider.userId,
      eventRequestId: eventRequestId || null
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      provider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      eventRequest: {
        select: {
          id: true,
          eventType: true,
          eventDate: true
        }
      }
    }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        clientId: userId,
        providerId: provider.userId,
        eventRequestId: eventRequestId || null
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        eventRequest: {
          select: {
            id: true,
            eventType: true,
            eventDate: true
          }
        }
      }
    });
  }

  res.json({
    success: true,
    data: conversation
  });
};

// Get all conversations for current user
export const getMyConversations = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    OR: [
      { clientId: userId },
      { providerId: userId }
    ]
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        eventRequest: {
          select: {
            id: true,
            eventType: true,
            eventDate: true,
            status: true
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            isRead: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.conversation.count({ where })
  ]);

  // Get unread counts for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          isRead: false
        }
      });
      return { ...conv, unreadCount };
    })
  );

  res.json({
    success: true,
    data: {
      conversations: conversationsWithUnread,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
};

// Get messages in a conversation
export const getConversationMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { page = 1, limit = 50, before } = req.query;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Verify user is part of conversation
  if (conversation.clientId !== userId && conversation.providerId !== userId) {
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
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.message.count({ where: { conversationId } })
  ]);

  // Mark messages as read
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false
    },
    data: { isRead: true }
  });

  res.json({
    success: true,
    data: {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
};

// Send a message
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const validation = sendMessageSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError(validation.error.errors[0].message, 400);
  }

  const { content, attachments } = validation.data;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      client: true,
      provider: true
    }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Verify user is part of conversation
  if (conversation.clientId !== userId && conversation.providerId !== userId) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content,
      attachments: attachments || []
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    }
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  // Create notification for recipient
  const recipientId = conversation.clientId === userId 
    ? conversation.providerId 
    : conversation.clientId;

  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: 'NEW_MESSAGE',
      title: 'New Message',
      message: `You have a new message from ${req.user!.firstName}`,
      data: { conversationId, messageId: message.id }
    }
  });

  // TODO: Emit socket event for real-time delivery
  // io.to(recipientId).emit('new_message', message);

  res.status(201).json({
    success: true,
    data: message
  });
};

// Mark messages as read
export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (conversation.clientId !== userId && conversation.providerId !== userId) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false
    },
    data: { isRead: true }
  });

  res.json({
    success: true,
    message: 'Messages marked as read'
  });
};

// Get unread message count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // Get all conversations user is part of
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { clientId: userId },
        { providerId: userId }
      ]
    },
    select: { id: true }
  });

  const conversationIds = conversations.map(c => c.id);

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: userId },
      isRead: false
    }
  });

  res.json({
    success: true,
    data: { unreadCount }
  });
};

// Delete a message (soft delete - only hide for sender)
export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { messageId } = req.params;

  const message = await prisma.message.findUnique({
    where: { id: messageId }
  });

  if (!message) {
    throw new NotFoundError('Message');
  }

  if (message.senderId !== userId) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  // Check if within delete window (e.g., 5 minutes)
  const deleteWindow = 5 * 60 * 1000;
  if (Date.now() - message.createdAt.getTime() > deleteWindow) {
    throw new AppError('Messages can only be deleted within 5 minutes of sending', 400);
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { 
      content: '[Message deleted]',
      isDeleted: true 
    }
  });

  res.json({
    success: true,
    message: 'Message deleted'
  });
};

// Search messages in conversation
export const searchMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { query, limit = 20 } = req.query;

  if (!query || (query as string).length < 2) {
    throw new AppError('Search query must be at least 2 characters', 400);
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (conversation.clientId !== userId && conversation.providerId !== userId) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      content: {
        contains: query as string,
        mode: 'insensitive'
      },
      isDeleted: false
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit)
  });

  res.json({
    success: true,
    data: messages
  });
};

// Archive a conversation
export const archiveConversation = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (conversation.clientId !== userId && conversation.providerId !== userId) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isArchived: true }
  });

  res.json({
    success: true,
    message: 'Conversation archived'
  });
};

// Get conversation by event request
export const getConversationByEventRequest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { eventRequestId, providerId } = req.params;

  const conversation = await prisma.conversation.findFirst({
    where: {
      eventRequestId,
      OR: [
        { clientId: userId },
        { providerId: userId }
      ],
      ...(providerId && { providerId })
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      provider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      eventRequest: {
        select: {
          id: true,
          eventType: true,
          eventDate: true
        }
      },
      messages: {
        take: 20,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  res.json({
    success: true,
    data: conversation
  });
};
