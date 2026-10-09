// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from './ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle/ThemeToggle';
import { THEME_STORAGE_KEY } from '../utils/themePreference';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), clear: () => entries.clear() });
});
afterEach(() => { cleanup(); window.localStorage.clear(); vi.unstubAllGlobals(); });
test('switches theme, applies it to the document and restores the saved preference', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const first = render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  fireEvent.click(screen.getByLabelText('Switch to dark mode'));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  first.unmount(); render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(screen.getByLabelText('Switch to light mode')).toBeTruthy();
});
test('follows the device preference before the user chooses a theme', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe('dark');
});
