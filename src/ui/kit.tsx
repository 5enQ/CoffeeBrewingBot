import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type InputHTMLAttributes } from 'react';
import { platform } from '../platform';
import { DepthCtx, useRouter } from '../router';
import { useLayout } from '../layout';
import { Icon } from './icons';
import { dialog } from './dialog';

export function Screen({ title, subtitle, action, children, footer, root = false }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; footer?: ReactNode; root?: boolean;
}) {
  const { back } = useRouter();
  const layout = useLayout();
  const depth = useContext(DepthCtx);
  // На компьютере стрелка «назад» нужна всегда (карточка справа), у первой карточки — «закрыть»
  const showBack = !root && (layout === 'desktop' || !platform.hasNativeBack);
  const closeIcon = layout === 'desktop' && depth === 1;
  return (
    <div className="screen">
      <header className="topbar">
        {showBack && (
          <button className="icon-btn back" onClick={() => back()} aria-label={closeIcon ? 'Закрыть' : 'Назад'}><Icon name={closeIcon ? 'close' : 'back'} /></button>
        )}
        <div className="topbar-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="topbar-action">{action}</div>}
      </header>
      <main className="content">{children}</main>
      {footer && <div className="footer">{footer}</div>}
    </div>
  );
}

export function Section({ title, aside, children, plain = false }: { title?: string; aside?: ReactNode; children: ReactNode; plain?: boolean }) {
  return (
    <section className="section">
      {(title || aside) && (
        <div className="section-head">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      <div className={plain ? '' : 'group'}>{children}</div>
    </section>
  );
}

export function Row({ label, value, hint, onClick, leading, chevron, active }: {
  label: ReactNode; value?: ReactNode; hint?: ReactNode; onClick?: () => void; leading?: ReactNode; chevron?: boolean; active?: boolean;
}) {
  const inner = (
    <>
      {leading && <span className="row-lead">{leading}</span>}
      <span className="row-main">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {(chevron ?? !!onClick) && <span className="row-chev"><Icon name="chevron" size={18} /></span>}
    </>
  );
  return onClick
    ? <button type="button" className={'row' + (active ? ' active' : '')} aria-current={active || undefined} onClick={onClick}>{inner}</button>
    : <div className="row">{inner}</div>;
}

export function Field({ label, id, suffix, children, ...rest }: {
  label: string; id: string; suffix?: ReactNode; children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        {children ?? <input id={id} {...rest} />}
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format, label, unit }: {
  value: number; onChange(v: number): void; step?: number; min?: number; max?: number;
  format?: (v: number) => string; label: string; unit?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const latest = useRef(value);
  latest.current = value;
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval>; held: boolean }>({ held: false });
  const decimals = Math.max(0, (String(step).split('.')[1] ?? '').length);

  const clamp = (v: number) => Number(Math.min(max, Math.max(min, Math.round(v / step) * step)).toFixed(Math.max(decimals, 2)));
  const set = (v: number) => {
    const n = clamp(v);
    if (n !== latest.current) { platform.haptic('select'); latest.current = n; onChange(n); }
  };

  // удержание кнопки — быстрый повтор
  const startHold = (dir: 1 | -1) => {
    hold.current.held = false;
    hold.current.t = setTimeout(() => {
      hold.current.held = true;
      hold.current.i = setInterval(() => set(latest.current + dir * step), 70);
    }, 420);
  };
  const stopHold = () => { clearTimeout(hold.current.t); clearInterval(hold.current.i); };
  useEffect(() => stopHold, []);
  const tap = (dir: 1 | -1) => { if (hold.current.held) { hold.current.held = false; return; } set(latest.current + dir * step); };

  const commit = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (!isNaN(n)) set(n);
    setEditing(false);
  };

  const btn = (dir: 1 | -1) => (
    <button type="button" aria-label={`${dir > 0 ? 'Увеличить' : 'Уменьшить'}: ${label}`}
      onClick={() => tap(dir)} onPointerDown={() => startHold(dir)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
      onContextMenu={(e) => e.preventDefault()}>{dir > 0 ? '+' : '−'}</button>
  );

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-ctrl">
        {btn(-1)}
        {editing ? (
          <input className="stepper-input" autoFocus inputMode="decimal" aria-label={label} value={text}
            onChange={(e) => setText(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }} />
        ) : (
          <button type="button" className="stepper-value" aria-label={`${label}: ввести вручную`}
            onClick={() => { setText(String(value).replace('.', ',')); setEditing(true); }}>
            {format ? format(value) : value}{unit && <small>{unit}</small>}
          </button>
        )}
        {btn(1)}
      </div>
    </div>
  );
}

export function Chips({ options, value, onToggle, toneOf }: {
  options: string[]; value: string[]; onToggle(v: string): void; toneOf?: (v: string) => string;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          type="button" key={o}
          className={'chip' + (value.includes(o) ? ' on' : '')}
          data-tone={toneOf?.(o)}
          onClick={() => { platform.haptic('select'); onToggle(o); }}
        >{o}</button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange(v: T): void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button type="button" role="tab" key={o.value} aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => { platform.haptic('select'); onChange(o.value); }}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className={'stars' + (onChange ? ' editable' : '')} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const star = <Icon name="star" size={size} filled={i <= value} />;
        return onChange ? (
          <button type="button" key={i} className={i <= value ? 'on' : ''} aria-label={`${i} из 5`}
            onClick={() => { platform.haptic('select'); onChange(i === value ? 0 : i); }}>{star}</button>
        ) : <span key={i} className={i <= value ? 'on' : ''}>{star}</span>;
      })}
    </div>
  );
}

/** Шкала 1–5 точками */
export function Dots({ value, onChange, left, right, label }: {
  value: number; onChange(v: number): void; left: string; right: string; label: string;
}) {
  return (
    <div className="dots">
      <div className="dots-head"><span>{label}</span></div>
      <div className="dots-track">
        <small>{left}</small>
        <div className="dots-row">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} aria-label={`${label}: ${i}`}
              className={i === value ? 'on' : i < value ? 'past' : ''}
              onClick={() => { platform.haptic('select'); onChange(i); }} />
          ))}
        </div>
        <small>{right}</small>
      </div>
    </div>
  );
}

export function Button({ children, onClick, kind = 'primary', icon, disabled, wide }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: Parameters<typeof Icon>[0]['name']; disabled?: boolean; wide?: boolean;
}) {
  return (
    <button type="button" className={`btn btn-${kind}${wide ? ' wide' : ''}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={20} />}<span>{children}</span>
    </button>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function SampleTag() {
  return <span className="tag tag-sample">пример</span>;
}

export function DialogHost() {
  const d = useSyncExternalStore(dialog.subscribe, dialog.get);
  if (!d) return null;
  return (
    <div className="modal-backdrop" onClick={() => dialog.close(false)}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{d.message}</p>
        <div className="dialog-actions">
          {d.kind === 'confirm' && <button type="button" className="btn btn-ghost" onClick={() => dialog.close(false)}>Отмена</button>}
          <button type="button" className="btn btn-primary" autoFocus onClick={() => dialog.close(true)}>{d.kind === 'confirm' ? 'Да' : 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
