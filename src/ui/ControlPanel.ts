/**
 * Панель управления AutoDuo
 */

import { getAutoRunner } from '../core/AutoRunner';
import { getLogPanel } from './LogPanel';
import { CONFIG } from '../config';

export class ControlPanel {
    private container: HTMLDivElement | null = null;
    private statusElement: HTMLSpanElement | null = null;

    /**
     * Показывает панель управления
     */
    show(): void {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'autoduo-control-panel';
        this.container.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid #333;
                border-radius: 8px;
                padding: 12px 16px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13px;
                color: #fff;
                z-index: 99999;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                ">
                    <span style="font-weight: bold; color: #58cc02;">
                        AutoDuo ${CONFIG.version}
                    </span>
                    <span id="autoduo-status" style="
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        background: #333;
                    ">Stopped</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="autoduo-start" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #58cc02;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Start</button>
                    <button id="autoduo-stop" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #dc3545;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Stop</button>
                    <button id="autoduo-solve-one" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #0d6efd;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Solve 1</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.statusElement = document.getElementById('autoduo-status') as HTMLSpanElement;

        this.bindEvents();
    }

    /**
     * Скрывает панель
     */
    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
            this.statusElement = null;
        }
    }

    /**
     * Обновляет статус
     */
    updateStatus(status: string, color = '#333'): void {
        if (this.statusElement) {
            this.statusElement.textContent = status;
            this.statusElement.style.background = color;
        }
    }

    /**
     * Привязывает обработчики событий
     */
    private bindEvents(): void {
        const startBtn = document.getElementById('autoduo-start');
        const stopBtn = document.getElementById('autoduo-stop');
        const solveOneBtn = document.getElementById('autoduo-solve-one');

        startBtn?.addEventListener('click', () => this.handleStart());
        stopBtn?.addEventListener('click', () => this.handleStop());
        solveOneBtn?.addEventListener('click', () => this.handleSolveOne());
    }

    /**
     * Обработчик кнопки Start
     */
    private handleStart(): void {
        const runner = getAutoRunner();
        const logPanel = getLogPanel();

        this.updateStatus('Running', '#28a745');
        logPanel.log('AutoRunner started');

        runner.start().then(() => {
            const status = runner.getStatus();
            this.updateStatus('Stopped', '#333');
            logPanel.log(`Finished. Solved: ${status.solved}, Errors: ${status.errors}`);
        });
    }

    /**
     * Обработчик кнопки Stop
     */
    private handleStop(): void {
        const runner = getAutoRunner();
        const logPanel = getLogPanel();

        runner.stop();
        this.updateStatus('Stopped', '#333');
        logPanel.log('AutoRunner stopped');
    }

    /**
     * Обработчик кнопки Solve One
     */
    private handleSolveOne(): void {
        const logPanel = getLogPanel();

        import('../core/ChallengeDetector').then(({ detectChallenge }) => {
            import('../core/SolverRegistry').then(({ getSolverRegistry }) => {
                const context = detectChallenge();
                if (!context) {
                    logPanel.log('No challenge detected', 'warn');
                    return;
                }

                const registry = getSolverRegistry();
                const result = registry.solve(context);

                if (result?.success) {
                    logPanel.log(`Solved: ${result.type}`, 'info');
                } else {
                    logPanel.log('Failed to solve', 'error');
                }
            });
        });
    }
}

// Singleton
let controlPanelInstance: ControlPanel | null = null;

export function getControlPanel(): ControlPanel {
    if (!controlPanelInstance) {
        controlPanelInstance = new ControlPanel();
    }
    return controlPanelInstance;
}
