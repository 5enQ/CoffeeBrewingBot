import { useEffect, useState } from 'react';
import { EVENTS, EVENT_NAMES, type Metrics } from '../data/metrics';
import { fmtNum, methodById } from '../data/methods';
import { loadMetrics } from '../data/track';
import { Button, Section } from '../ui/kit';
import { MethodIcon } from '../ui/icons';

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
const dm = (day: string) => { const [, m, d] = day.split('-'); return `${Number(d)}.${m}`; };

/** Owner: how the app is used — counts only, no one can be told apart in them; the owner's own use is left out */
export function OwnerMetrics() {
  const [m, setM] = useState<Metrics | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const load = () => { setState('loading'); loadMetrics().then((x) => { setM(x); setState(x ? 'ok' : 'failed'); }); };
  useEffect(load, []);
  if (!m) return (
    <Section title="Метрики">
      <p className="muted pad small-note">{state === 'loading' ? 'Считаем…' : 'Сервер не ответил.'}</p>
      {state === 'failed' && <div className="pad"><Button kind="secondary" icon="reset" onClick={load}>Повторить</Button></div>}
    </Section>
  );
  const u = m.users, b = m.brews;
  const top = Math.max(1, ...m.days.map((d) => Math.max(d.brews, d.active)));
  const methodTop = Math.max(1, ...b.methods.map((x) => x.d30));
  const feats = EVENT_NAMES.map((ev) => ({ ev, n: m.features[ev] ?? 0 })).sort((a, z) => z.n - a.n);
  const featTop = Math.max(1, ...feats.map((f) => f.n));
  return (
    <Section title="Метрики" aside={<button type="button" className="link-btn" onClick={load}>Обновить</button>}>
      <div className="metric-tiles">
        <div className="metric-tile"><b>{u.total}</b><span>человек всего</span><small>+{u.new7} за неделю · +{u.new30} за месяц</small></div>
        <div className="metric-tile"><b>{u.seen7}</b><span>открывали за неделю</span><small>сегодня {u.seen1} · за месяц {u.seen30}</small></div>
        <div className="metric-tile"><b>{u.brewing7}</b><span>заваривали за неделю</span><small>за месяц {u.brewing30} · {pct(u.brewing30, u.seen30)} открывших</small></div>
        <div className="metric-tile"><b>{pct(u.back.n, u.back.of)}</b><span>возвращаются</span><small>{u.back.of ? `${u.back.n} из ${u.back.of}, пришедших 8–37 дней назад, открывали за неделю` : 'пока не из кого считать'}</small></div>
        <div className="metric-tile"><b>{b.d7}</b><span>заварок за неделю</span><small>за месяц {b.d30} · всего {b.total}</small></div>
        <div className="metric-tile"><b>{fmtNum(b.perActive30, 1)}</b><span>заварок на человека</span><small>за месяц, у заваривавших · {fmtNum(b.liters30, 1)} л</small></div>
      </div>

      <div className="metric-days" role="img" aria-label="Последние 30 дней: заварки и люди, открывавшие приложение">
        {m.days.map((d) => (
          <div key={d.day} className="metric-day" title={`${dm(d.day)}: заварок ${d.brews}, открывали ${d.active}`}>
            <span className="bar brews" style={{ height: `${(d.brews / top) * 100}%` }} />
            <span className="bar active" style={{ height: `${(d.active / top) * 100}%` }} />
          </div>
        ))}
      </div>
      <p className="metric-legend"><span><i className="brews" />заварки</span><span><i className="active" />открывали приложение</span><span className="muted">{dm(m.days[0].day)} – {dm(m.days[m.days.length - 1].day)}</span></p>

      <h4 className="metric-h">Методы за месяц</h4>
      {b.methods.length ? (
        <ul className="metric-list">
          {b.methods.map((x) => { const meth = methodById(x.id); return (
            <li key={x.id}>
              <span className="metric-name"><MethodIcon icon={meth.icon} size={20} />{meth.name}</span>
              <span className="metric-bar"><i style={{ width: `${(x.d30 / methodTop) * 100}%` }} /></span>
              <b>{x.d30}</b><small className="muted">{x.all} всего</small>
            </li>
          ); })}
        </ul>
      ) : <p className="muted pad small-note">Заварок пока нет.</p>}

      <h4 className="metric-h">Чем пользуются за месяц</h4>
      <ul className="metric-list feats">
        {feats.map((f) => (
          <li key={f.ev} className={f.n ? '' : 'zero'}>
            <span className="metric-name">{EVENTS[f.ev]}</span>
            <span className="metric-bar"><i style={{ width: `${(f.n / featTop) * 100}%` }} /></span>
            <b>{f.n}</b>
          </li>
        ))}
      </ul>
      <p className="muted pad small-note">Карточек профиля: {m.extra.cards} · напоминаний о долгом таймере за месяц: {m.extra.reminders30} · заваривали редкие лоты: {m.extra.rare}.</p>
      <p className="muted pad small-note">Только числа: сервер не хранит, кто что нажимал, — приложение присылает «это было N раз», и оно прибавляется к общему счётчику дня. Ваши заварки и нажатия не считаются. Посещения и счётчики копятся с версии, где появились метрики; заварки — за всё время.</p>
    </Section>
  );
}
