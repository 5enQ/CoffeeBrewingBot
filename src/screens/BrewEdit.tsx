import { useEffect, useRef, useState } from 'react';
import { FLAVOR_WHEEL, emptyCupping, toneOf } from '../data/cupping';
import { METHODS, methodById, fmtRatio, fmtTime, fmtNum } from '../data/methods';
import { useStore, type Brew } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { CuppingForm } from '../ui/CuppingForm';
import { Button, Chips, Dots, Field, Screen, Section, Stars, Stepper } from '../ui/kit';
import { BeanPicker } from './BeanPicker';
import { GearPicker } from '../ui/GearPicker';

function parseTime(s: string) {
  const m = s.trim().match(/^(\d+)(?::(\d{1,2}))?$/);
  if (!m) return null;
  return m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]);
}

export function BrewEdit({ draft, isNew, openCupping }: { draft: Brew; isNew: boolean; openCupping?: boolean }) {
  const { saveBrew } = useStore();
  const { setTab, push, back } = useRouter();
  const [b, setB] = useState<Brew>(draft);
  const [timeText, setTimeText] = useState(fmtTime(draft.time));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const cuppingRef = useRef<HTMLDivElement>(null);
  const m = methodById(b.methodId);
  const dirty = JSON.stringify(b) !== JSON.stringify(draft);

  useBackGuard(dirty || isNew, isNew ? 'Не сохранять эту заварку?' : 'Выйти без сохранения изменений?');

  useEffect(() => {
    if (openCupping) setTimeout(() => cuppingRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
  }, [openCupping]);

  const set = (patch: Partial<Brew>) => setB((x) => ({ ...x, ...patch }));
  const toggleDesc = (d: string) => set({ descriptors: b.descriptors.includes(d) ? b.descriptors.filter((x) => x !== d) : [...b.descriptors, d] });

  const save = () => {
    const toSave: Brew = { ...b, cupping: b.cupping ? { ...b.cupping, descriptors: b.descriptors, notes: b.notes } : null };
    saveBrew(toSave);
    platform.haptic('success');
    if (isNew) { setTab('journal'); push({ name: 'brew', id: toSave.id }); }
    else back(true);
  };

  return (
    <Screen title={isNew ? 'Как получилось?' : 'Редактировать'} subtitle={`${m.name} · ${new Date(b.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save}>Сохранить</Button></div>}>

      <Section title="Оценка" plain>
        <div className="rating-card">
          <Stars value={b.rating} onChange={(rating) => set({ rating })} size={36} />
          <span>{['Не оценено', 'Не понравилось', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'][b.rating]}</span>
        </div>
      </Section>

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

      <Section title="Зерно" plain>
        <BeanPicker value={b.beanId} onChange={(beanId) => set({ beanId })} />
      </Section>

      <Section title="Параметры" aside={<span className="muted">{fmtRatio(b.water / b.dose)}</span>}>
        <Field label="Метод" id="method">
          <select id="method" value={b.methodId} onChange={(e) => set({ methodId: e.target.value, plan: undefined })}>
            {METHODS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Stepper label="Кофе" value={b.dose} step={0.25} min={1} max={100} unit="г" format={(v) => String(v).replace('.', ',')} onChange={(dose) => set({ dose })} />
        <Stepper label={m.yieldLabel ?? 'Вода'} value={b.water} step={b.methodId === 'espresso' ? 1 : 5} min={5} max={2000} unit="г" onChange={(water) => set({ water })} />
        <Stepper label="Температура" value={b.temp} step={0.1} min={0} max={100} unit={b.temp ? '°C' : ''} format={(v) => (v ? fmtNum(v) : 'холодная')} onChange={(temp) => set({ temp })} />
        <Field label="Помол" id="edit-grind" value={b.grind} onChange={(e) => set({ grind: e.target.value })} />
        <Field label="Время" id="edit-time" value={timeText} inputMode="numeric" placeholder="3:10"
          onChange={(e) => { setTimeText(e.target.value); const t = parseTime(e.target.value); if (t !== null) set({ time: t }); }} />
      </Section>

      <Section title="Оборудование" plain>
        <GearPicker methodId={b.methodId} value={b.gear ?? []} onChange={(gear) => set({ gear })} />
      </Section>

      <div ref={cuppingRef}>
        <Section title="Каппинг-анкета SCA" aside={
          <label className="switch">
            <input type="checkbox" id="cupping-toggle" checked={!!b.cupping} onChange={(e) => set({ cupping: e.target.checked ? emptyCupping() : null })} />
            <span />
          </label>} plain>
          {b.cupping
            ? <CuppingForm value={b.cupping} onChange={(cupping) => set({ cupping })} />
            : <p className="muted pad">Включите, чтобы оценить чашку по 100-балльной шкале: аромат, вкус, послевкусие, кислотность, тело, баланс, однородность, чистота, сладость.</p>}
        </Section>
      </div>
    </Screen>
  );
}
