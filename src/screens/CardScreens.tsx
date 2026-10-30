/** Profile card: set it up and share it (own), or view a card a friend sent */
import { useEffect, useMemo, useState } from 'react';
import { BASE_THEMES, buildCard, cardText, MAX_SETUP, resolveTheme, storeCard, unlockedThemes, type CardData, type CardTheme } from '../data/card';
import { useBadges } from '../data/featured';
import { GEAR_CATS } from '../data/gear';
import { TIER_LABEL } from '../data/achievements';
import { prepareShare } from '../data/ratings';
import { useStore } from '../data/store';
import { cardLinkFor } from '../data/share';
import { platform } from '../platform';
import { Icon } from '../ui/icons';
import { Button, Screen, Section } from '../ui/kit';
import { ProfileCard } from '../ui/ProfileCard';
import { copyText, toast } from '../ui/toast';
import { Toggle } from './Share';

/** The card as it would be sent now */
export function useMyCard(): { card: CardData; unlocked: ReturnType<typeof unlockedThemes> } {
  const { profile, gear, brews } = useStore();
  const badges = useBadges();
  const unlocked = useMemo(() => unlockedThemes(brews, profile.ratingStats?.count ?? 0), [brews, profile.ratingStats]);
  const theme = resolveTheme(profile.cardTheme, unlocked);
  const shown = profile.shareBadges ? badges.featured.map((f) => { const { id: _id, ...b } = f.badge as typeof f.badge & { id?: string }; return b; }) : [];
  return { card: buildCard(profile, shown, gear, theme), unlocked };
}

const swatchClass = (t: CardTheme) => ('tier' in t ? `tier tier-${t.tier}` : `base-${t.base}`);

export function CardEditScreen() {
  const { profile, gear, saveProfile } = useStore();
  const { card, unlocked } = useMyCard();
  const [link, setLink] = useState('');
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(card);
  const tg = profile.telegram.trim();
  const offered = new Set(GEAR_CATS.map((c) => c.id));
  const myGear = gear.filter((g) => offered.has(g.cat));
  const chosenIds = profile.cardGear ?? GEAR_CATS.map((c) => myGear.find((g) => g.cat === c.id)?.id).filter(Boolean) as string[];
  const current = profile.cardTheme ?? 'paper';

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
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGear = (id: string) => {
    platform.haptic('select');
    const on = chosenIds.includes(id);
    if (!on && chosenIds.length >= MAX_SETUP) { toast(`На карточке до ${MAX_SETUP} предметов`); return; }
    saveProfile({ ...profile, cardGear: on ? chosenIds.filter((x) => x !== id) : [...chosenIds, id] });
  };

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
    <Screen title="Карточка профиля" subtitle="Так её увидят друзья"
      footer={<div className="footer-actions">
        <button type="button" className="round-btn" onClick={copy} disabled={!link} aria-label="Скопировать ссылку"><Icon name="copy" /></button>
        <Button icon="share" wide onClick={send} disabled={!link || busy}>{link ? 'Поделиться профилем' : platform.initData() ? 'Готовлю ссылку…' : 'Поделиться можно из Telegram'}</Button>
      </div>}>
      <div className="pcard-stage"><ProfileCard card={card} /></div>

      <Section title="Цвет" plain>
        <div className="theme-picks">
          {BASE_THEMES.map((t) => (
            <button type="button" key={t.id} className={'theme-pick ' + swatchClass({ base: t.id }) + (current === t.id ? ' on' : '')} aria-pressed={current === t.id}
              onClick={() => { platform.haptic('select'); saveProfile({ ...profile, cardTheme: t.id }); }}>
              <span>{t.label}</span>
            </button>
          ))}
          {/* metal themes appear only once earned — like achievements, they are a surprise */}
          {unlocked.map((u) => (
            <button type="button" key={u.key} className={'theme-pick ' + swatchClass(u.theme) + (current === u.key ? ' on' : '')} aria-pressed={current === u.key}
              onClick={() => { platform.haptic('select'); saveProfile({ ...profile, cardTheme: u.key }); }}>
              <span>{TIER_LABEL[(u.theme as { tier: keyof typeof TIER_LABEL }).tier]}</span><small>{u.label}</small>
            </button>
          ))}
        </div>
      </Section>

      <div className="group">
        <Toggle id="card-tg" label="Ссылка на мой Telegram" checked={profile.shareTelegram && !!tg} disabled={!tg}
          hint={tg ? `@${tg}` : 'Укажите username в профиле'} onChange={(v) => saveProfile({ ...profile, shareTelegram: v })} />
        <Toggle id="card-badges" label="Значки" checked={profile.shareBadges} hint="Те, что отмечены в профиле (до 3)"
          onChange={(v) => saveProfile({ ...profile, shareBadges: v })} />
      </div>

      <Section title="Сетап на карточке" plain>
        {myGear.length ? (
          <div className="chips">
            {myGear.map((g) => (
              <button type="button" key={g.id} className={'chip' + (chosenIds.includes(g.id) ? ' on' : '')} aria-pressed={chosenIds.includes(g.id)} onClick={() => toggleGear(g.id)}>{g.name}</button>
            ))}
          </div>
        ) : <p className="muted pad">Добавьте оборудование в профиле — оно появится на карточке.</p>}
      </Section>
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
