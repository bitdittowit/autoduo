/**
 * Результат работы солвера
 */
export interface ISolverResult {
    type: string;
    answer: number | string | null;
    [key: string]: unknown;
}

/**
 * Интерфейс солвера
 */
export interface ISolver {
    readonly name: string;
    canSolve(container: HTMLElement): boolean;
    solve(container: HTMLElement): ISolverResult | null;
}

/**
 * Дробь
 */
export interface IFraction {
    numerator: number;
    denominator: number;
}

/**
 * Упрощённая дробь с вычисленным значением
 */
export interface ISimplifiedFraction extends IFraction {
    value: number;
}

/**
 * Уровни логирования
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Конфигурация логгера
 */
export interface ILoggerConfig {
    level: LogLevel;
    enabled: boolean;
}

/**
 * Результат парсинга KaTeX
 */
export interface IKatexParseResult {
    raw: string;
    cleaned: string;
    value: number | null;
}

/**
 * Результат парсинга блок-диаграммы
 */
export interface IBlockDiagramResult {
    blockCount: number;
    value: number;
}

/**
 * Результат парсинга круговой диаграммы
 */
export interface IPieChartResult {
    numerator: number;
    denominator: number;
    value: number;
}
