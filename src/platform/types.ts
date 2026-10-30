/**
 * Single platform interface.
 * All app code talks to the environment ONLY through it —
 * so the same app runs in Telegram, in a browser
 * and inside the native wrapper (Capacitor) unchanged.
 */

export type HapticKind =
  | 'light' | 'medium' | 'heavy'      // tactile "impact"
  | 'success' | 'warning' | 'error'   // notification
  | 'select';                         // selection change

export interface PlatformUser {
  id?: string;
  name?: string;
  username?: string;
  /** profile photo URL (Telegram gives it to Mini Apps in many cases) */
  photo?: string;
  /** IETF language tag from the platform (Telegram language_code), used to pick the UI locale */
  languageCode?: string;
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export interface Platform {
  kind: 'telegram' | 'web' | 'native';
  /** true — the platform has its own "back" button, no need to draw one in the header */
  hasNativeBack: boolean;

  init(): Promise<void>;
  user(): PlatformUser | null;
  colorScheme(): 'light' | 'dark';
  onThemeChange(cb: () => void): () => void;

  haptic(kind: HapticKind): void;

  /** Async key-value storage (DeviceStorage in Telegram, Preferences in Capacitor, localStorage on the web) */
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };

  /** Account cloud storage (Telegram CloudStorage): shared by all the user's devices. null — none. */
  cloud: CloudKV | null;

  /** System "back" handler (null — hide the button) */
  setBackHandler(fn: (() => void) | null): void;

  confirm(message: string): Promise<boolean>;
  alert(message: string): Promise<void>;

  /** Device tilt in degrees: beta — front/back, gamma — left/right. Returns an unsubscribe function. */
  onTilt(cb: (beta: number, gamma: number) => void): () => void;

  /** Keep the screen on (during the timer) */
  keepAwake(on: boolean): Promise<void>;
  /** Ask for confirmation on close (while brewing) */
  setClosingConfirmation(on: boolean): void;

  /** Native QR scanner if the platform has one (Telegram). EAN barcodes go through the browser camera. */
  scanQr?: (hint: string) => Promise<string | null>;

  openLink(url: string): void;

  /** Opened on a computer (Telegram Desktop / web version / browser with a mouse) */
  isDesktopClient(): boolean;
  /** Expand the Mini App window to full screen (Telegram 8.0+) */
  requestFullscreen?: () => void;

  /** Signed Telegram launch data (initData) — to verify the user on the server */
  initData(): string | null;

  /** Let the bot write to the user (Telegram 6.9+, WebApp.requestWriteAccess). Absent outside Telegram */
  requestWriteAccess?: () => Promise<boolean>;

  /** Launch parameter: startapp in Telegram, #r=… on the web */
  startParam(): string | null;

  /** Send text and a link: chat picker in Telegram, system share sheet or clipboard on the web */
  share(text: string, url: string): Promise<ShareResult>;

  /** Send a message prepared by the bot in advance (Telegram Bot API 8.0+, WebApp.shareMessage).
   *  true — sent, false — the user closed the window, null — did not work (a fallback is needed) */
  shareMessage?: (preparedId: string) => Promise<boolean | null>;
}

/** Cloud key-value: keys up to 128 chars [A-Za-z0-9_-], values up to 4096 chars, up to 1024 keys */
export interface CloudKV {
  getItems(keys: string[]): Promise<Record<string, string>>;
  setItem(key: string, value: string): Promise<void>;
  removeItems(keys: string[]): Promise<void>;
  getKeys(): Promise<string[]>;
}
export const CLOUD_LIMITS = { keys: 1024, value: 4096, key: 128 };
