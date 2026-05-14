import { useCallback, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './AdminConfirmDialog.css';

type ConfirmTone = 'danger' | 'default';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function useAdminConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const close = useCallback((result: boolean) => {
    setState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      setState({
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        tone: 'default',
        ...options,
        resolve,
      });
    })
  ), []);

  const dialog = state ? (
    <div className="admin-modal-overlay admin-confirm-overlay" onClick={() => close(false)}>
      <div className="admin-modal-content admin-confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="admin-confirm-header">
          <span className={`admin-confirm-icon ${state.tone === 'danger' ? 'is-danger' : ''}`}>
            <AlertTriangle size={20} />
          </span>
          <button type="button" className="admin-modal-close" title="Close" aria-label="Close" onClick={() => close(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-confirm-body">
          <h2>{state.title}</h2>
          <p>{state.message}</p>
        </div>

        <div className="admin-confirm-actions">
          <button type="button" className="admin-btn admin-btn-outline" onClick={() => close(false)}>
            {state.cancelText}
          </button>
          <button
            type="button"
            className={`admin-btn ${state.tone === 'danger' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            onClick={() => close(true)}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
