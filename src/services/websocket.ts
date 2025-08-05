// src/services/websocket.ts
import http from 'http';

import jwt from 'jsonwebtoken';
import WebSocket, { Server } from 'ws';

import { createOrGetChat, endChat, getChatUsers, saveChat } from './chatService';
import { sendMessage } from './messageService';
import { enqueue, findPartner, cancel as cancelSearch } from './searchService';

const JWT_SECRET = process.env.JWT_SECRET!;
const clients = new Map<number, WebSocket>();

export function setupWebSocket(server: http.Server) {
  const wss = new Server({ noServer: true });

  // При апгрейде HTTP→WS проверяем URL и прокидываем в wss
  server.on('upgrade', (request, socket, head) => {
    if (!request.url?.startsWith('/api/v1/ws')) {
      return socket.destroy();
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, request) => {
    // 1) Из token в query достаём userId
    const params = new URLSearchParams(request.url!.split('?')[1]);
    const token = params.get('token');
    if (!token) return ws.close();

    let payload: { userId: number };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch {
      return ws.close();
    }
    const userId = payload.userId;
    clients.set(userId, ws);

    // 2) Обрабатываем сообщения от клиента
    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        console.error('WS parse error:', err);
        return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }

      const { type, chatId, content, filters, action } = msg;

      try {
        switch (msg.type) {
          case 'find': {
            await enqueue(userId, msg.filters);
            const partner = await findPartner(userId);
            if (partner) {
              await cancelSearch(userId);
              await cancelSearch(partner.user_id);
              const chat = await createOrGetChat(userId, partner.user_id);
              const [u1, u2] = await getChatUsers(chat.id);
              for (const uid of [u1, u2]) {
                const sock = clients.get(uid);
                if (sock?.readyState === WebSocket.OPEN) {
                  sock.send(JSON.stringify({ type: 'match', chat }));
                }
              }
            }
            break;
          }

          case 'cancel': {
            await cancelSearch(userId);
            ws.send(JSON.stringify({ type: 'search_cancelled' }));
            break;
          }

          case 'message': {
            // берём участников чата и проверяем, что чат существует
            let users: [number, number];
            try {
              users = await getChatUsers(chatId);
            } catch {
              // чат не найден
              return ws.send(JSON.stringify({ type: 'error', message: 'Chat not found' }));
            }
            // сохраняем сообщение
            const message = await sendMessage(chatId, userId, content);
            // рассылаем всем участникам
            for (const uid of users) {
              const sock = clients.get(uid);
              if (sock?.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({ type: 'message', message }));
              }
            }
            break;
          }

          case 'save_and_end': {
            // 1) получаем участников, прежде чем удалить чат
            const users = await getChatUsers(chatId);

            // 2) уведомляем их, что чат сохранён и закрыт
            users.forEach((uid) => {
              const sock = clients.get(uid);
              if (sock?.readyState === WebSocket.OPEN) {
                sock.send(
                  JSON.stringify({
                    type: 'chat_saved_and_closed',
                    chatId,
                  }),
                );
              }
            });

            // 3) помечаем чат как «сохранённый»
            await saveChat(chatId);

            // 4) удаляем чат и связанные сообщения
            // await endChat(chatId);
            break;
          }

          case 'end': {
            // 1) получаем участников
            const users = await getChatUsers(chatId);

            // 2) уведомляем их, что чат закрыт без сохранения
            users.forEach((uid) => {
              const sock = clients.get(uid);
              if (sock?.readyState === WebSocket.OPEN) {
                sock.send(
                  JSON.stringify({
                    type: 'chat_closed',
                    chatId,
                  }),
                );
              }
            });

            // 3) удаляем чат и связанные сообщения
            await endChat(chatId);
            break;
          }

          case 'next': {
            // 1) получаем участников текущего чата
            const users = await getChatUsers(chatId);

            // 2) уведомляем, что текущий чат закрыт
            users.forEach((uid) => {
              const sock = clients.get(uid);
              if (sock?.readyState === WebSocket.OPEN) {
                sock.send(
                  JSON.stringify({
                    type: 'chat_closed',
                    chatId,
                  }),
                );
              }
            });

            // 3) удаляем текущий чат
            await endChat(chatId);

            // 4) запускаем поиск нового собеседника
            await enqueue(userId, filters);
            const partner = await findPartner(userId);
            if (partner) {
              await cancelSearch(userId);
              await cancelSearch(partner.user_id);
              const newChat = await createOrGetChat(userId, partner.user_id);
              // 5) уведомляем о новом матче обоих участников
              const [u1, u2] = await getChatUsers(newChat.id);
              [u1, u2].forEach((uid) => {
                const sock = clients.get(uid);
                if (sock?.readyState === WebSocket.OPEN) {
                  sock.send(
                    JSON.stringify({
                      type: 'match',
                      chat: newChat,
                    }),
                  );
                }
              });
            }
            break;
          }

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (err: any) {
        // любая ошибка внутри switch
        console.error('WS handler error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message || 'Internal error' }));
      }
    });

    // чтобы неожиданно не падало при ошибках на сокете
    ws.on('error', (err) => {
      console.error(`WS client error (user ${userId}):`, err);
    });

    ws.on('close', () => {
      clients.delete(userId);
      cancelSearch(userId);
    });

    // приветственное сообщение
    ws.send(JSON.stringify({ type: 'connected', userId }));
  });
}
