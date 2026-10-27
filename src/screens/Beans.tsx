import { useEffect, useState } from 'react';
import { lookupCode, mergeEmpty } from '../data/lookup';
import { allMethods, methodById, fmtRatio, fmtNum } from '../data/methods';
import { beanSca, brewBeanIds } from '../data/cva';
import { emptyBean, isDrip, newDripItem, uid, useStore, type Bean, type BlendPart, type DripItem } from '../data/store';
import { beanStock, dripItemLeft, dripTotal, isFinished, DRIP_COUNTS, DRIP_WEIGHTS, PACK_SIZES } from '../data/stock';
import { platform } from '../platform';
import { useBackGuard, useRouter, useSelected } from '../router';
import { MethodIcon, Icon } from '../ui/icons';
import { Button, Chips, Empty, Field, Row, SampleTag, Screen, Section, Segmented, Stars } from '../ui/kit';
import { Scanner } from '../ui/Scanner';
import { BrewScore } from '../ui/CuppingForm';
import { beanMeta, beanOrigin, beanTitle, blendLines, brewBeanTitle, dripMeta, dripTitle, PROCESSES, RestBadge, ROAST_LEVELS } from './beanUtils';
import { emptyDripBox } from './BeanPicker';

/* ---------- Полка ---------- */

/** Полоска остатка пачки: «осталось N из M г» */
export function StockBar({ bean, compact = false }: { bean: Bean; compact?: boolean }) {
  const { brews } = useStore();
  const st = beanStock(bean, brews);
  if (!st.total) return compact ? null : <span className="stock-none">{st.unit === 'pcs' ? 'Сколько дрипов в коробке — не указано' : 'Вес пачки не указан'}</span>;
  if (st.unit === 'pcs') {
    return (
      <div className={'stock' + (compact ? ' compact' : '') + (st.left > 0 && st.left <= 2 ? ' low' : '') + (st.left <= 0 ? ' empty' : '')}>
        <div className="stock-bar"><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} /></div>
        <div className="stock-text">
          <span><b>{st.left}</b> из {st.total} {plural(st.total, ['дрипа', 'дрипов', 'дрипов'])}</span>
          <span>{st.left <= 0 ? 'закончились' : st.used ? `заварено ${st.used}` : 'ещё не заваривали'}</span>
        </div>
      </div>
    );
  }
  const low = st.left > 0 && (st.brewsLeft !== null ? st.brewsLeft <= 2 : st.ratio < 0.15);
  return (
    <div className={'stock' + (compact ? ' compact' : '') + (low ? ' low' : '') + (st.left <= 0 ? ' empty' : '')}>
      <div className="stock-bar"><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} /></div>
      <div className="stock-text">
        <span><b>{fmtNum(st.left, 0)}</b> из {fmtNum(st.total, 0)} г</span>
        <span>{st.left <= 0 ? 'закончилось' : st.brewsLeft === 0 ? 'меньше чем на заварку' : st.brewsLeft !== null ? `≈ ${st.brewsLeft} ${plural(st.brewsLeft, ['заварка', 'заварки', 'заварок'])}` : 'ещё не заваривали'}</span>
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
  const active = (sel?.name === 'bean' && sel.id === b.id) || (sel?.name === 'beanEdit' && sel.bean.id === b.id);
  const mine = brews.filter((x) => brewBeanIds(x).includes(b.id));
  const rated = mine.filter((x) => x.rating);
  const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 0;
  // баллы SCA важнее звёзд: если пачку каппинговали — показываем средний балл
  const scores = mine.map((x) => beanSca(x, b.id)).filter((x): x is number => x !== null);
  const avgScore = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  return (
    <button type="button" className={'bean-card' + (active ? ' active' : '')} aria-current={active || undefined} onClick={onClick}>
      <div className="bean-card-top">
        <b>{beanTitle(b)}</b>
        {isDrip(b) && <span className="tag tag-drip">дрип</span>}
        {b.sample && <SampleTag />}
      </div>
      <span className="bean-card-origin">{beanMeta(b) || 'Происхождение не указано'}</span>
      <StockBar bean={b} />
      <div className="bean-card-foot">
        <span>{b.roaster || '—'}</span>
        <span className="foot-right"><RestBadge roastDate={b.roastDate} />{avgScore ? <span className="score-mini">{fmtNum(avgScore, 2)}</span> : avg ? <Stars value={Math.round(avg * 2) / 2} size={12} /> : null}</span>
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
    const r = await lookupCode(code, beans);
    if (r.existing) push({ name: 'bean', id: r.existing.id });
    else push({ name: 'beanEdit', bean: mergeEmpty(emptyBean(), r.patch), isNew: true });
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
    packs ? `${packs} ${plural(packs, ['пачка', 'пачки', 'пачек'])} · ${fmtNum(grams / 1000, 2)} кг кофе` : '',
    drips ? `${drips} ${plural(drips, ['дрип', 'дрипа', 'дрипов'])}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <Screen title="Полка" subtitle={subtitle || undefined} root
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: emptyBean(), isNew: true })} aria-label="Добавить пачку"><Icon name="plus" /></button>}>
      <button type="button" className="scan-cta" onClick={() => setScan(true)}>
        <Icon name="scan" size={28} />
        <span><b>Добавить пачку</b><small>Отсканируйте штрихкод или QR — или введите вручную</small></span>
      </button>
      <button type="button" className="link-btn add-drip" onClick={() => push({ name: 'beanEdit', bean: emptyDripBox(), isNew: true })}>+ Коробка дрипов</button>

      {beans.length > 4 && (
        <input id="bean-search" className="search" type="search" placeholder="Поиск: страна, обработка, обжарщик" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {active.length === 0 && done.length === 0 && <Empty title="Полка пуста" text="Купили кофе? Добавьте пачку с весом и датой обжарки — остаток будет считаться сам." />}
      {active.length === 0 && done.length > 0 && <Empty title="Всё допито" text="На полке пусто. Добавьте новую пачку или купите ещё раз одну из допитых." />}

      <div className="bean-list">
        {active.map((b) => <PackCard key={b.id} b={b} onClick={() => push({ name: 'bean', id: b.id })} />)}
      </div>

      {done.length > 0 && (
        <Section title={`Допито · ${done.length}`} aside={
          <button type="button" className="link-btn" onClick={() => setShowDone((v) => !v)}>{showDone ? 'Скрыть' : 'Показать'}</button>
        } plain>
          {showDone && <div className="bean-list done">{done.map((b) => <PackCard key={b.id} b={b} onClick={() => push({ name: 'bean', id: b.id })} />)}</div>}
        </Section>
      )}

      {scan && <Scanner onResult={onCode} onClose={() => setScan(false)} />}
    </Screen>
  );
}

/* ---------- Карточка ---------- */

export function BeanDetail({ id }: { id: string }) {
  const { beans, brews, deleteBean, saveBean } = useStore();
  const { push, back } = useRouter();
  const [fix, setFix] = useState<string | null>(null);
  const b = beans.find((x) => x.id === id);
  if (!b) return <Screen title="Пачка удалена"><Empty title="Нет такой пачки" text="Её удалили." /></Screen>;
  const mine = brews.filter((x) => brewBeanIds(x).includes(b.id));
  const st = beanStock(b, brews);
  const finished = isFinished(b, st);

  const drip = isDrip(b);
  const unit = drip ? 'шт' : 'г';
  const saveFix = () => {
    const n = parseFloat((fix ?? '').replace(',', '.'));
    if (!isNaN(n) && n >= 0) {
      saveBean({ ...b, adjust: drip ? Math.round(n) - (st.total - st.used) : Math.round((n - (st.total - st.used)) * 10) / 10, finished: n <= 0 });
      platform.haptic('success');
    }
    setFix(null);
  };
  const toggleFinished = async () => {
    if (finished && st.total > 0 && st.left <= 0) { setFix(''); return; } // вернуть на полку — сначала взвесить остаток
    if (!finished && !(await platform.confirm(drip ? 'Отметить коробку законченной? Она переедет в раздел «Допито».' : 'Отметить пачку допитой? Она переедет в раздел «Допито».'))) return;
    saveBean({ ...b, finished: !finished });
    platform.haptic('success');
  };
  const buyAgain = () => {
    const { id: _id, createdAt: _c, roastDate: _r, adjust: _a, finished: _f, sample: _s, ...rest } = b;
    // у ассорти новые id видов: заварки старой коробки к ним не относятся
    push({ name: 'beanEdit', bean: { ...emptyBean(), ...rest, drips: rest.drips?.map((d) => ({ ...d, id: uid() })) }, isNew: true });
  };

  const remove = async () => {
    if (!(await platform.confirm(`Удалить «${beanTitle(b)}»? Заварки останутся в дневнике.`))) return;
    platform.haptic('warning');
    back(true);
    deleteBean(b.id);
  };

  const info: [string, string][] = ([
    ['Обжарщик', b.roaster],
    ...(drip ? [['Дрипов в коробке', b.assorted ? `${dripTotal(b)} (ассорти)` : b.dripCount ? String(b.dripCount) : ''], ['Кофе в дрипе', b.dripWeight ? `${fmtNum(b.dripWeight, 1)} г` : '']] : []),
    ...(b.isBlend || (drip && b.assorted) ? [] : [['Страна', b.country], ['Регион', b.region], ['Ферма / станция', b.farm],
      ['Производитель', b.producer], ['Сорт', b.variety], ['Обработка', b.process], ['Высота', b.altitude]]),
    ['Урожай', b.harvest], ['Обжарка', b.roastLevel],
    ['Дата обжарки', b.roastDate ? new Date(b.roastDate + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
    ['Штрихкод', b.barcode],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <Screen title={beanTitle(b)} subtitle={beanOrigin(b)}
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })} aria-label="Изменить"><Icon name="edit" /></button>}>
      <div className="bean-hero">
        <RestBadge roastDate={b.roastDate} />
        {b.packNotes && <p className="pack-notes">{b.packNotes}</p>}
      </div>

      <div className="stock-card">
        <div className="stock-card-head">
          <span>{drip ? (finished ? 'Коробка закончилась' : 'Осталось в коробке') : finished ? 'Пачка допита' : 'Осталось в пачке'}</span>
          {st.total > 0 && fix === null && <button type="button" className="link-btn" onClick={() => setFix(String(st.left).replace('.', ','))}>{drip ? 'Пересчитать' : 'Взвесить'}</button>}
        </div>
        {fix !== null ? (
          <form className="stock-fix" onSubmit={(e) => { e.preventDefault(); saveFix(); }}>
            <input id="stock-fix" autoFocus inputMode={drip ? 'numeric' : 'decimal'} value={fix} onChange={(e) => setFix(e.target.value)} aria-label={`Сколько осталось, ${unit}`} />
            <span>{unit} осталось</span>
            <button type="submit" className="btn btn-primary">OK</button>
          </form>
        ) : (
          <StockBar bean={b} />
        )}
        {st.total > 0 && (!drip || !!b.adjust) && <p className="muted">{drip ? 'Заварено' : 'Списано заварками'}: {fmtNum(st.used, 1)} {unit}{b.adjust ? ` · поправка ${b.adjust > 0 ? '+' : ''}${fmtNum(b.adjust, 1)} ${unit}` : ''}</p>}
        {!st.total && <Button kind="secondary" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })}>{drip ? 'Указать, сколько дрипов' : 'Указать вес пачки'}</Button>}
        <div className="stock-actions">
          {st.total > 0 && <Button kind="ghost" onClick={toggleFinished}>{finished ? 'Вернуть на полку' : 'Допито'}</Button>}
          <Button kind="secondary" icon="plus" onClick={buyAgain}>Купить ещё</Button>
        </div>
      </div>

      <Section title="Заварить" plain>
        <div className="quick-methods">
          {allMethods().filter((m) => (m.id === 'drip') === drip && !(drip && m.id === 'cupping')).map((m) => (
            <button type="button" key={m.id} onClick={() => push({ name: 'recipes', methodId: m.id, beanId: b.id })}>
              <MethodIcon icon={m.icon} size={26} /><span>{m.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {drip && b.assorted && (
        <Section title={`Дрипы в коробке · ${(b.drips ?? []).length}`}>
          {(b.drips ?? []).map((d) => (
            <Row key={d.id} label={dripTitle(d)} hint={[dripMeta(d), d.roastLevel, d.notes].filter(Boolean).join(' · ') || undefined}
              value={`${dripItemLeft(b, d.id, brews)} из ${d.count}`} chevron={false} />
          ))}
          {!(b.drips ?? []).length && <p className="muted pad">Дрипы не описаны.</p>}
        </Section>
      )}

      {b.isBlend && (
        <Section title={`Состав бленда · ${(b.parts ?? []).length}`}>
          {blendLines(b).map((l, i) => <Row key={i} label={l.text} value={l.share || undefined} />)}
          {!(b.parts ?? []).length && <p className="muted pad">Компоненты не указаны.</p>}
        </Section>
      )}

      {(info.length > 0 || b.link || b.comment) && (
        <Section title={drip ? "О коробке" : "О пачке"}>
          {info.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          {b.link && <Row label="Ссылка" value="открыть" onClick={() => platform.openLink(b.link)} />}
          {b.comment && <p className="note-text pad">{b.comment}</p>}
        </Section>
      )}

      <Section title={mine.length ? `Заварки · ${mine.length}` : 'Заварки'}>
        {mine.length === 0 && <p className="muted pad">Пока не заваривали.</p>}
        {mine.map((x) => {
          const m = methodById(x.methodId);
          return (
            <Row key={x.id} leading={<MethodIcon icon={m.icon} size={24} />}
              label={x.dripId ? brewBeanTitle(x, b).split(' · ')[0] : m.name}
              hint={`${new Date(x.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${fmtRatio(x.water / x.dose)} · ${drip ? `${fmtNum(x.water)} г воды` : x.grind || 'помол не указан'}`}
              value={<BrewScore brew={x} size={13} beanId={b.id} />}
              onClick={() => push({ name: 'brew', id: x.id })} />
          );
        })}
        {(() => {
          const sc = mine.map((x) => beanSca(x, b.id)).filter((x): x is number => x !== null);
          return sc.length > 0 && <p className="muted pad">Средний каппинг: {(sc.reduce((s, x) => s + x, 0) / sc.length).toFixed(2).replace('.', ',')}</p>;
        })()}
      </Section>

      <div className="danger-zone"><Button kind="danger" icon="trash" onClick={remove}>{drip ? 'Удалить коробку' : 'Удалить пачку'}</Button></div>
    </Screen>
  );
}

/* ---------- Редактор ---------- */

const COUNTRIES = ['Эфиопия', 'Кения', 'Руанда', 'Бурунди', 'Танзания', 'Уганда', 'Колумбия', 'Бразилия', 'Перу', 'Эквадор', 'Боливия', 'Коста-Рика', 'Панама', 'Гватемала', 'Гондурас', 'Сальвадор', 'Никарагуа', 'Мексика', 'Йемен', 'Индонезия', 'Индия', 'Вьетнам', 'Китай', 'Папуа — Новая Гвинея'];

export function BeanEdit({ bean, isNew, scanOnOpen }: { bean: Bean; isNew: boolean; scanOnOpen?: boolean }) {
  const { saveBean, beans, brews } = useStore();
  const { back } = useRouter();
  // тип можно сменить, пока пачкой ничего не заварено
  const kindLocked = !isNew && brews.some((x) => brewBeanIds(x).includes(bean.id));
  const [b, setB] = useState<Bean>(bean);
  const [scan, setScan] = useState(!!scanOnOpen);
  const [status, setStatus] = useState('');
  const [leftText, setLeftText] = useState('');
  const dirty = JSON.stringify(b) !== JSON.stringify(bean);
  useBackGuard(dirty, 'Выйти без сохранения?');

  useEffect(() => { if (bean.barcode && isNew && bean.name) setStatus('Данные подставлены по коду — проверьте и дополните.'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Bean>) => setB((x) => ({ ...x, ...patch }));
  const newPart = (): BlendPart => ({ id: uid(), share: '', country: '', region: '', farm: '', variety: '', process: '' });
  const setBlend = (on: boolean) => setB((x) => ({
    ...x, isBlend: on,
    // при переключении на бленд переносим уже введённое происхождение в первый компонент
    parts: on && !(x.parts ?? []).length
      ? [{ ...newPart(), country: x.country, region: x.region, farm: x.farm, variety: x.variety, process: x.process }, newPart()]
      : x.parts,
  }));
  const setPart = (i: number, patch: Partial<BlendPart>) => setB((x) => ({ ...x, parts: (x.parts ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const addPart = () => { platform.haptic('light'); setB((x) => ({ ...x, parts: [...(x.parts ?? []), newPart()] })); };
  const removePart = (i: number) => { platform.haptic('light'); setB((x) => ({ ...x, parts: (x.parts ?? []).filter((_, j) => j !== i) })); };
  const drip = isDrip(b);
  const setKind = (k: 'beans' | 'drip') => setB((x) => (k === 'drip'
    ? { ...x, kind: 'drip', dripCount: x.dripCount ?? 10, dripWeight: x.dripWeight ?? 11 }
    : { ...x, kind: undefined, assorted: undefined }));
  const setAssorted = (on: boolean) => setB((x) => ({
    ...x, assorted: on || undefined,
    // первый дрип ассорти — из уже введённого происхождения
    drips: on && !(x.drips ?? []).length
      ? [{ ...newDripItem(), country: x.country, region: x.region, farm: x.farm, variety: x.variety, process: x.process, roastLevel: x.roastLevel, count: Math.max(1, Math.floor((x.dripCount ?? 2) / 2)) }, newDripItem()]
      : x.drips,
  }));
  const setDrip = (i: number, patch: Partial<DripItem>) => setB((x) => ({ ...x, drips: (x.drips ?? []).map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const addDrip = () => { platform.haptic('light'); setB((x) => ({ ...x, drips: [...(x.drips ?? []), newDripItem()] })); };
  const removeDrip = (i: number) => { platform.haptic('light'); setB((x) => ({ ...x, drips: (x.drips ?? []).filter((_, j) => j !== i) })); };
  const numField = (label: string, id: string, value: number | undefined, onChange: (n: number | undefined) => void, unit: string) => (
    <Field label={label} id={id} inputMode="decimal" value={value === undefined ? '' : String(value).replace('.', ',')} suffix={<span className="muted">{unit}</span>}
      onChange={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); onChange(isNaN(n) ? undefined : n); }} />
  );
  const shares = (b.parts ?? []).map((p) => parseFloat(p.share.replace(',', '.'))).filter((n) => !isNaN(n));
  const shareSum = b.isBlend && shares.length ? shares.reduce((a, n) => a + n, 0) : null;
  const f = (key: keyof Bean, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} id={`bean-${key}`} value={String(b[key] ?? '')} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
  );

  const onCode = async (code: string) => {
    setScan(false);
    setStatus('Ищу…');
    const r = await lookupCode(code, beans.filter((x) => x.id !== b.id));
    if (r.existing) {
      const copy = await platform.confirm(`Этот код уже есть у «${beanTitle(r.existing)}». Скопировать данные в новую пачку? Дату обжарки введите заново.`);
      if (copy) {
        const { id: _i, createdAt: _c, roastDate: _r, sample: _s, ...rest } = r.existing;
        setB((x) => ({ ...x, ...rest, roastDate: x.roastDate }));
        setStatus('Скопировано с прошлой пачки. Укажите дату обжарки.');
        return;
      }
    }
    setB((x) => mergeEmpty({ ...x, barcode: r.patch.barcode ?? code }, r.patch));
    setStatus(r.source ? `Найдено: ${r.source}. Проверьте поля.` : 'Код сохранён. Данных о зерне в открытых базах нет — заполните вручную, при следующем скане подставлю сам.');
  };

  const save = () => {
    // Пачку добавили уже начатой: остаток меньше веса — запоминаем поправку
    const left = parseFloat(leftText.replace(',', '.'));
    const weight = drip ? dripTotal(b) : parseFloat(b.weight.replace(',', '.'));
    const adjust = isNew && !isNaN(left) && !isNaN(weight) && left < weight ? Math.round((left - weight) * 10) / 10 : b.adjust;
    // ассорти: пустые строки-дрипы не сохраняем
    const drips = b.assorted ? (b.drips ?? []).filter((d) => d.name || d.country || d.region || d.notes) : b.drips;
    saveBean({ ...b, drips, adjust, sample: dirty ? undefined : b.sample });
    platform.haptic('success');
    back(true);
  };

  return (
    <Screen title={drip ? (isNew ? 'Новые дрипы' : 'Редактировать дрипы') : isNew ? 'Новая пачка' : 'Редактировать пачку'}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={(!isNew && !dirty) || (!b.name && !b.country && !b.barcode && !(b.parts ?? []).some((p) => p.country) && !(b.drips ?? []).some((d) => d.name || d.country))}>Сохранить</Button></div>}>

      {!kindLocked && (
        <Segmented value={drip ? 'drip' : 'beans'} onChange={(v) => setKind(v)}
          options={[{ value: 'beans', label: 'Зерно' }, { value: 'drip', label: 'Дрип-пакеты' }]} />
      )}

      <div className="scan-field">
        <Field label="Штрихкод / QR" id="bean-barcode" value={b.barcode} inputMode="numeric" onChange={(e) => set({ barcode: e.target.value })}
          onBlur={() => { if (b.barcode && b.barcode !== bean.barcode && /^\d{8,14}$/.test(b.barcode)) onCode(b.barcode); }}
          suffix={<button type="button" className="icon-btn" onClick={() => setScan(true)} aria-label="Сканировать"><Icon name="scan" /></button>} />
        {status && <p className="status">{status}</p>}
      </div>

      <Section title="Основное">
        {f('name', drip ? 'Название' : 'Название лота', { placeholder: drip ? (b.assorted ? 'Ассорти «Африка»' : 'Гуджи Ханджа') : 'Гуджи Ханджа' })}
        {f('roaster', 'Обжарщик')}
      </Section>

      {drip && (
        <Section title="Коробка" plain>
          <Segmented value={b.assorted ? 'mix' : 'same'} onChange={(v) => setAssorted(v === 'mix')}
            options={[{ value: 'same', label: 'Все дрипы одинаковые' }, { value: 'mix', label: 'Разные' }]} />
          {!b.assorted && <>
            <p className="muted pad small-note">Сколько дрипов в коробке</p>
            <Chips options={DRIP_COUNTS.map((n) => `${n} шт`)} value={b.dripCount ? [`${b.dripCount} шт`] : []}
              onToggle={(v) => set({ dripCount: b.dripCount === parseInt(v) ? undefined : parseInt(v) })} />
          </>}
          <p className="muted pad small-note">Кофе в одном дрипе</p>
          <Chips options={DRIP_WEIGHTS.map((n) => `${n} г`)} value={b.dripWeight ? [`${b.dripWeight} г`] : []}
            onToggle={(v) => set({ dripWeight: b.dripWeight === parseInt(v) ? undefined : parseInt(v) })} />
          <div className="group" style={{ marginTop: 10 }}>
            {!b.assorted && numField('Дрипов в коробке', 'bean-drip-count', b.dripCount, (n) => set({ dripCount: n === undefined ? undefined : Math.round(n) }), 'шт')}
            {numField('Кофе в дрипе', 'bean-drip-weight', b.dripWeight, (n) => set({ dripWeight: n }), 'г')}
            {isNew && (
              <Field label="Осталось сейчас, шт" id="bean-left" inputMode="numeric" placeholder={String(dripTotal(b) || '')}
                value={leftText} onChange={(e) => setLeftText(e.target.value)} />
            )}
          </div>
        </Section>
      )}

      {!(drip && b.assorted) && (
        <Segmented value={b.isBlend ? 'blend' : 'single'} onChange={(v) => setBlend(v === 'blend')}
          options={[{ value: 'single', label: 'Моносорт' }, { value: 'blend', label: 'Бленд' }]} />
      )}
      <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="processes">{PROCESSES.map((x) => <option key={x} value={x} />)}</datalist>

      {drip && b.assorted ? (
        <Section title={`Дрипы в коробке · ${dripTotal(b)} шт`} plain>
          <div className="drip-editor">
            {(b.drips ?? []).map((d, i) => (
              <div className="drip-row" key={d.id}>
                <div className="drip-row-head">
                  <span className="step-num">{i + 1}</span>
                  <input className="drip-name" aria-label={`Дрип ${i + 1}: название`} placeholder="Название или лот" value={d.name} onChange={(e) => setDrip(i, { name: e.target.value })} />
                  <label className="drip-count">
                    <input inputMode="numeric" aria-label={`Дрип ${i + 1}: сколько штук`} value={d.count || ''} placeholder="0"
                      onChange={(e) => setDrip(i, { count: parseInt(e.target.value.replace(/\D/g, '')) || 0 })} />
                    <span>шт</span>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => removeDrip(i)} aria-label={`Удалить дрип ${i + 1}`}><Icon name="close" size={18} /></button>
                </div>
                <div className="drip-row-grid">
                  <input list="countries" aria-label={`Дрип ${i + 1}: страна`} placeholder="Страна" value={d.country} onChange={(e) => setDrip(i, { country: e.target.value })} />
                  <input aria-label={`Дрип ${i + 1}: регион`} placeholder="Регион" value={d.region} onChange={(e) => setDrip(i, { region: e.target.value })} />
                  <input aria-label={`Дрип ${i + 1}: ферма`} placeholder="Ферма / станция" value={d.farm} onChange={(e) => setDrip(i, { farm: e.target.value })} />
                  <input aria-label={`Дрип ${i + 1}: сорт`} placeholder="Сорт" value={d.variety} onChange={(e) => setDrip(i, { variety: e.target.value })} />
                  <input list="processes" aria-label={`Дрип ${i + 1}: обработка`} placeholder="Обработка" value={d.process} onChange={(e) => setDrip(i, { process: e.target.value })} />
                  <select aria-label={`Дрип ${i + 1}: обжарка`} value={d.roastLevel} onChange={(e) => setDrip(i, { roastLevel: e.target.value })}>
                    <option value="">Обжарка</option>
                    {ROAST_LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <input aria-label={`Дрип ${i + 1}: дескрипторы`} placeholder="Дескрипторы с упаковки" value={d.notes} onChange={(e) => setDrip(i, { notes: e.target.value })} />
              </div>
            ))}
            <button type="button" className="add-step" onClick={addDrip}><Icon name="plus" size={18} />Добавить дрип</button>
          </div>
        </Section>
      ) : !b.isBlend ? <>
        <Section title="Происхождение">
          {f('country', 'Страна', { list: 'countries' })}
          {f('region', 'Регион')}
          {f('farm', 'Ферма / станция')}
          {f('producer', 'Производитель')}
          {f('altitude', 'Высота', { placeholder: '1900–2100 м' })}
        </Section>

        <Section title="Обработка" plain>
          <Chips options={PROCESSES} value={[b.process]} onToggle={(p) => set({ process: b.process === p ? '' : p })} />
          <div className="group" style={{ marginTop: 10 }}>
            {f('process', 'Своя обработка', { placeholder: 'например, Double fermentation' })}
            {f('variety', 'Сорт', { placeholder: 'Гейша, SL28, Бурбон…' })}
            {f('harvest', 'Урожай', { placeholder: '2026' })}
          </div>
        </Section>
      </> : (
        <Section title="Состав бленда" aside={<span className={'muted' + (shareSum !== null && Math.abs(shareSum - 100) > 0.01 ? ' warn-text' : '')}>{shareSum !== null ? `сумма ${fmtNum(shareSum, 1)}%` : ''}</span>} plain>
          <div className="blend-editor">
            {(b.parts ?? []).map((p, i) => (
              <div className="blend-part" key={p.id}>
                <div className="blend-part-head">
                  <span className="step-num">{i + 1}</span>
                  <input className="blend-country" list="countries" aria-label={`Компонент ${i + 1}: страна`} placeholder="Страна" value={p.country}
                    onChange={(e) => setPart(i, { country: e.target.value })} />
                  <label className="blend-share">
                    <input inputMode="decimal" aria-label={`Компонент ${i + 1}: доля`} placeholder="—" value={p.share}
                      onChange={(e) => setPart(i, { share: e.target.value.replace(/[^\d.,]/g, '') })} />
                    <span>%</span>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => removePart(i)} aria-label={`Удалить компонент ${i + 1}`}><Icon name="close" size={18} /></button>
                </div>
                <div className="blend-part-grid">
                  <input aria-label={`Компонент ${i + 1}: регион`} placeholder="Регион" value={p.region} onChange={(e) => setPart(i, { region: e.target.value })} />
                  <input aria-label={`Компонент ${i + 1}: ферма`} placeholder="Ферма / станция" value={p.farm} onChange={(e) => setPart(i, { farm: e.target.value })} />
                  <input aria-label={`Компонент ${i + 1}: сорт`} placeholder="Сорт" value={p.variety} onChange={(e) => setPart(i, { variety: e.target.value })} />
                  <input aria-label={`Компонент ${i + 1}: обработка`} list="processes" placeholder="Обработка" value={p.process} onChange={(e) => setPart(i, { process: e.target.value })} />
                </div>
              </div>
            ))}
            <button type="button" className="add-step" onClick={addPart}><Icon name="plus" size={18} />Добавить компонент</button>
          </div>
        </Section>
      )}

      {!drip && (
        <Section title="Вес пачки" plain>
          <Chips options={PACK_SIZES.map((x) => `${x} г`)} value={b.weight ? [`${b.weight} г`] : []}
            onToggle={(v) => set({ weight: b.weight === v.replace(' г', '') ? '' : v.replace(' г', '') })} />
        </Section>
      )}

      <Section title="Обжарка" plain>
        <Chips options={ROAST_LEVELS} value={[b.roastLevel]} onToggle={(p) => set({ roastLevel: b.roastLevel === p ? '' : p })} />
        <div className="group" style={{ marginTop: 10 }}>
          {f('roastDate', 'Дата обжарки', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
          {!drip && f('weight', 'Вес пачки, г', { inputMode: 'numeric', placeholder: '250' })}
          {!drip && isNew && b.weight && (
            <Field label="Осталось сейчас, г" id="bean-left" inputMode="decimal" placeholder={b.weight}
              value={leftText} onChange={(e) => setLeftText(e.target.value)} />
          )}
        </div>
      </Section>

      <Section title="Заметки">
        {f('packNotes', 'Дескрипторы с пачки', { placeholder: 'бергамот, персик, жасмин' })}
        {f('link', 'Ссылка на лот', { type: 'url', placeholder: 'https://' })}
        <textarea id="bean-comment" className="notes" rows={3} placeholder="Где купил, цена, впечатления" value={b.comment} onChange={(e) => set({ comment: e.target.value })} />
      </Section>

      {scan && <Scanner onResult={onCode} onClose={() => setScan(false)} />}
    </Screen>
  );
}
