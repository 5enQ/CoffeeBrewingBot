import { StarChar } from '../ui/ascii';
import { exactMass, extraction } from '../data/extraction';
import { Roll } from '../ui/motion';
import { BREWS, plural as pluralOf } from '../data/plural';
import { useMemo, useState } from 'react';
import { cupScore, QUALITY, CUP_ATTRS, toneOf, SCORE_MIN, SCORE_MAX } from '../data/cupping';
import { allMethods, methodById, fmtRatio, fmtTime, fmtNum } from '../data/methods';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { useRouter, useSelected } from '../router';
import { BrewScore, CvaBadge, ScoreBadge } from '../ui/CuppingForm';
import { CvaSummary } from '../ui/Cva';
import { brewBeanIds, brewSca } from '../data/cva';
import { MethodIcon, Icon } from '../ui/icons';
import { catById } from '../data/gear';
import { AuthorBlock } from '../ui/Badges';
import { RateBlock, plural } from '../ui/RateBlock';
import { Button, Chips, Empty, Row, SampleTag, Screen, Section, Stars } from '../ui/kit';
import { beanMeta, beanTitle, brewBeanTitle, dripAsBean } from './beanUtils';
import { intlLocale, tr, trValue } from '../i18n';

function dayLabel(ts: number) {
  const d = new Date(ts); const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return tr('Сегодня');
  if (diff === 1) return tr('Вчера');
  return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function Journal() {
  const { brews, beans } = useStore();
  const { push, setTab } = useRouter();
  const [method, setMethod] = useState<string | null>(null);
  const sel = useSelected();

  const used = useMemo(() => allMethods().filter((m) => brews.some((b) => b.methodId === m.id)), [brews]);
  const list = method ? brews.filter((b) => b.methodId === method) : brews;

  const groups = useMemo(() => {
    const out: { label: string; items: typeof list }[] = [];
    for (const b of list) {
      const label = dayLabel(b.date);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(b); else out.push({ label, items: [b] });
    }
    return out;
  }, [list]);

  const rated = brews.filter((b) => b.rating > 0);
  const avg = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0;
  const cuppedScores = brews.map(brewSca).filter((x): x is number => x !== null);

  return (
    <Screen title={tr('Дневник')} root>
      {brews.length > 0 && (
        // the best cupping score only for those who cup
        <div className={'stats' + (cuppedScores.length ? '' : ' two')}>
          {/* one line under each number: the three tiles keep one height */}
          <div><b><Roll text={String(brews.length)} /></b><span>{pluralOf(brews.length, BREWS)}</span></div>
          <div><b><Roll text={avg ? fmtNum(avg) : '—'} />{avg ? <span className="stat-star" aria-hidden="true"><StarChar /></span> : null}</b><span>{tr('в среднем')}</span></div>
          {cuppedScores.length > 0 && <div><b><Roll text={fmtNum(Math.max(...cuppedScores), 2)} /></b><span>{tr('лучший балл')}</span></div>}
        </div>
      )}

      {used.length > 1 && (
        <div className="filter-row">
          <Chips options={[tr('Все'), ...used.map((m) => m.name)]}
            value={[method ? methodById(method).name : tr('Все')]}
            onToggle={(n) => setMethod(n === tr('Все') ? null : used.find((m) => m.name === n)!.id)} />
        </div>
      )}

      {groups.length === 0 && (
        <Empty title={tr('Пока пусто')} text={tr('Заварите кофе по таймеру или запишите заварку вручную — она появится здесь.')}
          action={<Button onClick={() => setTab('brew')}>{tr('Заварить')}</Button>} />
      )}

      {groups.map((g) => (
        <Section key={g.label} title={g.label}>
          {g.items.map((b) => {
            const m = methodById(b.methodId);
            const bean = beans.find((x) => x.id === b.beanId);
            return (
              <Row key={b.id}
                leading={<MethodIcon icon={m.icon} size={26} />}
                // the title whole; under it one line: the «пример» tag, grams and time (the icon says the method — named only when no coffee names the brew; the ratio is inside)
                label={b.cva && b.cva.samples.length > 1 ? tr('Каппинг · {0} образца', b.cva.samples.length) : brewBeanTitle(b, bean)}
                hint={<span className="one-line">{b.sample && <SampleTag />}<span className="one-line-text">{b.cva ? `${m.name} · ${b.cva.samples.map((s) => beanTitle(beans.find((x) => x.id === s.beanId))).join(', ')}` : tr('{0}{1}{2} → {3} г · {4}', b.author ? tr('от {0} · ', b.author.name || '@' + b.author.username) : '', bean ? '' : `${m.name} · `, fmtNum(b.dose, 2), fmtNum(b.water), fmtTime(b.time))}</span></span>}
                value={b.unrated ? <span className="unrated-tag">{tr('не оценена')}</span> : <BrewScore brew={b} size={12} />}
                onClick={() => push({ name: 'brew', id: b.id })}
                active={sel?.name === 'brew' && sel.id === b.id}
              />
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}

export function BrewDetail({ id, fresh }: { id: string; fresh?: boolean }) {
  const { brews, beans, deleteBrew, profile } = useStore();
  const { push, back, setTab } = useRouter();
  const b = brews.find((x) => x.id === id);
  if (!b) return <Screen title={tr('Запись удалена')}><Empty title={tr('Нет такой записи')} text={tr('Её удалили.')} /></Screen>;
  const m = methodById(b.methodId);
  const bean = beans.find((x) => x.id === b.beanId);
  const c = b.cupping;

  const remove = async () => {
    if (!(await platform.confirm(tr('Удалить эту запись?')))) return;
    platform.haptic('warning');
    back(true);
    deleteBrew(b.id);
  };

  return (
    <Screen title={b.cva && b.cva.samples.length > 1 ? tr('Каппинг · {0} образца', b.cva.samples.length) : brewBeanTitle(b, bean)} subtitle={`${m.name} · ${new Date(b.date).toLocaleString(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'share', id: b.id })} aria-label={tr('Поделиться')}><Icon name="share" /></button>}
      footer={
        <div className="footer-actions">
          <button type="button" className="round-btn" onClick={remove} aria-label={tr('Удалить')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg></button>
          <Button kind="secondary" icon="edit" onClick={() => push({ name: 'brewEdit', draft: b, isNew: false })}>{tr('Изменить')}</Button>
          {fresh
            ? <Button icon="home" wide onClick={() => setTab('brew')}>{tr('Домой')}</Button>
            : <Button icon="repeat" wide onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}>{tr('Повторить')}</Button>}
        </div>
      }>
      {b.unrated && (
        <button type="button" className="unrated-banner" onClick={() => push({ name: 'brewEdit', draft: b, isNew: false })}>
          <span><b>{tr('Вы не оценили эту заварку')}</b><small>{tr('Вкус, звёзды и заметки — пока помните')}</small></span>
          <span className="unrated-go">{tr('Оценить')}<Icon name="chevron" size={16} /></span>
        </button>
      )}
      {b.author && <AuthorBlock author={b.author} />}
      {b.author && b.shareId && b.authorId && <RateBlock rid={b.shareId} author={b.authorId} authorName={b.author.name} />}
      {!b.author && b.shareId && profile.ratingStats?.recipes[b.shareId] && (
        <div className="friends-rating">
          <span>{tr('Оценки друзей')}</span>
          <b>{fmtNum(profile.ratingStats.recipes[b.shareId].avg)} <StarChar /></b>
          <small>{profile.ratingStats.recipes[b.shareId].count} {plural(profile.ratingStats.recipes[b.shareId].count)}</small>
        </div>
      )}

      {b.cva ? (<>
        <div className="detail-head"><span className="muted">{tr('Оценка SCA CVA')}</span><CvaBadge score={brewSca(b)} big /></div>
        <dl className="param-grid">
          <div><dt>{tr('На чашку')}</dt><dd>{fmtNum(b.dose, 1)}{'\u00a0'}{tr('г')}</dd></div>
          <div><dt>{tr('Вода')}</dt><dd>{b.water}{'\u00a0'}{tr('мл')}</dd></div>
          <div><dt>{tr('Температура')}</dt><dd>{fmtNum(b.temp)}{'\u00a0'}°C</dd></div>
          <div><dt>{tr('Чашек')}</dt><dd>{b.cva.cups}{'\u00a0'}×{'\u00a0'}{b.cva.samples.length}</dd></div>
          <div><dt>{tr('Время')}</dt><dd>{fmtTime(b.time)}</dd></div>
          <div><dt>{tr('Помол')}</dt><dd className="dd-text">{b.grind || '—'}</dd></div>
        </dl>
        <Section title={tr('Образцы')} plain><CvaSummary session={b.cva} /></Section>
        {b.notes && <Section title={tr('Заметки')}><p className="note-text">{b.notes}</p></Section>}
        <Section title={tr('Зерно')}>
          {brewBeanIds(b).map((id) => beans.find((x) => x.id === id)).filter(Boolean).map((x) => (
            <Row key={x!.id} label={beanTitle(x)} hint={beanMeta(x!)} onClick={() => push({ name: 'bean', id: x!.id })} />
          ))}
        </Section>
        {b.gear && b.gear.length > 0 && (
          <Section title={tr('Оборудование')}>
            {b.gear.map((g) => <Row key={g.id} label={g.name} hint={g.details} value={catById(g.cat).one} />)}
          </Section>
        )}
      </>) : (<>
      <div className="detail-head">
        {c && (b.methodId === 'cupping' || !b.rating) ? <><span className="muted">{tr('Оценка по анкете SCA')}</span><ScoreBadge c={c} big /></> : <Stars value={b.rating} size={26} />}
      </div>

      <dl className="param-grid">
        <div><dt>{tr('Кофе')}</dt><dd>{tr('{0} г', fmtNum(b.dose, 2))}</dd></div>
        <div><dt>{m.yieldLabel ?? tr('Вода')}</dt><dd>{tr('{0} г', fmtNum(b.water))}</dd></div>
        <div><dt>{tr('Пропорция')}</dt><dd>{fmtRatio(b.water / b.dose)}</dd></div>
        <div><dt>{tr('Температура')}</dt><dd>{b.temp ? `${fmtNum(b.temp)}°C` : tr('холодная')}</dd></div>
        <div><dt>{tr('Время')}</dt><dd>{fmtTime(b.time)}</dd></div>
        <div><dt>{tr('Помол')}</dt><dd className="dd-text">{b.grind || '—'}</dd></div>
        {b.ppm !== undefined && <div><dt>{tr('Вода')}</dt><dd>{b.ppm}{'\u00a0'}ppm</dd></div>}
        {b.tds !== undefined && <div><dt>TDS</dt><dd>{fmtNum(b.tds, 2)}{'\u00a0'}%</dd></div>}
        {b.beverage !== undefined && <div><dt>{tr('Напиток')}</dt><dd>{fmtNum(b.beverage)}{'\u00a0'}{tr('г')}</dd></div>}
        {extraction(b) !== null && <div><dt>{tr('Экстракция')}</dt><dd>{exactMass(b) ? '' : '≈\u00a0'}{fmtNum(extraction(b)!, 1)}{'\u00a0'}%</dd></div>}
      </dl>

      {b.plan && (
        <Section title={tr('Рецепт')}>
          <Row label={b.plan.name} hint={b.plan.steps.map((st) => `${fmtTime(st.at)} ${st.title}${st.to !== undefined ? tr(' · {0} г', fmtNum(b.water * st.to, 0)) : ''}`).join('  →  ')} />
        </Section>
      )}

      {b.gear && b.gear.length > 0 && (
        <Section title={tr('Оборудование')}>
          {b.gear.map((g) => <Row key={g.id} label={g.name} hint={g.details} value={catById(g.cat).one} />)}
        </Section>
      )}

      {bean && (
        <Section title={tr('Зерно')}>
          <Row label={brewBeanTitle(b, bean)} hint={b.dripId ? beanMeta(dripAsBean(bean, b.dripId)) : beanMeta(bean)} onClick={() => push({ name: 'bean', id: bean.id })} />
        </Section>
      )}

      <Section title={tr('Вкус')}>
        <div className="taste-bars">
          {([[tr('Кислотность'), b.taste.acidity], [tr('Сладость'), b.taste.sweetness], [tr('Горечь'), b.taste.bitterness], [tr('Тело'), b.taste.body]] as const).map(([l, v]) => (
            <div key={l}><span>{l}</span><i style={{ ['--w' as string]: `${(v / 5) * 100}%` }} /><b>{v}</b></div>
          ))}
        </div>
      </Section>

      {b.descriptors.length > 0 && (
        <Section title={tr('Дескрипторы')} plain>
          <div className="chips static">{b.descriptors.map((d) => <span key={d} className="chip on" data-tone={toneOf(d)}>{trValue(d)}</span>)}</div>
        </Section>
      )}

      {b.notes && <Section title={tr('Заметки')}><p className="note-text">{b.notes}</p></Section>}

      {c && (
        <Section title={tr('Каппинг-анкета')}>
          <div className="cup-bars">
            {QUALITY.map((q) => (
              <div key={q.key}>
                <span>{q.label}</span>
                <i style={{ ['--w' as string]: `${((c.scores[q.key] - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%` }} />
                <b>{c.scores[q.key].toFixed(2).replace('.', ',')}</b>
              </div>
            ))}
            {CUP_ATTRS.map((a) => (
              <div key={a.key} className="cup-row">
                <span>{a.label}</span>
                <span className="mini-cups">{c.cups[a.key].map((ok, i) => <em key={i} className={ok ? 'on' : ''} />)}</span>
                <b>{c.cups[a.key].filter(Boolean).length * 2}</b>
              </div>
            ))}
            {(c.defects.taintCups > 0 || c.defects.faultCups > 0) && (
              <div className="cup-row"><span>{tr('Дефекты')}</span><span /><b>−{cupScore(c).defects}</b></div>
            )}
          </div>
        </Section>
      )}
      </>)}
    </Screen>
  );
}
