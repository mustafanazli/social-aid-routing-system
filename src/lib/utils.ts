import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Koşullu Tailwind sınıflarını birleştirir ve çakışmaları çözer. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Basit benzersiz ID üretici (adres/oturum kimlikleri için). */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Türkçe metni karşılaştırma için normalize eder:
 * küçük harfe indirir, Türkçe karakterleri ASCII'ye çevirir,
 * diakritikleri ve fazla boşlukları temizler.
 */
export function normalizeTr(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
