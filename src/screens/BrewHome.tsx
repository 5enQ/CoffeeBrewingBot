import { allMethods, methodById, fmtNum } from '../data/methods';
import { newCustomMethod } from '../data/recipes';
import { uid } from '../data/store';
import { Icon } from '../ui/icons';
import { useStore } from '../data/store';
import { useRouter, useSelected } from '../router';
import { MethodIcon } from '../ui/icons';
import { Row, Screen, Section } from '../ui/kit';
import { BrewScore } from '../ui/CuppingForm';
import { brewBeanTitle } from './beanUtils';
import { platform } from '../platform';
import { toast } from '../ui/toast';
import { useFlip } from '../ui/motion';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Method } from '../data/methods';
import type { TileLayout } from '../data/store';

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
function MethodTile({ id, className, onOpen, onPin, pinned, label, children }: {
  id: string; className: string; onOpen(): void; onPin(): void; pinned: boolean; label: string; children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return (
    <button type="button" className={className} data-flip={id}
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

/* ---------- Редактирование плиток ---------- */

type Size = 1 | 2;

/** Плитка в режиме редактирования: нажатие — выбрать, перетаскивание — переставить, ручка справа — размер */
function EditTile({ m, size, selected, pinned, dragging, onSelect, onDragStart, onDragMove, onDragEnd, onResize, onKey }: {
  m: Method; size: Size; selected: boolean; pinned: boolean; dragging: boolean;
  onSelect(): void; onDragStart(el: HTMLElement, x: number, y: number): void; onDragMove(x: number, y: number): void; onDragEnd(): void;
  onResize(s: Size): void; onKey(e: KeyboardEvent): void;
}) {
  const start = useRef<{ x: number; y: number; moved: boolean; el: HTMLElement } | null>(null);
  const handle = useRef<{ x: number; base: Size } | null>(null);
  const [preview, setPreview] = useState<Size | null>(null);
  const shown = preview ?? size;

  const down = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget as HTMLElement };
  };
  const move = (e: RPointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) { s.moved = true; onDragStart(s.el, s.x, s.y); }
    if (s.moved) onDragMove(e.clientX, e.clientY);
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (s.moved) onDragEnd(); else onSelect();
  };

  const hDown = (e: RPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handle.current = { x: e.clientX, base: size };
  };
  const hMove = (e: RPointerEvent) => {
    const h = handle.current;
    if (!h) return;
    const dx = e.clientX - h.x;
    setPreview(dx > 24 ? 2 : dx < -24 ? 1 : h.base);
  };
  const hUp = (e: RPointerEvent) => {
    e.stopPropagation();
    const h = handle.current;
    handle.current = null;
    if (!h) return;
    const dx = e.clientX - h.x;
    setPreview(null);
    const next: Size = Math.abs(dx) < 6 ? (h.base === 2 ? 1 : 2) : dx > 0 ? 2 : 1;
    if (next !== size) onResize(next);
  };

  return (
    <div data-tile={m.id} data-flip={m.id} role="button" tabIndex={0}
      aria-label={`${m.name}: ${shown === 2 ? 'большая' : 'маленькая'} плитка${pinned ? ', закреплена' : ''}`} aria-pressed={selected}
      className={'method-card edit' + (shown === 1 ? ' small' : '') + (selected ? ' selected' : '') + (dragging ? ' dragging' : '') + (pinned ? ' pinned' : '')}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; onDragEnd(); }}
      onKeyDown={onKey}>
      <span className="method-icon"><MethodIcon icon={m.icon} size={28} /></span>
      <span className="method-name">{m.name}</span>
      {pinned && <span className="pin-mark" aria-hidden="true"><Icon name="pin" size={14} /></span>}
      {selected && (
        <button type="button" className="tile-handle" aria-label={shown === 2 ? 'Сделать маленькой' : 'Сделать большой'}
          onPointerDown={hDown} onPointerMove={hMove} onPointerUp={hUp} onPointerCancel={() => { handle.current = null; setPreview(null); }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onResize(size === 2 ? 1 : 2); } }} />
      )}
    </div>
  );
}

/** Порядок плиток: закреплённые первыми, затем сохранённый порядок, новые методы — в конце */
function orderTiles(all: Method[], tiles: TileLayout, pinned: string[]) {
  const ids = all.map((m) => m.id);
  const base = [...tiles.order.filter((id) => ids.includes(id)), ...ids.filter((id) => !tiles.order.includes(id))];
  const pins = pinned.filter((id) => ids.includes(id));
  return [...pins, ...base.filter((id) => !pins.includes(id))];
}

export function BrewHome() {
  const { push } = useRouter();
  const { brews, beans, pinned, togglePin, tiles, saveTiles } = useStore();
  const all = allMethods().filter((m) => m.id !== 'cupping');
  const cupping = methodById('cupping');
  const savedOrder = orderTiles(all, tiles, pinned);

  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<{ tiles: TileLayout; pinned: string[] }[]>([]);
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const order = drag?.order ?? savedOrder;
  const ordered = order.map((id) => all.find((m) => m.id === id)!).filter(Boolean);
  const sizeOf = (id: string): Size => tiles.size[id] ?? 2;

  const commit = (next: { order?: string[]; size?: Record<string, Size> }) => {
    setHistory((h) => [...h.slice(-30), { tiles, pinned }]);
    const nextOrder = next.order ?? savedOrder;
    // закреплённые остаются первыми — в том порядке, в каком их расставили
    saveTiles({ order: nextOrder, size: next.size ?? tiles.size }, nextOrder.filter((id) => pinned.includes(id)));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    platform.haptic('light');
    setHistory((h) => h.slice(0, -1));
    snapshot();
    saveTiles(last.tiles, last.pinned);
  };

  /** Куда встанет плитка: закреплённые двигаются только среди закреплённых, остальные — после них */
  const place = (list: string[], id: string, to: number) => {
    const pins = list.filter((x) => pinned.includes(x)).length;
    const rest = list.filter((x) => x !== id);
    const lo = pinned.includes(id) ? 0 : pins;
    const hi = pinned.includes(id) ? pins - 1 : rest.length;
    const i = Math.max(lo, Math.min(hi, to));
    return [...rest.slice(0, i), id, ...rest.slice(i)];
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const snapshot = useFlip(gridRef, drag?.id);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const lastHit = useRef<string | null>(null);
  // плитка едет за пальцем: смещение от её места в сетке до пальца
  const grab = useRef<{ id: string; ox: number; oy: number; x: number; y: number } | null>(null);
  const placeGhost = () => {
    const g = grab.current, grid = gridRef.current;
    if (!g || !grid) return;
    const el = grid.querySelector<HTMLElement>(`[data-tile="${g.id}"]`);
    if (!el) return;
    const gr = grid.getBoundingClientRect();
    // не даём плитке уехать за край сетки: иначе страница начинает сдвигаться вбок
    const left = Math.max(-8, Math.min(grid.clientWidth - el.offsetWidth + 8, g.x - gr.left - g.ox));
    const top = Math.max(-16, Math.min(grid.clientHeight - el.offsetHeight + 16, g.y - gr.top - g.oy));
    el.style.transform = `translate(${left - el.offsetLeft}px, ${top - el.offsetTop}px) scale(1.05)`;
  };
  useLayoutEffect(placeGhost);

  const dragStart = (id: string, el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    grab.current = { id, ox: x - r.left, oy: y - r.top, x, y };
    lastHit.current = null;
    setSelected(null);
    setDrag({ id, order: savedOrder });
    platform.haptic('light');
  };
  const dragMove = (id: string, x: number, y: number) => {
    const grid = gridRef.current;
    if (!grid || !grab.current) return;
    grab.current.x = x; grab.current.y = y;
    placeGhost();
    // место ищем по сетке (без учёта анимаций), а не по тому, что сейчас под пальцем
    const gr = grid.getBoundingClientRect();
    const gx = x - gr.left, gy = y - gr.top;
    const els = [...grid.querySelectorAll<HTMLElement>('[data-tile]')].filter((e) => e.dataset.tile !== id);
    const hit = els.find((e) => gx >= e.offsetLeft && gx <= e.offsetLeft + e.offsetWidth && gy >= e.offsetTop && gy <= e.offsetTop + e.offsetHeight);
    // одна плитка — один обмен: пока палец над той же плиткой, повторно не переставляем (иначе дрожит)
    const hitId = hit?.dataset.tile ?? null;
    if (!hitId || hitId === lastHit.current) { if (!hitId) lastHit.current = null; return; }
    lastHit.current = hitId;
    const cur = dragRef.current?.order ?? savedOrder;
    // встаём на место той плитки, над которой палец: остальные сдвигаются на одну позицию
    const next = place(cur, id, cur.indexOf(hitId));
    if (next.join() === cur.join()) return;
    snapshot();
    setDrag({ id, order: next });
  };
  const dragEnd = () => {
    // отпустили — плитка доезжает до своего места
    const g = grab.current;
    grab.current = null;
    const el = g && gridRef.current?.querySelector<HTMLElement>(`[data-tile="${g.id}"]`);
    if (el) {
      el.classList.add('dropping');
      el.style.transform = '';
      setTimeout(() => el.classList.remove('dropping'), 260);
    }
    setDrag((d) => {
      if (d && d.order.join() !== savedOrder.join()) { commit({ order: d.order }); platform.haptic('select'); }
      return null;
    });
  };
  const resize = (id: string, s: Size) => { platform.haptic('select'); snapshot(); commit({ size: { ...tiles.size, [id]: s } }); };
  const keyMove = (id: string, e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected((x) => (x === id ? null : id)); return; }
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = savedOrder.indexOf(id);
    const next = place(savedOrder, id, i + dir);
    if (next.join() !== savedOrder.join()) { snapshot(); commit({ order: next }); }
  };
  const finish = () => { setEditing(false); setSelected(null); setHistory([]); setDrag(null); };
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
                label={brewBeanTitle(b, bean)}
                hint={`${m.name}${b.plan ? ` · ${b.plan.name}` : ''} · ${fmtNum(b.dose, 2)} г → ${fmtNum(b.water)} г`}
                value={<BrewScore brew={b} size={14} />}
                onClick={() => push({ name: 'method', methodId: b.methodId, beanId: b.beanId, from: b })}
                active={sel?.name === 'method' && sel.from?.id === b.id}
              />
            );
          })}
        </Section>
      )}

      <Section title="Метод приготовления" aside={editing ? (
        <span className="aside-actions">
          {history.length > 0 && <button type="button" className="icon-btn" aria-label="Отменить" onClick={undo}><Icon name="undo" /></button>}
          <button type="button" className="btn btn-primary btn-small" onClick={finish}>Готово</button>
        </span>
      ) : (
        <span className="aside-actions">
          <button type="button" className="icon-btn" aria-label="Свой метод"
            onClick={() => push({ name: 'methodEdit', isNew: true, method: newCustomMethod('cm' + uid()) })}><Icon name="plus" /></button>
          <button type="button" className="icon-btn" aria-label="Изменить плитки" onClick={() => { platform.haptic('light'); setEditing(true); }}><Icon name="edit" /></button>
        </span>
      )} plain>
        {editing && <p className="muted small-note pad edit-hint">Нажмите на плитку, чтобы выбрать её, и тяните ручку справа — плитка станет больше или меньше. Перетащите плитку, чтобы переставить.</p>}
        <div className={'method-grid' + (editing ? ' editing' : '')} ref={gridRef}>
          {editing && ordered.map((m) => (
            <EditTile key={m.id} m={m} size={sizeOf(m.id)} selected={selected === m.id} pinned={pinned.includes(m.id)} dragging={drag?.id === m.id}
              onSelect={() => { platform.haptic('select'); setSelected((x) => (x === m.id ? null : m.id)); }}
              onDragStart={(el, x, y) => dragStart(m.id, el, x, y)}
              onDragMove={(x, y) => dragMove(m.id, x, y)} onDragEnd={dragEnd}
              onResize={(s) => resize(m.id, s)} onKey={(e) => keyMove(m.id, e)} />
          ))}
          {!editing && ordered.map((m) => {
            const isPinned = pinned.includes(m.id);
            return (
              <MethodTile key={m.id} id={m.id} pinned={isPinned}
                className={'method-card' + (sizeOf(m.id) === 1 ? ' small' : '') + (isPinned ? ' pinned' : '') + (((sel?.name === 'recipes') || (sel?.name === 'method' && !sel.from)) && sel.methodId === m.id ? ' active' : '')}
                onOpen={() => push({ name: 'recipes', methodId: m.id })}
                onPin={() => { togglePin(m.id); platform.haptic('success'); toast(isPinned ? `«${m.name}» откреплён` : `«${m.name}» закреплён наверху`); }}
                label={m.name}>
                <span className="method-icon"><MethodIcon icon={m.icon} size={28} /></span>
                <span className={'method-name' + (sizeOf(m.id) === 1 ? ' sr-only' : '')}>{m.name}</span>
                {isPinned && <span className="pin-mark" aria-hidden="true"><Icon name="pin" size={14} /></span>}
              </MethodTile>
            );
          })}
        </div>
        {!editing && !pinned.some((id) => all.some((m) => m.id === id)) && <p className="muted small-note pad">Зажмите метод, чтобы закрепить его наверху, или нажмите карандаш, чтобы расставить плитки.</p>}
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
