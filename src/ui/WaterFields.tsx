import { exactMass, extraction, beverageMass, GOLDEN, WATER_PPM } from '../data/extraction';
import { fmtNum } from '../data/methods';
import type { Brew } from '../data/store';
import { Stepper } from './kit';

/** Water mineralization, ppm (before brewing). 0 — not set; the first «+» jumps to a typical 100 ppm. Any value is accepted. */
export function PpmField({ value, onChange }: { value: number; onChange(v: number): void }) {
  const low = value > 0 && value < WATER_PPM.min, high = value > WATER_PPM.max;
  return (
    <>
      <Stepper label="Минерализация воды" value={value} step={5} min={0} max={1500} unit={value ? 'ppm' : ''}
        format={(v) => (v ? String(v) : 'не указана')}
        onChange={(v) => onChange(value === 0 && v > 0 && v <= 5 ? 100 : v)} />
      {value === 0 && <p className="muted pad small-note ppm-hint">Сколько минералов растворено в воде — по TDS-метру. SCA советует {WATER_PPM.min}–{WATER_PPM.max} ppm, лучше около {WATER_PPM.target}.</p>}
      {low && <p className="pad small-note ppm-hint warn">Мягче, чем советует SCA ({WATER_PPM.min}–{WATER_PPM.max} ppm): вкус может выйти плоским и кислым, экстракция — слабой. Записываем как есть.</p>}
      {high && <p className="pad small-note ppm-hint warn">Жёстче, чем советует SCA ({WATER_PPM.min}–{WATER_PPM.max} ppm): кофе может выйти тяжёлым и меловым, а в технике копится накипь. Записываем как есть.</p>}
    </>
  );
}

type Cup = Pick<Brew, 'methodId' | 'water' | 'dose' | 'tds' | 'beverage'>;

/**
 * Cup TDS, % (after brewing, refractometer) and the extraction it gives. 0 — not measured; the first «+» gives 1.30 %.
 * Without the drink weight the extraction is an estimate; an optional «Вес напитка» makes it exact.
 */
export function CupTdsField({ brew, onChange }: { brew: Cup; onChange(patch: Partial<Pick<Brew, 'tds' | 'beverage'>>): void }) {
  const value = brew.tds ?? 0;
  const espresso = brew.methodId === 'espresso';
  const ey = extraction(brew);
  const exact = exactMass(brew);
  const typical = espresso ? 9 : 1.3;
  const inGold = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;
  const mass = brew.beverage ?? 0;
  return (
    <>
      <Stepper label="TDS чашки" value={value} step={espresso ? 0.1 : 0.01} min={0} max={25} unit={value ? '%' : ''}
        format={(v) => (v ? fmtNum(v, 2) : 'не измерен')}
        onChange={(v) => { const n = value === 0 && v > 0 && v <= 0.1 ? typical : v; onChange({ tds: n > 0 ? n : undefined }); }} />
      {value > 0 && !espresso && (
        <Stepper label="Вес напитка" value={mass} step={1} min={0} max={3000} unit={mass ? 'г' : ''}
          format={(v) => (v ? fmtNum(v) : 'не взвешен')}
          // the first «+» starts from the estimate, so a few taps reach the real weight
          onChange={(v) => { const n = mass === 0 && v > 0 && v <= 1 ? Math.round(beverageMass({ ...brew, beverage: undefined })) : v; onChange({ beverage: n > 0 ? n : undefined }); }} />
      )}
      {value === 0
        ? <p className="muted pad small-note tds-hint">По рефрактометру. По нему считается экстракция — какую часть кофе вода забрала в чашку.</p>
        : ey !== null && (
          <p className={'muted pad small-note tds-hint' + (!espresso && inGold(ey, GOLDEN.ey) ? ' ok' : '')}>
            Экстракция {exact ? '' : '≈ '}{fmtNum(ey, 1)} %
            {!exact && ' — примерно: без веса напитка считается, что гуща удерживает ~2 г воды на грамм кофе. Для точного расчёта взвесьте готовый напиток и укажите вес выше.'}
            {exact && brew.beverage ? ` (по весу напитка ${fmtNum(brew.beverage)} г)` : ''}
            {espresso && !brew.beverage ? ' (по весу эспрессо на выходе)' : ''}
            {!espresso && (inGold(ey, GOLDEN.ey) && inGold(value, GOLDEN.tds) ? ' · в «золотой чашке» SCA' : ` · SCA: TDS ${fmtNum(GOLDEN.tds[0], 2)}–${fmtNum(GOLDEN.tds[1], 2)} %, экстракция ${GOLDEN.ey[0]}–${GOLDEN.ey[1]} %`)}
          </p>
        )}
    </>
  );
}
