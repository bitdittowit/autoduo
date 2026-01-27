import type { LogLevel } from '../types';
import { CONFIG } from '../config';

/**
 * Интерфейс для панели логов
 */
interface ILogPanel {
    log: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
}

let logPanel: ILogPanel | null = null;

/**
 * Устанавливает панель логов для вывода сообщений
 */
export function setLogPanel(panel: ILogPanel): void {
    logPanel = panel;
}

/**
 * Выводит сообщение в лог
 */
function log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level === 'debug' && !CONFIG.debug) {
        return;
    }

    const formattedArgs = args.length > 0
        ? ' ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
        ).join(' ')
        : '';

    const fullMessage = `${message}${formattedArgs}`;

    if (logPanel) {
        logPanel.log(fullMessage, level);
    }

    // Дублируем в консоль для отладки
    // (на Duolingo console.log может быть заблокирован)
    // try {
    //     const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    //     console[consoleMethod](`[AutoDuo] ${fullMessage}`);
    // } catch {
    //     // Игнорируем ошибки консоли
    // }
}

/**
 * Логгер с методами для разных уровней
 */
export const logger = {
    debug: (message: string, ...args: unknown[]): void => log('debug', message, ...args),
    info: (message: string, ...args: unknown[]): void => log('info', message, ...args),
    warn: (message: string, ...args: unknown[]): void => log('warn', message, ...args),
    error: (message: string, ...args: unknown[]): void => log('error', message, ...args),
    setLogPanel,
};

/**
 * Алиасы для совместимости с существующим кодом
 */
export const LOG = logger.info;
export const LOG_DEBUG = logger.debug;
export const LOG_WARN = logger.warn;
export const LOG_ERROR = logger.error;
