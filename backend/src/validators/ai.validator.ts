import { z } from 'zod';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']).catch('user'),
  content: z.string().trim().min(1).max(2000),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000, 'Message is too long'),
  history: z.array(chatMessageSchema).max(12, 'Chat history is too long').optional().default([]),
});

export const aiAdminGenerateSchema = z.object({
  target: z.enum([
    'PRODUCT_SHORT_DESCRIPTION',
    'PRODUCT_FULL_DESCRIPTION',
    'BLOG_EXCERPT',
    'BLOG_CONTENT',
    'POPUP_MESSAGE',
  ]),
  prompt: z.string().trim().max(1000, 'Prompt is too long').optional().default(''),
  context: z.record(z.unknown()).optional().default({}),
});
