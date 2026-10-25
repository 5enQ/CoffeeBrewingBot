import { useState } from 'react';
import { methodById, fmtRatio, fmtTime, fmtNum } from '../data/methods';
import { emptyCupping } from '../data/cupping';
import { useStore, uid, type Brew } from '../data/store';
import { useRouter } from '../router';
import { MethodIcon } from '../ui/icons';
import { Button, Field, Screen, Section, Stepper } from '../ui/kit';
import { BeanPicker } from './BeanPicker';

export function MethodScreen({ methodId, beanId, from }: { methodId: string; beanId?: string | null; from?: Brew }) {
  const m = methodById(methodId);
  const { recipes, saveRecipe, beans } = useStore();
  const { push } = useRouter();
  const saved = recipes[m.id];

  const [dose, setDose] = useState(from?.dose ?? saved?.dose ?? m.dose);
  const [ratio, setRatio] = useState(from ? from.water / from.dose : saved?.ratio ?? m.ratio);
  const [temp, setTemp] = useState(from?.temp ?? saved?.temp ?? m.temp);
  const [grind, setGrind] = useState(from?.grind ?? saved?.grind ?? m.grind);
  const [bean, setBean] = useState<string | null>(beanId ?? from?.beanId ?? beans.find((b) => !b.sample)?.id ?? beans[0]?.id ?? null);

  const water = Math.round(dose * ratio * (m.id === 'espresso' ? 10 : 1)) / (m.id === 'espresso' ? 10 : 1);
  const waterLabel = m.yieldLabel ?? 'Вода';
  const espresso = m.id === 'espresso';

  const draft = (): Brew => ({
    id: uid(), date: Date.now(), methodId: m.id, beanId: bean, dose, water, temp, grind, time: m.total,
    rating: 0, taste: { acidity: 3, sweetness: 3, bitterness: 2, body: 3 }, descriptors: [], notes: '',
    cupping: m.id === 'cupping' ? emptyCupping() : null,
  });

  const remember = () => saveRecipe(m.id, { dose, ratio, temp, grind });

  return (
    <Screen title={m.name} subtitle={m.about}
      footer={
        <div className="footer-actions">
          <Button kind="secondary" onClick={() => { remember(); push({ name: 'brewEdit', draft: draft(), isNew: true }); }}>Без таймера</Button>
          <Button icon="play" wide onClick={() => { remember(); push({ name: 'timer', draft: draft() }); }}>Начать</Button>
        </div>
      }>
      <div className="method-hero">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={44} /></span>
        <dl className="recipe-sum">
          <div><dt>Кофе</dt><dd>{fmtNum(dose, 2)} г</dd></div>
          <div><dt>{waterLabel}</dt><dd>{fmtNum(water)} г</dd></div>
          <div><dt>Пропорция</dt><dd>{fmtRatio(ratio)}</dd></div>
          <div><dt>Время</dt><dd>{fmtTime(m.total)}</dd></div>
        </dl>
      </div>

      <Section title="Зерно" plain>
        <BeanPicker value={bean} onChange={setBean} />
      </Section>

      <Section title="Рецепт">
        <Stepper label="Кофе" value={dose} onChange={setDose} step={espresso ? 0.5 : m.id === 'cupping' ? 0.25 : 0.5} min={1} max={100} unit="г" format={(v) => fmtNum(v, 2)} />
        <Stepper label={waterLabel} value={water} step={espresso ? 1 : 10} min={espresso ? 10 : 30} max={2000} unit="г"
          format={(v) => fmtNum(v)}
          onChange={(w) => setDose(Math.max(1, Math.round((w / ratio) * 4) / 4))} />
        <Stepper label="Пропорция" value={ratio} step={espresso ? 0.1 : 0.5} min={1} max={25} format={fmtRatio}
          onChange={(r) => setRatio(r)} />
        <Stepper label="Температура" value={temp} step={1} min={0} max={100} unit={temp ? '°C' : ''}
          format={(v) => (v === 0 ? 'холодная' : String(v))} onChange={setTemp} />
        <Field label="Помол" id="grind" value={grind} onChange={(e) => setGrind(e.target.value)} placeholder="например, Comandante 22" />
      </Section>

      <Section title="Шаги">
        <ol className="steps-preview">
          {m.steps.map((s, i) => (
            <li key={i}>
              <time>{fmtTime(s.at)}</time>
              <div>
                <b>{s.title}</b>
                {s.to !== undefined && <span className="pour">до {fmtNum(water * s.to, 0)} г</span>}
                {s.hint && <p>{s.hint}</p>}
              </div>
            </li>
          ))}
          <li className="done"><time>{fmtTime(m.total)}</time><div><b>Готово</b></div></li>
        </ol>
      </Section>

      <Section title="Если что-то не так">
        <ul className="tips">{m.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </Section>
    </Screen>
  );
}
