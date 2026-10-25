import { methodById, fmtNum, fmtRatio, fmtTime } from '../data/methods';
import { recipeFromStandard } from '../data/recipes';
import { useStore, uid } from '../data/store';
import { useRouter, useSelected } from '../router';
import { Icon, MethodIcon } from '../ui/icons';
import { Button, Screen, Section } from '../ui/kit';

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};

/** Шаг 1 заварки: выбор рецепта для метода. Дальше — зерно и параметры. */
export function RecipesScreen({ methodId, beanId }: { methodId: string; beanId?: string | null }) {
  const m = methodById(methodId);
  const { custom, recipes } = useStore();
  const { push } = useRouter();
  const sel = useSelected();
  const mine = custom.filter((r) => r.methodId === m.id);
  const last = recipes[m.id]?.recipeId ?? 'std';
  const open = (recipeId: string) => push({ name: 'method', methodId: m.id, beanId, recipeId });
  const isOpen = (id: string) => sel?.name === 'method' && sel.methodId === m.id && (sel.recipeId ?? 'std') === id;

  const card = (id: string, name: string, dose: number, ratio: number, total: number, steps: number, extra?: string) => (
    <button type="button" key={id} className={'recipe-tile' + (isOpen(id) ? ' active' : '')} onClick={() => open(id)}>
      <div className="recipe-tile-head">
        <b>{name}</b>
        {id === last && <span className="tag">в прошлый раз</span>}
      </div>
      <div className="recipe-tile-meta">
        <span>{fmtNum(dose, 2)} г → {fmtNum(m.id === 'espresso' ? dose * ratio : Math.round(dose * ratio))} г</span>
        <span>{fmtRatio(ratio)}</span>
        <span>{fmtTime(total)}</span>
        <span>{steps} {plural(steps, ['шаг', 'шага', 'шагов'])}</span>
      </div>
      {extra && <p>{extra}</p>}
      <span className="recipe-tile-go"><Icon name="chevron" size={18} /></span>
    </button>
  );

  return (
    <Screen title={m.name} subtitle="Выберите рецепт"
      footer={<div className="footer-actions">
        <Button kind="secondary" icon="plus" wide onClick={() => push({ name: 'recipeEdit', isNew: true, recipe: recipeFromStandard(m.id, uid()) })}>Свой рецепт</Button>
      </div>}>
      <div className="method-hero compact">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={36} /></span>
        <p className="muted">{m.about}</p>
      </div>

      <Section title="Рецепт" plain>
        <div className="recipe-tiles">
          {card('std', 'Стандартный', m.dose, m.ratio, m.total, m.steps.length, `${m.temp ? `${m.temp}°C` : 'холодная вода'} · помол ${m.grind}`)}
          {mine.map((r) => card(r.id, r.name, r.dose, r.ratio, r.total, r.steps.length,
            [r.author && `от ${r.author.name || '@' + r.author.username}`, r.notes].filter(Boolean).join(' · ') || undefined))}
        </div>
        {!mine.length && <p className="muted pad">Своих рецептов для {m.name} пока нет. Создайте свой — со своими проливами, граммами и временем.</p>}
      </Section>
    </Screen>
  );
}
