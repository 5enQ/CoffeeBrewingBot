import { METHODS, methodById, fmtNum } from '../data/methods';
import { useStore } from '../data/store';
import { useRouter, useSelected } from '../router';
import { MethodIcon } from '../ui/icons';
import { Row, Screen, Section, Stars } from '../ui/kit';
import { beanTitle } from './beanUtils';

export function BrewHome() {
  const { push } = useRouter();
  const { brews, beans } = useStore();
  const recent = brews.slice(0, 3);
  const sel = useSelected();

  return (
    <Screen title="Что завариваем?" root>
      {recent.length > 0 && (
        <Section title="Повторить">
          {recent.map((b) => {
            const m = methodById(b.methodId);
            const bean = beans.find((x) => x.id === b.beanId);
            return (
              <Row key={b.id}
                leading={<MethodIcon icon={m.icon} size={26} />}
                label={beanTitle(bean)}
                hint={`${m.name}${b.plan ? ` · ${b.plan.name}` : ''} · ${fmtNum(b.dose, 2)} г → ${fmtNum(b.water)} г`}
                value={<Stars value={b.rating} size={14} />}
                onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}
                active={sel?.name === 'method' && sel.from?.id === b.id}
              />
            );
          })}
        </Section>
      )}

      <Section title="Метод приготовления" plain>
        <div className="method-grid">
          {METHODS.map((m) => (
            <button key={m.id} type="button" className={'method-card' + (((sel?.name === 'recipes') || (sel?.name === 'method' && !sel.from)) && sel.methodId === m.id ? ' active' : '')} onClick={() => push({ name: 'recipes', methodId: m.id })}>
              <span className="method-icon"><MethodIcon icon={m.icon} size={28} /></span>
              <span className="method-name">{m.name}</span>
            </button>
          ))}
        </div>
      </Section>
    </Screen>
  );
}
