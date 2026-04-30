import { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import { AppError } from '../middlewares/errorHandler.js';

export const aiController = {
  chat: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, history } = req.body;

      if (!message) {
        throw new AppError('Message is required', 400);
      }

      const apiKey = process.env.HUGGINGFACE_API_KEY;
      const model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

      if (!apiKey) {
        throw new AppError('AI Service is not configured properly.', 500);
      }

      // System prompt to set identity
      const systemPrompt = `You are Nurfia AI, a professional and helpful shopping assistant for Nurfia eCommerce. 
      Nurfia is a premium fashion store for women and men. 
      Help users find products, answer questions about shipping and returns, and provide fashion advice. 
      Keep your answers concise and professional.
      IMPORTANT: Always respond in English only.`;

      let result: any;
      let retries = 3;
      let waitTime = 5000; // 5 seconds

      while (retries > 0) {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `<s>[INST] ${systemPrompt} \n\n User history: ${JSON.stringify(history || [])} \n\n User message: ${message} [/INST]`,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.7,
              return_full_text: false,
            }
          }),
        });

        result = await response.json();

        if (response.ok) {
          break;
        }

        // Check if model is loading (Common in HF Free Tier)
        if (response.status === 503 && result.error?.includes('loading')) {
          console.log(`[AI] Model is loading, retrying in ${waitTime/1000}s... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
          continue;
        }

        console.error('[AI Error]', result);
        throw new AppError(result.error || 'AI service is currently unavailable.', response.status);
      }

      // HF returns an array with generated_text
      const aiResponse = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;

      res.json({
        success: true,
        data: aiResponse || "I am sorry, I cannot answer that at the moment."
      });
    } catch (err) {
      next(err);
    }
  }
};
