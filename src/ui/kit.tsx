import { useSyncExternalStore, type ReactNode, type InputHTMLAttributes } from 'react';
import { platform } from '../platform';
import { useRouter } from '../router';
import { Icon } from './icons';
import { dialog } from './dialog';

export function Screen({ title, subtitle, action, children, footer, root = false }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; footer?: ReactNode; root?: boolean;
}) {
  const { back } = useRouter();
  const showBack = !root && !platform.hasNativeBack;
  return (
    <div className="screen">
      <header className="topbar">
        {showBack && (
          <button className="icon-btn back" onClick={() => back()} aria-label="Назад"><Icon name="back" /></button>
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

export function Row({ label, value, hint, onClick, leading, chevron }: {
  label: ReactNode; value?: ReactNode; hint?: ReactNode; onClick?: () => void; leading?: ReactNode; chevron?: boolean;
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
    ? <button type="button" className="row" onClick={onClick}>{inner}</button>
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
  const set = (v: number) => {
    const n = Math.min(max, Math.max(min, Math.round(v / step) * step));
    platform.haptic('select');
    onChange(Number(n.toFixed(2)));
  };
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-ctrl">
        <button type="button" onClick={() => set(value - step)} aria-label={`Уменьшить: ${label}`}>−</button>
        <output>{format ? format(value) : value}{unit && <small>{unit}</small>}</output>
        <button type="button" onClick={() => set(value + step)} aria-label={`Увеличить: ${label}`}>+</button>
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
