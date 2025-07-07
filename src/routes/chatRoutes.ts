import path from 'path';

import { Router } from 'express';
import multer from 'multer';

import { catchAsync } from '../helpers/catchAsync';
import authMiddleware from '../middleware/authMiddleware';
import * as chatSvc from '../services/chatService';

const router = Router();

/* uploads */
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) =>
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`,
    ),
});
const upload = multer({ storage });

router.get(
  '/',
  authMiddleware,
  catchAsync(async (req, res) => {
    res.json(await chatSvc.listChats(req.userId!));
  }),
);

router.post(
  '/create_or_get',
  authMiddleware,
  catchAsync(async (req, res) => {
    const { recipient_id } = req.body;

    if (!recipient_id || recipient_id === req.userId) {
      res.status(400).json({ error: 'Bad recipient_id' });
      return;
    }

    const chat = await chatSvc.createOrGet(req.userId!, Number(recipient_id));

    res.json(chat);
  }),
);

router.get(
  '/:chatId/messages',
  authMiddleware,
  catchAsync(async (req, res) => {
    const { chatId } = req.params;
    const { limit = '50', offset = '0' } = req.query as Record<string, string>;
    res.json(await chatSvc.getMessages(Number(chatId), req.userId!, Number(limit), Number(offset)));
  }),
);

router.post(
  '/:chatId/send_message',
  authMiddleware,
  upload.single('file'),
  catchAsync(async (req, res) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const msg = await chatSvc.sendMessage(Number(chatId), req.userId!, content, fileUrl);
    res.status(201).json(msg);
  }),
);

router.delete(
  '/:chatId/messages/:msgId',
  authMiddleware,
  catchAsync(async (req, res) => {
    await chatSvc.removeMessage(Number(req.params.chatId), Number(req.params.msgId), req.userId!);
    res.status(200).json({ ok: true });
  }),
);

router.patch(
  '/:chatId/messages/:msgId',
  authMiddleware,
  catchAsync(async (req, res) => {
    const updated = await chatSvc.editMessage(
      Number(req.params.chatId),
      Number(req.params.msgId),
      req.userId!,
      req.body.content,
    );
    res.json(updated);
  }),
);

export default router;
