/**
 * «Фосфор»: the Konami code on the profile tab, and the old computer starting up once it is typed.
 *
 * usePhosphor (in the app shell) keeps the style in step with the profile card and listens for the code;
 * PhosphorBoot is the start-up: the tube lights up from a line, the BIOS lists the person's own setup,
 * BREWBOOK.EXE loads and the app is there in green. Any key or tap skips it.
 */
import { useEffect, useRef, useState } from 'react';
import { getAppearance, setAppearance } from '../appearance';
import { bootLines, konamiStep, KONAMI_LENGTH, PHOSPHOR, phosphorOn } from '../data/phosphor';
import { beanStock, isFinished } from '../data/stock';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { announce, toast } from './toast';
import { tr } from '../i18n';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** the style follows the card; the code, typed on the profile tab, opens the card and starts the computer */
export function usePhosphor(onProfile: boolean) {
  const { profile, saveProfile, ready } = useStore();
  const [boot, setBoot] = useState(false);
  const latest = useRef(profile);
  latest.current = profile;

  const on = phosphorOn(profile);
  useEffect(() => {
    // until the data is read the profile is empty: keep the style saved on this device, no green-to-plain flash
    if (!ready) return;
    const a = getAppearance();
    if ((a.style === PHOSPHOR) !== on) setAppearance({ ...a, style: on ? PHOSPHOR : undefined });
  }, [on, ready]);

  useEffect(() => {
    if (!onProfile) return;
    let at = 0;
    const key = (e: KeyboardEvent) => {
      // arrows in a text field move the caret, they are not the code
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) { at = 0; return; }
      at = konamiStep(at, e.code);
      if (at < KONAMI_LENGTH) return;
      at = 0;
      const p = latest.current;
      saveProfile({ ...p, secrets: [...new Set([...(p.secrets ?? []), PHOSPHOR])], cardTheme: PHOSPHOR });
      platform.haptic('success');
      setBoot(true);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onProfile, saveProfile]);

  return { boot, endBoot: () => setBoot(false) };
}

export function PhosphorBoot({ onDone }: { onDone: () => void }) {
  const { gear, beans, brews } = useStore();
  const [lines] = useState(() => {
    const open = beans.filter((b) => !b.sample && !isFinished(b, beanStock(b, brews)));
    return bootLines({
      version: import.meta.env.VITE_APP_VERSION || '1.7',
      grinder: gear.find((g) => g.cat === 'grinder')?.name,
      brewer: gear.find((g) => g.cat === 'dripper')?.name,
      packs: open.length,
      grams: Math.round(open.reduce((s, b) => s + beanStock(b, brews).left, 0)),
      brews: brews.length,
    });
  });
  const calm = reduced();
  // 0 — the tube lights up; 1…n — lines appear; n+1 — loading bar; n+2 — the prompt; then fade out
  const [step, setStep] = useState(calm ? lines.length + 2 : 0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(() => {
      onDone();
      toast(tr('Открыт стиль «Фосфор». Вернуть обычный вид: Профиль → Настроить → Фон'));
    }, calm ? 200 : 450);
  };

  useEffect(() => {
    announce(tr('Запускается терминал Brewbook'));
    if (calm) { const t = setTimeout(finish, 1600); return () => clearTimeout(t); }
    const delays = [650, ...lines.map((_, i) => (i === 0 ? 420 : 260)), 900, 900];
    let i = 0, t = 0;
    const next = () => {
      i += 1;
      if (i > lines.length + 2) { finish(); return; }
      setStep(i);
      t = window.setTimeout(next, delays[i] ?? 300);
    };
    t = window.setTimeout(next, delays[0]);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const skip = () => finish();
    addEventListener('keydown', skip);
    addEventListener('pointerdown', skip);
    return () => { removeEventListener('keydown', skip); removeEventListener('pointerdown', skip); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'phos-boot' + (calm ? ' calm' : '') + (leaving ? ' leaving' : '')} aria-hidden="true">
      <div className="phos-tube">
        <div className="phos-text">
          {lines.slice(0, Math.max(0, step)).map(([k, v], i) => (
            <div key={i} className={i === 0 ? 'phos-title' : 'phos-line'}>
              {i === 0 ? <><b>{k}</b><span>{v}</span></> : <><span>{k}</span><i /><b>{v}</b></>}
            </div>
          ))}
          {step > lines.length && <div className="phos-bar"><span /></div>}
          {step > lines.length + 1 && <div className="phos-prompt">C:\BREWBOOK&gt; <span className="phos-cursor">█</span></div>}
        </div>
        <div className="phos-hint">{tr('любая клавиша — пропустить')}</div>
      </div>
    </div>
  );
}
