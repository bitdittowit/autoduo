/**
 * Округляет число до ближайшего значения с заданной базой
 * @param value - число для округления
 * @param base - база округления (10, 100, 1000 и т.д.)
 * @returns округлённое значение
 *
 * @example
 * roundToNearest(41, 10) // 40
 * roundToNearest(18, 10) // 20
 * roundToNearest(250, 100) // 300
 */
export function roundToNearest(value: number, base: number): number {
    if (base <= 0) {
        throw new Error('Base must be positive');
    }
    return Math.round(value / base) * base;
}

/**
 * Округляет число вниз до ближайшего значения с заданной базой
 * @param value - число для округления
 * @param base - база округления
 * @returns округлённое значение
 *
 * @example
 * floorToNearest(45, 10) // 40
 * floorToNearest(99, 100) // 0
 */
export function floorToNearest(value: number, base: number): number {
    if (base <= 0) {
        throw new Error('Base must be positive');
    }
    return Math.floor(value / base) * base;
}

/**
 * Округляет число вверх до ближайшего значения с заданной базой
 * @param value - число для округления
 * @param base - база округления
 * @returns округлённое значение
 *
 * @example
 * ceilToNearest(41, 10) // 50
 * ceilToNearest(101, 100) // 200
 */
export function ceilToNearest(value: number, base: number): number {
    if (base <= 0) {
        throw new Error('Base must be positive');
    }
    return Math.ceil(value / base) * base;
}

/**
 * Определяет базу округления из текста
 * @param text - текст содержащий "nearest 10", "nearest 100" и т.д.
 * @returns база округления или null
 */
export function extractRoundingBase(text: string): number | null {
    const match = text.toLowerCase().match(/nearest\s*(\d+)/);
    if (match?.[1]) {
        const base = parseInt(match[1], 10);
        return Number.isNaN(base) ? null : base;
    }
    return null;
}
