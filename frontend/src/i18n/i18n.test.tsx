// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY, getInitialLanguage } from './index';
import LanguageSwitcher from '../components/HeaderPreferences/LanguageSwitcher';

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), clear: () => entries.clear() });
});
afterEach(async () => { cleanup(); window.localStorage.clear(); await i18n.changeLanguage('en'); vi.unstubAllGlobals(); });

function Example() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  return <><LanguageSwitcher /><h1>{t('Staff Management')}</h1><input aria-label="Name" value={name} onChange={e => setName(e.target.value)} /><span>{t('Cancel')}</span></>;
}

describe('language preferences', () => {
  it('changes visible language immediately without losing unsaved form input and persists the choice', async () => {
    await i18n.changeLanguage('en');
    render(<Example />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hoàng' } });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
    await waitFor(() => expect(screen.getByText('Quản lý nhân sự')).toBeTruthy());
    expect(screen.getByText('Hủy')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Hoàng');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('only accepts supported saved languages and uses English as the default', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'vi');
    expect(getInitialLanguage()).toBe('vi');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'unsupported');
    expect(getInitialLanguage()).toBe('en');
  });
});
