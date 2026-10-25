import { allMethods, methodById, fmtNum } from '../data/methods';
import { newCustomMethod } from '../data/recipes';
import { uid } from '../data/store';
import { Icon } from '../ui/icons';
import { useStore } from '../data/store';
import { useRouter, useSelected } from '../router';
import { MethodIcon } from '../ui/icons';
import { Row, Screen, Section } from '../ui/kit';
import { BrewScore } from '../ui/CuppingForm';
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
                hint={`${m.name}${b.plan ? ` · ${b.plan.name}` : ''} · ${fmtNum(b.dose, 2)} г → ${fmtNum(b.water)} г`}
                value={<BrewScore brew={b} size={14} />}
                onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}
                active={sel?.name === 'method' && sel.from?.id === b.id}
              />
            );
          })}
        </Section>
      )}

      <Section title="Метод приготовления" aside={
        <button type="button" className="icon-btn" aria-label="Свой метод"
          onClick={() => push({ name: 'methodEdit', isNew: true, method: newCustomMethod('cm' + uid()) })}><Icon name="plus" /></button>
      } plain>
        <div className="method-grid">
          {[...allMethods()].sort((x, y) => Number(x.id === 'cupping') - Number(y.id === 'cupping')).map((m) => (
            <button key={m.id} type="button" className={'method-card' + (m.id === 'cupping' ? ' wide' : '') + (((sel?.name === 'recipes') || (sel?.name === 'method' && !sel.from)) && sel.methodId === m.id ? ' active' : '')} onClick={() => push({ name: 'recipes', methodId: m.id })}>
              <span className="method-icon"><MethodIcon icon={m.icon} size={28} /></span>
              <span className="method-name">{m.name}{m.id === 'cupping' && <small>Протокол SCA CVA · до{'\u00a0'}6{'\u00a0'}образцов</small>}</span>
            </button>
          ))}
        </div>
      </Section>
    </Screen>
  );
}
