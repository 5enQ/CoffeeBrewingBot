import { StoreProvider, useStore } from './data/store';
import { DepthCtx, RouterProvider, useRouter, type Route, type Tab } from './router';
import { DialogHost } from './ui/kit';
import { Icon } from './ui/icons';
import { BrewHome } from './screens/BrewHome';
import { MethodScreen } from './screens/MethodScreen';
import { TimerScreen } from './screens/TimerScreen';
import { BrewEdit } from './screens/BrewEdit';
import { Journal, BrewDetail } from './screens/Journal';
import { Beans, BeanDetail, BeanEdit } from './screens/Beans';
import { Profile, GearEdit, BadgeEdit } from './screens/Profile';
import { ShareScreen, SharedRecipeScreen } from './screens/Share';
import { useEffect } from 'react';
import { platform } from './platform';
import { decodeRecipe } from './data/share';

function renderRoute(r: Route) {
  switch (r.name) {
    case 'method': return <MethodScreen methodId={r.methodId} beanId={r.beanId} from={r.from} />;
    case 'timer': return <TimerScreen draft={r.draft} />;
    case 'brewEdit': return <BrewEdit draft={r.draft} isNew={r.isNew} openCupping={r.openCupping} />;
    case 'brew': return <BrewDetail id={r.id} />;
    case 'bean': return <BeanDetail id={r.id} />;
    case 'beanEdit': return <BeanEdit bean={r.bean} isNew={r.isNew} scanOnOpen={r.scanOnOpen} />;
    case 'badgeEdit': return <BadgeEdit badge={r.badge} isNew={r.isNew} />;
    case 'gearEdit': return <GearEdit gear={r.gear} isNew={r.isNew} />;
    case 'share': return <ShareScreen id={r.id} />;
    case 'shared': return <SharedRecipeScreen recipe={r.recipe} />;
  }
}

const TABS: { id: Tab; label: string; icon: 'brew' | 'journal' | 'beans' | 'profile' }[] = [
  { id: 'brew', label: 'Заварить', icon: 'brew' },
  { id: 'journal', label: 'Дневник', icon: 'journal' },
  { id: 'beans', label: 'Зёрна', icon: 'beans' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];

function Shell() {
  const { tab, setTab, stack, push } = useRouter();
  const { ready } = useStore();

  // Открыли по ссылке «поделиться» — показываем присланный рецепт
  useEffect(() => {
    if (!ready) return;
    const param = platform.startParam();
    if (!param) return;
    decodeRecipe(param).then((recipe) => {
      if (recipe) push({ name: 'shared', recipe });
      if (location.hash.includes('r=')) history.replaceState(null, '', location.pathname + location.search);
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <div className="boot" />;

  const root = { brew: <BrewHome />, journal: <Journal />, beans: <Beans />, profile: <Profile /> }[tab];
  const top = stack.length;

  return (
    <>
      {/* Нижние экраны стека остаются смонтированными, чтобы не терять ввод и таймер */}
      <div hidden={top > 0}><DepthCtx.Provider value={0}>{root}</DepthCtx.Provider></div>
      {stack.map((r, i) => (
        <div key={`${i}-${r.name}`} hidden={i !== top - 1}>
          <DepthCtx.Provider value={i + 1}>{renderRoute(r)}</DepthCtx.Provider>
        </div>
      ))}
      {top === 0 && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
              <Icon name={t.icon} size={24} /><span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      <DialogHost />
    </>
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
