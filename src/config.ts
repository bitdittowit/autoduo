/**
 * Конфигурация AutoDuo
 */
export const CONFIG = {
    /**
     * Задержки (в миллисекундах)
     */
    delays: {
        betweenActions: 300,
        afterSolve: 500,
        waitForElement: 5000,
        pollInterval: 100,
    },

    /**
     * Включить отладочные логи
     */
    debug: false,

    /**
     * Автоматически нажимать CHECK/CONTINUE
     */
    autoSubmit: false,

    /**
     * Версия скрипта
     */
    version: '1.0.0',
} as const;
