/**
 * Базовый результат работы солвера
 */
export interface ISolverResult {
    type: string;
    success: boolean;
    answer?: number | string;
    equation?: string;
    selectedChoice?: number;
    error?: string;
}

/**
 * Результат солвера округления
 */
export interface IRoundingResult extends ISolverResult {
    type: 'roundToNearest';
    numberToRound: number;
    roundingBase: number;
    roundedValue: number;
}

/**
 * Результат солвера уравнений
 */
export interface IEquationResult extends ISolverResult {
    type: 'typeAnswer' | 'equationBlank' | 'solveForX';
    equation: string;
    answer: number | string;
}

/**
 * Результат солвера дробей
 */
export interface IFractionResult extends ISolverResult {
    type: 'simplifyFraction' | 'compareFractions' | 'selectFraction';
    original?: ISimplifiedFraction;
    simplified?: IFraction;
}

/**
 * Контекст задания - все необходимые DOM элементы
 */
export interface IChallengeContext {
    container: Element;
    header?: Element | null;
    headerText?: string;
    equationContainer?: Element | null;
    choices?: Element[];
    textInput?: HTMLInputElement | null;
    iframe?: HTMLIFrameElement | null;
}

/**
 * Интерфейс солвера
 */
export interface ISolver {
    /** Уникальное имя солвера */
    readonly name: string;

    /** Проверяет, может ли солвер решить данное задание */
    canSolve(context: IChallengeContext): boolean;

    /** Решает задание */
    solve(context: IChallengeContext): ISolverResult | null;
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
