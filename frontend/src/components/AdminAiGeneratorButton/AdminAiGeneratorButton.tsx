import { useState } from 'react';
import { Zap } from 'lucide-react';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import './AdminAiGeneratorButton.css';

export type AdminAiTarget =
  | 'PRODUCT_SHORT_DESCRIPTION'
  | 'PRODUCT_FULL_DESCRIPTION'
  | 'BLOG_EXCERPT'
  | 'BLOG_CONTENT'
  | 'POPUP_MESSAGE';

type AdminAiGeneratorButtonProps = {
  target: AdminAiTarget;
  context: Record<string, unknown>;
  onGenerated: (text: string) => void;
  disabled?: boolean;
};

export default function AdminAiGeneratorButton({
  target,
  context,
  onGenerated,
  disabled = false,
}: AdminAiGeneratorButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const { addToast } = useUIStore();

  const handleGenerate = async () => {
    if (disabled || isGenerating) return;

    setIsGenerating(true);
    try {
      const { data } = await api.post('/ai/admin/generate', { target, prompt, context });
      const generatedText = String(data?.data?.text || '').trim();

      if (!generatedText) {
        addToast('AI did not return content', 'error');
        return;
      }

      onGenerated(generatedText);
      addToast('AI content generated', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to generate AI content', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="admin-ai-generate-control">
      <input
        type="text"
        className="admin-ai-prompt-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Prompt for AI..."
        aria-label="Prompt for AI generation"
        disabled={disabled || isGenerating}
      />
      <button
        type="button"
        className="admin-ai-generate-button"
        onClick={handleGenerate}
        disabled={disabled || isGenerating}
      >
        <Zap size={13} />
        {isGenerating ? 'Generating...' : 'AI Generate'}
      </button>
    </div>
  );
}
