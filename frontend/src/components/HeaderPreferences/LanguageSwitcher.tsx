import { translateUi } from '../../i18n';
import { Languages, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './HeaderPreferences.css';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return <label className="language-switcher" title={t('Language')}>
    <Languages size={17} aria-hidden="true" />
    <select aria-label={t('Language')} value={i18n.language.startsWith('vi') ? 'vi' : 'en'} onChange={event => { void i18n.changeLanguage(event.target.value); }}>
      <option value="en">{translateUi("EN")}</option><option value="vi">{translateUi("VI")}</option>
    </select>
    <ChevronDown size={11} aria-hidden="true" />
  </label>;
}
