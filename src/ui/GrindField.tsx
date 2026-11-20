import { GRIND_RULES, type GrindUnit } from '../data/grind';
import { Field, Stepper } from './kit';
import { tr } from '../i18n';

/** Grind: clicks for a hand grinder, µm for an electronic one (± buttons), otherwise free text as before */
export function GrindField({ id, unit, value, text, onValue, onText, grinderName }: {
  id: string; unit: GrindUnit | null; value?: number; text: string; grinderName?: string;
  onValue(v: number): void; onText(t: string): void;
}) {
  if (unit) {
    const r = GRIND_RULES[unit];
    return (
      <Stepper label={grinderName ? tr('Помол · {0}', grinderName) : tr('Помол')} value={value ?? r.def} step={r.step} min={r.min} max={r.max}
        unit={r.short} format={(v) => String(Math.round(v))} onChange={(v) => onValue(Math.round(v))} />
    );
  }
  return <Field label={tr('Помол')} id={id} value={text} onChange={(e) => onText(e.target.value)} placeholder={tr('например, средний или «4,5» по шкале')} />;
}
