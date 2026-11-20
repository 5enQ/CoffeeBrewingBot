import { exactMass, extraction, beverageMass, GOLDEN, WATER_PPM } from '../data/extraction';
import { fmtNum } from '../data/methods';
import type { Brew } from '../data/store';
import { Stepper } from './kit';
import { tr } from '../i18n';

/** Water mineralization, ppm (before brewing). 0 — not set; the first «+» jumps to a typical 100 ppm. Any value is accepted. */
export function PpmField({ value, onChange }: { value: number; onChange(v: number): void }) {
  const low = value > 0 && value < WATER_PPM.min, high = value > WATER_PPM.max;
  return (
    <>
      <Stepper label={tr('Минерализация')} value={value} step={5} min={0} max={1500} unit={value ? 'ppm' : ''}
        format={(v) => (v ? String(v) : tr('не указана'))}
        onChange={(v) => onChange(value === 0 && v > 0 && v <= 5 ? 100 : v)} />
      {value === 0 && <p className="muted pad small-note ppm-hint">{tr('Сколько минералов растворено в воде — по TDS-метру. SCA советует {0}–{1} ppm, лучше около {2}.', WATER_PPM.min, WATER_PPM.max, WATER_PPM.target)}</p>}
      {low && <p className="pad small-note ppm-hint warn">{tr('Мягче, чем советует SCA ({0}–{1} ppm): вкус может выйти плоским и кислым, экстракция — слабой. Записываем как есть.', WATER_PPM.min, WATER_PPM.max)}</p>}
      {high && <p className="pad small-note ppm-hint warn">{tr('Жёстче, чем советует SCA ({0}–{1} ppm): кофе может выйти тяжёлым и меловым, а в технике копится накипь. Записываем как есть.', WATER_PPM.min, WATER_PPM.max)}</p>}
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
      <Stepper label={tr('TDS чашки')} value={value} step={espresso ? 0.1 : 0.01} min={0} max={25} unit={value ? '%' : ''}
        format={(v) => (v ? fmtNum(v, 2) : tr('не измерен'))}
        onChange={(v) => { const n = value === 0 && v > 0 && v <= 0.1 ? typical : v; onChange({ tds: n > 0 ? n : undefined }); }} />
      {value > 0 && !espresso && (
        <Stepper label={tr('Вес напитка')} value={mass} step={1} min={0} max={3000} unit={mass ? tr('г') : ''}
          format={(v) => (v ? fmtNum(v) : tr('не взвешен'))}
          // the first «+» starts from the estimate, so a few taps reach the real weight
          onChange={(v) => { const n = mass === 0 && v > 0 && v <= 1 ? Math.round(beverageMass({ ...brew, beverage: undefined })) : v; onChange({ beverage: n > 0 ? n : undefined }); }} />
      )}
      {value === 0
        ? <p className="muted pad small-note tds-hint">{tr('По рефрактометру. По нему считается экстракция — какую часть кофе вода забрала в чашку.')}</p>
        : ey !== null && (
          <p className={'muted pad small-note tds-hint' + (!espresso && inGold(ey, GOLDEN.ey) ? ' ok' : '')}>
{tr('Экстракция {0}{1} %', exact ? '' : '≈ ', fmtNum(ey, 1))}
{!exact && tr(' — примерно: без веса напитка считается, что гуща удерживает ~2 г воды на грамм кофе. Для точного расчёта взвесьте готовый напиток и укажите вес выше.')}
            {exact && brew.beverage ? tr(' (по весу напитка {0} г)', fmtNum(brew.beverage)) : ''}
            {espresso && !brew.beverage ? tr(' (по весу эспрессо на выходе)') : ''}
            {!espresso && (inGold(ey, GOLDEN.ey) && inGold(value, GOLDEN.tds) ? tr(' · в «золотой чашке» SCA') : tr(' · SCA: TDS {0}–{1} %, экстракция {2}–{3} %', fmtNum(GOLDEN.tds[0], 2), fmtNum(GOLDEN.tds[1], 2), GOLDEN.ey[0], GOLDEN.ey[1]))}
          </p>
        )}
    </>
  );
}
