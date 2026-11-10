import { useEffect, useRef, useState } from 'react';
import { Roll, Swap } from '../ui/motion';
import { track } from '../data/track';
import { methodById, fmtTime, fmtNum } from '../data/methods';
import { effectivePlan, shiftPlan, type Skip } from '../data/recipes';
import type { Brew } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { useLayout } from '../layout';
import { Button, Screen } from '../ui/kit';
import { Icon } from '../ui/icons';
import { DripFlow } from '../ui/DripFlow';
import { LONG_TIMER, clearTimer, elapsedOf, loadTimer, onTimerChange, saveTimer } from '../data/timer';
import { toast } from '../ui/toast';
import { cancelReminder, explainRefusal, reminderStatus, remindersAvailable, scheduleReminder } from '../data/remind';

let audio: AudioContext | null = null;
function beep(freq = 880, ms = 140) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + ms / 1000 + 0.02);
  } catch { /* no sound */ }
}

type RemindState = 'off' | 'pending' | 'on' | 'fail';

export function TimerScreen({ draft: given, resume }: { draft: Brew; resume?: boolean }) {
  // a timer left running (the app was closed, or a long one in the background) picks up where it was
  const [stored] = useState(() => { const t = loadTimer(); return t && (resume || t.draft.id === given.id) ? t : null; });
  const draft = stored?.draft ?? given;
  const m = methodById(draft.methodId);
  // steps begun early move the rest of the plan up; the clock runs in real time all along
  const [skips, setSkips] = useState<Skip[]>(() => stored?.skips ?? []);
  const skipsRef = useRef(skips); skipsRef.current = skips;
  const [skipping, setSkipping] = useState(false);
  const skipAnim = useRef<ReturnType<typeof setTimeout>>(undefined);
  const basePlan = effectivePlan(draft.methodId, draft.plan);
  const plan = shiftPlan(basePlan, skips);
  const long = basePlan.total >= LONG_TIMER;
  const { replace, reset: home, setTab } = useRouter();
  const [elapsed, setElapsed] = useState(() => (stored ? elapsedOf(stored) : 0));
  const [running, setRunning] = useState(() => stored?.startedAt != null);
  const [sound, setSound] = useState(true);
  const [remind, setRemind] = useState<RemindState>(stored?.remind ? 'on' : 'off');
  const [remindNote, setRemindNote] = useState('');
  const base = useRef(stored?.base ?? 0);       // seconds accumulated before the last start
  const startedAt = useRef(stored?.startedAt ?? 0); // epoch ms of the last start
  const lastStep = useRef(stored ? plan.steps.reduce((acc, s, i) => (s.at <= elapsedOf(stored) ? i : acc), -1) : -1);
  const finished = useRef(stored ? elapsedOf(stored) >= plan.total : false);
  const closed = useRef(false);
  const live = useRef(running); // the tick may fire once more after a pause from another device

  useEffect(() => {
    if (!running) return;
    live.current = true;
    const tick = () => { if (live.current) setElapsed(base.current + (Date.now() - startedAt.current) / 1000); };
    tick();
    const t = setInterval(tick, 100);
    // the screen may have slept: catch up as soon as it is visible again
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [running]);

  const persist = (on: boolean, rem = remind) => {
    // a quick brew does not push out a long one kept in the background
    const cur = loadTimer();
    if (!long && cur && cur.draft.id !== draft.id && cur.total >= LONG_TIMER) return;
    saveTimer({ draft, base: base.current, startedAt: on ? startedAt.current : null, total: shiftPlan(basePlan, skipsRef.current).total, remind: rem === 'on' || rem === 'pending', ...(skipsRef.current.length ? { skips: skipsRef.current } : {}) });
  };

  // the bot writes when a long timer ends — the app may be closed by then
  const armReminder = async () => {
    const left = shiftPlan(basePlan, skipsRef.current).total - base.current;
    if (!long || left < 60 || !remindersAvailable()) return;
    setRemind('pending');
    const ok = await scheduleReminder(startedAt.current + left * 1000, draft.plan ? `${m.name} · ${draft.plan.name}` : m.name);
    if (closed.current) return;
    setRemind(ok ? 'on' : 'fail');
    if (loadTimer()?.draft.id === draft.id) persist(true, ok ? 'on' : 'fail');
  };
  // the reminder may have been set on another device: cancel on the server whatever this screen thinks
  const dropReminder = () => { if (long && remindersAvailable()) void cancelReminder(); setRemind('off'); };

  // opening a running long timer: ask the server what it holds; nothing there — set it again (self-repair)
  useEffect(() => {
    if (!long || !running || !remindersAvailable()) return;
    let gone = false;
    reminderStatus().then((st) => {
      if (gone || !st) return;
      const end = startedAt.current + (plan.total - base.current) * 1000;
      if (st.pending && Math.abs(st.pending.at - end) < 120_000) { setRemind('on'); return; }
      if (st.last?.state === 'failed' && Math.abs(st.last.at - end) < 120_000) { setRemind('fail'); setRemindNote(explainRefusal(st.last.detail)); return; }
      if (end - Date.now() > 60_000) void armReminder();
    });
    return () => { gone = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the same timer changed on another device (paused, resumed, reset or finished there): follow it
  useEffect(() => onTimerChange((remote) => {
    if (!remote) return;
    const t = loadTimer();
    if (t && t.draft.id === draft.id) {
      live.current = t.startedAt !== null;
      base.current = t.base;
      skipsRef.current = t.skips ?? []; setSkips(skipsRef.current);
      if (t.startedAt !== null) startedAt.current = t.startedAt;
      setRunning(t.startedAt !== null);
      setElapsed(elapsedOf(t));
      setRemind(t.remind ? 'on' : 'off');
      lastStep.current = plan.steps.reduce((acc, s, i) => (s.at <= elapsedOf(t) ? i : acc), -1);
      finished.current = elapsedOf(t) >= plan.total;
    } else if (!t && (base.current > 0 || running)) {
      // finished or reset elsewhere
      closed.current = true;
      live.current = false;
      setRunning(false);
      toast('Таймер остановлен на другом устройстве');
      setTab('brew');
    }
  }), [draft.id, running]); // eslint-disable-line react-hooks/exhaustive-deps

  // the screen stays on, closing requires confirmation (not for long timers: they live on without the app)
  useEffect(() => {
    platform.keepAwake(running && !long);
    platform.setClosingConfirmation(!long && (running || elapsed > 0));
  }, [running, elapsed > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    platform.keepAwake(false); platform.setClosingConfirmation(false);
    // leaving the screen: a short brew is abandoned, a long one keeps going (banner on the brew tab)
    if (!long && !closed.current) clearTimer(draft.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useBackGuard(elapsed > 0 && !long, 'Прервать заварку? Время не сохранится.');

  const idx = plan.steps.reduce((acc, s, i) => (s.at <= elapsed ? i : acc), -1);
  const step = idx >= 0 ? plan.steps[idx] : plan.steps[0];
  const next = plan.steps[idx + 1];
  const done = elapsed >= plan.total;

  useEffect(() => {
    if (!running) return;
    if (idx !== lastStep.current) {
      if (lastStep.current !== -1 || idx > 0) { platform.haptic('heavy'); if (sound) beep(); }
      lastStep.current = idx;
    }
    if (done && !finished.current) {
      finished.current = true;
      platform.haptic('success');
      if (sound) { beep(660, 160); setTimeout(() => beep(990, 220), 200); }
    }
  }, [idx, done, running, sound]);

  const toggle = () => {
    platform.haptic('medium');
    if (running) {
      live.current = false;
      base.current += (Date.now() - startedAt.current) / 1000; setElapsed(base.current);
      persist(false); dropReminder();
    } else {
      if (elapsed === 0) { lastStep.current = 0; if (sound) beep(); track('timer.start'); }
      startedAt.current = Date.now();
      persist(true); void armReminder();
    }
    setRunning(!running);
  };
  const reset = async () => {
    if (elapsed > 0 && !(await platform.confirm('Сбросить таймер?'))) return;
    setRunning(false); base.current = 0; skipsRef.current = []; setSkips([]); setElapsed(0); lastStep.current = -1; finished.current = false;
    dropReminder(); clearTimer(draft.id);
  };
  const finish = () => {
    if (running) base.current += (Date.now() - startedAt.current) / 1000;
    const total = running ? base.current : elapsed;
    setRunning(false);
    closed.current = true;
    dropReminder(); clearTimer(draft.id);
    platform.haptic('success'); track('brew.timer');
    replace({ name: 'brewEdit', draft: { ...draft, time: Math.round(total || plan.total), date: Date.now() }, isNew: true, openCupping: m.id === 'cupping' });
  };

  // poured faster than planned: the next step starts now and the rest of the plan moves up; the clock goes on as it was
  const skip = () => {
    const j = idx + 1, nxt = plan.steps[j];
    if (!nxt) return;
    const now = running ? base.current + (Date.now() - startedAt.current) / 1000 : elapsed;
    const by = nxt.at - now;
    if (by <= 0) return;
    platform.haptic('medium'); track('timer.skip');
    skipsRef.current = [...skipsRef.current, { i: j, by }];
    setSkips(skipsRef.current);
    // the fill runs on to the mark that lights, the marks move to their new places
    setSkipping(true); clearTimeout(skipAnim.current); skipAnim.current = setTimeout(() => setSkipping(false), 650);
    lastStep.current = j; // the step was asked for: no beep
    persist(running);
    // a long timer ends sooner now: move its reminder
    if (running && long) { dropReminder(); void armReminder(); }
  };

  // Keyboard (desktop): space — start/pause, R — reset, Enter — done
  const keys = useRef({ toggle, reset, finish, skip });
  keys.current = { toggle, reset, finish, skip };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); keys.current.toggle(); }
      else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') keys.current.reset();
      else if (e.key === 'Enter') { e.preventDefault(); keys.current.finish(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); keys.current.skip(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const layout = useLayout();

  const R = 112, C = 2 * Math.PI * R;
  const progress = Math.min(1, elapsed / plan.total);
  const target = step.to !== undefined ? draft.water * step.to : null;

  return (
    <Screen title={draft.plan ? `${m.name} · ${draft.plan.name}` : m.name} subtitle={`${m.id === 'drip' ? '' : `${fmtNum(draft.dose, 2)} г · `}${fmtNum(draft.water)} г · ${draft.temp ? fmtNum(draft.temp) + '°C' : 'холодная вода'}`}
      action={
        <button type="button" className="icon-btn text" onClick={() => setSound((s) => !s)} aria-pressed={sound}>
          {sound ? 'Звук вкл' : 'Звук выкл'}
        </button>
      }
      footer={
        <div className="footer-actions">
          <button type="button" className="round-btn" onClick={reset} aria-label="Сбросить"><Icon name="reset" /></button>
          <Button icon={running ? 'pause' : 'play'} wide onClick={toggle}>
            {running ? 'Пауза' : elapsed > 0 ? 'Продолжить' : 'Старт'}
          </Button>
          <button type="button" className={'round-btn' + (done ? ' accent' : '')} onClick={finish} aria-label="Готово, записать"><Icon name="check" /></button>
        </div>
      }>
      <div className={'timer' + (skipping ? ' skipping' : '')}>
        <svg viewBox="0 0 260 260" className="timer-ring" aria-hidden="true">
          {/* a drip: water runs down the circle while you pour, drops fall in the pauses */}
          {m.id === 'drip' && <DripFlow steps={plan.steps} total={plan.total} running={running}
            now={() => (live.current ? base.current + (Date.now() - startedAt.current) / 1000 : base.current)} />}
          <circle cx="130" cy="130" r={R} className="ring-track" />
          <circle cx="130" cy="130" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 130 130)" />
          {/* the marks turn into place (a skip moves them), so they are drawn at the top and rotated; over the fill, so its end does not hide the lit one */}
          {plan.steps.map((s, i) => (
            <circle key={i} cx="130" cy={130 - R} r="4" className={'ring-tick' + (s.at <= elapsed ? ' on' : '')} style={{ transform: `rotate(${(s.at / plan.total) * 360}deg)` }} />
          ))}
        </svg>
        <div className="timer-center">
          <div className="timer-time">{fmtTime(elapsed)}</div>
          <div className="timer-total">{done ? 'время вышло — дождитесь слива' : `из ${fmtTime(plan.total)}`}</div>
        </div>
      </div>

      {/* the card stays; what changed moves: the step number rolls, the title and hint slide in, the grams roll */}
      <div className={'step-now' + (running || elapsed > 0 ? ' live' : '')}>
        <span className="eyebrow">{elapsed === 0 ? 'Первый шаг' : done ? 'Финиш' : <>Шаг <Roll text={String(idx + 1)} /> из {plan.steps.length}</>}</span>
        <h2><Swap id={done ? 'done' : idx}>{done ? 'Готово' : step.title}</Swap></h2>
        {!done && target !== null && <div className="pour-big">до <b><Roll text={fmtNum(target, 0)} /></b> г</div>}
        {!done && step.hint && <p><Swap id={idx}>{step.hint}</Swap></p>}
        {done && <p>Нажмите ✓, чтобы записать результат и оценить чашку.</p>}
      </div>

      {next && !done && (
        <div className="step-next">
          <span>Через {fmtTime(next.at - elapsed)}</span>
          <b><Swap id={idx}>{next.title}{next.to !== undefined ? ` · до ${fmtNum(draft.water * next.to, 0)} г` : ''}</Swap></b>
        </div>
      )}
      {next && !done && elapsed > 0 && (
        <button type="button" className="step-skip" onClick={skip}>Следующий шаг<Icon name="chevron" size={16} /></button>
      )}
      {long && (
        <div className="timer-long">
          <p>Таймер идёт и без приложения — его можно закрыть, время не собьётся.</p>
          {remind === 'on' && <p className="ok">Бот пришлёт сообщение в Telegram в {new Date(startedAt.current + (plan.total - base.current) * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>}
          {remind === 'pending' && <p>Ставим напоминание…</p>}
          {remind === 'fail' && <p className="warn">{remindNote ? `Бот не смог написать: ${remindNote}.` : `Не получилось поставить напоминание в Telegram${platform.kind === 'telegram' ? ' — разрешите боту писать вам и нажмите «Пауза» и «Продолжить»' : ''}.`}</p>}
          {remind === 'off' && running && !remindersAvailable() && <p>Напоминание от бота работает в Telegram.</p>}
          {elapsed > 0 && <Button kind="secondary" onClick={() => { setTab('brew'); home(); }}>Свернуть</Button>}
        </div>
      )}
      {layout === 'desktop' && <p className="kbd-hint"><kbd>Пробел</kbd> старт / пауза · <kbd>R</kbd> сброс · <kbd>→</kbd> следующий шаг · <kbd>Enter</kbd> записать</p>}
    </Screen>
  );
}
