import { Router } from 'express';

import authMiddleware from '../middleware/authMiddleware';
import { sendRequest, respond, listRequests } from '../services/friendService';

const router = Router();

// 1) Отправить запрос в друзья
router.post('/request', authMiddleware, async (req, res, next) => {
  try {
    const { to_user_id } = req.body;
    // eslint-disable-next-line
    // @ts-ignore
    const fr = await sendRequest(req.user.id, to_user_id);
    res.status(201).json(fr);
  } catch (err) {
    next(err);
  }
});

// 2) Ответить на запрос (accept/reject)
router.patch('/request/:id', authMiddleware, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const { action } = req.body; // "accept" или "reject"
    await respond(requestId, action);
    res.json({ message: `Request ${action}ed` });
  } catch (err) {
    next(err);
  }
});

// 3) Список всех входящих/исходящих запросов
router.get('/requests', authMiddleware, async (req, res, next) => {
  try {
    // eslint-disable-next-line
    // @ts-ignore
    const list = await listRequests(req.user.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export default router;
