import { useEffect, useState } from 'react';
import { catById } from '../data/gear';
import { methodById, fmtNum, fmtRatio, fmtTime } from '../data/methods';
import { recipeLink, recipeText, toShared, type SharedRecipe } from '../data/share';
import { effectivePlan } from '../data/recipes';
import { emptyBean, useStore, uid, type Bean, type Brew } from '../data/store';
import { toneOf } from '../data/cupping';
import { platform } from '../platform';
import { useRouter } from '../router';
import { Icon, MethodIcon } from '../ui/icons';
import { AuthorBlock } from '../ui/Badges';
import { copyText, toast } from '../ui/toast';
import { beanOrigin, beanTitle, blendLines } from './beanUtils';
import { RateBlock } from '../ui/RateBlock';
import { myTelegramId, newRid, prepareShare, ratingsEnabled } from '../data/ratings';
import { useBadges } from '../data/featured';
import { Button, Empty, Field, Screen, Stars } from '../ui/kit';


/** Карточка рецепта — одинаково выглядит у автора (превью) и у друга */
export function RecipeCard({ r }: { r: SharedRecipe }) {
  const m = methodById(r.methodId);
  const plan = effectivePlan(r.methodId, r.plan);
  const beanName = r.bean ? (r.bean.name || beanTitle(r.bean)) : '';
  const origin = r.bean ? beanOrigin(r.bean) : '';

  return (
    <article className="recipe-card">
      <header className="recipe-head">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={40} /></span>
        <div>
          <span className="eyebrow">{m.name}{r.plan ? ` · ${r.plan.name}` : ''}</span>
          <h2>{beanName || 'Рецепт заварки'}</h2>
          {origin && <p className="muted">{origin}</p>}
        </div>
      </header>

      <AuthorBlock author={r.author} />

      <dl className="param-grid">
        <div><dt>Кофе</dt><dd>{fmtNum(r.dose, 2)} г</dd></div>
        <div><dt>{m.yieldLabel ?? 'Вода'}</dt><dd>{fmtNum(r.water)} г</dd></div>
        <div><dt>Пропорция</dt><dd>{fmtRatio(r.water / r.dose)}</dd></div>
        <div><dt>Температура</dt><dd>{r.temp ? `${fmtNum(r.temp)}°C` : 'холодная'}</dd></div>
        <div><dt>Время</dt><dd>{fmtTime(r.time)}</dd></div>
        <div><dt>Помол</dt><dd className="dd-text">{r.grind || '—'}</dd></div>
      </dl>

      {r.gear.length > 0 && (
        <div className="recipe-block">
          <h3>Оборудование</h3>
          <ul className="gear-ul">
            {r.gear.map((g, i) => <li key={i}><span>{catById(g.cat).one}</span><b>{g.name}{g.details && <small> · {g.details}</small>}</b></li>)}
          </ul>
        </div>
      )}

      {r.bean?.isBlend && (r.bean.parts ?? []).length > 0 && (
        <div className="recipe-block">
          <h3>Состав бленда</h3>
          <ul className="gear-ul">
            {blendLines(r.bean).map((l, i) => <li key={i}><span>{l.share || '—'}</span><b>{l.text}</b></li>)}
          </ul>
        </div>
      )}

      {r.bean && (r.bean.process || r.bean.variety || r.bean.roaster || r.bean.packNotes) && (
        <div className="recipe-block">
          <h3>Зерно</h3>
          <ul className="gear-ul">
            {r.bean.process && <li><span>Обработка</span><b>{r.bean.process}</b></li>}
            {r.bean.variety && <li><span>Сорт</span><b>{r.bean.variety}</b></li>}
            {r.bean.altitude && <li><span>Высота</span><b>{r.bean.altitude}</b></li>}
            {r.bean.roastLevel && <li><span>Обжарка</span><b>{r.bean.roastLevel}</b></li>}
            {r.bean.roaster && <li><span>Обжарщик</span><b>{r.bean.roaster}</b></li>}
            {r.bean.packNotes && <li><span>На пачке</span><b>{r.bean.packNotes}</b></li>}
          </ul>
        </div>
      )}

      <div className="recipe-block">
        <h3>{r.plan ? `Шаги · ${r.plan.name}` : 'Шаги'}</h3>
        <ol className="steps-preview compact">
          {plan.steps.map((s, i) => (
            <li key={i}><time>{fmtTime(s.at)}</time><div><b>{s.title}</b>{s.to !== undefined && <span className="pour">до {fmtNum(r.water * s.to, 0)} г</span>}{s.hint && <p>{s.hint}</p>}</div></li>
          ))}
          <li className="done"><time>{fmtTime(plan.total)}</time><div><b>Готово</b></div></li>
        </ol>
      </div>

      {(r.rating > 0 || r.descriptors.length > 0 || r.score) && (
        <div className="recipe-block">
          <h3>Вкус</h3>
          <div className="recipe-taste">
            {r.rating > 0 && <Stars value={r.rating} size={18} />}
            {r.score !== undefined && <span className="score-inline">каппинг <b>{fmtNum(r.score, 2)}</b></span>}
          </div>
          {r.descriptors.length > 0 && <div className="chips static">{r.descriptors.map((d) => <span key={d} className="chip on" data-tone={toneOf(d)}>{d}</span>)}</div>}
        </div>
      )}

      {r.notes && <div className="recipe-block"><h3>Заметки</h3><p className="note-text flush">{r.notes}</p></div>}
    </article>
  );
}

/* ---------- Отправить свою заварку ---------- */

export function ShareScreen({ id }: { id: string }) {
  const { brews, beans, profile, saveProfile, saveBrew } = useStore();
  const b = brews.find((x) => x.id === id);
  const myId = myTelegramId();

  // Своему рецепту при первой отправке выдаём id — по нему друзья смогут его оценить
  useEffect(() => {
    if (b && !b.author && !b.shareId && ratingsEnabled() && myId) saveBrew({ ...b, shareId: newRid() });
  }, [b?.id, b?.shareId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useBadges().featured.map((f) => { const { id: _id, ...rest } = f.badge as typeof f.badge & { id?: string }; return rest; });
  const [link, setLink] = useState('');

  const tg = profile.telegram.trim();
  const me = {
    name: profile.name.trim(),
    username: profile.shareTelegram && tg ? tg : undefined,
    badges: profile.shareBadges && shown.length ? shown : undefined,
  };
  const withNotes = profile.shareNotes ?? true;
  const full = b ? toShared(b, beans.find((x) => x.id === b.beanId), me, myId) : null;
  const recipe = full && !withNotes ? { ...full, notes: '' } : full;
  const key = JSON.stringify(recipe);

  const [prepared, setPrepared] = useState<string | null>(null);
  useEffect(() => {
    if (!recipe) return;
    let alive = true;
    setPrepared(null);
    recipeLink(recipe).then(async (l) => {
      if (!alive) return;
      setLink(l);
      // Оформленное сообщение (жирное название, кнопка) готовим заранее, чтобы отправка шла сразу по нажатию
      if (platform.shareMessage) {
        const [title, ...rest] = recipeText(recipe).split('\n');
        const id = await prepareShare(title, rest.join('\n').replace(/^\n+/, ''), l);
        if (alive) setPrepared(id);
      }
    });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || !recipe) return <Screen title="Поделиться"><Empty title="Нет такой записи" text="Её удалили." /></Screen>;

  const send = async () => {
    if (prepared && platform.shareMessage) {
      const sent = await platform.shareMessage(prepared);
      if (sent) { platform.haptic('success'); return; }
      if (sent === false) return; // окно закрыли без отправки
      // null — не сработало: отправляем обычным способом
    }
    const res = await platform.share(recipeText(recipe), link);
    platform.haptic(res === 'failed' ? 'error' : 'success');
    platform.haptic(res === 'failed' ? 'error' : 'success');
    if (res === 'copied') toast('Рецепт и ссылка скопированы — вставьте в чат');
    if (res === 'failed') toast('Не получилось отправить — скопируйте рецепт');
  };
  const copy = async () => {
    const ok = await copyText(`${recipeText(recipe)}\n\n${link}`);
    platform.haptic(ok ? 'success' : 'error');
    toast(ok ? 'Рецепт скопирован' : 'Не получилось скопировать');
  };

  return (
    <Screen title="Поделиться" subtitle="Так рецепт увидит друг"
      footer={<div className="footer-actions">
        <button type="button" className="round-btn" onClick={copy} disabled={!link} aria-label="Скопировать рецепт"><Icon name="copy" /></button>
        <Button icon="share" wide onClick={send} disabled={!link}>{platform.kind === 'telegram' ? 'Отправить в Telegram' : 'Поделиться'}</Button>
      </div>}>
      {!b.author && (
        <div className="group">
          {!profile.name.trim() && (
            <Field label="Ваше имя" id="share-name" placeholder="как подписать рецепт" value={profile.name}
              onChange={(e) => saveProfile({ ...profile, name: e.target.value })} />
          )}
          <Toggle id="share-tg" label="Ссылка на мой Telegram" checked={profile.shareTelegram && !!tg} disabled={!tg}
            hint={tg ? `Друг сможет открыть @${tg}` : 'Укажите username в профиле'}
            onChange={(v) => saveProfile({ ...profile, shareTelegram: v })} />
          {b.notes.trim() && (
            <Toggle id="share-notes" label="Мои заметки" checked={withNotes}
              hint={withNotes ? `«${b.notes.trim().slice(0, 60)}${b.notes.trim().length > 60 ? '…' : ''}»` : 'Друг не увидит ваши заметки'}
              onChange={(v) => saveProfile({ ...profile, shareNotes: v })} />
          )}
          <Toggle id="share-badges" label="Мои значки" checked={profile.shareBadges && shown.length > 0} disabled={!shown.length}
            hint={shown.length ? `${shown.map((b) => b.title).join(', ')}` : 'Значки появятся в профиле'}
            onChange={(v) => saveProfile({ ...profile, shareBadges: v })} />
        </div>
      )}
      {b.author && <p className="muted pad">Это рецепт {b.author.name || 'друга'} — он уйдёт с указанием исходного автора.</p>}
      <RecipeCard r={recipe} />
      <p className="muted pad">Друг получит текст рецепта и ссылку: по ней рецепт откроется в приложении, его можно сохранить в дневник и заварить по шагам.</p>
    </Screen>
  );
}

/* ---------- Рецепт, присланный другом ---------- */

export function SharedRecipeScreen({ recipe: r }: { recipe: SharedRecipe }) {
  const { beans, saveBean, saveBrew, saveCustom } = useStore();
  const { push, setTab } = useRouter();
  const [savedId, setSavedId] = useState<string | null>(null);

  const ensureBean = (): string | null => {
    if (!r.bean?.name && !r.bean?.country) return null;
    const same = beans.find((x) => x.name === (r.bean?.name ?? '') && x.roaster === (r.bean?.roaster ?? '') && x.country === (r.bean?.country ?? ''));
    if (same) return same.id;
    const bean: Bean = { ...emptyBean(), ...r.bean, comment: r.author.name ? `Из рецепта ${r.author.name}` : '' };
    saveBean(bean);
    return bean.id;
  };

  const toBrew = (beanId: string | null): Brew => ({
    id: uid(), date: Date.now(), methodId: r.methodId, beanId, dose: r.dose, water: r.water, temp: r.temp, grind: r.grind,
    time: r.time, rating: r.rating, taste: { acidity: 3, sweetness: 3, bitterness: 2, body: 3 }, descriptors: r.descriptors,
    notes: r.notes, cupping: null, author: r.author, shareId: r.ref?.rid, authorId: r.ref?.author,
    plan: r.plan ? { ...r.plan } : undefined,
    gear: r.gear.map((g) => ({ ...g, id: 'shared-' + uid() })),
  });

  const save = () => {
    const brew = toBrew(ensureBean());
    saveBrew(brew);
    setSavedId(brew.id);
    platform.haptic('success');
  };

  const [recipeSaved, setRecipeSaved] = useState(false);
  const saveRecipeCopy = () => {
    if (!r.plan) return;
    saveCustom({
      id: uid(), methodId: r.methodId, name: r.plan.name, dose: r.dose, ratio: r.water / r.dose, temp: r.temp, grind: r.grind,
      total: r.plan.total, steps: r.plan.steps, notes: r.notes, author: r.author, createdAt: Date.now(),
    });
    setRecipeSaved(true);
    platform.haptic('success');
  };

  const brewIt = () => {
    const beanId = ensureBean();
    push({ name: 'method', methodId: r.methodId, beanId, from: { ...toBrew(beanId), gear: [] } });
  };

  return (
    <Screen title="Рецепт от друга" subtitle={r.date ? new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : undefined}
      footer={<div className="footer-actions">
        {savedId
          ? <Button kind="secondary" icon="journal" onClick={() => { setTab('journal'); push({ name: 'brew', id: savedId }); }}>В дневнике</Button>
          : <Button kind="secondary" icon="check" onClick={save}>Сохранить</Button>}
        <Button icon="play" wide onClick={brewIt}>Заварить так же</Button>
      </div>}>
      {r.ref && <RateBlock rid={r.ref.rid} author={r.ref.author} authorName={r.author.name} />}
      <RecipeCard r={r} />
      {r.plan && (
        <Button kind="secondary" icon={recipeSaved ? 'check' : 'plus'} onClick={saveRecipeCopy} disabled={recipeSaved}>
          {recipeSaved ? `Рецепт «${r.plan.name}» в ваших рецептах` : 'Добавить рецепт к своим'}
        </Button>
      )}
      <p className="muted pad">«Заварить так же» откроет рецепт с этими параметрами — оборудование выберете своё. Зерно появится на вашей полке без веса — укажете, если купите такую пачку.</p>
    </Screen>
  );
}

function Toggle({ id, label, hint, checked, disabled, onChange }: {
  id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange(v: boolean): void;
}) {
  return (
    <label className={'toggle-row' + (disabled ? ' disabled' : '')} htmlFor={id}>
      <span className="row-main"><span className="row-label">{label}</span>{hint && <span className="row-hint">{hint}</span>}</span>
      <span className="switch">
        <input type="checkbox" id={id} checked={checked} disabled={disabled} onChange={(e) => { platform.haptic('select'); onChange(e.target.checked); }} />
        <span />
      </span>
    </label>
  );
}
