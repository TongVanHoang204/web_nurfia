import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './Select.css';

type Choice = { value: string; label: string; disabled: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? textOf(child.props.children) : String(child)).join('');
}
function choicesOf(children: ReactNode, disabled = false): Choice[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return [];
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      return [{ value: String(child.props.value ?? label), label, disabled: disabled || Boolean(child.props.disabled) }];
    }
    return choicesOf(child.props.children, disabled || Boolean(child.props.disabled));
  });
}

/** A themed, single-value select retaining native change events and form submission. */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { displayLabel?: string };
export default function Select({ children, className, style, id, onChange, displayLabel, ...props }: SelectProps) {
  const choices = choicesOf(children);
  const initialValue = String(props.defaultValue ?? choices.find(choice => !choice.disabled)?.value ?? '');
  const [localValue, setLocalValue] = useState(initialValue);
  const [error, setError] = useState('');
  const value = String(props.value ?? localValue);
  const selectedIndex = Math.max(0, choices.findIndex(choice => choice.value === value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 200, maxHeight: 320 });
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const listId = useId();

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => { setLocalValue(initialValue); setError(''); setOpen(false); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [initialValue]);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < 180 && above > below;
    const height = Math.min(320, upwards ? above : below);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: upwards ? Math.max(12, rect.top - Math.min(height, choices.length * 40 + 12) - 6) : rect.bottom + 6,
      width, maxHeight: Math.max(80, height) });
  }, [open, choices.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  const choose = (index: number) => {
    const choice = choices[index];
    if (!choice || choice.disabled || !native.current) return;
    if (native.current.value !== choice.value) {
      native.current.value = choice.value;
      native.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setOpen(false);
    trigger.current?.focus();
  };
  const show = () => { setActive(selectedIndex); search.current.text = ''; setOpen(true); };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (key === 'Tab') { setOpen(false); return; }
    if (key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (open) choose(active); else show();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      const enabled = choices.map((choice, index) => choice.disabled ? -1 : index).filter(index => index !== -1);
      const current = enabled.indexOf(active);
      const next = key === 'Home' ? 0 : key === 'End' ? enabled.length - 1 :
        Math.max(0, Math.min(enabled.length - 1, current + (key === 'ArrowDown' ? 1 : -1)));
      if (enabled[next] !== undefined) setActive(enabled[next]);
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      search.current.text = (now - search.current.time < 900 ? search.current.text : '') + key.toLocaleLowerCase();
      search.current.time = now;
      const index = choices.findIndex(choice => !choice.disabled && choice.label.toLocaleLowerCase().startsWith(search.current.text));
      if (index >= 0) { setActive(index); setOpen(true); }
    }
  };

  return <>
    <select {...props} className="ui-select-native" ref={native} aria-hidden="true" tabIndex={-1}
      aria-label={undefined} aria-labelledby={undefined} title={undefined}
      onChange={event => { setLocalValue(event.target.value); setError(''); onChange?.(event); }}
      onInvalid={event => { event.preventDefault(); setError(event.currentTarget.validationMessage); trigger.current?.focus(); props.onInvalid?.(event); }}>
      {children}
    </select>
    <button type="button" id={id} ref={trigger} className={`ui-select-trigger ${className ?? ''}`} style={style}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open ? `${listId}-option-${active}` : undefined}
      aria-label={props['aria-label'] ?? props.title} aria-labelledby={props['aria-labelledby']}
      aria-describedby={[props['aria-describedby'], error ? `${listId}-error` : ''].filter(Boolean).join(' ') || undefined}
      aria-required={props.required} aria-invalid={error ? true : props['aria-invalid']}
      disabled={props.disabled} title={props.title} onKeyDown={keyDown} onBlur={() => setOpen(false)}
      onClick={() => { if (open) setOpen(false); else show(); }}>
      <span className="ui-select-label">{displayLabel ?? choices[selectedIndex]?.label ?? ''}</span>
      <ChevronDown size={14} aria-hidden="true" className="ui-select-chevron" />
    </button>
    {error && <span id={`${listId}-error`} role="alert" className="ui-select-error">{error}</span>}
    {open && createPortal(<div id={listId} ref={popup} role="listbox" aria-label={props['aria-label'] ?? props.title}
      className="ui-select-menu" style={position} onMouseDown={event => event.preventDefault()}>
      {choices.map((choice, index) => <div key={`${choice.value}-${index}`} id={`${listId}-option-${index}`}
        role="option" aria-selected={choice.value === value} aria-disabled={choice.disabled || undefined}
        className={`ui-select-option${index === active ? ' is-active' : ''}${choice.value === value ? ' is-selected' : ''}`}
        onMouseMove={() => { if (!choice.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span>{choice.label}</span>{choice.value === value && <Check size={15} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </>;
}
