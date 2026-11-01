/**
 * Colored panels in Profile:
 *  - the tester's panel (grant «Тестировщик»; the owner has it too): what to check, report a bug, diagnostics;
 *  - the owner's checklist editor (inside the owner's panel).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { RATINGS_API } from '../config';
import { useStore } from '../data/store';
import { adminCall, type AdminData } from '../data/lookup';
import { answerCheck, diagnostics, diagText, loadChecks, sendReport, setDiagExtra, shrinkImage, type CheckItem } from '../data/tester';
import { platform } from '../platform';
import { Button, Section } from '../ui/kit';
import { copyText, toast } from '../ui/toast';

/** a colored frame with a heading: who the panel is for */
export function Panel({ kind, title, hint, children }: { kind: 'owner' | 'tester'; title: string; hint: string; children: ReactNode }) {
  return (
    <div className={`role-panel role-${kind}`}>
      <div className="role-panel-head"><b>{title}</b><span>{hint}</span></div>
      {children}
    </div>
  );
}

/** text + optional screenshot; used for bug reports and for «есть проблема» on a check */
function ReportForm({ id, placeholder, onSend, onCancel, sendLabel = 'Отправить' }: {
  id: string; placeholder: string; sendLabel?: string; onCancel?: () => void;
  onSend(text: string, image?: string): Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const ok = await onSend(text.trim(), image);
    setBusy(false);
    if (ok) { setText(''); setImage(undefined); }
  };
  return (
    <div className="report-form">
      <textarea id={id} className="notes" rows={3} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} maxLength={3000} />
      <div className="report-actions">
        <label className="btn btn-secondary">
          <span>{image ? 'Скриншот добавлен ✓' : 'Добавить скриншот'}</span>
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { setImage(await shrinkImage(f)); } catch { toast('Не получилось открыть картинку'); }
          }} />
        </label>
        {image && <button type="button" className="link-btn" onClick={() => setImage(undefined)}>убрать</button>}
        <span className="spacer" />
        {onCancel && <button type="button" className="link-btn" onClick={onCancel}>Отмена</button>}
        <Button icon="check" disabled={busy || !text.trim()} onClick={send}>{busy ? 'Отправляем…' : sendLabel}</Button>
      </div>
    </div>
  );
}

/* ---------- tester ---------- */

export function TesterPanel() {
  const { sync } = useStore();
  const [checks, setChecks] = useState<CheckItem[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [server, setServer] = useState('…');

  useEffect(() => { loadChecks().then((r) => setChecks(r.ok ? r.data.checks : [])); }, []);
  useEffect(() => {
    if (!RATINGS_API) return;
    fetch(`${RATINGS_API}/version`).then((r) => (r.ok ? r.json() : null)).then((j) => setServer(j?.version ?? 'нет связи')).catch(() => setServer('нет связи'));
  }, []);
  const syncText = sync.state === 'off' ? 'выключена' : sync.state === 'error' ? `ошибка: ${sync.error ?? ''}` : sync.at ? `${sync.state === 'syncing' ? 'идёт' : 'ок'} · ${new Date(sync.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : sync.state;
  useEffect(() => { setDiagExtra({ server, sync: syncText }); }, [server, syncText]);

  const answer = async (c: CheckItem, state: 'ok' | 'bug', text?: string, image?: string) => {
    const r = await answerCheck(c.id, state, text, image);
    if (!r.ok) { toast(r.error); return false; }
    setChecks(r.data.checks); setProblem(null);
    platform.haptic('success');
    toast(state === 'ok' ? 'Спасибо! Отметили, что работает' : 'Спасибо! Проблема отправлена разработчику');
    return true;
  };

  return (
    <Panel kind="tester" title="Панель тестировщика" hint="Видна тестировщикам. Всё, что вы отправите, придёт разработчику в Telegram вместе с версией и устройством.">
      <Section title="Что проверить">
        {checks === null && <p className="muted pad">Загружаем…</p>}
        {checks?.length === 0 && <p className="muted pad">Сейчас проверять нечего — когда появится новая версия, здесь будет список.</p>}
        {checks?.map((c) => (
          <div key={c.id} className={'check-row' + (c.mine ? ` done-${c.mine}` : '')}>
            <div className="check-text">{c.text}</div>
            <div className="check-actions">
              <button type="button" className={'chip' + (c.mine === 'ok' ? ' on' : '')} aria-pressed={c.mine === 'ok'} onClick={() => answer(c, 'ok')}>✓ Работает</button>
              <button type="button" className={'chip warn' + (c.mine === 'bug' ? ' on' : '')} aria-pressed={c.mine === 'bug'} onClick={() => setProblem(problem === c.id ? null : c.id)}>⚠ Есть проблема</button>
            </div>
            {problem === c.id && (
              <ReportForm id={`check-${c.id}`} placeholder="Что пошло не так? Что вы делали перед этим?" sendLabel="Отправить проблему"
                onCancel={() => setProblem(null)} onSend={(t, img) => answer(c, 'bug', t, img)} />
            )}
          </div>
        ))}
      </Section>

      <Section title="Сообщить об ошибке">
        <ReportForm id="bug-report" placeholder="Опишите, что случилось и как это повторить. Можно приложить скриншот."
          onSend={async (t, img) => {
            const r = await sendReport(t, img);
            if (!r.ok) { toast(r.error); return false; }
            platform.haptic('success'); toast('Спасибо! Отправили разработчику');
            return true;
          }} />
      </Section>

      <Section title="Диагностика">
        <dl className="diag">
          {diagnostics({ server, sync: syncText }).map((d) => <div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}
        </dl>
        <div className="pad">
          <Button kind="secondary" icon="copy" onClick={async () => { if (await copyText(diagText())) toast('Отчёт скопирован'); }}>Скопировать отчёт</Button>
        </div>
      </Section>
    </Panel>
  );
}

/* ---------- owner: the checklist ---------- */

export function OwnerChecks({ checks, onChange }: { checks: AdminData['checks']; onChange(d: AdminData): void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const act = async (action: 'check_add' | 'check_remove' | 'check_clear', id?: string) => {
    if (action === 'check_clear' && !(await platform.confirm('Очистить весь список вместе с ответами тестировщиков?'))) return;
    if (action === 'check_remove' && !(await platform.confirm('Убрать этот пункт и ответы на него?'))) return;
    setBusy(true);
    const next = await adminCall({ action, note: action === 'check_add' ? text : undefined, what: id });
    setBusy(false);
    if (next) { onChange(next); if (action === 'check_add') setText(''); platform.haptic('success'); }
    else toast('Не получилось — нет связи с сервером');
  };
  const list = checks ?? [];
  return (
    <Section title="Что проверить тестировщикам" aside={list.length ? <span className="tag">{list.length}</span> : undefined}>
      <p className="muted pad small-note">Тестировщики видят этот список и отвечают «работает» или «есть проблема». Каждый ответ приходит вам сообщением от бота.</p>
      {list.map((c) => (
        <div key={c.id} className="check-row owner">
          <button type="button" className="check-text as-btn" onClick={() => setOpen(open === c.id ? null : c.id)}>
            {c.text}
            <span className="check-count"><span className="ok">✓ {c.ok}</span> <span className="bad">⚠ {c.bug}</span></span>
          </button>
          {open === c.id && (
            <div className="check-answers">
              {(c.answers ?? []).length === 0 && <p className="muted small-note">Пока никто не ответил.</p>}
              {(c.answers ?? []).map((a, i) => (
                <p key={i} className="small-note"><b>{a.state === 'ok' ? '✓' : '⚠'} {a.who}</b>{a.note ? ` — ${a.note}` : ''}</p>
              ))}
              <button type="button" className="link-btn danger" disabled={busy} onClick={() => act('check_remove', c.id)}>Убрать пункт</button>
            </div>
          )}
        </div>
      ))}
      <textarea id="check-new" className="notes" rows={2} placeholder="Например: колд брю — сообщение от бота приходит, когда время вышло" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      <div className="site-actions">
        <Button icon="plus" disabled={busy || !text.trim()} onClick={() => act('check_add')}>Добавить пункт</Button>
        {list.length > 0 && <Button kind="secondary" disabled={busy} onClick={() => act('check_clear')}>Очистить список</Button>}
      </div>
    </Section>
  );
}
