import assert from 'node:assert/strict';

import { sanitizeText, escapeFormula, validateExcelFile } from '@/lib/security';

// 1) XSS / etiket temizliği.
{
  const cleaned = sanitizeText('<script>alert(1)</script>Ahmet');
  assert.ok(!cleaned.includes('<') && !cleaned.includes('>'), 'açı parantezi kalmamalı');
  assert.ok(cleaned.includes('Ahmet'), 'metin korunmalı');
}

// 2) javascript: şeması nötrlenir.
{
  const cleaned = sanitizeText('javascript:alert(1)');
  assert.ok(!/javascript:/i.test(cleaned), 'javascript: kaldırılmalı');
}

// 3) Formül enjeksiyonu öncelenir.
{
  assert.equal(escapeFormula('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(escapeFormula('+1'), "'+1");
  assert.equal(escapeFormula('Ahmet'), 'Ahmet');
}

// 4) Dosya doğrulama.
function fakeFile(name: string, size: number, type: string): File {
  return { name, size, type } as unknown as File;
}
{
  assert.equal(validateExcelFile(fakeFile('a.exe', 100, '')).ok, false);
  assert.equal(validateExcelFile(fakeFile('a.csv', 100, '')).ok, false);
  assert.equal(
    validateExcelFile(fakeFile('a.xlsx', 6 * 1024 * 1024, '')).ok,
    false,
    '6MB reddedilmeli',
  );
  assert.equal(validateExcelFile(fakeFile('liste.xlsx', 1000, '')).ok, true);
  assert.equal(
    validateExcelFile(fakeFile('liste.xls', 1000, 'application/vnd.ms-excel'))
      .ok,
    true,
  );
}

console.log('✓ security.test.ts — geçti');
