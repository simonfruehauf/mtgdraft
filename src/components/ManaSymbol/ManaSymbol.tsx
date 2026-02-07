import './ManaSymbol.css';

interface ManaSymbolProps {
    symbol: string;
}

export function ManaSymbol({ symbol }: ManaSymbolProps) {
    // Remove braces and slashes for the filename
    // e.g., "{T}" -> "T", "{W/U}" -> "WU"
    let content = symbol.replace(/[{}/]/g, '');

    // Special cases
    if (content === '½') content = 'HALF';
    if (content === '∞') content = 'INFINITY';

    const url = `https://svgs.scryfall.io/card-symbols/${content}.svg`;

    // Accessible text for screen readers
    const altText = symbol;

    return (
        <img
            src={url}
            alt={altText}
            className="mana-symbol"
            loading="lazy"
            onError={(e) => {
                // If image fails, hide it or maybe show text?
                // For now, let's just leave the broken image or hide it
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}
