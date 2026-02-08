import type { ScryfallCard } from '../../types';
import { getCardImageUrl } from '../../services/scryfall';
import './Card.css';

interface CardProps {
    card: ScryfallCard;
    size?: 'small' | 'normal' | 'large';
    onClick?: () => void;
    selected?: boolean;
    dimmed?: boolean;
    showTooltip?: boolean;
    face?: 'front' | 'back';
}

/**
 * Get special card badges based on card properties
 */
function getSpecialBadges(card: ScryfallCard): { label: string; className: string }[] {
    const badges: { label: string; className: string }[] = [];

    // Check internal flags first
    if (card._isFoil) {
        badges.push({ label: 'FOIL', className: 'badge-foil' });
    }

    if (card._isFromList) {
        badges.push({ label: 'THE LIST', className: 'badge-list' });
    }

    // Check Scryfall frame effects
    if (card.frame_effects) {
        if (card.frame_effects.includes('showcase')) {
            badges.push({ label: 'SHOWCASE', className: 'badge-showcase' });
        }
        if (card.frame_effects.includes('extendedart')) {
            badges.push({ label: 'EXTENDED', className: 'badge-extended' });
        }
        if (card.frame_effects.includes('borderless')) {
            badges.push({ label: 'BORDERLESS', className: 'badge-borderless' });
        }
        if (card.frame_effects.includes('inverted')) {
            badges.push({ label: 'INVERTED', className: 'badge-special' });
        }
        if (card.frame_effects.includes('etched')) {
            badges.push({ label: 'ETCHED', className: 'badge-foil' });
        }
    }

    // Check border color for borderless
    if (card.border_color === 'borderless' && !badges.some(b => b.label === 'BORDERLESS')) {
        badges.push({ label: 'BORDERLESS', className: 'badge-borderless' });
    }

    // Full art cards
    if (card.full_art) {
        badges.push({ label: 'FULL ART', className: 'badge-fullart' });
    }

    // Textless cards
    if (card.textless) {
        badges.push({ label: 'TEXTLESS', className: 'badge-special' });
    }

    // Promo cards
    if (card.promo) {
        badges.push({ label: 'PROMO', className: 'badge-promo' });
    }

    return badges;
}

export function Card({
    card,
    size = 'normal',
    onClick,
    selected = false,
    dimmed = false,
    showTooltip = false, // Default to false now
    face = 'front'
}: CardProps) {
    const imageUrl = getCardImageUrl(card, size === 'large' ? 'large' : 'normal', face);
    const badges = getSpecialBadges(card);
    const hasSpecialBadges = badges.length > 0;

    const classNames = [
        'card-container',
        size === 'small' && 'card-small',
        size === 'large' && 'card-large',
        `rarity-${card.rarity}`,
        card._isFoil && 'foil',
        selected && 'selected',
        dimmed && 'dimmed',
        onClick && 'clickable',
        hasSpecialBadges && 'has-badges'
    ].filter(Boolean).join(' ');

    // Build tooltip text (only if explicitly enabled)
    let tooltipText: string | undefined;
    if (showTooltip) {
        const tooltipParts = [card.name];
        if (badges.length > 0) {
            tooltipParts.push(`(${badges.map(b => b.label).join(', ')})`);
        }
        tooltipText = tooltipParts.join(' ');
    }

    return (
        <div
            className={classNames}
            onClick={onClick}
            title={tooltipText}
        >
            <img
                src={imageUrl}
                alt={card.name}
                className="card-image"
                loading="lazy"
            />
            {badges.length > 0 && (
                <div className="card-badges">
                    {badges.map((badge, i) => (
                        <span key={i} className={`card-badge ${badge.className}`}>
                            {badge.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
