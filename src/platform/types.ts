/**
 * Единый интерфейс платформы.
 * Весь код приложения общается с окружением ТОЛЬКО через него —
 * поэтому одно и то же приложение работает в Telegram, в браузере
 * и внутри нативной обёртки (Capacitor) без изменений.
 */

export type HapticKind =
  | 'light' | 'medium' | 'heavy'      // тактильный «удар»
  | 'success' | 'warning' | 'error'   // уведомление
  | 'select';                         // смена выбора

export interface PlatformUser {
  id?: string;
  name?: string;
  username?: string;
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export interface Platform {
  kind: 'telegram' | 'web' | 'native';
  /** true — у платформы есть своя кнопка «назад», рисовать её в шапке не нужно */
  hasNativeBack: boolean;

  init(): Promise<void>;
  user(): PlatformUser | null;
  colorScheme(): 'light' | 'dark';
  onThemeChange(cb: () => void): () => void;

  haptic(kind: HapticKind): void;

  /** Асинхронное key-value хранилище (DeviceStorage в Telegram, Preferences в Capacitor, localStorage в вебе) */
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };

  /** Облачное хранилище аккаунта (Telegram CloudStorage): общее для всех устройств пользователя. null — нет. */
  cloud: CloudKV | null;

  /** Обработчик системной «назад» (null — скрыть кнопку) */
  setBackHandler(fn: (() => void) | null): void;

  confirm(message: string): Promise<boolean>;
  alert(message: string): Promise<void>;

  /** Не гасить экран (во время таймера) */
  keepAwake(on: boolean): Promise<void>;
  /** Спрашивать подтверждение при закрытии (во время заварки) */
  setClosingConfirmation(on: boolean): void;

  /** Нативный сканер QR, если платформа его даёт (Telegram). Штрихкоды EAN — через камеру в браузере. */
  scanQr?: (hint: string) => Promise<string | null>;

  openLink(url: string): void;

  /** Открыто на компьютере (Telegram Desktop / веб-версия / браузер с мышью) */
  isDesktopClient(): boolean;
  /** Развернуть окно мини-приложения на весь экран (Telegram 8.0+) */
  requestFullscreen?: () => void;

  /** Подписанные данные запуска Telegram (initData) — для проверки пользователя на сервере */
  initData(): string | null;

  /** Параметр запуска: startapp в Telegram, #r=… в вебе */
  startParam(): string | null;

  /** Отправить текст и ссылку: в Telegram — выбор чата, в вебе — системное «Поделиться» или буфер обмена */
  share(text: string, url: string): Promise<ShareResult>;

  /** Отправить заранее подготовленное ботом сообщение (Telegram Bot API 8.0+, WebApp.shareMessage).
   *  true — отправлено, false — пользователь закрыл окно, null — не сработало (нужен запасной способ) */
  shareMessage?: (preparedId: string) => Promise<boolean | null>;
}

/** Облачное key-value: ключи до 128 символов [A-Za-z0-9_-], значения до 4096 символов, до 1024 ключей */
export interface CloudKV {
  getItems(keys: string[]): Promise<Record<string, string>>;
  setItem(key: string, value: string): Promise<void>;
  removeItems(keys: string[]): Promise<void>;
  getKeys(): Promise<string[]>;
}
export const CLOUD_LIMITS = { keys: 1024, value: 4096, key: 128 };
