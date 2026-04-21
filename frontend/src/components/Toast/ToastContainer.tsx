import { useUIStore } from '../../stores/uiStore';
import { X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} style={{ marginLeft: 8, color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
