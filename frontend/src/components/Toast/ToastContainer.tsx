import { translateUi } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { X } from 'lucide-react';

export default function ToastContainer() {
  useTranslation();
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{translateUi(toast.message)}</span>
          <button onClick={() => removeToast(toast.id)} style={{ marginLeft: 8, color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
