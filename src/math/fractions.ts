import type { IFraction, ISimplifiedFraction } from '../types';

/**
 * Вычисляет наибольший общий делитель (НОД) двух чисел
 */
export function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
    }

    return a;
}

/**
 * Вычисляет наименьшее общее кратное (НОК) двух чисел
 */
export function lcm(a: number, b: number): number {
    return Math.abs(a * b) / gcd(a, b);
}

/**
 * Упрощает дробь до несократимого вида
 */
export function simplifyFraction(numerator: number, denominator: number): IFraction {
    if (denominator === 0) {
        throw new Error('Denominator cannot be zero');
    }

    const divisor = gcd(numerator, denominator);
    let simplifiedNum = numerator / divisor;
    let simplifiedDen = denominator / divisor;

    // Обеспечиваем положительный знаменатель
    if (simplifiedDen < 0) {
        simplifiedNum = -simplifiedNum;
        simplifiedDen = -simplifiedDen;
    }

    return {
        numerator: simplifiedNum,
        denominator: simplifiedDen,
    };
}

/**
 * Упрощает дробь и вычисляет её значение
 */
export function simplifyFractionWithValue(numerator: number, denominator: number): ISimplifiedFraction {
    const simplified = simplifyFraction(numerator, denominator);
    return {
        ...simplified,
        value: simplified.numerator / simplified.denominator,
    };
}

/**
 * Сравнивает две дроби
 * @returns -1 если a < b, 0 если a = b, 1 если a > b
 */
export function compareFractions(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): -1 | 0 | 1 {
    // Используем перекрёстное умножение для избежания погрешностей с плавающей точкой
    const left = numA * denB;
    const right = numB * denA;

    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

/**
 * Проверяет, являются ли дроби эквивалентными
 */
export function areFractionsEqual(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): boolean {
    return compareFractions(numA, denA, numB, denB) === 0;
}

/**
 * Складывает две дроби
 */
export function addFractions(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): IFraction {
    const commonDen = lcm(denA, denB);
    const newNumA = numA * (commonDen / denA);
    const newNumB = numB * (commonDen / denB);

    return simplifyFraction(newNumA + newNumB, commonDen);
}

/**
 * Вычитает две дроби (a - b)
 */
export function subtractFractions(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): IFraction {
    return addFractions(numA, denA, -numB, denB);
}

/**
 * Умножает две дроби
 */
export function multiplyFractions(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): IFraction {
    return simplifyFraction(numA * numB, denA * denB);
}

/**
 * Делит две дроби (a / b)
 */
export function divideFractions(
    numA: number,
    denA: number,
    numB: number,
    denB: number,
): IFraction {
    if (numB === 0) {
        throw new Error('Cannot divide by zero');
    }
    return multiplyFractions(numA, denA, denB, numB);
}
