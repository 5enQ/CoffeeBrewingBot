import { useEffect, useRef, useState } from 'react';
import { platform } from '../platform';
import { Icon } from './icons';
import { tr } from '../i18n';

type Found = { rawValue: string; format?: string };
type Detector = { detect(src: CanvasImageSource | ImageBitmap): Promise<Found[]> };
/**
 * What a coffee pack carries, best first: the product barcode, then a QR (a link or data) and the DataMatrix of
 * «Честный знак» (the product barcode is inside it), last Code 128 — shipping labels. Code 39 is left out: only
 * labels and stickers use it, and it was read before the code that mattered.
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'code_128'];
/** several codes in the frame: take the one highest in FORMATS */
export function pickCode(found: Found[]): string | null {
  if (!found.length) return null;
  const rank = (f?: string) => { const i = FORMATS.indexOf(f ?? ''); return i < 0 ? FORMATS.length : i; };
  return [...found].sort((a, b) => rank(a.format) - rank(b.format))[0].rawValue;
}

async function nativeDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new(o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported = await BD.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.length ? new BD({ formats }) : null;
  } catch { return null; }
}

/** ZXing (no BarcodeDetector) reading the same formats — Code 39 left out */
async function zxReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128]);
  return new BrowserMultiFormatReader(hints);
}

async function decodeImageFile(file: File): Promise<string | null> {
  const det = await nativeDetector();
  if (det) {
    try {
      const bmp = await createImageBitmap(file);
      const r = await det.detect(bmp);
      const best = pickCode(r);
      if (best) return best;
    } catch { /* try ZXing */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const res = await (await zxReader()).decodeFromImageUrl(url);
    return res.getText();
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/**
 * Full-screen scanner: camera (BarcodeDetector or ZXing),
 * photo of the pack, Telegram's native QR scanner and manual input.
 */
export function Scanner({ onResult, onClose }: { onResult(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'live' | 'nocam'>('starting');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const doneRef = useRef(false);

  const finish = (code: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    platform.haptic('success');
    onResult(code.trim());
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let zxStop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
        const det = await nativeDetector();
        if (det) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
          if (cancelled) return;
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          setState('live');
          let last = 0;
          const tick = async (t: number) => {
            if (cancelled || doneRef.current) return;
            if (t - last > 180 && v.readyState >= 2) {
              last = t;
              try { const best = pickCode(await det.detect(v)); if (best) return finish(best); } catch { /* frame not recognized */ }
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        } else {
          const reader = await zxReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' }, audio: false }, video.current!,
            (res, _err, ctrl) => { if (res) { ctrl.stop(); finish(res.getText()); } },
          );
          zxStop = () => controls.stop();
          if (cancelled) zxStop(); else setState('live');
        }
      } catch {
        if (!cancelled) setState('nocam');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      zxStop?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fromPhoto = async (f?: File) => {
    if (!f) return;
    setBusy(true); setError('');
    const code = await decodeImageFile(f);
    setBusy(false);
    if (code) finish(code); else { platform.haptic('error'); setError(tr('Не нашёл код на фото. Снимите ближе и ровнее, без бликов.')); }
  };

  const tgQr = async () => {
    const code = await platform.scanQr?.(tr('Наведите на QR-код на пачке'));
    if (code) finish(code);
  };

  return (
    <div className="scanner" role="dialog" aria-label={tr('Сканер штрихкода')}>
      <div className="scanner-view">
        <video ref={video} playsInline muted hidden={state !== 'live'} />
        {state === 'live' && <div className="scanner-frame"><span /></div>}
        {state === 'starting' && <p className="scanner-msg">{tr('Включаю камеру…')}</p>}
        {state === 'nocam' && (
          <p className="scanner-msg">{tr('Камера недоступна здесь. Сфотографируйте штрихкод или введите цифры под ним.')}</p>
        )}
        <button type="button" className="icon-btn scanner-close" onClick={onClose} aria-label={tr('Закрыть')}><Icon name="close" /></button>
      </div>

      <div className="scanner-panel">
        {state === 'live' && <p className="muted">{tr('Наведите на штрихкод или QR-код на пачке')}</p>}
        <div className="scanner-actions">
          <label className="btn btn-secondary">
            <Icon name="camera" size={20} /><span>{busy ? tr('Распознаю…') : tr('Фото пачки')}</span>
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} />
          </label>
          {platform.scanQr && (
            <button type="button" className="btn btn-secondary" onClick={tgQr}><Icon name="scan" size={20} /><span>QR Telegram</span></button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <form className="manual" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) finish(manual); }}>
          <input id="manual-code" inputMode="numeric" aria-label={tr('Цифры под штрихкодом')} placeholder={tr('Цифры под штрихкодом')} value={manual} onChange={(e) => setManual(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!manual.trim()}>OK</button>
        </form>
      </div>
    </div>
  );
}
