import type { ScryfallCard } from '../../types';
import { Card } from '../Card';
import './DraftComplete.css';

interface DraftCompleteProps {
    picks: ScryfallCard[];
    setName: string;
    onNewDraft: () => void;
    onExport: () => void;
}

export function DraftComplete({ picks, setName, onNewDraft, onExport }: DraftCompleteProps) {
    // Group picks by rarity
    const grouped = {
        mythic: picks.filter(c => c.rarity === 'mythic'),
        rare: picks.filter(c => c.rarity === 'rare'),
        uncommon: picks.filter(c => c.rarity === 'uncommon'),
        common: picks.filter(c => c.rarity === 'common'),
    };

    // Count colors
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    picks.forEach(card => {
        card.colors?.forEach(c => {
            if (colorCounts[c] !== undefined) colorCounts[c]++;
        });
    });

    // Find top 2 colors
    const sortedColors = Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .filter(([, count]) => count > 0);

    const colorNames: Record<string, string> = {
        W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green'
    };

    const colorEmojis: Record<string, string> = {
        W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲'
    };

    return (
        <div className="draft-complete-overlay">
            <div className="draft-complete-modal">
                <div className="draft-complete-header">
                    <div className="draft-complete-celebration">🎉</div>
                    <h2>Draft Complete!</h2>
                    <p className="draft-complete-subtitle">{setName}</p>
                </div>

                <div className="draft-complete-stats">
                    <div className="stat-card">
                        <span className="stat-value">{picks.length}</span>
                        <span className="stat-label">Cards Drafted</span>
                    </div>
                    <div className="stat-card stat-mythic">
                        <span className="stat-value">{grouped.mythic.length}</span>
                        <span className="stat-label">Mythics</span>
                    </div>
                    <div className="stat-card stat-rare">
                        <span className="stat-value">{grouped.rare.length}</span>
                        <span className="stat-label">Rares</span>
                    </div>
                    {sortedColors.length > 0 && (
                        <div className="stat-card stat-colors">
                            <span className="stat-value">
                                {sortedColors.map(([c]) => colorEmojis[c]).join(' ')}
                            </span>
                            <span className="stat-label">
                                {sortedColors.map(([c]) => colorNames[c]).join('/')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Show top picks */}
                <div className="draft-complete-highlights">
                    <h3>Highlights</h3>
                    <div className="highlights-cards">
                        {[...grouped.mythic, ...grouped.rare].slice(0, 5).map((card, i) => (
                            <div key={`${card.id}-${i}`} className="highlight-card">
                                <Card card={card} size="small" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="draft-complete-actions">
                    <button className="btn btn-secondary" onClick={onExport}>
                        Export Pool
                    </button>
                    <button className="btn btn-primary btn-lg" onClick={onNewDraft}>
                        New Draft
                    </button>
                </div>
            </div>
        </div>
    );
}
