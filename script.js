// ==UserScript==
// @name         Duolingo-Cheat-Tool
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Auto answer Duolingo script!
// @author       Tran Quy <tranphuquy19@gmail.com>
// @match        https://www.duolingo.com/skill*
// @match        https://www.duolingo.com/lesson*
// @icon         https://www.google.com/s2/favicons?domain=duolingo.com
// @grant        none
// ==/UserScript==
 
const DEBUG = true;
let mainInterval;
 
const dataTestComponentClassName = 'e4VJZ';
 
const TIME_OUT = 100; // Interval for auto mode (ms)

// ==================== WAITING CONFIGURATION ====================
// These settings control how long the script waits for elements to load
const WAIT_CONFIG = {
    ELEMENT_TIMEOUT: 5000,      // Max time to wait for a single element (ms)
    IFRAME_TIMEOUT: 3000,       // Max time to wait for iframe content (ms)
    CHALLENGE_TIMEOUT: 3000,    // Max time to wait for challenge container (ms)
    POLL_INTERVAL: 100,         // How often to check for elements (ms)
    RETRY_ATTEMPTS: 3,          // Number of retry attempts for failed operations
    RETRY_DELAY: 500,           // Delay between retries (ms)
    EXTRA_DELAY_AFTER_LOAD: 150 // Extra delay after elements load (for animations/rendering)
};

// ==================== CUSTOM LOGGER ====================
// Console methods don't work on Duolingo, so we use a floating log panel
const LogPanel = {
    panel: null,
    logs: [],
    maxLogs: 50,
    isRunning: false,
    
    init() {
        if (this.panel) return;
        
        this.panel = document.createElement('div');
        this.panel.id = 'autoduo-log-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            padding: 10px;
            border-radius: 8px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid #333;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        `;
        header.innerHTML = `
            <span style="color: #fff; font-weight: bold;">AutoDuo</span>
            <div style="display: flex; gap: 4px;">
                <button id="autoduo-solve" style="background: #4488ff; color: #fff; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; font-weight: bold;">Solve</button>
                <button id="autoduo-auto" style="background: #44aa44; color: #fff; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; font-weight: bold;">Auto: OFF</button>
                <button id="autoduo-clear" style="background: #333; color: #fff; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px;">Clear</button>
                <button id="autoduo-minimize" style="background: #333; color: #fff; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px;">_</button>
            </div>
        `;
        
        this.logContainer = document.createElement('div');
        this.logContainer.id = 'autoduo-log-container';
        this.logContainer.style.cssText = `
            max-height: 250px;
            overflow-y: auto;
            scroll-behavior: smooth;
        `;
        
        this.panel.appendChild(header);
        this.panel.appendChild(this.logContainer);
        document.body.appendChild(this.panel);
        
        document.getElementById('autoduo-solve').onclick = () => solveOne();
        document.getElementById('autoduo-auto').onclick = () => this.toggleRunning();
        document.getElementById('autoduo-clear').onclick = () => this.clear();
        document.getElementById('autoduo-minimize').onclick = () => this.toggleMinimize();
    },
    
    updateButtonStates() {
        const autoBtn = document.getElementById('autoduo-auto');
        if (autoBtn) {
            if (this.isRunning) {
                autoBtn.textContent = 'Auto: ON';
                autoBtn.style.background = '#cc4444';
            } else {
                autoBtn.textContent = 'Auto: OFF';
                autoBtn.style.background = '#44aa44';
            }
        }
    },
    
    toggleRunning() {
        if (this.isRunning) {
            clearInterval(mainInterval);
            this.isRunning = false;
            this.warn('=== Auto Mode STOPPED ===');
        } else {
            mainInterval = setInterval(main, TIME_OUT);
            this.isRunning = true;
            this.info('=== Auto Mode STARTED ===');
        }
        this.updateButtonStates();
    },
    
    toggleMinimize() {
        if (this.logContainer.style.display === 'none') {
            this.logContainer.style.display = 'block';
        } else {
            this.logContainer.style.display = 'none';
        }
    },
    
    clear() {
        this.logs = [];
        this.logContainer.innerHTML = '';
    },
    
    scrollToBottom() {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        });
    },
    
    log(level, ...args) {
        this.init();
        
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const colors = {
            info: '#00ff00',
            warn: '#ffff00',
            error: '#ff4444',
            debug: '#00aaff'
        };
        
        const entry = document.createElement('div');
        entry.style.cssText = `
            padding: 4px 0;
            border-bottom: 1px solid #222;
            word-wrap: break-word;
            color: ${colors[level] || colors.info};
        `;
        entry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${this.escapeHtml(message)}`;
        
        this.logContainer.appendChild(entry);
        this.logs.push({ timestamp, level, message });
        
        // Keep only last N logs
        while (this.logs.length > this.maxLogs) {
            this.logs.shift();
            if (this.logContainer.firstChild) {
                this.logContainer.removeChild(this.logContainer.firstChild);
            }
        }
        
        // Auto-scroll to bottom
        this.scrollToBottom();
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    info(...args) { this.log('info', ...args); },
    warn(...args) { this.log('warn', ...args); },
    error(...args) { this.log('error', ...args); },
    debug(...args) { this.log('debug', ...args); }
};

// Global logger function
function LOG(...args) {
    if (DEBUG) LogPanel.info(...args);
}
function LOG_WARN(...args) {
    LogPanel.warn(...args);
}
function LOG_ERROR(...args) {
    LogPanel.error(...args);
}
function LOG_DEBUG(...args) {
    if (DEBUG) LogPanel.debug(...args);
}

// ==================== ELEMENT WAITING UTILITIES ====================
// These utilities help wait for elements to load, making the script more stable

/**
 * Wait for a single element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum wait time in ms (default: WAIT_CONFIG.ELEMENT_TIMEOUT)
 * @param {number} interval - Polling interval in ms (default: WAIT_CONFIG.POLL_INTERVAL)
 * @param {Element} parent - Parent element to search within (default: document)
 * @returns {Promise<Element|null>} - The element or null if timeout
 */
function waitForElement(selector, timeout = WAIT_CONFIG.ELEMENT_TIMEOUT, interval = WAIT_CONFIG.POLL_INTERVAL, parent = document) {
    return new Promise((resolve) => {
        // Check if already exists
        const existing = parent.querySelector(selector);
        if (existing) {
            resolve(existing);
            return;
        }
        
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const element = parent.querySelector(selector);
            if (element) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElement: found "${selector}" after ${Date.now() - startTime}ms`);
                resolve(element);
            } else if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElement: timeout for "${selector}" after ${timeout}ms`);
                resolve(null);
            }
        }, interval);
    });
}

/**
 * Wait for multiple elements to appear (at least one matching the selector)
 * @param {string} selector - CSS selector
 * @param {number} minCount - Minimum number of elements required (default: 1)
 * @param {number} timeout - Maximum wait time in ms (default: WAIT_CONFIG.ELEMENT_TIMEOUT)
 * @param {number} interval - Polling interval in ms (default: WAIT_CONFIG.POLL_INTERVAL)
 * @param {Element} parent - Parent element to search within (default: document)
 * @returns {Promise<NodeList|null>} - The elements or null if timeout
 */
function waitForElements(selector, minCount = 1, timeout = WAIT_CONFIG.ELEMENT_TIMEOUT, interval = WAIT_CONFIG.POLL_INTERVAL, parent = document) {
    return new Promise((resolve) => {
        // Check if already exists
        const existing = parent.querySelectorAll(selector);
        if (existing.length >= minCount) {
            resolve(existing);
            return;
        }
        
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const elements = parent.querySelectorAll(selector);
            if (elements.length >= minCount) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElements: found ${elements.length} "${selector}" after ${Date.now() - startTime}ms`);
                resolve(elements);
            } else if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElements: timeout for "${selector}" (found ${elements.length}/${minCount}) after ${timeout}ms`);
                resolve(elements.length > 0 ? elements : null);
            }
        }, interval);
    });
}

/**
 * Wait for any of the given selectors to appear
 * @param {string[]} selectors - Array of CSS selectors
 * @param {number} timeout - Maximum wait time in ms (default: WAIT_CONFIG.ELEMENT_TIMEOUT)
 * @param {number} interval - Polling interval in ms (default: WAIT_CONFIG.POLL_INTERVAL)
 * @returns {Promise<{element: Element, selector: string}|null>} - The first found element and its selector
 */
function waitForAnyElement(selectors, timeout = WAIT_CONFIG.ELEMENT_TIMEOUT, interval = WAIT_CONFIG.POLL_INTERVAL) {
    return new Promise((resolve) => {
        // Check if any already exists
        for (const selector of selectors) {
            const existing = document.querySelector(selector);
            if (existing) {
                resolve({ element: existing, selector });
                return;
            }
        }
        
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkInterval);
                    LOG_DEBUG(`waitForAnyElement: found "${selector}" after ${Date.now() - startTime}ms`);
                    resolve({ element, selector });
                    return;
                }
            }
            
            if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForAnyElement: timeout after ${timeout}ms`);
                resolve(null);
            }
        }, interval);
    });
}

/**
 * Wait for element content to be non-empty or match a condition
 * @param {string} selector - CSS selector
 * @param {function} condition - Function that takes element and returns boolean
 * @param {number} timeout - Maximum wait time in ms (default: WAIT_CONFIG.ELEMENT_TIMEOUT)
 * @param {number} interval - Polling interval in ms (default: WAIT_CONFIG.POLL_INTERVAL)
 * @returns {Promise<Element|null>} - The element or null if timeout
 */
function waitForElementWithCondition(selector, condition, timeout = WAIT_CONFIG.ELEMENT_TIMEOUT, interval = WAIT_CONFIG.POLL_INTERVAL) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element && condition(element)) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElementWithCondition: condition met for "${selector}" after ${Date.now() - startTime}ms`);
                resolve(element);
            } else if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForElementWithCondition: timeout for "${selector}" after ${timeout}ms`);
                resolve(null);
            }
        }, interval);
    });
}

/**
 * Wait for iframe content to be loaded and accessible
 * @param {HTMLIFrameElement} iframe - The iframe element
 * @param {number} timeout - Maximum wait time in ms (default: WAIT_CONFIG.IFRAME_TIMEOUT)
 * @param {number} interval - Polling interval in ms (default: WAIT_CONFIG.POLL_INTERVAL)
 * @returns {Promise<boolean>} - True if loaded, false if timeout
 */
function waitForIframeContent(iframe, timeout = WAIT_CONFIG.IFRAME_TIMEOUT, interval = WAIT_CONFIG.POLL_INTERVAL) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        // Check if already loaded
        try {
            if (iframe.contentWindow && iframe.contentDocument && iframe.contentDocument.body) {
                resolve(true);
                return;
            }
        } catch (e) {
            // Cross-origin or not loaded yet
        }
        
        const checkInterval = setInterval(() => {
            try {
                if (iframe.contentWindow && iframe.contentDocument && iframe.contentDocument.body) {
                    clearInterval(checkInterval);
                    LOG_DEBUG(`waitForIframeContent: iframe loaded after ${Date.now() - startTime}ms`);
                    resolve(true);
                    return;
                }
            } catch (e) {
                // Still loading
            }
            
            if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                LOG_DEBUG(`waitForIframeContent: timeout after ${timeout}ms`);
                resolve(false);
            }
        }, interval);
    });
}

/**
 * Retry a function until it succeeds or reaches max attempts
 * @param {function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum number of attempts (default: WAIT_CONFIG.RETRY_ATTEMPTS)
 * @param {number} delayMs - Delay between attempts in ms (default: WAIT_CONFIG.RETRY_DELAY)
 * @returns {Promise<any>} - Result of the function or null
 */
async function retryAsync(fn, maxAttempts = WAIT_CONFIG.RETRY_ATTEMPTS, delayMs = WAIT_CONFIG.RETRY_DELAY) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await fn();
            if (result !== null && result !== undefined) {
                return result;
            }
        } catch (e) {
            LOG_DEBUG(`retryAsync: attempt ${attempt} failed:`, e.message);
        }
        
        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return null;
}

/**
 * Small delay helper
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== CHALLENGE TYPES ====================
const CHARACTER_SELECT_TYPE = 'characterSelect';
const CHARACTER_MATCH_TYPE = 'characterMatch'; // not yet
const TRANSLATE_TYPE = 'translate';
const LISTEN_TAP_TYPE = 'listenTap';
const NAME_TYPE = 'name';
const COMPLETE_REVERSE_TRANSLATION_TYPE = 'completeReverseTranslation';
const LISTEN_TYPE = 'listen';
const SELECT_TYPE = 'select';
const JUDGE_TYPE = 'judge';
const FORM_TYPE = 'form';
const LISTEN_COMPREHENSION_TYPE = 'listenComprehension';
const READ_COMPREHENSION_TYPE = 'readComprehension';
const CHARACTER_INTRO_TYPE = 'characterIntro';
const DIALOGUE_TYPE = 'dialogue';
const SELECT_TRANSCRIPTION_TYPE = 'selectTranscription';
const SPEAK_TYPE = 'speak';
const SELECT_PRONUNCIATION_TYPE = 'selectPronunciation';
const MATH_CHALLENGE_BLOB_TYPE = 'mathChallengeBlob';
 
// Query DOM keys
const CHALLENGE_CHOICE_CARD = '[data-test="challenge-choice-card"]';
const CHALLENGE_CHOICE = '[data-test="challenge-choice"]';
const CHALLENGE_TRANSLATE_INPUT = '[data-test="challenge-translate-input"]';
const CHALLENGE_LISTEN_TAP = '[data-test="challenge-listenTap"]';
const CHALLENGE_JUDGE_TEXT = '[data-test="challenge-judge-text"]';
const CHALLENGE_TEXT_INPUT = '[data-test="challenge-text-input"]';
const CHALLENGE_TAP_TOKEN = '[data-test="challenge-tap-token"]';
const PLAYER_NEXT = '[data-test="player-next"]';
const PLAYER_SKIP = '[data-test="player-skip"]';
const BLAME_INCORRECT = '[data-test="blame blame-incorrect"]';
const CHARACTER_MATCH = '[data-test="challenge challenge-characterMatch"]';
const MATH_CHALLENGE_BLOB = '[data-test="challenge challenge-mathChallengeBlob"]';

// ==================== MATH CHALLENGE HELPERS ====================

/**
 * Extract clean value from KaTeX element
 * KaTeX wraps math in spans with class "katex", the actual content is in annotation tag
 * or we can extract from the text content of katex-html
 */
/**
 * Helper function to extract content from LaTeX command with nested braces
 * e.g., \mathbf{\frac{5}{6}} -> \frac{5}{6}
 */
function extractLatexContent(str, command) {
    const cmdIndex = str.indexOf(command);
    if (cmdIndex === -1) return str;
    
    const startBrace = str.indexOf('{', cmdIndex + command.length);
    if (startBrace === -1) return str;
    
    let depth = 1;
    let endBrace = startBrace + 1;
    while (depth > 0 && endBrace < str.length) {
        if (str[endBrace] === '{') depth++;
        else if (str[endBrace] === '}') depth--;
        endBrace++;
    }
    
    const content = str.substring(startBrace + 1, endBrace - 1);
    return str.substring(0, cmdIndex) + content + str.substring(endBrace);
}

function extractKatexValue(element) {
    if (!element) {
        LOG_DEBUG('extractKatexValue: element is null');
        return null;
    }
    
    LOG_DEBUG('extractKatexValue: processing element', element.outerHTML?.substring(0, 200));
    
    // Method 1: Try to get from annotation tag (contains raw LaTeX)
    const annotation = element.querySelector('annotation');
    if (annotation) {
        let raw = annotation.textContent;
        LOG_DEBUG('extractKatexValue: found annotation', raw);
        
        // Clean LaTeX markup with nested braces support
        // Handle \mathbf{...}, \textbf{...}, \text{...}, \mbox{...} with nested content
        while (raw.includes('\\mathbf{')) {
            raw = extractLatexContent(raw, '\\mathbf');
        }
        while (raw.includes('\\textbf{')) {
            raw = extractLatexContent(raw, '\\textbf');
        }
        while (raw.includes('\\text{')) {
            raw = extractLatexContent(raw, '\\text');
        }
        while (raw.includes('\\mbox{')) {
            raw = extractLatexContent(raw, '\\mbox');
        }
        
        // Convert LaTeX math operators to standard operators
        raw = raw.replace(/\\cdot/g, '*');      // \cdot -> * (multiplication)
        raw = raw.replace(/\\times/g, '*');     // \times -> * (multiplication)
        raw = raw.replace(/\\div/g, '/');       // \div -> / (division)
        raw = raw.replace(/\\pm/g, '±');        // \pm -> ± (plus-minus)
        
        // Handle \frac{a}{b} -> (a/b) with nested braces support
        while (raw.includes('\\frac{')) {
            const fracMatch = raw.match(/\\frac\{/);
            if (!fracMatch) break;
            
            const fracStart = fracMatch.index;
            // Find the numerator
            let numStart = fracStart + 6; // after \frac{
            let depth = 1;
            let numEnd = numStart;
            while (depth > 0 && numEnd < raw.length) {
                if (raw[numEnd] === '{') depth++;
                else if (raw[numEnd] === '}') depth--;
                numEnd++;
            }
            const numerator = raw.substring(numStart, numEnd - 1);
            
            // Find the denominator
            let denomStart = numEnd + 1; // after }{
            depth = 1;
            let denomEnd = denomStart;
            while (depth > 0 && denomEnd < raw.length) {
                if (raw[denomEnd] === '{') depth++;
                else if (raw[denomEnd] === '}') depth--;
                denomEnd++;
            }
            const denominator = raw.substring(denomStart, denomEnd - 1);
            
            raw = raw.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + raw.substring(denomEnd);
        }
        
        raw = raw.replace(/\s+/g, ''); // Remove whitespace
        
        LOG_DEBUG('extractKatexValue: cleaned annotation value', raw);
        return raw;
    }
    
    // Method 2: Get from katex-html (visible part)
    const katexHtml = element.querySelector('.katex-html');
    if (katexHtml) {
        let text = katexHtml.textContent.trim();
        LOG_DEBUG('extractKatexValue: found katex-html text', text);
        return text;
    }
    
    // Method 3: Just get text content
    let text = element.textContent.trim();
    LOG_DEBUG('extractKatexValue: fallback to textContent', text);
    return text;
}

/**
 * Parse and evaluate a math expression safely
 * Supports: +, -, *, /, parentheses, numbers
 */
function evaluateMathExpression(expr) {
    if (!expr) {
        LOG_DEBUG('evaluateMathExpression: expression is null/empty');
        return null;
    }
    
    LOG_DEBUG('evaluateMathExpression: input', expr);
    
    // Clean the expression
    let cleaned = expr.toString()
        .replace(/\s+/g, '')        // Remove whitespace
        .replace(/\\cdot/g, '*')    // Replace LaTeX multiplication (\cdot)
        .replace(/\\times/g, '*')   // Replace LaTeX multiplication (\times)
        .replace(/\\div/g, '/')     // Replace LaTeX division (\div)
        .replace(/×/g, '*')         // Replace multiplication sign (unicode)
        .replace(/÷/g, '/')         // Replace division sign (unicode)
        .replace(/−/g, '-')         // Replace minus sign (unicode)
        .replace(/⋅/g, '*')         // Replace middle dot (unicode cdot)
        .replace(/[^\d+\-*/().]/g, ''); // Keep only valid math chars
    
    LOG_DEBUG('evaluateMathExpression: cleaned', cleaned);
    
    // Validate - only allow safe characters
    if (!/^[\d+\-*/().]+$/.test(cleaned)) {
        LOG_WARN('evaluateMathExpression: invalid expression after cleaning', cleaned);
        return null;
    }
    
    try {
        // Using Function constructor for safer eval
        const result = new Function('return ' + cleaned)();
        LOG_DEBUG('evaluateMathExpression: result', result);
        return result;
    } catch (e) {
        LOG_ERROR('evaluateMathExpression: eval error', e.message);
        return null;
    }
}

/**
 * Solve equation with blank (e.g., "_ + 4 = 7")
 * Returns the value that should replace the blank
 */
function solveEquationWithBlank(equation) {
    LOG_DEBUG('solveEquationWithBlank: input', equation);
    
    // Clean the equation
    let cleaned = equation
        .replace(/\\duoblank\{[^}]*\}/g, 'X')  // Replace \duoblank{...} with X
        .replace(/\s+/g, '')                    // Remove whitespace
        .replace(/×/g, '*')                     // Replace multiplication sign
        .replace(/÷/g, '/')                     // Replace division sign
        .replace(/−/g, '-');                    // Replace minus sign
    
    // Handle \mathbf{} with nested braces using extractLatexContent
    while (cleaned.includes('\\mathbf{')) {
        cleaned = extractLatexContent(cleaned, '\\mathbf');
    }
    while (cleaned.includes('\\textbf{')) {
        cleaned = extractLatexContent(cleaned, '\\textbf');
    }
    
    // Handle \frac{a}{b} -> (a/b) with nested braces support
    while (cleaned.includes('\\frac{')) {
        const fracMatch = cleaned.match(/\\frac\{/);
        if (!fracMatch) break;
        
        const fracStart = fracMatch.index;
        // Find the numerator
        let numStart = fracStart + 6; // after \frac{
        let depth = 1;
        let numEnd = numStart;
        while (depth > 0 && numEnd < cleaned.length) {
            if (cleaned[numEnd] === '{') depth++;
            else if (cleaned[numEnd] === '}') depth--;
            numEnd++;
        }
        const numerator = cleaned.substring(numStart, numEnd - 1);
        
        // Find the denominator
        let denomStart = numEnd + 1; // after }{
        depth = 1;
        let denomEnd = denomStart;
        while (depth > 0 && denomEnd < cleaned.length) {
            if (cleaned[denomEnd] === '{') depth++;
            else if (cleaned[denomEnd] === '}') depth--;
            denomEnd++;
        }
        const denominator = cleaned.substring(denomStart, denomEnd - 1);
        
        cleaned = cleaned.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + cleaned.substring(denomEnd);
    }
    
    LOG_DEBUG('solveEquationWithBlank: cleaned', cleaned);
    
    // Parse equation: left = right
    const parts = cleaned.split('=');
    if (parts.length !== 2) {
        LOG_ERROR('solveEquationWithBlank: invalid equation format');
        return null;
    }
    
    const left = parts[0];
    const right = parts[1];
    
    LOG_DEBUG('solveEquationWithBlank: left =', left, ', right =', right);
    
    // Check which side has X
    const xOnLeft = left.includes('X');
    const xOnRight = right.includes('X');
    
    if (!xOnLeft && !xOnRight) {
        LOG_ERROR('solveEquationWithBlank: no X found in equation');
        return null;
    }
    
    // Optimization: If X is alone on one side, directly evaluate the other side
    // This handles cases like "275+50=X" -> X = 325, or "X=10+5" -> X = 15
    if (right === 'X' && !xOnLeft) {
        // Case: expression = X
        const result = evaluateMathExpression(left);
        if (result !== null) {
            LOG_DEBUG('solveEquationWithBlank: X is alone on right, left evaluates to', result);
            return result;
        }
    }
    
    if (left === 'X' && !xOnRight) {
        // Case: X = expression
        const result = evaluateMathExpression(right);
        if (result !== null) {
            LOG_DEBUG('solveEquationWithBlank: X is alone on left, right evaluates to', result);
            return result;
        }
    }
    
    // Try to solve by substitution - test each possible answer
    // This is simpler than algebraic solving and works for basic equations
    // Extended range to handle larger numbers (e.g., 0 to 1000)
    for (let x = -10000; x <= 10000; x++) {
        const leftVal = evaluateMathExpression(left.replace(/X/g, `(${x})`));
        const rightVal = evaluateMathExpression(right.replace(/X/g, `(${x})`));
        
        if (leftVal !== null && rightVal !== null && Math.abs(leftVal - rightVal) < 0.0001) {
            LOG_DEBUG('solveEquationWithBlank: found X =', x);
            return x;
        }
    }
    
    LOG_ERROR('solveEquationWithBlank: could not solve for X');
    return null;
}

/**
 * Solve "Follow the pattern" math challenge
 * The page shows a table with expressions and results, last row has "?" as result
 */
/**
 * Async version of solveMathChallengeBlob with element waiting
 */
async function solveMathChallengeBlobAsync() {
    LOG('=== Starting solveMathChallengeBlobAsync ===');
    
    // Wait for the challenge container
    const challengeContainer = await waitForElement(MATH_CHALLENGE_BLOB, WAIT_CONFIG.CHALLENGE_TIMEOUT);
    if (!challengeContainer) {
        LOG_ERROR('solveMathChallengeBlobAsync: challenge container not found');
        return null;
    }
    LOG('solveMathChallengeBlobAsync: found challenge container');
    
    // Wait a bit for dynamic content to load
    await delay(WAIT_CONFIG.EXTRA_DELAY_AFTER_LOAD);
    
    // Try to find iframe and wait for it to be ready
    let mathWebIframe = challengeContainer.querySelector('iframe[title="Math Web Element"]');
    if (mathWebIframe) {
        // Wait for srcdoc to be fully populated
        const iframeReady = await waitForElementWithCondition(
            'iframe[title="Math Web Element"]',
            (el) => {
                const srcdoc = el.getAttribute('srcdoc');
                return srcdoc && srcdoc.length > 100;
            },
            WAIT_CONFIG.IFRAME_TIMEOUT
        );
        
        if (iframeReady) {
            // Wait for iframe content to be accessible
            await waitForIframeContent(mathWebIframe, WAIT_CONFIG.IFRAME_TIMEOUT);
            LOG_DEBUG('solveMathChallengeBlobAsync: iframe is ready');
        }
    }
    
    // Wait for equation container (KaTeX rendering can be slow)
    let equationContainer = challengeContainer.querySelector('._1KXkZ');
    if (!equationContainer) {
        // Try waiting for it
        equationContainer = await waitForElement('._1KXkZ', WAIT_CONFIG.ELEMENT_TIMEOUT / 3, WAIT_CONFIG.POLL_INTERVAL / 2, challengeContainer);
    }
    
    // Wait for choices to appear
    let choices = challengeContainer.querySelectorAll(CHALLENGE_CHOICE);
    if (choices.length === 0) {
        const choiceElements = await waitForElements(CHALLENGE_CHOICE, 1, WAIT_CONFIG.ELEMENT_TIMEOUT / 3, WAIT_CONFIG.POLL_INTERVAL / 2, challengeContainer);
        if (choiceElements) {
            choices = choiceElements;
        }
    }
    
    // Delegate to synchronous function now that elements are loaded
    return solveMathChallengeBlob();
}

function solveMathChallengeBlob() {
    LOG('=== Starting solveMathChallengeBlob ===');
    
    // Find the challenge container
    const challengeContainer = document.querySelector(MATH_CHALLENGE_BLOB);
    if (!challengeContainer) {
        LOG_ERROR('solveMathChallengeBlob: challenge container not found');
        return null;
    }
    LOG('solveMathChallengeBlob: found challenge container');
    
    // Check which type of challenge this is
    // IMPORTANT: Check for iframe FIRST - if there's a slider, that's the primary input method
    const mathWebIframe = challengeContainer.querySelector('iframe[title="Math Web Element"]');
    const patternTable = challengeContainer.querySelector('._1qjbi');
    const equationContainer = challengeContainer.querySelector('._1KXkZ');
    const choices = challengeContainer.querySelectorAll(CHALLENGE_CHOICE);
    const textInput = challengeContainer.querySelector(CHALLENGE_TEXT_INPUT);
    const tapTokens = challengeContainer.querySelectorAll('[data-test="-challenge-tap-token"]');
    
    // NEW: Look for Spinner iframe which may NOT have title="Math Web Element"
    // Spinner iframes have sandbox="allow-scripts allow-same-origin" and srcdoc containing "new Spinner("
    // IMPORTANT: We must be specific - look for "new Spinner(" not just "Spinner" 
    // because NumberLine minified code may also contain "Spinner" word
    let spinnerIframe = null;
    let numberLineIframe = null;
    const allIframes = challengeContainer.querySelectorAll('iframe[sandbox][srcdoc]');
    for (const iframe of allIframes) {
        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) continue;
        
        // Check for NumberLine first - it's more specific
        // NumberLine iframes contain "new NumberLine(" in the initialization
        if (srcdoc.includes('new NumberLine(') || srcdoc.includes('NumberLine({')) {
            numberLineIframe = iframe;
            LOG_DEBUG('solveMathChallengeBlob: found NumberLine iframe');
        }
        
        // Check for Spinner - must be a specific Spinner initialization
        // Look for "new Spinner(" which is the constructor call
        if (srcdoc.includes('new Spinner(') || srcdoc.includes('Spinner({')) {
            spinnerIframe = iframe;
            LOG_DEBUG('solveMathChallengeBlob: found separate Spinner iframe');
        }
    }
    
    LOG_DEBUG('solveMathChallengeBlob: iframe =', !!mathWebIframe, ', spinnerIframe =', !!spinnerIframe,
              ', numberLineIframe =', !!numberLineIframe, ', patternTable =', !!patternTable, 
              ', equationContainer =', !!equationContainer, ', choices =', choices.length, 
              ', textInput =', !!textInput, ', tapTokens =', tapTokens.length);
    
    // Check if this is "Match the pairs" with pie charts (iframes inside tap tokens)
    // This needs to be checked BEFORE the general iframe check
    if (tapTokens.length > 0) {
        // Check if any tap token contains an iframe with SVG (pie chart)
        let hasPieChartTokens = false;
        for (const token of tapTokens) {
            const tokenIframe = token.querySelector('iframe[title="Math Web Element"]');
            if (tokenIframe) {
                const srcdoc = tokenIframe.getAttribute('srcdoc');
                if (srcdoc && srcdoc.includes('<svg')) {
                    hasPieChartTokens = true;
                    break;
                }
            }
        }
        
        if (hasPieChartTokens) {
            LOG('solveMathChallengeBlob: detected MATCH THE PAIRS type (pie charts in tap tokens)');
            return solveMathMatchPairs(challengeContainer, tapTokens);
        }
    }
    
    // NEW: Check for NumberLine iframe first (before Spinner and other iframe checks)
    // NumberLine is for "Show this another way" challenges with slider
    if (numberLineIframe) {
        LOG('solveMathChallengeBlob: detected NUMBER LINE SLIDER type (NumberLine iframe found)');
        return solveMathInteractiveSlider(challengeContainer, numberLineIframe);
    }
    
    // NEW: Check for Spinner iframe (before other iframe checks)
    // Spinner iframe may not have title="Math Web Element" attribute
    if (spinnerIframe) {
        LOG('solveMathChallengeBlob: detected INTERACTIVE SPINNER type (Spinner iframe found directly)');
        return solveMathInteractiveSpinner(challengeContainer, spinnerIframe);
    }
    
    // NEW: Check if this is "Select the answer" with pie chart choices
    // This is when we have an equation + multiple choice radio buttons where each choice contains a pie chart iframe
    if (equationContainer && choices.length > 0) {
        // Check if choices contain iframes with pie charts
        let choicesWithPieCharts = 0;
        for (const choice of choices) {
            const choiceIframe = choice.querySelector('iframe[title="Math Web Element"]');
            if (choiceIframe) {
                const srcdoc = choiceIframe.getAttribute('srcdoc');
                if (srcdoc && srcdoc.includes('<svg') && srcdoc.includes('<path')) {
                    choicesWithPieCharts++;
                }
            }
        }
        
        if (choicesWithPieCharts > 0) {
            LOG('solveMathChallengeBlob: detected SELECT PIE CHART type (', choicesWithPieCharts, 'pie chart choices)');
            return solveMathSelectPieChart(challengeContainer, equationContainer, choices);
        }
    }
    
    if (mathWebIframe) {
        // Check if this is ExpressionBuild or Slider type by examining OUTPUT_VARS
        let outputVars = null;
        try {
            const iframeWindow = mathWebIframe.contentWindow;
            if (iframeWindow) {
                if (typeof iframeWindow.getOutputVariables === 'function') {
                    outputVars = iframeWindow.getOutputVariables();
                } else if (iframeWindow.OUTPUT_VARS) {
                    outputVars = iframeWindow.OUTPUT_VARS;
                }
                
                LOG_DEBUG('solveMathChallengeBlob: iframe OUTPUT_VARS =', JSON.stringify(outputVars));
                
                // ExpressionBuild has filled_entry_indices, Slider has value, Spinner has selected
                if (outputVars && 'filled_entry_indices' in outputVars) {
                    LOG('solveMathChallengeBlob: detected EXPRESSION BUILD type (filled_entry_indices found)');
                    return solveMathExpressionBuild(challengeContainer, mathWebIframe);
                }
                
                // NEW: Check for Spinner type (selectable segments)
                // Spinner has "selected" in OUTPUT_VARIABLES and contains "Spinner" in srcdoc
                if (outputVars && 'selected' in outputVars) {
                    const srcdoc = mathWebIframe.getAttribute('srcdoc');
                    if (srcdoc && srcdoc.includes('Spinner')) {
                        LOG('solveMathChallengeBlob: detected INTERACTIVE SPINNER type (selected found)');
                        return solveMathInteractiveSpinner(challengeContainer, mathWebIframe);
                    }
                }
                
                // NEW: Check for Factor Tree type
                // Factor Tree has "tokenTreeIndices" in OUTPUT_VARS and contains "FactorTree" in srcdoc
                if (outputVars && 'tokenTreeIndices' in outputVars) {
                    const srcdoc = mathWebIframe.getAttribute('srcdoc');
                    if (srcdoc && srcdoc.includes('FactorTree')) {
                        LOG('solveMathChallengeBlob: detected FACTOR TREE type (tokenTreeIndices found)');
                        return solveFactorTree(challengeContainer, mathWebIframe);
                    }
                }
            }
        } catch (e) {
            LOG_DEBUG('solveMathChallengeBlob: error checking iframe type:', e.message);
        }
        
        // NEW: Check if this is "pie chart + text input" type (Show this another way)
        // This is when we have a pie chart iframe but need to TYPE the fraction, not use a slider
        const srcdoc = mathWebIframe.getAttribute('srcdoc');
        const hasPieChart = srcdoc && srcdoc.includes('<svg') && srcdoc.includes('<path');
        const hasNoOutputVars = outputVars === null || outputVars === undefined;
        
        if (hasPieChart && textInput && hasNoOutputVars) {
            LOG('solveMathChallengeBlob: detected PIE CHART + TEXT INPUT type');
            return solveMathPieChartTextInput(challengeContainer, mathWebIframe, textInput);
        }
        
        // NEW: Check if this is "pie chart + select fraction" type (Show this another way)
        // This is when we have a pie chart iframe and need to SELECT the matching fraction from choices
        if (hasPieChart && choices.length > 0 && hasNoOutputVars) {
            // Verify choices contain fractions (not pie charts)
            let choicesHaveFractions = false;
            for (const choice of choices) {
                const annotation = choice.querySelector('annotation');
                if (annotation) {
                    const text = annotation.textContent;
                    if (text && (text.includes('\\frac') || text.match(/\d+\s*\/\s*\d+/))) {
                        choicesHaveFractions = true;
                        break;
                    }
                }
            }
            
            if (choicesHaveFractions) {
                LOG('solveMathChallengeBlob: detected PIE CHART + SELECT FRACTION type');
                return solveMathPieChartSelectFraction(challengeContainer, mathWebIframe, choices);
            }
        }
        
        // Default to slider type
        LOG('solveMathChallengeBlob: detected INTERACTIVE SLIDER type (iframe found)');
        return solveMathInteractiveSlider(challengeContainer, mathWebIframe);
    } else if (equationContainer && textInput) {
        // Type 4: "Type the answer" - equation with blank AND text input field
        LOG('solveMathChallengeBlob: detected TYPE THE ANSWER type (text input)');
        return solveMathTypeAnswer(challengeContainer, equationContainer, textInput);
    } else if (equationContainer && choices.length > 0) {
        // Check if this is "Select Equivalent Fraction" type ("Show this another way")
        // This is when we have a simple fraction (no equation) and need to select an equivalent one
        const eqAnnotation = equationContainer.querySelector('annotation');
        const eqText = eqAnnotation ? eqAnnotation.textContent : '';
        
        // Check header for "Show this another way" or similar
        const header = challengeContainer.querySelector('[data-test="challenge-header"] annotation');
        const headerText = header ? header.textContent : '';
        const isShowAnotherWay = headerText.toLowerCase().includes('show') && 
                                  headerText.toLowerCase().includes('another') &&
                                  headerText.toLowerCase().includes('way');
        
        // Check if equation is a simple fraction without = or \duoblank
        const isSimpleFraction = eqText.includes('\\frac') && 
                                  !eqText.includes('=') && 
                                  !eqText.includes('\\duoblank');
        
        if (isShowAnotherWay && isSimpleFraction) {
            LOG('solveMathChallengeBlob: detected SELECT EQUIVALENT FRACTION type');
            return solveMathSelectEquivalentFraction(challengeContainer, equationContainer, choices);
        }
        
        // Check if this is "Select Operator" type - blank between two values
        // E.g., "3/6 ? 1/6" with choices <, =, >
        const hasBlank = eqText.includes('\\duoblank');
        const choicesHaveIframes = choices.length > 0 && choices[0].querySelector('iframe');
        
        // Check if choices are operators
        let choicesAreOperators = false;
        if (choices.length > 0 && !choicesHaveIframes) {
            const firstChoiceAnnotation = choices[0].querySelector('annotation');
            if (firstChoiceAnnotation) {
                const choiceText = firstChoiceAnnotation.textContent.trim();
                // Operators: <, >, =, <=, >=, \lt, \gt, \le, \ge
                choicesAreOperators = /^[<>=]$/.test(choiceText) || 
                                       /^\\(lt|gt|le|ge)$/.test(choiceText) ||
                                       choiceText === '\\mathbf{<}' || 
                                       choiceText === '\\mathbf{>}' || 
                                       choiceText === '\\mathbf{=}';
            }
        }
        
        if (hasBlank && choices.length > 0 && choicesAreOperators) {
            LOG('solveMathChallengeBlob: detected SELECT OPERATOR type (choices are operators)');
            return solveMathSelectOperator(challengeContainer, equationContainer, choices);
        }
        
        // Check if this is a comparison challenge with choices (e.g., "1/4 > ?")
        // Has comparison operator AND \duoblank AND choices with fractions (not pie charts)
        const hasComparison = eqText.includes('<') || eqText.includes('>') || 
                              eqText.includes('\\lt') || eqText.includes('\\gt') ||
                              eqText.includes('\\le') || eqText.includes('\\ge');
        
        if (hasComparison && hasBlank && choices.length > 0 && !choicesHaveIframes) {
            LOG('solveMathChallengeBlob: detected COMPARISON CHOICE type (text fraction choices)');
            return solveMathComparisonChoice(challengeContainer, equationContainer, choices);
        }
        
        // Type 2: "Select the answer" - equation with blank AND choices to click
        LOG('solveMathChallengeBlob: detected EQUATION WITH BLANK type');
        return solveMathEquationBlank(challengeContainer, equationContainer);
    } else if (patternTable) {
        // Type 1: "Follow the pattern" - table with rows
        LOG('solveMathChallengeBlob: detected PATTERN TABLE type');
        return solveMathPatternTable(challengeContainer, patternTable);
    } else if (tapTokens.length > 0) {
        // Type 6: "Match the pairs" - tap tokens to match expressions with results
        LOG('solveMathChallengeBlob: detected MATCH THE PAIRS type');
        return solveMathMatchPairs(challengeContainer, tapTokens);
    } else {
        LOG_ERROR('solveMathChallengeBlob: unknown challenge format');
        LOG_DEBUG('solveMathChallengeBlob: container HTML:', challengeContainer.innerHTML.substring(0, 500));
        return null;
    }
}

/**
 * Solve "Select Equivalent Fraction" type - "Show this another way"
 * Given a fraction, select the choice that represents an equivalent fraction
 */
function solveMathSelectEquivalentFraction(challengeContainer, equationContainer, choices) {
    LOG('solveMathSelectEquivalentFraction: starting');
    
    // Extract the target fraction from equation container
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathSelectEquivalentFraction: annotation not found');
        return null;
    }
    
    const eqText = annotation.textContent;
    LOG('solveMathSelectEquivalentFraction: target fraction =', eqText);
    
    // Parse the fraction - extract numerator and denominator
    // Handles formats like \mathbf{\frac{8}{8}} or \frac{8}{8}
    const fracMatch = eqText.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!fracMatch) {
        LOG_ERROR('solveMathSelectEquivalentFraction: could not parse fraction from', eqText);
        return null;
    }
    
    const targetNumerator = parseInt(fracMatch[1], 10);
    const targetDenominator = parseInt(fracMatch[2], 10);
    const targetValue = targetNumerator / targetDenominator;
    
    LOG('solveMathSelectEquivalentFraction: target =', targetNumerator + '/' + targetDenominator, '=', targetValue);
    
    // Find the choice with an equivalent fraction
    let correctChoiceIndex = -1;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const choiceAnnotation = choice.querySelector('annotation');
        if (!choiceAnnotation) continue;
        
        const choiceText = choiceAnnotation.textContent;
        LOG_DEBUG('solveMathSelectEquivalentFraction: choice', i, '=', choiceText);
        
        // Parse the choice fraction
        const choiceFracMatch = choiceText.match(/\\frac\{(\d+)\}\{(\d+)\}/);
        if (choiceFracMatch) {
            const choiceNumerator = parseInt(choiceFracMatch[1], 10);
            const choiceDenominator = parseInt(choiceFracMatch[2], 10);
            const choiceValue = choiceNumerator / choiceDenominator;
            
            LOG_DEBUG('solveMathSelectEquivalentFraction: choice', i, '=', 
                      choiceNumerator + '/' + choiceDenominator, '=', choiceValue);
            
            // Check if values are equal (handle floating point comparison)
            if (Math.abs(choiceValue - targetValue) < 0.0001) {
                correctChoiceIndex = i;
                LOG('solveMathSelectEquivalentFraction: found equivalent fraction at choice', i,
                    ':', choiceNumerator + '/' + choiceDenominator);
                break;
            }
        }
    }
    
    if (correctChoiceIndex === -1) {
        LOG_ERROR('solveMathSelectEquivalentFraction: no equivalent fraction found');
        return null;
    }
    
    // Click the correct choice
    LOG('solveMathSelectEquivalentFraction: clicking choice', correctChoiceIndex);
    choices[correctChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        targetFraction: targetNumerator + '/' + targetDenominator,
        targetValue: targetValue,
        choiceIndex: correctChoiceIndex
    };
}

/**
 * Solve "Comparison Choice" type - comparison with text fraction choices
 * E.g., "1/4 > ?" with choices "1/5" and "5/4"
 * Need to find which choice makes the comparison TRUE
 */
function solveMathComparisonChoice(challengeContainer, equationContainer, choices) {
    LOG('solveMathComparisonChoice: starting');
    
    // Extract the equation from KaTeX
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathComparisonChoice: annotation not found');
        return null;
    }
    
    const eqText = annotation.textContent;
    LOG('solveMathComparisonChoice: equation =', eqText);
    
    // Detect comparison operator
    let comparisonOperator = null;
    if (eqText.includes('<=') || eqText.includes('\\le')) {
        comparisonOperator = '<=';
    } else if (eqText.includes('>=') || eqText.includes('\\ge')) {
        comparisonOperator = '>=';
    } else if (eqText.includes('<') || eqText.includes('\\lt')) {
        comparisonOperator = '<';
    } else if (eqText.includes('>') || eqText.includes('\\gt')) {
        comparisonOperator = '>';
    }
    
    if (!comparisonOperator) {
        LOG_ERROR('solveMathComparisonChoice: no comparison operator found');
        return null;
    }
    
    LOG('solveMathComparisonChoice: operator =', comparisonOperator);
    
    // Extract the left side value (the fraction before the operator)
    // E.g., from "\mathbf{\frac{1}{4}>\duoblank{1}}" extract 1/4
    let cleanedExpr = eqText;
    
    // Remove \mathbf{}, \textbf{} wrappers
    while (cleanedExpr.includes('\\mathbf{')) {
        cleanedExpr = extractLatexContent(cleanedExpr, '\\mathbf');
    }
    while (cleanedExpr.includes('\\textbf{')) {
        cleanedExpr = extractLatexContent(cleanedExpr, '\\textbf');
    }
    
    // Split by comparison operator to get left side
    let leftSide = cleanedExpr;
    const operators = ['<=', '>=', '\\le', '\\ge', '<', '>', '\\lt', '\\gt'];
    for (const op of operators) {
        if (leftSide.includes(op)) {
            leftSide = leftSide.split(op)[0];
            break;
        }
    }
    
    LOG_DEBUG('solveMathComparisonChoice: left side =', leftSide);
    
    // Convert \frac{a}{b} to (a/b)
    while (leftSide.includes('\\frac{')) {
        const fracMatch = leftSide.match(/\\frac\{/);
        if (!fracMatch) break;
        
        const fracStart = fracMatch.index;
        let numStart = fracStart + 6;
        let depth = 1;
        let numEnd = numStart;
        while (depth > 0 && numEnd < leftSide.length) {
            if (leftSide[numEnd] === '{') depth++;
            else if (leftSide[numEnd] === '}') depth--;
            numEnd++;
        }
        const numerator = leftSide.substring(numStart, numEnd - 1);
        
        let denomStart = numEnd + 1;
        depth = 1;
        let denomEnd = denomStart;
        while (depth > 0 && denomEnd < leftSide.length) {
            if (leftSide[denomEnd] === '{') depth++;
            else if (leftSide[denomEnd] === '}') depth--;
            denomEnd++;
        }
        const denominator = leftSide.substring(denomStart, denomEnd - 1);
        
        leftSide = leftSide.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + leftSide.substring(denomEnd);
    }
    
    // Evaluate the left side
    const leftValue = evaluateMathExpression(leftSide);
    if (leftValue === null) {
        LOG_ERROR('solveMathComparisonChoice: could not evaluate left side:', leftSide);
        return null;
    }
    
    LOG('solveMathComparisonChoice: left value =', leftValue);
    
    // Now check each choice
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    let correctChoiceIndex = -1;
    
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const choiceAnnotation = choice.querySelector('annotation');
        if (!choiceAnnotation) continue;
        
        let choiceText = choiceAnnotation.textContent;
        LOG_DEBUG('solveMathComparisonChoice: choice', i, 'raw =', choiceText);
        
        // Remove wrappers
        while (choiceText.includes('\\mathbf{')) {
            choiceText = extractLatexContent(choiceText, '\\mathbf');
        }
        while (choiceText.includes('\\textbf{')) {
            choiceText = extractLatexContent(choiceText, '\\textbf');
        }
        
        // Convert fractions
        while (choiceText.includes('\\frac{')) {
            const fracMatch = choiceText.match(/\\frac\{/);
            if (!fracMatch) break;
            
            const fracStart = fracMatch.index;
            let numStart = fracStart + 6;
            let depth = 1;
            let numEnd = numStart;
            while (depth > 0 && numEnd < choiceText.length) {
                if (choiceText[numEnd] === '{') depth++;
                else if (choiceText[numEnd] === '}') depth--;
                numEnd++;
            }
            const numerator = choiceText.substring(numStart, numEnd - 1);
            
            let denomStart = numEnd + 1;
            depth = 1;
            let denomEnd = denomStart;
            while (depth > 0 && denomEnd < choiceText.length) {
                if (choiceText[denomEnd] === '{') depth++;
                else if (choiceText[denomEnd] === '}') depth--;
                denomEnd++;
            }
            const denominator = choiceText.substring(denomStart, denomEnd - 1);
            
            choiceText = choiceText.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + choiceText.substring(denomEnd);
        }
        
        const choiceValue = evaluateMathExpression(choiceText);
        if (choiceValue === null) {
            LOG_DEBUG('solveMathComparisonChoice: could not evaluate choice', i);
            continue;
        }
        
        LOG_DEBUG('solveMathComparisonChoice: choice', i, '=', choiceValue);
        
        // Check if comparison is TRUE
        let comparisonResult = false;
        switch (comparisonOperator) {
            case '<':
                comparisonResult = leftValue < choiceValue;
                break;
            case '>':
                comparisonResult = leftValue > choiceValue;
                break;
            case '<=':
                comparisonResult = leftValue <= choiceValue;
                break;
            case '>=':
                comparisonResult = leftValue >= choiceValue;
                break;
        }
        
        LOG('solveMathComparisonChoice: check', leftValue, comparisonOperator, choiceValue, '=', comparisonResult);
        
        if (comparisonResult) {
            correctChoiceIndex = i;
            LOG('solveMathComparisonChoice: found correct choice', i);
            break;
        }
    }
    
    if (correctChoiceIndex === -1) {
        LOG_ERROR('solveMathComparisonChoice: no choice makes comparison TRUE');
        return null;
    }
    
    // Click the correct choice
    LOG('solveMathComparisonChoice: clicking choice', correctChoiceIndex);
    choices[correctChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        type: 'comparisonChoice',
        leftValue: leftValue,
        operator: comparisonOperator,
        choiceIndex: correctChoiceIndex
    };
}

/**
 * Solve "Select Operator" type - select comparison operator between two values
 * E.g., "3/6 ? 1/6" with choices <, =, >
 */
function solveMathSelectOperator(challengeContainer, equationContainer, choices) {
    LOG('solveMathSelectOperator: starting');
    
    // Extract the equation from KaTeX
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathSelectOperator: annotation not found');
        return null;
    }
    
    const eqText = annotation.textContent;
    LOG('solveMathSelectOperator: equation =', eqText);
    
    // Parse the equation to extract left and right values
    // Format: {value1}\;\duoblank{N}\;{value2} or similar
    let cleanedExpr = eqText;
    
    // Remove \mathbf{}, \textbf{} wrappers
    while (cleanedExpr.includes('\\mathbf{')) {
        cleanedExpr = extractLatexContent(cleanedExpr, '\\mathbf');
    }
    while (cleanedExpr.includes('\\textbf{')) {
        cleanedExpr = extractLatexContent(cleanedExpr, '\\textbf');
    }
    
    // Replace \duoblank with a marker
    cleanedExpr = cleanedExpr.replace(/\\duoblank\{[^}]*\}/g, ' BLANK ');
    
    // Remove LaTeX spacing commands
    cleanedExpr = cleanedExpr.replace(/\\;/g, ' ');
    cleanedExpr = cleanedExpr.replace(/\\,/g, ' ');
    cleanedExpr = cleanedExpr.replace(/\\quad/g, ' ');
    cleanedExpr = cleanedExpr.replace(/\s+/g, ' ').trim();
    
    LOG_DEBUG('solveMathSelectOperator: after cleanup =', cleanedExpr);
    
    // Split by BLANK to get left and right parts
    const parts = cleanedExpr.split('BLANK');
    if (parts.length !== 2) {
        LOG_ERROR('solveMathSelectOperator: could not split by BLANK, parts =', parts.length);
        return null;
    }
    
    let leftPart = parts[0].trim();
    let rightPart = parts[1].trim();
    
    // Remove outer braces if present
    if (leftPart.startsWith('{') && leftPart.endsWith('}')) {
        leftPart = leftPart.substring(1, leftPart.length - 1);
    }
    if (rightPart.startsWith('{') && rightPart.endsWith('}')) {
        rightPart = rightPart.substring(1, rightPart.length - 1);
    }
    
    LOG_DEBUG('solveMathSelectOperator: left part =', leftPart, ', right part =', rightPart);
    
    // Convert fractions in both parts
    const convertFractions = (str) => {
        while (str.includes('\\frac{')) {
            const fracMatch = str.match(/\\frac\{/);
            if (!fracMatch) break;
            
            const fracStart = fracMatch.index;
            let numStart = fracStart + 6;
            let depth = 1;
            let numEnd = numStart;
            while (depth > 0 && numEnd < str.length) {
                if (str[numEnd] === '{') depth++;
                else if (str[numEnd] === '}') depth--;
                numEnd++;
            }
            const numerator = str.substring(numStart, numEnd - 1);
            
            let denomStart = numEnd + 1;
            depth = 1;
            let denomEnd = denomStart;
            while (depth > 0 && denomEnd < str.length) {
                if (str[denomEnd] === '{') depth++;
                else if (str[denomEnd] === '}') depth--;
                denomEnd++;
            }
            const denominator = str.substring(denomStart, denomEnd - 1);
            
            str = str.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + str.substring(denomEnd);
        }
        return str;
    };
    
    leftPart = convertFractions(leftPart);
    rightPart = convertFractions(rightPart);
    
    // Remove any remaining braces
    leftPart = leftPart.replace(/[{}]/g, '').trim();
    rightPart = rightPart.replace(/[{}]/g, '').trim();
    
    LOG_DEBUG('solveMathSelectOperator: converted left =', leftPart, ', right =', rightPart);
    
    // Evaluate both parts
    const leftValue = evaluateMathExpression(leftPart);
    const rightValue = evaluateMathExpression(rightPart);
    
    if (leftValue === null || rightValue === null) {
        LOG_ERROR('solveMathSelectOperator: could not evaluate parts, left =', leftValue, ', right =', rightValue);
        return null;
    }
    
    LOG('solveMathSelectOperator: left value =', leftValue, ', right value =', rightValue);
    
    // Determine the correct operator
    let correctOperator = null;
    if (Math.abs(leftValue - rightValue) < 0.0001) {
        correctOperator = '=';
    } else if (leftValue < rightValue) {
        correctOperator = '<';
    } else {
        correctOperator = '>';
    }
    
    LOG('solveMathSelectOperator: correct operator =', correctOperator);
    
    // Find and click the correct choice
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    let correctChoiceIndex = -1;
    
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const choiceAnnotation = choice.querySelector('annotation');
        if (!choiceAnnotation) continue;
        
        let choiceText = choiceAnnotation.textContent.trim();
        
        // Normalize the choice text
        choiceText = choiceText.replace(/\\mathbf\{([^}]+)\}/g, '$1');
        choiceText = choiceText.trim();
        
        // Normalize LaTeX operators to ASCII
        choiceText = choiceText.replace(/\\lt/g, '<');
        choiceText = choiceText.replace(/\\gt/g, '>');
        choiceText = choiceText.replace(/\\le/g, '<=');
        choiceText = choiceText.replace(/\\ge/g, '>=');
        choiceText = choiceText.replace(/\\leq/g, '<=');
        choiceText = choiceText.replace(/\\geq/g, '>=');
        
        LOG_DEBUG('solveMathSelectOperator: choice', i, '=', choiceText);
        
        if (choiceText === correctOperator) {
            correctChoiceIndex = i;
            LOG('solveMathSelectOperator: found matching choice at index', i);
            break;
        }
    }
    
    if (correctChoiceIndex === -1) {
        LOG_ERROR('solveMathSelectOperator: no matching operator found in choices');
        return null;
    }
    
    // Click the correct choice
    LOG('solveMathSelectOperator: clicking choice', correctChoiceIndex);
    choices[correctChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        type: 'selectOperator',
        leftValue: leftValue,
        rightValue: rightValue,
        correctOperator: correctOperator,
        choiceIndex: correctChoiceIndex
    };
}

/**
 * Solve "Select the answer" type - equation with blank
 * Also handles "Select all that match" type (multiple checkboxes)
 */
function solveMathEquationBlank(challengeContainer, equationContainer) {
    LOG('solveMathEquationBlank: starting');
    
    // Extract the equation from KaTeX
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathEquationBlank: annotation not found');
        return null;
    }
    
    const equation = annotation.textContent;
    LOG('solveMathEquationBlank: equation =', equation);
    
    // Solve for the blank
    const answer = solveEquationWithBlank(equation);
    LOG('solveMathEquationBlank: solved answer =', answer);
    
    if (answer === null) {
        LOG_ERROR('solveMathEquationBlank: could not solve equation');
        return null;
    }
    
    // Find and click the correct choice(s)
    const choices = challengeContainer.querySelectorAll(CHALLENGE_CHOICE);
    LOG('solveMathEquationBlank: found', choices.length, 'choices');
    
    // Check if this is a multi-select (checkbox) or single-select (radio)
    const isMultiSelect = choices.length > 0 && choices[0].getAttribute('role') === 'checkbox';
    LOG('solveMathEquationBlank: isMultiSelect =', isMultiSelect);
    
    const matchingIndices = [];
    
    for (let i = 0; i < choices.length; i++) {
        const choiceValue = extractKatexValue(choices[i]);
        LOG('solveMathEquationBlank: choice', i, '- value:', choiceValue);
        
        let choiceNum;
        
        // Check if this is an expression (contains operators) or a simple number
        const isExpression = choiceValue && /[+\-*/]/.test(choiceValue);
        
        if (isExpression) {
            // Evaluate as expression
            choiceNum = evaluateMathExpression(choiceValue);
            LOG_DEBUG('solveMathEquationBlank: evaluated expression', choiceValue, '=', choiceNum);
        } else {
            // Parse as simple number
            choiceNum = parseFloat(choiceValue);
        }
        
        if (!isNaN(choiceNum) && choiceNum === answer) {
            matchingIndices.push(i);
            LOG('solveMathEquationBlank: found matching choice at index', i, '(', choiceValue, '=', choiceNum, ')');
            
            // For single-select (radio), stop after first match
            if (!isMultiSelect) {
                break;
            }
        }
    }
    
    if (matchingIndices.length === 0) {
        LOG_ERROR('solveMathEquationBlank: could not find matching choice for answer', answer);
        return null;
    }
    
    // Click the matching choice(s)
    for (const idx of matchingIndices) {
        LOG('solveMathEquationBlank: clicking choice', idx);
        choices[idx].dispatchEvent(clickEvent);
    }
    
    return {
        type: isMultiSelect ? 'selectAllMatch' : 'equationBlank',
        equation: equation,
        answer: answer,
        choiceIndices: matchingIndices
    };
}

/**
 * Solve "Type the answer" type - equation with blank where answer is typed in text input
 */
function solveMathTypeAnswer(challengeContainer, equationContainer, textInput) {
    LOG('solveMathTypeAnswer: starting');
    
    // Extract the equation from KaTeX
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathTypeAnswer: annotation not found');
        return null;
    }
    
    const equation = annotation.textContent;
    LOG('solveMathTypeAnswer: equation =', equation);
    
    // Check if this is a "Show this another way" / simplify fraction type
    // These have just a fraction without an equation (no =, no \duoblank)
    // The placeholder says "Example: 1 / 2"
    if (!equation.includes('=') && !equation.includes('\\duoblank')) {
        LOG('solveMathTypeAnswer: detected SIMPLIFY FRACTION type (no equation)');
        
        // Try to parse a fraction from the expression
        const fractionResult = parseFractionExpression(equation);
        
        if (fractionResult) {
            LOG('solveMathTypeAnswer: parsed fraction:', fractionResult.numerator + '/' + fractionResult.denominator);
            
            // Simplify the fraction
            const simplified = simplifyFraction(fractionResult.numerator, fractionResult.denominator);
            LOG('solveMathTypeAnswer: simplified to:', simplified.numerator + '/' + simplified.denominator);
            
            // Format the answer as "numerator/denominator"
            const answerStr = `${simplified.numerator}/${simplified.denominator}`;
            LOG('solveMathTypeAnswer: typing answer:', answerStr);
            
            dynamicInput(textInput, answerStr);
            
            return {
                type: 'simplifyFraction',
                equation: equation,
                original: fractionResult,
                simplified: simplified,
                answer: answerStr
            };
        }
        
        LOG_WARN('solveMathTypeAnswer: could not parse fraction from expression');
    }
    
    // Check if this is an inequality with a blank (e.g., "5/5 > ?")
    const hasInequality = equation.includes('>') || equation.includes('<') ||
                          equation.includes('\\gt') || equation.includes('\\lt') ||
                          equation.includes('\\ge') || equation.includes('\\le');
    const hasBlank = equation.includes('\\duoblank');
    
    if (hasInequality && hasBlank) {
        LOG('solveMathTypeAnswer: detected INEQUALITY with blank type');
        
        const inequalityAnswer = solveInequalityWithBlank(equation);
        if (inequalityAnswer !== null) {
            LOG('solveMathTypeAnswer: inequality answer =', inequalityAnswer);
            dynamicInput(textInput, inequalityAnswer);
            
            return {
                type: 'typeInequalityAnswer',
                equation: equation,
                answer: inequalityAnswer
            };
        }
    }
    
    // Standard equation solving (with = and/or \duoblank)
    const answer = solveEquationWithBlank(equation);
    LOG('solveMathTypeAnswer: solved answer =', answer);
    
    if (answer === null) {
        LOG_ERROR('solveMathTypeAnswer: could not solve equation');
        return null;
    }
    
    // Type the answer into the text input
    LOG('solveMathTypeAnswer: typing answer into text input');
    dynamicInput(textInput, answer.toString());
    
    return {
        type: 'typeAnswer',
        equation: equation,
        answer: answer
    };
}

/**
 * Parse a fraction expression from LaTeX (e.g., \mathbf{\frac{2}{4}} or 2/4)
 * Returns { numerator, denominator, value } or null
 */
function parseFractionExpression(expr) {
    LOG_DEBUG('parseFractionExpression: input', expr);
    
    let cleaned = expr;
    
    // Remove LaTeX wrappers
    while (cleaned.includes('\\mathbf{')) {
        cleaned = extractLatexContent(cleaned, '\\mathbf');
    }
    while (cleaned.includes('\\textbf{')) {
        cleaned = extractLatexContent(cleaned, '\\textbf');
    }
    
    LOG_DEBUG('parseFractionExpression: after removing wrappers:', cleaned);
    
    // Try to match \frac{numerator}{denominator}
    const fracMatch = cleaned.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (fracMatch) {
        const numerator = parseInt(fracMatch[1], 10);
        const denominator = parseInt(fracMatch[2], 10);
        return {
            numerator: numerator,
            denominator: denominator,
            value: numerator / denominator
        };
    }
    
    // Try simple fraction format: number/number
    const simpleFracMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (simpleFracMatch) {
        const numerator = parseInt(simpleFracMatch[1], 10);
        const denominator = parseInt(simpleFracMatch[2], 10);
        return {
            numerator: numerator,
            denominator: denominator,
            value: numerator / denominator
        };
    }
    
    // Try to evaluate expression with multiple fractions (e.g., 1/5+2/5)
    // First convert all \frac to (a/b)
    while (cleaned.includes('\\frac{')) {
        const match = cleaned.match(/\\frac\{/);
        if (!match) break;
        
        const fracStart = match.index;
        let numStart = fracStart + 6;
        let depth = 1;
        let numEnd = numStart;
        while (depth > 0 && numEnd < cleaned.length) {
            if (cleaned[numEnd] === '{') depth++;
            else if (cleaned[numEnd] === '}') depth--;
            numEnd++;
        }
        const num = cleaned.substring(numStart, numEnd - 1);
        
        let denomStart = numEnd + 1;
        depth = 1;
        let denomEnd = denomStart;
        while (depth > 0 && denomEnd < cleaned.length) {
            if (cleaned[denomEnd] === '{') depth++;
            else if (cleaned[denomEnd] === '}') depth--;
            denomEnd++;
        }
        const denom = cleaned.substring(denomStart, denomEnd - 1);
        
        cleaned = cleaned.substring(0, fracStart) + '(' + num + '/' + denom + ')' + cleaned.substring(denomEnd);
    }
    
    cleaned = cleaned.replace(/\s+/g, '');
    LOG_DEBUG('parseFractionExpression: converted expression:', cleaned);
    
    // If it's a compound expression with + or -, evaluate it
    if (cleaned.includes('+') || cleaned.includes('-')) {
        const result = evaluateMathExpression(cleaned);
        if (result !== null) {
            // Try to convert back to a simple fraction
            // Find a reasonable denominator (try common ones)
            for (const testDenom of [2, 3, 4, 5, 6, 8, 10, 12, 100]) {
                const testNum = Math.round(result * testDenom);
                if (Math.abs(testNum / testDenom - result) < 0.0001) {
                    return {
                        numerator: testNum,
                        denominator: testDenom,
                        value: result
                    };
                }
            }
        }
    }
    
    return null;
}

/**
 * Solve an inequality with a blank (e.g., "5/5 > ?")
 * Returns a fraction string that satisfies the inequality, or null
 */
function solveInequalityWithBlank(equation) {
    LOG_DEBUG('solveInequalityWithBlank: input', equation);
    
    let cleaned = equation;
    
    // Remove LaTeX wrappers
    while (cleaned.includes('\\mathbf{')) {
        cleaned = extractLatexContent(cleaned, '\\mathbf');
    }
    while (cleaned.includes('\\textbf{')) {
        cleaned = extractLatexContent(cleaned, '\\textbf');
    }
    
    // Detect the comparison operator and normalize
    let operator = null;
    let operatorStr = null;
    
    if (cleaned.includes('>=') || cleaned.includes('\\ge')) {
        operator = '>=';
        operatorStr = cleaned.includes('>=') ? '>=' : '\\ge';
    } else if (cleaned.includes('<=') || cleaned.includes('\\le')) {
        operator = '<=';
        operatorStr = cleaned.includes('<=') ? '<=' : '\\le';
    } else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
        operator = '>';
        operatorStr = cleaned.includes('>') ? '>' : '\\gt';
    } else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
        operator = '<';
        operatorStr = cleaned.includes('<') ? '<' : '\\lt';
    }
    
    if (!operator) {
        LOG_DEBUG('solveInequalityWithBlank: no operator found');
        return null;
    }
    
    LOG_DEBUG('solveInequalityWithBlank: operator =', operator);
    
    // Split by the operator
    const parts = cleaned.split(operatorStr);
    if (parts.length !== 2) {
        LOG_DEBUG('solveInequalityWithBlank: could not split by operator');
        return null;
    }
    
    let leftPart = parts[0].trim();
    let rightPart = parts[1].trim();
    
    // Determine which side has the blank
    const leftHasBlank = leftPart.includes('\\duoblank');
    const rightHasBlank = rightPart.includes('\\duoblank');
    
    if (!leftHasBlank && !rightHasBlank) {
        LOG_DEBUG('solveInequalityWithBlank: no blank found');
        return null;
    }
    
    // Get the known value from the non-blank side
    const knownPart = leftHasBlank ? rightPart : leftPart;
    
    // Parse the known value (handle fractions)
    let knownValue = null;
    let knownNumerator = null;
    let knownDenominator = null;
    
    // Try to parse \frac{num}{denom}
    const fracMatch = knownPart.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (fracMatch) {
        knownNumerator = parseInt(fracMatch[1], 10);
        knownDenominator = parseInt(fracMatch[2], 10);
        knownValue = knownNumerator / knownDenominator;
    } else {
        // Try simple number
        const numMatch = knownPart.match(/(\d+)/);
        if (numMatch) {
            knownValue = parseFloat(numMatch[1]);
            knownNumerator = parseInt(numMatch[1], 10);
            knownDenominator = 1;
        }
    }
    
    if (knownValue === null) {
        LOG_DEBUG('solveInequalityWithBlank: could not parse known value from', knownPart);
        return null;
    }
    
    LOG_DEBUG('solveInequalityWithBlank: known value =', knownValue, '(', knownNumerator, '/', knownDenominator, ')');
    
    // Generate an answer that satisfies the inequality
    // The answer format should be "numerator/denominator" for fractions
    let answerNum, answerDenom;
    
    if (leftHasBlank) {
        // Blank is on the LEFT: "? op value"
        // For "? > value": answer must be greater than value
        // For "? < value": answer must be less than value
        switch (operator) {
            case '>':
            case '>=':
                // Need something GREATER than knownValue
                answerNum = knownNumerator + 1;
                answerDenom = knownDenominator;
                break;
            case '<':
            case '<=':
                // Need something LESS than knownValue
                if (knownValue > 0) {
                    answerNum = Math.max(0, knownNumerator - 1);
                    answerDenom = knownDenominator;
                } else {
                    answerNum = knownNumerator - 1;
                    answerDenom = knownDenominator;
                }
                break;
        }
    } else {
        // Blank is on the RIGHT: "value op ?"
        // For "value > ?": answer must be less than value
        // For "value < ?": answer must be greater than value
        switch (operator) {
            case '>':
            case '>=':
                // Need something LESS than knownValue
                if (knownValue > 0) {
                    answerNum = Math.max(0, knownNumerator - 1);
                    answerDenom = knownDenominator;
                } else {
                    answerNum = knownNumerator - 1;
                    answerDenom = knownDenominator;
                }
                break;
            case '<':
            case '<=':
                // Need something GREATER than knownValue
                answerNum = knownNumerator + 1;
                answerDenom = knownDenominator;
                break;
        }
    }
    
    // Format the answer
    const answerStr = `${answerNum}/${answerDenom}`;
    LOG('solveInequalityWithBlank: generated answer =', answerStr);
    
    return answerStr;
}

/**
 * Simplify a fraction to its lowest terms
 * Returns { numerator, denominator }
 */
function simplifyFraction(numerator, denominator) {
    const gcd = greatestCommonDivisor(numerator, denominator);
    return {
        numerator: numerator / gcd,
        denominator: denominator / gcd
    };
}

/**
 * Calculate the greatest common divisor (GCD) of two numbers
 * Using Euclidean algorithm
 */
function greatestCommonDivisor(a, b) {
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
 * Solve "Show this another way" with pie chart + text input
 * The page shows a pie chart and you need to type the fraction it represents
 * e.g., if 2 out of 3 sectors are colored, type "2/3"
 */
function solveMathPieChartTextInput(challengeContainer, iframe, textInput) {
    LOG('solveMathPieChartTextInput: starting');
    
    // Extract the fraction from the pie chart
    const srcdoc = iframe.getAttribute('srcdoc');
    if (!srcdoc) {
        LOG_ERROR('solveMathPieChartTextInput: no srcdoc found in iframe');
        return null;
    }
    
    const fraction = extractPieChartFraction(srcdoc);
    if (!fraction) {
        LOG_ERROR('solveMathPieChartTextInput: could not extract fraction from pie chart');
        return null;
    }
    
    LOG('solveMathPieChartTextInput: extracted fraction:', fraction.numerator + '/' + fraction.denominator, '=', fraction.value);
    
    // Format the answer as a fraction string
    // The placeholder says "Example: 1 / 2" so we use "numerator / denominator" format
    const answerStr = `${fraction.numerator}/${fraction.denominator}`;
    LOG('solveMathPieChartTextInput: typing answer:', answerStr);
    
    // Type the answer into the text input
    dynamicInput(textInput, answerStr);
    
    return {
        type: 'pieChartTextInput',
        fraction: fraction,
        answer: answerStr
    };
}

/**
 * Solve "Show this another way" with pie chart + fraction choices
 * The page shows a pie chart (e.g., 5/6 colored) and you need to select 
 * the matching fraction from multiple choice options
 */
function solveMathPieChartSelectFraction(challengeContainer, iframe, choices) {
    LOG('solveMathPieChartSelectFraction: starting');
    
    // Extract the fraction from the pie chart
    const srcdoc = iframe.getAttribute('srcdoc');
    if (!srcdoc) {
        LOG_ERROR('solveMathPieChartSelectFraction: no srcdoc found in iframe');
        return null;
    }
    
    const pieChartFraction = extractPieChartFraction(srcdoc);
    if (!pieChartFraction) {
        LOG_ERROR('solveMathPieChartSelectFraction: could not extract fraction from pie chart');
        return null;
    }
    
    LOG('solveMathPieChartSelectFraction: pie chart shows', 
        pieChartFraction.numerator + '/' + pieChartFraction.denominator, '=', pieChartFraction.value);
    
    // Find the matching choice
    let matchedChoiceIndex = -1;
    
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        
        // Extract fraction from the choice
        const annotation = choice.querySelector('annotation');
        if (!annotation) {
            LOG_DEBUG('solveMathPieChartSelectFraction: choice', i, 'has no annotation');
            continue;
        }
        
        const choiceText = annotation.textContent;
        LOG_DEBUG('solveMathPieChartSelectFraction: choice', i, 'annotation:', choiceText);
        
        // Parse the fraction from the choice
        // Handle \mathbf{\frac{a}{b}} format
        let cleanedText = choiceText;
        
        // Remove \mathbf{} wrapper
        while (cleanedText.includes('\\mathbf{')) {
            cleanedText = extractLatexContent(cleanedText, '\\mathbf');
        }
        while (cleanedText.includes('\\textbf{')) {
            cleanedText = extractLatexContent(cleanedText, '\\textbf');
        }
        
        // Extract fraction values
        let choiceNumerator = null;
        let choiceDenominator = null;
        
        // Try \frac{a}{b} format
        const fracMatch = cleanedText.match(/\\frac\{(\d+)\}\{(\d+)\}/);
        if (fracMatch) {
            choiceNumerator = parseInt(fracMatch[1], 10);
            choiceDenominator = parseInt(fracMatch[2], 10);
        } else {
            // Try simple a/b format
            const simpleFracMatch = cleanedText.match(/(\d+)\s*\/\s*(\d+)/);
            if (simpleFracMatch) {
                choiceNumerator = parseInt(simpleFracMatch[1], 10);
                choiceDenominator = parseInt(simpleFracMatch[2], 10);
            }
        }
        
        if (choiceNumerator === null || choiceDenominator === null) {
            LOG_DEBUG('solveMathPieChartSelectFraction: could not parse fraction from choice', i);
            continue;
        }
        
        const choiceValue = choiceNumerator / choiceDenominator;
        LOG('solveMathPieChartSelectFraction: choice', i, '=', 
            choiceNumerator + '/' + choiceDenominator, '=', choiceValue);
        
        // Compare with pie chart value
        // Use both exact match (numerator/denominator) and value comparison
        const exactMatch = (choiceNumerator === pieChartFraction.numerator && 
                           choiceDenominator === pieChartFraction.denominator);
        const valueMatch = Math.abs(choiceValue - pieChartFraction.value) < 0.0001;
        
        if (exactMatch) {
            matchedChoiceIndex = i;
            LOG('solveMathPieChartSelectFraction: EXACT MATCH at choice', i);
            break;
        } else if (valueMatch && matchedChoiceIndex === -1) {
            // Value match as fallback (for equivalent fractions like 2/4 = 1/2)
            matchedChoiceIndex = i;
            LOG('solveMathPieChartSelectFraction: VALUE MATCH at choice', i);
            // Don't break - continue looking for exact match
        }
    }
    
    if (matchedChoiceIndex === -1) {
        LOG_ERROR('solveMathPieChartSelectFraction: no matching choice found for', 
                  pieChartFraction.numerator + '/' + pieChartFraction.denominator);
        return null;
    }
    
    // Click the matched choice
    LOG('solveMathPieChartSelectFraction: clicking choice', matchedChoiceIndex);
    choices[matchedChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        type: 'pieChartSelectFraction',
        pieChartFraction: pieChartFraction,
        selectedChoice: matchedChoiceIndex
    };
}

/**
 * Solve "Select the answer" with pie chart choices
 * The page shows an equation (e.g., 1/3 + 1/3 = ?) OR just a fraction (e.g., 1/4)
 * and multiple pie chart choices. The user needs to select the matching pie chart.
 */
function solveMathSelectPieChart(challengeContainer, equationContainer, choices) {
    LOG('solveMathSelectPieChart: starting');
    
    // Extract the equation from KaTeX
    const annotation = equationContainer.querySelector('annotation');
    if (!annotation) {
        LOG_ERROR('solveMathSelectPieChart: annotation not found');
        return null;
    }
    
    const equation = annotation.textContent;
    LOG('solveMathSelectPieChart: equation =', equation);
    
    // Parse the equation to get the target value
    // Could be:
    // 1. An equation with blank: \mathbf{\frac{1}{3}+\frac{1}{3}=\duoblank{1}}
    // 2. Just a fraction: \mathbf{\frac{1}{4}} (for "Show this another way")
    
    let targetValue = null;
    
    // Check if this is an equation (has =) or just an expression
    const hasEquals = equation.includes('=');
    
    if (hasEquals) {
        // First, try to solve it as an equation with blank
        targetValue = solveEquationWithBlank(equation);
    }
    
    if (targetValue === null) {
        // Clean the expression using extractLatexContent for proper nested brace handling
        let cleanedExpr = equation;
        
        // Remove \mathbf{}, \textbf{} with proper nested brace handling
        while (cleanedExpr.includes('\\mathbf{')) {
            cleanedExpr = extractLatexContent(cleanedExpr, '\\mathbf');
        }
        while (cleanedExpr.includes('\\textbf{')) {
            cleanedExpr = extractLatexContent(cleanedExpr, '\\textbf');
        }
        
        // Replace \duoblank with placeholder
        cleanedExpr = cleanedExpr.replace(/\\duoblank\{[^}]*\}/g, '?');
        cleanedExpr = cleanedExpr.replace(/\s+/g, '');
        
        LOG_DEBUG('solveMathSelectPieChart: after removing wrappers =', cleanedExpr);
        
        // Handle \frac{a}{b} -> (a/b) with nested braces support
        while (cleanedExpr.includes('\\frac{')) {
            const fracMatch = cleanedExpr.match(/\\frac\{/);
            if (!fracMatch) break;
            
            const fracStart = fracMatch.index;
            // Find the numerator
            let numStart = fracStart + 6; // after \frac{
            let depth = 1;
            let numEnd = numStart;
            while (depth > 0 && numEnd < cleanedExpr.length) {
                if (cleanedExpr[numEnd] === '{') depth++;
                else if (cleanedExpr[numEnd] === '}') depth--;
                numEnd++;
            }
            const numerator = cleanedExpr.substring(numStart, numEnd - 1);
            
            // Find the denominator
            let denomStart = numEnd + 1; // after }{
            depth = 1;
            let denomEnd = denomStart;
            while (depth > 0 && denomEnd < cleanedExpr.length) {
                if (cleanedExpr[denomEnd] === '{') depth++;
                else if (cleanedExpr[denomEnd] === '}') depth--;
                denomEnd++;
            }
            const denominator = cleanedExpr.substring(denomStart, denomEnd - 1);
            
            cleanedExpr = cleanedExpr.substring(0, fracStart) + '(' + numerator + '/' + denominator + ')' + cleanedExpr.substring(denomEnd);
        }
        
        LOG_DEBUG('solveMathSelectPieChart: after frac conversion =', cleanedExpr);
        
        // If there's an = sign, split and evaluate the left side
        // Otherwise, just evaluate the whole expression
        if (cleanedExpr.includes('=')) {
            const parts = cleanedExpr.split('=');
            const leftSide = parts[0];
            targetValue = evaluateMathExpression(leftSide);
            LOG('solveMathSelectPieChart: evaluated left side =', leftSide, '-> value =', targetValue);
        } else {
            // No = sign, just evaluate the expression directly
            targetValue = evaluateMathExpression(cleanedExpr);
            LOG('solveMathSelectPieChart: evaluated expression =', cleanedExpr, '-> value =', targetValue);
        }
    }
    
    if (targetValue === null) {
        LOG_ERROR('solveMathSelectPieChart: could not determine target value');
        return null;
    }
    
    LOG('solveMathSelectPieChart: target value =', targetValue);
    
    // Check if this is a comparison challenge (has <, >, <=, >=)
    // E.g., "1/6 < ?" means we need to find a pie chart where 1/6 < pieChartValue is TRUE
    let comparisonOperator = null;
    const cleanedForComparison = equation
        .replace(/\\mathbf\{/g, '').replace(/\\textbf\{/g, '')
        .replace(/\\duoblank\{[^}]*\}/g, '?')
        .replace(/\s+/g, '');
    
    // Check for comparison operators (but not inside \frac or similar)
    if (cleanedForComparison.includes('<=') || cleanedForComparison.includes('\\le')) {
        comparisonOperator = '<=';
    } else if (cleanedForComparison.includes('>=') || cleanedForComparison.includes('\\ge')) {
        comparisonOperator = '>=';
    } else if (cleanedForComparison.includes('<') && !cleanedForComparison.includes('\\lt')) {
        comparisonOperator = '<';
    } else if (cleanedForComparison.includes('\\lt')) {
        comparisonOperator = '<';
    } else if (cleanedForComparison.includes('>') && !cleanedForComparison.includes('\\gt')) {
        comparisonOperator = '>';
    } else if (cleanedForComparison.includes('\\gt')) {
        comparisonOperator = '>';
    }
    
    if (comparisonOperator) {
        LOG('solveMathSelectPieChart: detected COMPARISON mode, operator =', comparisonOperator);
    }
    
    // Now find the choice whose pie chart matches the target value
    let matchedChoiceIndex = -1;
    
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const choiceIframe = choice.querySelector('iframe[title="Math Web Element"]');
        
        if (!choiceIframe) {
            LOG_DEBUG('solveMathSelectPieChart: choice', i, 'has no iframe');
            continue;
        }
        
        const srcdoc = choiceIframe.getAttribute('srcdoc');
        if (!srcdoc) {
            LOG_DEBUG('solveMathSelectPieChart: choice', i, 'iframe has no srcdoc');
            continue;
        }
        
        // Extract pie chart fraction
        const fraction = extractPieChartFraction(srcdoc);
        if (!fraction) {
            LOG_DEBUG('solveMathSelectPieChart: choice', i, 'could not extract fraction');
            continue;
        }
        
        LOG('solveMathSelectPieChart: choice', i, '- pie chart fraction =', 
            fraction.numerator + '/' + fraction.denominator, '=', fraction.value);
        
        // Handle comparison challenges
        if (comparisonOperator) {
            let comparisonResult = false;
            switch (comparisonOperator) {
                case '<':
                    comparisonResult = targetValue < fraction.value;
                    break;
                case '>':
                    comparisonResult = targetValue > fraction.value;
                    break;
                case '<=':
                    comparisonResult = targetValue <= fraction.value;
                    break;
                case '>=':
                    comparisonResult = targetValue >= fraction.value;
                    break;
            }
            
            LOG_DEBUG('solveMathSelectPieChart: comparison', targetValue, comparisonOperator, fraction.value, '=', comparisonResult);
            
            if (comparisonResult) {
                matchedChoiceIndex = i;
                LOG('solveMathSelectPieChart: COMPARISON TRUE at choice', i, 
                    '(', targetValue, comparisonOperator, fraction.value, ')');
                break;
            }
        } else {
            // Compare with target value (with tolerance for floating point)
            if (Math.abs(fraction.value - targetValue) < 0.0001) {
                matchedChoiceIndex = i;
                LOG('solveMathSelectPieChart: MATCH found at choice', i);
                break;
            }
        }
    }
    
    if (matchedChoiceIndex === -1) {
        LOG_ERROR('solveMathSelectPieChart: no matching pie chart found for target value', targetValue,
                  comparisonOperator ? '(comparison mode: ' + comparisonOperator + ')' : '');
        return null;
    }
    
    // Click the matched choice
    LOG('solveMathSelectPieChart: clicking choice', matchedChoiceIndex);
    choices[matchedChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        type: 'selectPieChart',
        equation: equation,
        targetValue: targetValue,
        choiceIndex: matchedChoiceIndex
    };
}

/**
 * Solve "Match the pairs" math challenge
 * The page shows tokens with expressions and results that need to be matched
 * e.g., "2+2" matches "4", "6+6" matches "12", etc.
 */
/**
 * Extract fraction from pie chart SVG
 * Handles two formats:
 * 1. Traditional: multiple colored/uncolored path sectors
 * 2. Simple: circle background + paths representing portions
 * Returns { numerator, denominator, value } or null
 */
function extractPieChartFraction(svgContent) {
    if (!svgContent) return null;
    
    // The iframe contains BOTH light and dark mode SVGs
    // We need to extract just ONE of them to count correctly
    // Look for the dark mode SVG specifically (inside <span class="dark-img">)
    
    let svgToAnalyze = svgContent;
    
    // Try to extract just the dark mode SVG
    const darkImgMatch = svgContent.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
    if (darkImgMatch) {
        svgToAnalyze = darkImgMatch[1];
        LOG_DEBUG('extractPieChartFraction: using dark mode SVG');
    } else {
        // Fallback: try light mode
        const lightImgMatch = svgContent.match(/<span class="light-img">([\s\S]*?)<\/span>/);
        if (lightImgMatch) {
            svgToAnalyze = lightImgMatch[1];
            LOG_DEBUG('extractPieChartFraction: using light mode SVG');
        }
    }
    
    // METHOD 1: Traditional colored/uncolored sectors
    // Dark mode: colored = #49C0F8, uncolored = #131F24
    // Light mode: colored = #1CB0F6, uncolored = #FFFFFF
    
    // Count colored sectors (blue)
    const coloredPattern = /<path[^>]*fill="(#49C0F8|#1CB0F6)"[^>]*>/g;
    const coloredMatches = svgToAnalyze.match(coloredPattern) || [];
    
    // Count uncolored sectors (background)
    const uncoloredPattern = /<path[^>]*fill="(#131F24|#FFFFFF)"[^>]*>/g;
    const uncoloredMatches = svgToAnalyze.match(uncoloredPattern) || [];
    
    // Filter to only count paths that look like pie sectors (have stroke attribute)
    const coloredCount = coloredMatches.filter(m => m.includes('stroke=')).length;
    const uncoloredCount = uncoloredMatches.filter(m => m.includes('stroke=')).length;
    const totalCount = coloredCount + uncoloredCount;
    
    if (totalCount > 0) {
        LOG_DEBUG('extractPieChartFraction: (method 1) colored =', coloredCount, ', total =', totalCount);
        return {
            numerator: coloredCount,
            denominator: totalCount,
            value: coloredCount / totalCount
        };
    }
    
    // METHOD 2: Simple circle + sector paths (for "Show this another way" type)
    // Check if there's a circle element (indicating full pie reference)
    const hasCircle = svgToAnalyze.includes('<circle');
    if (hasCircle) {
        LOG_DEBUG('extractPieChartFraction: detected circle-based pie chart');
        
        // Count all path elements with stroke (these represent sectors)
        const allPathsPattern = /<path[^>]*stroke[^>]*>/g;
        const allPaths = svgToAnalyze.match(allPathsPattern) || [];
        const pathCount = allPaths.length;
        
        LOG_DEBUG('extractPieChartFraction: found', pathCount, 'path elements');
        
        if (pathCount === 0) {
            // Circle with no paths = full circle = 1
            return { numerator: 1, denominator: 1, value: 1.0 };
        }
        
        // Try to analyze path geometry to determine fraction
        // Extract path data and estimate the arc angle
        const pathDataMatch = svgToAnalyze.match(/<path[^>]*d="([^"]+)"[^>]*>/);
        if (pathDataMatch) {
            const pathData = pathDataMatch[1];
            
            // Analyze the path to determine the fraction
            // A quadrant path typically goes from center (100,100) to an edge and back
            // We can estimate by counting how many "quadrant-like" paths there are
            // or by analyzing the arc endpoints
            
            // Simple heuristic: count paths and check if path represents standard fractions
            // Look for L100 100 (line to center) which indicates a pie sector
            const sectorPaths = allPaths.filter(p => p.includes('L100 100') || p.includes('L 100 100') || p.includes('100L100'));
            
            if (sectorPaths.length > 0) {
                // Paths going to center indicate pie sectors
                // Estimate denominator based on number of sectors
                // For a single quadrant path, it's typically 1/4
                
                // Check for common fraction patterns by looking at path structure
                // A quarter (90°) path typically spans ~quarter of the circle
                
                // Count how many distinct sector paths we have
                const numSectors = sectorPaths.length;
                
                // Try to determine the total divisions by path endpoints
                // For now, assume each sector is 1 part of the whole
                // Most common cases: 1/2, 1/3, 1/4, 1/5, 1/6, etc.
                
                // Heuristic: if there's 1 sector path, check if it's a quarter
                if (numSectors === 1) {
                    // Check if the path data suggests a quarter arc (90°)
                    // Quarter paths typically have endpoints at 0°, 90°, 180°, or 270°
                    const pathStr = sectorPaths[0];
                    
                    // Look for indicators of quarter-circle
                    // A path from (100,2) to (198,100) to (100,100) is a quarter (top-right)
                    // Use simple detection based on path containing arc to specific coordinates
                    if (pathData.includes('198') || pathData.includes('2 ') || pathData.includes(' 2C') || 
                        pathData.includes(' 2V') || pathData.includes('V2') || pathData.includes('V100')) {
                        LOG_DEBUG('extractPieChartFraction: (method 2) detected 1/4 sector');
                        return { numerator: 1, denominator: 4, value: 0.25 };
                    }
                    
                    // Check for half-circle
                    if (pathData.includes('180') || (pathData.match(/100/g) || []).length >= 4) {
                        // Might be half
                        LOG_DEBUG('extractPieChartFraction: (method 2) detected 1/2 sector');
                        return { numerator: 1, denominator: 2, value: 0.5 };
                    }
                }
                
                // Fallback: estimate based on path count
                // Assume standard divisions (halves, thirds, quarters, etc.)
                LOG_DEBUG('extractPieChartFraction: (method 2) fallback - sectors =', numSectors);
                return { numerator: numSectors, denominator: 4, value: numSectors / 4 };
            }
        }
        
        // Last resort: if we have a circle and 1 path, assume 1/4
        if (pathCount === 1) {
            LOG_DEBUG('extractPieChartFraction: (method 2) single path with circle - assuming 1/4');
            return { numerator: 1, denominator: 4, value: 0.25 };
        }
    }
    
    LOG_DEBUG('extractPieChartFraction: no pie sectors found');
    return null;
}

/**
 * Extract value from block diagram SVG (used in "Nearest 10" challenges)
 * Counts the number of rectangles in the SVG - each represents one unit
 * @param {string} srcdoc - The srcdoc of the iframe containing the SVG
 * @returns {number|null} The count of blocks, or null if not a block diagram
 */
function extractBlockDiagramValue(srcdoc) {
    // Block diagrams have multiple <rect> elements with fill colors
    // Each rectangle represents one block
    // Typically arranged in columns of 10
    
    // Count rectangles with fill attribute (the blocks)
    // Match both light mode (#1CB0F6) and dark mode (#49C0F8) colors
    const rectMatches = srcdoc.match(/<rect[^>]*fill=["']#(?:1CB0F6|49C0F8|1899D6)["'][^>]*>/gi);
    
    if (rectMatches && rectMatches.length > 0) {
        // Filter out stroke-only rects (those are borders)
        const fillRects = rectMatches.filter(rect => rect.includes('fill='));
        if (fillRects.length > 0) {
            LOG_DEBUG('extractBlockDiagramValue: found', fillRects.length, 'block rectangles');
            return fillRects.length;
        }
    }
    
    // Alternative: count all rect elements with specific height (14.1755 is common)
    const allRects = srcdoc.match(/<rect[^>]*height=["']14\.1755["'][^>]*>/gi);
    if (allRects && allRects.length > 0) {
        LOG_DEBUG('extractBlockDiagramValue: found', allRects.length, 'rectangles by height');
        return allRects.length;
    }
    
    return null;
}

function solveMathMatchPairs(challengeContainer, tapTokens) {
    LOG('solveMathMatchPairs: starting');
    LOG('solveMathMatchPairs: found', tapTokens.length, 'tap tokens');
    
    // Extract values from all tokens
    const tokens = [];
    let hasNearest10 = false;  // Flag for "Nearest 10" matching mode
    
    for (let i = 0; i < tapTokens.length; i++) {
        const token = tapTokens[i];
        
        // Check if it's disabled (already matched)
        const isDisabled = token.getAttribute('aria-disabled') === 'true';
        if (isDisabled) {
            LOG_DEBUG('solveMathMatchPairs: token', i, 'is disabled, skipping');
            continue;
        }
        
        // Check for "Nearest 10" label (block diagram tokens)
        const nearest10Label = token.querySelector('._27M4R');
        if (nearest10Label && nearest10Label.textContent.includes('Nearest 10')) {
            hasNearest10 = true;
            
            // This is a block diagram - extract value from iframe SVG
            const iframe = token.querySelector('iframe[title="Math Web Element"]');
            if (iframe) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc) {
                    const blockCount = extractBlockDiagramValue(srcdoc);
                    if (blockCount !== null) {
                        tokens.push({
                            index: i,
                            element: token,
                            rawValue: `${blockCount} blocks`,
                            numericValue: blockCount,
                            isBlockDiagram: true,
                            isPieChart: false
                        });
                        LOG_DEBUG('solveMathMatchPairs: token', i, '- block diagram:', blockCount, 'blocks');
                        continue;
                    }
                }
            }
        }
        
        // Check if this token contains an iframe with pie chart
        const iframe = token.querySelector('iframe[title="Math Web Element"]');
        if (iframe) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc && srcdoc.includes('<svg')) {
                // Skip if already processed as block diagram
                if (nearest10Label) continue;
                
                const fraction = extractPieChartFraction(srcdoc);
                if (fraction) {
                    tokens.push({
                        index: i,
                        element: token,
                        rawValue: `${fraction.numerator}/${fraction.denominator} (pie)`,
                        numericValue: fraction.value,
                        isPieChart: true,
                        fraction: fraction
                    });
                    LOG_DEBUG('solveMathMatchPairs: token', i, '- pie chart:', fraction.numerator + '/' + fraction.denominator, '=', fraction.value);
                    continue;
                }
            }
        }
        
        // Otherwise, try to extract KaTeX value
        const value = extractKatexValue(token);
        LOG_DEBUG('solveMathMatchPairs: token', i, '- raw value:', value);
        
        if (value) {
            // Try to evaluate as expression (including fractions)
            const evaluated = evaluateMathExpression(value);
            
            // isExpression should be true only for COMPOUND expressions, not simple fractions
            // Simple fractions like (2/3) should be isExpression: false
            // Compound expressions like (1/3)+(1/3) or (1/3)-(1/6) should be isExpression: true
            // Check for + or * operators, or subtraction between terms (not negative signs)
            const isCompoundExpression = value.includes('+') || value.includes('*') || 
                /\)\s*-/.test(value) ||  // subtraction after closing parenthesis like (1/3)-(1/6)
                /\d\s*-\s*\(/.test(value) ||  // subtraction before opening parenthesis
                /\d\s*-\s*\d.*\//.test(value);  // number - fraction pattern
            
            tokens.push({
                index: i,
                element: token,
                rawValue: value,
                numericValue: evaluated,
                isExpression: isCompoundExpression,
                isPieChart: false
            });
            LOG_DEBUG('solveMathMatchPairs: token', i, '- value:', value, '- evaluated:', evaluated, '- isExpression:', isCompoundExpression);
        }
    }
    
    LOG('solveMathMatchPairs: active tokens:', tokens.length);
    
    if (tokens.length < 2) {
        LOG_WARN('solveMathMatchPairs: not enough active tokens');
        return null;
    }
    
    // Check for different matching modes
    const blockDiagrams = tokens.filter(t => t.isBlockDiagram);
    const pieCharts = tokens.filter(t => t.isPieChart);
    const numbers = tokens.filter(t => !t.isPieChart && !t.isBlockDiagram);
    
    LOG('solveMathMatchPairs: blockDiagrams:', blockDiagrams.length, ', pieCharts:', pieCharts.length, 
        ', numbers/expressions:', numbers.length);
    
    // Find matching pairs
    const pairs = [];
    const usedIndices = new Set();
    
    // MODE 1: "Nearest 10" matching - block diagrams with numbers
    if (hasNearest10 && blockDiagrams.length > 0 && numbers.length > 0) {
        LOG('solveMathMatchPairs: using Nearest 10 matching mode');
        
        for (const num of numbers) {
            if (usedIndices.has(num.index)) continue;
            
            // Round to nearest 10
            const rounded = Math.round(num.numericValue / 10) * 10;
            LOG_DEBUG('solveMathMatchPairs: number', num.numericValue, 'rounds to', rounded);
            
            // Find matching block diagram
            for (const block of blockDiagrams) {
                if (usedIndices.has(block.index)) continue;
                
                if (block.numericValue === rounded) {
                    pairs.push({ first: num, second: block });
                    usedIndices.add(num.index);
                    usedIndices.add(block.index);
                    LOG('solveMathMatchPairs: found Nearest 10 pair:', num.rawValue, '→', rounded, '↔', block.rawValue);
                    break;
                }
            }
        }
    }
    // MODE 2: Pie chart matching with fractions
    else if (pieCharts.length > 0 && numbers.length > 0) {
        // Match pie charts with fractions by comparing numeric values
        for (const pie of pieCharts) {
            for (const frac of numbers) {
                if (usedIndices.has(frac.index)) continue;
                
                // Compare values with tolerance for floating point
                if (pie.numericValue !== null && frac.numericValue !== null && 
                    Math.abs(pie.numericValue - frac.numericValue) < 0.0001) {
                    pairs.push({ first: pie, second: frac });
                    usedIndices.add(frac.index);
                    LOG('solveMathMatchPairs: found pair:', pie.rawValue, '=', frac.rawValue, '(', pie.numericValue, ')');
                    break;
                }
            }
        }
    } else {
        // Match compound expressions with simple fractions by numeric value
        const expressions = tokens.filter(t => t.isExpression);
        const simpleFractions = tokens.filter(t => !t.isExpression);
        
        LOG_DEBUG('solveMathMatchPairs: compound expressions:', expressions.length, ', simple fractions:', simpleFractions.length);
        
        if (expressions.length > 0 && simpleFractions.length > 0) {
            // Match compound expressions like (1/3)+(1/3) with simple fractions like (2/3)
            for (const expr of expressions) {
                for (const frac of simpleFractions) {
                    if (usedIndices.has(frac.index)) continue;
                    
                    if (expr.numericValue !== null && frac.numericValue !== null &&
                        Math.abs(expr.numericValue - frac.numericValue) < 0.0001) {
                        pairs.push({ first: expr, second: frac });
                        usedIndices.add(frac.index);
                        LOG('solveMathMatchPairs: found pair:', expr.rawValue, '=', frac.rawValue, '(', expr.numericValue, ')');
                        break;
                    }
                }
            }
        } else {
            // Fallback: try to match any tokens with same numeric value but different raw values
            LOG_DEBUG('solveMathMatchPairs: fallback mode - matching by numeric value');
            for (let i = 0; i < tokens.length; i++) {
                if (usedIndices.has(tokens[i].index)) continue;
                for (let j = i + 1; j < tokens.length; j++) {
                    if (usedIndices.has(tokens[j].index)) continue;
                    
                    const t1 = tokens[i];
                    const t2 = tokens[j];
                    
                    // Match if same numeric value but different raw representation
                    if (t1.numericValue !== null && t2.numericValue !== null &&
                        Math.abs(t1.numericValue - t2.numericValue) < 0.0001 &&
                        t1.rawValue !== t2.rawValue) {
                        pairs.push({ first: t1, second: t2 });
                        usedIndices.add(t1.index);
                        usedIndices.add(t2.index);
                        LOG('solveMathMatchPairs: found pair (fallback):', t1.rawValue, '=', t2.rawValue, '(', t1.numericValue, ')');
                        break;
                    }
                }
            }
        }
    }
    
    if (pairs.length === 0) {
        LOG_ERROR('solveMathMatchPairs: no matching pairs found');
        // Log all token values for debugging
        for (const t of tokens) {
            LOG_DEBUG('solveMathMatchPairs: token dump -', t.rawValue, '=', t.numericValue);
        }
        return null;
    }
    
    // Click the first unmatched pair
    const pair = pairs[0];
    LOG('solveMathMatchPairs: clicking pair:', pair.first.rawValue, '↔', pair.second.rawValue);
    
    // Click first token, then second token with a small delay
    pair.first.element.dispatchEvent(clickEvent);
    LOG('solveMathMatchPairs: clicked first:', pair.first.rawValue);
    
    setTimeout(() => {
        pair.second.element.dispatchEvent(clickEvent);
        LOG('solveMathMatchPairs: clicked second:', pair.second.rawValue);
    }, 100);
    
    return {
        type: 'matchPairs',
        pairs: pairs.map(p => ({ first: p.first.rawValue, second: p.second.rawValue })),
        clickedPair: { first: pair.first.rawValue, second: pair.second.rawValue }
    };
}

/**
 * Solve ExpressionBuild challenge
 * The challenge has an iframe where you drag tokens into blank slots to form an expression
 * e.g., "12 = ___" where you need to drag "10", "+", "2" to make "10 + 2 = 12"
 */
function solveMathExpressionBuild(challengeContainer, iframe) {
    LOG('solveMathExpressionBuild: starting');
    
    let targetValue = null;
    let equation = null;
    let tokens = [];
    let numEntries = 0;
    
    // Get the equation from the page (outside iframe)
    // Look for equation with duoblank in annotation
    const annotations = challengeContainer.querySelectorAll('annotation');
    for (const annotation of annotations) {
        const text = annotation.textContent;
        LOG_DEBUG('solveMathExpressionBuild: checking annotation', text);
        
        // Look for equations like "\mathbf{12 = \duoblank{3}}" where {3} means 3 blanks
        if (text && text.includes('\\duoblank')) {
            equation = text;
            // Extract the known value from equation
            // Format: "12 = \duoblank{3}" means we need expression that equals 12
            // Or: "\duoblank{3} = 12" means we need expression that equals 12
            const match = text.match(/(\d+)\s*=\s*\\duoblank/);
            const matchReverse = text.match(/\\duoblank\{(\d+)\}\s*=\s*(\d+)/);
            
            if (match) {
                targetValue = parseInt(match[1]);
                LOG('solveMathExpressionBuild: found target value (left side):', targetValue);
            } else if (matchReverse) {
                targetValue = parseInt(matchReverse[2]);
                LOG('solveMathExpressionBuild: found target value (right side):', targetValue);
            }
            break;
        }
    }
    
    if (targetValue === null) {
        LOG_ERROR('solveMathExpressionBuild: could not determine target value from equation');
        return null;
    }
    
    LOG('solveMathExpressionBuild: target value =', targetValue);
    
    // Now access the iframe to get tokens and entries info
    try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow?.document;
        
        LOG_DEBUG('solveMathExpressionBuild: iframeWindow =', !!iframeWindow, ', iframeDoc =', !!iframeDoc);
        
        if (iframeWindow) {
            // Get OUTPUT_VARS to check current state and get filled_entry_indices
            let outputVars = null;
            if (typeof iframeWindow.getOutputVariables === 'function') {
                outputVars = iframeWindow.getOutputVariables();
                LOG_DEBUG('solveMathExpressionBuild: getOutputVariables() =', JSON.stringify(outputVars));
            } else if (iframeWindow.OUTPUT_VARS) {
                outputVars = iframeWindow.OUTPUT_VARS;
            }
            
            // Try to access exprBuild or tokens from iframe window
            if (iframeWindow.exprBuild) {
                tokens = iframeWindow.tokens || [];
                numEntries = iframeWindow.exprBuild.entries?.length || 0;
                LOG('solveMathExpressionBuild: found exprBuild, tokens =', tokens.length, ', entries =', numEntries);
            }
            
            // If we can't access exprBuild directly, try to get from script content
            if (tokens.length === 0 && iframeDoc) {
                const scripts = iframeDoc.querySelectorAll('script');
                for (const script of scripts) {
                    const content = script.textContent || '';
                    
                    // Parse tokens array from script
                    // Format: const tokens = [renderNumber(2),renderNumber(10),renderNumber(11),"+",renderNumber(14),renderNumber(13),"-"];
                    const tokensMatch = content.match(/const\s+tokens\s*=\s*\[(.*?)\];/s);
                    if (tokensMatch) {
                        const tokensStr = tokensMatch[1];
                        LOG_DEBUG('solveMathExpressionBuild: found tokens string:', tokensStr);
                        
                        // Parse individual tokens
                        const tokenParts = tokensStr.split(',').map(t => t.trim());
                        for (const part of tokenParts) {
                            // renderNumber(X) -> X
                            const numMatch = part.match(/renderNumber\((\d+)\)/);
                            if (numMatch) {
                                tokens.push(parseInt(numMatch[1]));
                            } else {
                                // String token like "+" or "-"
                                const strMatch = part.match(/"([^"]+)"|'([^']+)'/);
                                if (strMatch) {
                                    tokens.push(strMatch[1] || strMatch[2]);
                                }
                            }
                        }
                        LOG('solveMathExpressionBuild: parsed tokens:', tokens);
                    }
                    
                    // Parse entries count
                    // Format: entries: [null,null,null]
                    const entriesMatch = content.match(/entries:\s*\[(null,?\s*)+\]/);
                    if (entriesMatch) {
                        numEntries = (entriesMatch[0].match(/null/g) || []).length;
                        LOG('solveMathExpressionBuild: entries count:', numEntries);
                    }
                }
            }
            
            if (tokens.length === 0) {
                LOG_ERROR('solveMathExpressionBuild: could not find tokens');
                return null;
            }
            
            LOG('solveMathExpressionBuild: tokens =', JSON.stringify(tokens), ', numEntries =', numEntries);
            
            // Now find the combination of tokens that equals targetValue
            // We need to find numEntries tokens from the array that form a valid expression
            const solution = findExpressionSolution(tokens, numEntries, targetValue);
            
            if (!solution) {
                LOG_ERROR('solveMathExpressionBuild: could not find solution for target', targetValue);
                return null;
            }
            
            LOG('solveMathExpressionBuild: found solution - indices:', solution);
            
            // Set the filled_entry_indices in OUTPUT_VARS
            if (outputVars && typeof outputVars === 'object') {
                outputVars.filled_entry_indices = solution;
                LOG('solveMathExpressionBuild: set filled_entry_indices =', JSON.stringify(solution));
                
                // Verify the change
                const varsAfter = typeof iframeWindow.getOutputVariables === 'function' 
                    ? iframeWindow.getOutputVariables() 
                    : iframeWindow.OUTPUT_VARS;
                LOG_DEBUG('solveMathExpressionBuild: OUTPUT_VARS after =', JSON.stringify(varsAfter));
            }
            
            // Trigger callbacks to notify Duolingo
            if (typeof iframeWindow.postOutputVariables === 'function') {
                iframeWindow.postOutputVariables();
                LOG('solveMathExpressionBuild: called postOutputVariables()');
            }
            
            if (iframeWindow.duo && typeof iframeWindow.duo.onFirstInteraction === 'function') {
                iframeWindow.duo.onFirstInteraction();
                LOG('solveMathExpressionBuild: called duo.onFirstInteraction()');
            }
            
            if (iframeWindow.duoDynamic && typeof iframeWindow.duoDynamic.onInteraction === 'function') {
                iframeWindow.duoDynamic.onInteraction();
                LOG('solveMathExpressionBuild: called duoDynamic.onInteraction()');
            }
            
            // Also try to simulate actual drag-and-drop by clicking tokens
            // This may be necessary for the UI to update properly
            if (iframeDoc) {
                const tokenElements = iframeDoc.querySelectorAll('[draggable="true"], .highlighted-symbol, [class*="token"]');
                LOG_DEBUG('solveMathExpressionBuild: found', tokenElements.length, 'draggable elements');
                
                // Try clicking the correct tokens in order
                for (const idx of solution) {
                    if (tokenElements[idx]) {
                        LOG_DEBUG('solveMathExpressionBuild: clicking token', idx);
                        tokenElements[idx].click();
                    }
                }
            }
            
            return {
                type: 'expressionBuild',
                equation: equation,
                targetValue: targetValue,
                tokens: tokens,
                solution: solution,
                success: true
            };
        }
    } catch (e) {
        LOG_ERROR('solveMathExpressionBuild: error:', e.message);
    }
    
    return {
        type: 'expressionBuild',
        equation: equation,
        targetValue: targetValue,
        success: false
    };
}

/**
 * Find a combination of tokens that equals the target value
 * Returns array of token indices or null if no solution found
 */
function findExpressionSolution(tokens, numEntries, target) {
    LOG_DEBUG('findExpressionSolution: tokens =', tokens, ', numEntries =', numEntries, ', target =', target);
    
    // Separate numbers and operators
    const numbers = [];
    const operators = [];
    
    for (let i = 0; i < tokens.length; i++) {
        if (typeof tokens[i] === 'number') {
            numbers.push({ value: tokens[i], index: i });
        } else if (['+', '-', '*', '/', '×', '÷'].includes(tokens[i])) {
            operators.push({ value: tokens[i], index: i });
        }
    }
    
    LOG_DEBUG('findExpressionSolution: numbers =', numbers, ', operators =', operators);
    
    // For numEntries = 1, just find a number that equals target
    if (numEntries === 1) {
        for (const num of numbers) {
            if (num.value === target) {
                return [num.index];
            }
        }
        return null;
    }
    
    // For numEntries = 3, try all combinations: num1 op num2
    if (numEntries === 3) {
        for (const num1 of numbers) {
            for (const op of operators) {
                for (const num2 of numbers) {
                    if (num1.index === num2.index) continue; // Can't use same token twice
                    
                    let result;
                    switch (op.value) {
                        case '+': result = num1.value + num2.value; break;
                        case '-': result = num1.value - num2.value; break;
                        case '*':
                        case '×': result = num1.value * num2.value; break;
                        case '/':
                        case '÷': result = num1.value / num2.value; break;
                    }
                    
                    LOG_DEBUG('findExpressionSolution: trying', num1.value, op.value, num2.value, '=', result);
                    
                    if (result === target) {
                        LOG('findExpressionSolution: found!', num1.value, op.value, num2.value, '=', target);
                        return [num1.index, op.index, num2.index];
                    }
                }
            }
        }
    }
    
    // For numEntries = 5, try all combinations: num1 op1 num2 op2 num3
    if (numEntries === 5) {
        for (const num1 of numbers) {
            for (const op1 of operators) {
                for (const num2 of numbers) {
                    if (num2.index === num1.index) continue;
                    for (const op2 of operators) {
                        if (op2.index === op1.index) continue;
                        for (const num3 of numbers) {
                            if (num3.index === num1.index || num3.index === num2.index) continue;
                            
                            // Evaluate expression respecting operator precedence
                            const expr = `${num1.value}${op1.value}${num2.value}${op2.value}${num3.value}`;
                            const result = evaluateMathExpression(expr);
                            
                            if (result === target) {
                                LOG('findExpressionSolution: found!', expr, '=', target);
                                return [num1.index, op1.index, num2.index, op2.index, num3.index];
                            }
                        }
                    }
                }
            }
        }
    }
    
    return null;
}

/**
 * Helper function to find iframe by checking its srcdoc content
 */
function findIframeByContent(iframes, contentSubstring) {
    for (const iframe of iframes) {
        const srcdoc = iframe.getAttribute('srcdoc');
        if (srcdoc && srcdoc.includes(contentSubstring)) {
            return iframe;
        }
    }
    return null;
}

/**
 * Solve interactive slider/number line challenge
 * The challenge has an iframe with a slider to select a value
 * NEW: Also handles "Show this another way" type where input is a pie chart in another iframe
 */
function solveMathInteractiveSlider(challengeContainer, iframe) {
    LOG('solveMathInteractiveSlider: starting');
    
    // Ensure iframe content is accessible (sync check with retry)
    let iframeRetries = 0;
    while (iframeRetries < 5) {
        try {
            if (iframe.contentWindow && iframe.getAttribute('srcdoc')) {
                break;
            }
        } catch (e) {
            // Continue
        }
        iframeRetries++;
        LOG_DEBUG('solveMathInteractiveSlider: waiting for iframe... attempt', iframeRetries);
    }
    
    // Check if there are multiple iframes - this might be the "pie chart + slider" variant
    // Include both titled iframes and sandbox iframes (NumberLine doesn't always have title)
    const titledIframes = challengeContainer.querySelectorAll('iframe[title="Math Web Element"]');
    const sandboxIframes = challengeContainer.querySelectorAll('iframe[sandbox][srcdoc]');
    
    // Combine into a unique Set then convert back to array
    const allIframesSet = new Set([...titledIframes, ...sandboxIframes]);
    const allIframes = Array.from(allIframesSet);
    LOG_DEBUG('solveMathInteractiveSlider: found', allIframes.length, 'iframes (titled:', titledIframes.length, ', sandbox:', sandboxIframes.length, ')');
    
    let targetValue = null;
    let equation = null;
    let sliderIframe = iframe; // Default to the passed iframe
    
    // NEW: Check for pie chart variant (multiple iframes with one containing SVG)
    if (allIframes.length >= 2) {
        LOG('solveMathInteractiveSlider: checking for pie chart + slider variant');
        
        // Find pie chart iframe (contains SVG with pie sectors)
        const pieChartIframe = findIframeByContent(allIframes, '<svg');
        
        if (pieChartIframe) {
            const pieSrcdoc = pieChartIframe.getAttribute('srcdoc');
            LOG_DEBUG('solveMathInteractiveSlider: found pie chart iframe');
            
            // Extract fraction from pie chart
            const fraction = extractPieChartFraction(pieSrcdoc);
            if (fraction && fraction.value !== null) {
                targetValue = fraction.value;
                equation = `pie chart: ${fraction.numerator}/${fraction.denominator}`;
                LOG('solveMathInteractiveSlider: extracted pie chart fraction:', fraction.numerator + '/' + fraction.denominator, '=', targetValue);
                
                // Find the slider iframe (the one that contains NumberLine)
                for (const ifrm of allIframes) {
                    if (ifrm !== pieChartIframe) {
                        const srcdoc = ifrm.getAttribute('srcdoc');
                        if (srcdoc && srcdoc.includes('NumberLine')) {
                            sliderIframe = ifrm;
                            LOG_DEBUG('solveMathInteractiveSlider: found NumberLine slider iframe');
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // If pie chart method didn't work, fall back to equation-based methods
    if (targetValue === null) {
        // Method 1: Look for equation with duoblank in annotation (outside iframe)
        const annotations = challengeContainer.querySelectorAll('annotation');
        
        for (const annotation of annotations) {
            const text = annotation.textContent;
            LOG_DEBUG('solveMathInteractiveSlider: checking annotation', text);
            
            // Check if this is an equation with blank
            if (text && text.includes('\\duoblank')) {
                equation = text;
                targetValue = solveEquationWithBlank(text);
                LOG('solveMathInteractiveSlider: found equation with blank:', text, '-> answer:', targetValue);
                break;
            }
            
            // Check for simple equation like "2+4=?" where we need to evaluate left side
            if (text && text.includes('=') && text.includes('?')) {
                const match = text.match(/(.+)=\s*\?/);
                if (match) {
                    const leftSide = match[1]
                        .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                        .replace(/\s+/g, '');
                    targetValue = evaluateMathExpression(leftSide);
                    equation = text;
                    LOG('solveMathInteractiveSlider: found equation with ?:', text, '-> answer:', targetValue);
                    break;
                }
            }
        }
    }
    
    // Method 2: Look for question text that contains an expression
    if (targetValue === null) {
        const questionText = challengeContainer.querySelector('h1, [data-test="challenge-header"]');
        if (questionText) {
            const text = questionText.textContent;
            LOG_DEBUG('solveMathInteractiveSlider: question text:', text);
            
            // Try to extract math from question
            const mathMatch = text.match(/(\d+\s*[+\-*/×÷]\s*\d+)/);
            if (mathMatch) {
                targetValue = evaluateMathExpression(mathMatch[1]);
                equation = mathMatch[1];
                LOG('solveMathInteractiveSlider: found expression in header:', mathMatch[1], '-> answer:', targetValue);
            }
        }
    }
    
    // Method 3: Look for any visible math expression on the page
    if (targetValue === null) {
        const katexElements = challengeContainer.querySelectorAll('.katex');
        for (const katex of katexElements) {
            const value = extractKatexValue(katex);
            LOG_DEBUG('solveMathInteractiveSlider: checking katex element:', value);
            
            // If it's a simple expression, try to evaluate it
            if (value && /^[\d+\-*/×÷().]+$/.test(value.replace(/\s/g, '')) && 
                (value.includes('+') || value.includes('-') || value.includes('*') || value.includes('/'))) {
                targetValue = evaluateMathExpression(value);
                equation = value;
                LOG('solveMathInteractiveSlider: found expression in katex:', value, '-> answer:', targetValue);
                break;
            }
        }
    }
    
    if (targetValue === null) {
        LOG_ERROR('solveMathInteractiveSlider: could not determine target value');
        // Log what we found on the page for debugging
        LOG_DEBUG('solveMathInteractiveSlider: container HTML preview:', challengeContainer.innerHTML.substring(0, 500));
        return null;
    }
    
    LOG('solveMathInteractiveSlider: target value =', targetValue);
    
    // Use sliderIframe instead of iframe for the rest of the function
    iframe = sliderIframe;
    
    // Send the value to the iframe via multiple methods
    let success = false;
    
    try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow?.document;
        
        LOG_DEBUG('solveMathInteractiveSlider: iframeWindow =', !!iframeWindow, ', iframeDoc =', !!iframeDoc);
        
        // Method 1: Try to set value via getOutputVariables() - this returns a reference to OUTPUT_VARS
        if (iframeWindow) {
            try {
                // PRIMARY METHOD: getOutputVariables() returns reference to OUTPUT_VARS object
                // We can modify it directly since it's a reference!
                if (typeof iframeWindow.getOutputVariables === 'function') {
                    const vars = iframeWindow.getOutputVariables();
                    LOG_DEBUG('solveMathInteractiveSlider: getOutputVariables() before =', JSON.stringify(vars));
                    
                    if (vars && typeof vars === 'object') {
                        vars.value = targetValue;
                        LOG('solveMathInteractiveSlider: set vars.value =', targetValue);
                        
                        // Verify the change
                        const varsAfter = iframeWindow.getOutputVariables();
                        LOG_DEBUG('solveMathInteractiveSlider: getOutputVariables() after =', JSON.stringify(varsAfter));
                        
                        if (varsAfter && varsAfter.value === targetValue) {
                            success = true;
                            LOG('solveMathInteractiveSlider: VALUE SET SUCCESSFULLY via getOutputVariables()');
                        }
                    }
                }
                
                // Fallback: Try OUTPUT_VARS directly on window
                if (!success && iframeWindow.OUTPUT_VARS !== undefined) {
                    iframeWindow.OUTPUT_VARS.value = targetValue;
                    LOG('solveMathInteractiveSlider: set OUTPUT_VARS.value =', targetValue);
                    success = true;
                }
                
                // Trigger the callback to send value to Duolingo
                if (typeof iframeWindow.postOutputVariables === 'function') {
                    iframeWindow.postOutputVariables();
                    LOG('solveMathInteractiveSlider: called postOutputVariables()');
                }
                
                // Try to trigger first interaction handler (this sends the value to parent)
                if (iframeWindow.duo && typeof iframeWindow.duo.onFirstInteraction === 'function') {
                    iframeWindow.duo.onFirstInteraction();
                    LOG('solveMathInteractiveSlider: called duo.onFirstInteraction()');
                }
                
                // Try to trigger dynamic interaction handler
                if (iframeWindow.duoDynamic && typeof iframeWindow.duoDynamic.onInteraction === 'function') {
                    iframeWindow.duoDynamic.onInteraction();
                    LOG('solveMathInteractiveSlider: called duoDynamic.onInteraction()');
                }
                
                // NEW: Try to access NumberLine component's slider instance
                // NumberLine stores itself in window.mathDiagram and has a slider property
                if (iframeWindow.mathDiagram) {
                    LOG_DEBUG('solveMathInteractiveSlider: found window.mathDiagram');
                    
                    // Try to access slider instance and set value
                    const numberLine = iframeWindow.mathDiagram;
                    
                    // Check for various methods to set slider value
                    if (numberLine.sliderInstance && typeof numberLine.sliderInstance.setValue === 'function') {
                        numberLine.sliderInstance.setValue(targetValue);
                        LOG('solveMathInteractiveSlider: called sliderInstance.setValue(', targetValue, ')');
                        success = true;
                    } else if (numberLine.slider && typeof numberLine.slider.setValue === 'function') {
                        numberLine.slider.setValue(targetValue);
                        LOG('solveMathInteractiveSlider: called slider.setValue(', targetValue, ')');
                        success = true;
                    } else if (typeof numberLine.setValue === 'function') {
                        numberLine.setValue(targetValue);
                        LOG('solveMathInteractiveSlider: called numberLine.setValue(', targetValue, ')');
                        success = true;
                    } else if (typeof numberLine.setSliderValue === 'function') {
                        numberLine.setSliderValue(targetValue);
                        LOG('solveMathInteractiveSlider: called setSliderValue(', targetValue, ')');
                        success = true;
                    }
                    
                    // Try to trigger the callback manually if setValue didn't work
                    if (numberLine.slider && numberLine.slider.valueToCallBack) {
                        const callbacks = numberLine.slider.valueToCallBack;
                        // Find the callback and call it with our value
                        for (const key in callbacks) {
                            if (typeof callbacks[key] === 'function') {
                                callbacks[key](targetValue);
                                LOG('solveMathInteractiveSlider: triggered valueToCallBack with', targetValue);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                LOG_DEBUG('solveMathInteractiveSlider: direct access error:', e.message);
            }
        }
        
        // Method 2: Try to interact with the slider element in iframe
        if (iframeDoc) {
            try {
                LOG_DEBUG('solveMathInteractiveSlider: searching for slider in iframe');
                
                // Look for various slider implementations
                const slider = iframeDoc.querySelector('input[type="range"]') || 
                               iframeDoc.querySelector('[role="slider"]') ||
                               iframeDoc.querySelector('.slider') ||
                               iframeDoc.querySelector('[draggable="true"]') ||
                               iframeDoc.querySelector('circle') ||  // SVG slider handle
                               iframeDoc.querySelector('.handle');
                
                if (slider) {
                    LOG('solveMathInteractiveSlider: found slider element:', slider.tagName);
                    
                    // For range input
                    if (slider.type === 'range') {
                        slider.value = targetValue;
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                        slider.dispatchEvent(new Event('change', { bubbles: true }));
                        success = true;
                    }
                    
                    // For SVG/custom slider - try mouse events
                    // This simulates clicking at the right position
                    const rect = slider.getBoundingClientRect();
                    if (rect.width > 0) {
                        // Calculate click position based on value
                        // This is approximate - may need adjustment
                        const clickX = rect.left + (rect.width * targetValue / 10);
                        const clickY = rect.top + rect.height / 2;
                        
                        const mouseDown = new MouseEvent('mousedown', { bubbles: true, clientX: clickX, clientY: clickY });
                        const mouseUp = new MouseEvent('mouseup', { bubbles: true, clientX: clickX, clientY: clickY });
                        const click = new MouseEvent('click', { bubbles: true, clientX: clickX, clientY: clickY });
                        
                        slider.dispatchEvent(mouseDown);
                        slider.dispatchEvent(mouseUp);
                        slider.dispatchEvent(click);
                        LOG('solveMathInteractiveSlider: dispatched mouse events at x=', clickX);
                    }
                } else {
                    LOG_DEBUG('solveMathInteractiveSlider: no slider element found');
                    // Log available elements for debugging
                    const allElements = iframeDoc.body?.children;
                    if (allElements) {
                        LOG_DEBUG('solveMathInteractiveSlider: iframe body has', allElements.length, 'children');
                    }
                }
            } catch (e) {
                LOG_DEBUG('solveMathInteractiveSlider: slider manipulation error:', e.message);
            }
        }
        
        // Method 3: Post message to iframe (fallback)
        if (iframeWindow) {
            iframeWindow.postMessage({
                type: 'outputVariables',
                payload: { value: targetValue }
            }, '*');
            LOG_DEBUG('solveMathInteractiveSlider: sent postMessage with outputVariables');
        }
        
    } catch (e) {
        LOG_ERROR('solveMathInteractiveSlider: error communicating with iframe:', e.message);
    }
    
    if (success) {
        LOG('solveMathInteractiveSlider: SUCCESS - value set to', targetValue);
    } else {
        LOG_WARN('solveMathInteractiveSlider: value may not have been set correctly');
    }
    
    return {
        type: 'interactiveSlider',
        equation: equation,
        answer: targetValue,
        success: success
    };
}

/**
 * Solve "Show this another way" with fraction + interactive spinner
 * The page shows a fraction (e.g., 2/4) and you need to select that many segments on a spinner
 * e.g., if fraction is 2/4, select 2 segments out of 4 total
 * Also handles expressions like \frac{1}{5}+\frac{2}{5}=\duoblank{1} -> select 3 out of 5
 * Also handles inequalities like \frac{5}{4}>\duoblank{1} -> select answer that satisfies inequality
 */
function solveMathInteractiveSpinner(challengeContainer, iframe) {
    LOG('solveMathInteractiveSpinner: starting');
    
    // Extract the fraction from the equation container (KaTeX annotation)
    let numerator = null;
    let denominator = null;
    let equation = null;
    
    // First, get the spinner segment count from iframe (we need this for denominator)
    const srcdoc = iframe.getAttribute('srcdoc');
    let spinnerSegments = null;
    
    const segmentsMatch = srcdoc.match(/segments:\s*(\d+)/);
    if (segmentsMatch) {
        spinnerSegments = parseInt(segmentsMatch[1], 10);
        LOG_DEBUG('solveMathInteractiveSpinner: spinner has', spinnerSegments, 'segments');
    }
    
    // NEW: Check for inequality with blank FIRST (e.g., \frac{5}{4}>\duoblank{1})
    const annotations = challengeContainer.querySelectorAll('annotation');
    for (const annotation of annotations) {
        const text = annotation.textContent;
        
        // Check if this is an inequality with a blank
        const hasInequality = text.includes('>') || text.includes('<') || 
                             text.includes('\\gt') || text.includes('\\lt') ||
                             text.includes('\\ge') || text.includes('\\le') ||
                             text.includes('\\geq') || text.includes('\\leq');
        const hasBlank = text.includes('\\duoblank');
        
        if (hasInequality && hasBlank && spinnerSegments) {
            LOG_DEBUG('solveMathInteractiveSpinner: detected INEQUALITY with blank:', text);
            
            // Clean LaTeX wrappers
            let cleaned = text;
            while (cleaned.includes('\\mathbf{')) {
                cleaned = extractLatexContent(cleaned, '\\mathbf');
            }
            while (cleaned.includes('\\textbf{')) {
                cleaned = extractLatexContent(cleaned, '\\textbf');
            }
            
            // Detect the comparison operator and normalize
            let operator = null;
            let operatorStr = null;
            
            if (cleaned.includes('>=') || cleaned.includes('\\ge') || cleaned.includes('\\geq')) {
                operator = '>=';
                operatorStr = cleaned.includes('>=') ? '>=' : (cleaned.includes('\\geq') ? '\\geq' : '\\ge');
            } else if (cleaned.includes('<=') || cleaned.includes('\\le') || cleaned.includes('\\leq')) {
                operator = '<=';
                operatorStr = cleaned.includes('<=') ? '<=' : (cleaned.includes('\\leq') ? '\\leq' : '\\le');
            } else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
                operator = '>';
                operatorStr = cleaned.includes('>') ? '>' : '\\gt';
            } else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
                operator = '<';
                operatorStr = cleaned.includes('<') ? '<' : '\\lt';
            }
            
            if (operator) {
                LOG_DEBUG('solveMathInteractiveSpinner: inequality operator =', operator);
                
                // Split by the operator
                const parts = cleaned.split(operatorStr);
                if (parts.length === 2) {
                    let leftPart = parts[0].trim();
                    let rightPart = parts[1].trim();
                    
                    // Determine which side has the blank
                    const leftHasBlank = leftPart.includes('\\duoblank');
                    const rightHasBlank = rightPart.includes('\\duoblank');
                    
                    // Get the known value from the non-blank side
                    const knownPart = leftHasBlank ? rightPart : leftPart;
                    
                    // Parse the known fraction
                    let knownValue = null;
                    const fracMatch = knownPart.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                    if (fracMatch) {
                        knownValue = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
                    } else {
                        // Try simple number
                        const numMatch = knownPart.match(/(\d+)/);
                        if (numMatch) {
                            knownValue = parseFloat(numMatch[1]);
                        }
                    }
                    
                    if (knownValue !== null) {
                        LOG_DEBUG('solveMathInteractiveSpinner: known value =', knownValue);
                        
                        // Calculate valid answer based on inequality direction and blank position
                        // The answer must be representable on the spinner (0 to spinnerSegments)
                        let targetNumerator = null;
                        
                        if (leftHasBlank) {
                            // Blank is on LEFT: "? op value"
                            // For "? > value": need something GREATER
                            // For "? < value": need something LESS
                            if (operator === '>' || operator === '>=') {
                                // Find smallest valid numerator where num/spinnerSegments > knownValue
                                for (let n = 0; n <= spinnerSegments; n++) {
                                    const testValue = n / spinnerSegments;
                                    if (operator === '>=' ? testValue >= knownValue : testValue > knownValue) {
                                        targetNumerator = n;
                                        break;
                                    }
                                }
                            } else {
                                // Find largest valid numerator where num/spinnerSegments < knownValue
                                for (let n = spinnerSegments; n >= 0; n--) {
                                    const testValue = n / spinnerSegments;
                                    if (operator === '<=' ? testValue <= knownValue : testValue < knownValue) {
                                        targetNumerator = n;
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Blank is on RIGHT: "value op ?"
                            // For "value > ?": need something LESS
                            // For "value < ?": need something GREATER
                            if (operator === '>' || operator === '>=') {
                                // Find largest valid numerator where num/spinnerSegments < knownValue
                                for (let n = spinnerSegments; n >= 0; n--) {
                                    const testValue = n / spinnerSegments;
                                    if (operator === '>=' ? testValue <= knownValue : testValue < knownValue) {
                                        targetNumerator = n;
                                        break;
                                    }
                                }
                            } else {
                                // Find smallest valid numerator where num/spinnerSegments > knownValue
                                for (let n = 0; n <= spinnerSegments; n++) {
                                    const testValue = n / spinnerSegments;
                                    if (operator === '<=' ? testValue >= knownValue : testValue > knownValue) {
                                        targetNumerator = n;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (targetNumerator !== null) {
                            numerator = targetNumerator;
                            denominator = spinnerSegments;
                            equation = text;
                            LOG('solveMathInteractiveSpinner: inequality solved, select', numerator, 
                                'segments (', numerator + '/' + denominator, '=' + (numerator/denominator) + 
                                ', satisfies', knownValue, operator, '?)');
                            break;
                        } else {
                            LOG_DEBUG('solveMathInteractiveSpinner: no valid numerator found for inequality');
                        }
                    }
                }
            }
        }
    }
    
    // Method 1: Look for annotation with \frac (only if inequality wasn't handled)
    if (numerator === null) {
        for (const annotation of annotations) {
            const text = annotation.textContent;
            LOG_DEBUG('solveMathInteractiveSpinner: checking annotation', text);
            
            // Check if this is an equation with = (like \frac{1}{5}+\frac{2}{5}=\duoblank{1})
            // If so, we need to evaluate the left side
            if (text.includes('=') && text.includes('\\frac')) {
                LOG_DEBUG('solveMathInteractiveSpinner: detected equation with fractions');
                
                // IMPORTANT: Strip outer LaTeX wrappers from FULL text BEFORE splitting
                // This prevents cutting off closing braces (e.g., \mathbf{\frac{1}{5}+\frac{1}{5}=...})
                let cleanText = text;
                while (cleanText.includes('\\mathbf{')) {
                    cleanText = extractLatexContent(cleanText, '\\mathbf');
                }
                while (cleanText.includes('\\textbf{')) {
                    cleanText = extractLatexContent(cleanText, '\\textbf');
                }
                LOG_DEBUG('solveMathInteractiveSpinner: after wrapper cleanup:', cleanText);
                
                // Extract left side of equation (before = or =\duoblank)
                let leftSide = cleanText.split(/=(?:\\duoblank\{[^}]*\})?/)[0];
                LOG_DEBUG('solveMathInteractiveSpinner: left side of equation:', leftSide);
                
                // Convert all \frac{a}{b} to (a/b) for evaluation
                while (leftSide.includes('\\frac{')) {
                    const fracMatch = leftSide.match(/\\frac\{/);
                    if (!fracMatch) break;
                    
                    const fracStart = fracMatch.index;
                    // Find the numerator
                    let numStart = fracStart + 6; // after \frac{
                    let depth = 1;
                    let numEnd = numStart;
                    while (depth > 0 && numEnd < leftSide.length) {
                        if (leftSide[numEnd] === '{') depth++;
                        else if (leftSide[numEnd] === '}') depth--;
                        numEnd++;
                    }
                    const num = leftSide.substring(numStart, numEnd - 1);
                    
                    // Find the denominator
                    let denomStart = numEnd + 1; // after }{
                    depth = 1;
                    let denomEnd = denomStart;
                    while (depth > 0 && denomEnd < leftSide.length) {
                        if (leftSide[denomEnd] === '{') depth++;
                        else if (leftSide[denomEnd] === '}') depth--;
                        denomEnd++;
                    }
                    const denom = leftSide.substring(denomStart, denomEnd - 1);
                    
                    leftSide = leftSide.substring(0, fracStart) + '(' + num + '/' + denom + ')' + leftSide.substring(denomEnd);
                }
                
                // Clean up for evaluation
                leftSide = leftSide.replace(/\s+/g, '');
                LOG_DEBUG('solveMathInteractiveSpinner: converted expression:', leftSide);
                
                // Evaluate the expression
                const result = evaluateMathExpression(leftSide);
                LOG_DEBUG('solveMathInteractiveSpinner: evaluated result:', result);
                
                if (result !== null && spinnerSegments) {
                    // Calculate numerator from result and spinner segments
                    // result = numerator / spinnerSegments
                    // numerator = result * spinnerSegments
                    const calculatedNumerator = Math.round(result * spinnerSegments);
                    
                    // Verify it's a valid fraction
                    if (calculatedNumerator >= 0 && calculatedNumerator <= spinnerSegments) {
                        numerator = calculatedNumerator;
                        denominator = spinnerSegments;
                        equation = text;
                        LOG('solveMathInteractiveSpinner: evaluated expression to', numerator + '/' + denominator);
                        break;
                    }
                }
            }
            
            // Parse \frac{a}{b} pattern (possibly nested in \mathbf{}) - simple fraction case
            // First, extract content from \mathbf{} if present
            let cleanedText = text;
            
            // Handle \mathbf{} wrapper
            while (cleanedText.includes('\\mathbf{')) {
                cleanedText = extractLatexContent(cleanedText, '\\mathbf');
            }
            while (cleanedText.includes('\\textbf{')) {
                cleanedText = extractLatexContent(cleanedText, '\\textbf');
            }
            
            // Now look for single \frac{numerator}{denominator} (only if we haven't found result yet)
            if (numerator === null) {
                const fracMatch = cleanedText.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                if (fracMatch) {
                    numerator = parseInt(fracMatch[1], 10);
                    denominator = parseInt(fracMatch[2], 10);
                    equation = text;
                    LOG('solveMathInteractiveSpinner: found simple fraction', numerator + '/' + denominator, 'from annotation');
                    break;
                }
                
                // Also try simple fraction format like "2/4" (just in case)
                const simpleFracMatch = cleanedText.match(/(\d+)\s*\/\s*(\d+)/);
                if (simpleFracMatch) {
                    numerator = parseInt(simpleFracMatch[1], 10);
                    denominator = parseInt(simpleFracMatch[2], 10);
                    equation = text;
                    LOG('solveMathInteractiveSpinner: found simple fraction', numerator + '/' + denominator);
                    break;
                }
            }
        }
    }
    
    // Method 2: Look in katex elements
    if (numerator === null) {
        const katexElements = challengeContainer.querySelectorAll('.katex');
        for (const katex of katexElements) {
            const value = extractKatexValue(katex);
            LOG_DEBUG('solveMathInteractiveSpinner: checking katex element:', value);
            
            // Check if this is an expression that needs evaluation
            if (value && value.includes('+') && value.includes('/')) {
                // Try to evaluate as expression
                const result = evaluateMathExpression(value.replace(/=.*$/, '')); // Remove = and everything after
                if (result !== null && spinnerSegments) {
                    const calculatedNumerator = Math.round(result * spinnerSegments);
                    if (calculatedNumerator >= 0 && calculatedNumerator <= spinnerSegments) {
                        numerator = calculatedNumerator;
                        denominator = spinnerSegments;
                        equation = value;
                        LOG('solveMathInteractiveSpinner: evaluated katex expression to', numerator + '/' + denominator);
                        break;
                    }
                }
            }
            
            // Try to parse as fraction
            const fracMatch = value.match(/\((\d+)\/(\d+)\)/);
            if (fracMatch) {
                numerator = parseInt(fracMatch[1], 10);
                denominator = parseInt(fracMatch[2], 10);
                equation = value;
                LOG('solveMathInteractiveSpinner: found fraction from katex:', value);
                break;
            }
        }
    }
    
    if (numerator === null || denominator === null) {
        LOG_ERROR('solveMathInteractiveSpinner: could not extract fraction from challenge');
        LOG_DEBUG('solveMathInteractiveSpinner: container HTML preview:', challengeContainer.innerHTML.substring(0, 500));
        return null;
    }
    
    LOG('solveMathInteractiveSpinner: target = select', numerator, 'segments out of', denominator);
    
    // IMPORTANT: If spinner segments don't match the fraction denominator,
    // we need to recalculate the numerator based on the fractional value
    // e.g., fraction 4/8 with spinner having 2 segments: 4/8 = 0.5, so select 0.5 * 2 = 1 segment
    if (spinnerSegments && spinnerSegments !== denominator) {
        LOG_DEBUG('solveMathInteractiveSpinner: spinner segments (', spinnerSegments, 
                 ') does not match fraction denominator (', denominator, '), recalculating...');
        
        // Calculate the fraction value and convert to spinner segments
        const fractionValue = numerator / denominator;
        const adjustedNumerator = Math.round(fractionValue * spinnerSegments);
        
        LOG('solveMathInteractiveSpinner: adjusted from', numerator + '/' + denominator, 
            '(', fractionValue, ') to', adjustedNumerator + '/' + spinnerSegments);
        
        numerator = adjustedNumerator;
        denominator = spinnerSegments;
    }
    
    // Final validation
    if (numerator < 0 || numerator > spinnerSegments) {
        LOG_ERROR('solveMathInteractiveSpinner: invalid numerator', numerator, 'for', spinnerSegments, 'segments');
        return null;
    }
    
    // Select the correct number of segments
    let success = false;
    
    try {
        const iframeWindow = iframe.contentWindow;
        LOG_DEBUG('solveMathInteractiveSpinner: iframeWindow =', !!iframeWindow);
        
        if (iframeWindow) {
            // Method 1: Directly set OUTPUT_VARIABLES.selected via getOutputVariables()
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                LOG_DEBUG('solveMathInteractiveSpinner: getOutputVariables() before =', JSON.stringify(vars));
                
                if (vars && 'selected' in vars) {
                    // Create array of selected segment indices [0, 1, 2, ...] for numerator segments
                    const selectedIndices = [];
                    for (let i = 0; i < numerator; i++) {
                        selectedIndices.push(i);
                    }
                    
                    vars.selected = selectedIndices;
                    LOG('solveMathInteractiveSpinner: set vars.selected =', JSON.stringify(selectedIndices));
                    
                    // Verify the change
                    const varsAfter = iframeWindow.getOutputVariables();
                    LOG_DEBUG('solveMathInteractiveSpinner: getOutputVariables() after =', JSON.stringify(varsAfter));
                    
                    if (varsAfter && Array.isArray(varsAfter.selected) && 
                        varsAfter.selected.length === numerator) {
                        success = true;
                        LOG('solveMathInteractiveSpinner: VALUE SET SUCCESSFULLY via getOutputVariables()');
                    }
                }
            }
            
            // Method 2: Try OUTPUT_VARIABLES directly
            if (!success && iframeWindow.OUTPUT_VARIABLES !== undefined) {
                const selectedIndices = [];
                for (let i = 0; i < numerator; i++) {
                    selectedIndices.push(i);
                }
                iframeWindow.OUTPUT_VARIABLES.selected = selectedIndices;
                LOG('solveMathInteractiveSpinner: set OUTPUT_VARIABLES.selected =', JSON.stringify(selectedIndices));
                success = true;
            }
            
            // Trigger the callback to send value to Duolingo
            if (typeof iframeWindow.postOutputVariables === 'function') {
                iframeWindow.postOutputVariables();
                LOG('solveMathInteractiveSpinner: called postOutputVariables()');
            }
            
            // Try to trigger interaction handlers
            if (iframeWindow.duo && typeof iframeWindow.duo.onFirstInteraction === 'function') {
                iframeWindow.duo.onFirstInteraction();
                LOG('solveMathInteractiveSpinner: called duo.onFirstInteraction()');
            }
            
            if (iframeWindow.duoDynamic && typeof iframeWindow.duoDynamic.onInteraction === 'function') {
                iframeWindow.duoDynamic.onInteraction();
                LOG('solveMathInteractiveSpinner: called duoDynamic.onInteraction()');
            }
        }
    } catch (e) {
        LOG_ERROR('solveMathInteractiveSpinner: error accessing iframe:', e.message);
    }
    
    // Method 3: Send via postMessage
    if (!success) {
        LOG('solveMathInteractiveSpinner: trying postMessage method');
        
        const selectedIndices = [];
        for (let i = 0; i < numerator; i++) {
            selectedIndices.push(i);
        }
        
        try {
            iframe.contentWindow.postMessage({
                type: 'setOutputVariables',
                payload: { selected: selectedIndices }
            }, '*');
            LOG('solveMathInteractiveSpinner: sent postMessage with selected =', JSON.stringify(selectedIndices));
            success = true; // Assume success for postMessage
        } catch (e) {
            LOG_ERROR('solveMathInteractiveSpinner: postMessage error:', e.message);
        }
    }
    
    LOG('solveMathInteractiveSpinner: completed, success =', success);
    
    return {
        type: 'interactiveSpinner',
        equation: equation,
        numerator: numerator,
        denominator: denominator,
        selectedSegments: numerator,
        success: success
    };
}

/**
 * Solve Factor Tree challenge
 * The challenge has a tree where some nodes are blank (value: null)
 * User must place the correct tokens (numbers) into the blanks
 * The tree represents multiplication: parent = left * right
 * 
 * OUTPUT_VARS.tokenTreeIndices is an array where:
 * - Each element corresponds to each original token
 * - Value is the 1-based tree index where that token is placed
 * - 0 means the token is not used
 * 
 * Tree indices use level-order (BFS) numbering:
 * - Root = 1
 * - Left child of node i = 2*i
 * - Right child of node i = 2*i + 1
 */
function solveFactorTree(challengeContainer, iframe) {
    LOG('solveFactorTree: starting');
    
    const srcdoc = iframe.getAttribute('srcdoc');
    if (!srcdoc) {
        LOG_ERROR('solveFactorTree: no srcdoc found');
        return null;
    }
    
    // Parse originalTree from srcdoc
    const treeMatch = srcdoc.match(/const\s+originalTree\s*=\s*(\{[\s\S]*?\});/);
    if (!treeMatch) {
        LOG_ERROR('solveFactorTree: could not find originalTree in srcdoc');
        return null;
    }
    
    let originalTree;
    try {
        originalTree = JSON.parse(treeMatch[1]);
        LOG_DEBUG('solveFactorTree: parsed originalTree =', JSON.stringify(originalTree));
    } catch (e) {
        LOG_ERROR('solveFactorTree: failed to parse originalTree:', e.message);
        return null;
    }
    
    // Parse originalTokens from srcdoc
    // Format: const originalTokens = [renderNumber(100),renderNumber(120),renderNumber(50)];
    const tokensMatch = srcdoc.match(/const\s+originalTokens\s*=\s*\[([\s\S]*?)\];/);
    if (!tokensMatch) {
        LOG_ERROR('solveFactorTree: could not find originalTokens in srcdoc');
        return null;
    }
    
    // Extract numbers from renderNumber() calls
    const tokenContent = tokensMatch[1];
    const originalTokens = [];
    const numberMatches = tokenContent.matchAll(/renderNumber\((\d+)\)/g);
    for (const match of numberMatches) {
        originalTokens.push(parseInt(match[1], 10));
    }
    
    LOG_DEBUG('solveFactorTree: parsed originalTokens =', JSON.stringify(originalTokens));
    
    if (originalTokens.length === 0) {
        LOG_ERROR('solveFactorTree: no tokens found');
        return null;
    }
    
    // Find all blank positions in tree (nodes where value is null)
    // And calculate expected values based on multiplication of children
    const blanks = []; // {treeIndex, expectedValue}
    
    function traverseTree(node, treeIndex) {
        if (!node) return;
        
        // If this node is a blank (value is null), calculate expected value
        if (node.value === null) {
            // For a factor tree: parent = left * right
            let expectedValue = null;
            
            // Get values of children
            const leftValue = node.left?.value !== null ? parseFloat(node.left.value) : null;
            const rightValue = node.right?.value !== null ? parseFloat(node.right.value) : null;
            
            if (leftValue !== null && rightValue !== null) {
                expectedValue = leftValue * rightValue;
                LOG_DEBUG('solveFactorTree: blank at index', treeIndex, 'expected value =', leftValue, '*', rightValue, '=', expectedValue);
            } else {
                LOG_DEBUG('solveFactorTree: blank at index', treeIndex, 'has incomplete children, leftValue=', leftValue, 'rightValue=', rightValue);
            }
            
            blanks.push({
                treeIndex: treeIndex,
                expectedValue: expectedValue
            });
        }
        
        // Recursively traverse children
        // Left child index = 2 * parentIndex (in 1-based: 2*i)
        // Right child index = 2 * parentIndex + 1 (in 1-based: 2*i + 1)
        if (node.left) {
            traverseTree(node.left, treeIndex * 2);
        }
        if (node.right) {
            traverseTree(node.right, treeIndex * 2 + 1);
        }
    }
    
    // Start traversal from root at index 1
    traverseTree(originalTree, 1);
    
    LOG_DEBUG('solveFactorTree: found', blanks.length, 'blank(s):', JSON.stringify(blanks));
    
    // Match tokens to blanks
    // tokenTreeIndices[i] = tree index where token i should go (1-based), or 0 if not used
    const tokenTreeIndices = new Array(originalTokens.length).fill(0);
    const usedBlanks = new Set();
    
    for (let i = 0; i < originalTokens.length; i++) {
        const token = originalTokens[i];
        
        // Find a blank that matches this token's value
        for (const blank of blanks) {
            if (blank.expectedValue === token && !usedBlanks.has(blank.treeIndex)) {
                tokenTreeIndices[i] = blank.treeIndex;
                usedBlanks.add(blank.treeIndex);
                LOG_DEBUG('solveFactorTree: token', token, '(index', i, ') -> tree position', blank.treeIndex);
                break;
            }
        }
    }
    
    LOG('solveFactorTree: solution tokenTreeIndices =', JSON.stringify(tokenTreeIndices));
    
    // Set the solution in the iframe
    let success = false;
    try {
        const iframeWindow = iframe.contentWindow;
        
        if (iframeWindow) {
            // Try getOutputVariables() first
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                if (vars && 'tokenTreeIndices' in vars) {
                    vars.tokenTreeIndices = tokenTreeIndices;
                    LOG('solveFactorTree: set vars.tokenTreeIndices');
                    success = true;
                }
            }
            
            // Fallback to OUTPUT_VARS directly
            if (!success && iframeWindow.OUTPUT_VARS) {
                iframeWindow.OUTPUT_VARS.tokenTreeIndices = tokenTreeIndices;
                LOG('solveFactorTree: set OUTPUT_VARS.tokenTreeIndices');
                success = true;
            }
            
            // Trigger callbacks
            if (typeof iframeWindow.postOutputVariables === 'function') {
                iframeWindow.postOutputVariables();
                LOG_DEBUG('solveFactorTree: called postOutputVariables()');
            }
            
            if (iframeWindow.duo && typeof iframeWindow.duo.onFirstInteraction === 'function') {
                iframeWindow.duo.onFirstInteraction();
                LOG_DEBUG('solveFactorTree: called duo.onFirstInteraction()');
            }
            
            if (iframeWindow.duoDynamic && typeof iframeWindow.duoDynamic.onInteraction === 'function') {
                iframeWindow.duoDynamic.onInteraction();
                LOG_DEBUG('solveFactorTree: called duoDynamic.onInteraction()');
            }
        }
    } catch (e) {
        LOG_ERROR('solveFactorTree: error setting solution:', e.message);
    }
    
    // Also try postMessage as fallback
    try {
        iframe.contentWindow.postMessage({
            type: 'outputVariables',
            payload: { tokenTreeIndices: tokenTreeIndices }
        }, '*');
        LOG_DEBUG('solveFactorTree: sent postMessage with outputVariables');
    } catch (e) {
        LOG_DEBUG('solveFactorTree: postMessage failed:', e.message);
    }
    
    LOG('solveFactorTree: completed, success =', success);
    
    return {
        type: 'factorTree',
        originalTree: originalTree,
        originalTokens: originalTokens,
        blanks: blanks,
        tokenTreeIndices: tokenTreeIndices,
        success: success
    };
}

/**
 * Solve "Follow the pattern" type - table with expressions
 */
function solveMathPatternTable(challengeContainer, patternTable) {
    LOG('solveMathPatternTable: starting');
    
    // Find all table cells - cells with class ihM27
    const cells = patternTable.querySelectorAll('.ihM27');
    LOG('solveMathPatternTable: found', cells.length, 'cells');
    
    // Parse cells into rows (2 cells per row: expression, result)
    // Cells alternate: expression (class _15lZ-), result (class pCN63)
    const rows = [];
    let questionExpression = null;
    
    for (let i = 0; i < cells.length; i += 2) {
        const exprCell = cells[i];
        const resultCell = cells[i + 1];
        
        if (!exprCell || !resultCell) {
            LOG_WARN('solveMathPatternTable: incomplete row at index', i);
            continue;
        }
        
        const exprValue = extractKatexValue(exprCell);
        const resultValue = extractKatexValue(resultCell);
        
        LOG('solveMathPatternTable: row', i/2, '- expression:', exprValue, '- result:', resultValue);
        
        // Check if this is the question row (result is "?")
        if (resultValue === '?' || resultValue === '?') {
            questionExpression = exprValue;
            LOG('solveMathPatternTable: found question row, expression:', questionExpression);
        } else {
            rows.push({
                expression: exprValue,
                result: resultValue
            });
        }
    }
    
    LOG('solveMathPatternTable: parsed', rows.length, 'complete rows');
    LOG('solveMathPatternTable: question expression:', questionExpression);
    
    if (!questionExpression) {
        LOG_ERROR('solveMathPatternTable: could not find question expression');
        return null;
    }
    
    // Calculate the answer
    const answer = evaluateMathExpression(questionExpression);
    LOG('solveMathPatternTable: calculated answer:', answer);
    
    if (answer === null) {
        LOG_ERROR('solveMathPatternTable: could not evaluate expression');
        return null;
    }
    
    // Find the correct choice
    const choices = challengeContainer.querySelectorAll(CHALLENGE_CHOICE);
    LOG('solveMathPatternTable: found', choices.length, 'choices');
    
    let correctChoiceIndex = -1;
    
    for (let i = 0; i < choices.length; i++) {
        const choiceValue = extractKatexValue(choices[i]);
        LOG('solveMathPatternTable: choice', i, '- value:', choiceValue);
        
        // Compare as numbers
        const choiceNum = parseFloat(choiceValue);
        if (!isNaN(choiceNum) && choiceNum === answer) {
            correctChoiceIndex = i;
            LOG('solveMathPatternTable: found matching choice at index', i);
            break;
        }
    }
    
    if (correctChoiceIndex === -1) {
        LOG_ERROR('solveMathPatternTable: could not find matching choice for answer', answer);
        return null;
    }
    
    // Click the correct choice
    LOG('solveMathPatternTable: clicking choice', correctChoiceIndex);
    choices[correctChoiceIndex].dispatchEvent(clickEvent);
    
    return {
        type: 'patternTable',
        expression: questionExpression,
        answer: answer,
        choiceIndex: correctChoiceIndex
    };
}
 
const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
});
 
function getChallengeObj(theObject) {
    let result = null;
    if (theObject instanceof Array) {
        for (let i = 0; i < theObject.length; i++) {
            result = getChallengeObj(theObject[i]);
            if (result) {
                break;
            }
        }
    }
    else {
        for (let prop in theObject) {
            if (prop == 'challenge') {
                if (typeof theObject[prop] == 'object') {
                    return theObject;
                }
            }
            if (theObject[prop] instanceof Object || theObject[prop] instanceof Array) {
                result = getChallengeObj(theObject[prop]);
                if (result) {
                    break;
                }
            }
        }
    }
    return result;
}
 
function getChallenge() {
    // const dataTestComponentClassName = 'e4VJZ';
    const dataTestDOM = document.getElementsByClassName(dataTestComponentClassName)[0];
 
    if (!dataTestDOM) {
        document.querySelectorAll(PLAYER_NEXT)[0].dispatchEvent(clickEvent);
        return null;
    } else {
        const dataTestAtrr = Object.keys(dataTestDOM).filter(att => /^__reactProps/g.test(att))[0];
        const childDataTestProps = dataTestDOM[dataTestAtrr];
        const { challenge } = getChallengeObj(childDataTestProps);
        return challenge;
    }
}
 
function pressEnter() {
    document.dispatchEvent(new KeyboardEvent('keydown', { 'keyCode': 13, 'which': 13 }));
}
 
function dynamicInput(element, msg) {
    let input = element;
    let lastValue = input.value;
    input.value = msg;
    let event = new Event('input', { bubbles: true });
    // hack React15
    event.simulated = true;
    // hack React16 内部定义了descriptor拦截value，此处重置状态
    let tracker = input._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    input.dispatchEvent(event);
}
 
function classify() {
    // First, check if this is a mathChallengeBlob (it doesn't have React props structure)
    const mathChallenge = document.querySelector(MATH_CHALLENGE_BLOB);
    if (mathChallenge) {
        LOG('Detected mathChallengeBlob challenge');
        return solveMathChallengeBlob();
    }
    
    const challenge = getChallenge();
    if (!challenge) return;
    LOG(`Challenge type: ${challenge.type}`, challenge);
    
    switch (challenge.type) {
        case MATH_CHALLENGE_BLOB_TYPE: {
            LOG('MATH_CHALLENGE_BLOB detected via React props');
            return solveMathChallengeBlob();
        }
        
        case SELECT_PRONUNCIATION_TYPE:
        case READ_COMPREHENSION_TYPE:
        case LISTEN_COMPREHENSION_TYPE:
        case FORM_TYPE: { // trắc nghiệm 1 đáp án
            const { choices, correctIndex } = challenge;
            LOG('READ_COMPREHENSION LISTEN_COMPREHENSION FORM', { choices, correctIndex });
            document.querySelectorAll(CHALLENGE_CHOICE)[correctIndex].dispatchEvent(clickEvent);
            return { choices, correctIndex };
        }

        case SELECT_TYPE:
        case CHARACTER_SELECT_TYPE: { // trắc nghiệm 1 đáp án
            const { choices, correctIndex } = challenge;
            LOG('SELECT CHARACTER_SELECT', { choices, correctIndex });
            document.querySelectorAll(CHALLENGE_CHOICE_CARD)[correctIndex].dispatchEvent(clickEvent);
            return { choices, correctIndex };
        }

        case CHARACTER_MATCH_TYPE: { // tập hợp các cặp thẻ
            const { pairs } = challenge;
            LOG('CHARACTER_MATCH', { pairs });
            const tokens = document.querySelectorAll(CHALLENGE_TAP_TOKEN);
            pairs.forEach((pair) => {
                for(let i = 0; i < tokens.length; i++) {
                    if(tokens[i].innerText === pair.transliteration || tokens[i].innerText === pair.character) {
                        tokens[i].dispatchEvent(clickEvent);
                    }
                }
            })
            return { pairs };
        }

        case TRANSLATE_TYPE: {
            const { correctTokens, correctSolutions } = challenge;
            LOG('TRANSLATE', { correctTokens });
            if (correctTokens) {
                const tokens = document.querySelectorAll(CHALLENGE_TAP_TOKEN);
                let ignoreTokeIndexes = [];
                for (let correctTokenIndex in correctTokens) {
                    for (let tokenIndex in tokens) {
                        const token = tokens[tokenIndex];
                        if (ignoreTokeIndexes.includes(tokenIndex)) continue;
                        if (token.innerText === correctTokens[correctTokenIndex]) {
                            token.dispatchEvent(clickEvent);
                            ignoreTokeIndexes.push(tokenIndex);
                            LOG(`correctTokenIndex [${correctTokens[correctTokenIndex]}] - tokenIndex [${token.innerText}]`);
                            break;
                        };
                    }
                }
            } else if (correctSolutions) {
                let textInputElement = document.querySelectorAll(CHALLENGE_TRANSLATE_INPUT)[0];
                dynamicInput(textInputElement, correctSolutions[0]);
            }

            return { correctTokens };
        }

        case NAME_TYPE: { // nhập đán án
            const { correctSolutions } = challenge;
            LOG('NAME', { correctSolutions });
            let textInputElement = document.querySelectorAll(CHALLENGE_TEXT_INPUT)[0];
            let correctSolution = correctSolutions[0];
            dynamicInput(textInputElement, correctSolution);
            return { correctSolutions };
        }

        case COMPLETE_REVERSE_TRANSLATION_TYPE: { // điền vào từ còn thiếu
            const { displayTokens } = challenge;
            LOG('COMPLETE_REVERSE_TRANLATION', { displayTokens });
            const { text } = displayTokens.filter(token => token.isBlank)[0];
            let textInputElement = document.querySelectorAll(CHALLENGE_TEXT_INPUT)[0];
            dynamicInput(textInputElement, text);
            return { displayTokens };
        }

        case LISTEN_TAP_TYPE: {
            const { correctTokens } = challenge;
            LOG('LISTEN_TAP', { correctTokens });
            const tokens = document.querySelectorAll(CHALLENGE_TAP_TOKEN);
            for (let wordIndex in correctTokens) {
                tokens.forEach((token) => {
                    if (token.innerText === correctTokens[wordIndex]) {
                        token.dispatchEvent(clickEvent);
                    };
                });
            }
            return { correctTokens };
        }

        case LISTEN_TYPE: { // nghe và điền vào ô input
            const { prompt } = challenge;
            LOG('LISTEN', { prompt });
            let textInputElement = document.querySelectorAll(CHALLENGE_TRANSLATE_INPUT)[0];
            dynamicInput(textInputElement, prompt);
            return { prompt };
        }

        case JUDGE_TYPE: { // trắc nghiệm 1 đáp án
            const { correctIndices } = challenge;
            LOG('JUDGE', { correctIndices });
            document.querySelectorAll(CHALLENGE_JUDGE_TEXT)[correctIndices[0]].dispatchEvent(clickEvent);
            return { correctIndices };
        }

        case DIALOGUE_TYPE:
        case CHARACTER_INTRO_TYPE: { // trắc nghiệm 1 đáp án
            const { choices, correctIndex } = challenge;
            LOG('DIALOGUE CHARACTER_INTRO', { choices, correctIndex });
            document.querySelectorAll(CHALLENGE_JUDGE_TEXT)[correctIndex].dispatchEvent(clickEvent);
            return { choices, correctIndex };
        }

        case SELECT_TRANSCRIPTION_TYPE: {
            const { choices, correctIndex } = challenge;
            LOG('SELECT_TRANSCRIPTION', { choices, correctIndex });
            document.querySelectorAll(CHALLENGE_JUDGE_TEXT)[correctIndex].dispatchEvent(clickEvent);
            return { choices, correctIndex };
        }

        case SPEAK_TYPE: {
            const { prompt } = challenge;
            LOG('SPEAK', { prompt });
            document.querySelectorAll(PLAYER_SKIP)[0].dispatchEvent(clickEvent);
            return { prompt };
        }

        default:
            LOG_WARN('Unknown challenge type:', challenge.type);
            break;
    }
}
 
function breakWhenIncorrect() {
    const isBreak = document.querySelectorAll(BLAME_INCORRECT).length > 0;
    if (isBreak) {
        LOG_ERROR('Incorrect answer detected, stopping...');
        clearInterval(mainInterval);
        LogPanel.isRunning = false;
        LogPanel.updateButtonStates();
    };
}

/**
 * Click the Check/Continue button
 */
function clickCheckButton() {
    const checkBtn = document.querySelector(PLAYER_NEXT);
    if (checkBtn) {
        const btnText = checkBtn.textContent?.toUpperCase();
        LOG_DEBUG('clickCheckButton: button text =', btnText);
        
        // Don't click if disabled
        if (checkBtn.getAttribute('aria-disabled') === 'true') {
            LOG_DEBUG('clickCheckButton: button is disabled, skipping');
            return false;
        }
        
        LOG('Clicking Check/Continue button...');
        checkBtn.dispatchEvent(clickEvent);
        return true;
    }
    LOG_WARN('clickCheckButton: button not found');
    return false;
}

/**
 * Check if we're on a result screen (correct/incorrect)
 */
function isOnResultScreen() {
    const blameCorrect = document.querySelector('[data-test="blame blame-correct"]');
    const blameIncorrect = document.querySelector(BLAME_INCORRECT);
    return blameCorrect || blameIncorrect;
}

/**
 * Check if we're on the home/course page (not in a lesson)
 */
function isOnHomePage() {
    // Check URL - lesson pages have /lesson/ in the URL
    if (window.location.pathname.includes('/lesson/')) {
        return false;
    }
    
    // Check for skill path (only exists on home page)
    const skillPath = document.querySelector('[data-test="skill-path"]') ||
                      document.querySelector('[data-test="home"]');
    
    // Check for absence of player button (lesson UI)
    const playerButton = document.querySelector(PLAYER_NEXT);
    
    return skillPath && !playerButton;
}

/**
 * Find and click the next available lesson on the home page
 * Returns true if a lesson was started, false otherwise
 * 
 * Structure of next lesson element:
 * div.R7x3_._8Iu6E
 *   div.HPdUG.fF_qH[role="button"]  <-- clickable element
 *     div._2t1Sd.Fw74a
 *       button[data-test="skill-path-level-X"]
 *       div._2nwbo (aria-hidden)
 *         div > div > div._3zpnU
 *           div._36bu_ "START"  <-- indicator text
 */
async function startNextLesson() {
    LOG('startNextLesson: looking for next lesson...');
    
    // Method 1: Look for the START indicator and find its clickable parent
    const startIndicator = document.querySelector('._36bu_');
    if (startIndicator && startIndicator.textContent?.trim().toUpperCase() === 'START') {
        LOG('startNextLesson: found START indicator');
        
        // Find the clickable parent: div[role="button"] with class HPdUG
        const clickableParent = startIndicator.closest('div[role="button"]') ||
                                startIndicator.closest('.HPdUG');
        
        if (clickableParent) {
            LOG('startNextLesson: clicking lesson button...');
            clickableParent.click();
            await delay(1000);
            
            // After clicking, check if we navigated to a lesson or if a popup appeared
            if (window.location.pathname.includes('/lesson/')) {
                LOG('startNextLesson: navigated to lesson');
                return true;
            }
            
            // Look for popup start button
            const popupStartBtn = document.querySelector('[data-test="start-button"]') ||
                                  document.querySelector('a[href*="/lesson/"]');
            if (popupStartBtn) {
                LOG('startNextLesson: clicking popup start button...');
                popupStartBtn.click();
                return true;
            }
            return true;
        }
        
        // Alternative: find the button inside the same container
        const container = startIndicator.closest('.R7x3_') || 
                          startIndicator.closest('[data-test^="skill-path"]');
        if (container) {
            const button = container.querySelector('button[data-test^="skill-path-level"]');
            if (button) {
                LOG('startNextLesson: clicking skill button directly...');
                button.click();
                await delay(1000);
                return true;
            }
        }
    }
    
    // Method 2: Look for skill path buttons that are the "current" lesson
    // Current lesson usually has the ._2nwbo popup indicator
    const allLessonContainers = document.querySelectorAll('.R7x3_._8Iu6E');
    LOG_DEBUG('startNextLesson: found', allLessonContainers.length, 'lesson containers');
    
    for (const container of allLessonContainers) {
        // Check if this container has the START popup indicator
        const hasStartPopup = container.querySelector('._2nwbo');
        if (hasStartPopup) {
            const clickable = container.querySelector('div[role="button"]');
            if (clickable) {
                LOG('startNextLesson: found lesson with popup indicator, clicking...');
                clickable.click();
                await delay(1000);
                return true;
            }
        }
    }
    
    // Method 3: Look for any "Jump here" or similar buttons
    const jumpButton = document.querySelector('button._3xDVI');
    if (jumpButton) {
        LOG('startNextLesson: found Jump button, clicking...');
        jumpButton.click();
        await delay(500);
        return true;
    }
    
    // Method 4: Direct link to start lesson
    const lessonLink = document.querySelector('a[href*="/lesson/"]');
    if (lessonLink) {
        LOG('startNextLesson: found lesson link, navigating...');
        lessonLink.click();
        return true;
    }
    
    LOG_WARN('startNextLesson: no available lessons found - course may be complete');
    return false;
}

/**
 * Check if course is complete (no START indicator visible)
 */
function isCourseComplete() {
    // If there's a START indicator, course is not complete
    const startIndicator = document.querySelector('._36bu_');
    if (startIndicator && startIndicator.textContent?.trim().toUpperCase() === 'START') {
        return false;
    }
    
    // Check if there are any lesson containers with popup indicators (active lessons)
    const activeLesson = document.querySelector('.R7x3_._8Iu6E ._2nwbo');
    if (activeLesson) {
        return false;
    }
    
    // Check for Jump button (indicates there's a next lesson to jump to)
    const jumpButton = document.querySelector('button._3xDVI');
    if (jumpButton) {
        return false;
    }
    
    // No active lessons found - course is likely complete
    LOG_DEBUG('isCourseComplete: no active lessons found');
    return true;
}

/**
 * Click Continue button to proceed to next challenge
 */
function clickContinue() {
    const btn = document.querySelector(PLAYER_NEXT);
    if (btn) {
        const btnText = btn.textContent?.toUpperCase();
        if (btnText === 'CONTINUE') {
            LOG('Clicking Continue...');
            btn.dispatchEvent(clickEvent);
            return true;
        }
    }
    return false;
}

/**
 * Wait for challenge elements to be ready before solving
 * This helps with slow-loading challenges
 */
async function waitForChallengeReady() {
    LOG_DEBUG('waitForChallengeReady: waiting for challenge elements...');
    
    // First, wait for the player next button
    const checkBtn = await waitForElement(PLAYER_NEXT, WAIT_CONFIG.CHALLENGE_TIMEOUT);
    if (!checkBtn) {
        LOG_DEBUG('waitForChallengeReady: no player button found');
        return false;
    }
    
    // Wait for challenge container - try multiple selectors
    const challengeSelectors = [
        MATH_CHALLENGE_BLOB,
        '[data-test^="challenge challenge-"]',
        CHARACTER_MATCH,
        CHALLENGE_CHOICE,
        CHALLENGE_CHOICE_CARD,
        CHALLENGE_TAP_TOKEN,
        CHALLENGE_TRANSLATE_INPUT
    ];
    
    const challengeResult = await waitForAnyElement(challengeSelectors, WAIT_CONFIG.CHALLENGE_TIMEOUT);
    if (!challengeResult) {
        LOG_DEBUG('waitForChallengeReady: no challenge elements found');
        return false;
    }
    
    LOG_DEBUG('waitForChallengeReady: found challenge element:', challengeResult.selector);
    
    // If it's a math challenge, wait a bit more for iframes to load
    if (challengeResult.selector === MATH_CHALLENGE_BLOB) {
        const container = challengeResult.element;
        
        // Check for iframes
        const iframe = container.querySelector('iframe[title="Math Web Element"]');
        if (iframe) {
            LOG_DEBUG('waitForChallengeReady: waiting for iframe content...');
            // Wait for srcdoc to be set
            await waitForElementWithCondition(
                'iframe[title="Math Web Element"]',
                (el) => el.getAttribute('srcdoc') && el.getAttribute('srcdoc').length > 100,
                WAIT_CONFIG.IFRAME_TIMEOUT
            );
            
            // Wait for iframe contentWindow to be accessible
            await waitForIframeContent(iframe, WAIT_CONFIG.IFRAME_TIMEOUT);
        }
        
        // Wait for equation or choices to appear
        await delay(WAIT_CONFIG.EXTRA_DELAY_AFTER_LOAD);  // Small extra delay for KaTeX rendering
    }
    
    return true;
}

/**
 * Solve current challenge once and click Check, then Continue
 */
function solveOne() {
    solveOneAsync().catch(e => LOG_ERROR('Error in solveOneAsync:', e.message));
}

/**
 * Async version of solveOne with element waiting
 */
async function solveOneAsync() {
    LOG('=== Solving current challenge ===');
    try {
        // Check if we're already on result screen - just click Continue
        if (isOnResultScreen()) {
            LOG('Already on result screen, clicking Continue');
            clickContinue();
            return;
        }
        
        // Wait for challenge elements to be ready
        const isReady = await waitForChallengeReady();
        if (!isReady) {
            LOG_DEBUG('solveOneAsync: challenge not ready, waiting more...');
            await delay(500);
        }
        
        const checkBtn = document.querySelector(PLAYER_NEXT);
        if (!checkBtn) {
            LOG_WARN('No button found');
            return;
        }
        
        const btnText = checkBtn.textContent?.toUpperCase();
        
        // If Continue is shown, click it
        if (btnText === 'CONTINUE') {
            LOG('Continue button visible, clicking...');
            checkBtn.dispatchEvent(clickEvent);
            return;
        }
        
        // If Check button is not disabled, answer is already selected - just click Check
        const isDisabled = checkBtn.getAttribute('aria-disabled') === 'true';
        if (!isDisabled) {
            LOG('Answer already selected, clicking Check...');
            checkBtn.dispatchEvent(clickEvent);
            // Wait for result and click Continue
            await delay(300);
            clickContinue();
            return;
        }
        
        // Need to solve first
        const result = await classifyAsync();
        if (result) {
            // Check if this is a slider challenge that failed to set the value
            if (result.type === 'interactiveSlider' && result.success === false) {
                LOG_ERROR('Slider challenge failed to set value - NOT clicking Check');
                LOG_WARN('This type of challenge may require manual interaction with the slider');
                return;
            }
            
            LOG('Challenge solved, result:', result);
            // Click Check after short delay
            await delay(100);
            const btn = document.querySelector(PLAYER_NEXT);
            if (btn && btn.getAttribute('aria-disabled') !== 'true') {
                LOG('Clicking Check...');
                btn.dispatchEvent(clickEvent);
                // Wait for result and click Continue
                await delay(300);
                clickContinue();
            }
        } else {
            LOG_WARN('classify() returned no result');
        }
    } catch (e) {
        LOG_ERROR('Error in solveOneAsync:', e.message);
    }
}

/**
 * Async wrapper for classify that ensures elements are loaded
 */
async function classifyAsync() {
    // First, check if this is a mathChallengeBlob
    const mathChallenge = document.querySelector(MATH_CHALLENGE_BLOB);
    if (mathChallenge) {
        LOG('Detected mathChallengeBlob challenge');
        return await solveMathChallengeBlobAsync();
    }
    
    // For other challenge types, use the synchronous classify
    return classify();
}

// Prevent multiple simultaneous operations
let isProcessing = false;

function main() {
    if (isProcessing) return;
    
    // Use async version for better element waiting
    mainAsync().catch(e => {
        LOG_ERROR('Error in mainAsync:', e.message);
        isProcessing = false;
    });
}

async function mainAsync() {
    if (isProcessing) return;
    
    try {
        // First, check if we're on the home page (lesson completed or not started)
        if (isOnHomePage()) {
            LOG_DEBUG('main: detected home page');
            
            // Check if course is complete
            if (isCourseComplete()) {
                LOG('main: Course complete! Stopping auto mode.');
                clearInterval(mainInterval);
                LogPanel.isRunning = false;
                LogPanel.updateButtonStates();
                return;
            }
            
            // Try to start the next lesson
            isProcessing = true;
            const started = await startNextLesson();
            isProcessing = false;
            
            if (started) {
                LOG('main: Starting next lesson...');
                // Wait for lesson to load
                await delay(2000);
            }
            return;
        }
        
        // Wait for button to appear (handles slow page loads)
        let checkBtn = document.querySelector(PLAYER_NEXT);
        if (!checkBtn) {
            // Try waiting a bit
            checkBtn = await waitForElement(PLAYER_NEXT, 1000);
            if (!checkBtn) {
                // Check again if we ended up on home page
                if (isOnHomePage()) {
                    LOG_DEBUG('main: redirected to home page');
                    return; // Will be handled in next iteration
                }
                return;
            }
        }
        
        const btnText = checkBtn.textContent?.toUpperCase()?.trim();
        const isDisabled = checkBtn.getAttribute('aria-disabled') === 'true';
        
        // Check for incorrect answer
        breakWhenIncorrect();
        
        // If button says CONTINUE, just click it to proceed
        if (btnText === 'CONTINUE') {
            LOG_DEBUG('main: clicking CONTINUE');
            checkBtn.dispatchEvent(clickEvent);
            return;
        }
        
        // If button is CHECK and not disabled, we already answered - click it
        if (btnText === 'CHECK' && !isDisabled) {
            LOG_DEBUG('main: clicking CHECK (answer already selected)');
            isProcessing = true;
            checkBtn.dispatchEvent(clickEvent);
            await delay(200);
            isProcessing = false;
            return;
        }
        
        // If button is CHECK and disabled, we need to solve first
        if (btnText === 'CHECK' && isDisabled) {
            LOG_DEBUG('main: need to solve challenge');
            isProcessing = true;
            
            // Wait for challenge elements to be ready
            await waitForChallengeReady();
            
            // Use async classify for math challenges
            const result = await classifyAsync();
            
            // Check if slider challenge failed
            if (result && result.type === 'interactiveSlider' && result.success === false) {
                LOG_ERROR('main: Slider challenge failed - stopping auto mode');
                LOG_WARN('This type of challenge requires manual interaction');
                clearInterval(mainInterval);
                LogPanel.isRunning = false;
                LogPanel.updateButtonStates();
                isProcessing = false;
                return;
            }
            
            // Try clicking after a short delay
            await delay(100);
            const btn = document.querySelector(PLAYER_NEXT);
            if (btn && btn.getAttribute('aria-disabled') !== 'true') {
                LOG_DEBUG('main: clicking CHECK after solve');
                btn.dispatchEvent(clickEvent);
            }
            await delay(100);
            isProcessing = false;
        }
    } catch (e) {
        LOG_ERROR('Error in mainAsync:', e.message);
        isProcessing = false;
    }
}

function startAutoMode() {
    if (LogPanel.isRunning) {
        LOG_WARN('Auto mode already running');
        return;
    }
    LOG('=== Auto Mode Started ===');
    LogPanel.isRunning = true;
    mainInterval = setInterval(main, TIME_OUT);
    LogPanel.updateButtonStates();
    LOG(`Running with interval ID: ${mainInterval}`);
}

function stopAutoMode() {
    clearInterval(mainInterval);
    LogPanel.isRunning = false;
    LogPanel.updateButtonStates();
    LOG('=== Auto Mode Stopped ===');
}

// Initialize log panel without auto-starting
function initAutoDuo() {
    LOG('=== AutoDuo Initialized ===');
    LOG('Use "Solve" button to solve current challenge');
    LOG('Use "Auto" button to toggle auto-solve mode');
    LogPanel.isRunning = false;
    LogPanel.updateButtonStates();
}

// Expose functions globally for console access
window.AutoDuo = {
    start: startAutoMode,
    stop: stopAutoMode,
    solveOne: solveOne,
    logs: LogPanel,
    solveMath: solveMathChallengeBlob,
    solveSlider: solveMathInteractiveSlider,
    solveSpinner: solveMathInteractiveSpinner,
    solveExpressionBuild: solveMathExpressionBuild,
    solveMatchPairs: solveMathMatchPairs,
    solvePieChartTextInput: solveMathPieChartTextInput,
    solvePieChartSelectFraction: solveMathPieChartSelectFraction,
    solveSelectPieChart: solveMathSelectPieChart,
    findExpressionSolution: findExpressionSolution,
    extractPieChartFraction: extractPieChartFraction,
    findIframeByContent: findIframeByContent,
    classify: classify,
    clickCheck: clickCheckButton,
    clickContinue: clickContinue
};

// Initialize without auto-start
initAutoDuo();
