import { badgeTone, sortBadges, type BadgeLite } from '../data/badges';
import type { Author } from '../data/store';
import { platform } from '../platform';
import { Icon } from './icons';

export function BadgeChip({ b, onClick }: { b: BadgeLite; onClick?: () => void }) {
  const inner = (
    <>
      <span className="badge-medal"><Icon name="medal" size={18} /></span>
      <span className="badge-text">
        <b>{b.title}</b>
        {(b.detail || b.year) && <small>{[b.detail, b.year].filter(Boolean).join(' · ')}</small>}
      </span>
    </>
  );
  return onClick
    ? <button type="button" className="badge" data-tone={badgeTone(b)} onClick={onClick}>{inner}</button>
    : <span className="badge" data-tone={badgeTone(b)}>{inner}</span>;
}

export function BadgeRow({ badges, max = 3 }: { badges: BadgeLite[]; max?: number }) {
  if (!badges.length) return null;
  const list = sortBadges(badges);
  return (
    <div className="badge-row">
      {list.slice(0, max).map((b, i) => <BadgeChip key={i} b={b} />)}
      {list.length > max && <span className="badge-more">+{list.length - max}</span>}
    </div>
  );
}

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Автор рецепта: имя, ссылка на Telegram (если автор разрешил), значки */
export function AuthorBlock({ author, label = 'Рецепт от' }: { author: Author; label?: string }) {
  const name = author.name || (author.username ? '@' + author.username : 'Без имени');
  return (
    <div className="author-block">
      <div className="author">
        <span className="avatar small" aria-hidden="true">{initials(name)}</span>
        <span>
          <small>{label}</small>
          <b>{name}</b>
        </span>
        {author.username && (
          <button type="button" className="tg-link" onClick={() => platform.openLink(`https://t.me/${author.username}`)}>
            @{author.username}
          </button>
        )}
      </div>
      {author.badges && author.badges.length > 0 && <BadgeRow badges={author.badges} max={4} />}
    </div>
  );
}
