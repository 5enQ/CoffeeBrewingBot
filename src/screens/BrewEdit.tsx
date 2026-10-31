import { useEffect, useRef, useState } from 'react';
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
import { TdsField } from '../ui/TdsField';


export function BrewEdit({ draft, isNew, openCupping }: { draft: Brew; isNew: boolean; openCupping?: boolean }) {
  const { saveBrew, gear: myGear, brews } = useStore();
  const { setTab, push, back } = useRouter();
  const [b, setB] = useState<Brew>(draft);
  const [timeText, setTimeText] = useState(fmtTime(draft.time));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const cuppingRef = useRef<HTMLDivElement>(null);
  const m = methodById(b.methodId);
  const isCupping = b.methodId === 'cupping';
  const dirty = JSON.stringify(b) !== JSON.stringify(draft);

  useBackGuard(dirty || isNew, isNew ? 'Не сохранять эту заварку?' : 'Выйти без сохранения изменений?');

  useEffect(() => {
    if (openCupping) setTimeout(() => cuppingRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
  }, [openCupping]);

  const set = (patch: Partial<Brew>) => setB((x) => ({ ...x, ...patch }));
  const toggleDesc = (d: string) => set({ descriptors: b.descriptors.includes(d) ? b.descriptors.filter((x) => x !== d) : [...b.descriptors, d] });

  const save = () => {
    if (b.cva) {
      const toSave: Brew = { ...b, rating: 0, cupping: null, beanId: b.cva.samples[0]?.beanId ?? b.beanId };
      saveBrew(toSave);
      platform.haptic('success');
      if (isNew) { setTab('journal'); push({ name: 'brew', id: toSave.id, fresh: true }); }
      else back(true);
      return;
    }
    // only cupping is rated with the SCA form; other methods use stars
    const toSave: Brew = isCupping
      ? { ...b, rating: 0, cupping: { ...(b.cupping ?? emptyCupping()), descriptors: b.descriptors, notes: b.notes } }
      : { ...b, cupping: null };
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
      <Screen title={isNew ? 'Оценка каппинга' : 'Редактировать каппинг'} subtitle={`${MODES.find((x) => x.id === cva.mode)?.label} · ${new Date(b.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
        footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={!isNew && !dirty}>Сохранить</Button></div>}>
        <CvaEditor value={cva} onChange={(v) => set({ cva: v })} />

        <Section title="Цель и заметки">
          <Field label="Цель сессии" id="cva-purpose" value={cva.purpose} placeholder="например, выбор лота"
            onChange={(e) => set({ cva: { ...cva, purpose: e.target.value } })} />
          <textarea id="brew-notes" className="notes" rows={3} value={b.notes} placeholder="Общие заметки о сессии"
            onChange={(e) => set({ notes: e.target.value })} />
        </Section>

        <Section title="Параметры по протоколу" aside={<span className="lock-tag">не меняются</span>}>
          <dl className="rules compact">
            <div><dt>Доза</dt><dd><b>{fmtNum(b.dose, 1)} г на чашку</b></dd></div>
            <div><dt>Вода</dt><dd><b>{b.water} мл · {fmtNum(b.temp)} °C</b></dd></div>
            <div><dt>Чашек</dt><dd><b>{cva.cups} на образец · {cva.samples.length} обр.</b></dd></div>
            <div><dt>Помол</dt><dd><b>{b.grind}</b></dd></div>
          </dl>
        </Section>

        <Section title="Оборудование" plain>
          <GearPicker methodId="cupping" value={b.gear ?? []} onChange={(gear) => set({ gear })} />
        </Section>
      </Screen>
    );
  }

  return (
    <Screen title={isNew ? 'Как получилось?' : 'Редактировать'} subtitle={`${m.name} · ${new Date(b.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={!isNew && !dirty}>Сохранить</Button></div>}>

      {!isCupping && (
        <Section title="Оценка" plain>
          <div className="rating-card">
            <Stars value={b.rating} onChange={(rating) => set({ rating })} size={36} />
            <span>{ratingLabel(b.rating)}</span>
          </div>
        </Section>
      )}

      <Section title="Вкус">
        <Dots label="Кислотность" left="плоско" right="ярко" value={b.taste.acidity} onChange={(v) => set({ taste: { ...b.taste, acidity: v } })} />
        <Dots label="Сладость" left="нет" right="много" value={b.taste.sweetness} onChange={(v) => set({ taste: { ...b.taste, sweetness: v } })} />
        <Dots label="Горечь" left="нет" right="сильная" value={b.taste.bitterness} onChange={(v) => set({ taste: { ...b.taste, bitterness: v } })} />
        <Dots label="Тело" left="водянистое" right="плотное" value={b.taste.body} onChange={(v) => set({ taste: { ...b.taste, body: v } })} />
      </Section>

      <Section title="Дескрипторы" aside={b.descriptors.length ? <span className="count">{b.descriptors.length}</span> : undefined} plain>
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

      <Section title="Заметки">
        <textarea id="brew-notes" className="notes" rows={3} value={b.notes} placeholder="Что изменить в следующий раз?"
          onChange={(e) => set({ notes: e.target.value })} />
      </Section>

      {b.methodId === 'drip' ? (
        <Section title="Дрип" plain>
          <DripPicker value={b.beanId} dripId={b.dripId} onChange={(beanId, dripId) => set({ beanId, dripId })} />
        </Section>
      ) : (
        <Section title="Зерно" plain>
          <BeanPicker value={b.beanId} onChange={(beanId) => set({ beanId, dripId: undefined })} />
        </Section>
      )}

      <Section title="Параметры" aside={<span className="muted">{fmtRatio(b.water / b.dose)}</span>}>
        <Field label="Метод" id="method">
          <select id="method" value={b.methodId} onChange={(e) => set({ methodId: e.target.value, plan: undefined, cupping: e.target.value === 'cupping' ? (b.cupping ?? emptyCupping()) : b.cupping })}>
            {allMethods().filter((x) => (x.id !== 'cupping' || isCupping) && (x.id === 'drip') === (b.methodId === 'drip')).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Stepper label="Кофе" value={b.dose} step={0.25} min={1} max={100} unit="г" format={(v) => String(v).replace('.', ',')}
          onChange={(dose) => set({ dose, fromPack: b.fromPack !== undefined ? Math.round((b.fromPack + dose - b.dose) * 10) / 10 : undefined })} />
        {/* what actually left the pack: dose + grinder loss; can be corrected for this brew */}
        {b.beanId && !b.dripId && !b.cva && b.methodId !== 'drip' && (
          <Stepper label="Из пачки" value={b.fromPack ?? b.dose} step={0.1} min={b.dose} max={b.dose + 20} unit="г" format={(v) => String(Math.round(v * 10) / 10).replace('.', ',')}
            onChange={(v) => { const r = Math.round(v * 10) / 10; set({ fromPack: r > b.dose ? r : undefined }); }} />
        )}
        <Stepper label={m.yieldLabel ?? 'Вода'} value={b.water} step={b.methodId === 'espresso' ? 1 : 5} min={5} max={2000} unit="г" onChange={(water) => set({ water })} />
        <Stepper label="Температура" value={b.temp} step={0.1} min={0} max={100} unit={b.temp ? '°C' : ''} format={(v) => (v ? fmtNum(v) : 'холодная')} onChange={(temp) => set({ temp })} />
        <TdsField value={b.tds ?? 0} onChange={(v) => set({ tds: v > 0 ? v : undefined })} />
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
        <Field label="Время" id="edit-time" value={timeText} inputMode="numeric" placeholder="3:10"
          onChange={(e) => { setTimeText(e.target.value); const t = parseTime(e.target.value); if (t !== null) set({ time: t }); }} />
      </Section>

      <Section title="Оборудование" plain>
        <GearPicker methodId={b.methodId} value={b.gear ?? []} onChange={(gear) => set({ gear })} />
      </Section>

      <div ref={cuppingRef}>
        {isCupping && (
          <Section title="Каппинг-анкета SCA" plain>
            <CuppingForm value={b.cupping ?? emptyCupping()} onChange={(cupping) => set({ cupping })} />
          </Section>
        )}
      </div>
    </Screen>
  );
}
