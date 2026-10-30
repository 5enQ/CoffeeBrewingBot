import { useEffect, useRef, useState } from 'react';
import { GEAR_CATS, catsForMethod, type GearCat, type GearRef } from '../data/gear';
import { useStore, uid } from '../data/store';
import { platform } from '../platform';
import { useRouter } from '../router';
import { Icon } from './icons';

/** Gear picker for a brew: one item per category */
export function GearPicker({ methodId, value, onChange }: { methodId: string; value: GearRef[]; onChange(v: GearRef[]): void }) {
  const { gear } = useStore();
  const { push } = useRouter();
  const [all, setAll] = useState(false);
  const known = useRef<Set<string> | null>(null);

  // select a freshly added item right away
  useEffect(() => {
    if (!known.current) return;
    const fresh = gear.find((g) => !known.current!.has(g.id));
    if (!fresh) return;
    known.current = null;
    onChange([...value.filter((v) => v.cat !== fresh.cat), { id: fresh.id, cat: fresh.cat, name: fresh.name, details: fresh.details || undefined }]);
  }, [gear]); // eslint-disable-line react-hooks/exhaustive-deps

  const relevant = catsForMethod(methodId);
  const owned = new Set(gear.map((g) => g.cat));
  const cats = GEAR_CATS.filter((c) => (all ? owned.has(c.id) || relevant.includes(c.id) : relevant.includes(c.id)));
  const extra = GEAR_CATS.some((c) => !relevant.includes(c.id) && owned.has(c.id));

  const toggle = (cat: GearCat, id: string) => {
    platform.haptic('select');
    const rest = value.filter((v) => v.cat !== cat);
    const picked = value.find((v) => v.id === id);
    const g = gear.find((x) => x.id === id)!;
    onChange(picked ? rest : [...rest, { id: g.id, cat: g.cat, name: g.name, details: g.details || undefined }]);
  };

  const add = (cat: GearCat) => { known.current = new Set(gear.map((g) => g.id)); push({ name: 'gearEdit', gear: { id: uid(), cat, name: '', details: '' }, isNew: true }); };

  return (
    <div className="group gear-picker">
      {cats.map((c) => {
        const items = gear.filter((g) => g.cat === c.id);
        return (
          <div className="gear-row" key={c.id}>
            <span className="gear-cat">{c.one}</span>
            <div className="gear-items">
              {items.map((g) => (
                <button type="button" key={g.id} className={'chip' + (value.some((v) => v.id === g.id) ? ' on' : '')} onClick={() => toggle(c.id, g.id)}>
                  {g.name}
                </button>
              ))}
              <button type="button" className="chip chip-add" onClick={() => add(c.id)} aria-label={`Добавить: ${c.one}`}>
                <Icon name="plus" size={16} />{items.length ? '' : <span>Добавить</span>}
              </button>
            </div>
          </div>
        );
      })}
      {extra && (
        <button type="button" className="gear-more" onClick={() => setAll((a) => !a)}>
          {all ? 'Только нужное для метода' : 'Показать всё оборудование'}
        </button>
      )}
    </div>
  );
}

/** Default gear: from the last brew with this method, otherwise the first item of each needed category */
export function defaultGear(methodId: string, gear: { id: string; cat: GearCat; name: string; details: string }[], remembered?: string[]): GearRef[] {
  const cats = catsForMethod(methodId);
  // retired categories (filters) are not carried into new brews
  const offered = new Set(GEAR_CATS.map((c) => c.id));
  const pick = (ids: string[]) => ids.map((id) => gear.find((g) => g.id === id && offered.has(g.cat))).filter(Boolean) as typeof gear;
  const chosen = remembered ? pick(remembered) : cats.map((c) => gear.find((g) => g.cat === c)).filter(Boolean) as typeof gear;
  return chosen.map((g) => ({ id: g.id, cat: g.cat, name: g.name, details: g.details || undefined }));
}
