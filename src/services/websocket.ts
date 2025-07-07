import http from 'http';
import { parse } from 'url';

import jwt, { JwtPayload } from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';

import * as chatSvc from '../services/chatService';

/** Максимальная длина текстового сообщения */
const MAX_MESSAGE_LENGTH = 2000;

/** Хранилище всех живых соединений: userId → Set<WebSocket> */
const connections = new Map<number, Set<WebSocket>>();

/*** Валидация входящих пакетов (zod)*/
const baseSchema = z.object({ type: z.string() });
const sendMsgSchema = baseSchema.extend({
  type: z.literal('send_message'),
  chatId: z.number().int().positive(),
  content: z.string().max(MAX_MESSAGE_LENGTH),
  fileUrl: z.string().url().optional(),
});
const editMsgSchema = baseSchema.extend({
  type: z.literal('edit_message'),
  chatId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});
const readMsgSchema = baseSchema.extend({
  type: z.literal('read_message'),
  chatId: z.number().int().positive(),
  messageIds: z.array(z.number().int().positive()).min(1),
});
const typingSchema = baseSchema.extend({
  type: z.union([z.literal('typing_start'), z.literal('typing_stop')]),
  chatId: z.number().int().positive(),
});

/**
 * WebSocket setup function; вызывается из index.ts сразу после создания HTTP‑сервера
 */
export default function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  /*** Upgrade → проверяем JWT в заголовке Sec-WebSocket-Protocol*/
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/');
    if (pathname !== '/ws') return socket.destroy();

    const token = (req.headers['sec-websocket-protocol'] as string) || '';
    let userId: number;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload & {
        userId: number;
      };
      userId = decoded.userId;
    } catch {
      return socket.destroy();
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, userId);
    });
  });

  /**
   * On connection
   */
  wss.on('connection', (ws: WebSocket & { userId?: number }, userId: number) => {
    ws.userId = userId;

    // Добавляем соединение в map
    const set = connections.get(userId) ?? new Set();
    set.add(ws);
    connections.set(userId, set);

    ws.on('message', (raw) => handleMessage(ws, raw.toString()));
    ws.on('close', () => {
      const s = connections.get(userId);
      if (s) {
        s.delete(ws);
        if (s.size === 0) connections.delete(userId);
      }
    });
  });

  console.log('WebSocket server initialised');
}

/* -------------------------------------------------------------------------- */

async function handleMessage(ws: WebSocket & { userId?: number }, raw: string) {
  let parsed: unknown;
  parsed = JSON.parse(raw) as unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ error: 'Bad JSON' }));
    return;
  }

  switch ((parsed as { type?: string }).type) {
    case 'send_message': {
      const m = sendMsgSchema.safeParse(parsed);
      if (!m.success) return ws.send(JSON.stringify({ error: 'Bad payload' }));

      const { chatId, content, fileUrl } = m.data;
      const msg = await chatSvc.sendMessage(chatId, ws.userId!, content, fileUrl ?? null);
      broadcast(chatId, { event: 'new_message', data: msg });
      /* TODO: когда будет нейронка — здесь можно вызвать aiSvc.handle(msg) */
      break;
    }
    case 'edit_message': {
      const m = editMsgSchema.safeParse(parsed);
      if (!m.success) return ws.send(JSON.stringify({ error: 'Bad payload' }));

      const { chatId, messageId, content } = m.data;
      const updated = await chatSvc.editMessage(chatId, messageId, ws.userId!, content);
      broadcast(chatId, { event: 'edit_message', data: updated });
      break;
    }
    case 'read_message': {
      const m = readMsgSchema.safeParse(parsed);
      if (!m.success) return ws.send(JSON.stringify({ error: 'Bad payload' }));

      const { chatId, messageIds } = m.data;
      await chatSvc.readMessages(chatId, messageIds, ws.userId!);
      broadcast(chatId, { event: 'read_message', data: { chatId, messageIds } });
      break;
    }
    case 'typing_start':
    case 'typing_stop': {
      const m = typingSchema.safeParse(parsed);
      if (!m.success) return ws.send(JSON.stringify({ error: 'Bad payload' }));

      broadcast(m.data.chatId, {
        event: m.data.type,
        userId: ws.userId,
      });
      break;
    }
    default:
      ws.send(JSON.stringify({ error: 'Unknown type' }));
  }
}

/* -------------------------------------------------------------------------- */

/** Отправить payload всем участникам чата */
async function broadcast(chatId: number, payload: unknown) {
  const json = JSON.stringify(payload);

  // ждём массив userId
  const participants = await chatSvc.getParticipants(chatId);

  participants.forEach((uid) => {
    const sockets = connections.get(uid);
    if (!sockets) return;

    sockets.forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) sock.send(json);
    });
  });
}
