import { useEffect, useState } from 'react';
import { catById } from '../data/gear';
import { methodById, fmtNum, fmtRatio, fmtTime } from '../data/methods';
import { recipeLink, recipeText, toShared, type SharedRecipe } from '../data/share';
import { emptyBean, useStore, uid, type Bean, type Brew } from '../data/store';
import { toneOf } from '../data/cupping';
import { platform } from '../platform';
import { useRouter } from '../router';
import { Icon, MethodIcon } from '../ui/icons';
import { Button, Empty, Field, Screen, Stars } from '../ui/kit';

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Карточка рецепта — одинаково выглядит у автора (превью) и у друга */
export function RecipeCard({ r }: { r: SharedRecipe }) {
  const m = methodById(r.methodId);
  const beanName = r.bean?.name || [r.bean?.country, r.bean?.region].filter(Boolean).join(', ');
  const origin = r.bean ? [r.bean.country, r.bean.region, r.bean.farm].filter(Boolean).join(' · ') : '';
  const authorName = r.author.name || (r.author.username ? '@' + r.author.username : 'Без имени');

  return (
    <article className="recipe-card">
      <header className="recipe-head">
        <span className="method-hero-icon"><MethodIcon icon={m.icon} size={40} /></span>
        <div>
          <span className="eyebrow">{m.name}</span>
          <h2>{beanName || 'Рецепт заварки'}</h2>
          {origin && <p className="muted">{origin}</p>}
        </div>
      </header>

      <div className="author">
        <span className="avatar small" aria-hidden="true">{initials(authorName)}</span>
        <span><small>Рецепт от</small><b>{authorName}</b>{r.author.username && r.author.name && <em>@{r.author.username}</em>}</span>
      </div>

      <dl className="param-grid">
        <div><dt>Кофе</dt><dd>{fmtNum(r.dose, 2)} г</dd></div>
        <div><dt>{m.yieldLabel ?? 'Вода'}</dt><dd>{fmtNum(r.water)} г</dd></div>
        <div><dt>Пропорция</dt><dd>{fmtRatio(r.water / r.dose)}</dd></div>
        <div><dt>Температура</dt><dd>{r.temp ? `${fmtNum(r.temp)}°C` : 'холодная'}</dd></div>
        <div><dt>Время</dt><dd>{fmtTime(r.time)}</dd></div>
        <div><dt>Помол</dt><dd>{r.grind || '—'}</dd></div>
      </dl>

      {r.gear.length > 0 && (
        <div className="recipe-block">
          <h3>Оборудование</h3>
          <ul className="gear-ul">
            {r.gear.map((g, i) => <li key={i}><span>{catById(g.cat).one}</span><b>{g.name}{g.details && <small> · {g.details}</small>}</b></li>)}
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
        <h3>Шаги</h3>
        <ol className="steps-preview compact">
          {m.steps.map((s, i) => (
            <li key={i}><time>{fmtTime(s.at)}</time><div><b>{s.title}</b>{s.to !== undefined && <span className="pour">до {fmtNum(r.water * s.to, 0)} г</span>}</div></li>
          ))}
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
  const { brews, beans, profile, saveProfile } = useStore();
  const b = brews.find((x) => x.id === id);
  const user = platform.user();
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');

  const recipe = b ? toShared(b, beans.find((x) => x.id === b.beanId), { name: profile.name.trim(), username: user?.username }) : null;
  const key = JSON.stringify(recipe);

  useEffect(() => {
    if (recipe) recipeLink(recipe).then(setLink);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || !recipe) return <Screen title="Поделиться"><Empty title="Нет такой записи" text="Её удалили." /></Screen>;

  const send = async () => {
    const res = await platform.share(recipeText(recipe), link);
    platform.haptic(res === 'failed' ? 'error' : 'success');
    setMsg(res === 'copied' ? 'Рецепт и ссылка скопированы — вставьте в чат другу.' : res === 'failed' ? 'Не получилось отправить. Скопируйте текст вручную.' : '');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${recipeText(recipe)}\n\n${link}`); setMsg('Скопировано.'); platform.haptic('success'); }
    catch { setMsg('Буфер обмена недоступен.'); }
  };

  return (
    <Screen title="Поделиться" subtitle="Так рецепт увидит друг"
      footer={<div className="footer-actions">
        <button type="button" className="round-btn" onClick={copy} aria-label="Скопировать текст"><Icon name="journal" /></button>
        <Button icon="share" wide onClick={send} disabled={!link}>{platform.kind === 'telegram' ? 'Отправить в Telegram' : 'Поделиться'}</Button>
      </div>}>
      {!b.author && !profile.name.trim() && (
        <div className="group">
          <Field label="Ваше имя" id="share-name" placeholder="как подписать рецепт" value={profile.name}
            onChange={(e) => saveProfile({ ...profile, name: e.target.value })} />
        </div>
      )}
      <RecipeCard r={recipe} />
      {msg && <p className="status">{msg}</p>}
      <p className="muted pad">Друг получит текст рецепта и ссылку: по ней рецепт откроется в приложении, его можно сохранить в дневник и заварить по шагам.</p>
    </Screen>
  );
}

/* ---------- Рецепт, присланный другом ---------- */

export function SharedRecipeScreen({ recipe: r }: { recipe: SharedRecipe }) {
  const { beans, saveBean, saveBrew } = useStore();
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
    notes: r.notes, cupping: null, author: r.author,
    gear: r.gear.map((g) => ({ ...g, id: 'shared-' + uid() })),
  });

  const save = () => {
    const brew = toBrew(ensureBean());
    saveBrew(brew);
    setSavedId(brew.id);
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
      <RecipeCard r={r} />
      <p className="muted pad">«Заварить так же» откроет рецепт с этими параметрами — оборудование выберете своё. Зерно добавится в ваши зёрна.</p>
    </Screen>
  );
}
