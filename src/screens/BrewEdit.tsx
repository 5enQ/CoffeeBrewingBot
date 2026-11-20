import { useEffect, useRef, useState } from 'react';
import { track } from '../data/track';
import { FLAVOR_WHEEL, emptyCupping, toneOf } from '../data/cupping';
import { allMethods, methodById, fmtRatio, fmtTime, fmtNum, parseTime } from '../data/methods';
import { useStore, type Brew } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { CuppingForm } from '../ui/CuppingForm';
import { Button, Chips, Dots, Field, Screen, Section, Stars, Stepper, ratingLabel } from '../ui/kit';
import { BeanPicker, DripPicker } from './BeanPicker';
import { GearPicker } from '../ui/GearPicker';
import { GRIND_RULES, fmtGrind, grinderOf, unitOf } from '../data/grind';
import { GrindField } from '../ui/GrindField';
import { CvaEditor } from '../ui/Cva';
import { MODES } from '../data/cva';
import { healthWarning } from '../data/health';
import { CupTdsField, PpmField } from '../ui/WaterFields';
import { intlLocale, tr } from '../i18n';


export function BrewEdit({ draft, isNew, openCupping, manual, saved }: { draft: Brew; isNew: boolean; openCupping?: boolean; manual?: boolean; saved?: boolean }) {
  const { saveBrew, gear: myGear, brews } = useStore();
  const { setTab, push, back } = useRouter();
  const [b, setB] = useState<Brew>(draft);
  const [timeText, setTimeText] = useState(fmtTime(draft.time));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const cuppingRef = useRef<HTMLDivElement>(null);
  const m = methodById(b.methodId);
  const isCupping = b.methodId === 'cupping';
  const dirty = JSON.stringify(b) !== JSON.stringify(draft);

  // after ✓ in the timer the brew is already in the journal (marked unrated): leaving keeps it, only unsaved changes are asked about
  useBackGuard(dirty || (isNew && !saved), saved ? tr('Выйти без оценки? Заварка уже в дневнике.') : isNew ? tr('Не сохранять эту заварку?') : tr('Выйти без сохранения изменений?'));

  useEffect(() => {
    if (openCupping) setTimeout(() => cuppingRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
  }, [openCupping]);

  const set = (patch: Partial<Brew>) => setB((x) => ({ ...x, ...patch }));
  const toggleDesc = (d: string) => set({ descriptors: b.descriptors.includes(d) ? b.descriptors.filter((x) => x !== d) : [...b.descriptors, d] });

  const save = () => {
    // saving here is the rating: the «не оценена» mark goes
    const { unrated: _u, ...rated } = b;
    if (rated.cva) {
      const toSave: Brew = { ...rated, rating: 0, cupping: null, beanId: rated.cva.samples[0]?.beanId ?? b.beanId };
      saveBrew(toSave);
    if (isNew && toSave.rating) track('brew.rated');
      if (isNew) track('cupping.save');
      platform.haptic('success');
      if (isNew) { setTab('journal'); push({ name: 'brew', id: toSave.id, fresh: true }); }
      else back(true);
      return;
    }
    // only cupping is rated with the SCA form; other methods use stars
    const toSave: Brew = isCupping
      ? { ...rated, rating: 0, cupping: { ...(b.cupping ?? emptyCupping()), descriptors: b.descriptors, notes: b.notes } }
      : { ...rated, cupping: null };
    const warn = isNew ? healthWarning(brews, toSave) : null;
    saveBrew(toSave);
    platform.haptic('success');
    if (warn) setTimeout(() => void platform.alert(warn), 400);
    if (isNew) { setTab('journal'); push({ name: 'brew', id: toSave.id, fresh: true }); }
    else back(true);
  };

  if (b.cva) {
    const cva = b.cva;
    return (
      <Screen title={isNew ? tr('Оценка каппинга') : tr('Редактировать каппинг')} subtitle={`${MODES.find((x) => x.id === cva.mode)?.label} · ${new Date(b.date).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
        footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={!isNew && !dirty && !draft.unrated}>{tr('Сохранить')}</Button></div>}>
        <CvaEditor value={cva} onChange={(v) => set({ cva: v })} />

        <Section title={tr('Цель и заметки')}>
          <Field label={tr('Цель сессии')} id="cva-purpose" value={cva.purpose} placeholder={tr('например, выбор лота')}
            onChange={(e) => set({ cva: { ...cva, purpose: e.target.value } })} />
          <textarea id="brew-notes" className="notes" rows={3} aria-label={tr('Заметки')} value={b.notes} placeholder={tr('Общие заметки о сессии')}
            onChange={(e) => set({ notes: e.target.value })} />
        </Section>

        <Section title={tr('Параметры по протоколу')} aside={<span className="lock-tag">{tr('не меняются')}</span>}>
          <dl className="rules compact">
            <div><dt>{tr('Доза')}</dt><dd><b>{tr('{0} г на чашку', fmtNum(b.dose, 1))}</b></dd></div>
            <div><dt>{tr('Вода')}</dt><dd><b>{tr('{0} мл · {1} °C', b.water, fmtNum(b.temp))}</b></dd></div>
            <div><dt>{tr('Чашек')}</dt><dd><b>{tr('{0} на образец · {1} обр.', cva.cups, cva.samples.length)}</b></dd></div>
            <div><dt>{tr('Помол')}</dt><dd><b>{b.grind}</b></dd></div>
          </dl>
        </Section>

        <Section title={tr('Оборудование')} plain>
          <GearPicker methodId="cupping" value={b.gear ?? []} onChange={(gear) => set({ gear })} />
        </Section>
      </Screen>
    );
  }

  // the coffee and the parameters: written down by hand they come first (nothing filled them in yet),
  // after the timer they are already right and wait below the tasting
  const setup = (
    <>
      {b.methodId === 'drip' ? (
        <Section title={tr('Дрип')} plain>
          <DripPicker value={b.beanId} dripId={b.dripId} onChange={(beanId, dripId) => set({ beanId, dripId })} />
        </Section>
      ) : (
        <Section title={tr('Зерно')} plain>
          <BeanPicker value={b.beanId} onChange={(beanId) => set({ beanId, dripId: undefined })} />
        </Section>
      )}

      <Section title={tr('Параметры')} aside={<span className="muted">{fmtRatio(b.water / b.dose)}</span>}>
        <Field label={tr('Метод')} id="method">
          <select id="method" value={b.methodId} onChange={(e) => set({ methodId: e.target.value, plan: undefined, cupping: e.target.value === 'cupping' ? (b.cupping ?? emptyCupping()) : b.cupping })}>
            {allMethods().filter((x) => (x.id !== 'cupping' || isCupping) && (x.id === 'drip') === (b.methodId === 'drip')).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Stepper label={tr('Кофе')} value={b.dose} step={0.25} min={1} max={100} unit={tr('г')} format={(v) => String(v).replace('.', ',')}
          onChange={(dose) => set({ dose, fromPack: b.fromPack !== undefined ? Math.round((b.fromPack + dose - b.dose) * 10) / 10 : undefined })} />
        {/* what actually left the pack: dose + grinder loss; can be corrected for this brew */}
        {b.beanId && !b.dripId && !b.cva && b.methodId !== 'drip' && (
          <Stepper label={tr('Из пачки')} value={b.fromPack ?? b.dose} step={0.1} min={b.dose} max={b.dose + 20} unit={tr('г')} format={(v) => String(Math.round(v * 10) / 10).replace('.', ',')}
            onChange={(v) => { const r = Math.round(v * 10) / 10; set({ fromPack: r > b.dose ? r : undefined }); }} />
        )}
        <Stepper label={m.yieldLabel ?? tr('Вода')} value={b.water} step={b.methodId === 'espresso' ? 1 : 5} min={5} max={2000} unit={tr('г')} onChange={(water) => set({ water })} />
        <Stepper label={tr('Температура')} value={b.temp} step={0.1} min={0} max={100} unit={b.temp ? '°C' : ''} format={(v) => (v ? fmtNum(v) : tr('холодная'))} onChange={(temp) => set({ temp })} />
        <PpmField value={b.ppm ?? 0} onChange={(v) => set({ ppm: v > 0 ? v : undefined })} />
        {b.methodId !== 'drip' && (() => {
          const grinder = grinderOf(b.gear, myGear);
          // grinder deleted — take the units from the brew itself
          const unit = unitOf(grinder?.type) ?? (grinder && !myGear.some((g) => g.id === grinder.id) ? b.grindUnit ?? null : null);
          const value = unit && b.grindUnit === unit ? b.grindValue : undefined;
          return (
            <GrindField id="edit-grind" unit={unit} value={value ?? (unit ? GRIND_RULES[unit].def : undefined)} text={b.grind}
              grinderName={b.gear?.find((g) => g.cat === 'grinder')?.name}
              onValue={(v) => set({ grindValue: v, grindUnit: unit!, grind: fmtGrind(v, unit!) })}
              onText={(t) => set({ grind: t, grindValue: undefined, grindUnit: undefined })} />
          );
        })()}
        <Field label={tr('Время')} id="edit-time" value={timeText} inputMode="numeric" placeholder="3:10"
          onChange={(e) => { setTimeText(e.target.value); const t = parseTime(e.target.value); if (t !== null) set({ time: t }); }} />
      </Section>
    </>
  );

  return (
    <Screen title={isNew ? tr('Как получилось?') : tr('Редактировать')} subtitle={`${m.name} · ${new Date(b.date).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={!isNew && !dirty && !draft.unrated}>{tr('Сохранить')}</Button></div>}>

      {manual && setup}

      {!isCupping && (
        <Section title={tr('Оценка')} plain>
          <div className="rating-card">
            <Stars value={b.rating} onChange={(rating) => set({ rating })} size={40} />
            <span>{ratingLabel(b.rating)}</span>
          </div>
        </Section>
      )}

      <Section title={tr('Вкус')}>
        <Dots label={tr('Кислотность')} left={tr('плоско')} right={tr('ярко')} value={b.taste.acidity} onChange={(v) => set({ taste: { ...b.taste, acidity: v } })} />
        <Dots label={tr('Сладость')} left={tr('нет')} right={tr('много')} value={b.taste.sweetness} onChange={(v) => set({ taste: { ...b.taste, sweetness: v } })} />
        <Dots label={tr('Горечь')} left={tr('нет')} right={tr('сильная')} value={b.taste.bitterness} onChange={(v) => set({ taste: { ...b.taste, bitterness: v } })} />
        <Dots label={tr('Тело')} left={tr('водянистое')} right={tr('плотное')} value={b.taste.body} onChange={(v) => set({ taste: { ...b.taste, body: v } })} />
      </Section>

      <Section title={tr('Дескрипторы')} aside={b.descriptors.length ? <span className="count">{b.descriptors.length}</span> : undefined} plain>
        {b.descriptors.length > 0 && (
          <div className="picked"><Chips options={b.descriptors} value={b.descriptors} onToggle={toggleDesc} toneOf={toneOf} /></div>
        )}
        <div className="wheel">
          {FLAVOR_WHEEL.map((g) => (
            <div key={g.group} className={'wheel-group' + (openGroup === g.group ? ' open' : '')} data-tone={g.tone}>
              <button type="button" className="wheel-head" onClick={() => setOpenGroup(openGroup === g.group ? null : g.group)} aria-expanded={openGroup === g.group}>
                <span className="swatch" />{g.group}
                {g.items.some((i) => b.descriptors.includes(i)) && <span className="count">{g.items.filter((i) => b.descriptors.includes(i)).length}</span>}
              </button>
              {openGroup === g.group && <Chips options={g.items} value={b.descriptors} onToggle={toggleDesc} toneOf={toneOf} />}
            </div>
          ))}
        </div>
      </Section>

      {/* the measurement after the taste words: most people describe the cup, fewer reach for a refractometer */
      }{!isCupping && (
        <Section title={tr('Измерения')}>
          <CupTdsField brew={b} onChange={(patch) => set(patch)} />
        </Section>
      )}

      <Section title={tr('Заметки')}>
        <textarea id="brew-notes" className="notes" rows={3} aria-label={tr('Заметки')} value={b.notes} placeholder={tr('Что изменить в следующий раз?')}
          onChange={(e) => set({ notes: e.target.value })} />
      </Section>

      {!manual && setup}

      <Section title={tr('Оборудование')} plain>
        <GearPicker methodId={b.methodId} value={b.gear ?? []} onChange={(gear) => set({ gear })} />
      </Section>

      <div ref={cuppingRef}>
        {isCupping && (
          <Section title={tr('Каппинг-анкета SCA')} plain>
            <CuppingForm value={b.cupping ?? emptyCupping()} onChange={(cupping) => set({ cupping })} />
          </Section>
        )}
      </div>
    </Screen>
  );
}
