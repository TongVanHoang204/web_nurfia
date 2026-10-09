import { translateUi } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { BellOff } from 'lucide-react';

export function NotificationEmpty() {
  useTranslation();
  return (
    <div className="notif-empty">
      <BellOff size={36} className="notif-empty-icon" />
      <p className="notif-empty-text">{translateUi("No notifications yet")}</p>
    </div>
  );
}
