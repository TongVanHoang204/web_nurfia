import { BellOff } from 'lucide-react';

export function NotificationEmpty() {
  return (
    <div className="notif-empty">
      <BellOff size={36} className="notif-empty-icon" />
      <p className="notif-empty-text">No notifications yet</p>
    </div>
  );
}
