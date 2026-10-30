import { loadTimer } from './data/timer';
import { TabPages, useTabPill } from './ui/motion';
import { CuppingSetup } from './screens/CuppingSetup';
import { StoreProvider, useStore } from './data/store';
import { useStatsSync } from './data/stats';
import { DepthCtx, RouterProvider, useRouter, type Route, type Tab } from './router';
import { DialogHost } from './ui/kit';
import { AchievementToast } from './ui/AchievementToast';
import { ToastHost } from './ui/toast';
import { Icon } from './ui/icons';
import { BrewHome } from './screens/BrewHome';
import { MethodScreen } from './screens/MethodScreen';
import { TimerScreen } from './screens/TimerScreen';
import { BrewEdit } from './screens/BrewEdit';
import { Journal, BrewDetail } from './screens/Journal';
import { Beans, BeanDetail, BeanEdit } from './screens/Beans';
import { Profile, GearEdit, BadgeEdit } from './screens/Profile';
import { MethodEdit, RecipeEdit } from './screens/RecipeEdit';
import { RecipesScreen } from './screens/Recipes';
import { ShareScreen, SharedRecipeScreen } from './screens/Share';
import { useEffect, useRef, type ReactNode } from 'react';
import { LayoutCtx, useLayoutMode } from './layout';
import { MethodIcon } from './ui/icons';
import { platform } from './platform';
import { resolveStartParam } from './data/share';
import { loadCard } from './data/card';
import { CardEditScreen, CardShareScreen, CardViewScreen } from './screens/CardScreens';
import { t } from './i18n';

function renderRoute(r: Route) {
  switch (r.name) {
    case 'recipes': if (r.methodId === 'cupping') return <CuppingSetup beanId={r.beanId} />;
      return <RecipesScreen methodId={r.methodId} beanId={r.beanId} />;
    case 'method': if (r.methodId === 'cupping') return <CuppingSetup beanId={r.beanId} from={r.from} />;
      return <MethodScreen methodId={r.methodId} beanId={r.beanId} from={r.from} recipeId={r.recipeId} />;
    case 'timer': return <TimerScreen draft={r.draft} resume={r.resume} />;
    case 'brewEdit': return <BrewEdit draft={r.draft} isNew={r.isNew} openCupping={r.openCupping} />;
    case 'brew': return <BrewDetail id={r.id} fresh={r.fresh} />;
    case 'bean': return <BeanDetail id={r.id} />;
    case 'beanEdit': return <BeanEdit bean={r.bean} isNew={r.isNew} scanOnOpen={r.scanOnOpen} />;
    case 'methodEdit': return <MethodEdit method={r.method} isNew={r.isNew} />;
    case 'recipeEdit': return <RecipeEdit recipe={r.recipe} isNew={r.isNew} />;
    case 'badgeEdit': return <BadgeEdit badge={r.badge} isNew={r.isNew} />;
    case 'gearEdit': return <GearEdit gear={r.gear} isNew={r.isNew} />;
    case 'share': return <ShareScreen id={r.id} />;
    case 'shared': return <SharedRecipeScreen recipe={r.recipe} />;
    case 'cardEdit': return <CardEditScreen />;
    case 'cardShare': return <CardShareScreen />;
    case 'card': return <CardViewScreen card={r.card} />;
  }
}

const TABS: { id: Tab; readonly label: string; icon: 'brew' | 'journal' | 'beans' | 'profile' }[] = [
  { id: 'brew', get label() { return t('tab.brew'); }, icon: 'brew' },
  { id: 'journal', get label() { return t('tab.journal'); }, icon: 'journal' },
  { id: 'beans', get label() { return t('tab.shelf'); }, icon: 'beans' },
  { id: 'profile', get label() { return t('tab.profile'); }, icon: 'profile' },
];

function Shell() {
  const { tab, setTab, stack, push } = useRouter();
  const { ready, profile } = useStore();
  const { mode } = useLayoutMode();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  useTabPill(navRef, pillRef, `${tab}-${stack.length === 0}-${mode}-${ready}`);

  useEffect(() => { document.documentElement.dataset.layout = mode; }, [mode]);

  // Opened from a share link — show the received recipe
  useEffect(() => {
    if (!ready) return;
    const param = platform.startParam();
    if (!param) return;
    // "timer" — from the bot's "brew is ready" message
    if (param === 'timer') {
      const t = loadTimer();
      if (t) push({ name: 'timer', draft: t.draft, resume: true });
      return;
    }
    // "p…" — a profile card
    if (param.startsWith('p')) {
      loadCard(param.slice(1)).then((card) => {
        if (card) push({ name: 'card', card });
        else platform.alert('Не получилось открыть профиль по ссылке. Проверьте интернет и попробуйте ещё раз.');
        if (location.hash.includes('r=')) history.replaceState(null, '', location.pathname + location.search);
      });
      return;
    }
    resolveStartParam(param).then((recipe) => {
      if (recipe) push({ name: 'shared', recipe });
      else platform.alert('Не получилось открыть рецепт по ссылке. Проверьте интернет и попробуйте ещё раз.');
      if (location.hash.includes('r=')) history.replaceState(null, '', location.pathname + location.search);
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <div className="boot" />;

  const renderTab = (t: Tab) => ({ brew: <BrewHome />, journal: <Journal />, beans: <Beans />, profile: <Profile /> }[t]);
  const root = renderTab(tab);
  const top = stack.length;
  // Stack screens stay mounted so input and timers are not lost
  const stackScreens = stack.map((r, i) => (
    <div key={`${i}-${r.name}`} hidden={i !== top - 1} className="stack-screen">
      <DepthCtx.Provider value={i + 1}>{renderRoute(r)}</DepthCtx.Provider>
    </div>
  ));
  const overlays = <><DialogHost /><AchievementToast /><ToastHost /></>;

  if (mode === 'desktop') {
    return (
      <LayoutCtx.Provider value="desktop">
        <div className="desk">
          <aside className="side">
            <div className="side-brand"><span className="side-logo"><MethodIcon icon="v60" size={22} /></span>Brewbook</div>
            <nav className="side-nav">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
                  <Icon name={t.icon} size={22} /><span>{t.label}</span>
                </button>
              ))}
            </nav>
            <button type="button" className="side-me" onClick={() => setTab('profile')}>
              <span className="avatar small" aria-hidden="true">{(profile.name || '?').slice(0, 1).toUpperCase()}</span>
              <span><b>{profile.name || 'Профиль'}</b>{profile.telegram && <small>@{profile.telegram}</small>}</span>
            </button>
          </aside>
          <section className="pane pane-list" aria-label="Список">
            <div className="pane-scroll"><DepthCtx.Provider value={0}>{root}</DepthCtx.Provider></div>
          </section>
          <section className="pane pane-detail" aria-label="Подробности">
            {top === 0 && <Placeholder tab={tab} />}
            {stackScreens}
          </section>
        </div>
        {overlays}
      </LayoutCtx.Provider>
    );
  }

  return (
    <LayoutCtx.Provider value="mobile">
      <div hidden={top > 0}><DepthCtx.Provider value={0}><TabPages tab={tab} order={TABS.map((t) => t.id)} render={renderTab} /></DepthCtx.Provider></div>
      {stackScreens}
      {top === 0 && (
        <nav className="tabbar" ref={navRef}>
          <span className="tab-pill" ref={pillRef} aria-hidden="true" />
          {TABS.map((t) => (
            <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
              <Icon name={t.icon} size={24} /><span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      {overlays}
    </LayoutCtx.Provider>
  );
}

/** Right pane while nothing is selected */
function Placeholder({ tab }: { tab: Tab }) {
  const text: Record<Tab, [ReactNode, string, string]> = {
    brew: [<MethodIcon icon="v60" size={48} />, 'Выберите метод', 'Слева — способы заваривания и последние заварки. Рецепт и таймер откроются здесь.'],
    journal: [<Icon name="journal" size={44} />, 'Выберите заварку', 'Карточка с параметрами, вкусом и каппингом откроется здесь.'],
    beans: [<Icon name="beans" size={44} />, 'Выберите пачку', 'Остаток, состав и заварки из этой пачки — здесь.'],
    profile: [<Icon name="profile" size={44} />, 'Профиль', 'Рецепты, значки и оборудование открываются здесь для редактирования.'],
  };
  const [icon, title, hint] = text[tab];
  return (
    <div className="placeholder">
      <span className="placeholder-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}

/** Keeps the server's brew log (for verified achievements) up to date */
function StatsSync() { useStatsSync(); return null; }

export default function App() {
  return (
    <StoreProvider>
      <StatsSync />
      <RouterProvider>
        <Shell />
      </RouterProvider>
    </StoreProvider>
  );
}
