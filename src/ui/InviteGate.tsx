import { useState } from 'react';
import { answerInvite } from '../data/stats';
import { useStore } from '../data/store';
import { platform, sessionExpired } from '../platform';
import { Button } from './kit';
import { toast } from './toast';
import { tr } from '../i18n';

/**
 * A role the owner offered (the tester role) waits for the person's answer: on the first start after the offer
 * the app asks. Agreeing gives the role; declining leaves it out, and the owner sees it in the panel.
 */
export function InviteGate() {
  const { profile, setServerStats } = useStore();
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  const s = profile.serverStats;
  if (!s?.invites?.includes('beta') || later) return null;
  const answer = async (accept: boolean) => {
    setBusy(true);
    const next = await answerInvite('beta', accept);
    setBusy(false);
    if (!next) { toast(sessionExpired() ? tr('Telegram-сессия устарела: закройте Brewbook и откройте снова — спросим ещё раз') : tr('Нет связи с сервером — спросим ещё раз при следующем запуске')); setLater(true); return; }
    setServerStats(next);
    platform.haptic(accept ? 'success' : 'light');
    toast(accept ? tr('Вы тестировщик — панель тестировщика в Профиле') : tr('Хорошо, роль не выдана'));
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="dialog invite">
        <h2 id="invite-title">{tr('Вас пригласили в тестировщики')}</h2>
        <p>{tr('Тестировщики первыми пробуют новые версии Brewbook и отмечают, что работает, а что нет.')}</p>
        <p className="muted">{tr('Для этого приложение будет собирать дополнительные данные. В отчёт об ошибке попадут ваш текст и скриншот, если вы его приложите, а также версия приложения, устройство, система и размер экрана. Разработчик увидит ваше имя и ник в Telegram, чтобы уточнить детали.')}</p>
        <p className="muted">{tr('Отказаться можно сейчас, а позже — попросить разработчика забрать роль.')}</p>
        <div className="dialog-actions">
          <Button kind="secondary" disabled={busy} onClick={() => answer(false)}>{tr('Отказаться')}</Button>
          <Button icon="check" disabled={busy} onClick={() => answer(true)}>{tr('Согласиться')}</Button>
        </div>
      </div>
    </div>
  );
}
