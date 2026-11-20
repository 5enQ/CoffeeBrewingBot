import { useState } from 'react';
import {
  CUP_VOLUMES, MODES, PROTOCOL, PROTOCOL_RULES, cupsFor, dosePerCup, newSample,
  type CvaMode, type CvaSession,
} from '../data/cva';
import { fmtNum, fmtTime, methodById } from '../data/methods';
import { useStore, uid, type Brew } from '../data/store';
import { beanStock } from '../data/stock';
import { useRouter } from '../router';
import { GearPicker, defaultGear } from '../ui/GearPicker';
import type { GearRef } from '../data/gear';
import { MethodIcon, Icon } from '../ui/icons';
import { Button, Field, Screen, Section, Segmented } from '../ui/kit';
import { platform } from '../platform';
import { BeanPicker } from './BeanPicker';
import { beanMeta, beanTitle } from './beanUtils';
import { tr } from '../i18n';

const NB = ' ';

/** Blind three-digit sample codes, as on a cupping table */
function freshCode(taken: string[]) {
  for (;;) {
    const c = String(100 + Math.floor(Math.random() * 900));
    if (!taken.includes(c)) return c;
  }
}

interface Slot { key: string; code: string; beanId: string | null }

/** Days since roast (by the date on the pack) */
function restDays(roastDate: string) {
  if (!roastDate) return null;
  const t = Date.parse(roastDate + 'T12:00:00');
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function CuppingSetup({ beanId, from }: { beanId?: string | null; from?: Brew }) {
  const m = methodById('cupping');
  const { beans, brews, gear: myGear, recipes, saveRecipe } = useStore();
  const { push } = useRouter();
  const saved = recipes.cupping;

  const [mode, setMode] = useState<CvaMode>(from?.cva?.mode ?? 'affective');
  const [cupVolume, setCupVolume] = useState(from?.cva?.cupVolume ?? (saved?.ratio ? Math.round(saved.ratio * saved.dose / 10) * 10 : 200));
  const [descCups, setDescCups] = useState(from?.cva?.mode === 'descriptive' ? from.cva.cups : 3);
  const [purpose, setPurpose] = useState(from?.cva?.purpose ?? '');
  const [gear, setGear] = useState<GearRef[]>(() => from?.gear?.length ? from.gear : defaultGear('cupping', myGear, saved?.gear));
  const [slots, setSlots] = useState<Slot[]>(() => {
    const taken: string[] = [];
    const mk = (id: string | null): Slot => { const code = freshCode(taken); taken.push(code); return { key: uid(), code, beanId: id }; };
    if (from?.cva) return from.cva.samples.map((s) => mk(s.beanId));
    if (from) return [mk(from.beanId)];
    return [mk(beanId ?? beans.find((b) => !b.sample)?.id ?? beans[0]?.id ?? null)];
  });
  const [open, setOpen] = useState<string | null>(null);

  const cups = mode === 'descriptive' ? cupsFor(mode, descCups) : cupsFor(mode);
  const dose = dosePerCup(cupVolume);
  const perSample = Math.round(dose * cups * 10) / 10;
  const vol = CUP_VOLUMES.includes(cupVolume) ? cupVolume : 200;

  const setSlot = (key: string, beanId: string | null) => setSlots((s) => s.map((x) => (x.key === key ? { ...x, beanId } : x)));
  const addSlot = () => {
    if (slots.length >= PROTOCOL.maxSamples) return;
    platform.haptic('select');
    const k = uid();
    setSlots((s) => [...s, { key: k, code: freshCode(s.map((x) => x.code)), beanId: null }]);
    setOpen(k);
  };
  const removeSlot = (key: string) => { platform.haptic('select'); setSlots((s) => s.filter((x) => x.key !== key)); };

  const ready = slots.length > 0 && slots.every((s) => s.beanId);

  // Grams needed from each pack (one pack can be on the table twice)
  const need = new Map<string, number>();
  slots.forEach((s) => s.beanId && need.set(s.beanId, (need.get(s.beanId) ?? 0) + perSample));

  const draft = (): Brew => {
    const session: CvaSession = {
      mode, cupVolume: vol, cups, purpose: purpose.trim(),
      samples: slots.map((s) => newSample(uid(), s.code, s.beanId, mode, cups, beans.find((b) => b.id === s.beanId))),
    };
    return {
      id: uid(), date: Date.now(), methodId: 'cupping', beanId: slots[0]?.beanId ?? null,
      dose, water: vol, temp: PROTOCOL.waterTemp, grind: m.grind, time: m.total,
      rating: 0, taste: { acidity: 3, sweetness: 3, bitterness: 2, body: 3 }, descriptors: [], notes: '',
      cupping: null, cva: session, gear,
    };
  };
  const remember = () => saveRecipe('cupping', { dose, ratio: vol / dose, temp: PROTOCOL.waterTemp, grind: m.grind, gear: gear.map((g) => g.id) });

  return (
    <Screen title={tr('Каппинг')} subtitle={tr('Протокол SCA Coffee Value Assessment')}
      footer={
        <div className="footer-actions">
          <Button kind="secondary" disabled={!ready} onClick={() => { remember(); push({ name: 'brewEdit', draft: draft(), isNew: true }); }}>{tr('Без таймера')}</Button>
          <Button icon="play" wide disabled={!ready} onClick={() => { remember(); push({ name: 'timer', draft: draft() }); }}>{tr('Начать')}</Button>
        </div>
      }>
      <div className="method-hero">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={44} /></span>
        <dl className="recipe-sum">
          <div><dt>{tr('На чашку')}</dt><dd>{tr('{0}{1}г', fmtNum(dose, 1), NB)}</dd></div>
          <div><dt>{tr('Вода')}</dt><dd>{tr('{0}{1}мл', vol, NB)}</dd></div>
          <div><dt>{tr('Чашек')}</dt><dd>{cups}{NB}×{NB}{slots.length}</dd></div>
          <div><dt>{tr('Время')}</dt><dd>{fmtTime(m.total)}</dd></div>
        </dl>
      </div>

      <Section title={tr('Вид оценки')} plain>
        <Segmented value={mode} onChange={(v) => { platform.haptic('select'); setMode(v); }} options={MODES.map((x) => ({ value: x.id, label: x.label }))} />
        <p className="muted pad small-note">{MODES.find((x) => x.id === mode)?.hint}</p>
      </Section>

      <Section title={tr('Образцы · {0} из {1}', slots.length, PROTOCOL.maxSamples)} plain
        aside={slots.length < PROTOCOL.maxSamples ? <button type="button" className="link-btn" onClick={addSlot}>{tr('+ Образец')}</button> : undefined}>
        <div className="cva-slots">
          {slots.map((s) => {
            const bean = beans.find((b) => b.id === s.beanId);
            const st = bean ? beanStock(bean, brews) : null;
            const want = s.beanId ? need.get(s.beanId) ?? 0 : 0;
            const short = st && st.total > 0 && st.left < want;
            const days = bean ? restDays(bean.roastDate) : null;
            const isOpen = open === s.key || !s.beanId;
            return (
              <div className={'cva-slot' + (isOpen ? ' open' : '')} key={s.key}>
                <div className="cva-slot-head">
                  <span className="cva-code" title={tr('Слепой код образца')}>{s.code}</span>
                  <button type="button" className="cva-slot-main" onClick={() => setOpen(isOpen && s.beanId ? null : s.key)}>
                    <b>{bean ? beanTitle(bean) : tr('Выберите зерно')}</b>
                    <small>{bean ? [beanMeta(bean), st?.total ? tr('осталось {0}{1}из {2}{3}г', fmtNum(st.left, 0), NB, fmtNum(st.total, 0), NB) : ''].filter(Boolean).join(' · ') : tr('понадобится {0}{1}г', fmtNum(perSample, 1), NB)}</small>
                  </button>
                  {slots.length > 1 && (
                    <button type="button" className="icon-btn" aria-label={tr('Убрать образец {0}', s.code)} onClick={() => removeSlot(s.key)}><Icon name="close" /></button>
                  )}
                </div>
                {isOpen && <BeanPicker value={s.beanId} onChange={(id) => { setSlot(s.key, id); if (id) setOpen(null); }} dose={perSample} />}
                {short && st && <p className="status warn">{tr('Не хватит зерна: нужно {0}{1}г, в пачке {2}{3}г.', fmtNum(want, 1), NB, fmtNum(st.left, 0), NB)}</p>}
                {days !== null && days > 1 && (
                  <p className="status note">{tr('Обжарка {0}{1}{2} назад. По протоколу образец отдыхает 8–24{3}ч — оценка будет «как у потребителя», а не калибровочной.', days, NB, dayWord(days), NB)}</p>
                )}
                {days !== null && days < 0 && <p className="status note">{tr('Дата обжарки в будущем — проверьте карточку пачки.')}</p>}
              </div>
            );
          })}
        </div>
        <p className="muted pad small-note">{tr('На каждый образец: {0}{1}чашек по {2}{3}г — всего {4}{5}г. Коды скрывают названия, чтобы оценка была слепой.', cups, NB, fmtNum(dose, 1), NB, fmtNum(perSample, 1), NB)}</p>
      </Section>

      <Section title={tr('Чашки')} plain>
        <div className="chips cup-volumes">
          {CUP_VOLUMES.map((v) => (
            <button type="button" key={v} className={'chip' + (v === vol ? ' on' : '')} onClick={() => { platform.haptic('select'); setCupVolume(v); }}>
{tr('{0}{1}мл · {2}{3}г', v, NB, fmtNum(dosePerCup(v), 1), NB)}
</button>
          ))}
        </div>
        {mode === 'descriptive' && (
          <div className="chips">
            {[3, 4, 5].map((n) => (
              <button type="button" key={n} className={'chip' + (n === cups ? ' on' : '')} onClick={() => { platform.haptic('select'); setDescCups(n); }}>{tr('{0}{1}чашки', n, NB)}</button>
            ))}
          </div>
        )}
        <p className="muted pad small-note">{tr('Объём — до края чашки. Доза {0}{1}±{2}0,2{3}г,', fmtNum(dose, 1), NB, NB, NB)} {mode === 'descriptive' ? tr('3–5 чашек') : tr('5 чашек')} {tr('на образец — по стандарту.')}</p>
      </Section>

      <Section title={tr('Протокол SCA')} aside={<span className="lock-tag"><Icon name="lock" size={14} />{tr('не меняется')}</span>}>
        <dl className="rules">
          {PROTOCOL_RULES.map((r) => (
            <div key={r.label}><dt>{r.label}</dt><dd><b>{r.value}</b>{r.hint && <small>{r.hint}</small>}</dd></div>
          ))}
        </dl>
      </Section>

      <Section title={tr('Порядок')}>
        <ol className="steps-preview">
          <li><time>{tr('до')}</time><div><b>{tr('Сухой аромат')}</b><p>{tr('Смелите каждую чашку отдельно, накройте и оцените сухой аромат в течение 15 минут после помола.')}</p></div></li>
          {m.steps.map((s, i) => (
            <li key={i}><time>{fmtTime(s.at)}</time><div><b>{s.title}</b>{s.hint && <p>{s.hint}</p>}</div></li>
          ))}
          <li className="done"><time>{fmtTime(m.total)}</time><div><b>{tr('Оценка завершена')}</b><p>{tr('Кофе остыл до комнатной температуры — финальные оценки.')}</p></div></li>
        </ol>
      </Section>

      <Section title={tr('Цель сессии')} plain>
        <Field label={tr('Зачем оцениваем')} id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={tr('например, выбор лота, контроль обжарки')} />
      </Section>

      <Section title={tr('Оборудование')} plain>
        <GearPicker methodId="cupping" value={gear} onChange={setGear} />
      </Section>
    </Screen>
  );
}

function dayWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return tr('день');
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return tr('дня');
  return tr('дней');
}
