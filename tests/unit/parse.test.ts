import { describe, expect, it } from 'vitest';
import { normalizeProcess, normalizeRoast, parsePage } from '../../worker/src/parse';

const page = (body: string, head = '') => `<html><head>${head}</head><body>${body}</body></html>`;

describe('roaster page parser', () => {
  it('reads Tilda product characteristics', () => {
    const r = parsePage(page(`<h1>Руанда Муремуре, дрип</h1>
      <p class="js-store-prod-charcs">Страна: Руанда</p><p class="js-store-prod-charcs">Обработка: carbonic maceration</p>
      <p class="js-store-prod-charcs">Высота: 1700 - 1900 м</p><p class="js-store-prod-charcs">Кислотность: Высокая</p>`),
    'https://kojocoffee.ru/catalog/drips/tproduct/1-2-muremure');
    expect(r).toMatchObject({ name: 'Руанда Муремуре', country: 'Руанда', process: 'Углекислая мацерация', altitude: '1700–1900 м', roaster: 'Kojo', kind: 'drip', scales: { acidity: 5 } });
  });

  it('reads Bitrix name/value lists and dot scales', () => {
    const r = parsePage(page(`<h1>Эфиопия Гедеб 6 шт</h1>
      <div class="name">Сорт</div> <div class="value">Heirloom</div>
      <span class="card-custom-info__item-name">Сладость</span> <div class="card-custom-info__params-value four"></div>`),
    'https://sbmrne.ru/katalog/drip-pakety/eth-gedeb-6-sht/');
    expect(r).toMatchObject({ name: 'Эфиопия Гедеб', country: 'Эфиопия', variety: 'Heirloom', roaster: 'Submarine', kind: 'drip', dripCount: 6, scales: { sweetness: 4 } });
  });

  it('reads WooCommerce attributes and JSON-LD brand', () => {
    const r = parsePage(page(`<h1>El Salvador San Francisco</h1>
      <table><tr><th class="woocommerce-product-attributes-item__label">Регион</th><td class="woocommerce-product-attributes-item__value">Санта-Ана</td></tr></table>
      <script type="application/ld+json">{"@type":"Product","name":"El Salvador","brand":{"name":"Roaster X"}}</script>`),
    'https://example.com/el-salvador/');
    expect(r).toMatchObject({ name: 'El Salvador San Francisco', region: 'Санта-Ана', roaster: 'Roaster X' });
    expect(r.kind).toBeUndefined();
  });

  it('reads "Label: value" lines and skips empty values', () => {
    const r = parsePage(page(`<h1>Кения Ньери</h1><p>Обжарка: светлая</p><p>Ферма: —</p><p>Вкусовые ноты: смородина, грейпфрут</p>`), 'https://example.com/kenya');
    expect(r).toMatchObject({ country: 'Кения', roastLevel: 'Светлая', packNotes: 'смородина, грейпфрут' });
    expect(r.farm).toBeUndefined();
  });
});

describe('Tasty Coffee and normalization', () => {
  const tasty = (extra = '') => page(`<h1>Бразилия Игуасу</h1>
    <p class="mr-0.5 inline align-middle offset-text">Регион</p><div><img src="data:x"></div><p class="text-[18px] font-din-medium uppercase">Суль-де-Минас</p>
    <p class="mr-0.5 inline align-middle offset-text">Способ обработки</p><p class="text-[18px] font-din-medium">натуральный</p>
    <p class="mr-0.5 inline align-middle offset-text">Степень обжарки</p><p class="text-[18px] font-din-medium">фильтр</p>
    <div class="x">Плотность</div><div class="tc-progress"><object class="tc-progress__object" width="60%"></object></div>
    <p>Сладкий кофе с нотами <span class='descriptor-badge' style='x'>арахиса</span>, <span class='descriptor-badge'>пудры&nbsp;какао</span></p>
    <button><span class="text-primary duration-200">Пачка</span></button><button><span class="text-primary duration-200">Дрипы 10 шт</span></button>
    <button><span class="text-primary duration-200">Дрипы 30 шт</span></button>${extra}`);

  it('reads Vue label/value blocks, progress scales, descriptor badges and the drip switch', () => {
    const r = parsePage(tasty('<script type="application/ld+json">{"@type":"Product","offers":[{"availability":"https://schema.org/InStock"}]}</script>'),
      'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas');
    expect(r).toMatchObject({ name: 'Бразилия Игуасу', country: 'Бразилия', region: 'Суль-де-Минас', process: 'Натуральная', roastLevel: 'Светлая',
      packNotes: 'арахиса, пудры какао', scales: { body: 3 }, dripOptions: [10, 30], roaster: 'Tasty Coffee', inStock: true });
    expect(r.kind).toBeUndefined();
  });

  it('marks capsules as unsupported and out-of-stock lots', () => {
    const r = parsePage(tasty('<script type="application/ld+json">{"@type":"Product","description":"10 капсул","offers":{"availability":"http://schema.org/OutOfStock"}}</script>'),
      'https://shop.tastycoffee.ru/coffee/capsules-brazil');
    expect(r.unsupported).toBe(true);
    expect(r.inStock).toBe(false);
  });

  it('finds the country from an English title', () => {
    expect(parsePage(page('<h1>Kenya Ndunduri PB</h1>'), 'https://hq-coffee.com/kenya-ndunduri-pb/').country).toBe('Кения');
    expect(parsePage(page('<h1>El Salvador Dossokam</h1>'), 'https://hq-coffee.com/x/').country).toBe('Сальвадор');
  });
});

describe('normalization', () => {
  it.each([['Светлая - фильтр', 'Светлая'], ['Фильтр, эспрессо', 'Омни'], ['Средняя - эспрессо', 'Средняя'], ['тёмная', 'Тёмная'], ['под турку', 'Под турку']])(
    'roast %s → %s', (raw, want) => expect(normalizeRoast(raw)).toBe(want));
  it.each([['натуральный', 'Натуральная'], ['Мытый, анаэробный', 'Мытая, анаэробная'], ['Натуральный фанки', 'Натуральный фанки'], ['Эксперимент', 'Эксперимент']])(
    'process %s → %s', (raw, want) => expect(normalizeProcess(raw)).toBe(want));
});
