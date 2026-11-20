import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { chosenLocale, detectLocale, setLocale } from './i18n';
import { initPlatform, platform } from './platform';
import { noPinchZoom } from './platform/nozoom';

// a Mac keeps its own thin scrollbars that hide when not scrolling; a styled one there is a solid 10 px strip
// at the window edge that catches the mouse before the window's resize border does
try { if (/Mac/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)) document.documentElement.classList.add('mac'); } catch { /* no navigator */ }

noPinchZoom();

initPlatform().finally(async () => {
  // Telegram's language decides, unless one was picked on this device (Профиль → Вид интерфейса → Язык)
  let lang: string | undefined;
  try { lang = platform.user()?.languageCode; } catch { /* no user outside Telegram */ }
  const picked = chosenLocale();
  setLocale(picked !== 'auto' ? picked : detectLocale([lang, ...(typeof navigator !== 'undefined' ? navigator.languages ?? [] : [])]));
  // the app's modules load only now: their strings are translated as they load
  const { default: App } = await import('./App');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
