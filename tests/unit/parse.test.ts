import { describe, expect, it } from 'vitest';
import { parsePage } from '../../worker/src/parse';

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
