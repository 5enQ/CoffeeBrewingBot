import { useEffect, useMemo, useState } from 'react';
import { earnedAchievements, type Achievement } from '../data/achievements';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { BadgeChip } from './Badges';

/** New achievement notification. Achievements are hidden until earned — you learn about them when you get them. */
export function AchievementToast() {
  const { ready, brews, profile, seenAch, markSeen } = useStore();
  const [queue, setQueue] = useState<Achievement[]>([]);
  const ach = useMemo(() => earnedAchievements(brews, profile.ratingStats?.count ?? 0), [brews, profile.ratingStats]);

  useEffect(() => {
    if (!ready) return;
    // First run: treat everything already earned as seen, so we don't flood with notifications
    if (seenAch === null) { markSeen(ach.map((a) => a.unlock)); return; }
    const fresh = ach.filter((a) => !seenAch.includes(a.unlock));
    if (!fresh.length) return;
    markSeen(fresh.map((a) => a.unlock));
    setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.unlock === f.unlock))]);
    platform.haptic('success');
  }, [ach, seenAch, ready, markSeen]);

  const cur = queue[0];
  useEffect(() => {
    if (!cur) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 5000);
    return () => clearTimeout(t);
  }, [cur]);

  if (!cur) return null;
  return (
    <div className="toast" role="status" onClick={() => setQueue((q) => q.slice(1))} key={cur.unlock}>
      <span className="toast-eyebrow">Новый значок</span>
      <BadgeChip b={cur.badge} />
      <small>Его можно показать в профиле</small>
    </div>
  );
}
