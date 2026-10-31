import { extraction, GOLDEN } from '../data/extraction';
import { fmtNum } from '../data/methods';
import type { Brew } from '../data/store';
import { Stepper } from './kit';

/** Water mineralization, ppm (before brewing). 0 — not set; the first «+» jumps to a typical 100 ppm */
export function PpmField({ value, onChange }: { value: number; onChange(v: number): void }) {
  return (
    <>
      <Stepper label="Минерализация воды" value={value} step={5} min={0} max={1500} unit={value ? 'ppm' : ''}
        format={(v) => (v ? String(v) : 'не указана')}
        onChange={(v) => onChange(value === 0 && v > 0 && v <= 5 ? 100 : v)} />
      {value === 0 && <p className="muted pad small-note ppm-hint">Сколько минералов растворено в воде — по TDS-метру. SCA советует 75–250 ppm, лучше около 150.</p>}
    </>
  );
}

/** Cup TDS, % (after brewing, refractometer) and the extraction it gives. 0 — not measured; the first «+» gives 1.30 % */
export function CupTdsField({ brew, onChange }: { brew: Pick<Brew, 'methodId' | 'water' | 'dose' | 'tds'>; onChange(v: number | undefined): void }) {
  const value = brew.tds ?? 0;
  const espresso = brew.methodId === 'espresso';
  const ey = extraction(brew);
  const typical = espresso ? 9 : 1.3;
  const inGold = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;
  return (
    <>
      <Stepper label="TDS чашки" value={value} step={espresso ? 0.1 : 0.01} min={0} max={25} unit={value ? '%' : ''}
        format={(v) => (v ? fmtNum(v, 2) : 'не измерен')}
        onChange={(v) => { const n = value === 0 && v > 0 && v <= 0.1 ? typical : v; onChange(n > 0 ? n : undefined); }} />
      {value === 0
        ? <p className="muted pad small-note tds-hint">По рефрактометру. По нему считается экстракция — какую часть кофе вода забрала в чашку.</p>
        : ey !== null && (
          <p className={'muted pad small-note tds-hint' + (!espresso && inGold(ey, GOLDEN.ey) ? ' ok' : '')}>
            Экстракция ≈ {fmtNum(ey, 1)} %{espresso ? ' (по весу напитка)' : ' (оценка: зерно удерживает ~2 г воды на грамм)'}
            {!espresso && (inGold(ey, GOLDEN.ey) && inGold(value, GOLDEN.tds) ? ' · в «золотой чашке» SCA' : ` · SCA: TDS ${fmtNum(GOLDEN.tds[0], 2)}–${fmtNum(GOLDEN.tds[1], 2)} %, экстракция ${GOLDEN.ey[0]}–${GOLDEN.ey[1]} %`)}
          </p>
        )}
    </>
  );
}
