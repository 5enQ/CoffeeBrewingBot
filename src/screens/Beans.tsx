import { useEffect, useState } from 'react';
import { lookupCode, mergeEmpty } from '../data/lookup';
import { METHODS, methodById, fmtRatio } from '../data/methods';
import { cupScore } from '../data/cupping';
import { emptyBean, useStore, type Bean } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { MethodIcon, Icon } from '../ui/icons';
import { Button, Chips, Empty, Field, Row, SampleTag, Screen, Section, Stars } from '../ui/kit';
import { Scanner } from '../ui/Scanner';
import { ScoreBadge } from '../ui/CuppingForm';
import { beanOrigin, beanTitle, PROCESSES, RestBadge, ROAST_LEVELS } from './beanUtils';

/* ---------- Список ---------- */

export function Beans() {
  const { beans, brews } = useStore();
  const { push } = useRouter();
  const [scan, setScan] = useState(false);
  const [q, setQ] = useState('');

  const onCode = async (code: string) => {
    setScan(false);
    const r = await lookupCode(code, beans);
    if (r.existing) push({ name: 'bean', id: r.existing.id });
    else push({ name: 'beanEdit', bean: mergeEmpty(emptyBean(), r.patch), isNew: true });
  };

  const list = q
    ? beans.filter((b) => [b.name, b.roaster, b.country, b.region, b.process, b.variety].join(' ').toLowerCase().includes(q.toLowerCase()))
    : beans;

  return (
    <Screen title="Зёрна" root
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: emptyBean(), isNew: true })} aria-label="Добавить зерно"><Icon name="plus" /></button>}>
      <button type="button" className="scan-cta" onClick={() => setScan(true)}>
        <Icon name="scan" size={28} />
        <span><b>Сканировать пачку</b><small>Штрихкод или QR — найду зерно или начну новую карточку</small></span>
      </button>

      {beans.length > 4 && (
        <input id="bean-search" className="search" type="search" placeholder="Поиск: страна, обработка, обжарщик" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {list.length === 0 && <Empty title="Зёрен пока нет" text="Отсканируйте пачку или добавьте зерно вручную." />}

      <div className="bean-list">
        {list.map((b) => {
          const mine = brews.filter((x) => x.beanId === b.id);
          const rated = mine.filter((x) => x.rating);
          const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 0;
          return (
            <button type="button" key={b.id} className="bean-card" onClick={() => push({ name: 'bean', id: b.id })}>
              <div className="bean-card-top">
                <b>{beanTitle(b)}</b>
                {b.sample && <SampleTag />}
              </div>
              <span className="bean-card-origin">{beanOrigin(b) || 'Происхождение не указано'}</span>
              <div className="bean-card-tags">
                {b.process && <span className="tag">{b.process}</span>}
                {b.variety && <span className="tag">{b.variety}</span>}
                <RestBadge roastDate={b.roastDate} />
              </div>
              <div className="bean-card-foot">
                <span>{b.roaster || '—'}</span>
                <span>{mine.length ? `${mine.length} зав.` : 'ещё не заваривали'}{avg ? <> · <Stars value={Math.round(avg)} size={12} /></> : null}</span>
              </div>
            </button>
          );
        })}
      </div>

      {scan && <Scanner onResult={onCode} onClose={() => setScan(false)} />}
    </Screen>
  );
}

/* ---------- Карточка ---------- */

export function BeanDetail({ id }: { id: string }) {
  const { beans, brews, deleteBean } = useStore();
  const { push, back } = useRouter();
  const b = beans.find((x) => x.id === id);
  if (!b) return <Screen title="Зерно удалено"><Empty title="Нет такого зерна" text="Его удалили." /></Screen>;
  const mine = brews.filter((x) => x.beanId === b.id);

  const remove = async () => {
    if (!(await platform.confirm(`Удалить «${beanTitle(b)}»? Заварки останутся в дневнике.`))) return;
    platform.haptic('warning');
    back(true);
    deleteBean(b.id);
  };

  const info: [string, string][] = ([
    ['Обжарщик', b.roaster], ['Страна', b.country], ['Регион', b.region], ['Ферма / станция', b.farm],
    ['Производитель', b.producer], ['Сорт', b.variety], ['Обработка', b.process], ['Высота', b.altitude],
    ['Урожай', b.harvest], ['Обжарка', b.roastLevel],
    ['Дата обжарки', b.roastDate ? new Date(b.roastDate + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
    ['Вес', b.weight ? `${b.weight} г` : ''], ['Штрихкод', b.barcode],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <Screen title={beanTitle(b)} subtitle={beanOrigin(b)}
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'beanEdit', bean: b, isNew: false })} aria-label="Изменить"><Icon name="edit" /></button>}>
      <div className="bean-hero">
        <RestBadge roastDate={b.roastDate} />
        {b.packNotes && <p className="pack-notes">{b.packNotes}</p>}
      </div>

      <Section title="Заварить" plain>
        <div className="quick-methods">
          {METHODS.map((m) => (
            <button type="button" key={m.id} onClick={() => push({ name: 'method', methodId: m.id, beanId: b.id })}>
              <MethodIcon icon={m.icon} size={26} /><span>{m.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="О зерне">
        {info.map(([k, v]) => <Row key={k} label={k} value={v} />)}
        {b.link && <Row label="Ссылка" value="открыть" onClick={() => platform.openLink(b.link)} />}
        {b.comment && <p className="note-text pad">{b.comment}</p>}
      </Section>

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

      <div className="danger-zone"><Button kind="danger" icon="trash" onClick={remove}>Удалить зерно</Button></div>
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
  const dirty = JSON.stringify(b) !== JSON.stringify(bean);
  useBackGuard(dirty, 'Выйти без сохранения?');

  useEffect(() => { if (bean.barcode && isNew && bean.name) setStatus('Данные подставлены по коду — проверьте и дополните.'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Bean>) => setB((x) => ({ ...x, ...patch }));
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
    saveBean({ ...b, sample: dirty ? undefined : b.sample });
    platform.haptic('success');
    back(true);
  };

  return (
    <Screen title={isNew ? 'Новое зерно' : 'Редактировать зерно'}
      footer={<div className="footer-actions"><Button icon="check" wide onClick={save} disabled={!b.name && !b.country && !b.barcode}>Сохранить</Button></div>}>

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

      <Section title="Происхождение">
        {f('country', 'Страна', { list: 'countries' })}
        <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
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

      <Section title="Обжарка" plain>
        <Chips options={ROAST_LEVELS} value={[b.roastLevel]} onToggle={(p) => set({ roastLevel: b.roastLevel === p ? '' : p })} />
        <div className="group" style={{ marginTop: 10 }}>
          {f('roastDate', 'Дата обжарки', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
          {f('weight', 'Вес пачки', { inputMode: 'numeric', placeholder: '250' })}
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
