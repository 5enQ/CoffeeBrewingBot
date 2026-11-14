import { describe, expect, it, vi } from 'vitest';
import { gtinOf, isSocialLink, lookupCode } from '../../src/data/lookup';
import { pickCode } from '../../src/ui/Scanner';
import type { Bean } from '../../src/data/store';

const GS = '\x1d';

describe('«Честный знак» marking code', () => {
  it('gives the product barcode and drops the pack serial', () => {
    // 01 + GTIN-14, 21 + serial, GS, 91/92 check data — as scanned off a pack
    expect(gtinOf(`010460700000123421abcDEF1234567${GS}91EE10${GS}92dGVzdA==`)).toBe('4607000001234');
    expect(gtinOf(`]d2010460700000123421Xy7%k${GS}93AbCd`)).toBe('4607000001234');
    // the short form: GTIN and serial only
    expect(gtinOf('010460700000123421QwErTy')).toBe('4607000001234');
    // a GTIN-14 not starting with 0 stays whole
    expect(gtinOf('011460700000123521abc')).toBe('14607000001235');
  });
  it('leaves other codes alone', () => {
    expect(gtinOf('4607000001234')).toBeNull();
    expect(gtinOf('https://roaster.ru/coffee/ethiopia')).toBeNull();
    expect(gtinOf('Страна: Эфиопия; Обработка: мытая')).toBeNull();
  });
});

describe('social links', () => {
  it('knows a roaster’s social pages', () => {
    for (const u of ['https://instagram.com/roaster', 'https://www.instagram.com/p/abc', 'https://t.me/roastery', 'https://vk.com/club1', 'https://linktr.ee/roaster', 'https://m.vk.com/x'])
      expect(isSocialLink(u), u).toBe(true);
  });
  it('a shop page is not one', () => {
    for (const u of ['https://tasty-coffee.com/catalog/ethiopia', 'https://roaster.ru/', 'https://shop.t-me.ru/x', 'not a url'])
      expect(isSocialLink(u), u).toBe(false);
  });
});

describe('lookupCode', () => {
  it('a social link is kept as the pack link, not its code, and the catalog is not asked', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const r = await lookupCode('https://www.instagram.com/roaster', []);
    expect(r.kind).toBe('social');
    expect(r.patch).toEqual({ link: 'https://www.instagram.com/roaster' });
    expect(r.existing).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('a marking code finds the pack saved by its barcode — and one saved earlier with the whole marking code', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const byEan = { id: 'a', barcode: '4607000001234' } as Bean;
    const byOld = { id: 'b', barcode: `010460700000123421old${GS}91x` } as Bean;
    expect((await lookupCode(`010460700000123421new${GS}91y`, [byEan])).existing?.id).toBe('a');
    expect((await lookupCode(`010460700000123421new${GS}91y`, [byOld])).existing?.id).toBe('b');
    vi.unstubAllGlobals();
  });
});

describe('several codes in the frame', () => {
  it('the product barcode wins over a shipping label, a QR over Code 128', () => {
    expect(pickCode([{ rawValue: 'LBL-1', format: 'code_128' }, { rawValue: '4607000001234', format: 'ean_13' }])).toBe('4607000001234');
    expect(pickCode([{ rawValue: 'LBL-1', format: 'code_128' }, { rawValue: 'https://roaster.ru/x', format: 'qr_code' }])).toBe('https://roaster.ru/x');
    expect(pickCode([])).toBeNull();
  });
});
