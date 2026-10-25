import { METHODS, methodById, fmtRatio } from '../data/methods';
import { useStore } from '../data/store';
import { useRouter } from '../router';
import { MethodIcon } from '../ui/icons';
import { Row, Screen, Section, Stars } from '../ui/kit';
import { beanTitle } from './beanUtils';

export function BrewHome() {
  const { push } = useRouter();
  const { brews, beans, recipes } = useStore();
  const recent = brews.slice(0, 3);

  return (
    <Screen title="Что завариваем?" root>
      <div className="method-grid">
        {METHODS.map((m) => {
          const r = recipes[m.id];
          const dose = r?.dose ?? m.dose;
          const ratio = r?.ratio ?? m.ratio;
          return (
            <button key={m.id} type="button" className="method-card" onClick={() => push({ name: 'method', methodId: m.id })}>
              <span className="method-icon"><MethodIcon icon={m.icon} size={34} /></span>
              <span className="method-name">{m.name}</span>
              <span className="method-meta">{String(dose).replace('.', ',')} г · {fmtRatio(ratio)}</span>
            </button>
          );
        })}
      </div>

      {recent.length > 0 && (
        <Section title="Повторить">
          {recent.map((b) => {
            const m = methodById(b.methodId);
            const bean = beans.find((x) => x.id === b.beanId);
            return (
              <Row key={b.id}
                leading={<MethodIcon icon={m.icon} size={26} />}
                label={beanTitle(bean)}
                hint={`${m.name} · ${String(b.dose).replace('.', ',')} г → ${b.water} г`}
                value={<Stars value={b.rating} size={14} />}
                onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}
              />
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
