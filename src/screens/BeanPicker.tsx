import { useEffect, useRef } from 'react';
import { emptyBean, useStore } from '../data/store';
import { useRouter } from '../router';
import { Icon } from '../ui/icons';
import { platform } from '../platform';
import { beanTitle, blendSummary, RestBadge } from './beanUtils';
import { beanStock, isFinished } from '../data/stock';
import { fmtNum } from '../data/methods';

/** Горизонтальный выбор зерна + «новое» и «сканировать» */
export function BeanPicker({ value, onChange, dose }: { value: string | null; onChange(id: string | null): void; dose?: number }) {
  const { beans, brews } = useStore();
  const { push } = useRouter();
  const known = useRef<Set<string> | null>(null);

  // после создания нового зерна — сразу выбрать его
  useEffect(() => {
    if (!known.current) return;
    const fresh = beans.find((b) => !known.current!.has(b.id));
    if (fresh) { known.current = null; onChange(fresh.id); }
  }, [beans, onChange]);

  const create = (scan: boolean) => {
    known.current = new Set(beans.map((b) => b.id));
    push({ name: 'beanEdit', bean: emptyBean(), isNew: true, scanOnOpen: scan });
  };

  return (
    <div className="bean-picker">
      <button type="button" className="bean-pick action" onClick={() => create(true)}>
        <Icon name="scan" /><span>Скан пачки</span>
      </button>
      <button type="button" className="bean-pick action" onClick={() => create(false)}>
        <Icon name="plus" /><span>Новое</span>
      </button>
      {beans.filter((b) => b.id === value || !isFinished(b, beanStock(b, brews))).map((b) => {
        const st = beanStock(b, brews);
        return (
          <button type="button" key={b.id} className={'bean-pick' + (b.id === value ? ' on' : '')}
            onClick={() => { platform.haptic('select'); onChange(b.id); }}>
            <b>{beanTitle(b)}</b>
            <span>{b.isBlend ? `Бленд · ${blendSummary(b)}` : [b.country, b.process].filter(Boolean).join(' · ') || b.roaster || '—'}</span>
            {st.total > 0
              ? <span className={'pick-stock' + (dose && st.left < dose ? ' short' : '')}><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} />{fmtNum(st.left, 0)} из {fmtNum(st.total, 0)} г</span>
              : <RestBadge roastDate={b.roastDate} />}
          </button>
        );
      })}
      <button type="button" className={'bean-pick' + (value === null ? ' on' : '')} onClick={() => onChange(null)}>
        <b>Без зерна</b><span>не привязывать</span>
      </button>
    </div>
  );
}
