/** Profile card: the own card in the Profile tab, its settings and sharing, and a card a friend sent */
import { useEffect, useMemo, useState } from 'react';
import { BASE_THEMES, buildCard, cardText, MAX_SETUP, SPECIAL_THEMES, storeCard, unlockedThemes, type CardData, type UnlockedTheme } from '../data/card';
import { useStats } from '../data/stats';
import { MAX_FEATURED, useBadges } from '../data/featured';
import { GEAR_CATS } from '../data/gear';
import { TIER_LABEL, type Tier } from '../data/achievements';
import type { IconKey } from '../data/methods';
import { prepareShare } from '../data/ratings';
import { uid, useStore } from '../data/store';
import { cardLinkFor } from '../data/share';
import { platform } from '../platform';
import { Icon, MethodIcon } from '../ui/icons';
import { Button, Field, Screen, Section } from '../ui/kit';
import { BadgeChip } from '../ui/Badges';
import { useRouter } from '../router';
import { ProfileCard } from '../ui/ProfileCard';
import { copyText, toast } from '../ui/toast';
import { Toggle } from './Share';

/** The card as it would be sent now (levels from the server's numbers when known) */
/** telegram — show the @username (on the own profile always; for sharing — as the user chose) */
export function useMyCard(telegram?: boolean): { card: CardData; unlocked: UnlockedTheme[]; verified: boolean; grants: string[] } {
  const { profile, gear } = useStore();
  const badges = useBadges();
  const { stats, verified, diamondNo, grants } = useStats();
  const tester = grants.includes('tester');
  const unlocked = useMemo(() => unlockedThemes(stats, tester), [stats, tester]);
  return { card: buildCard(profile, badges.featured, gear, stats, diamondNo, grants, telegram ?? profile.shareTelegram), unlocked, verified, grants };
}

const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'volume', 'diamond'];
const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};

const swatchClass = (t: { tier: Tier } | { base: string }) => ('tier' in t ? `tier tier-${t.tier}` : `base-${t.base}`);

/** Profile tab: the card itself, with "Поделиться" and "Настроить" */
export function MyCardBlock() {
  const { push } = useRouter();
  const { profile } = useStore();
  const { card } = useMyCard(true);
  return (
    <div className="my-card">
      <div className="pcard-stage"><ProfileCard card={card} /></div>
      {!profile.name.trim() && <p className="muted pad small-note">Добавьте имя, значки и фон в «Настроить» — так вас увидят друзья в карточке и в рецептах.</p>}
      <div className="my-card-actions">
        <Button icon="share" wide onClick={() => push({ name: 'cardShare' })}>Поделиться</Button>
        <Button kind="secondary" icon="edit" wide onClick={() => push({ name: 'cardEdit' })}>Настроить</Button>
      </div>
    </div>
  );
}

/** Everything shown on the card: name, @username, about, badges, background, setup */
export function CardEditScreen() {
  const { profile, gear, saveProfile } = useStore();
  const { push } = useRouter();
  const { card, unlocked, verified, grants } = useMyCard(true);
  const badges = useBadges();
  const [pinMsg, setPinMsg] = useState('');
  const offered = new Set(GEAR_CATS.map((c) => c.id));
  const myGear = gear.filter((g) => offered.has(g.cat));
  const chosenIds = profile.cardGear ?? GEAR_CATS.map((c) => myGear.find((g) => g.cat === c.id)?.id).filter(Boolean) as string[];
  const current = profile.cardTheme ?? 'paper';
  // metal themes grouped by tier: bronze, silver, gold, volume, diamond
  const tiers = TIERS.map((tier) => [tier, unlocked.filter((u) => u.tier === tier)] as const).filter(([, l]) => l.length);
  const currentTier = unlocked.find((u) => u.key === current)?.tier ?? null;
  const chosenGroup = currentTier ? tiers.find(([t]) => t === currentTier)?.[1] : null;

  const toggleGear = (id: string) => {
    platform.haptic('select');
    const on = chosenIds.includes(id);
    if (!on && chosenIds.length >= MAX_SETUP) { toast(`На карточке до ${MAX_SETUP} предметов`); return; }
    saveProfile({ ...profile, cardGear: on ? chosenIds.filter((x) => x !== id) : [...chosenIds, id] });
  };
  const toggleFeatured = (key: string) => {
    const cur = badges.featuredKeys;
    if (cur.includes(key)) { setPinMsg(''); saveProfile({ ...profile, featured: cur.filter((k) => k !== key) }); platform.haptic('select'); return; }
    if (cur.length >= MAX_FEATURED) { platform.haptic('error'); setPinMsg(`На карточке максимум ${MAX_FEATURED} значка — сначала уберите один.`); return; }
    setPinMsg(''); platform.haptic('select');
    saveProfile({ ...profile, featured: [...cur, key] });
  };
  const addBadge = () => push({ name: 'badgeEdit', badge: { id: uid(), kind: 'sca', title: '', detail: '', year: '' }, isNew: true });
  useCardUpload();

  return (
    <Screen title="Настроить профиль" subtitle="Всё, что видно на карточке">
      <div className="pcard-stage"><ProfileCard card={card} /></div>

      <Section title="О себе">
        <Field label="Имя" id="profile-name" placeholder="Как вас подписать" value={profile.name} onChange={(e) => saveProfile({ ...profile, name: e.target.value })} />
        <Field label="Telegram" id="profile-tg" placeholder="username без @" value={profile.telegram} autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={(e) => saveProfile({ ...profile, telegram: e.target.value.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '') })} />
        <textarea id="profile-about" className="profile-about field-area" rows={2} placeholder="Пара слов о себе" maxLength={200}
          value={profile.about} onChange={(e) => saveProfile({ ...profile, about: e.target.value })} />
      </Section>

      <Section title="Значки" aside={<button type="button" className="icon-btn" onClick={addBadge} aria-label="Добавить значок"><Icon name="plus" /></button>} plain>
        {badges.all.length > 0 ? (
          <>
            <p className="muted pad">Отметьте до трёх — они видны на карточке и в рецептах, которыми вы делитесь. {badges.featured.length}/{MAX_FEATURED}</p>
            <div className="badge-pick-list">
              {badges.all.map((it) => {
                const on = badges.featuredKeys.includes(it.key);
                return (
                  <div key={it.key} className={'badge-pick' + (on ? ' on' : '')}>
                    <BadgeChip b={it.badge} onClick={it.own ? () => push({ name: 'badgeEdit', badge: it.own!, isNew: false }) : undefined} />
                    <button type="button" className="pin" aria-pressed={on} aria-label={on ? 'Убрать с карточки' : 'Показывать на карточке'} onClick={() => toggleFeatured(it.key)}>
                      <Icon name="star" size={20} filled={on} />
                    </button>
                  </div>
                );
              })}
            </div>
            {pinMsg && <p className="status warn pad">{pinMsg}</p>}
          </>
        ) : (
          <button type="button" className="badge-empty" onClick={addBadge}>
            <Icon name="medal" size={28} />
            <span><b>Добавьте сертификат или награду</b><small>SCA, Q Grader, места на чемпионатах. А за заварки значки появятся сами</small></span>
          </button>
        )}
      </Section>

      {!verified && platform.initData() && <p className="muted pad small-note">Сверяю заварки с сервером — фоны и значки на карточке подтверждает сервер.</p>}
      <Section title="Фон" plain>
        <div className="theme-picks">
          {BASE_THEMES.map((t) => (
            <button type="button" key={t.id} className={'theme-pick ' + swatchClass({ base: t.id }) + (current === t.id ? ' on' : '')} aria-pressed={current === t.id}
              onClick={() => { platform.haptic('select'); saveProfile({ ...profile, cardTheme: t.id }); }}>
              <span>{t.label}</span>
            </button>
          ))}
          {/* special backgrounds the owner gave this person */}
          {SPECIAL_THEMES.filter((sp) => grants.includes(sp.id)).map((sp) => (
            <button type="button" key={sp.id} className={'theme-pick special-' + sp.id + (current === `special:${sp.id}` ? ' on' : '')} aria-pressed={current === `special:${sp.id}`}
              onClick={() => { platform.haptic('select'); saveProfile({ ...profile, cardTheme: `special:${sp.id}` }); }}>
              <span>{sp.label}</span><small>{sp.title}</small>
            </button>
          ))}
          {/* metal themes appear only once earned — like achievements, they are a surprise; one tile per tier */}
          {tiers.map(([tier, list]) => (
            <button type="button" key={tier} className={'theme-pick ' + swatchClass(list[0]) + (currentTier === tier ? ' on' : '')} aria-pressed={currentTier === tier}
              onClick={() => { platform.haptic('select'); if (currentTier !== tier) saveProfile({ ...profile, cardTheme: list[0].key }); }}>
              <span>{TIER_LABEL[tier]}</span><small>{list.length > 1 ? `${list.length} ${plural(list.length, ['значок', 'значка', 'значков'])}` : list[0].label}</small>
            </button>
          ))}
        </div>
        {chosenGroup && chosenGroup.length > 1 && (
          <div className="icon-picks" role="radiogroup" aria-label="Иконка в углу">
            <p className="muted small-note">Иконка в углу — какое достижение показать:</p>
            <div className="icon-pick-row">
              {chosenGroup.map((u) => {
                const icon = u.icon;
                return (
                  <button type="button" key={u.key} role="radio" aria-checked={current === u.key} aria-label={u.label} title={u.label}
                    className={'icon-pick ' + swatchClass(u) + (current === u.key ? ' on' : '')}
                    onClick={() => { platform.haptic('select'); saveProfile({ ...profile, cardTheme: u.key }); }}>
                    {icon === 'star' ? <Icon name="star" size={26} filled /> : <MethodIcon icon={icon as IconKey} size={30} />}
                  </button>
                );
              })}
            </div>
            <p className="muted small-note">{chosenGroup.find((u) => u.key === current)?.label}</p>
          </div>
        )}
      </Section>

      <Section title="Сетап" plain>
        {myGear.length ? (
          <div className="chips">
            {myGear.map((g) => (
              <button type="button" key={g.id} className={'chip' + (chosenIds.includes(g.id) ? ' on' : '')} aria-pressed={chosenIds.includes(g.id)} onClick={() => toggleGear(g.id)}>{g.name}</button>
            ))}
          </div>
        ) : <p className="muted pad">Добавьте оборудование в профиле — оно появится на карточке.</p>}
      </Section>
    </Screen>
  );
}

/**
 * Keep the shared card on the server up to date: the link never changes, so friends who already have it
 * see the new version after edits. Only in Telegram (the server needs a signed user).
 */
function useCardUpload() {
  const { card } = useMyCard(false);
  const key = JSON.stringify(card);
  useEffect(() => {
    if (!platform.initData()) return;
    const t = setTimeout(() => { storeCard(card); }, 1500);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Share the card: the only choice here is whether the Telegram link goes with it */
export function CardShareScreen() {
  const { profile, saveProfile } = useStore();
  const { card } = useMyCard(false);
  const [link, setLink] = useState('');
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(card);
  const tg = profile.telegram.trim();

  // the link is prepared in advance, so sending happens right on tap (Telegram needs the message ready)
  useEffect(() => {
    let alive = true;
    setLink(''); setPrepared(null);
    const t = setTimeout(async () => {
      const id = await storeCard(card);
      if (!alive || !id) return;
      const l = cardLinkFor(id);
      setLink(l);
      if (platform.shareMessage && l.startsWith('https://t.me/')) {
        const [title, ...rest] = cardText(card).split('\n');
        const pid = await prepareShare(title, rest.join('\n'), l);
        if (alive) setPrepared(pid);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!link) return;
    setBusy(true);
    try {
      if (prepared && platform.shareMessage) {
        const sent = await platform.shareMessage(prepared);
        if (sent) { platform.haptic('success'); return; }
        if (sent === false) return;
      }
      const res = await platform.share(cardText(card), link);
      if (res === 'copied') toast('Ссылка на профиль скопирована');
      if (res === 'failed') toast('Не получилось отправить');
    } finally { setBusy(false); }
  };
  const copy = async () => { const ok = await copyText(`${cardText(card)}\n\n${link}`); toast(ok ? 'Скопировано' : 'Не получилось скопировать'); };

  return (
    <Screen title="Поделиться профилем" subtitle="Так карточку увидят друзья"
      footer={<div className="footer-actions">
        <button type="button" className="round-btn" onClick={copy} disabled={!link} aria-label="Скопировать ссылку"><Icon name="copy" /></button>
        <Button icon="share" wide onClick={send} disabled={!link || busy}>{link ? (platform.kind === 'telegram' ? 'Отправить в Telegram' : 'Поделиться') : platform.initData() ? 'Готовлю ссылку…' : 'Поделиться можно из Telegram'}</Button>
      </div>}>
      <div className="pcard-stage"><ProfileCard card={card} /></div>
      <div className="group">
        <Toggle id="card-tg" label="Ссылка на мой Telegram" checked={profile.shareTelegram && !!tg} disabled={!tg}
          hint={tg ? `Друг сможет написать @${tg}` : 'Укажите username в «Настроить»'} onChange={(v) => saveProfile({ ...profile, shareTelegram: v })} />
      </div>
      <p className="muted pad">Друг получит ссылку: карточка откроется в приложении. Ссылка не меняется — после правок друзья увидят новую версию.</p>
    </Screen>
  );
}

export function CardViewScreen({ card }: { card: CardData }) {
  return (
    <Screen title={card.name} subtitle="Профиль в Brewbook">
      <div className="pcard-stage"><ProfileCard card={card} /></div>
      {card.username && <Button kind="secondary" wide onClick={() => platform.openLink(`https://t.me/${card.username}`)}>Написать @{card.username}</Button>}
    </Screen>
  );
}
