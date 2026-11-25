export const locale = 'ru-RU';
const numbers = new Intl.NumberFormat(locale);
const plurals = new Intl.PluralRules(locale);

export function quantity(count, one, few, many) {
  const category = plurals.select(count);
  return `${numbers.format(count)} ${category === 'one' ? one : category === 'few' ? few : many}`;
}

export class InterfaceError extends Error {}

export function errorText(error) {
  if (error instanceof InterfaceError) return error.message;
  console.error(error);
  switch (error?.name) {
    case 'QuotaExceededError': return 'В хранилище браузера закончилось место.';
    case 'SecurityError': return 'Браузер заблокировал доступ к этой функции.';
    case 'NotAllowedError': return 'Браузер не разрешил выполнить это действие.';
    case 'NotReadableError': return 'Не удалось прочитать выбранный файл.';
    case 'AbortError': return 'Операция была прервана.';
    default: return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  }
}

export function shortcutKey(event) {
  const key = event.key.toLowerCase();
  if (!/^[а-яё]$/u.test(key)) return key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(-1).toLowerCase();
  return event.code === 'Comma' ? ',' : key;
}
