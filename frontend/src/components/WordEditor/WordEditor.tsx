import { DefaultEditor, type ContentEditableEvent } from 'react-simple-wysiwyg';
import './WordEditor.css';

type WordEditorSize = 'sm' | 'md' | 'lg';

type WordEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  size?: WordEditorSize;
};

export default function WordEditor({
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
  disabled = false,
  size = 'md',
}: WordEditorProps) {
  const handleChange = (event: ContentEditableEvent) => {
    onChange(event.target.value);
  };

  return (
    <div className="word-editor-wrap">
      <DefaultEditor
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        containerProps={{ className: `word-editor-surface word-editor-${size}` }}
      />
    </div>
  );
}
