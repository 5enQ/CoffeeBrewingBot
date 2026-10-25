import { useEffect, useState } from 'react';
import { lookupCode, mergeEmpty } from '../data/lookup';
import { METHODS, methodById, fmtRatio, fmtNum } from '../data/methods';
import { cupScore } from '../data/cupping';
import { emptyBean, uid, useStore, type Bean, type BlendPart } from '../data/store';
import { beanStock, isFinished, PACK_SIZES } from '../data/stock';
import { platform } from '../platform';
import { useBackGuard, useRouter, useSelected } from '../router';
import { MethodIcon, Icon } from '../ui/icons';
import { Button, Chips, Empty, Field, Row, SampleTag, Screen, Section, Segmented, Stars } from '../ui/kit';
import { Scanner } from '../ui/Scanner';
import { ScoreBadge } from '../ui/CuppingForm';
import { beanMeta, beanOrigin, beanTitle, blendLines, PROCESSES, RestBadge, ROAST_LEVELS } from './beanUtils';

/* ---------- Полка ---------- */

/** Полоска остатка пачки: «осталось N из M г» */
export function StockBar({ bean, compact = false }: { bean: Bean; compact?: boolean }) {
  const { brews } = useStore();
  const st = beanStock(bean, brews);
  if (!st.total) return compact ? null : <span className="stock-none">Вес пачки не указан</span>;
  const low = st.left > 0 && (st.brewsLeft !== null ? st.brewsLeft <= 2 : st.ratio < 0.15);
  return (
    <div className={'stock' + (compact ? ' compact' : '') + (low ? ' low' : '') + (st.left <= 0 ? ' empty' : '')}>
      <div className="stock-bar"><i style={{ ['--w' as string]: `${st.ratio * 100}%` }} /></div>
      <div className="stock-text">
        <span><b>{fmtNum(st.left, 0)}</b> из {fmtNum(st.total, 0)} г</span>
        <span>{st.left <= 0 ? 'закончилось' : st.brewsLeft === 0 ? 'меньше чем на заварку' : st.brewsLeft !== null ? `≈ ${st.brewsLeft} ${plural(st.brewsLeft, ['заварка', 'заварки', 'заварок'])}` : 'ещё не заваривали'}</span>
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
  const mine = brews.filter((x) => x.beanId === b.id);
  const rated = mine.filter((x) => x.rating);
  const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 0;
  return (
    <button type="button" className={'bean-card' + (active ? ' active' : '')} aria-current={active || undefined} onClick={onClick}>
      <div className="bean-card-top">
        <b>{beanTitle(b)}</b>
        {b.sample && <SampleTag />}
      </div>
      <span className="bean-card-origin">{beanMeta(b) || 'Происхождение не указано'}</span>
      <StockBar bean={b} />
      <div className="bean-card-foot">
        <span>{b.roaster || '—'}</span>
        <span className="foot-right"><RestBadge roastDate={b.roastDate} />{avg ? <Stars value={Math.round(avg)} size={12} /> : null}</span>
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
  const grams = active.reduce((s, b) => s + beanStock(b, brews).left, 0);

  return (
    <Screen title="Полка" subtitle={active.length ? `${active.length} ${plural(active.length, ['пачка', 'пачки', 'пачек'])} · ${fmtNum(grams / 1000, 2)} кг кофе` : undefined} root
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: emptyBean(), isNew: true })} aria-label="Добавить пачку"><Icon name="plus" /></button>}>
      <button type="button" className="scan-cta" onClick={() => setScan(true)}>
        <Icon name="scan" size={28} />
        <span><b>Добавить пачку</b><small>Отсканируйте штрихкод или QR — или введите вручную</small></span>
      </button>

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
  const mine = brews.filter((x) => x.beanId === b.id);
  const st = beanStock(b, brews);
  const finished = isFinished(b, st);

  const saveFix = () => {
    const n = parseFloat((fix ?? '').replace(',', '.'));
    if (!isNaN(n) && n >= 0) {
      saveBean({ ...b, adjust: Math.round((n - (st.total - st.used)) * 10) / 10, finished: n <= 0 });
      platform.haptic('success');
    }
    setFix(null);
  };
  const toggleFinished = async () => {
    if (finished && st.total > 0 && st.left <= 0) { setFix(''); return; } // вернуть на полку — сначала взвесить остаток
    if (!finished && !(await platform.confirm('Отметить пачку допитой? Она переедет в раздел «Допито».'))) return;
    saveBean({ ...b, finished: !finished });
    platform.haptic('success');
  };
  const buyAgain = () => {
    const { id: _id, createdAt: _c, roastDate: _r, adjust: _a, finished: _f, sample: _s, ...rest } = b;
    push({ name: 'beanEdit', bean: { ...emptyBean(), ...rest }, isNew: true });
  };

  const remove = async () => {
    if (!(await platform.confirm(`Удалить «${beanTitle(b)}»? Заварки останутся в дневнике.`))) return;
    platform.haptic('warning');
    back(true);
    deleteBean(b.id);
  };

  const info: [string, string][] = ([
    ['Обжарщик', b.roaster],
    ...(b.isBlend ? [] : [['Страна', b.country], ['Регион', b.region], ['Ферма / станция', b.farm],
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
          <span>{finished ? 'Пачка допита' : 'Осталось в пачке'}</span>
          {st.total > 0 && fix === null && <button type="button" className="link-btn" onClick={() => setFix(String(st.left).replace('.', ','))}>Взвесить</button>}
        </div>
        {fix !== null ? (
          <form className="stock-fix" onSubmit={(e) => { e.preventDefault(); saveFix(); }}>
            <input id="stock-fix" autoFocus inputMode="decimal" value={fix} onChange={(e) => setFix(e.target.value)} aria-label="Сколько осталось, г" />
            <span>г осталось</span>
            <button type="submit" className="btn btn-primary">OK</button>
          </form>
        ) : (
          <StockBar bean={b} />
        )}
        {st.total > 0 && <p className="muted">Списано заварками: {fmtNum(st.used, 1)} г{b.adjust ? ` · поправка ${b.adjust > 0 ? '+' : ''}${fmtNum(b.adjust, 1)} г` : ''}</p>}
        {!st.total && <Button kind="secondary" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })}>Указать вес пачки</Button>}
        <div className="stock-actions">
          {st.total > 0 && <Button kind="ghost" onClick={toggleFinished}>{finished ? 'Вернуть на полку' : 'Допито'}</Button>}
          <Button kind="secondary" icon="plus" onClick={buyAgain}>Купить ещё</Button>
        </div>
      </div>

      <Section title="Заварить" plain>
        <div className="quick-methods">
          {METHODS.map((m) => (
            <button type="button" key={m.id} onClick={() => push({ name: 'recipes', methodId: m.id, beanId: b.id })}>
              <MethodIcon icon={m.icon} size={26} /><span>{m.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {b.isBlend && (
        <Section title={`Состав бленда · ${(b.parts ?? []).length}`}>
          {blendLines(b).map((l, i) => <Row key={i} label={l.text} value={l.share || undefined} />)}
          {!(b.parts ?? []).length && <p className="muted pad">Компоненты не указаны.</p>}
        </Section>
      )}

      {(info.length > 0 || b.link || b.comment) && (
        <Section title="О пачке">
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
              label={m.name}
              hint={`${new Date(x.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${fmtRatio(x.water / x.dose)} · ${x.grind || 'помол не указан'}`}
              value={x.cupping ? <ScoreBadge c={x.cupping} /> : <Stars value={x.rating} size={13} />}
              onClick={() => push({ name: 'brew', id: x.id })} />
          );
        })}
        {mine.some((x) => x.cupping) && (
          <p className="muted pad">Средний каппинг: {(mine.filter((x) => x.cupping).reduce((s, x) => s + cupScore(x.cupping!).total, 0) / mine.filter((x) => x.cupping).length).toFixed(2).replace('.', ',')}</p>
        )}
      </Section>

      <div className="danger-zone"><Button kind="danger" icon="trash" onClick={remove}>Удалить пачку</Button></div>
    </Screen>
  );
}

/* ---------- Редактор ---------- */

const COUNTRIES = ['Эфиопия', 'Кения', 'Руанда', 'Бурунди', 'Танзания', 'Уганда', 'Колумбия', 'Бразилия', 'Перу', 'Эквадор', 'Боливия', 'Коста-Рика', 'Панама', 'Гватемала', 'Гондурас', 'Сальвадор', 'Никарагуа', 'Мексика', 'Йемен', 'Индонезия', 'Индия', 'Вьетнам', 'Китай', 'Папуа — Новая Гвинея'];

export function BeanEdit({ bean, isNew, scanOnOpen }: { bean: Bean; isNew: boolean; scanOnOpen?: boolean }) {
  const { saveBean, beans } = useStore();
  const { back } = useRouter();
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
    const weight = parseFloat(b.weight.replace(',', '.'));
    const adjust = isNew && !isNaN(left) && !isNaN(weight) && left < weight ? Math.round((left - weight) * 10) / 10 : b.adjust;
    saveBean({ ...b, adjust, sample: dirty ? undefined : b.sample });
    platform.haptic('success');
    back(true);
  };

  return (
    <Screen title={isNew ? 'Новая пачка' : 'Редактировать пачку'}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={(!isNew && !dirty) || (!b.name && !b.country && !b.barcode && !(b.parts ?? []).some((p) => p.country))}>Сохранить</Button></div>}>

      <div className="scan-field">
        <Field label="Штрихкод / QR" id="bean-barcode" value={b.barcode} inputMode="numeric" onChange={(e) => set({ barcode: e.target.value })}
          onBlur={() => { if (b.barcode && b.barcode !== bean.barcode && /^\d{8,14}$/.test(b.barcode)) onCode(b.barcode); }}
          suffix={<button type="button" className="icon-btn" onClick={() => setScan(true)} aria-label="Сканировать"><Icon name="scan" /></button>} />
        {status && <p className="status">{status}</p>}
      </div>

      <Section title="Основное">
        {f('name', 'Название лота', { placeholder: 'Гуджи Ханджа' })}
        {f('roaster', 'Обжарщик')}
      </Section>

      <Segmented value={b.isBlend ? 'blend' : 'single'} onChange={(v) => setBlend(v === 'blend')}
        options={[{ value: 'single', label: 'Моносорт' }, { value: 'blend', label: 'Бленд' }]} />
      <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>

      {!b.isBlend ? <>
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
            <datalist id="processes">{PROCESSES.map((x) => <option key={x} value={x} />)}</datalist>
            <button type="button" className="add-step" onClick={addPart}><Icon name="plus" size={18} />Добавить компонент</button>
          </div>
        </Section>
      )}

      <Section title="Вес пачки" plain>
        <Chips options={PACK_SIZES.map((x) => `${x} г`)} value={b.weight ? [`${b.weight} г`] : []}
          onToggle={(v) => set({ weight: b.weight === v.replace(' г', '') ? '' : v.replace(' г', '') })} />
      </Section>

      <Section title="Обжарка" plain>
        <Chips options={ROAST_LEVELS} value={[b.roastLevel]} onToggle={(p) => set({ roastLevel: b.roastLevel === p ? '' : p })} />
        <div className="group" style={{ marginTop: 10 }}>
          {f('roastDate', 'Дата обжарки', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
          {f('weight', 'Вес пачки, г', { inputMode: 'numeric', placeholder: '250' })}
          {isNew && b.weight && (
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
