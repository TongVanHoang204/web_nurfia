import prisma from '../models/prisma.js';

const CHAT_HISTORY_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const getChatHistoryCutoff = () => new Date(Date.now() - CHAT_HISTORY_RETENTION_DAYS * DAY_MS);

export const deleteExpiredChatHistory = async () => {
  const result = await prisma.chatHistory.deleteMany({
    where: {
      updatedAt: {
        lt: getChatHistoryCutoff(),
      },
    },
  });

  return result.count;
};

export const startChatHistoryRetentionJob = () => {
  const runCleanup = () => {
    deleteExpiredChatHistory().catch((err) => {
      console.error('[ChatRetention] Failed to delete expired chat history:', err);
    });
  };

  runCleanup();
  return setInterval(runCleanup, DAY_MS);
};
