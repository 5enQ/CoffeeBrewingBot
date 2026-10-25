import { useEffect, useRef } from 'react';
import { emptyBean, useStore } from '../data/store';
import { useRouter } from '../router';
import { Icon } from '../ui/icons';
import { platform } from '../platform';
import { beanTitle, RestBadge } from './beanUtils';

/** Горизонтальный выбор зерна + «новое» и «сканировать» */
export function BeanPicker({ value, onChange }: { value: string | null; onChange(id: string | null): void }) {
  const { beans } = useStore();
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
      {beans.map((b) => (
        <button type="button" key={b.id} className={'bean-pick' + (b.id === value ? ' on' : '')}
          onClick={() => { platform.haptic('select'); onChange(b.id); }}>
          <b>{beanTitle(b)}</b>
          <span>{[b.country, b.process].filter(Boolean).join(' · ') || b.roaster || '—'}</span>
          <RestBadge roastDate={b.roastDate} />
        </button>
      ))}
      <button type="button" className={'bean-pick' + (value === null ? ' on' : '')} onClick={() => onChange(null)}>
        <b>Без зерна</b><span>не привязывать</span>
      </button>
    </div>
  );
}
