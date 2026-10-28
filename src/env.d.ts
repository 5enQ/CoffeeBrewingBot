/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** версия приложения «1.N» — задаётся при сборке на GitHub */
  readonly VITE_APP_VERSION?: string;
  /** когда собрано (время коммита) */
  readonly VITE_APP_BUILT?: string;
}
