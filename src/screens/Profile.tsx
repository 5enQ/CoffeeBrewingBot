import { useState } from 'react';
import { GEAR_CATS, type Gear } from '../data/gear';
import { useStore, uid } from '../data/store';
import { platform } from '../platform';
import { useBackGuard, useRouter } from '../router';
import { Icon } from '../ui/icons';
import { Button, Field, Row, SampleTag, Screen, Section } from '../ui/kit';

export function Profile() {
  const store = useStore();
  const { push } = useRouter();
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const user = platform.user();
  const { profile, gear } = store;
  const initials = (profile.name || user?.username || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const addGear = (cat: Gear['cat']) => push({ name: 'gearEdit', gear: { id: uid(), cat, name: '', details: '' }, isNew: true });

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

  const emptyCats = GEAR_CATS.filter((c) => !gear.some((g) => g.cat === c.id));

  return (
    <Screen title="Профиль" root>
      <div className="profile-card">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <div className="profile-fields">
          <input id="profile-name" className="profile-name" placeholder="Ваше имя" value={profile.name}
            onChange={(e) => store.saveProfile({ ...profile, name: e.target.value })} aria-label="Имя автора" />
          {user?.username && <span className="profile-handle">@{user.username}</span>}
          <textarea id="profile-about" className="profile-about" rows={2} placeholder="Пара слов о себе: как любите кофе"
            value={profile.about} onChange={(e) => store.saveProfile({ ...profile, about: e.target.value })} />
        </div>
      </div>
      <p className="muted pad">Это имя увидят друзья в рецептах, которыми вы поделитесь.</p>

      <div className="stats">
        <div><b>{store.brews.length}</b><span>заварок</span></div>
        <div><b>{store.beans.length}</b><span>зёрен</span></div>
        <div><b>{gear.length}</b><span>оборудования</span></div>
      </div>

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
                    onClick={() => push({ name: 'gearEdit', gear: g, isNew: false })} />
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
          <p className="muted pad">Для наглядности добавлены зёрна, заварки и оборудование с пометкой «пример».</p>
          <Button kind="secondary" onClick={async () => { if (await platform.confirm('Удалить все примеры?')) store.removeSamples(); }}>Удалить примеры</Button>
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
        <Row label="Хранилище" value={platform.kind === 'telegram' ? 'Telegram на устройстве' : platform.kind === 'native' ? 'Память приложения' : 'Браузер'} />
      </Section>
    </Screen>
  );
}

export function GearEdit({ gear: initial, isNew }: { gear: Gear; isNew: boolean }) {
  const { saveGear, deleteGear } = useStore();
  const { back } = useRouter();
  const [g, setG] = useState<Gear>(initial);
  const dirty = JSON.stringify(g) !== JSON.stringify(initial);
  useBackGuard(dirty, 'Выйти без сохранения?');
  const cat = GEAR_CATS.find((c) => c.id === g.cat)!;

  const save = () => {
    saveGear({ ...g, name: g.name.trim(), details: g.details.trim(), sample: dirty ? undefined : g.sample });
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
        <Button icon="check" wide onClick={save} disabled={!g.name.trim()}>Сохранить</Button>
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
          onChange={(e) => setG({ ...g, name: e.target.value })} />
        <datalist id={`sugg-${g.cat}`}>{cat.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <Field label="Детали" id="gear-details" value={g.details} placeholder={g.cat === 'grinder' ? 'жернова, доработки' : 'объём, материал, заметки'}
          onChange={(e) => setG({ ...g, details: e.target.value })} />
      </Section>

      <Section title="Популярное" plain>
        <div className="chips">
          {cat.suggestions.map((s) => (
            <button type="button" key={s} className={'chip' + (g.name === s ? ' on' : '')} onClick={() => { platform.haptic('select'); setG({ ...g, name: s }); }}>{s}</button>
          ))}
        </div>
      </Section>
    </Screen>
  );
}
