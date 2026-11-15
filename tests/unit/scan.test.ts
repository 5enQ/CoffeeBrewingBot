import { describe, expect, it, vi } from 'vitest';
import { catalogKeys, gtinOf, isSocialLink, lookupCode } from '../../src/data/lookup';
import { bareUrl, foreignCode } from '../../worker/src/notpack';
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

describe('codes that are not from a coffee pack', () => {
  const cases: [string, string][] = [
    ['WIFI:T:WPA;S:Home;P:secret123;;', 'код сети Wi‑Fi'],
    ['BEGIN:VCARD\nVERSION:3.0\nFN:Иван\nEND:VCARD', 'визитка'],
    ['MECARD:N:Иван;TEL:+79990000000;;', 'визитка'],
    ['tel:+79990000000', 'номер телефона'],
    ['mailto:a@b.ru', 'адрес почты'],
    ['geo:55.75,37.61', 'место на карте'],
    ['otpauth://totp/Bank:me?secret=ABC', 'ключ двухфакторной защиты'],
    ['ST00012|Name=ООО Ромашка|PersonalAcc=40702810000000000000|Sum=10000', 'платёжный QR-код'],
    ['t=20261115T1803&s=450.00&fn=7380440700000000&i=1234&fp=123456&n=1', 'QR-код с чека'],
    ['https://qr.nspk.ru/AD10006M8KH234?type=02&bank=100000000111&sum=45000', 'ссылка на оплату или банк'],
    ['https://www.gosuslugi.ru/covid-cert/verify/123', 'ссылка на госуслуги'],
    ['https://docs.google.com/document/d/abc/edit?usp=sharing', 'ссылка на документ или файл'],
    ['https://disk.yandex.ru/d/abc', 'ссылка на документ или файл'],
    ['https://yandex.ru/maps/-/CDabc', 'ссылка на карту'],
    ['https://maps.app.goo.gl/xyz', 'ссылка на карту'],
    ['https://zoom.us/j/123?pwd=x', 'ссылка на видеовстречу'],
  ];
  it('names what it is', () => {
    for (const [c, what] of cases) expect(foreignCode(c), c).toBe(what);
  });
  it('a pack’s own codes pass', () => {
    for (const c of ['4607000001234', 'https://tasty-coffee.com/catalog/ethiopia?id=5', 'https://yandex.ru/search?text=coffee', 'Страна: Эфиопия; Обработка: мытая', 'LOT-2026-114', '{"country":"Кения"}'])
      expect(foreignCode(c), c).toBeNull();
  });
  it('nothing is saved and nothing leaves the phone', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const [c, what] of cases) {
      const r = await lookupCode(c, [{ id: 'x', barcode: c } as Bean]);
      expect(r.kind, c).toBe('foreign');
      expect(r.what).toBe(what);
      expect(r.patch).toEqual({});
      expect(r.existing).toBeUndefined();
    }
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('a short code with no coffee data is kept, a long text is not', async () => {
    expect((await lookupCode('LOT-2026-114', [])).patch).toEqual({ barcode: 'LOT-2026-114' });
    expect((await lookupCode('Спасибо, что выбрали нашу обжарку! Подписывайтесь на рассылку и получите скидку', [])).patch).toEqual({});
    expect((await lookupCode('строка один\nстрока два', [])).patch).toEqual({});
  });
  it('a social, payment or document link is never a catalog key', () => {
    expect(catalogKeys({ link: 'https://instagram.com/roaster', barcode: '' }).url).toBeUndefined();
    expect(catalogKeys({ link: 'https://docs.google.com/x', barcode: '' }).url).toBeUndefined();
    expect(catalogKeys({ link: 'https://roaster.ru/kenya', barcode: '' }).url).toBe('https://roaster.ru/kenya');
  });
  it('the owner sees the site and page only, never the query that may carry a token', () => {
    expect(bareUrl('https://shop.ru/p/kenya?token=abc#x')).toBe('https://shop.ru/p/kenya');
    expect(bareUrl('nope')).toBe('');
  });
});
