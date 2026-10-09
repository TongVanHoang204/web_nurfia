import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/themes.css';
import './i18n';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><SiteSettingsProvider>
      <App />
    </SiteSettingsProvider></ThemeProvider>
  </StrictMode>,
);
