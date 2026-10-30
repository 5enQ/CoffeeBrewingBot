import { useState } from 'react';
import {
  AFF_SECTIONS, DEFECT_TYPES, DESC_SECTIONS, EXTRINSIC, IMPRESSION, MAIN_TASTES, MAX_MAIN_TASTES, MAX_MOUTHFEEL, MAX_OLFACTORY,
  MODES, MOUTHFEEL_CATA, OLFACTORY, OLFACTORY_LABEL, OLFACTORY_TONE, ROAST_LEVELS, affectiveScore, countedDefects,
  extrinsicFromBean, hasAffective, hasDescriptive, syncUniformity,
  type Affective, type CvaSample, type CvaSession, type Descriptive, type Extrinsic,
} from '../data/cva';
import { fmtNum } from '../data/methods';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { beanTitle } from '../screens/beanUtils';

const fmtScore = (n: number) => n.toFixed(2).replace('.', ',');

/* ================= Session editor ================= */

export function CvaEditor({ value, onChange }: { value: CvaSession; onChange(v: CvaSession): void }) {
  const { beans } = useStore();
  const [tab, setTab] = useState(0);
  const i = Math.min(tab, value.samples.length - 1);
  const sample = value.samples[i];
  const setSample = (patch: Partial<CvaSample>) =>
    onChange({ ...value, samples: value.samples.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="cva">
      {value.samples.length > 1 && (
        <div className="cva-tabs" role="tablist">
          {value.samples.map((s, j) => {
            const bean = beans.find((b) => b.id === s.beanId);
            const sc = s.affective ? affectiveScore(s.affective) : null;
            return (
              <button type="button" role="tab" key={s.id} aria-selected={j === i} className={'cva-tab' + (j === i ? ' on' : '')}
                onClick={() => { platform.haptic('select'); setTab(j); }}>
                <span className="cva-code">{s.code}</span>
                <span className="cva-tab-text"><b>{beanTitle(bean)}</b>{sc !== null && <small>{fmtScore(sc)}</small>}</span>
              </button>
            );
          })}
        </div>
      )}

      {sample && (
        <div className="cva-sample" key={sample.id}>
          {value.samples.length === 1 && (
            <p className="muted pad">Образец {sample.code} · {beanTitle(beans.find((b) => b.id === sample.beanId))}</p>
          )}
          {hasAffective(value.mode) && sample.affective && (
            <AffectiveForm value={sample.affective} cups={value.cups} onChange={(affective) => setSample({ affective })} />
          )}
          {hasDescriptive(value.mode) && sample.descriptive && (
            <DescriptiveForm value={sample.descriptive} onChange={(descriptive) => setSample({ descriptive })} />
          )}
          <ExtrinsicForm value={sample.extrinsic ?? extrinsicFromBean(beans.find((b) => b.id === sample.beanId))}
            onChange={(extrinsic) => setSample({ extrinsic })} />
        </div>
      )}
    </div>
  );
}

/* ================= 104: affective form ================= */

const STEPS: Record<number, string> = { 1: 'Шаг 1 · до заливки', 2: 'Шаг 2 · заливка и корочка', 3: 'Шаг 3 · дегустация по мере остывания' };

function AffectiveForm({ value, cups, onChange }: { value: Affective; cups: number; onChange(v: Affective): void }) {
  const [openNote, setOpenNote] = useState<string | null>(null);
  const score = affectiveScore(value);
  const filled = AFF_SECTIONS.filter((s) => value.scores[s.key] !== undefined).length;
  const sum = AFF_SECTIONS.reduce((s, x) => s + (value.scores[x.key] ?? 0), 0);
  const u = value.nonUniform.filter(Boolean).length;
  const dMarked = value.defective.filter(Boolean).length;
  const d = countedDefects(value);
  const set = (patch: Partial<Affective>) => onChange({ ...value, ...patch });

  const toggleCup = (field: 'nonUniform' | 'defective', idx: number) => {
    platform.haptic('select');
    const arr = [...value[field]];
    arr[idx] = !arr[idx];
    const next = { ...value, [field]: arr };
    onChange(field === 'defective' ? syncUniformity(next) : next);
  };

  return (
    <section className="cva-block">
      <div className="cva-score">
        <div>
          <span className="eyebrow">Аффективная оценка · SCA 104</span>
          {score !== null ? <b className="cva-score-num">{fmtScore(score)}</b> : <b className="cva-score-num muted-num">—</b>}
          <small>{score !== null ? 'балл по формуле стандарта' : `оценено ${filled} из 8 разделов`}</small>
        </div>
        <dl>
          <div><dt>Σ</dt><dd>{sum}</dd></div>
          <div><dt>неоднор.</dt><dd>{u ? `−${2 * u}` : '0'}</dd></div>
          <div><dt>дефекты</dt><dd>{d ? `−${4 * d}` : '0'}</dd></div>
        </dl>
      </div>

      {[1, 2, 3].map((step) => (
        <div key={step} className="cva-step">
          <h4>{STEPS[step]}</h4>
          {AFF_SECTIONS.filter((s) => s.step === step).map((sec) => {
            const v = value.scores[sec.key];
            return (
              <div className="aff-row" key={sec.key}>
                <div className="aff-head">
                  <b>{sec.label}</b>
                  <span className={v ? 'aff-word' : 'aff-word muted'}>{v ? `${v} · ${IMPRESSION[v]}` : sec.hint}</span>
                </div>
                <div className="aff-scale" role="radiogroup" aria-label={sec.label}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button type="button" key={n} role="radio" aria-checked={v === n} aria-label={`${sec.label}: ${n} — ${IMPRESSION[n]}`}
                      className={'aff-dot' + (v === n ? ' on' : '') + (n < 5 ? ' low' : n > 5 ? ' high' : ' mid')}
                      onClick={() => { platform.haptic('select'); set({ scores: { ...value.scores, [sec.key]: v === n ? undefined : n } }); }}>{n}</button>
                  ))}
                </div>
                {openNote === sec.key || value.notes[sec.key] ? (
                  <input className="aff-note" placeholder="Почему такая оценка (аффективная заметка)" value={value.notes[sec.key] ?? ''} autoFocus={openNote === sec.key}
                    onChange={(e) => set({ notes: { ...value.notes, [sec.key]: e.target.value } })} />
                ) : (
                  <button type="button" className="link-btn small" onClick={() => setOpenNote(sec.key)}>+ заметка</button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="cva-step">
        <h4>Однородность и дефекты</h4>
        <div className="cup-line">
          <span>Неоднородные чашки</span>
          <div className="cups">{Array.from({ length: cups }, (_, k) => (
            <button type="button" key={k} className={'cup' + (value.nonUniform[k] ? ' bad' : '')} aria-pressed={!!value.nonUniform[k]}
              aria-label={`Неоднородная чашка ${k + 1}`} onClick={() => toggleCup('nonUniform', k)}>{k + 1}</button>
          ))}</div>
        </div>
        <div className="cup-line">
          <span>Дефектные чашки</span>
          <div className="cups">{Array.from({ length: cups }, (_, k) => (
            <button type="button" key={k} className={'cup' + (value.defective[k] ? ' bad defect' : '')} aria-pressed={!!value.defective[k]}
              aria-label={`Дефектная чашка ${k + 1}`} onClick={() => toggleCup('defective', k)}>{k + 1}</button>
          ))}</div>
        </div>
        {dMarked > 0 && (
          <div className="defect-type">
            <span>Тип дефекта</span>
            <div className="chips">
              {DEFECT_TYPES.map((t) => (
                <button type="button" key={t.id} className={'chip' + (value.defectType === t.id ? ' on' : '')}
                  onClick={() => { platform.haptic('select'); set({ defectType: value.defectType === t.id ? '' : t.id }); }}>{t.label}</button>
              ))}
            </div>
            {!value.defectType && <p className="warn-text small-note">Без типа дефекта дефектные чашки не учитываются в балле (SCA 104, 5.4.1)</p>}
          </div>
        )}
        <p className="muted small-note">Неоднородная — качественно отличается от остальных чашек образца. Дефектная чашка всегда отмечается и как неоднородная.</p>
      </div>
    </section>
  );
}

/* ================= 103: descriptive form ================= */

function Intensity({ label, value, onChange }: { label: string; value?: number; onChange(v: number | undefined): void }) {
  return (
    <div className="int-row">
      <div className="int-head"><b>{label}</b><output>{value ?? '—'}</output></div>
      <input type="range" min={0} max={15} step={1} value={value ?? 0} aria-label={`${label}: интенсивность`}
        className={value === undefined ? 'unset' : ''}
        style={{ ['--p' as string]: `${((value ?? 0) / 15) * 100}%` }}
        onChange={(e) => { platform.haptic('select'); onChange(Number(e.target.value)); }} />
      <div className="int-scale"><span>Низкая</span><span>Средняя</span><span>Высокая</span></div>
    </div>
  );
}

type Opt = { id: string; label: string; hint?: string; tone?: string };

function LimitedChips({ title, options, groups, value, max, onChange }: {
  title: string; options?: Opt[]; groups?: typeof OLFACTORY; value: string[]; max: number; onChange(v: string[]): void;
}) {
  const [warn, setWarn] = useState(false);
  const toggle = (id: string) => {
    if (value.includes(id)) { onChange(value.filter((x) => x !== id)); setWarn(false); return; }
    if (value.length >= max) { platform.haptic('error'); setWarn(true); return; }
    platform.haptic('select'); setWarn(false); onChange([...value, id]);
  };
  return (
    <div className="cata">
      <div className="cata-head"><span>{title}</span><small className={value.length >= max ? 'full' : ''}>{value.length} из {max}</small></div>
      {groups ? (
        <div className="cata-groups">
          {groups.map((g) => (
            <div className="cata-group" key={g.id} data-tone={g.tone}>
              <button type="button" data-tone={g.tone} className={'chip cat' + (value.includes(g.id) ? ' on' : '')} onClick={() => toggle(g.id)}>{g.label.replace('/', '/\u200b')}</button>
              {g.children && (
                <div className="cata-children">
                  {g.children.map((c) => (
                    <button type="button" key={c.id} data-tone={c.tone ?? g.tone} className={'chip' + (value.includes(c.id) ? ' on' : '')} onClick={() => toggle(c.id)}>{c.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="chips">
          {(options ?? []).map((o) => (
            <button type="button" key={o.id} data-tone={o.tone} className={'chip' + (value.includes(o.id) ? ' on' : '')} title={o.hint}
              onClick={() => toggle(o.id)}>{o.label}{o.hint && <small> · {o.hint}</small>}</button>
          ))}
        </div>
      )}
      {warn && <p className="warn-text small-note">Можно выбрать не больше {max} — снимите один, чтобы выбрать другой</p>}
    </div>
  );
}


function DescriptiveForm({ value, onChange }: { value: Descriptive; onChange(v: Descriptive): void }) {
  const set = (patch: Partial<Descriptive>) => onChange({ ...value, ...patch });
  const inten = (k: keyof Descriptive['intensity']) => (v: number | undefined) => set({ intensity: { ...value.intensity, [k]: v } });
  const note = (k: keyof Descriptive['notes'], placeholder: string) => (
    <input className="aff-note" placeholder={placeholder} value={value.notes[k] ?? ''} onChange={(e) => set({ notes: { ...value.notes, [k]: e.target.value } })} />
  );
  return (
    <section className="cva-block">
      <div className="cva-block-head"><span className="eyebrow">Дескриптивная оценка · SCA 103</span><small>интенсивность 0–15 — это сила, а не качество</small></div>

      <div className="cva-step">
        <h4>Степень обжарки · на глаз, до дегустации</h4>
        <div className="chips">
          {ROAST_LEVELS.map((r) => (
            <button type="button" key={r} className={'chip' + (value.roast === r ? ' on' : '')} onClick={() => set({ roast: value.roast === r ? '' : r })}>{r}</button>
          ))}
        </div>
      </div>

      <div className="cva-step">
        <h4>Сухой аромат и аромат</h4>
        <Intensity label={DESC_SECTIONS[0].label} value={value.intensity.fragrance} onChange={inten('fragrance')} />
        <Intensity label={DESC_SECTIONS[1].label} value={value.intensity.aroma} onChange={inten('aroma')} />
        <LimitedChips title="Что в запахе" groups={OLFACTORY} value={value.olfactory} max={MAX_OLFACTORY} onChange={(olfactory) => set({ olfactory })} />
        {note('fragrance', 'Уточнения: например, «черника» к «ягодный»')}
      </div>

      <div className="cva-step">
        <h4>Вкус и послевкусие</h4>
        <Intensity label="Вкус" value={value.intensity.flavor} onChange={inten('flavor')} />
        <Intensity label="Послевкусие" value={value.intensity.aftertaste} onChange={inten('aftertaste')} />
        <LimitedChips title="Что во вкусе (ретроназально)" groups={OLFACTORY} value={value.retronasal} max={MAX_OLFACTORY} onChange={(retronasal) => set({ retronasal })} />
        <LimitedChips title="Основные вкусы" options={MAIN_TASTES} value={value.mainTastes} max={MAX_MAIN_TASTES} onChange={(mainTastes) => set({ mainTastes })} />
        {note('flavor', 'Уточнения и редкие ноты')}
      </div>

      <div className="cva-step">
        <h4>Кислотность и сладость</h4>
        <Intensity label="Кислотность" value={value.intensity.acidity} onChange={inten('acidity')} />
        {note('acidity', 'Какая кислотность: яблочная, цитрусовая, винная…')}
        <Intensity label="Сладость" value={value.intensity.sweetness} onChange={inten('sweetness')} />
        {note('sweetness', 'Какая сладость: медовая, карамельная…')}
      </div>

      <div className="cva-step">
        <h4>Тактильность</h4>
        <Intensity label="Тактильность" value={value.intensity.mouthfeel} onChange={inten('mouthfeel')} />
        <LimitedChips title="Характер" options={MOUTHFEEL_CATA} value={value.mouthfeel} max={MAX_MOUTHFEEL} onChange={(mouthfeel) => set({ mouthfeel })} />
        {note('mouthfeel', 'Заметки')}
      </div>
    </section>
  );
}

/* ================= 105: extrinsic information ================= */

function ExtrinsicForm({ value, onChange }: { value: Extrinsic; onChange(v: Extrinsic): void }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    platform.haptic('select');
    onChange({ ...value, checked: value.checked.includes(id) ? value.checked.filter((x) => x !== id) : [...value.checked, id] });
  };
  return (
    <section className="cva-block">
      <button type="button" className="cva-collapse" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span><span className="eyebrow">Внешняя информация · SCA 105</span><small>Что известно о кофе помимо вкуса: {value.checked.length} отмечено</small></span>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <p className="muted small-note">Заполняйте после сенсорной оценки, чтобы информация не влияла на впечатление. Известное из карточки пачки отмечено автоматически.</p>
          {EXTRINSIC.map((g) => (
            <div className="cva-step" key={g.id}>
              <h4>{g.label}</h4>
              <div className="chips">
                {g.items.map((it) => (
                  <button type="button" key={it.id} className={'chip' + (value.checked.includes(it.id) ? ' on' : '') + (it.sub ? ' child' : '')} onClick={() => toggle(it.id)}>{it.label}</button>
                ))}
              </div>
              <input className="aff-note" placeholder="Подробности" value={value.notes[g.id] ?? ''}
                onChange={(e) => onChange({ ...value, notes: { ...value.notes, [g.id]: e.target.value } })} />
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/* ================= Journal summary ================= */

export function CvaSummary({ session }: { session: CvaSession }) {
  const { beans } = useStore();
  return (
    <div className="cva-summary">
      <p className="muted pad">
        {MODES.find((m) => m.id === session.mode)?.label} оценка · {session.samples.length} обр. · {session.cups}{' '}чашек по {session.cupVolume}{' '}мл
        {session.purpose ? ` · ${session.purpose}` : ''}
      </p>
      {session.samples.map((s) => {
        const bean = beans.find((b) => b.id === s.beanId);
        const a = s.affective;
        const sc = a ? affectiveScore(a) : null;
        const dsc = s.descriptive;
        return (
          <article className="cva-card" key={s.id}>
            <header>
              <span className="cva-code">{s.code}</span>
              <b>{beanTitle(bean)}</b>
              {sc !== null && <span className="cva-score-pill">{fmtScore(sc)}</span>}
            </header>
            {a && (
              <div className="cup-bars">
                {AFF_SECTIONS.map((sec) => {
                  const v = a.scores[sec.key];
                  return (
                    <div key={sec.key}>
                      <span>{sec.label}</span>
                      <i style={{ ['--w' as string]: `${v ? (v / 9) * 100 : 0}%` }} />
                      <b>{v ?? '—'}</b>
                    </div>
                  );
                })}
                <div className="cup-row"><span>Неоднородные</span><span className="mini-cups">{a.nonUniform.map((x, i) => <em key={i} className={x ? 'bad' : 'on'} />)}</span><b>{a.nonUniform.filter(Boolean).length}</b></div>
                {a.defective.some(Boolean) && (
                  <div className="cup-row"><span>Дефекты</span><span className="small-note">{DEFECT_TYPES.find((t) => t.id === a.defectType)?.label ?? 'тип не указан'}</span><b>{countedDefects(a)}</b></div>
                )}
              </div>
            )}
            {dsc && (
              <div className="cva-desc">
                {dsc.roast && <p><span>Обжарка</span> {dsc.roast}</p>}
                {DESC_SECTIONS.some((sec) => dsc.intensity[sec.key] !== undefined) && <div className="cup-bars">
                  {DESC_SECTIONS.map((sec) => {
                    const v = dsc.intensity[sec.key];
                    return v === undefined ? null : (
                      <div key={sec.key}><span>{sec.label}</span><i className="int" style={{ ['--w' as string]: `${(v / 15) * 100}%` }} /><b>{v}</b></div>
                    );
                  })}
                </div>}
                {dsc.olfactory.length > 0 && <div className="cva-tags"><span>Запах</span>{dsc.olfactory.map((x) => <i key={x} className="chip on" data-tone={OLFACTORY_TONE[x]}>{OLFACTORY_LABEL[x]}</i>)}</div>}
                {dsc.retronasal.length > 0 && <div className="cva-tags"><span>Вкус</span>{dsc.retronasal.map((x) => <i key={x} className="chip on" data-tone={OLFACTORY_TONE[x]}>{OLFACTORY_LABEL[x]}</i>)}</div>}
                {dsc.mainTastes.length > 0 && <div className="cva-tags"><span>Основные вкусы</span>{dsc.mainTastes.map((x) => { const t = MAIN_TASTES.find((m) => m.id === x); return <i key={x} className="chip on" data-tone={t?.tone}>{t?.label}</i>; })}</div>}
                {dsc.mouthfeel.length > 0 && <div className="cva-tags"><span>Тактильность</span>{dsc.mouthfeel.map((x) => <i key={x} className="chip on">{MOUTHFEEL_CATA.find((t) => t.id === x)?.label}</i>)}</div>}
                {Object.entries(dsc.notes).filter(([, v]) => v).map(([k, v]) => <p key={k}><span>{DESC_SECTIONS.find((d) => d.key === k)?.label}</span> {v}</p>)}
              </div>
            )}
            {a && Object.entries(a.notes).some(([, v]) => v) && (
              <div className="cva-desc">
                {Object.entries(a.notes).filter(([, v]) => v).map(([k, v]) => <p key={k}><span>{AFF_SECTIONS.find((x) => x.key === k)?.label}</span> {v}</p>)}
              </div>
            )}
            {s.extrinsic && s.extrinsic.checked.length > 0 && (
              <p className="small-note muted">Известно: {EXTRINSIC.flatMap((g) => g.items).filter((it) => s.extrinsic!.checked.includes(it.id)).map((it) => it.label.toLowerCase()).join(', ')}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** Score for lists: the best sample of the session */
export const fmtCva = fmtScore;
export { fmtNum };
