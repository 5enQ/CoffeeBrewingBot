import { useEffect, useState } from 'react';
import { TIER_LABEL, TRACKS, litersBrewed, progress, type Track } from '../data/achievements';
import { fetchStats, myTelegramId, ratingsEnabled } from '../data/ratings';
import { fmtNum } from '../data/methods';
import { GEAR_CATS, type Gear } from '../data/gear';
import { BADGE_KINDS, CHAMPIONSHIPS, PLACES, Q_TYPES, SCA_EXTRA, SCA_LEVELS, SCA_MODULES, sortBadges, type Badge } from '../data/badges';
import { BadgeChip } from '../ui/Badges';
import { useStore, uid } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { Icon } from '../ui/icons';
import { Button, Chips, Field, Row, SampleTag, Screen, Section } from '../ui/kit';

export function Profile() {
  const store = useStore();
  const { push } = useRouter();
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const { profile, gear } = store;
  const initials = (profile.name || profile.telegram || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const addBadge = (kind: Badge['kind'] = 'sca') => push({ name: 'badgeEdit', badge: { id: uid(), kind, title: '', detail: '', year: '' }, isNew: true });
  const addGear = (cat: Gear['cat']) => push({ name: 'gearEdit', gear: { id: uid(), cat, name: '', details: '' }, isNew: true });

  const copy = async () => {
    const json = store.exportJson();
    try { await navigator.clipboard.writeText(json); setMsg('Резервная копия скопирована в буфер обмена.'); platform.haptic('success'); }
    catch { setPaste(json); setMsg('Буфер недоступен — копия ниже, выделите и скопируйте вручную.'); }
  };

  const download = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brewbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importText = async (text: string) => {
    if (!(await platform.confirm('Заменить все текущие данные данными из копии?'))) return;
    try { store.importJson(text); setMsg('Данные восстановлены.'); setPaste(''); platform.haptic('success'); }
    catch (e) { setMsg((e as Error).message || 'Не получилось прочитать копию.'); platform.haptic('error'); }
  };

  const liters = litersBrewed(store.brews);
  const stats = profile.ratingStats;
  const ratingCount = stats?.count ?? 0;
  const { setRatingStats } = store;
  useEffect(() => {
    const id = myTelegramId();
    if (!ratingsEnabled() || !id) return;
    fetchStats(id).then((st) => { if (st) setRatingStats(st); });
  }, [setRatingStats]);

  const emptyCats = GEAR_CATS.filter((c) => !gear.some((g) => g.cat === c.id));

  return (
    <Screen title="Профиль" root>
      <div className="profile-card">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <div className="profile-fields">
          <input id="profile-name" className="profile-name" placeholder="Ваше имя" value={profile.name}
            onChange={(e) => store.saveProfile({ ...profile, name: e.target.value })} aria-label="Имя автора" />
          <label className="profile-handle" htmlFor="profile-tg">
            <span>@</span>
            <input id="profile-tg" placeholder="username в Telegram" value={profile.telegram} autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onChange={(e) => store.saveProfile({ ...profile, telegram: e.target.value.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '') })} />
          </label>
          <textarea id="profile-about" className="profile-about" rows={2} placeholder="Пара слов о себе: как любите кофе"
            value={profile.about} onChange={(e) => store.saveProfile({ ...profile, about: e.target.value })} />
        </div>
      </div>
      <p className="muted pad">Имя и значки увидят друзья в рецептах, которыми вы поделитесь. Ссылку на Telegram можно не добавлять — это выбирается при отправке.</p>

      <Section title="Достижения" plain>
        <div className="tracks">
          <TrackCard track={TRACKS.liters} value={liters} format={(v) => `${fmtNum(v, v < 10 ? 1 : 0)} л`} />
          <TrackCard track={TRACKS.ratings} value={ratingCount}
            format={(v) => `${v}`}
            note={!ratingsEnabled() ? 'Появится, когда подключим сервер оценок' : !myTelegramId() ? 'Считается для рецептов, отправленных из Telegram' : stats?.count ? `Средняя оценка ${fmtNum(stats.avg)} ★` : 'Поделитесь рецептом — друзья смогут его оценить'} />
        </div>
      </Section>

      <Section title="Значки" aside={
        <button type="button" className="icon-btn" onClick={() => addBadge()} aria-label="Добавить значок"><Icon name="plus" /></button>
      } plain>
        {profile.badges.length > 0 ? (
          <div className="badge-list">
            {sortBadges(profile.badges).map((b) => <BadgeChip key={b.id} b={b} onClick={() => push({ name: 'badgeEdit', badge: b, isNew: false })} />)}
          </div>
        ) : (
          <button type="button" className="badge-empty" onClick={() => addBadge()}>
            <Icon name="medal" size={28} />
            <span><b>Добавьте сертификат или награду</b><small>SCA, Q Grader, места на чемпионатах</small></span>
          </button>
        )}
      </Section>

      <div className="stats">
        <div><b>{store.brews.length}</b><span>заварок</span></div>
        <div><b>{store.beans.length}</b><span>зёрен</span></div>
        <div><b>{gear.length}</b><span>оборудования</span></div>
      </div>

      <Section title="Моё оборудование" aside={
        <button type="button" className="icon-btn" onClick={() => addGear('grinder')} aria-label="Добавить оборудование"><Icon name="plus" /></button>
      } plain>
        <div className="gear-list">
          {GEAR_CATS.filter((c) => gear.some((g) => g.cat === c.id)).map((c) => (
            <div key={c.id} className="gear-block">
              <div className="gear-block-head"><span>{c.label}</span>
                <button type="button" className="link-btn" onClick={() => addGear(c.id)}>Добавить</button>
              </div>
              <div className="group">
                {gear.filter((g) => g.cat === c.id).map((g) => (
                  <Row key={g.id} label={<>{g.name} {g.sample && <SampleTag />}</>} hint={g.details || undefined}
                    onClick={() => push({ name: 'gearEdit', gear: g, isNew: false })} />
                ))}
              </div>
            </div>
          ))}
          {gear.length === 0 && <p className="muted pad">Добавьте кофемолку, воронку или кофемашину — их можно будет отмечать в заварках, и они попадут в рецепт, которым вы поделитесь.</p>}
          {emptyCats.length > 0 && (
            <div className="chips">
              {emptyCats.map((c) => (
                <button type="button" key={c.id} className="chip chip-add" onClick={() => addGear(c.id)}>
                  <Icon name="plus" size={16} /><span>{c.one}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {store.hasSamples && (
        <Section title="Примеры" plain>
          <p className="muted pad">Для наглядности добавлены зёрна, заварки и оборудование с пометкой «пример».</p>
          <Button kind="secondary" onClick={async () => { if (await platform.confirm('Удалить все примеры?')) store.removeSamples(); }}>Удалить примеры</Button>
        </Section>
      )}

      <Section title="Резервная копия" plain>
        <div className="btn-col">
          <Button kind="secondary" onClick={copy}>Скопировать JSON</Button>
          {platform.kind === 'web' && <Button kind="secondary" onClick={download}>Сохранить файлом</Button>}
          <label className="btn btn-secondary">
            <span>Восстановить из файла</span>
            <input type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) importText(await f.text()); }} />
          </label>
        </div>
        <textarea id="backup-paste" className="notes mono" rows={4} placeholder="…или вставьте JSON сюда" value={paste} onChange={(e) => setPaste(e.target.value)} />
        {paste.trim().startsWith('{') && <Button onClick={() => importText(paste)}>Восстановить из текста</Button>}
        {msg && <p className="status">{msg}</p>}
      </Section>

      <Section title="О приложении">
        <Row label="Платформа" value={platform.kind} />
        <Row label="Хранилище" value={platform.kind === 'telegram' ? 'Telegram на устройстве' : platform.kind === 'native' ? 'Память приложения' : 'Браузер'} />
      </Section>
    </Screen>
  );
}

export function GearEdit({ gear: initial, isNew }: { gear: Gear; isNew: boolean }) {
  const { saveGear, deleteGear } = useStore();
  const { back } = useRouter();
  const [g, setG] = useState<Gear>(initial);
  const dirty = JSON.stringify(g) !== JSON.stringify(initial);
  useBackGuard(dirty, 'Выйти без сохранения?');
  const cat = GEAR_CATS.find((c) => c.id === g.cat)!;

  const save = () => {
    saveGear({ ...g, name: g.name.trim(), details: g.details.trim(), sample: dirty ? undefined : g.sample });
    platform.haptic('success');
    back(true);
  };
  const remove = async () => {
    if (!(await platform.confirm(`Удалить «${g.name}»? В старых заварках оно останется.`))) return;
    deleteGear(g.id);
    back(true);
  };

  return (
    <Screen title={isNew ? 'Новое оборудование' : g.name || 'Оборудование'}
      footer={<div className="footer-actions">
        {!isNew && <button type="button" className="round-btn" onClick={remove} aria-label="Удалить"><Icon name="trash" /></button>}
        <Button icon="check" wide onClick={save} disabled={!g.name.trim()}>Сохранить</Button>
      </div>}>
      <Section title="Категория" plain>
        <div className="chips">
          {GEAR_CATS.map((c) => (
            <button type="button" key={c.id} className={'chip' + (g.cat === c.id ? ' on' : '')}
              onClick={() => { platform.haptic('select'); setG({ ...g, cat: c.id }); }}>{c.label}</button>
          ))}
        </div>
      </Section>

      <Section title={cat.one}>
        <Field label="Модель" id="gear-name" value={g.name} list={`sugg-${g.cat}`} placeholder={cat.suggestions[0]}
          onChange={(e) => setG({ ...g, name: e.target.value })} />
        <datalist id={`sugg-${g.cat}`}>{cat.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <Field label="Детали" id="gear-details" value={g.details} placeholder={g.cat === 'grinder' ? 'жернова, доработки' : 'объём, материал, заметки'}
          onChange={(e) => setG({ ...g, details: e.target.value })} />
      </Section>

      <Section title="Популярное" plain>
        <div className="chips">
          {cat.suggestions.map((s) => (
            <button type="button" key={s} className={'chip' + (g.name === s ? ' on' : '')} onClick={() => { platform.haptic('select'); setG({ ...g, name: s }); }}>{s}</button>
          ))}
        </div>
      </Section>
    </Screen>
  );
}

/* ---------- Значок ---------- */

export function BadgeEdit({ badge: initial, isNew }: { badge: Badge; isNew: boolean }) {
  const { profile, saveProfile } = useStore();
  const { back } = useRouter();
  const [b, setB] = useState<Badge>(initial);
  const dirty = JSON.stringify(b) !== JSON.stringify(initial);
  useBackGuard(dirty, 'Выйти без сохранения?');
  const set = (patch: Partial<Badge>) => { platform.haptic('select'); setB((x) => ({ ...x, ...patch })); };
  const pick = (field: 'title' | 'detail', v: string) => set({ [field]: b[field] === v ? '' : v });

  const save = () => {
    const clean = { ...b, title: b.title.trim(), detail: b.detail.trim(), year: b.year.trim() };
    const badges = profile.badges.some((x) => x.id === b.id) ? profile.badges.map((x) => (x.id === b.id ? clean : x)) : [...profile.badges, clean];
    saveProfile({ ...profile, badges });
    platform.haptic('success');
    back(true);
  };
  const remove = async () => {
    if (!(await platform.confirm('Удалить значок?'))) return;
    saveProfile({ ...profile, badges: profile.badges.filter((x) => x.id !== b.id) });
    back(true);
  };

  const years = Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <Screen title={isNew ? 'Новый значок' : 'Значок'}
      footer={<div className="footer-actions">
        {!isNew && <button type="button" className="round-btn" onClick={remove} aria-label="Удалить"><Icon name="trash" /></button>}
        <Button icon="check" wide onClick={save} disabled={!b.title.trim()}>Сохранить</Button>
      </div>}>
      <div className="badge-preview">
        <BadgeChip b={{ ...b, title: b.title || 'Название', detail: b.detail }} />
      </div>

      <Section title="Тип" plain>
        <div className="chips">
          {BADGE_KINDS.map((k) => (
            <button type="button" key={k.id} className={'chip' + (b.kind === k.id ? ' on' : '')}
              onClick={() => set({ kind: k.id, title: '', detail: '' })}>{k.label}</button>
          ))}
        </div>
      </Section>

      {b.kind === 'sca' && <>
        <Section title="Модуль" plain>
          <Chips options={[...SCA_MODULES, ...SCA_EXTRA]} value={[b.title.replace(/^SCA /, '')]}
            onToggle={(v) => { const t = SCA_MODULES.includes(v) ? `SCA ${v}` : v; set({ title: b.title === t ? '' : t }); }} />
        </Section>
        {!SCA_EXTRA.includes(b.title) && !b.title.startsWith('SCA Coffee') && (
          <Section title="Уровень" plain>
            <Chips options={SCA_LEVELS} value={[b.detail]} onToggle={(v) => pick('detail', v)} />
          </Section>
        )}
      </>}

      {b.kind === 'q' && (
        <Section title="Сертификат" plain>
          <Chips options={Q_TYPES} value={[b.title]} onToggle={(v) => pick('title', v)} />
        </Section>
      )}

      {b.kind === 'champ' && <>
        <Section title="Чемпионат" plain>
          <Chips options={CHAMPIONSHIPS} value={[b.title]} onToggle={(v) => pick('title', v)} />
        </Section>
        <Section title="Результат" plain>
          <Chips options={PLACES} value={[b.detail]} onToggle={(v) => pick('detail', v)} />
        </Section>
      </>}

      <Section title="Год" plain>
        <Chips options={years} value={[b.year]} onToggle={(v) => set({ year: b.year === v ? '' : v })} />
      </Section>

      <Section title={b.kind === 'custom' ? 'Описание' : 'Своё значение'}>
        <Field label="Название" id="badge-title" value={b.title} placeholder={b.kind === 'champ' ? 'Региональный чемпионат…' : b.kind === 'custom' ? 'Head barista в …' : ''}
          onChange={(e) => setB({ ...b, title: e.target.value })} />
        <Field label={b.kind === 'champ' ? 'Место' : 'Уровень'} id="badge-detail" value={b.detail}
          onChange={(e) => setB({ ...b, detail: e.target.value })} />
        <Field label="Год" id="badge-year" inputMode="numeric" value={b.year} onChange={(e) => setB({ ...b, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
      </Section>
      <p className="muted pad">Значки указываете вы сами — в рецепте они видны как информация от автора.</p>
    </Screen>
  );
}

function TrackCard({ track, value, format, note }: { track: Track; value: number; format(v: number): string; note?: string }) {
  const { current, next, ratio } = progress(track, value);
  return (
    <div className="track" data-tier={current?.tier ?? 'none'}>
      <div className="track-medal" aria-hidden="true"><Icon name="medal" size={26} /></div>
      <div className="track-body">
        <div className="track-head">
          <b>{track.title}</b>
          <span>{current ? TIER_LABEL[current.tier] : 'Пока без значка'}</span>
        </div>
        <div className="track-bar"><i style={{ ['--w' as string]: `${Math.max(2, ratio * 100)}%` }} data-next={next?.tier} /></div>
        <div className="track-foot">
          <span>{format(value)}</span>
          <span>{next ? `${TIER_LABEL[next.tier]} — ${fmtNum(next.at, 0)} ${track.unit}` : 'Максимальный уровень'}</span>
        </div>
        {note && <small className="track-note">{note}</small>}
      </div>
    </div>
  );
}
