import { useRef, useState } from 'react';
import { ICON_CHOICES, fmtNum, fmtRatio, fmtTime, methodById, parseTime, type IconKey } from '../data/methods';
import { sortSteps, type CustomMethod, type CustomRecipe } from '../data/recipes';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { Icon, MethodIcon } from '../ui/icons';
import { type StepperLock, Button, Field, Screen, Section, Stepper } from '../ui/kit';
import { LOCKED_TEXT, loadLock, saveLock, solve, type Lock } from '../data/ratio';
import { toast } from '../ui/toast';

/** Step in the editor: time and grams as strings for easy typing */
interface DraftStep { key: string; at: string; title: string; grams: string; hint: string }

const parseNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
};
let k = 0;
const key = () => `s${++k}`;

interface MethodMeta { icon: IconKey; about: string; createdAt: number }

/** Custom method editor — the same editor as for recipes, plus icon and description */
export function MethodEdit({ method, isNew }: { method: CustomMethod; isNew: boolean }) {
  const recipe: CustomRecipe = {
    id: method.id, methodId: method.id, name: method.name, dose: method.dose, ratio: method.ratio, temp: method.temp,
    grind: method.grind, total: method.total, steps: method.steps, notes: method.tips.join('\n'), createdAt: method.createdAt,
  };
  return <RecipeEdit recipe={recipe} isNew={isNew} asMethod={{ icon: method.icon, about: method.about, createdAt: method.createdAt }} />;
}

export function RecipeEdit({ recipe: initial, isNew, asMethod }: { recipe: CustomRecipe; isNew: boolean; asMethod?: MethodMeta }) {
  const { saveCustom, deleteCustom, saveMethod } = useStore();
  const [meta, setMeta] = useState<MethodMeta | undefined>(asMethod);
  const kind = asMethod ? 'метод' : 'рецепт';
  const { back } = useRouter();
  const m = methodById(initial.methodId);
  const espresso = m.id === 'espresso';
  const initWater = initial.dose * initial.ratio;

  const [r, setR] = useState<CustomRecipe>(initial);
  const [totalText, setTotalText] = useState(fmtTime(initial.total));
  const [steps, setSteps] = useState<DraftStep[]>(() => initial.steps.map((s) => ({
    key: key(), at: fmtTime(s.at), title: s.title,
    grams: s.to !== undefined ? fmtNum(initWater * s.to, 0) : '', hint: s.hint ?? '',
  })));
  const [error, setError] = useState('');
  // Changes are detected by comparing with what was opened: revert — the button is disabled again
  const snap = () => JSON.stringify({ r, totalText, meta, steps: steps.map(({ key: _k, ...st }) => st) });
  const initialSnap = useRef<string | null>(null);
  if (initialSnap.current === null) initialSnap.current = snap();
  const dirty = isNew || snap() !== initialSnap.current;
  useBackGuard(dirty, isNew ? 'Не сохранять рецепт?' : 'Выйти без сохранения?');

  const water = Math.round(r.dose * r.ratio * (espresso ? 10 : 1)) / (espresso ? 10 : 1);
  const set = (patch: Partial<CustomRecipe>) => { setError(''); setR((x) => ({ ...x, ...patch })); };
  // coffee / water / ratio locks, as on the method screen
  const [lock, setLock] = useState<Lock>(() => loadLock(m.id));
  const change = (field: Lock, value: number) => {
    const next = solve({ dose: r.dose, ratio: r.ratio }, field, value, lock, 0.1);
    if (next) set({ dose: Math.min(100, Math.max(1, next.dose)), ratio: Math.min(25, Math.max(1, Math.round(next.ratio * 100) / 100)) });
  };
  const lockFor = (field: Lock): StepperLock => ({
    on: lock === field,
    onToggle: () => { setLock(field); saveLock(m.id, field); toast(LOCKED_TEXT[field]); },
    onLockedTap: () => toast(`${LOCKED_TEXT[field]} — чтобы менять, закрепите другой параметр`),
  });
  const setStep = (i: number, patch: Partial<DraftStep>) => { setError(''); setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s))); };

  const addStep = () => {
        platform.haptic('light');
    setSteps((list) => {
      const last = list[list.length - 1];
      const lastAt = last ? parseTime(last.at) ?? 0 : -30;
      return [...list, { key: key(), at: fmtTime(lastAt + 30), title: list.length ? 'Пролив' : 'Блуминг', grams: '', hint: '' }];
    });
  };
  const removeStep = (i: number) => { platform.haptic('light'); setSteps((list) => list.filter((_, j) => j !== i)); };

  const fail = (msg: string) => { platform.haptic('error'); setError(msg); };

  const save = () => {
    setError('');
    const parsed = [];
    for (const [i, s] of steps.entries()) {
      const at = parseTime(s.at);
      if (at === null) return fail(`Шаг ${i + 1}: время в формате мин:сек, например 1:30 (или ч:мм:сс)`);
      const g = s.grams.trim() ? parseNum(s.grams) : null;
      if (s.grams.trim() && (g === null || g < 0)) return fail(`Шаг ${i + 1}: граммы — число, например 150`);
      parsed.push({ at, title: s.title.trim() || 'Шаг', to: g !== null ? Math.min(1.5, g / water) : undefined, hint: s.hint.trim() || undefined });
    }
    if (!parsed.length) return fail('Добавьте хотя бы один шаг');
    const total = parseTime(totalText);
    if (total === null || total <= 0) return fail('Время до готовности — в формате мин:сек');
    const sorted = sortSteps(parsed);
    if (total < sorted[sorted.length - 1].at) return fail('Время до готовности не может быть раньше последнего шага');
    if (meta) {
      saveMethod({
        id: r.methodId, name: r.name.trim() || 'Мой метод', about: meta.about.trim(), icon: meta.icon,
        dose: r.dose, ratio: r.ratio, temp: r.temp, grind: r.grind, total, steps: sorted,
        tips: r.notes.split('\n').map((t) => t.trim()).filter(Boolean), createdAt: meta.createdAt,
      });
    } else {
      saveCustom({ ...r, name: r.name.trim() || `Мой ${m.name}`, total, steps: sorted });
    }
    platform.haptic('success');
    back(true);
  };

  const remove = async () => {
    if (!(await platform.confirm(`Удалить ${kind} «${r.name}»? Заварки останутся в дневнике.`))) return;
    if (meta) {
      // the method is not erased completely — old brews remember it; it is only removed from the list
      saveMethod({
        id: r.methodId, name: r.name, about: meta.about, icon: meta.icon, dose: r.dose, ratio: r.ratio, temp: r.temp,
        grind: r.grind, total: r.total, steps: r.steps, tips: [], createdAt: meta.createdAt, archived: true,
      });
    } else deleteCustom(r.id);
    back(true);
  };

  return (
    <Screen title={isNew ? (meta ? 'Новый метод' : 'Новый рецепт') : (meta ? 'Свой метод' : 'Рецепт')}
      subtitle={meta ? 'Метод заваривания: название, значок, базовый рецепт и шаги' : m.name}
      footer={<>{error && <p className="error footer-error">{error}</p>}<div className="footer-actions">
        {!isNew && <button type="button" className="round-btn" onClick={remove} aria-label={`Удалить ${kind}`}><Icon name="trash" /></button>}
        <Button icon="check" wide onClick={save} disabled={!dirty}>{isNew ? `Сохранить ${kind}` : dirty ? 'Сохранить изменения' : 'Изменений нет'}</Button>
      </div></>}>

      <div className="method-hero">
        <span className="method-hero-icon"><MethodIcon icon={meta?.icon ?? m.icon} size={40} /></span>
        <input id="recipe-name" className="recipe-name-input" value={r.name} placeholder={meta ? 'Название метода' : `Мой ${m.name}`}
          onChange={(e) => set({ name: e.target.value })} aria-label={meta ? 'Название метода' : 'Название рецепта'} />
      </div>
      {meta && (
        <>
          <Section title="Значок" plain>
            <div className="icon-pick">
              {ICON_CHOICES.map((ic) => (
                <button type="button" key={ic} className={'icon-pick-btn' + (meta.icon === ic ? ' on' : '')} aria-label={`Значок ${ic}`} aria-pressed={meta.icon === ic}
                  onClick={() => { platform.haptic('select'); setMeta({ ...meta, icon: ic }); }}>
                  <MethodIcon icon={ic} size={28} />
                </button>
              ))}
            </div>
          </Section>
          <Section>
            <Field label="Описание" id="method-about" value={meta.about} placeholder="Например: турка на песке, восточный кофе"
              onChange={(e) => { setError(''); setMeta({ ...meta, about: e.target.value }); }} />
          </Section>
        </>
      )}
      {r.author && <p className="muted pad">Рецепт от {r.author.name || '@' + r.author.username}. Можно менять под себя.</p>}

      <Section title="Параметры" aside={<span className="muted">{fmtNum(r.dose, 2)} г → {fmtNum(water)} г</span>}>
        <Stepper label="Кофе" value={r.dose} step={espresso ? 0.5 : 0.5} min={1} max={100} unit="г" format={(v) => fmtNum(v, 2)} onChange={(v) => change('dose', v)} lock={lockFor('dose')} />
        <Stepper label={m.yieldLabel ?? 'Вода'} value={water} step={espresso ? 1 : 10} min={5} max={2000} unit="г" format={(v) => fmtNum(v)}
          onChange={(w) => change('water', w)} lock={lockFor('water')} />
        <Stepper label="Пропорция" value={r.ratio} step={espresso ? 0.1 : 0.1} min={1} max={25} format={fmtRatio} onChange={(v) => change('ratio', v)} lock={lockFor('ratio')} />
        <Stepper label="Температура" value={r.temp} step={0.1} min={0} max={100} unit={r.temp ? '°C' : ''} format={(v) => (v ? fmtNum(v) : 'холодная')} onChange={(temp) => set({ temp })} />
        <Field label="Помол" id="recipe-grind" value={r.grind} onChange={(e) => set({ grind: e.target.value })} />
        <Field label="Готово к" id="recipe-total" value={totalText} inputMode="numeric" placeholder="3:30"
          onChange={(e) => { setError(''); setTotalText(e.target.value); }} />
      </Section>

      <Section title="Шаги" aside={<span className="muted">граммы — сколько всего на весах</span>} plain>
        <div className="step-editor">
          {steps.map((s, i) => (
            <div className="step-card" key={s.key}>
              <div className="step-card-top">
                <span className="step-num">{i + 1}</span>
                <input className="step-time" aria-label={`Шаг ${i + 1}: время`} inputMode="numeric" value={s.at} placeholder="0:45"
                  onChange={(e) => setStep(i, { at: e.target.value })} />
                <input className="step-title" aria-label={`Шаг ${i + 1}: название`} value={s.title} placeholder="Пролив"
                  onChange={(e) => setStep(i, { title: e.target.value })} />
                <button type="button" className="icon-btn" onClick={() => removeStep(i)} aria-label={`Удалить шаг ${i + 1}`}><Icon name="close" size={18} /></button>
              </div>
              <div className="step-card-row">
                <label className="step-grams">
                  <span>до</span>
                  <input aria-label={`Шаг ${i + 1}: граммы`} inputMode="decimal" value={s.grams} placeholder="—"
                    onChange={(e) => setStep(i, { grams: e.target.value })} />
                  <span>г</span>
                </label>
                <input className="step-hint" aria-label={`Шаг ${i + 1}: подсказка`} value={s.hint} placeholder="Подсказка: как лить, что сделать"
                  onChange={(e) => setStep(i, { hint: e.target.value })} />
              </div>
            </div>
          ))}
          <button type="button" className="add-step" onClick={addStep}><Icon name="plus" size={18} />Добавить шаг</button>
        </div>
      </Section>

      <Section title={meta ? 'Подсказки' : 'Заметки'}>
        <textarea id="recipe-notes" className="notes" rows={3} placeholder={meta ? 'Что делать, если кисло или горько — по строке на подсказку' : 'Вода, фильтр, для какого зерна рецепт'} value={r.notes}
          onChange={(e) => set({ notes: e.target.value })} />
      </Section>

    </Screen>
  );
}
