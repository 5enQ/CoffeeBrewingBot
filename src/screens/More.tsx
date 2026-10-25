import { useState } from 'react';
import { useStore } from '../data/store';
import { platform } from '../platform';
import { Button, Row, Screen, Section } from '../ui/kit';

export function More() {
  const store = useStore();
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const user = platform.user();

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

  return (
    <Screen title="Ещё" root>
      <Section title="Данные">
        <Row label="Зёрен" value={store.beans.length} />
        <Row label="Заварок" value={store.brews.length} />
        <Row label="Хранилище" value={platform.kind === 'telegram' ? 'Telegram на устройстве' : platform.kind === 'native' ? 'Память приложения' : 'Браузер'} />
      </Section>

      {store.hasSamples && (
        <Section title="Примеры" plain>
          <p className="muted pad">Для наглядности добавлены два зерна и две заварки с пометкой «пример».</p>
          <Button kind="secondary" onClick={async () => { if (await platform.confirm('Удалить примеры?')) store.removeSamples(); }}>Удалить примеры</Button>
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
        {user?.name && <Row label="Пользователь" value={user.name} />}
        <p className="muted pad">Гиды по заварке, дневник и каппинг-анкета SCA. Работает в Telegram, в браузере и как приложение на телефоне.</p>
      </Section>
    </Screen>
  );
}
