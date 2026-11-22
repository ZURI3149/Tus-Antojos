/**
 * Caracteres no ASCII de la página de códigos CP858 (CP850 con € en 0xD5) que usa un ticket
 * en español. Lo que no esté aquí se translitera a ASCII (`toAscii`).
 */
// prettier-ignore
export const CP858: Readonly<Record<string, number>> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a,
  ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, É: 0x90, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97,
  Ö: 0x99, Ü: 0x9a, '£': 0x9c, á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ª: 0xa6,
  º: 0xa7, '¿': 0xa8, '¡': 0xad, '«': 0xae, '»': 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, Ê: 0xd2,
  È: 0xd4, '€': 0xd5, Í: 0xd6, Ó: 0xe0, Ò: 0xe3, Ú: 0xe9, Û: 0xea, Ù: 0xeb, '°': 0xf8, '·': 0xfa,
};

// prettier-ignore
const ASCII_FALLBACK: Readonly<Record<string, string>> = {
  '¿': '?', '¡': '!', '€': 'EUR', '£': 'GBP', ª: 'a', º: 'o', '°': 'o', '«': '"', '»': '"',
  '·': '-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...',
};

/** Versión ASCII de un carácter (sin tildes); `?` si no tiene equivalente. */
export function toAscii(char: string): string {
  if (char.charCodeAt(0) < 0x80 && char.length === 1) return char;
  const special = ASCII_FALLBACK[char];
  if (special) return special;
  const stripped = char.normalize('NFD').replace(/\p{M}/gu, '');
  return /^[\x20-\x7e]+$/.test(stripped) ? stripped : '?';
}
