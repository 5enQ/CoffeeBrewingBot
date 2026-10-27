import { GRIND_RULES, type GrindUnit } from '../data/grind';
import { Field, Stepper } from './kit';

/** Помол: у ручной кофемолки — щелчки, у электронной — µm (кнопками ±), иначе — текстом, как раньше */
export function GrindField({ id, unit, value, text, onValue, onText, grinderName }: {
  id: string; unit: GrindUnit | null; value?: number; text: string; grinderName?: string;
  onValue(v: number): void; onText(t: string): void;
}) {
  if (unit) {
    const r = GRIND_RULES[unit];
    return (
      <Stepper label={grinderName ? `Помол · ${grinderName}` : 'Помол'} value={value ?? r.def} step={r.step} min={r.min} max={r.max}
        unit={r.short} format={(v) => String(Math.round(v))} onChange={(v) => onValue(Math.round(v))} />
    );
  }
  return <Field label="Помол" id={id} value={text} onChange={(e) => onText(e.target.value)} placeholder="например, средний или «4,5» по шкале" />;
}
