import { RATINGS_API } from '../config';
import { GRIND_TYPES, guessGrindType } from '../data/grind';
import { CLOUD_LIMITS } from '../platform/types';
import { useEffect, useState } from 'react';
import { fetchStats, myTelegramId, ratingsEnabled } from '../data/ratings';
import { allMethods, fmtNum, methodById } from '../data/methods';
import { recipeFromStandard } from '../data/recipes';
import { GEAR_CATS, catById, type Gear } from '../data/gear';
import { BADGE_KINDS, CHAMPIONSHIPS, PLACES, Q_TYPES, SCA_EXTRA, SCA_LEVELS, SCA_MODULES, type Badge } from '../data/badges';
import { BadgeChip, BadgeRow } from '../ui/Badges';
import { useBadges, MAX_FEATURED } from '../data/featured';
import { useStore, uid } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter, useSelected } from '../router';
import { Icon, MethodIcon } from '../ui/icons';
import { Button, Chips, Field, Row, SampleTag, Screen, Section, Segmented } from '../ui/kit';
import { DESKTOP_MIN, useLayoutMode } from '../layout';
import { adminCall, type GrantInfo, type SiteInfo } from '../data/lookup';
import { copyText, toast } from '../ui/toast';
import { ProfileCard } from '../ui/ProfileCard';
import { useMyCard } from './CardScreens';

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
    const json = store.exportMarkdown();
    try { await navigator.clipboard.writeText(json); setMsg('Резервная копия скопирована в буфер обмена.'); platform.haptic('success'); }
    catch { setPaste(json); setMsg('Буфер недоступен — копия ниже, выделите и скопируйте вручную.'); }
  };

  const download = () => {
    const blob = new Blob([store.exportMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brewbook-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importText = async (text: string) => {
    if (!(await platform.confirm('Заменить все текущие данные данными из копии?'))) return;
    try { store.importBackup(text); setMsg('Данные восстановлены.'); setPaste(''); platform.haptic('success'); }
    catch (e) { setMsg((e as Error).message || 'Не получилось прочитать копию.'); platform.haptic('error'); }
  };

  const badges = useBadges();
  const { card: myCard } = useMyCard();
  const [pinMsg, setPinMsg] = useState('');
  const toggleFeatured = (key: string) => {
    const cur = badges.featuredKeys;
    if (cur.includes(key)) { setPinMsg(''); store.saveProfile({ ...profile, featured: cur.filter((k) => k !== key) }); platform.haptic('select'); return; }
    if (cur.length >= MAX_FEATURED) { platform.haptic('error'); setPinMsg(`В профиле максимум ${MAX_FEATURED} значка — сначала уберите один.`); return; }
    setPinMsg('');
    platform.haptic('select');
    store.saveProfile({ ...profile, featured: [...cur, key] });
  };
  const { setRatingStats } = store;
  useEffect(() => {
    const id = myTelegramId();
    if (!ratingsEnabled() || !id) return;
    fetchStats(id).then((st) => { if (st) setRatingStats(st); });
  }, [setRatingStats]);

  const [pickMethod, setPickMethod] = useState(false);
  const sel = useSelected();
  const layoutInfo = useLayoutMode();
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
          {badges.featured.length > 0 && <div className="profile-badges"><BadgeRow badges={badges.featured.map((f) => f.badge)} max={3} /></div>}
          <textarea id="profile-about" className="profile-about" rows={2} placeholder="Пара слов о себе"
            value={profile.about} onChange={(e) => store.saveProfile({ ...profile, about: e.target.value })} />
        </div>
      </div>
      <p className="muted pad">Имя и значки увидят друзья в рецептах, которыми вы поделитесь. Ссылку на Telegram можно не добавлять — это выбирается при отправке.</p>

      <Section title="Карточка профиля" plain>
        <button type="button" className="pcard-open" onClick={() => push({ name: 'cardEdit' })} aria-label="Настроить карточку и поделиться">
          <ProfileCard card={myCard} />
        </button>
        <Button kind="secondary" icon="share" wide onClick={() => push({ name: 'cardEdit' })}>Настроить и поделиться</Button>
      </Section>

      <Section title="Значки" aside={
        <button type="button" className="icon-btn" onClick={() => addBadge()} aria-label="Добавить значок"><Icon name="plus" /></button>
      } plain>
        {badges.all.length > 0 ? (
          <>
            <p className="muted pad">Отметьте до трёх — они видны в профиле и в рецептах, которыми вы делитесь. {badges.featured.length}/{MAX_FEATURED}</p>
            <div className="badge-pick-list">
              {badges.all.map((it) => {
                const on = badges.featuredKeys.includes(it.key);
                return (
                  <div key={it.key} className={'badge-pick' + (on ? ' on' : '')}>
                    <BadgeChip b={it.badge} onClick={it.own ? () => push({ name: 'badgeEdit', badge: it.own!, isNew: false }) : undefined} />
                    <button type="button" className="pin" aria-pressed={on} aria-label={on ? 'Убрать из профиля' : 'Показывать в профиле'}
                      onClick={() => toggleFeatured(it.key)}>
                      <Icon name="star" size={20} filled={on} />
                    </button>
                  </div>
                );
              })}
            </div>
            {pinMsg && <p className="status warn pad">{pinMsg}</p>}
          </>
        ) : (
          <button type="button" className="badge-empty" onClick={() => addBadge()}>
            <Icon name="medal" size={28} />
            <span><b>Добавьте сертификат или награду</b><small>SCA, Q Grader, места на чемпионатах. А за заварки значки появятся сами</small></span>
          </button>
        )}
      </Section>

      <div className="stats">
        <div><b>{store.brews.length}</b><span>заварок</span></div>
        <div><b>{store.beans.length}</b><span>пачек</span></div>
        <div><b>{gear.length}</b><span>оборудования</span></div>
      </div>

      <Section title="Мои рецепты" aside={
        <button type="button" className="icon-btn" onClick={() => setPickMethod((v) => !v)} aria-label="Новый рецепт"><Icon name="plus" /></button>
      } plain>
        {pickMethod && (
          <div className="chips pick-method">
            {allMethods().map((m) => (
              <button type="button" key={m.id} className="chip" onClick={() => { setPickMethod(false); push({ name: 'recipeEdit', isNew: true, recipe: recipeFromStandard(m.id, uid()) }); }}>{m.name}</button>
            ))}
          </div>
        )}
        {store.custom.length > 0 ? (
          <div className="group">
            {store.custom.map((r) => {
              const m = methodById(r.methodId);
              return (
                <Row key={r.id} leading={<MethodIcon icon={m.icon} size={24} />} label={r.name}
                  hint={`${m.name} · ${fmtNum(r.dose, 2)} г → ${fmtNum(r.dose * r.ratio)} г · ${r.steps.length} ${r.steps.length === 1 ? 'шаг' : r.steps.length < 5 ? 'шага' : 'шагов'}${r.author ? ` · от ${r.author.name || '@' + r.author.username}` : ''}`}
                  onClick={() => push({ name: 'recipeEdit', isNew: false, recipe: r })}
                  active={sel?.name === 'recipeEdit' && sel.recipe.id === r.id} />
              );
            })}
          </div>
        ) : !pickMethod && (
          <p className="muted pad">Свои схемы проливов: выберите метод и поменяйте шаги, граммы и время. Рецепт появится на экране метода, по нему пойдёт таймер.</p>
        )}
      </Section>

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
                    onClick={() => push({ name: 'gearEdit', gear: g, isNew: false })}
                    active={sel?.name === 'gearEdit' && sel.gear.id === g.id} />
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
          <p className="muted pad">Для наглядности добавлены пачки на полке, заварки и оборудование с пометкой «пример».</p>
          <Button kind="secondary" onClick={async () => { if (await platform.confirm('Удалить все примеры?')) store.removeSamples(); }}>Удалить примеры</Button>
        </Section>
      )}

      <SyncSection />

      <Section title="Резервная копия" plain>
        <p className="muted pad">Копия в формате Markdown — обычный текст с разделами «Полка», «Дневник», «Оборудование». Его можно открыть и поправить в любом редакторе, а потом загрузить обратно. Старые копии в JSON тоже принимаются.</p>
        <div className="btn-col">
          <Button kind="secondary" onClick={copy}>Скопировать текстом</Button>
          {platform.kind === 'web' && <Button kind="secondary" onClick={download}>Сохранить файлом</Button>}
          <label className="btn btn-secondary">
            <span>Восстановить из файла</span>
            <input type="file" accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) importText(await f.text()); }} />
          </label>
        </div>
        <textarea id="backup-paste" className="notes mono" rows={4} placeholder="…или вставьте текст копии сюда" value={paste} onChange={(e) => setPaste(e.target.value)} />
        {(paste.trim().startsWith('{') || paste.includes('## ')) && <Button onClick={() => importText(paste)}>Восстановить из текста</Button>}
        {msg && <p className="status">{msg}</p>}
      </Section>

      <Section title="Вид интерфейса" plain>
        <Segmented value={profile.layout ?? 'auto'} onChange={(v) => store.saveProfile({ ...profile, layout: v })}
          options={[{ value: 'auto', label: 'Авто' }, { value: 'desktop', label: 'Компьютер' }, { value: 'mobile', label: 'Телефон' }]} />
        <p className="muted pad">
          {(profile.layout ?? 'auto') === 'auto'
            ? `На компьютере — меню слева и две колонки, на телефоне — вкладки внизу. Две колонки включаются, когда окно шире ${DESKTOP_MIN} px.`
            : profile.layout === 'desktop'
              ? `Меню слева и две колонки на любом устройстве, когда окно шире ${DESKTOP_MIN} px.`
              : 'Всегда как на телефоне: вкладки внизу.'}
        </p>
        {layoutInfo.desktopClient && layoutInfo.mode === 'mobile' && (profile.layout ?? 'auto') !== 'mobile' && (
          platform.requestFullscreen
            ? <Button kind="secondary" onClick={() => platform.requestFullscreen?.()}>Развернуть окно на весь экран</Button>
            : <p className="muted pad">Растяните окно приложения пошире — включится раскладка для компьютера.</p>
        )}
      </Section>

      <Section title="О приложении">
        <Row label="Платформа" value={{ telegram: 'Telegram', web: 'Браузер', native: 'Приложение' }[platform.kind]} />
        <Row label="Хранилище" value={store.sync.state !== 'off' ? 'Устройство + облако Telegram' : platform.kind === 'telegram' ? 'Telegram на устройстве' : platform.kind === 'native' ? 'Память приложения' : 'Браузер'} />
        <Row label="Версия приложения" value={appVersion()} chevron={false} />
        <ServerVersionRow />
        {myTelegramId() && (
          <Row label="Ваш Telegram ID" value={myTelegramId()} hint="Нажмите, чтобы скопировать"
            onClick={async () => { if (await copyText(myTelegramId()!)) toast('Скопировано'); }} chevron={false} />
        )}
      </Section>

      <OwnerTools />
    </Screen>
  );
}

const fmtWhen = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(/^\d+$/.test(iso) ? Number(iso) : iso);
  return isNaN(+d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const appVersion = () => [import.meta.env.VITE_APP_VERSION || 'разработка', fmtWhen(import.meta.env.VITE_APP_BUILT)].filter(Boolean).join(' · ');

const SITE_STATUS: Record<SiteInfo['status'], string> = { approved: 'подключён', pending: 'ждёт решения', rejected: 'отклонён' };

/** Owner only: roaster sites for the shared catalog. Invisible to everyone else (the server answers 403). */
/** Owner only (the server answers 403 to everyone else): roaster sites and the developers' background */
function OwnerTools() {
  const [data, setData] = useState<{ sites: SiteInfo[]; grants: GrantInfo[] } | null>(null);
  useEffect(() => { if (myTelegramId()) adminCall().then(setData); }, []);
  if (!data) return null;
  return <><RoasterSites sites={data.sites} onChange={setData} /><DevGrants grants={data.grants} onChange={setData} /></>;
}

/** Give or take away the developers' background by Telegram id */
function DevGrants({ grants, onChange }: { grants: GrantInfo[]; onChange(d: { sites: SiteInfo[]; grants: GrantInfo[] }): void }) {
  const [tg, setTg] = useState('');
  const [busy, setBusy] = useState(false);
  const devs = grants.filter((g) => g.grants.includes('dev'));
  const act = async (action: 'grant' | 'revoke', id: string) => {
    if (action === 'revoke' && !(await platform.confirm(`Забрать фон разработчика у ${id}?`))) return;
    setBusy(true);
    const next = await adminCall({ action, tg: id, what: 'dev' });
    setBusy(false);
    if (next) { onChange(next); setTg(''); platform.haptic('success'); toast(action === 'grant' ? 'Фон выдан — появится у человека в карточке' : 'Фон забран'); }
    else toast('Не получилось — проверьте ID');
  };
  return (
    <Section title="Фон разработчика">
      <p className="muted pad small-note">Особый фон карточки, который можете выдать только вы. Telegram ID человек видит у себя: Профиль → «О приложении».</p>
      {devs.map((g) => (
        <Row key={g.account} label={g.tg ? `Telegram ${g.tg}` : `Аккаунт ${g.account}`} hint={g.tg === myTelegramId() ? 'это вы' : undefined}
          value={<button type="button" className="link-btn" disabled={busy} onClick={() => act('revoke', g.tg ?? '')}>Забрать</button>} />
      ))}
      <Field label="Telegram ID" id="dev-grant-id" inputMode="numeric" placeholder="например, 123456789" value={tg}
        onChange={(e) => setTg(e.target.value.replace(/\D/g, '').slice(0, 20))} />
      <div className="site-actions">
        <Button icon="plus" disabled={busy || tg.length < 4} onClick={() => act('grant', tg)}>Выдать фон</Button>
        {myTelegramId() && !devs.some((g) => g.tg === myTelegramId()) && <Button kind="secondary" disabled={busy} onClick={() => act('grant', myTelegramId()!)}>Себе</Button>}
      </div>
    </Section>
  );
}

function RoasterSites({ sites, onChange }: { sites: SiteInfo[]; onChange(d: { sites: SiteInfo[]; grants: GrantInfo[] }): void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const act = async (action: 'approve' | 'reject' | 'recrawl', s: SiteInfo) => {
    if (action === 'reject' && !(await platform.confirm(`Отклонить ${s.host}? Сервер не будет открывать страницы этого сайта.`))) return;
    setBusy(true);
    const next = await adminCall({ action, host: s.host, roaster: names[s.host]?.trim() || undefined });
    setBusy(false);
    if (next) { onChange(next); platform.haptic('success'); toast(action === 'approve' ? 'Сайт подключён — каталог начнёт заполняться' : action === 'recrawl' ? 'Сайт будет обойден заново' : 'Сайт отклонён'); }
    else toast('Не получилось — нет связи с сервером');
  };
  const sum = (o: Record<string, number>, ...keys: string[]) => keys.reduce((a, k) => a + (o[k] ?? 0), 0);
  const pending = sites.filter((s) => s.status === 'pending');

  return (
    <Section title="Сайты обжарщиков" aside={pending.length ? <span className="tag">{pending.length} новых</span> : undefined}>
      <p className="muted pad small-note">Видно только вам как владельцу бота. Сервер открывает страницы только подключённых сайтов и обходит их в фоне раз в 3 дня.</p>
      {sites.map((s) => (
        <div key={s.host}>
          <Row label={s.roaster || s.host} active={open === s.host} onClick={() => setOpen(open === s.host ? null : s.host)}
            hint={s.status === 'approved'
              ? `${s.host} · лотов: ${sum(s.lots, 'active')} в продаже, ${sum(s.lots, 'out', 'archived', 'gone')} прошлых · ${s.crawling ? 'идёт обход' : s.crawled ? `обход ${new Date(s.crawled).toLocaleDateString('ru-RU')}` : 'ждёт обхода'}${s.pages.queued ? ` · в очереди ${s.pages.queued}` : ''}`
              : `${s.host} · ${SITE_STATUS[s.status]} · сканов: ${s.requests}`}
            value={s.status === 'approved' ? undefined : <span className="tag">{SITE_STATUS[s.status]}</span>} />
          {open === s.host && (
            <>
              {s.sample && <p className="muted pad small-note">Пример ссылки: <a href={s.sample} target="_blank" rel="noreferrer">{s.sample}</a></p>}
              {s.status !== 'approved' && (
                <Field label="Название обжарщика" id={`site-name-${s.host}`} placeholder="Как показывать в каталоге" value={names[s.host] ?? s.roaster}
                  onChange={(e) => setNames((n) => ({ ...n, [s.host]: e.target.value }))} />
              )}
              <div className="site-actions">
                {s.status !== 'approved' && <Button icon="check" disabled={busy} onClick={() => act('approve', s)}>Подключить</Button>}
                {s.status === 'approved' && <Button kind="secondary" icon="reset" disabled={busy || s.crawling} onClick={() => act('recrawl', s)}>Обойти заново</Button>}
                {s.status !== 'rejected' && <Button kind="secondary" disabled={busy} onClick={() => act('reject', s)}>Отклонить</Button>}
              </div>
            </>
          )}
        </div>
      ))}
    </Section>
  );
}

/** Server version — to know which deployment is running */
function ServerVersionRow() {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    if (!RATINGS_API) return;
    fetch(`${RATINGS_API}/version`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setV(j ? [j.version, fmtWhen(j.builtAt)].filter(Boolean).join(' · ') : 'нет связи'))
      .catch(() => setV('нет связи'));
  }, []);
  if (!RATINGS_API) return null;
  return <Row label="Версия сервера" value={v ?? '…'} chevron={false} />;
}

/** Sync between devices via Telegram's cloud */
function SyncSection() {
  const { sync, syncNow } = useStore();
  if (sync.state === 'off') {
    if (platform.kind !== 'telegram') return null;
    return (
      <Section title="Синхронизация" plain>
        <p className="muted pad">Эта версия Telegram не поддерживает облачное хранилище — обновите приложение Telegram, чтобы записи были на всех устройствах.</p>
      </Section>
    );
  }
  const when = sync.at ? new Date(sync.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const pct = sync.usage ? Math.min(100, Math.round((sync.usage.chars / (CLOUD_LIMITS.keys * CLOUD_LIMITS.value)) * 1000) / 10) : 0;
  const kb = (n: number) => fmtNum(Math.round(n / 102.4) / 10, 1);
  return (
    <Section title="Синхронизация">
      <Row label={sync.state === 'syncing' ? 'Синхронизация…' : sync.state === 'error' ? 'Не удалось синхронизировать' : 'Синхронизировано'}
        hint={sync.state === 'error' ? sync.error : when ? `Последний раз: ${when}` : 'Через облако Telegram — на всех ваших устройствах'}
        value={<span className={'sync-dot ' + sync.state} aria-hidden="true" />} chevron={false} />
      {sync.usage && (
        <div className="sync-usage">
          <div className="stock-bar"><i style={{ width: `${Math.max(pct, 1)}%` }} /></div>
          <small>Занято {kb(sync.usage.chars)} из {kb(CLOUD_LIMITS.keys * CLOUD_LIMITS.value)} КБ · ключей {sync.usage.keys} из {CLOUD_LIMITS.keys}</small>
        </div>
      )}
      <Row label="Синхронизировать сейчас" onClick={sync.state === 'syncing' ? undefined : syncNow} chevron={false} />
    </Section>
  );
}

export function GearEdit({ gear: initial, isNew }: { gear: Gear; isNew: boolean }) {
  const { saveGear, deleteGear } = useStore();
  const { back } = useRouter();
  const [g, setG] = useState<Gear>(initial);
  const dirty = JSON.stringify(g) !== JSON.stringify(initial);
  useBackGuard(dirty, 'Выйти без сохранения?');
  const cat = catById(g.cat);

  // a popular hand grinder was picked — set the type automatically (if not chosen yet)
  const setName = (name: string) => setG((x) => ({ ...x, name, grindType: x.cat === 'grinder' && !x.grindType ? guessGrindType(name) : x.grindType }));
  const save = () => {
    saveGear({ ...g, name: g.name.trim(), details: g.details.trim(), sample: dirty ? undefined : g.sample, grindType: g.cat === 'grinder' ? g.grindType : undefined });
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
        <Button icon="check" wide onClick={save} disabled={!g.name.trim() || (!isNew && !dirty)}>Сохранить</Button>
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
          onChange={(e) => setName(e.target.value)} />
        <datalist id={`sugg-${g.cat}`}>{cat.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <Field label="Детали" id="gear-details" value={g.details} placeholder={g.cat === 'grinder' ? 'жернова, доработки' : 'объём, материал, заметки'}
          onChange={(e) => setG({ ...g, details: e.target.value })} />
      </Section>

      {g.cat === 'grinder' && (
        <Section title="Тип кофемолки" plain>
          <Segmented value={g.grindType ?? 'mechanical'} onChange={(v) => setG({ ...g, grindType: v })}
            options={GRIND_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <p className="muted pad small-note">{GRIND_TYPES.find((t) => t.id === (g.grindType ?? 'mechanical'))!.hint}. От этого зависит, в чём записывается помол в заварках.</p>
        </Section>
      )}

      <Section title="Популярное" plain>
        <div className="chips">
          {cat.suggestions.map((s) => (
            <button type="button" key={s} className={'chip' + (g.name === s ? ' on' : '')} onClick={() => { platform.haptic('select'); setName(s); }}>{s}</button>
          ))}
        </div>
      </Section>
    </Screen>
  );
}

/* ---------- Badge ---------- */

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
        <Button icon="check" wide onClick={save} disabled={!b.title.trim() || (!isNew && !dirty)}>Сохранить</Button>
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
