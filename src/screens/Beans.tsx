import { AsciiStock, pack, useAscii } from '../ui/ascii';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { track } from '../data/track';
import { contributeCoffee, filledLabels, lookupCode, mergeEmpty } from '../data/lookup';
import { allMethods, methodById, fmtRatio, fmtNum } from '../data/methods';
import { beanSca, brewBeanIds } from '../data/cva';
import { emptyBean, isDrip, newDripItem, uid, useStore, type Bean, type BlendPart, type DripItem } from '../data/store';
import { beanStock, dripItemLeft, dripTotal, finishedOn, isFinished, PACK_SIZES } from '../data/stock';
import { platform } from '../platform';
import { useBackGuard, useRouter, useSelected } from '../router';
import { MethodIcon, Icon } from '../ui/icons';
import { toast } from '../ui/toast';
import { Button, Chips, Empty, Field, Row, SampleTag, ScaleDots, Screen, Section, Segmented, Stars } from '../ui/kit';
import { SCALES, hasScales } from '../data/scales';
import { Scanner } from '../ui/Scanner';
import { BrewScore } from '../ui/CuppingForm';
import { beanMeta, beanOrigin, beanTitle, blendLines, brewBeanTitle, dripMeta, dripTitle, PROCESSES, RestBadge, ROAST_LEVELS } from './beanUtils';
import { decSep, intlLocale, tr, trValue } from '../i18n';

/* ---------- Shelf ---------- */

/* ---------- Remaining stock as pictures ---------- */

const BEAN_PATH = 'M12 2.5c-4.2 0-7 4.3-7 9.5s2.8 9.5 7 9.5 7-4.3 7-9.5-2.8-9.5-7-9.5z';
const BEAN_SEAM = 'M12 3.5c-1.8 2.6-1.6 5.4 0 8.3s1.8 5.7 0 8.7';
const DRIP_PATH = 'M6 4.5h12V15l-6 5.5L6 15z';

function BeanIcon({ part }: { part: number }) {
  // part 0..1 — how much of the bean "remains": the last bean may be partly filled
  return (
    <span className="stock-ico">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ico-empty"><path d={BEAN_PATH} /><path d={BEAN_SEAM} className="seam" /></svg>
      {part > 0 && (
        <span className="ico-fill" style={{ width: `${Math.round(part * 100)}%` }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={BEAN_PATH} /><path d={BEAN_SEAM} className="seam" /></svg>
        </span>
      )}
    </span>
  );
}

function DripIcon({ on }: { on: boolean }) {
  return (
    <span className={'stock-ico drip' + (on ? ' on' : '')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6.5 3 9M18 6.5 21 9" className="ears" /><path d={DRIP_PATH} /><path d="M9 8.5h6" className="seam" /></svg>
    </span>
  );
}

/** What is left: beans (10 = full pack) or drawn drip bags (one per bag) */
function StockIcons({ unit, left, total }: { unit: 'g' | 'pcs'; left: number; total: number }) {
  const ascii = useAscii();
  if (ascii) return unit === 'pcs'
    ? <AsciiStock on={total <= 20 ? left : (left / total) * 20} of={Math.min(total, 20)} mark="#" />
    : <AsciiStock on={total ? (left / total) * 10 : 0} of={10} />;
  if (unit === 'pcs') {
    // more than 20 drips are not drawn one by one — split into 20 equal parts
    const n = Math.min(total, 20);
    const on = total <= 20 ? left : Math.round((left / total) * 20);
    return <div className="stock-icons" aria-hidden="true">{Array.from({ length: n }, (_, i) => <DripIcon key={i} on={i < on} />)}</div>;
  }
  const units = total ? (left / total) * 10 : 0;
  return <div className="stock-icons" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <BeanIcon key={i} part={Math.max(0, Math.min(1, units - i))} />)}</div>;
}

/** Pack stock: "N of M g left" with beans or drips instead of a bar */
export function StockBar({ bean, compact = false }: { bean: Bean; compact?: boolean }) {
  const { brews } = useStore();
  const st = beanStock(bean, brews);
  if (!st.total) return compact ? null : <span className="stock-none">{st.unit === 'pcs' ? tr('Сколько дрипов в коробке — не указано') : tr('Вес пачки не указан')}</span>;
  // finished packs — no pictures: no point drawing empty beans
  const done = isFinished(bean, st);
  if (st.unit === 'pcs') {
    return (
      <div className={'stock' + (compact ? ' compact' : '') + (st.left > 0 && st.left <= 2 ? ' low' : '') + (st.left <= 0 ? ' empty' : '')}>
        {!done && <StockIcons unit="pcs" left={st.left} total={st.total} />}
        <div className="stock-text">
          <span><b>{st.left}</b> {tr('из {0}', st.total)}{"\u00a0"}{plural(st.total, [tr('дрипа'), tr('дрипов'), tr('дрипов')])}</span>
          {/* «N из M дрипов» already says how many went; no separate «заварено N» */}
          {(st.left <= 0 || !st.used) && <span>{st.left <= 0 ? tr('закончились') : tr('ещё не заваривали')}</span>}
        </div>
      </div>
    );
  }
  const low = st.left > 0 && (st.brewsLeft !== null ? st.brewsLeft <= 2 : st.ratio < 0.15);
  return (
    <div className={'stock' + (compact ? ' compact' : '') + (low ? ' low' : '') + (st.left <= 0 ? ' empty' : '')}>
      {!done && <StockIcons unit="g" left={st.left} total={st.total} />}
      <div className="stock-text">
        <span><b>{fmtNum(st.left, 0)}</b> {tr('из {0} г', fmtNum(st.total, 0))}</span>
        <span>{st.left <= 0 ? tr('закончилось') : st.brewsLeft === 0 ? tr('меньше чем на заварку') : st.brewsLeft !== null ? `≈ ${st.brewsLeft} ${plural(st.brewsLeft, [tr('заварка'), tr('заварки'), tr('заварок')])}` : tr('ещё не заваривали')}</span>
      </div>
    </div>
  );
}

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};

function PackCard({ b, onClick }: { b: Bean; onClick(): void }) {
  const { brews } = useStore();
  const sel = useSelected();
  const ascii = useAscii();
  const active = (sel?.name === 'bean' && sel.id === b.id) || (sel?.name === 'beanEdit' && sel.bean.id === b.id);
  const mine = brews.filter((x) => brewBeanIds(x).includes(b.id));
  const rated = mine.filter((x) => x.rating);
  const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 0;
  // SCA scores matter more than stars: if the pack was cupped, show the average score
  const scores = mine.map((x) => beanSca(x, b.id)).filter((x): x is number => x !== null);
  const avgScore = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  return (
    <button type="button" className={'bean-card' + (active ? ' active' : '')} aria-current={active || undefined} onClick={onClick}>
      {ascii && <pre className="ascii-art ascii-pack" aria-hidden="true">{pack(b.country || b.parts?.[0]?.country || '')}</pre>}
      <div className="bean-card-top">
        <b>{beanTitle(b)}</b>
        {isDrip(b) && <span className="tag tag-drip">{tr('дрип')}</span>}
        {b.sample && <SampleTag />}
      </div>
      <span className="bean-card-origin">{beanMeta(b) || tr('Происхождение не указано')}</span>
      <StockBar bean={b} />
      <div className="bean-card-foot">
        <span className="one-line-text">{b.roaster || '—'}</span>
        <span className="foot-right"><RestBadge roastDate={b.roastDate} until={finishedOn(b, beanStock(b, brews), brews)} />{avgScore ? <span className="score-mini">{fmtNum(avgScore, 2)}</span> : avg ? <Stars value={Math.round(avg * 2) / 2} size={12} /> : null}</span>
      </div>
    </button>
  );
}

export function Beans() {
  const { beans, brews } = useStore();
  const { push } = useRouter();
  const [scan, setScan] = useState(false);
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);

  const onCode = async (code: string) => {
    setScan(false);
    track('pack.lookup');
    const r = await lookupCode(code, beans);
    if (r.kind === 'foreign') { toast(foreignNote(r.what)); return; }
    if (r.existing) push({ name: 'bean', id: r.existing.id });
    else push({ name: 'beanEdit', bean: mergeEmpty(emptyBean(), r.patch), isNew: true });
    if (r.kind === 'social') toast(SOCIAL_NOTE);
    if (r.kind === 'text') toast(textNote(!!r.patch.barcode));
  };

  const list = q
    ? beans.filter((b) => [b.name, b.roaster, b.country, b.region, b.process, b.variety, ...(b.parts ?? []).flatMap((p) => [p.country, p.region, p.process, p.variety])].join(' ').toLowerCase().includes(q.toLowerCase()))
    : beans;
  const active = list.filter((b) => !isFinished(b, beanStock(b, brews)));
  const done = list.filter((b) => isFinished(b, beanStock(b, brews)));
  const grams = active.filter((b) => !isDrip(b)).reduce((s, b) => s + beanStock(b, brews).left, 0);
  const packs = active.filter((b) => !isDrip(b)).length;
  const drips = active.filter(isDrip).reduce((s, b) => s + beanStock(b, brews).left, 0);
  const subtitle = [
    packs ? tr('{0} {1} · {2} кг кофе', packs, plural(packs, [tr('пачка'), tr('пачки'), tr('пачек')]), fmtNum(grams / 1000, 2)) : '',
    drips ? `${drips} ${plural(drips, [tr('дрип'), tr('дрипа'), tr('дрипов')])}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <Screen title={tr('Полка')} subtitle={subtitle || undefined} root
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: emptyBean(), isNew: true })} aria-label={tr('Добавить пачку')}><Icon name="plus" /></button>}>
      <button type="button" className="scan-cta" onClick={() => setScan(true)}>
        <Icon name="scan" size={28} />
        <span><b>{tr('Добавить пачку')}</b><small>{tr('Отсканируйте штрихкод или QR — или введите вручную')}</small></span>
      </button>

      {beans.length > 4 && (
        <input id="bean-search" className="search" type="search" aria-label={tr('Поиск по полке')} placeholder={tr('Поиск: страна, обработка, обжарщик')} value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {active.length === 0 && done.length === 0 && <Empty title={tr('Полка пуста')} text={tr('Купили кофе? Добавьте пачку с весом и датой обжарки — остаток будет считаться сам.')} />}
      {active.length === 0 && done.length > 0 && <Empty title={tr('Всё допито')} text={tr('На полке пусто. Добавьте новую пачку или купите ещё раз одну из допитых.')} />}

      <div className="bean-list">
        {active.map((b) => <PackCard key={b.id} b={b} onClick={() => push({ name: 'bean', id: b.id })} />)}
      </div>

      {done.length > 0 && (
        <Section title={tr('Допито · {0}', done.length)} aside={
          <button type="button" className="link-btn" onClick={() => setShowDone((v) => !v)}>{showDone ? tr('Скрыть') : tr('Показать')}</button>
        } plain>
          {showDone && <div className="bean-list done">{done.map((b) => <PackCard key={b.id} b={b} onClick={() => push({ name: 'bean', id: b.id })} />)}</div>}
        </Section>
      )}

      {scan && <Scanner onResult={onCode} onClose={() => setScan(false)} />}
    </Screen>
  );
}

/* ---------- Card ---------- */

/** The grid of methods over the footer, bottom-left at the round button; used with this coffee — tinted */
function MethodMenu({ anchor, used, methods, onPick, onClose }: {
  anchor: RefObject<HTMLButtonElement | null>; used: Set<string>; methods: ReturnType<typeof allMethods>;
  onPick(id: string): void; onClose(): void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; width: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const row = anchor.current?.closest('.footer-actions'), foot = anchor.current?.closest('.footer');
      if (!row || !foot) return;
      const r = row.getBoundingClientRect();
      setAt({ left: r.left, width: r.width, bottom: window.innerHeight - foot.getBoundingClientRect().top + 8 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);
  // focus goes into the menu once it stands in place (hidden until measured, it can't take focus before)
  useEffect(() => { if (at) box.current?.querySelector('button')?.focus({ preventScroll: true }); }, [!!at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="method-menu-shade" onClick={onClose} />
      <div ref={box} className="method-menu" role="dialog" aria-modal="true" aria-label={tr('Чем заварить')}
        style={at ? { left: at.left, width: at.width, bottom: at.bottom } : { visibility: 'hidden' }}
        // Tab past the last tile (or before the first) leaves the menu: it closes, nothing is left open behind
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && e.relatedTarget !== anchor.current) onClose(); }}>
        <p className="method-menu-note">{tr('Чем заварить')}{used.size ? tr(' · подсвечены те, что уже были с этим зерном') : ''}</p>
        <div className="quick-methods method-menu-grid">
          {methods.map((m) => (
            <button type="button" key={m.id} className={used.has(m.id) ? 'used' : undefined} onClick={() => onPick(m.id)}>
              <MethodIcon icon={m.icon} size={26} /><span>{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function BeanDetail({ id }: { id: string }) {
  const { beans, brews, deleteBean, saveBean } = useStore();
  const { push, back } = useRouter();
  const [fix, setFix] = useState<string | null>(null);
  const b = beans.find((x) => x.id === id);
  if (!b) return <Screen title={tr('Пачка удалена')}><Empty title={tr('Нет такой пачки')} text={tr('Её удалили.')} /></Screen>;
  const mine = brews.filter((x) => brewBeanIds(x).includes(b.id));
  const st = beanStock(b, brews);
  const finished = isFinished(b, st);

  const drip = isDrip(b);
  const unit = drip ? tr('шт') : tr('г');
  const saveFix = () => {
    const n = parseFloat((fix ?? '').replace(',', '.'));
    if (!isNaN(n) && n >= 0) {
      saveBean({ ...b, adjust: drip ? Math.round(n) - (st.total - st.used) : Math.round((n - (st.total - st.used)) * 10) / 10, finished: n <= 0, finishedAt: n <= 0 ? Date.now() : undefined });
      platform.haptic('success');
    }
    setFix(null);
  };
  const toggleFinished = async () => {
    if (finished && st.total > 0 && st.left <= 0) { setFix(''); return; } // back on the shelf — weigh the remainder first
    if (!finished && !(await platform.confirm(drip ? tr('Отметить коробку законченной? Она переедет в раздел «Допито».') : tr('Отметить пачку допитой? Она переедет в раздел «Допито».')))) return;
    saveBean({ ...b, finished: !finished, finishedAt: finished ? undefined : Date.now() });
    platform.haptic('success');
  };
  const buyAgain = () => {
    const { id: _id, createdAt: _c, roastDate: _r, adjust: _a, finished: _f, finishedAt: _fa, sample: _s, ...rest } = b;
    // an assorted copy gets new kind ids: brews of the old box do not belong to them
    push({ name: 'beanEdit', bean: { ...emptyBean(), ...rest, drips: rest.drips?.map((d) => ({ ...d, id: uid() })) }, isNew: true, again: true });
  };

  // «Заварить» in the footer: the method this coffee was last brewed by (drips — the drip), else the last one used at all
  const lastOf = (list: typeof brews) => [...list].filter((x) => x.methodId !== 'cupping' && x.methodId !== 'drip').sort((x, y) => y.date - x.date)[0]?.methodId;
  const brewWith = methodById(drip ? 'drip' : lastOf(mine) ?? lastOf(brews) ?? 'v60');
  const brewIt = () => push({ name: 'recipes', methodId: brewWith.id, beanId: b.id });
  // the other methods: a grid that opens from the round button left of «Заварить» (no swipe to close — tap outside, ×, Esc)
  const [menu, setMenu] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const usedIds = new Set(mine.map((x) => x.methodId));

  const remove = async () => {
    if (!(await platform.confirm(tr('Удалить «{0}»? Заварки останутся в дневнике.', beanTitle(b))))) return;
    platform.haptic('warning');
    back(true);
    deleteBean(b.id);
  };

  const info: [string, string][] = ([
    [tr('Обжарщик'), b.roaster],
    ...(drip ? [[tr('Дрипов в коробке'), b.assorted ? tr('{0} (ассорти)', dripTotal(b)) : b.dripCount ? String(b.dripCount) : '']] : []),
    ...(b.isBlend || (drip && b.assorted) ? [] : [[tr('Страна'), trValue(b.country)], [tr('Регион'), b.region], [tr('Ферма / станция'), b.farm],
      [tr('Производитель'), b.producer], [tr('Сорт'), b.variety], [tr('Обработка'), trValue(b.process)], [tr('Высота'), b.altitude]]),
    ...(drip ? [] : [[tr('Урожай'), b.harvest]]), [tr('Обжарка'), trValue(b.roastLevel)],
    [tr('Дата обжарки'), b.roastDate ? new Date(b.roastDate + 'T00:00').toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
    [tr('Штрихкод'), b.barcode],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <Screen title={beanTitle(b)} subtitle={beanOrigin(b)}
      footer={finished ? undefined : (
        <div className="footer-actions">
          {!drip && (
            <button ref={toggleRef} type="button" className={'round-btn method-menu-toggle' + (menu ? ' on' : '')} onClick={() => setMenu((v) => !v)}
              aria-expanded={menu} aria-haspopup="dialog" aria-label={menu ? tr('Закрыть выбор метода') : tr('Другой метод')}>
              <Icon name={menu ? 'close' : 'chevron'} />
            </button>
          )}
          <Button icon="brew" wide onClick={brewIt}>{drip ? tr('Заварить дрип') : tr('Заварить · {0}', brewWith.name)}</Button>
        </div>
      )}
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })} aria-label={tr('Изменить')}><Icon name="edit" /></button>}>
      <div className="bean-hero">
        <RestBadge roastDate={b.roastDate} until={finishedOn(b, st, brews)} />
        {b.packNotes && <p className="pack-notes">{b.packNotes}</p>}
      </div>

      <div className="stock-card">
        <div className="stock-card-head">
          <span>{drip ? (finished ? tr('Коробка закончилась') : tr('Осталось в коробке')) : finished ? tr('Пачка допита') : tr('Осталось в пачке')}</span>
          {st.total > 0 && fix === null && <button type="button" className="link-btn" onClick={() => setFix(String(st.left).replace('.', decSep()))}>{drip ? tr('Пересчитать') : tr('Взвесить')}</button>}
        </div>
        {fix !== null ? (
          <form className="stock-fix" onSubmit={(e) => { e.preventDefault(); saveFix(); }}>
            <input id="stock-fix" autoFocus inputMode={drip ? 'numeric' : 'decimal'} value={fix} onChange={(e) => setFix(e.target.value)} aria-label={tr('Сколько осталось, {0}', unit)} />
            <span>{tr('{0} осталось', unit)}</span>
            <button type="submit" className="btn btn-primary">OK</button>
          </form>
        ) : (
          <StockBar bean={b} />
        )}
        {st.total > 0 && !drip && <p className="muted">{tr('Списано заварками: {0} {1}', fmtNum(st.used, 1), unit)}{b.adjust ? tr(' · поправка {0}{1} {2}', b.adjust > 0 ? '+' : '', fmtNum(b.adjust, 1), unit) : ''}</p>}
        {!st.total && <Button kind="secondary" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })}>{drip ? tr('Указать, сколько дрипов') : tr('Указать вес пачки')}</Button>}
        <div className="stock-actions">
          {st.total > 0 && <Button kind="ghost" onClick={toggleFinished}>{finished ? tr('Вернуть на полку') : tr('Допито')}</Button>}
          <Button kind="secondary" icon="plus" onClick={buyAgain}>{tr('Купить ещё')}</Button>
        </div>
      </div>

      {menu && !finished && (
        <MethodMenu anchor={toggleRef} used={usedIds} methods={allMethods().filter((m) => m.id !== 'drip')}
          onPick={(id) => { setMenu(false); push({ name: 'recipes', methodId: id, beanId: b.id }); }}
          onClose={() => { setMenu(false); toggleRef.current?.focus({ preventScroll: true }); }} />
      )}

      {/* drips are brewed only as drips; a pack on the shelf picks other methods from the menu by «Заварить» */}
      {!drip && finished && <Section title={tr('Заварить')} plain>
        <div className="quick-methods">
          {allMethods().filter((m) => (m.id === 'drip') === drip && !(drip && m.id === 'cupping')).map((m) => (
            <button type="button" key={m.id} onClick={() => push({ name: 'recipes', methodId: m.id, beanId: b.id })}>
              <MethodIcon icon={m.icon} size={26} /><span>{m.name}</span>
            </button>
          ))}
        </div>
      </Section>}

      {drip && b.assorted && (
        <Section title={tr('Дрипы в коробке · {0}', (b.drips ?? []).length)}>
          {(b.drips ?? []).map((d) => (
            <Row key={d.id} label={dripTitle(d)} hint={[dripMeta(d), trValue(d.roastLevel ?? ''), d.notes].filter(Boolean).join(' · ') || undefined}
              value={tr('{0} из {1}', dripItemLeft(b, d.id, brews), d.count)} chevron={false} />
          ))}
          {!(b.drips ?? []).length && <p className="muted pad">{tr('Дрипы не описаны.')}</p>}
        </Section>
      )}

      {b.isBlend && (
        <Section title={tr('Состав бленда · {0}', (b.parts ?? []).length)}>
          {blendLines(b).map((l, i) => <Row key={i} label={l.text} value={l.share || undefined} />)}
          {!(b.parts ?? []).length && <p className="muted pad">{tr('Компоненты не указаны.')}</p>}
        </Section>
      )}

      {hasScales(b.scales) && (
        <Section title={tr('Профиль от обжарщика')}>
          <div className="scales">
            {SCALES.filter((s) => b.scales?.[s.key]).map((s) => <ScaleDots key={s.key} label={s.label} value={b.scales?.[s.key]} />)}
          </div>
        </Section>
      )}

      {(info.length > 0 || b.link || b.comment) && (
        <Section title={drip ? tr('О коробке') : tr('О пачке')}>
          {info.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          {b.link && <Row label={tr('Ссылка')} value={tr('открыть')} onClick={() => platform.openLink(b.link)} />}
          {b.comment && <p className="note-text pad">{b.comment}</p>}
        </Section>
      )}

      <Section title={mine.length ? tr('Заварки · {0}', mine.length) : tr('Заварки')}>
        {mine.length === 0 && <p className="muted pad">{tr('Пока не заваривали.')}</p>}
        {mine.map((x) => {
          const m = methodById(x.methodId);
          return (
            <Row key={x.id} leading={<MethodIcon icon={m.icon} size={24} />}
              label={x.dripId ? brewBeanTitle(x, b).split(' · ')[0] : m.name}
              hint={`${new Date(x.date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })} · ${fmtRatio(x.water / x.dose)} · ${drip ? tr('{0} г воды', fmtNum(x.water)) : x.grind || tr('помол не указан')}`}
              value={<BrewScore brew={x} size={13} beanId={b.id} />}
              onClick={() => push({ name: 'brew', id: x.id })} />
          );
        })}
        {(() => {
          const sc = mine.map((x) => beanSca(x, b.id)).filter((x): x is number => x !== null);
          return sc.length > 0 && <p className="muted pad">{tr('Средний каппинг: {0}', (sc.reduce((s, x) => s + x, 0) / sc.length).toFixed(2).replace('.', decSep()))}</p>;
        })()}
      </Section>

      <div className="danger-zone"><Button kind="danger" icon="trash" onClick={remove}>{drip ? tr('Удалить коробку') : tr('Удалить пачку')}</Button></div>
    </Screen>
  );
}

/* ---------- Editor ---------- */

const COUNTRIES = [tr('Эфиопия'), tr('Кения'), tr('Руанда'), tr('Бурунди'), tr('Танзания'), tr('Уганда'), tr('Колумбия'), tr('Бразилия'), tr('Перу'), tr('Эквадор'), tr('Боливия'), tr('Коста-Рика'), tr('Панама'), tr('Гватемала'), tr('Гондурас'), tr('Сальвадор'), tr('Никарагуа'), tr('Мексика'), tr('Йемен'), tr('Индонезия'), tr('Индия'), tr('Вьетнам'), tr('Китай'), tr('Папуа — Новая Гвинея')];

/** a QR leading to the roaster's Instagram, channel or link page: saved as the link, nothing to fill from it */
const foreignNote = (what?: string) => (what ? tr('Это {0}, а не код с пачки кофе', trValue(what)) : tr('Это не код с пачки кофе')) + tr(' — ничего не сохранил.');
const textNote = (kept: boolean) => kept
  ? tr('Данных о кофе в этом коде нет. Сохранил его в поле «Штрихкод», остальное заполните вручную.')
  : tr('Данных о кофе в этом коде нет — ничего не сохранил. Заполните пачку вручную.');
const SOCIAL_NOTE = tr('Это ссылка на соцсеть обжарщика — данных о кофе в ней нет. Сохранил её в поле «Ссылка», остальное заполните вручную.');

/** what a repeat pack keeps from the last one, in one line */
function sameAsBefore(b: Bean): string {
  const origin = b.isBlend ? tr('бленд') : b.assorted ? tr('ассорти') : [b.country, b.region].filter(Boolean).join(', ');
  return [b.roaster, origin, trValue(b.process), b.variety, b.roastLevel ? tr('обжарка {0}', trValue(b.roastLevel).toLowerCase()) : ''].filter(Boolean).join(' · ') || tr('описание кофе');
}

export function BeanEdit({ bean, isNew, scanOnOpen, again }: { bean: Bean; isNew: boolean; scanOnOpen?: boolean; again?: boolean }) {
  const { saveBean, patchBean, beans, brews } = useStore();
  const { back } = useRouter();
  // the type can be changed while nothing has been brewed from the pack
  const kindLocked = !isNew && brews.some((x) => brewBeanIds(x).includes(bean.id));
  const [b, setB] = useState<Bean>(bean);
  const [scan, setScan] = useState(!!scanOnOpen);
  const [status, setStatus] = useState('');
  const [leftText, setLeftText] = useState('');
  // «Купить ещё»: a new pack of the same coffee — what usually changes comes first, the rest is folded as it was
  const [showRest, setShowRest] = useState(!again);
  const dirty = JSON.stringify(b) !== JSON.stringify(bean);
  useBackGuard(dirty, tr('Выйти без сохранения?'));

  useEffect(() => {
    if (bean.barcode && isNew && bean.name) setStatus(bean.catalogId ? tr('Данные из общего каталога — проверьте и укажите дату обжарки.') : tr('Данные подставлены по коду — проверьте и дополните.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Bean>) => setB((x) => ({ ...x, ...patch }));
  const newPart = (): BlendPart => ({ id: uid(), share: '', country: '', region: '', farm: '', variety: '', process: '' });
  const setBlend = (on: boolean) => setB((x) => ({
    ...x, isBlend: on,
    // switching to a blend moves the origin already entered into the first component
    parts: on && !(x.parts ?? []).length
      ? [{ ...newPart(), country: x.country, region: x.region, farm: x.farm, variety: x.variety, process: x.process }, newPart()]
      : x.parts,
  }));
  const setPart = (i: number, patch: Partial<BlendPart>) => setB((x) => ({ ...x, parts: (x.parts ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const addPart = () => { platform.haptic('light'); setB((x) => ({ ...x, parts: [...(x.parts ?? []), newPart()] })); };
  const removePart = (i: number) => { platform.haptic('light'); setB((x) => ({ ...x, parts: (x.parts ?? []).filter((_, j) => j !== i) })); };
  const drip = isDrip(b);
  const setKind = (k: 'beans' | 'drip') => setB((x) => (k === 'drip'
    ? { ...x, kind: 'drip', dripCount: x.dripCount ?? 1, harvest: '' }
    : { ...x, kind: undefined, assorted: undefined }));
  const setAssorted = (on: boolean) => setB((x) => ({
    ...x, assorted: on || undefined,
    // the first assorted drip — from the origin already entered
    drips: on && !(x.drips ?? []).length
      ? [{ ...newDripItem(), country: x.country, region: x.region, farm: x.farm, variety: x.variety, process: x.process, roastLevel: x.roastLevel, count: Math.max(1, Math.floor((x.dripCount ?? 2) / 2)) }, newDripItem()]
      : x.drips,
  }));
  const setDrip = (i: number, patch: Partial<DripItem>) => setB((x) => ({ ...x, drips: (x.drips ?? []).map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const addDrip = () => { platform.haptic('light'); setB((x) => ({ ...x, drips: [...(x.drips ?? []), newDripItem()] })); };
  const removeDrip = (i: number) => { platform.haptic('light'); setB((x) => ({ ...x, drips: (x.drips ?? []).filter((_, j) => j !== i) })); };
  const numField = (label: string, id: string, value: number | undefined, onChange: (n: number | undefined) => void, unit: string) => (
    <Field label={label} id={id} inputMode="decimal" value={value === undefined ? '' : String(value).replace('.', decSep())} suffix={<span className="muted">{unit}</span>}
      onChange={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); onChange(isNaN(n) ? undefined : n); }} />
  );
  const shares = (b.parts ?? []).map((p) => parseFloat(p.share.replace(',', '.'))).filter((n) => !isNaN(n));
  const shareSum = b.isBlend && shares.length ? shares.reduce((a, n) => a + n, 0) : null;
  const f = (key: keyof Bean, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} id={`bean-${key}`} value={String(b[key] ?? '')} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
  );

  const onCode = async (code: string) => {
    setScan(false);
    setStatus(tr('Ищу…'));
    track('pack.lookup');
    const r = await lookupCode(code, beans.filter((x) => x.id !== b.id), isDrip(b));
    if (r.existing) {
      const copy = await platform.confirm(tr('Этот код уже есть у «{0}». Скопировать данные в новую пачку? Дату обжарки введите заново.', beanTitle(r.existing)));
      if (copy) {
        const { id: _i, createdAt: _c, roastDate: _r, sample: _s, ...rest } = r.existing;
        setB((x) => ({ ...x, ...rest, roastDate: x.roastDate }));
        setStatus(tr('Скопировано с прошлой пачки. Укажите дату обжарки.'));
        return;
      }
    }
    if (r.kind === 'foreign') { setStatus(foreignNote(r.what)); return; }
    if (r.kind === 'social') {
      setB((x) => ({ ...x, link: x.link || r.patch.link || '' }));
      setStatus(SOCIAL_NOTE);
      return;
    }
    if (r.kind === 'text') {
      if (r.patch.barcode) setB((x) => ({ ...x, barcode: r.patch.barcode ?? '' }));
      setStatus(textNote(!!r.patch.barcode));
      return;
    }
    const before = b;
    const next = mergeEmpty({ ...b, barcode: r.patch.barcode ?? code }, r.patch);
    // the drip count from the page is more accurate than the default
    if (r.patch.dripCount) next.dripCount = r.patch.dripCount;
    setB(next);
    const filled = filledLabels(before, next);
    setStatus(r.source && filled.length
      ? tr('Найдено: {0}. Заполнено: {1}. Проверьте поля и укажите дату обжарки.', r.source, filled.join(', '))
      : r.source ? tr('Найдено: {0}. Проверьте поля.', r.source)
      : r.pending ? tr('Сайт этого обжарщика пока не подключён к каталогу — мы его проверим и добавим. Сейчас заполните вручную: после сохранения пачка попадёт в общий каталог.')
      : tr('Код сохранён. Данных об этом кофе пока нет — заполните вручную: после сохранения пачка попадёт в общий каталог, и у следующих она заполнится сама.'));
  };

  const save = () => {
    // Pack added already opened: stock below weight — remember the correction
    const left = parseFloat(leftText.replace(',', '.'));
    const weight = drip ? dripTotal(b) : parseFloat(b.weight.replace(',', '.'));
    const adjust = isNew && !isNaN(left) && !isNaN(weight) && left < weight ? Math.round((left - weight) * 10) / 10 : b.adjust;
    // assorted: empty drip rows are not saved
    const drips = b.assorted ? (b.drips ?? []).filter((d) => d.name || d.country || d.region || d.notes) : b.drips;
    const saved: Bean = { ...b, drips, adjust, sample: dirty ? undefined : b.sample };
    saveBean(saved);
    if (isNew && !saved.sample) track(isDrip(saved) ? 'pack.drip' : 'pack.add');
    // coffee description (no roast date, stock or notes) goes to the shared catalog so it fills in for others
    if (!saved.sample && (isNew || dirty)) contributeCoffee(saved).then((id) => { if (id && id !== saved.catalogId) patchBean(saved.id, { catalogId: id }); });
    platform.haptic('success');
    back(true);
  };

  return (
    <Screen title={again ? (drip ? tr('Ещё коробка') : tr('Ещё пачка')) : drip ? (isNew ? tr('Новые дрипы') : tr('Редактировать дрипы')) : isNew ? tr('Новая пачка') : tr('Редактировать пачку')}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={(!isNew && !dirty) || (!b.name && !b.country && !b.barcode && !(b.parts ?? []).some((p) => p.country) && !(b.drips ?? []).some((d) => d.name || d.country))}>{tr('Сохранить')}</Button></div>}>

      {again && (
        <>
          <Section title={tr('Новая пачка')}>
            {f('roastDate', tr('Дата обжарки'), { type: 'date', max: new Date().toISOString().slice(0, 10) })}
            {!drip && f('weight', tr('Вес пачки, г'), { inputMode: 'numeric', placeholder: '250' })}
            {drip && !b.assorted && numField(tr('Дрипов в коробке'), 'bean-drip-count', b.dripCount, (n) => set({ dripCount: n === undefined ? undefined : Math.round(n) }), tr('шт'))}
            {!drip && b.weight && (
              <Field label={tr('Осталось сейчас, г')} id="bean-left" inputMode="decimal" placeholder={b.weight}
                value={leftText} onChange={(e) => setLeftText(e.target.value)} />
            )}
          </Section>
          {!showRest && (
            <Section title={tr('Как у прошлой пачки')} plain>
              <div className="group"><Row label={beanTitle(b)} hint={sameAsBefore(b)} chevron onClick={() => setShowRest(true)} /></div>
              <p className="muted pad small-note">{tr('Остаётся без изменений. Нажмите, если у этой пачки что-то другое.')}</p>
            </Section>
          )}
        </>
      )}
      {showRest && <>
      {!kindLocked && (
        <Segmented value={drip ? 'drip' : 'beans'} onChange={(v) => setKind(v)}
          options={[{ value: 'beans', label: tr('Зерно') }, { value: 'drip', label: tr('Дрип-пакеты') }]} />
      )}

      <div className="scan-field">
        <Field label={tr('Штрихкод / QR')} id="bean-barcode" value={b.barcode} inputMode="numeric" onChange={(e) => set({ barcode: e.target.value })}
          onBlur={() => { if (b.barcode && b.barcode !== bean.barcode && (/^\d{8,14}$/.test(b.barcode) || /^https?:\/\/\S+$/i.test(b.barcode))) onCode(b.barcode); }}
          suffix={<button type="button" className="icon-btn" onClick={() => setScan(true)} aria-label={tr('Сканировать')}><Icon name="scan" /></button>} />
        {status && <p className="status">{status}</p>}
      </div>

      <Section title={tr('Основное')}>
        {f('name', drip ? tr('Название') : tr('Название лота'), { placeholder: drip ? (b.assorted ? tr('Ассорти «Африка»') : tr('Гуджи Ханджа')) : tr('Гуджи Ханджа') })}
        {f('roaster', tr('Обжарщик'))}
      </Section>

      {drip && (
        <Section title={tr('Коробка')} plain>
          <Segmented value={b.assorted ? 'mix' : 'same'} onChange={(v) => setAssorted(v === 'mix')}
            options={[{ value: 'same', label: tr('Все дрипы одинаковые') }, { value: 'mix', label: tr('Разные') }]} />
          <div className="group" style={{ marginTop: 10 }}>
            {!b.assorted && !again && numField(tr('Дрипов в коробке'), 'bean-drip-count', b.dripCount, (n) => set({ dripCount: n === undefined ? undefined : Math.round(n) }), tr('шт'))}
            {isNew && (
              <Field label={tr('Осталось сейчас, шт')} id="bean-left" inputMode="numeric" placeholder={String(dripTotal(b) || '')}
                value={leftText} onChange={(e) => setLeftText(e.target.value)} />
            )}
          </div>
        </Section>
      )}

      {!(drip && b.assorted) && (
        <Segmented value={b.isBlend ? 'blend' : 'single'} onChange={(v) => setBlend(v === 'blend')}
          options={[{ value: 'single', label: tr('Моносорт') }, { value: 'blend', label: tr('Бленд') }]} />
      )}
      <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="processes">{PROCESSES.map((x) => <option key={x} value={x} />)}</datalist>

      {drip && b.assorted ? (
        <Section title={tr('Дрипы в коробке · {0} шт', dripTotal(b))} plain>
          <div className="drip-editor">
            {(b.drips ?? []).map((d, i) => (
              <div className="drip-row" key={d.id}>
                <div className="drip-row-head">
                  <span className="step-num">{i + 1}</span>
                  <input className="drip-name" aria-label={tr('Дрип {0}: название', i + 1)} placeholder={tr('Название или лот')} value={d.name} onChange={(e) => setDrip(i, { name: e.target.value })} />
                  <label className="drip-count">
                    <input inputMode="numeric" aria-label={tr('Дрип {0}: сколько штук', i + 1)} value={d.count || ''} placeholder="0"
                      onChange={(e) => setDrip(i, { count: parseInt(e.target.value.replace(/\D/g, '')) || 0 })} />
                    <span>{tr('шт')}</span>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => removeDrip(i)} aria-label={tr('Удалить дрип {0}', i + 1)}><Icon name="close" size={18} /></button>
                </div>
                <div className="drip-row-grid">
                  <input list="countries" aria-label={tr('Дрип {0}: страна', i + 1)} placeholder={tr('Страна')} value={d.country} onChange={(e) => setDrip(i, { country: e.target.value })} />
                  <input aria-label={tr('Дрип {0}: регион', i + 1)} placeholder={tr('Регион')} value={d.region} onChange={(e) => setDrip(i, { region: e.target.value })} />
                  <input aria-label={tr('Дрип {0}: ферма', i + 1)} placeholder={tr('Ферма / станция')} value={d.farm} onChange={(e) => setDrip(i, { farm: e.target.value })} />
                  <input aria-label={tr('Дрип {0}: сорт', i + 1)} placeholder={tr('Сорт')} value={d.variety} onChange={(e) => setDrip(i, { variety: e.target.value })} />
                  <input list="processes" aria-label={tr('Дрип {0}: обработка', i + 1)} placeholder={tr('Обработка')} value={d.process} onChange={(e) => setDrip(i, { process: e.target.value })} />
                  <select aria-label={tr('Дрип {0}: обжарка', i + 1)} value={d.roastLevel} onChange={(e) => setDrip(i, { roastLevel: e.target.value })}>
                    <option value="">{tr('Обжарка')}</option>
                    {ROAST_LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <input aria-label={tr('Дрип {0}: дескрипторы', i + 1)} placeholder={tr('Дескрипторы с упаковки')} value={d.notes} onChange={(e) => setDrip(i, { notes: e.target.value })} />
              </div>
            ))}
            <button type="button" className="add-step" onClick={addDrip}><Icon name="plus" size={18} />{tr('Добавить дрип')}</button>
          </div>
        </Section>
      ) : !b.isBlend ? <>
        <Section title={tr('Происхождение')}>
          {f('country', tr('Страна'), { list: 'countries' })}
          {f('region', tr('Регион'))}
          {f('farm', tr('Ферма / станция'))}
          {f('producer', tr('Производитель'))}
          {f('altitude', tr('Высота'), { placeholder: tr('1900–2100 м') })}
        </Section>

        <Section title={tr('Обработка')} plain>
          <Chips options={PROCESSES} value={[b.process]} onToggle={(p) => set({ process: b.process === p ? '' : p })} />
          <div className="group" style={{ marginTop: 10 }}>
            {f('process', tr('Своя обработка'), { placeholder: tr('например, Double fermentation') })}
            {f('variety', tr('Сорт'), { placeholder: tr('Гейша, SL28, Бурбон…') })}
            {!drip && f('harvest', tr('Урожай'), { placeholder: '2026' })}
          </div>
        </Section>
      </> : (
        <Section title={tr('Состав бленда')} aside={<span className={'muted' + (shareSum !== null && Math.abs(shareSum - 100) > 0.01 ? ' warn-text' : '')}>{shareSum !== null ? tr('сумма {0}%', fmtNum(shareSum, 1)) : ''}</span>} plain>
          <div className="blend-editor">
            {(b.parts ?? []).map((p, i) => (
              <div className="blend-part" key={p.id}>
                <div className="blend-part-head">
                  <span className="step-num">{i + 1}</span>
                  <input className="blend-country" list="countries" aria-label={tr('Компонент {0}: страна', i + 1)} placeholder={tr('Страна')} value={p.country}
                    onChange={(e) => setPart(i, { country: e.target.value })} />
                  <label className="blend-share">
                    <input inputMode="decimal" aria-label={tr('Компонент {0}: доля', i + 1)} placeholder="—" value={p.share}
                      onChange={(e) => setPart(i, { share: e.target.value.replace(/[^\d.,]/g, '') })} />
                    <span>%</span>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => removePart(i)} aria-label={tr('Удалить компонент {0}', i + 1)}><Icon name="close" size={18} /></button>
                </div>
                <div className="blend-part-grid">
                  <input aria-label={tr('Компонент {0}: регион', i + 1)} placeholder={tr('Регион')} value={p.region} onChange={(e) => setPart(i, { region: e.target.value })} />
                  <input aria-label={tr('Компонент {0}: ферма', i + 1)} placeholder={tr('Ферма / станция')} value={p.farm} onChange={(e) => setPart(i, { farm: e.target.value })} />
                  <input aria-label={tr('Компонент {0}: сорт', i + 1)} placeholder={tr('Сорт')} value={p.variety} onChange={(e) => setPart(i, { variety: e.target.value })} />
                  <input aria-label={tr('Компонент {0}: обработка', i + 1)} list="processes" placeholder={tr('Обработка')} value={p.process} onChange={(e) => setPart(i, { process: e.target.value })} />
                </div>
              </div>
            ))}
            <button type="button" className="add-step" onClick={addPart}><Icon name="plus" size={18} />{tr('Добавить компонент')}</button>
          </div>
        </Section>
      )}

      {!drip && (
        <Section title={tr('Вес пачки')} plain>
          <Chips options={PACK_SIZES.map((x) => tr('{0} г', x))} value={b.weight ? [tr('{0} г', b.weight)] : []}
            onToggle={(v) => set({ weight: b.weight === v.replace(tr(' г'), '') ? '' : v.replace(tr(' г'), '') })} />
        </Section>
      )}

      <Section title={tr('Обжарка')} plain>
        <Chips options={ROAST_LEVELS} value={[b.roastLevel]} onToggle={(p) => set({ roastLevel: b.roastLevel === p ? '' : p })} />
        <div className="group" style={{ marginTop: 10 }}>
          {!again && f('roastDate', tr('Дата обжарки'), { type: 'date', max: new Date().toISOString().slice(0, 10) })}
          {!again && !drip && f('weight', tr('Вес пачки, г'), { inputMode: 'numeric', placeholder: '250' })}
          {!again && !drip && isNew && b.weight && (
            <Field label={tr('Осталось сейчас, г')} id="bean-left" inputMode="decimal" placeholder={b.weight}
              value={leftText} onChange={(e) => setLeftText(e.target.value)} />
          )}
        </div>
      </Section>

      <Section title={tr('Профиль от обжарщика')} aside={hasScales(b.scales) ? <button type="button" className="link-btn" onClick={() => set({ scales: undefined })}>{tr('Очистить')}</button> : undefined}>
        <p className="muted pad small-note">{tr('Если обжарщик даёт шкалы на сайте или пачке. Нажмите ещё раз, чтобы убрать значение.')}</p>
        <div className="scales">
          {SCALES.map((s) => (
            <ScaleDots key={s.key} label={s.label} value={b.scales?.[s.key]}
              onChange={(v) => setB((x) => {
                const next = { ...(x.scales ?? {}), [s.key]: v };
                if (v === undefined) delete next[s.key];
                return { ...x, scales: Object.keys(next).length ? next : undefined };
              })} />
          ))}
        </div>
      </Section>

      <Section title={tr('Заметки')}>
        {f('packNotes', tr('Дескрипторы с пачки'), { placeholder: tr('бергамот, персик, жасмин') })}
        {f('link', tr('Ссылка на лот'), { type: 'url', placeholder: 'https://', onBlur: () => {
          // a roaster page link was pasted — fill in fields the same way as from a QR code
          if (b.link && b.link !== bean.link && /^https?:\/\/\S+$/i.test(b.link) && !b.country && !(b.drips ?? []).length) onCode(b.link);
        } })}
        <textarea id="bean-comment" className="notes" rows={3} aria-label={tr('Заметки')} placeholder={tr('Где купил, цена, впечатления')} value={b.comment} onChange={(e) => set({ comment: e.target.value })} />
      </Section>
      </>}

      {scan && <Scanner onResult={onCode} onClose={() => setScan(false)} />}
    </Screen>
  );
}
