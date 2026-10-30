/** Full-screen picker: roaster → their lots (beans or drips) → fills the pack. Data comes from the shared catalog. */
import { useEffect, useMemo, useState } from 'react';
import { fetchLots, fetchRoasters, STATE_LABEL, type Lot, type Roaster } from '../data/lookup';
import { platform } from '../platform';
import { useRouter } from '../router';
import { Icon } from './icons';
import { Segmented } from './kit';

type Kind = 'beans' | 'drip';
const lotsCache = new Map<string, Lot[]>();
let roastersCache: Roaster[] | null = null;

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};

export function CatalogPicker({ kind: initialKind, kindLocked, onPick, onClose }: {
  kind: Kind; kindLocked?: boolean; onPick(lot: Lot, kind: Kind): void; onClose(): void;
}) {
  const [roasters, setRoasters] = useState<Roaster[] | null | 'error'>(roastersCache);
  const [host, setHost] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [lots, setLots] = useState<Lot[] | null | 'error'>(null);
  const [q, setQ] = useState('');
  const [showOld, setShowOld] = useState(false);

  useEffect(() => {
    if (roastersCache) return;
    fetchRoasters().then((r) => { if (r) roastersCache = r; setRoasters(r ?? 'error'); });
  }, []);

  useEffect(() => {
    if (!host) return;
    const key = `${host}|${kind}`;
    const cached = lotsCache.get(key);
    setLots(cached ?? null);
    if (cached) return;
    let live = true;
    fetchLots(host, kind).then((r) => { if (r) lotsCache.set(key, r); if (live) setLots(r ?? 'error'); });
    return () => { live = false; };
  }, [host, kind]);

  // the system "back" closes the picker step by step; on close it goes back to the router (the editor is a pushed screen)
  const { back } = useRouter();
  useEffect(() => {
    platform.setBackHandler(() => (host ? setHost(null) : onClose()));
  }, [host, onClose]);
  useEffect(() => () => platform.setBackHandler(() => back()), [back]);

  const filtered = useMemo(() => {
    if (!Array.isArray(lots)) return { live: [], old: [] };
    const needle = q.trim().toLowerCase();
    const hit = (l: Lot) => !needle || [l.coffee.name, l.coffee.country, l.coffee.region, l.coffee.process, l.coffee.variety, l.coffee.packNotes]
      .some((v) => v?.toLowerCase().includes(needle));
    const all = lots.filter(hit);
    return { live: all.filter((l) => l.state === 'active'), old: all.filter((l) => l.state !== 'active') };
  }, [lots, q]);

  const roaster = Array.isArray(roasters) ? roasters.find((r) => r.host === host) : undefined;
  const row = (l: Lot) => (
    <button type="button" key={l.id} className="row" onClick={() => { platform.haptic('select'); onPick(l, kind); }}>
      <span className="row-main">
        <span className="row-label">{l.coffee.name || l.coffee.country || 'Без названия'}</span>
        <span className="row-hint">{[l.coffee.country !== l.coffee.name?.split(' ')[0] ? l.coffee.country : '', l.coffee.process, kind === 'drip' && (l.coffee.dripCount || l.coffee.dripOptions?.length) ? `${l.coffee.dripCount ?? l.coffee.dripOptions!.join(' / ')} шт` : ''].filter(Boolean).join(' · ')}</span>
      </span>
      {STATE_LABEL[l.state] && <span className="tag">{STATE_LABEL[l.state]}</span>}
      <span className="row-chev"><Icon name="chevron" size={18} /></span>
    </button>
  );

  return (
    <div className="sheet" role="dialog" aria-label="Каталог обжарщиков">
      <header className="topbar">
        <button type="button" className="icon-btn back" onClick={() => (host ? setHost(null) : onClose())} aria-label={host ? 'К обжарщикам' : 'Закрыть'}>
          <Icon name={host ? 'back' : 'close'} />
        </button>
        <div className="topbar-text">
          <h1>{roaster?.roaster ?? 'Каталог обжарщиков'}</h1>
          <p>{host ? 'Выберите кофе' : 'Данные заполнятся сами — останется дата обжарки'}</p>
        </div>
      </header>
      <main className="content">
        {!host && (
          roasters === null ? <p className="muted pad">Загружаю…</p>
          : roasters === 'error' ? <p className="muted pad">Нет связи с сервером. Попробуйте позже или заполните вручную.</p>
          : !roasters.length ? <p className="muted pad">Каталог пока пуст.</p>
          : <section className="section"><div className="group">
              {roasters.map((r) => (
                <button type="button" key={r.host} className="row" onClick={() => { setHost(r.host); setQ(''); setShowOld(false); }}>
                  <span className="row-main">
                    <span className="row-label">{r.roaster}</span>
                    <span className="row-hint">{r.onSale} {plural(r.onSale, ['лот', 'лота', 'лотов'])} в продаже{r.drips ? ' · есть дрипы' : ''} · {r.host}</span>
                  </span>
                  <span className="row-chev"><Icon name="chevron" size={18} /></span>
                </button>
              ))}
            </div></section>
        )}
        {host && <>
          {!kindLocked && (
            <Segmented value={kind} onChange={(v) => setKind(v)} options={[{ value: 'beans', label: 'Зерно' }, { value: 'drip', label: 'Дрип-пакеты' }]} />
          )}
          <label className="search-field">
            <Icon name="search" size={20} />
            <input id="catalog-search" type="search" placeholder="Страна, название, обработка" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {lots === null ? <p className="muted pad">Загружаю…</p>
          : lots === 'error' ? <p className="muted pad">Нет связи с сервером.</p>
          : <>
              {/* searching shows old lots right away: an old pack in hand is a common reason to search */}
              {filtered.live.length > 0 && <section className="section"><div className="group">{filtered.live.map(row)}</div></section>}
              {!filtered.live.length && !filtered.old.length && (
                <p className="muted pad">{q ? 'Ничего не нашлось.' : kind === 'drip' ? 'Дрипов этого обжарщика в каталоге пока нет.' : 'Зерна этого обжарщика в каталоге пока нет.'}</p>
              )}
              {filtered.old.length > 0 && (
                <section className="section">
                  <button type="button" className="link-btn" onClick={() => setShowOld((v) => !v)}>
                    {showOld ? 'Скрыть' : 'Показать'} прошлые лоты и те, что закончились ({filtered.old.length})
                  </button>
                  {(showOld || q.trim()) && <div className="group">{filtered.old.map(row)}</div>}
                </section>
              )}
            </>}
        </>}
      </main>
    </div>
  );
}
