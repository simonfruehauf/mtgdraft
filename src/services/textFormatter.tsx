import type { ReactNode } from 'react';
import { ManaSymbol } from '../components/ManaSymbol/ManaSymbol';

/**
 * Parses Oracle text and replaces mana symbols (e.g. {T}) with ManaSymbol components.
 * Also handles newlines.
 */
export function formatOracleText(text: string): ReactNode[] {
    if (!text) return [];

    // Split by newlines first to handle paragraphs
    const lines = text.split('\n');
    const result: ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
            result.push(<br key={`br-${lineIndex}`} />);
            // Optional: add extra spacing for paragraphs?
            // result.push(<br key={`br2-${lineIndex}`} />); 
        }

        // Split by mana symbol pattern: {X} or {X/Y} or {100} etc.
        // Regex captures the symbol including braces
        const parts = line.split(/(\{[^}]+\})/g);

        parts.forEach((part, partIndex) => {
            if (part.match(/^\{[^}]+\}$/)) {
                // It's a symbol
                result.push(
                    <ManaSymbol
                        key={`sym-${lineIndex}-${partIndex}`}
                        symbol={part}
                    />
                );
            } else if (part) {
                // Regular text
                result.push(<span key={`text-${lineIndex}-${partIndex}`}>{part}</span>);
            }
        });
    });

    return result;
}
