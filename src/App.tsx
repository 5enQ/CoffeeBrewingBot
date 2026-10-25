import { StoreProvider, useStore } from './data/store';
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
import { useEffect, type ReactNode } from 'react';
import { LayoutCtx, useLayoutMode } from './layout';
import { MethodIcon } from './ui/icons';
import { platform } from './platform';
import { resolveStartParam } from './data/share';

function renderRoute(r: Route) {
  switch (r.name) {
    case 'recipes': return <RecipesScreen methodId={r.methodId} beanId={r.beanId} />;
    case 'method': return <MethodScreen methodId={r.methodId} beanId={r.beanId} from={r.from} recipeId={r.recipeId} />;
    case 'timer': return <TimerScreen draft={r.draft} />;
    case 'brewEdit': return <BrewEdit draft={r.draft} isNew={r.isNew} openCupping={r.openCupping} />;
    case 'brew': return <BrewDetail id={r.id} />;
    case 'bean': return <BeanDetail id={r.id} />;
    case 'beanEdit': return <BeanEdit bean={r.bean} isNew={r.isNew} scanOnOpen={r.scanOnOpen} />;
    case 'methodEdit': return <MethodEdit method={r.method} isNew={r.isNew} />;
    case 'recipeEdit': return <RecipeEdit recipe={r.recipe} isNew={r.isNew} />;
    case 'badgeEdit': return <BadgeEdit badge={r.badge} isNew={r.isNew} />;
    case 'gearEdit': return <GearEdit gear={r.gear} isNew={r.isNew} />;
    case 'share': return <ShareScreen id={r.id} />;
    case 'shared': return <SharedRecipeScreen recipe={r.recipe} />;
  }
}

const TABS: { id: Tab; label: string; icon: 'brew' | 'journal' | 'beans' | 'profile' }[] = [
  { id: 'brew', label: 'Заварить', icon: 'brew' },
  { id: 'journal', label: 'Дневник', icon: 'journal' },
  { id: 'beans', label: 'Полка', icon: 'beans' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];

function Shell() {
  const { tab, setTab, stack, push } = useRouter();
  const { ready, profile } = useStore();
  const { mode } = useLayoutMode();

  useEffect(() => { document.documentElement.dataset.layout = mode; }, [mode]);

  // Открыли по ссылке «поделиться» — показываем присланный рецепт
  useEffect(() => {
    if (!ready) return;
    const param = platform.startParam();
    if (!param) return;
    resolveStartParam(param).then((recipe) => {
      if (recipe) push({ name: 'shared', recipe });
      else platform.alert('Не получилось открыть рецепт по ссылке. Проверьте интернет и попробуйте ещё раз.');
      if (location.hash.includes('r=')) history.replaceState(null, '', location.pathname + location.search);
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <div className="boot" />;

  const root = { brew: <BrewHome />, journal: <Journal />, beans: <Beans />, profile: <Profile /> }[tab];
  const top = stack.length;
  // Экраны стека остаются смонтированными, чтобы не терять ввод и таймер
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
      <div hidden={top > 0}><DepthCtx.Provider value={0}>{root}</DepthCtx.Provider></div>
      {stackScreens}
      {top === 0 && (
        <nav className="tabbar">
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

/** Правая колонка, пока ничего не выбрано */
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

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider>
        <Shell />
      </RouterProvider>
    </StoreProvider>
  );
}
