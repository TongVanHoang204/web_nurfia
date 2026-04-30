import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';

export const aiController = {
  chat: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, history } = req.body;

      if (!message) {
        throw new AppError('Message is required', 400);
      }

      const apiKey = process.env.NVIDIA_API_KEY;
      const apiUrl = process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
      const model = process.env.NVIDIA_MODEL || 'mistralai/mistral-large-2-instruct'; 

      if (!apiKey) {
        throw new AppError('AI Service (NVIDIA) is not configured properly.', 500);
      }

      // Construct messages for NVIDIA API
      const messages = [
        {
          role: 'system',
          content: 'You are Nurfia AI, a professional and helpful shopping assistant for Nurfia eCommerce. Nurfia is a premium fashion store for women and men. Help users find products, answer questions about shipping and returns, and provide fashion advice. Keep your answers concise and professional. IMPORTANT: Always respond in English only.'
        },
        ...(history || []).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 1.0,
          stream: false
        }),
      });

      const result = await response.json() as any;

      if (!response.ok) {
        console.error('[NVIDIA AI Error]', result);
        throw new AppError(result.error?.message || 'AI service is currently unavailable.', response.status);
      }

      const aiResponse = result.choices?.[0]?.message?.content;

      res.json({
        success: true,
        data: aiResponse || "I am sorry, I cannot answer that at the moment."
      });
    } catch (err) {
      next(err);
    }
  }
};
