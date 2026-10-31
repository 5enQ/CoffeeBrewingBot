import { Stepper } from './kit';

/** Water TDS, ppm. 0 — not set; the first «+» jumps to a typical 100 ppm instead of 5 */
export function TdsField({ value, onChange }: { value: number; onChange(v: number): void }) {
  return (
    <>
      <Stepper label="TDS воды" value={value} step={5} min={0} max={1500} unit={value ? 'ppm' : ''}
        format={(v) => (v ? String(v) : 'не указан')}
        onChange={(v) => onChange(value === 0 && v > 0 && v <= 5 ? 100 : v)} />
      {value === 0 && <p className="muted pad small-note tds-hint">Сколько минералов растворено в воде — по TDS-метру. SCA советует 75–250 ppm, лучше около 150.</p>}
    </>
  );
}
