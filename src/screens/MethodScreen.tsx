import { useEffect, useRef, useState } from 'react';
import { methodById, fmtRatio, fmtTime, fmtNum } from '../data/methods';
import { emptyCupping } from '../data/cupping';
import { isDrip, useStore, uid, type Brew } from '../data/store';
import { useRouter } from '../router';
import { MethodIcon } from '../ui/icons';
import { type StepperLock, Button, Row, Screen, Section, Stepper } from '../ui/kit';
import { beanMeta, brewBeanTitle } from './beanUtils';
import { BeanPicker, DripPicker } from './BeanPicker';
import { GearPicker, defaultGear } from '../ui/GearPicker';
import type { GearRef } from '../data/gear';
import { effectivePlan, planFromRecipe, recipeFromStandard, type BrewPlan } from '../data/recipes';
import { beanStock, dripItemLeft } from '../data/stock';
import { GRIND_RULES, fmtGrind, grinderOf, unitOf } from '../data/grind';
import { GrindField } from '../ui/GrindField';
import { LOCKED_TEXT, loadLock, saveLock, solve, type Lock } from '../data/ratio';
import { toast } from '../ui/toast';
import { PpmField } from '../ui/WaterFields';

export function MethodScreen({ methodId, beanId, from, recipeId }: { methodId: string; beanId?: string | null; from?: Brew; recipeId?: string }) {
  const m = methodById(methodId);
  const { recipes, saveRecipe, beans, brews, gear: myGear, custom, profile, saveProfile } = useStore();
  const { push } = useRouter();
  const saved = recipes[m.id];
  const mine = custom.filter((r) => r.methodId === m.id);

  // Selected recipe: 'std' — standard, 'from' — schedule of the repeated brew, otherwise a custom recipe id
  // The brew's schedule matches a custom recipe — select it rather than duplicating
  const sameAsFrom = from?.plan
    ? mine.find((r) => r.id === from.plan!.recipeId) ?? mine.find((r) => r.name === from.plan!.name && JSON.stringify(r.steps) === JSON.stringify(from.plan!.steps))
    : undefined;
  const initialChoice = recipeId
    ? (recipeId === 'std' || !mine.some((r) => r.id === recipeId) ? 'std' : recipeId)
    : from?.plan
    ? (sameAsFrom ? sameAsFrom.id : 'from')
    : from ? 'std' : saved?.recipeId && mine.some((r) => r.id === saved.recipeId) ? saved.recipeId : 'std';
  const [choice, setChoice] = useState<string>(initialChoice);
  const active = mine.find((r) => r.id === choice);
  const plan: BrewPlan = choice === 'from' && from?.plan ? from.plan : active ? planFromRecipe(active) : effectivePlan(m.id);

  const startActive = mine.find((r) => r.id === initialChoice);
  const [dose, setDose] = useState(from?.dose ?? startActive?.dose ?? saved?.dose ?? m.dose);
  const [ratio, setRatio] = useState(from ? from.water / from.dose : startActive?.ratio ?? saved?.ratio ?? m.ratio);
  const [ppm, setPpm] = useState(from?.ppm ?? profile.waterPpm ?? 0);
  const [temp, setTemp] = useState(from?.temp ?? startActive?.temp ?? saved?.temp ?? m.temp);
  const [grind, setGrind] = useState(from?.grind ?? startActive?.grind ?? saved?.grind ?? m.grind);
  const [gear, setGear] = useState<GearRef[]>(() => from?.gear?.length ? from.gear : defaultGear(m.id, myGear, saved?.gear));
  // numeric grind — when a hand (clicks) or electronic (µm) grinder is selected
  const grinder = grinderOf(gear, myGear);
  const grindUnit = unitOf(grinder?.type);
  const grindStart = () => {
    if (!grinder || !grindUnit) return undefined;
    if (from?.grindUnit === grindUnit && from.grindValue !== undefined && from.gear?.some((g) => g.id === grinder.id)) return from.grindValue;
    return saved?.grindBy?.[`${grinder.id}:${grindUnit}`] ?? GRIND_RULES[grindUnit].def;
  };
  const [grindValue, setGrindValue] = useState<number | undefined>(grindStart);
  // grinder changed — use the grind remembered for it
  const grinderKey = `${grinder?.id}-${grindUnit}`;
  const firstGrinder = useRef(true);
  useEffect(() => {
    if (firstGrinder.current) { firstGrinder.current = false; return; }
    setGrindValue(grindStart());
  }, [grinderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const drip = m.id === 'drip';
  const [bean, setBean] = useState<string | null>(() => {
    const ok = (id?: string | null) => !!id && beans.some((b) => b.id === id && isDrip(b) === drip);
    if (ok(beanId)) return beanId!;
    if (ok(from?.beanId)) return from!.beanId;
    const pool = beans.filter((b) => isDrip(b) === drip && !b.finished && beanStock(b, brews).left !== 0);
    return pool.find((b) => !b.sample)?.id ?? pool[0]?.id ?? (drip ? null : beans.find((b) => !isDrip(b))?.id ?? null);
  });
  const [dripId, setDripId] = useState<string | undefined>(() => {
    const box = beans.find((b) => b.id === bean);
    if (!box?.assorted) return undefined;
    if (from?.dripId && box.drips?.some((d) => d.id === from.dripId)) return from.dripId;
    return (box.drips ?? []).find((d) => dripItemLeft(box, d.id, brews) > 0)?.id ?? box.drips?.[0]?.id;
  });
  // for a drip the dose is the coffee in the bag
  const dripBox = drip ? beans.find((b) => b.id === bean) : undefined;
  useEffect(() => {
    if (dripBox?.dripWeight) setDose(dripBox.dripWeight);
  }, [dripBox?.id, dripBox?.dripWeight]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (r: { dose: number; ratio: number; temp: number; grind: string }) => {
    setDose(r.dose); setRatio(r.ratio); setTemp(r.temp); setGrind(r.grind);
  };
  // Recipe changed in the editor — pick up the new parameters
  const activeJson = active ? JSON.stringify(active) : '';
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (active) apply(active);
  }, [activeJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select a just-created recipe right away
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!known.current) return;
    const fresh = mine.find((r) => !known.current!.has(r.id));
    if (fresh) { known.current = null; setChoice(fresh.id); apply(fresh); }
  }, [custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRecipe = () => {
    known.current = new Set(custom.map((r) => r.id));
    const steps = plan.steps.map((st) => ({ ...st }));
    push({ name: 'recipeEdit', isNew: true, recipe: recipeFromStandard(m.id, uid(), { dose, ratio, temp, grind, steps, total: plan.total, name: choice === 'std' ? `Мой ${m.name}` : `${plan.name} (копия)` }) });
  };
  const editRecipe = () => {
    if (active) push({ name: 'recipeEdit', isNew: false, recipe: active });
    else createRecipe();
  };

  // On repeat the beans are the same as last time; the picker opens with "Сменить"
  const [changeBean, setChangeBean] = useState(false);
  const beanObj = beans.find((x) => x.id === bean);
  const beanSt = beanObj ? beanStock(beanObj, brews) : null;
  // grinder loss: the pack gives dose + loss, the brewer gets the dose (not for drips and cupping)
  const loss = !drip && m.id !== 'cupping' ? grinder?.loss ?? 0 : 0;
  const fromPack = Math.round((dose + loss) * 10) / 10;
  const lowStock = !drip && beanSt && beanSt.total > 0 && beanSt.left < fromPack ? beanSt : null;
  const dripLeft = drip && beanObj ? (beanObj.assorted && dripId ? dripItemLeft(beanObj, dripId, brews) : beanSt?.total ? beanSt.left : null) : null;

  const water = Math.round(dose * ratio * (m.id === 'espresso' ? 10 : 1)) / (m.id === 'espresso' ? 10 : 1);
  const waterLabel = m.yieldLabel ?? 'Вода';
  const espresso = m.id === 'espresso';

  // coffee / water / ratio: one of them is locked, the other two move each other (see data/ratio.ts)
  const [lock, setLock] = useState<Lock>(() => loadLock(m.id));
  const change = (field: Lock, value: number) => {
    const next = solve({ dose, ratio }, field, value, lock, m.id === 'cupping' ? 0.25 : 0.1);
    if (!next) return;
    setDose(Math.min(100, Math.max(1, next.dose))); setRatio(Math.min(25, Math.max(1, next.ratio)));
  };
  const lockFor = (field: Lock): StepperLock => ({
    on: lock === field,
    onToggle: () => { setLock(field); saveLock(m.id, field); toast(LOCKED_TEXT[field]); },
    onLockedTap: () => toast(`${LOCKED_TEXT[field]} — чтобы менять, закрепите другой параметр`),
  });

  const draft = (): Brew => ({
    id: uid(), date: Date.now(), methodId: m.id, beanId: bean, dose, water, temp, grind: drip ? '' : grindUnit && grindValue !== undefined ? fmtGrind(grindValue, grindUnit) : grind, time: plan.total,
    ...(!drip && grindUnit && grindValue !== undefined ? { grindValue, grindUnit } : {}),
    ...(drip && dripId ? { dripId } : {}),
    ...(loss && bean ? { fromPack } : {}),
    ...(ppm > 0 ? { ppm } : {}),
    rating: 0, taste: { acidity: 3, sweetness: 3, bitterness: 2, body: 3 }, descriptors: [], notes: '',
    cupping: m.id === 'cupping' ? emptyCupping() : null,
    gear,
    plan: choice === 'std' ? undefined : plan,
  });

  const remember = () => {
    // the same water next time, on any method
    if (ppm > 0 && ppm !== profile.waterPpm) saveProfile({ ...profile, waterPpm: ppm });
    rememberRecipe();
  };
  const rememberRecipe = () => saveRecipe(m.id, {
    dose, ratio, temp, grind, gear: gear.map((g) => g.id), recipeId: active?.id,
    grindBy: grinder && grindUnit && grindValue !== undefined ? { ...(saved?.grindBy ?? {}), [`${grinder.id}:${grindUnit}`]: grindValue } : saved?.grindBy,
  });

  return (
    <Screen title={m.name} subtitle={choice === 'std' ? 'Стандартный рецепт' : `Рецепт: ${plan.name}${active?.author ? ` · от ${active.author.name || '@' + active.author.username}` : ''}`}
      footer={
        <div className="footer-actions">
          <Button kind="secondary" disabled={drip && !bean} onClick={() => { remember(); push({ name: 'brewEdit', draft: draft(), isNew: true }); }}>Без таймера</Button>
          <Button icon="play" wide disabled={drip && !bean} onClick={() => { remember(); push({ name: 'timer', draft: draft() }); }}>Начать</Button>
        </div>
      }>
      <div className="method-hero">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={44} /></span>
        <dl className="recipe-sum">
          <div><dt>Кофе</dt><dd>{fmtNum(dose, 2)} г</dd></div>
          <div><dt>{waterLabel}</dt><dd>{fmtNum(water)} г</dd></div>
          <div><dt>Пропорция</dt><dd>{fmtRatio(ratio)}</dd></div>
          <div><dt>Время</dt><dd>{fmtTime(plan.total)}</dd></div>
        </dl>
      </div>

      {active?.notes && <p className="muted pad">{active.notes}</p>}

      <Section title={drip ? 'Дрип' : 'Зерно'} aside={from && !changeBean ? <button type="button" className="link-btn" onClick={() => setChangeBean(true)}>Сменить</button> : undefined} plain>
        {from && !changeBean ? (
          <div className="group">
            <Row label={beanObj ? brewBeanTitle({ beanId: bean, dripId }, beanObj) : drip ? 'Дрип не выбран' : 'Без зерна'}
              hint={beanObj ? [beanMeta(beanObj), beanSt?.total ? `осталось ${fmtNum(beanSt.left, 0)} из ${fmtNum(beanSt.total, 0)} ${beanSt.unit === 'pcs' ? 'шт' : 'г'}` : ''].filter(Boolean).join(' · ') : 'как в прошлый раз'}
              chevron={false} />
          </div>
        ) : drip ? (
          <DripPicker value={bean} dripId={dripId} onChange={(id, d) => { setBean(id); setDripId(d); }} />
        ) : (
          <BeanPicker value={bean} onChange={setBean} dose={dose} />
        )}
        {dripLeft === 0 && <p className="status warn pad">{beanObj?.assorted ? 'Таких дрипов в коробке не осталось' : 'В коробке не осталось дрипов'} — заварка всё равно запишется.</p>}
        {lowStock && <p className="status warn pad">В пачке осталось {fmtNum(lowStock.left, 0)} г — на эту заварку не хватит {fmtNum(dose - lowStock.left, 1)} г.</p>}
      </Section>

      <Section title="Параметры">
        {/* a drip's coffee is pre-measured in the bag — only water changes */}
        {!drip && <Stepper label="Кофе" value={dose} onChange={(v) => change('dose', v)} step={espresso ? 0.5 : m.id === 'cupping' ? 0.25 : 0.5} min={1} max={100} unit="г" format={(v) => fmtNum(v, 2)}
          lock={lockFor('dose')} />}
        {loss > 0 && <p className="muted pad small-note grind-loss">Из пачки {fmtNum(fromPack, 1)} г → в воронку {fmtNum(dose, 2)} г · потери кофемолки {fmtNum(loss, 1)} г</p>}
        <Stepper label={waterLabel} value={water} step={espresso ? 1 : 10} min={espresso ? 10 : 30} max={2000} unit="г"
          format={(v) => fmtNum(v)}
          onChange={(w) => (drip ? setRatio(Math.max(1, w / dose)) : change('water', w))} lock={drip ? undefined : lockFor('water')} />
        <Stepper label="Пропорция" value={ratio} step={espresso ? 0.1 : 0.5} min={1} max={25} format={fmtRatio}
          onChange={(r) => (drip ? setRatio(r) : change('ratio', r))} lock={drip ? undefined : lockFor('ratio')} />
        <Stepper label="Температура" value={temp} step={0.1} min={0} max={100} unit={temp ? '°C' : ''}
          format={(v) => (v === 0 ? 'холодная' : fmtNum(v))} onChange={setTemp} />
        {m.id !== 'cupping' && <PpmField value={ppm} onChange={setPpm} />}
        {!drip && <GrindField id="grind" unit={grindUnit} value={grindValue} text={grind} onValue={setGrindValue} onText={setGrind}
          grinderName={gear.find((g) => g.cat === 'grinder')?.name} />}
      </Section>

      <Section title="Оборудование" plain>
        <GearPicker methodId={m.id} value={gear} onChange={setGear} />
      </Section>

      <Section title={choice === 'std' ? 'Шаги' : `Шаги · ${plan.name}`} aside={
        <button type="button" className="link-btn" onClick={editRecipe}>{active ? 'Изменить' : 'Изменить под себя'}</button>
      }>
        <ol className={'steps-preview' + (plan.total >= 3600 ? ' long' : '')}>
          {plan.steps.map((s, i) => (
            <li key={i}>
              <time>{fmtTime(s.at)}</time>
              <div>
                <b>{s.title}</b>
                {s.to !== undefined && <span className="pour">до {fmtNum(water * s.to, 0)} г</span>}
                {s.hint && <p>{s.hint}</p>}
              </div>
            </li>
          ))}
          <li className="done"><time>{fmtTime(plan.total)}</time><div><b>Готово</b></div></li>
        </ol>
      </Section>

      <Section title="Если что-то не так">
        <ul className="tips">{m.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </Section>
    </Screen>
  );
}
