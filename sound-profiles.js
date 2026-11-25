export const soundProfiles = [
    ['classic', 'Классика', 'Громкие удары механической Hermes Precisa 305'],
    ['soft', 'Мягкий', 'Приглушённые клавиши Hermes 3000'],
    ['royal', 'Royal', 'Клавиши и каретка Royal Quiet De Luxe'],
    ['vintage', 'Ретро', 'Стук механической машинки 1930-х'],
    ['portable', 'Портативный', 'Клавиши и каретка Hermes Baby'],
    ['electric', 'Электрический', 'Удары электрической IBM Selectric II']
];

const styles = new Set(soundProfiles.map(([id]) => id));
export function canonicalSound(style) {
    if (style === 'office') return 'royal';
    if (style === 'crisp') return 'vintage';
    return styles.has(style) ? style : 'classic';
}
