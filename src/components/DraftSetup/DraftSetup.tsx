import { useState } from 'react';
import type { ScryfallSet, BoosterType, DraftSettings, DraftMode } from '../../types';
import './DraftSetup.css';

interface DraftSetupProps {
    set: ScryfallSet;
    boosterType: BoosterType;
    onStart: (settings: DraftSettings) => void;
    onBack: () => void;
}

const PLAYER_OPTIONS = [4, 6, 8];
const DRAFT_PACK_OPTIONS = [1, 2, 3, 4];
const SEALED_PACK_OPTIONS = [3, 4, 5, 6, 8, 10, 12];
const TIMER_OPTIONS = [
    { label: 'No Timer', value: 0 },
    { label: '30 seconds', value: 30 },
    { label: '45 seconds', value: 45 },
    { label: '60 seconds', value: 60 },
    { label: '90 seconds', value: 90 },
    { label: '2 minutes', value: 120 },
];

export function DraftSetup({ set, boosterType, onStart, onBack }: DraftSetupProps) {
    const [draftMode, setDraftMode] = useState<DraftMode>('draft');
    const [numberOfPlayers, setNumberOfPlayers] = useState(8);
    const [numberOfPacks, setNumberOfPacks] = useState(3);
    const [sealedPacks, setSealedPacks] = useState(6);
    const [pickTimeSeconds, setPickTimeSeconds] = useState(60);

    function handleStart() {
        const settings: DraftSettings = {
            setCode: set.code,
            setName: set.name,
            boosterType,
            numberOfPacks: draftMode === 'draft' ? numberOfPacks : sealedPacks,
            numberOfPlayers: draftMode === 'draft' ? numberOfPlayers : 1,
            pickTimeSeconds: draftMode === 'draft' ? pickTimeSeconds : 0,
            draftMode
        };
        onStart(settings);
    }

    const boosterLabel = {
        play: 'Play Booster',
        draft: 'Draft Booster',
        set: 'Set Booster'
    }[boosterType];

    const cardsPerPack = {
        play: 14,
        draft: 15,
        set: 12
    }[boosterType];

    const totalCards = draftMode === 'draft'
        ? numberOfPacks * cardsPerPack
        : sealedPacks * cardsPerPack;

    return (
        <div className="draft-setup fade-in">
            <div className="draft-setup-header">
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Back
                </button>
                <h2>Draft Setup</h2>
            </div>

            <div className="draft-setup-content">
                <div className="setup-card selected-set">
                    <img
                        src={set.icon_svg_uri}
                        alt={set.name}
                        className="set-icon-large"
                    />
                    <div className="selected-set-info">
                        <h3>{set.name}</h3>
                        <p className="set-details">
                            {set.code.toUpperCase()} • {boosterLabel}
                        </p>
                    </div>
                </div>

                <div className="setup-options">
                    {/* Mode Selection */}
                    <div className="setup-option">
                        <label className="form-label">Game Mode</label>
                        <div className="option-buttons mode-buttons">
                            <button
                                className={`btn mode-btn ${draftMode === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setDraftMode('draft')}
                            >
                                <span className="mode-icon">🔄</span>
                                <span className="mode-title">Draft</span>
                                <span className="mode-desc">Pick & pass with bots</span>
                            </button>
                            <button
                                className={`btn mode-btn ${draftMode === 'sealed' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setDraftMode('sealed')}
                            >
                                <span className="mode-icon">📦</span>
                                <span className="mode-title">Box Brawl</span>
                                <span className="mode-desc">Open packs, keep all</span>
                            </button>
                            <button
                                className={`btn mode-btn ${draftMode === 'multiplayer' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setDraftMode('multiplayer')}
                            >
                                <span className="mode-icon">🌐</span>
                                <span className="mode-title">Multiplayer</span>
                                <span className="mode-desc">Draft with friends</span>
                            </button>
                        </div>
                    </div>

                    {/* Draft-specific options */}
                    {draftMode === 'draft' && (
                        <>
                            <div className="setup-option">
                                <label className="form-label">Number of Players (including you)</label>
                                <div className="option-buttons">
                                    {PLAYER_OPTIONS.map(num => (
                                        <button
                                            key={num}
                                            className={`btn ${numberOfPlayers === num ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setNumberOfPlayers(num)}
                                        >
                                            {num} Players
                                        </button>
                                    ))}
                                </div>
                                <p className="option-hint">You + {numberOfPlayers - 1} bots</p>
                            </div>

                            <div className="setup-option">
                                <label className="form-label">Packs per Player</label>
                                <div className="option-buttons">
                                    {DRAFT_PACK_OPTIONS.map(num => (
                                        <button
                                            key={num}
                                            className={`btn ${numberOfPacks === num ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setNumberOfPacks(num)}
                                        >
                                            {num} Pack{num !== 1 ? 's' : ''}
                                        </button>
                                    ))}
                                </div>
                                <p className="option-hint">
                                    {totalCards} cards per player • {cardsPerPack} cards per pack
                                </p>
                            </div>

                            <div className="setup-option">
                                <label className="form-label">Pick Timer</label>
                                <div className="option-buttons timer-buttons">
                                    {TIMER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`btn ${pickTimeSeconds === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setPickTimeSeconds(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="option-hint">
                                    {pickTimeSeconds === 0
                                        ? 'Take as long as you need'
                                        : 'Auto-picks first card when timer expires'}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Sealed/Box Brawl options */}
                    {draftMode === 'sealed' && (
                        <div className="setup-option">
                            <label className="form-label">Number of Packs to Open</label>
                            <div className="option-buttons">
                                {SEALED_PACK_OPTIONS.map(num => (
                                    <button
                                        key={num}
                                        className={`btn ${sealedPacks === num ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSealedPacks(num)}
                                    >
                                        {num} Packs
                                    </button>
                                ))}
                            </div>
                            <p className="option-hint">
                                {totalCards} total cards • {cardsPerPack} cards per pack
                            </p>
                        </div>
                    )}
                </div>

                <div className="setup-summary">
                    <h4>{draftMode === 'draft' ? 'Draft' : 'Box Brawl'} Summary</h4>
                    <ul>
                        <li><strong>Set:</strong> {set.name} ({boosterLabel})</li>
                        <li><strong>Mode:</strong> {draftMode === 'draft' ? 'Draft with bots' : 'Box Brawl (Sealed)'}</li>
                        {draftMode === 'draft' && (
                            <>
                                <li><strong>Players:</strong> 1 human + {numberOfPlayers - 1} bots</li>
                                <li><strong>Packs:</strong> {numberOfPacks} per player ({numberOfPacks * numberOfPlayers} total)</li>
                                <li><strong>Timer:</strong> {pickTimeSeconds === 0 ? 'Disabled' : `${pickTimeSeconds}s per pick`}</li>
                            </>
                        )}
                        {draftMode === 'sealed' && (
                            <li><strong>Packs:</strong> {sealedPacks} packs to open</li>
                        )}
                        <li><strong>Cards:</strong> ~{totalCards} cards in your pool</li>
                    </ul>
                </div>

                <button className="btn btn-primary btn-large start-button" onClick={handleStart}>
                    {draftMode === 'draft' ? 'Start Draft' : 'Open Packs'}
                </button>
            </div>
        </div>
    );
}
