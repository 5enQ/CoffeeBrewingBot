import { allMethods, methodById, fmtNum } from '../data/methods';
import { newCustomMethod } from '../data/recipes';
import { uid } from '../data/store';
import { Icon } from '../ui/icons';
import { useStore } from '../data/store';
import { useRouter, useSelected } from '../router';
import { MethodIcon } from '../ui/icons';
import { Row, Screen, Section } from '../ui/kit';
import { BrewScore } from '../ui/CuppingForm';
import { beanTitle } from './beanUtils';
import { platform } from '../platform';
import { toast } from '../ui/toast';
import { useRef, type ReactNode } from 'react';

const HOLD_MS = 450;
/** После закрепления плитки переставляются, и палец оказывается над соседней.
 *  Общая пауза не даёт тому же жесту закрепить вторую плитку. */
const PIN_COOLDOWN_MS = 1000;
let lastPinAt = 0;
let lastPointer = 'mouse';
function pinOnce(onPin: () => void) {
  const now = Date.now();
  if (now - lastPinAt < PIN_COOLDOWN_MS) return false;
  lastPinAt = now;
  onPin();
  return true;
}

/** Плитка метода: нажатие открывает, долгое нажатие (или правая кнопка мыши) закрепляет */
function MethodTile({ className, onOpen, onPin, pinned, label, children }: {
  className: string; onOpen(): void; onPin(): void; pinned: boolean; label: string; children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return (
    <button type="button" className={className}
      aria-label={`${label}${pinned ? ', закреплён' : ''}`}
      title={pinned ? 'Зажмите или правый клик — открепить' : 'Зажмите или правый клик — закрепить'}
      onPointerDown={(e) => {
        lastPointer = e.pointerType;
        if (e.button !== 0) return;
        held.current = false; start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(() => { held.current = true; timer.current = null; pinOnce(onPin); }, HOLD_MS);
      }}
      onPointerMove={(e) => { if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel(); }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        // на сенсорном экране контекстное меню приходит вместе с долгим нажатием — его обрабатывает таймер
        if (lastPointer !== 'mouse' || held.current || timer.current) return;
        held.current = true; pinOnce(onPin);
      }}
      onClick={() => { if (held.current || Date.now() - lastPinAt < 400) { held.current = false; return; } onOpen(); }}>
      {children}
    </button>
  );
}

export function BrewHome() {
  const { push } = useRouter();
  const { brews, beans, pinned, togglePin } = useStore();
  const all = allMethods().filter((m) => m.id !== 'cupping');
  const cupping = methodById('cupping');
  const ordered = [
    ...pinned.map((id) => all.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m),
    ...all.filter((m) => !pinned.includes(m.id)),
  ];
  const recent = brews.filter((b) => b.methodId !== 'cupping').slice(0, 3);
  const sel = useSelected();

  return (
    <Screen title="Что завариваем?" root>
      {recent.length > 0 && (
        <Section title="Повторить">
          {recent.map((b) => {
            const m = methodById(b.methodId);
            const bean = beans.find((x) => x.id === b.beanId);
            return (
              <Row key={b.id}
                leading={<MethodIcon icon={m.icon} size={26} />}
                label={beanTitle(bean)}
                hint={`${m.name}${b.plan ? ` · ${b.plan.name}` : ''} · ${fmtNum(b.dose, 2)} г → ${fmtNum(b.water)} г`}
                value={<BrewScore brew={b} size={14} />}
                onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}
                active={sel?.name === 'method' && sel.from?.id === b.id}
              />
            );
          })}
        </Section>
      )}

      <Section title="Метод приготовления" aside={
        <button type="button" className="icon-btn" aria-label="Свой метод"
          onClick={() => push({ name: 'methodEdit', isNew: true, method: newCustomMethod('cm' + uid()) })}><Icon name="plus" /></button>
      } plain>
        <div className="method-grid">
          {ordered.map((m) => {
            const isPinned = pinned.includes(m.id);
            return (
              <MethodTile key={m.id} pinned={isPinned}
                className={'method-card' + (isPinned ? ' pinned' : '') + (((sel?.name === 'recipes') || (sel?.name === 'method' && !sel.from)) && sel.methodId === m.id ? ' active' : '')}
                onOpen={() => push({ name: 'recipes', methodId: m.id })}
                onPin={() => { togglePin(m.id); platform.haptic('success'); toast(isPinned ? `«${m.name}» откреплён` : `«${m.name}» закреплён наверху`); }}
                label={m.name}>
                <span className="method-icon"><MethodIcon icon={m.icon} size={28} /></span>
                <span className="method-name">{m.name}</span>
                {isPinned && <span className="pin-mark" aria-hidden="true"><Icon name="pin" size={14} /></span>}
              </MethodTile>
            );
          })}
        </div>
        {!pinned.some((id) => all.some((m) => m.id === id)) && <p className="muted small-note pad">Зажмите метод, чтобы закрепить его наверху.</p>}
      </Section>

      <Section title="Оценка кофе" plain>
        <button type="button" className={'method-card wide' + (((sel?.name === 'recipes') || (sel?.name === 'method' && !sel.from)) && sel.methodId === 'cupping' ? ' active' : '')}
          onClick={() => push({ name: 'recipes', methodId: 'cupping' })}>
          <span className="method-icon"><MethodIcon icon={cupping.icon} size={28} /></span>
          <span className="method-name">Каппинг<small>Протокол SCA CVA · до{'\u00a0'}6{'\u00a0'}образцов</small></span>
        </button>
      </Section>
    </Screen>
  );
}
