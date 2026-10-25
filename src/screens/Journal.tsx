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
import { beanMeta, beanTitle } from './beanUtils';

function dayLabel(ts: number) {
  const d = new Date(ts); const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
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
    <Screen title="Дневник" root>
      {brews.length > 0 && (
        <div className="stats">
          <div><b>{brews.length}</b><span>заварок</span></div>
          <div><b>{avg ? fmtNum(avg) : '—'}</b><span>средняя оценка</span></div>
          <div><b>{cuppedScores.length ? fmtNum(Math.max(...cuppedScores), 2) : '—'}</b><span>лучший каппинг</span></div>
        </div>
      )}

      {used.length > 1 && (
        <div className="filter-row">
          <Chips options={['Все', ...used.map((m) => m.name)]}
            value={[method ? methodById(method).name : 'Все']}
            onToggle={(n) => setMethod(n === 'Все' ? null : used.find((m) => m.name === n)!.id)} />
        </div>
      )}

      {groups.length === 0 && (
        <Empty title="Пока пусто" text="Заварите кофе по таймеру или запишите заварку вручную — она появится здесь."
          action={<Button onClick={() => setTab('brew')}>Заварить</Button>} />
      )}

      {groups.map((g) => (
        <Section key={g.label} title={g.label}>
          {g.items.map((b) => {
            const m = methodById(b.methodId);
            const bean = beans.find((x) => x.id === b.beanId);
            return (
              <Row key={b.id}
                leading={<MethodIcon icon={m.icon} size={26} />}
                label={<>{b.cva && b.cva.samples.length > 1 ? `Каппинг · ${b.cva.samples.length} образца` : beanTitle(bean)} {b.sample && <SampleTag />}</>}
                hint={b.cva ? `${m.name} · ${b.cva.samples.map((s) => beanTitle(beans.find((x) => x.id === s.beanId))).join(', ')}` : `${b.author ? `от ${b.author.name || '@' + b.author.username} · ` : ''}${m.name} · ${fmtNum(b.dose, 2)} г → ${fmtNum(b.water)} г · ${fmtRatio(b.water / b.dose)} · ${fmtTime(b.time)}`}
                value={<BrewScore brew={b} size={14} />}
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

export function BrewDetail({ id }: { id: string }) {
  const { brews, beans, deleteBrew, profile } = useStore();
  const { push, back } = useRouter();
  const b = brews.find((x) => x.id === id);
  if (!b) return <Screen title="Запись удалена"><Empty title="Нет такой записи" text="Её удалили." /></Screen>;
  const m = methodById(b.methodId);
  const bean = beans.find((x) => x.id === b.beanId);
  const c = b.cupping;

  const remove = async () => {
    if (!(await platform.confirm('Удалить эту запись?'))) return;
    platform.haptic('warning');
    back(true);
    deleteBrew(b.id);
  };

  return (
    <Screen title={b.cva && b.cva.samples.length > 1 ? `Каппинг · ${b.cva.samples.length} образца` : beanTitle(bean)} subtitle={`${m.name} · ${new Date(b.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
      action={<button type="button" className="icon-btn" onClick={() => push({ name: 'share', id: b.id })} aria-label="Поделиться"><Icon name="share" /></button>}
      footer={
        <div className="footer-actions">
          <button type="button" className="round-btn" onClick={remove} aria-label="Удалить"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg></button>
          <Button kind="secondary" icon="edit" onClick={() => push({ name: 'brewEdit', draft: b, isNew: false })}>Изменить</Button>
          <Button icon="repeat" wide onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}>Повторить</Button>
        </div>
      }>
      {b.author && <AuthorBlock author={b.author} />}
      {b.author && b.shareId && b.authorId && <RateBlock rid={b.shareId} author={b.authorId} authorName={b.author.name} />}
      {!b.author && b.shareId && profile.ratingStats?.recipes[b.shareId] && (
        <div className="friends-rating">
          <span>Оценки друзей</span>
          <b>{fmtNum(profile.ratingStats.recipes[b.shareId].avg)} ★</b>
          <small>{profile.ratingStats.recipes[b.shareId].count} {plural(profile.ratingStats.recipes[b.shareId].count)}</small>
        </div>
      )}

      {b.cva ? (<>
        <div className="detail-head"><span className="muted">Оценка SCA CVA</span><CvaBadge score={brewSca(b)} big /></div>
        <dl className="param-grid">
          <div><dt>На чашку</dt><dd>{fmtNum(b.dose, 1)}{'\u00a0'}г</dd></div>
          <div><dt>Вода</dt><dd>{b.water}{'\u00a0'}мл</dd></div>
          <div><dt>Температура</dt><dd>{fmtNum(b.temp)}{'\u00a0'}°C</dd></div>
          <div><dt>Чашек</dt><dd>{b.cva.cups}{'\u00a0'}×{'\u00a0'}{b.cva.samples.length}</dd></div>
          <div><dt>Время</dt><dd>{fmtTime(b.time)}</dd></div>
          <div><dt>Помол</dt><dd className="dd-text">{b.grind || '—'}</dd></div>
        </dl>
        <Section title="Образцы" plain><CvaSummary session={b.cva} /></Section>
        {b.notes && <Section title="Заметки"><p className="note-text">{b.notes}</p></Section>}
        <Section title="Зерно">
          {brewBeanIds(b).map((id) => beans.find((x) => x.id === id)).filter(Boolean).map((x) => (
            <Row key={x!.id} label={beanTitle(x)} hint={beanMeta(x!)} onClick={() => push({ name: 'bean', id: x!.id })} />
          ))}
        </Section>
        {b.gear && b.gear.length > 0 && (
          <Section title="Оборудование">
            {b.gear.map((g) => <Row key={g.id} label={g.name} hint={g.details} value={catById(g.cat).one} />)}
          </Section>
        )}
      </>) : (<>
      <div className="detail-head">
        {c && (b.methodId === 'cupping' || !b.rating) ? <><span className="muted">Оценка по анкете SCA</span><ScoreBadge c={c} big /></> : <Stars value={b.rating} size={26} />}
      </div>

      <dl className="param-grid">
        <div><dt>Кофе</dt><dd>{fmtNum(b.dose, 2)} г</dd></div>
        <div><dt>{m.yieldLabel ?? 'Вода'}</dt><dd>{fmtNum(b.water)} г</dd></div>
        <div><dt>Пропорция</dt><dd>{fmtRatio(b.water / b.dose)}</dd></div>
        <div><dt>Температура</dt><dd>{b.temp ? `${fmtNum(b.temp)}°C` : 'холодная'}</dd></div>
        <div><dt>Время</dt><dd>{fmtTime(b.time)}</dd></div>
        <div><dt>Помол</dt><dd className="dd-text">{b.grind || '—'}</dd></div>
      </dl>

      {b.plan && (
        <Section title="Рецепт">
          <Row label={b.plan.name} hint={b.plan.steps.map((st) => `${fmtTime(st.at)} ${st.title}${st.to !== undefined ? ` · ${fmtNum(b.water * st.to, 0)} г` : ''}`).join('  →  ')} />
        </Section>
      )}

      {b.gear && b.gear.length > 0 && (
        <Section title="Оборудование">
          {b.gear.map((g) => <Row key={g.id} label={g.name} hint={g.details} value={catById(g.cat).one} />)}
        </Section>
      )}

      {bean && (
        <Section title="Зерно">
          <Row label={beanTitle(bean)} hint={beanMeta(bean)} onClick={() => push({ name: 'bean', id: bean.id })} />
        </Section>
      )}

      <Section title="Вкус">
        <div className="taste-bars">
          {([['Кислотность', b.taste.acidity], ['Сладость', b.taste.sweetness], ['Горечь', b.taste.bitterness], ['Тело', b.taste.body]] as const).map(([l, v]) => (
            <div key={l}><span>{l}</span><i style={{ ['--w' as string]: `${(v / 5) * 100}%` }} /><b>{v}</b></div>
          ))}
        </div>
      </Section>

      {b.descriptors.length > 0 && (
        <Section title="Дескрипторы" plain>
          <div className="chips static">{b.descriptors.map((d) => <span key={d} className="chip on" data-tone={toneOf(d)}>{d}</span>)}</div>
        </Section>
      )}

      {b.notes && <Section title="Заметки"><p className="note-text">{b.notes}</p></Section>}

      {c && (
        <Section title="Каппинг-анкета">
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
              <div className="cup-row"><span>Дефекты</span><span /><b>−{cupScore(c).defects}</b></div>
            )}
          </div>
        </Section>
      )}
      </>)}
    </Screen>
  );
}
