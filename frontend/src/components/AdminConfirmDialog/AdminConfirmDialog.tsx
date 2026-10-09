import { translateUi } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  useTranslation();
  const [state, setState] = useState<ConfirmState | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

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

  useEffect(() => {
    if (!state) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('.admin-btn-outline')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(false); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button') || []);
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previousFocus?.focus(); };
  }, [state, close]);

  const dialog = state ? (
    <div className="admin-modal-overlay admin-confirm-overlay" onClick={() => close(false)}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="admin-modal-content admin-confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="admin-confirm-header">
          <span className={`admin-confirm-icon ${state.tone === 'danger' ? 'is-danger' : ''}`}>
            <AlertTriangle size={20} />
          </span>
          <button type="button" className="admin-modal-close" title={translateUi("Close")} aria-label={translateUi("Close")} onClick={() => close(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-confirm-body">
          <h2 id={titleId}>{translateUi(state.title)}</h2>
          <p>{translateUi(state.message)}</p>
        </div>

        <div className="admin-confirm-actions">
          <button type="button" className="admin-btn admin-btn-outline" onClick={() => close(false)}>
            {translateUi(state.cancelText)}
          </button>
          <button
            type="button"
            className={`admin-btn ${state.tone === 'danger' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            onClick={() => close(true)}
          >
            {translateUi(state.confirmText)}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
