/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** app version "X.Y.Z" — set at build time on GitHub */
  readonly VITE_APP_VERSION?: string;
  /** build time (commit time) */
  readonly VITE_APP_BUILT?: string;
}
