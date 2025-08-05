import { Router } from 'express';

import authMiddleware from '../middleware/authMiddleware';
import { createOrGetChat, endChat, saveChat, getChatsForUser } from '../services/chatService';
import { sendMessage, getMessages } from '../services/messageService';
import { findRandomChat, cancel } from '../services/searchService';

const router = Router();

// 1) Список чатов
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // eslint-disable-next-line
    // @ts-ignore
    const chats = await getChatsForUser(req.user.id);
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

// 2) Создать или получить чат с конкретным пользователем
router.post('/create_or_get', authMiddleware, async (req, res, next) => {
  try {
    const { recipient_id } = req.body;
    // eslint-disable-next-line
    // @ts-ignore
    const chat = await createOrGetChat(req.user.id, recipient_id);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// 3) Завершить и удалить чат
router.delete('/:chatId/end', authMiddleware, async (req, res, next) => {
  try {
    const chatId = Number(req.params.chatId);
    await endChat(chatId);
    res.json({ message: 'Chat ended' });
  } catch (err) {
    next(err);
  }
});

// 4) Сохранить чат (добавить в друзья)
router.patch('/:chatId/add_to_friends', authMiddleware, async (req, res, next) => {
  try {
    const chatId = Number(req.params.chatId);
    await saveChat(chatId);
    res.json({ message: 'Chat saved as friend' });
  } catch (err) {
    next(err);
  }
});

// // 5) Найти случайного собеседника
// router.post('/find_random_chat', authMiddleware, async (req, res, next) => {
//   try {
//     const filters = req.body; // { gender?, age_group?, goal }
//     const chat = await findRandomChat(req.user!.id, filters);
//     res.json(chat);
//   } catch (err) {
//     next(err);
//   }
// });
//
// // 6) Отменить поиск
// router.post('/cancel_find_partner', authMiddleware, async (req, res, next) => {
//   try {
//     // eslint-disable-next-line
//     // @ts-ignore
//     await cancel(req.user.id);
//     res.json({ message: 'Search cancelled' });
//   } catch (err) {
//     next(err);
//   }
// });

// // 7) Получить историю сообщений
// router.get('/:chatId/messages', authMiddleware, async (req, res, next) => {
//   try {
//     const chatId = Number(req.params.chatId);
//     const limit = Number(req.query.limit) || 50;
//     const offset = Number(req.query.offset) || 0;
//     const msgs = await getMessages(chatId, limit, offset);
//     res.json(msgs);
//   } catch (err) {
//     next(err);
//   }
// });
//
// // 8) Отправить сообщение
// router.post('/:chatId/send_message', authMiddleware, async (req, res, next) => {
//   try {
//     const chatId = Number(req.params.chatId);
//     const { content } = req.body;
//     // eslint-disable-next-line
//     // @ts-ignore
//     const msg = await sendMessage(chatId, req.user.id, content, 'text');
//     res.status(201).json(msg);
//   } catch (err) {
//     next(err);
//   }
// });

export default router;
