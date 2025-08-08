// src/services/websocket.ts
import http from 'http';

import jwt from 'jsonwebtoken';
import WebSocket, { Server } from 'ws';

import { createOrGetChat, endChat, getChatById, getChatUsers, saveChat } from './chatService';
import { getReadCursors, listMessages, markReadUpTo, sendMessage } from './messageService';
import { enqueue, findPartner, cancel as cancelSearch } from './searchService';

const JWT_SECRET = process.env.JWT_SECRET!;

const clients = new Map<number, WebSocket>();
const pendingSaveRequests = new Map<number, Set<number>>();
const activeChats = new Map<number, number>(); // userId -> chatId
const disconnectTimeouts = new Map<number, NodeJS.Timeout>();
const disconnectedUsers = new Map<number, { chatId: number; timeout: NodeJS.Timeout }>();
const chatMembers = new Map<number, [number, number]>();

async function handleEnd(chatId: number, notificationType: string) {
  const users = chatMembers.get(chatId) ?? (await getChatUsers(chatId));
  users.forEach((uid) => {
    const sock = clients.get(uid);
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ type: notificationType, chatId }));
    }
    activeChats.delete(uid);
  });
  const to = disconnectTimeouts.get(chatId);
  if (to) {
    clearTimeout(to);
    disconnectTimeouts.delete(chatId);
  }
  chatMembers.delete(chatId);
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

      activeChats.set(userId, chatId);

      // если по каким-то причинам chatMembers нет — восстановим из БД
      if (!chatMembers.has(chatId)) {
        const users = await getChatUsers(chatId);
        chatMembers.set(chatId, [users[0], users[1]]);
      }

      const users = chatMembers.get(chatId)!;
      const other = users.find((u) => u !== userId)!;
      const sock = clients.get(other);
      if (sock?.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: 'partner_reconnected', chatId }));
      }
    }

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
              const [u1, u2] = await getChatUsers(chat.id);
              const cursors = await getReadCursors(chat.id);

              // 1) СНАЧАЛА кладём в карты (чтоб close не пролетел мимо)
              activeChats.set(u1, chat.id);
              activeChats.set(u2, chat.id);
              chatMembers.set(chat.id, [u1, u2]);

              // 2) Потом уже шлём уведомления
              [u1, u2].forEach((uid) => {
                const c = clients.get(uid);
                if (c?.readyState === WebSocket.OPEN) {
                  c.send(JSON.stringify({ type: 'match', chat, cursors }));
                }
              });
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

          case 'history': {
            // security: убеждаемся, что юзер участник чата
            const users = await getChatUsers(chatId);
            if (!users.includes(userId)) {
              return ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }));
            }
            const { items, nextBeforeId } = await listMessages(
              chatId,
              msg.limit || 50,
              msg.beforeId,
            );
            ws.send(JSON.stringify({ type: 'history', chatId, items, nextBeforeId }));
            break;
          }

          case 'read': {
            // { chatId, messageId }
            const users = await getChatUsers(chatId);
            if (!users.includes(userId)) {
              return ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }));
            }
            const { last_read_message_id, last_read_at } = await markReadUpTo(
              chatId,
              userId,
              msg.messageId,
            );

            // уведомляем второго участника
            const other = users.find((u) => u !== userId)!;
            const sock = clients.get(other);
            if (sock?.readyState === WebSocket.OPEN) {
              sock.send(
                JSON.stringify({
                  type: 'read_receipt',
                  chatId,
                  userId,
                  messageId: last_read_message_id,
                  at: last_read_at,
                }),
              );
            }
            // по желанию можно отправить подтверждение отправителю
            ws.send(
              JSON.stringify({
                type: 'read_ack',
                chatId,
                messageId: last_read_message_id,
                at: last_read_at,
              }),
            );
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

      // 1) пытаемся взять активный chatId
      let chatId = activeChats.get(userId);
      // 2) если нет — глянем pending disconnect
      if (!chatId && disconnectedUsers.has(userId)) {
        chatId = disconnectedUsers.get(userId)!.chatId;
      }
      // 3) если всё ещё пусто — попробуем найти по chatMembers
      if (!chatId) {
        for (const [cid, pair] of chatMembers.entries()) {
          if (pair.includes(userId)) {
            chatId = cid;
            break;
          }
        }
      }
      if (!chatId) return; // ни в каком чате — уходим

      // удаляем из активных
      activeChats.delete(userId);

      // уведомляем партнёра
      const users = chatMembers.get(chatId) ?? [];
      const other = users.find((u) => u !== userId);
      if (other) {
        const sock = clients.get(other);
        if (sock?.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'partner_disconnected', chatId }));
        }
      }

      // планируем авто-удаление через 30 сек
      if (!disconnectedUsers.has(userId)) {
        const timeout = setTimeout(async () => {
          const chat = await getChatById(chatId!);
          if (chat && !chat.is_saved) {
            const pair = chatMembers.get(chatId!) ?? (await getChatUsers(chatId!));
            pair.forEach((uid) => {
              const s = clients.get(uid);
              if (s?.readyState === WebSocket.OPEN) {
                s.send(JSON.stringify({ type: 'chat_closed_timeout', chatId }));
              }
              activeChats.delete(uid);
            });
            chatMembers.delete(chatId!);
            await endChat(chatId!);
          }
          disconnectedUsers.delete(userId);
        }, 30_000);
        disconnectedUsers.set(userId, { chatId, timeout });
      }
    });
  });
}
