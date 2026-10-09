import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import './HeaderPreferences.css';
export default function HeaderPreferences() {
  return <div className="header-preferences"><ThemeToggle /><LanguageSwitcher /></div>;
}
