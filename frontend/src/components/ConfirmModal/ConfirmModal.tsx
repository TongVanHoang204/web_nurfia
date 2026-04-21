import { useUIStore } from '../../stores/uiStore';
import './ConfirmModal.css';

export default function ConfirmModal() {
  const { confirmModal, closeConfirm } = useUIStore();

  if (!confirmModal) return null;

  const handleConfirm = () => {
    confirmModal.onConfirm();
    closeConfirm();
  };

  return (
    <div className="confirm-modal-overlay" onClick={closeConfirm}>
      <div 
        className="confirm-modal-content" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="confirm-modal-header">
          <h3 className="confirm-modal-title">
            {confirmModal.title || 'Are you sure?'}
          </h3>
        </div>
        <div className="confirm-modal-body">
          <p>{confirmModal.message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button 
            className="confirm-btn confirm-btn-cancel" 
            onClick={closeConfirm}
          >
            {confirmModal.cancelText || 'Cancel'}
          </button>
          <button 
            className={`confirm-btn ${confirmModal.danger ? 'confirm-btn-danger' : 'confirm-btn-primary'}`} 
            onClick={handleConfirm}
          >
            {confirmModal.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}