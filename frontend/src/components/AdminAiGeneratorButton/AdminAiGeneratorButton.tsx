import { useState } from 'react';
import { Info, Zap } from 'lucide-react';
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
  showPrompt?: boolean;
  promptPlaceholder?: string;
};

export default function AdminAiGeneratorButton({
  target,
  context,
  onGenerated,
  disabled = false,
  showPrompt = false,
  promptPlaceholder = 'Add direction for AI...',
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
    <div className="admin-ai-generator">
      <div className={`admin-ai-generate-control${showPrompt ? ' has-prompt' : ' no-prompt'}`}>
        {showPrompt && (
          <input
            type="text"
            className="admin-ai-prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={promptPlaceholder}
            aria-label="Prompt for AI generation"
            disabled={disabled || isGenerating}
          />
        )}
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
      <p className="admin-ai-helper">
        <Info size={12} />
        <span>
          {showPrompt
            ? 'Optional prompt refines long content. AI also uses the current form values.'
            : 'AI uses the current form values. Fill the main title first.'}
        </span>
      </p>
    </div>
  );
}
