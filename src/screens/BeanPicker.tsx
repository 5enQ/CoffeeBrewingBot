import { useEffect, useRef } from 'react';
import { emptyBean, isDrip, useStore, type Bean } from '../data/store';
import { useRouter } from '../router';
import { Icon } from '../ui/icons';
import { platform } from '../platform';
import { beanTitle, blendSummary, dripMeta, dripTitle, RestBadge } from './beanUtils';
import { beanStock, dripItemLeft, isFinished } from '../data/stock';
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
      {beans.filter((b) => b.id === value || (!isDrip(b) && !isFinished(b, beanStock(b, brews)))).map((b) => {
        const st = beanStock(b, brews);
        return (
          <button type="button" key={b.id} className={'bean-pick' + (b.id === value ? ' on' : '')}
            onClick={() => { platform.haptic('select'); onChange(b.id); }}>
            <b>{beanTitle(b)}</b>
            <span>{b.isBlend ? `Бленд · ${blendSummary(b)}` : [b.country, b.process].filter(Boolean).join(' · ') || b.roaster || '—'}</span>
            {st.total > 0
              ? <span className={'pick-stock' + (dose && st.left < dose ? ' short' : '')}><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} />{fmtNum(st.left, 0)} из {fmtNum(st.total, 0)} г</span>
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

/** Новая коробка дрипов: тип уже выбран */
export const emptyDripBox = (): Bean => ({ ...emptyBean(), kind: 'drip', dripCount: 10, dripWeight: 11 });

/**
 * Выбор дрипа: только коробки дрипов с полки + «новый дрип».
 * В коробке-ассорти дальше выбирается конкретный дрип.
 */
export function DripPicker({ value, dripId, onChange }: {
  value: string | null; dripId?: string; onChange(beanId: string | null, dripId?: string): void;
}) {
  const { beans, brews } = useStore();
  const { push } = useRouter();
  const known = useRef<Set<string> | null>(null);
  const boxes = beans.filter((b) => isDrip(b) && (b.id === value || !isFinished(b, beanStock(b, brews))));
  const box = beans.find((b) => b.id === value && isDrip(b));

  const pick = (b: Bean) => {
    platform.haptic('select');
    if (!b.assorted) { onChange(b.id); return; }
    // в ассорти сразу выбираем первый вид, который ещё остался
    const first = (b.drips ?? []).find((d) => dripItemLeft(b, d.id, brews) > 0) ?? b.drips?.[0];
    onChange(b.id, first?.id);
  };

  useEffect(() => {
    if (!known.current) return;
    const fresh = beans.find((b) => !known.current!.has(b.id));
    if (fresh && isDrip(fresh)) { known.current = null; pick(fresh); }
  }, [beans]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = (scan: boolean) => {
    known.current = new Set(beans.map((b) => b.id));
    push({ name: 'beanEdit', bean: emptyDripBox(), isNew: true, scanOnOpen: scan });
  };

  return (
    <>
      <div className="bean-picker">
        <button type="button" className="bean-pick action" onClick={() => create(true)}>
          <Icon name="scan" /><span>Скан коробки</span>
        </button>
        <button type="button" className="bean-pick action" onClick={() => create(false)}>
          <Icon name="plus" /><span>Новый дрип</span>
        </button>
        {boxes.map((b) => {
          const st = beanStock(b, brews);
          return (
            <button type="button" key={b.id} className={'bean-pick' + (b.id === value ? ' on' : '')} onClick={() => pick(b)}>
              <b>{beanTitle(b)}</b>
              <span>{b.assorted ? `Ассорти · ${(b.drips ?? []).length} вид.` : [b.country, b.process].filter(Boolean).join(' · ') || b.roaster || '—'}</span>
              {st.total > 0
                ? <span className={'pick-stock' + (st.left < 1 ? ' short' : '')}><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} />{st.left} из {st.total} шт</span>
                : <RestBadge roastDate={b.roastDate} />}
            </button>
          );
        })}
      </div>
      {boxes.length === 0 && <p className="muted pad small-note">На полке пока нет дрипов — добавьте коробку или один дрип.</p>}
      {box?.assorted && (
        <div className="drip-items" role="radiogroup" aria-label="Какой дрип из коробки">
          {(box.drips ?? []).map((d) => {
            const left = dripItemLeft(box, d.id, brews);
            return (
              <button type="button" key={d.id} role="radio" aria-checked={d.id === dripId}
                className={'drip-item' + (d.id === dripId ? ' on' : '') + (left === 0 ? ' out' : '')}
                onClick={() => { platform.haptic('select'); onChange(box.id, d.id); }}>
                <b>{dripTitle(d)}</b>
                <span>{dripMeta(d) || d.notes || '—'}</span>
                <small>{left ? `осталось ${left} из ${d.count}` : 'закончились'}</small>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
