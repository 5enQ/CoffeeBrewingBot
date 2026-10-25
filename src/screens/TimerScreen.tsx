import { useEffect, useRef, useState } from 'react';
import { methodById, fmtTime, fmtNum } from '../data/methods';
import { effectivePlan } from '../data/recipes';
import type { Brew } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { useLayout } from '../layout';
import { Button, Screen } from '../ui/kit';
import { Icon } from '../ui/icons';

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
  } catch { /* без звука */ }
}

export function TimerScreen({ draft }: { draft: Brew }) {
  const m = methodById(draft.methodId);
  const plan = effectivePlan(draft.methodId, draft.plan);
  const { replace } = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const base = useRef(0);       // накопленное время до последнего старта
  const startedAt = useRef(0);
  const lastStep = useRef(-1);
  const finished = useRef(false);

  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now();
    const t = setInterval(() => setElapsed(base.current + (performance.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(t);
  }, [running]);

  // экран не гаснет, закрытие требует подтверждения
  useEffect(() => {
    platform.keepAwake(running);
    platform.setClosingConfirmation(running || elapsed > 0);
  }, [running, elapsed > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { platform.keepAwake(false); platform.setClosingConfirmation(false); }, []);

  useBackGuard(elapsed > 0, 'Прервать заварку? Время не сохранится.');

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
    if (running) { base.current += (performance.now() - startedAt.current) / 1000; setElapsed(base.current); }
    else if (elapsed === 0) { lastStep.current = 0; if (sound) beep(); }
    setRunning(!running);
  };
  const reset = async () => {
    if (elapsed > 0 && !(await platform.confirm('Сбросить таймер?'))) return;
    setRunning(false); base.current = 0; setElapsed(0); lastStep.current = -1; finished.current = false;
  };
  const finish = () => {
    if (running) base.current += (performance.now() - startedAt.current) / 1000;
    const total = running ? base.current : elapsed;
    setRunning(false);
    platform.haptic('success');
    replace({ name: 'brewEdit', draft: { ...draft, time: Math.round(total || plan.total), date: Date.now() }, isNew: true, openCupping: m.id === 'cupping' });
  };

  // Клавиатура (компьютер): пробел — старт/пауза, R — сброс, Enter — готово
  const keys = useRef({ toggle, reset, finish });
  keys.current = { toggle, reset, finish };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); keys.current.toggle(); }
      else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') keys.current.reset();
      else if (e.key === 'Enter') { e.preventDefault(); keys.current.finish(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const layout = useLayout();

  const R = 112, C = 2 * Math.PI * R;
  const progress = Math.min(1, elapsed / plan.total);
  const target = step.to !== undefined ? draft.water * step.to : null;

  return (
    <Screen title={draft.plan ? `${m.name} · ${draft.plan.name}` : m.name} subtitle={`${fmtNum(draft.dose, 2)} г · ${fmtNum(draft.water)} г · ${draft.temp ? fmtNum(draft.temp) + '°C' : 'холодная вода'}`}
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
      <div className="timer">
        <svg viewBox="0 0 260 260" className="timer-ring" aria-hidden="true">
          <circle cx="130" cy="130" r={R} className="ring-track" />
          {plan.steps.map((s, i) => {
            const a = (s.at / plan.total) * 2 * Math.PI - Math.PI / 2;
            return <circle key={i} cx={130 + R * Math.cos(a)} cy={130 + R * Math.sin(a)} r="4" className={'ring-tick' + (s.at <= elapsed ? ' on' : '')} />;
          })}
          <circle cx="130" cy="130" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 130 130)" />
        </svg>
        <div className="timer-center">
          <div className="timer-time">{fmtTime(elapsed)}</div>
          <div className="timer-total">{done ? 'время вышло — дождитесь слива' : `из ${fmtTime(plan.total)}`}</div>
        </div>
      </div>

      <div className={'step-now' + (running || elapsed > 0 ? ' live' : '')} key={idx}>
        <span className="eyebrow">{elapsed === 0 ? 'Первый шаг' : done ? 'Финиш' : `Шаг ${idx + 1} из ${plan.steps.length}`}</span>
        <h2>{done ? 'Готово' : step.title}</h2>
        {!done && target !== null && <div className="pour-big">до <b>{fmtNum(target, 0)}</b> г</div>}
        {!done && step.hint && <p>{step.hint}</p>}
        {done && <p>Нажмите ✓, чтобы записать результат и оценить чашку.</p>}
      </div>

      {next && !done && (
        <div className="step-next">
          <span>Через {fmtTime(next.at - elapsed)}</span>
          <b>{next.title}{next.to !== undefined ? ` · до ${fmtNum(draft.water * next.to, 0)} г` : ''}</b>
        </div>
      )}
      {layout === 'desktop' && <p className="kbd-hint"><kbd>Пробел</kbd> старт / пауза · <kbd>R</kbd> сброс · <kbd>Enter</kbd> записать</p>}
    </Screen>
  );
}
