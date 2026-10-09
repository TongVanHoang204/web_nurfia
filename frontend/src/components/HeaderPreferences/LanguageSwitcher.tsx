import { useTranslation } from 'react-i18next';
import Select from '../Select/Select';
import './HeaderPreferences.css';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const vietnamese = i18n.language.startsWith('vi');
  return <Select className="language-switcher" aria-label={t('Language')} title={t('Language')}
    displayLabel={vietnamese ? 'VN' : 'EN'} value={vietnamese ? 'vi' : 'en'}
    onChange={event => { void i18n.changeLanguage(event.target.value); }}>
    <option value="en">English</option><option value="vi">Tiếng Việt</option>
  </Select>;
}
