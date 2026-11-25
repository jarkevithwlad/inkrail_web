const graphemes = new Intl.Segmenter();
export const sealShapes = {round:'Круглая', oval:'Овальная', scalloped:'Фигурная'};
export const sealColors = {oxblood:'Бордовый', forest:'Тёмно-зелёный', navy:'Тёмно-синий', plum:'Сливовый'};
export const defaultSeal = Object.freeze({text:'Запечатано', shape:'round', color:'oxblood'});
export const sealTextLimit = 24;

export function hasLetterText(text) {
  return typeof text === 'string' && /\P{White_Space}/u.test(text);
}

export function limitSealText(text) {
  let count = 0;
  for (const {index} of graphemes.segment(text)) {
    if (count++ === sealTextLimit) return text.slice(0, index);
  }
  return text;
}

export function normalizeSeal(value) {
  if (typeof value?.text !== 'string' || !Object.hasOwn(sealShapes, value.shape) || !Object.hasOwn(sealColors, value.color)) return null;
  const text = value.text.replace(/\p{White_Space}+/gu, ' ').replace(/^ | $/g, '');
  if (!text || limitSealText(text) !== text) return null;
  return {text, shape:value.shape, color:value.color};
}

export function drawSeal(seal) {
  const stamp = document.createElement('div');
  stamp.className = 'ink-seal';
  stamp.dataset.shape = seal.shape;
  stamp.dataset.color = seal.color;
  stamp.setAttribute('role', 'img');
  stamp.setAttribute('aria-label', `${sealShapes[seal.shape]} печать, цвет воска: ${sealColors[seal.color].toLocaleLowerCase('ru-RU')}. Надпись: ${seal.text}`);
  const impression = document.createElement('span');
  impression.className = 'ink-seal-impression';
  impression.dir = 'auto';
  impression.textContent = seal.text;
  const count = Array.from(graphemes.segment(seal.text)).length;
  impression.style.fontSize = (count <= 3 ? 26 : count <= 9 ? 16 : count <= 16 ? 13 : 11) + 'px';
  stamp.append(impression);
  return stamp;
}
