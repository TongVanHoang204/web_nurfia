import { translateUi } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MoreHorizontal, Trash2, X } from 'lucide-react';

type Props = { name: string; active: boolean; disabled: boolean; onStatus: () => void; onDelete: () => void };

export default function StaffActions({ name, active, disabled, onStatus, onDelete }: Props) {
  useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') setPosition(null);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    };
    const reposition = () => setPosition(null);
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [position]);
  return <>
    <button ref={trigger} className="staff-icon-button" aria-label={translateUi("More actions for {{value1}}", { value1: name })} aria-haspopup="menu" aria-expanded={Boolean(position)} disabled={disabled} onClick={() => {
      if (position) { close(); return; }
      const rect = trigger.current!.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)), top: rect.bottom + 106 > window.innerHeight ? Math.max(8, rect.top - 102) : rect.bottom + 4 });
    }}><MoreHorizontal size={18} /></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label={translateUi("Actions for {{value1}}", { value1: name })} className="staff-action-popup" style={position}>
      <button role="menuitem" onClick={() => { close(); onStatus(); }}>{active ? <X size={14} /> : <Check size={14} />}{active ? translateUi("Disable account") : translateUi("Enable account")}</button>
      <button role="menuitem" className="staff-delete-action" onClick={() => { close(); onDelete(); }}><Trash2 size={14} />{translateUi("Delete account")}</button>
    </div>, document.body)}
  </>;
}
