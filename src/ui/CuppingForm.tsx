import { CUP_ATTRS, QUALITY, SCORE_MAX, SCORE_MIN, SCORE_STEP, cupScore, scoreGrade, type Cupping } from '../data/cupping';
import { fmtNum } from '../data/methods';
import { platform } from '../platform';
import { Dots, Stars, Stepper } from './kit';

export function ScoreBadge({ c, big = false }: { c: Cupping; big?: boolean }) {
  const s = cupScore(c);
  return (
    <div className={'score-badge' + (big ? ' big' : '')}>
      <b>{fmtNum(s.total, 2)}</b>
      <span>{scoreGrade(s.total)}</span>
    </div>
  );
}

/** Оценка заварки: у каппинга — баллы SCA, у остальных методов — звёзды */
export function BrewScore({ brew, size = 14, big = false }: { brew: { methodId: string; rating: number; cupping: Cupping | null }; size?: number; big?: boolean }) {
  const scored = brew.cupping && (brew.methodId === 'cupping' || !brew.rating); // старые записи без звёзд — показываем баллы
  return scored ? <ScoreBadge c={brew.cupping!} big={big} /> : <Stars value={brew.rating} size={size} />;
}

export function CuppingForm({ value, onChange }: { value: Cupping; onChange(c: Cupping): void }) {
  const s = cupScore(value);
  const set = (patch: Partial<Cupping>) => onChange({ ...value, ...patch });

  return (
    <div className="cupping">
      <div className="cupping-total">
        <ScoreBadge c={value} big />
        <dl>
          <div><dt>Качество</dt><dd>{fmtNum(s.quality, 2)}</dd></div>
          <div><dt>Чашки</dt><dd>{s.cups}</dd></div>
          <div><dt>Дефекты</dt><dd>{s.defects ? `−${s.defects}` : '0'}</dd></div>
        </dl>
      </div>

      {QUALITY.map((q) => {
        const v = value.scores[q.key];
        return (
          <div className="attr" key={q.key}>
            <div className="attr-head">
              <div><b>{q.label}</b><small>{q.hint}</small></div>
              <output>{v.toFixed(2).replace('.', ',')}</output>
            </div>
            <input type="range" id={`score-${q.key}`} aria-label={q.label}
              min={SCORE_MIN} max={SCORE_MAX} step={SCORE_STEP} value={v}
              style={{ ['--p' as string]: `${((v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%` }}
              onChange={(e) => { platform.haptic('select'); set({ scores: { ...value.scores, [q.key]: Number(e.target.value) } }); }} />
            <div className="scale"><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span></div>
            {q.intensity && q.key === 'fragrance' && (
              <div className="attr-intensity two">
                {(['Сухой', 'Влажный'] as const).map((lbl, i) => {
                  const pair = (value.intensity.fragrance as [number, number]) ?? [3, 3];
                  return <Dots key={lbl} label={lbl} left="слабый" right="яркий" value={pair[i]}
                    onChange={(n) => { const p: [number, number] = [...pair]; p[i] = n; set({ intensity: { ...value.intensity, fragrance: p } }); }} />;
                })}
              </div>
            )}
            {q.intensity && q.key !== 'fragrance' && (
              <div className="attr-intensity">
                <Dots label="Интенсивность" left={q.intensity[0]} right={q.intensity[1]}
                  value={(value.intensity[q.key] as number) ?? 3}
                  onChange={(n) => set({ intensity: { ...value.intensity, [q.key]: n } })} />
              </div>
            )}
          </div>
        );
      })}

      {CUP_ATTRS.map((a) => (
        <div className="attr" key={a.key}>
          <div className="attr-head">
            <div><b>{a.label}</b><small>{a.hint}</small></div>
            <output>{value.cups[a.key].filter(Boolean).length * 2}</output>
          </div>
          <div className="cups">
            {value.cups[a.key].map((ok, i) => (
              <button type="button" key={i} className={'cup' + (ok ? ' on' : '')} aria-pressed={ok} aria-label={`Чашка ${i + 1}`}
                onClick={() => {
                  platform.haptic('select');
                  const next = [...value.cups[a.key]]; next[i] = !ok;
                  set({ cups: { ...value.cups, [a.key]: next } });
                }}>{i + 1}</button>
            ))}
          </div>
        </div>
      ))}

      <div className="attr">
        <div className="attr-head"><div><b>Дефекты</b><small>Привкус — 2 балла за чашку, порок — 4</small></div></div>
        <Stepper label="Чашек с привкусом (taint)" value={value.defects.taintCups} min={0} max={5}
          onChange={(n) => set({ defects: { ...value.defects, taintCups: n } })} />
        <Stepper label="Чашек с пороком (fault)" value={value.defects.faultCups} min={0} max={5}
          onChange={(n) => set({ defects: { ...value.defects, faultCups: n } })} />
      </div>
    </div>
  );
}
