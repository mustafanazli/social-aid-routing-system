/**
 * sanitizeAddress için hafif birim testleri.
 * Çalıştırma:  npx tsx src/lib/sanitizeAddress.test.ts
 */
import assert from 'node:assert/strict';

import { sanitizeAddress, detectNeighborhood } from './sanitizeAddress';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('sanitizeAddress testleri:');

test('gürültü etiketlerini (Kat/Daire/Tel) temizler', () => {
  const { cleanAddress } = sanitizeAddress(
    'Batı Mahallesi, Atatürk Cad. No:12 Kat:3 Daire:7 Tel: 0555 111 22 33',
  );
  assert.ok(!/\bkat\b/i.test(cleanAddress), 'Kat kalmamalı');
  assert.ok(!/\bdaire\b/i.test(cleanAddress), 'Daire kalmamalı');
  assert.ok(!/0555/.test(cleanAddress), 'Telefon numarası kalmamalı');
  assert.ok(/12/.test(cleanAddress), 'Bina numarası (12) korunmalı');
});

test('eksik ilçe/il/ülke ekini ekler', () => {
  const { cleanAddress } = sanitizeAddress('Çamlık Mah. Bağdat Cad. No:5');
  assert.match(cleanAddress, /Pendik/);
  assert.match(cleanAddress, /İstanbul/);
  assert.match(cleanAddress, /Türkiye/);
});

test('mevcut ilçe/il/ülke ekini tekrarlamaz', () => {
  const input = 'Velibaba Mah. Şehit Sk. No:4, Pendik, İstanbul, Türkiye';
  const { cleanAddress } = sanitizeAddress(input);
  const pendikCount = (cleanAddress.match(/Pendik/g) ?? []).length;
  assert.equal(pendikCount, 1, 'Pendik tek kez geçmeli');
});

test('mahalleyi doğru tespit eder (tam yazım)', () => {
  const { neighborhood } = sanitizeAddress(
    'Batı Mahallesi 23 Nisan Caddesi No:10',
  );
  assert.equal(neighborhood, 'Batı');
});

test('yazım hatalı / ASCII mahalleyi tespit eder (fuzzy)', () => {
  assert.equal(detectNeighborhood('kurtkoy merkez mah'), 'Kurtköy');
  assert.equal(detectNeighborhood('guzelyali sahil'), 'Güzelyalı');
});

test('boş metin için güvenli sonuç döner', () => {
  const result = sanitizeAddress('   ');
  assert.deepEqual(result, { cleanAddress: '', neighborhood: '' });
});

console.log(`\n${passed} test başarıyla geçti.`);
