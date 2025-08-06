// src/services/websocket.ts
import http from 'http';

import jwt from 'jsonwebtoken';
import WebSocket, { Server } from 'ws';

import { createOrGetChat, endChat, getChatById, getChatUsers, saveChat } from './chatService';
import { sendMessage } from './messageService';
import { enqueue, findPartner, cancel as cancelSearch } from './searchService';

const JWT_SECRET = process.env.JWT_SECRET!;

const clients = new Map<number, WebSocket>();
const pendingSaveRequests = new Map<number, Set<number>>();
const activeChats = new Map<number, number>(); // userId -> chatId
const disconnectTimeouts = new Map<number, NodeJS.Timeout>();
const disconnectedUsers = new Map<number, { chatId: number; timeout: NodeJS.Timeout }>();

async function handleEnd(chatId: number, notificationType: string) {
  // 1) Получаем участников
  const users = await getChatUsers(chatId);
  // 2) Уведомляем
  users.forEach((uid) => {
    const sock = clients.get(uid);
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ type: notificationType, chatId }));
    }
    activeChats.delete(uid);
  });
  // 3) Сбрасываем таймаут, если был
  const to = disconnectTimeouts.get(chatId);
  if (to) {
    clearTimeout(to);
    disconnectTimeouts.delete(chatId);
  }
  // 4) Удаляем чат
  await endChat(chatId);
}

export function setupWebSocket(server: http.Server) {
  const wss = new Server({ noServer: true, perMessageDeflate: false });

  // 1) HTTP → WS upgrade с аутентификацией
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/api/v1/ws')) {
      return socket.destroy();
    }

    const params = new URLSearchParams(req.url!.split('?')[1]);
    const token = params.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }

    // ВАЖНО: проверяем токен ПЕРЕД handleUpgrade
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number; type: string };
      // Только если валидно — апгрейдим!
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (payload.type !== 'ws') {
          return ws.close();
        }
        (ws as any).userId = payload.userId;
        (ws as any).token = token;
        clients.set(payload.userId, ws);
        wss.emit('connection', ws, req);
      });
    } catch (err: any) {
      // Ошибка токена — НЕ апгрейдим, просто отвечаем по HTTP и закрываем
      const reason = err.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token';
      const body = JSON.stringify({ type: 'auth_error', reason });
      socket.write(
        'HTTP/1.1 401 Unauthorized\r\n' +
          'Content-Type: application/json\r\n' +
          'Connection: close\r\n' +
          '\r\n' +
          body,
      );
      socket.destroy();
    }
  });

  // 2) При установке WS‐соединения
  wss.on('connection', async (ws, req) => {
    const userId = (ws as any).userId as number;
    clients.set(userId, ws);

    if (disconnectedUsers.has(userId)) {
      const { chatId, timeout } = disconnectedUsers.get(userId)!;
      clearTimeout(timeout);
      disconnectedUsers.delete(userId);
      // возвращаем пользователя в activeChats
      activeChats.set(userId, chatId);
      // уведомляем партнёра о возвращении
      const users = await getChatUsers(chatId);
      const other = users.find((u) => u !== userId)!;
      const sock = clients.get(other);
      if (sock?.readyState === WebSocket.OPEN) {
        sock.send(
          JSON.stringify({
            type: 'partner_reconnected',
            chatId,
          }),
        );
      }
    }

    // подтверждаем
    ws.send(JSON.stringify({ type: 'connected', userId }));

    ws.on('message', async (raw) => {
      // аутентификация на каждое сообщение:
      try {
        jwt.verify((ws as any).token, JWT_SECRET);
      } catch (err: any) {
        const reason = err.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token';
        ws.send(JSON.stringify({ type: 'auth_error', reason }));
        return ws.close();
      }

      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }

      const { type, chatId, content, filters, action } = msg;

      try {
        switch (type) {
          case 'find': {
            await enqueue(userId, filters);
            const partner = await findPartner(userId);
            if (partner) {
              await cancelSearch(userId);
              await cancelSearch(partner.user_id);
              const chat = await createOrGetChat(userId, partner.user_id);

              // уведомляем обоих
              const [u1, u2] = await getChatUsers(chat.id);
              [u1, u2].forEach((uid) => {
                const c = clients.get(uid);
                if (c?.readyState === WebSocket.OPEN) {
                  c.send(JSON.stringify({ type: 'match', chat }));
                }
              });

              // **Сразу помечаем их как «в чате»**
              activeChats.set(u1, chat.id);
              activeChats.set(u2, chat.id);
            }
            break;
          }

          case 'cancel': {
            await cancelSearch(userId);
            ws.send(JSON.stringify({ type: 'search_cancelled' }));
            break;
          }

          case 'message': {
            // подписка для любого чата — одно соединение, фильтрация на клиенте
            const users = await getChatUsers(chatId);
            const message = await sendMessage(chatId, userId, content);
            // посылаем каждому
            users.forEach((uid) => {
              const c = clients.get(uid);
              if (c?.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({ type: 'new_message', chatId, message }));
              }
            });
            break;
          }

          // Инициировать процедуру «сохранить чат»
          case 'save_request': {
            // chatId обязательный
            const users = await getChatUsers(chatId);
            // добавляем, что этот userId согласился
            let set = pendingSaveRequests.get(chatId);
            if (!set) {
              set = new Set();
              pendingSaveRequests.set(chatId, set);
            }
            set.add(userId);
            // уведомляем второго
            const other = users.find((u) => u !== userId)!;
            const sock = clients.get(other);
            if (sock?.readyState === WebSocket.OPEN) {
              sock.send(
                JSON.stringify({
                  type: 'save_requested',
                  chatId,
                  from: userId,
                }),
              );
            }
            break;
          }

          // Ответ на запрос сохранения: action = 'accept' | 'reject'
          case 'save_response': {
            const users = await getChatUsers(chatId);
            const set = pendingSaveRequests.get(chatId) || new Set();
            if (action === 'accept') {
              set.add(userId);
              // если оба согласились — сохраняем чат
              if (users.every((u) => set.has(u))) {
                await saveChat(chatId);
                // уведомляем обоих
                users.forEach((uid) => {
                  const sock = clients.get(uid);
                  if (sock?.readyState === WebSocket.OPEN) {
                    sock.send(
                      JSON.stringify({
                        type: 'chat_saved',
                        chatId,
                      }),
                    );
                  }
                });
                // очищаем промежуточное состояние
                pendingSaveRequests.delete(chatId);
              }
            } else {
              // если отказ — уведомляем инициатора и сбрасываем
              const initiators = Array.from(set);
              initiators.forEach((initId) => {
                const sock = clients.get(initId);
                if (sock?.readyState === WebSocket.OPEN) {
                  sock.send(
                    JSON.stringify({
                      type: 'save_declined',
                      chatId,
                      by: userId,
                    }),
                  );
                }
              });
              pendingSaveRequests.delete(chatId);
            }
            break;
          }

          case 'end': {
            await handleEnd(chatId, 'chat_closed');
            break;
          }

          case 'next': {
            await handleEnd(chatId, 'chat_closed');

            await enqueue(userId, filters);
            const partner2 = await findPartner(userId);
            if (partner2) {
              await cancelSearch(userId);
              await cancelSearch(partner2.user_id);
              const newChat = await createOrGetChat(userId, partner2.user_id);
              const [a, b] = await getChatUsers(newChat.id);
              [a, b].forEach((uid) => {
                const c = clients.get(uid);
                if (c?.readyState === WebSocket.OPEN) {
                  c.send(JSON.stringify({ type: 'match', chat: newChat }));
                }
              });
            }
            break;
          }

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
        }
      } catch (err: any) {
        console.error('WS handler error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      cancelSearch(userId);

      const chatId = activeChats.get(userId);
      if (chatId) {
        // 1) удаляем из активных
        activeChats.delete(userId);

        // 2) уведомляем партнёра о дисконнекте
        getChatUsers(chatId).then((users) => {
          const other = users.find((u) => u !== userId)!;
          const sock = clients.get(other);
          if (sock?.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({ type: 'partner_disconnected', chatId }));
          }
        });

        // 3) планируем авто‐удаление через 30 сек, запоминаем этот таймаут
        if (!disconnectedUsers.has(userId)) {
          const timeout = setTimeout(async () => {
            // удаляем чат, если эфемерный
            const chat = await getChatById(chatId);
            if (chat && !chat.is_saved) {
              const users = await getChatUsers(chatId);
              users.forEach((uid) => {
                const s = clients.get(uid);
                if (s?.readyState === WebSocket.OPEN) {
                  s.send(
                    JSON.stringify({
                      type: 'chat_closed_timeout',
                      chatId,
                    }),
                  );
                }
              });
              await endChat(chatId);
            }
            disconnectedUsers.delete(userId);
          }, 30_000);
          disconnectedUsers.set(userId, { chatId, timeout });
        }
      }
    });
  });
}
