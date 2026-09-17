import { type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

/** Persistent Show Working control. Expands the derivation of whatever is on screen. */
export function Working({ children, open, onToggle }: { children: ComponentChildren; open?: boolean; onToggle?: (v: boolean) => void }) {
  const [local, setLocal] = useState(false);
  const isOpen = open ?? local;
  const toggle = () => {
    const next = !isOpen;
    if (onToggle) onToggle(next);
    else setLocal(next);
  };
  return (
    <div class="working">
      <button type="button" class="working-toggle" onClick={toggle} aria-expanded={isOpen}>
        {isOpen ? 'Hide working' : 'Show working'} <kbd>w</kbd>
      </button>
      {isOpen && <div class="working-body">{children}</div>}
    </div>
  );
}

export function Step({ text, formula, result }: { text: string; formula?: string; result?: string }) {
  return (
    <div class="step">
      <div class="step-text">{text}</div>
      {(formula || result) && (
        <div class="step-math">
          {formula && <code>{formula}</code>}
          {formula && result && <span class="eq"> = </span>}
          {result && <span class="step-result">{result}</span>}
        </div>
      )}
    </div>
  );
}
