import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getOrCreateConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  deleteMessage,
  searchMessages,
  archiveConversation,
  getConversationByEventRequest,
} from '../controllers/messageController.js';

const router = Router();

// All message routes require authentication (both CLIENT and PROVIDER)
router.use(authenticate);

// Conversations
router.get('/conversations', getMyConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/by-provider/:providerId', getConversationByEventRequest);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.post('/conversations/:conversationId/read', markMessagesAsRead);
router.patch('/conversations/:conversationId/archive', archiveConversation);
router.get('/conversations/:conversationId/search', searchMessages);

// Messages
router.delete('/messages/:messageId', deleteMessage);

// Unread count
router.get('/unread-count', getUnreadCount);

export default router;
