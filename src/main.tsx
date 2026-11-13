import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { detectLocale, setLocale } from './i18n';
import { initPlatform, platform } from './platform';

// a Mac keeps its own thin scrollbars that hide when not scrolling; a styled one there is a solid 10 px strip
// at the window edge that catches the mouse before the window's resize border does
try { if (/Mac/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)) document.documentElement.classList.add('mac'); } catch { /* no navigator */ }

initPlatform().finally(() => {
  // Only locales in ENABLED_LOCALES are picked; today that is Russian only
  let lang: string | undefined;
  try { lang = platform.user()?.languageCode; } catch { /* no user outside Telegram */ }
  setLocale(detectLocale([lang, ...(typeof navigator !== 'undefined' ? navigator.languages ?? [] : [])]));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
