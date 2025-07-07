import * as chatRepo from '../repos/chatRepo';

export const listChats = (userId: number) => chatRepo.listForUser(userId);

export const createOrGet = async (u1: number, u2: number) =>
  (await chatRepo.get(u1, u2)) ?? chatRepo.create(u1, u2);

export const getMessages = async (chatId: number, userId: number, limit = 50, offset = 0) => {
  if (!(await chatRepo.verifyParticipant(chatId, userId))) throw new Error('FORBIDDEN');
  return chatRepo.listMessages(chatId, limit, offset);
};

export const sendMessage = async (
  chatId: number,
  senderId: number,
  content: string,
  fileUrl: string | null,
) => {
  if (!(await chatRepo.verifyParticipant(chatId, senderId))) throw new Error('FORBIDDEN');
  return chatRepo.saveMessage(chatId, senderId, content || '', fileUrl ? 'image' : 'text', fileUrl);
};

export const removeMessage = async (chatId: number, msgId: number, userId: number) => {
  if (!(await chatRepo.verifyParticipant(chatId, userId))) throw new Error('FORBIDDEN');
  const ok = await chatRepo.deleteMessage(msgId, userId);
  if (!ok) throw new Error('NOT_FOUND');
};

export const editMessage = async (
  chatId: number,
  msgId: number,
  userId: number,
  content: string,
) => {
  if (!(await chatRepo.verifyParticipant(chatId, userId))) throw new Error('FORBIDDEN');
  const updated = await chatRepo.updateMessage(msgId, userId, content);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
};

/** вернуть всех userId, участвующих в чате */
export const getParticipants = (chatId: number) => chatRepo.participants(chatId);

/** отметить сообщения как прочитанные */
export const readMessages = (chatId: number, messageIds: number[], readerId: number) =>
  chatRepo.markRead(chatId, messageIds, readerId);
