/** The loading animation (a roaster's cooling tray, see roaster.ts) with an optional line under it */
import { roasterSvg } from './roaster';

const SVG = roasterSvg();

export function Loader({ label, small = false, overlay = false }: { label?: string; small?: boolean; overlay?: boolean }) {
  return (
    <div className={'loader' + (small ? ' small' : '') + (overlay ? ' overlay' : '')} role="status" aria-live="polite">
      <div className="loader-art" dangerouslySetInnerHTML={{ __html: SVG }} />
      {label && <p>{label}</p>}
    </div>
  );
}
