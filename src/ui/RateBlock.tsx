import { useState } from 'react';
import { fmtNum } from '../data/methods';
import { myTelegramId, ratingsEnabled, sendRating } from '../data/ratings';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { Stars } from './kit';

/** Оценка чужого рецепта: уходит автору через сервер оценок */
export function RateBlock({ rid, author, authorName }: { rid: string; author: string; authorName?: string }) {
  const { rated, saveRated } = useStore();
  const [stars, setStars] = useState(rated[rid] ?? 0);
  const [state, setState] = useState<{ busy?: boolean; msg?: string; error?: boolean }>({});

  if (!ratingsEnabled()) return null;
  const me = myTelegramId();
  if (me && me === author) return null;

  const rate = async (v: number) => {
    if (!v) return;
    setStars(v);
    setState({ busy: true });
    const res = await sendRating(rid, author, v);
    if (res.ok) {
      saveRated(rid, v);
      platform.haptic('success');
      setState({ msg: `Спасибо! Сейчас у рецепта ${fmtNum(res.avg)} ★ · ${res.count} ${plural(res.count)}` });
    } else {
      platform.haptic('error');
      setStars(rated[rid] ?? 0);
      setState({ msg: res.error, error: true });
    }
  };

  return (
    <div className="rate-block">
      <div>
        <b>{rated[rid] ? 'Ваша оценка' : 'Оцените рецепт'}</b>
        <small>{authorName ? `${authorName} увидит оценку в профиле` : 'Автор увидит оценку в профиле'}</small>
      </div>
      {me ? (
        <Stars value={stars} onChange={state.busy ? undefined : rate} size={32} />
      ) : (
        <p className="muted">Оценить можно, открыв рецепт в Telegram.</p>
      )}
      {state.msg && <p className={state.error ? 'error' : 'status'}>{state.msg}</p>}
    </div>
  );
}

export const plural = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'оценка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'оценки';
  return 'оценок';
};
