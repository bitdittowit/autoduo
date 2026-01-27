/**
 * Моки для DOM элементов в тестах
 */

/**
 * Создает мок challenge контейнера для тестов
 */
export function createChallengeContainer(html: string): HTMLElement {
    const container = document.createElement('div');
    container.setAttribute('data-test', 'challenge challenge-mathChallengeBlob');
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
}

/**
 * Создает мок KaTeX элемента
 */
export function createKatexElement(latex: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'katex';
    span.innerHTML = `
        <span class="katex-mathml">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
                <semantics>
                    <annotation encoding="application/x-tex">${latex}</annotation>
                </semantics>
            </math>
        </span>
    `;
    return span;
}

/**
 * Создает мок текстового инпута
 */
export function createTextInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.setAttribute('data-test', 'challenge-text-input');
    input.type = 'text';
    return input;
}

/**
 * Создает мок заголовка challenge
 */
export function createChallengeHeader(text: string): HTMLElement {
    const header = document.createElement('h1');
    header.setAttribute('data-test', 'challenge-header');
    header.textContent = text;
    return header;
}

/**
 * Создает мок choice элемента
 */
export function createChoiceElement(content: string, index: number): HTMLElement {
    const choice = document.createElement('div');
    choice.setAttribute('data-test', 'challenge-choice');
    choice.setAttribute('data-index', String(index));
    choice.innerHTML = content;
    return choice;
}
