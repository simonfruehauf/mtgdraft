import { useState, useEffect } from 'react';
import type { ScryfallSet, BoosterType, DraftSettings, DraftMode } from '../../types';
import { fetchSets, getAvailableBoosterTypes } from '../../services/scryfall';
import './SetSelector.css';

interface SetSelectorProps {
    onSelect: (set: ScryfallSet, boosterType: BoosterType, settings: DraftSettings) => void;
}

const PLAYER_OPTIONS = [4, 6, 8];
const PACK_OPTIONS = [1, 2, 3, 4];
const SEALED_PACK_OPTIONS = [3, 4, 5, 6, 8, 10, 12];
const TIMER_OPTIONS = [
    { label: 'No timer', value: 0 },
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
];

export function SetSelector({ onSelect }: SetSelectorProps) {
    const [sets, setSets] = useState<ScryfallSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSet, setSelectedSet] = useState<ScryfallSet | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Config state
    const [boosterType, setBoosterType] = useState<BoosterType>('draft');
    const [draftMode, setDraftMode] = useState<DraftMode>('draft');
    const [players, setPlayers] = useState(8);
    const [packs, setPacks] = useState(3);
    const [sealedPacks, setSealedPacks] = useState(6);
    const [timer, setTimer] = useState(60);

    useEffect(() => {
        loadSets();
    }, []);

    async function loadSets() {
        try {
            setLoading(true);
            const allSets = await fetchSets();
            const sorted = allSets.sort((a, b) =>
                new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
            );
            setSets(sorted);
        } catch (err) {
            setError('Failed to load sets. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function handleSetSelect(set: ScryfallSet) {
        setSelectedSet(set);
        const types = getAvailableBoosterTypes(set);
        setBoosterType(types[0]);
    }

    function handleStart() {
        if (!selectedSet) return;

        const settings: DraftSettings = {
            setCode: selectedSet.code,
            setName: selectedSet.name,
            boosterType,
            numberOfPacks: draftMode === 'draft' ? packs : sealedPacks,
            numberOfPlayers: draftMode === 'draft' ? players : 1,
            pickTimeSeconds: draftMode === 'draft' ? timer : 0,
            draftMode
        };
        onSelect(selectedSet, boosterType, settings);
    }

    const filteredSets = sets.filter(set =>
        set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const availableBoosterTypes = selectedSet ? getAvailableBoosterTypes(selectedSet) : [];

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Loading sets...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error-text">{error}</p>
                <button className="btn btn-primary" onClick={loadSets}>Retry</button>
            </div>
        );
    }

    return (
        <div className="set-selector fade-in">
            <div className="set-selector-header">
                <h2>Select a set</h2>
                <input
                    type="text"
                    className="form-input search-input"
                    placeholder="Search sets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Inline config panel when set is selected */}
            {selectedSet && (
                <div className="set-config-panel">
                    <div className="set-config-header">
                        <img
                            src={selectedSet.icon_svg_uri}
                            alt={selectedSet.name}
                            className="set-icon"
                        />
                        <div>
                            <h3>{selectedSet.name}</h3>
                            <span className="set-meta">
                                {selectedSet.code.toUpperCase()} · {selectedSet.card_count} cards
                            </span>
                        </div>
                    </div>

                    {/* Mode selector */}
                    <div className="mode-selector">
                        <button
                            className={`mode-btn ${draftMode === 'draft' ? 'active' : ''}`}
                            onClick={() => setDraftMode('draft')}
                        >
                            <span className="mode-title">Draft</span>
                            <span className="mode-desc">Pick & pass with bots</span>
                        </button>
                        <button
                            className={`mode-btn ${draftMode === 'sealed' ? 'active' : ''}`}
                            onClick={() => setDraftMode('sealed')}
                        >
                            <span className="mode-title">Sealed</span>
                            <span className="mode-desc">Open packs, keep all</span>
                        </button>
                        <button
                            className={`mode-btn ${draftMode === 'multiplayer' ? 'active' : ''}`}
                            onClick={() => setDraftMode('multiplayer')}
                        >
                            <span className="mode-title">Multiplayer</span>
                            <span className="mode-desc">Draft with friends</span>
                        </button>
                    </div>

                    {/* Config options */}
                    <div className="config-options">
                        {availableBoosterTypes.length > 1 && (
                            <div className="form-group">
                                <label className="form-label">Booster type</label>
                                <select
                                    className="form-select"
                                    value={boosterType}
                                    onChange={(e) => setBoosterType(e.target.value as BoosterType)}
                                >
                                    {availableBoosterTypes.map(type => (
                                        <option key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {draftMode === 'draft' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Players</label>
                                    <select
                                        className="form-select"
                                        value={players}
                                        onChange={(e) => setPlayers(Number(e.target.value))}
                                    >
                                        {PLAYER_OPTIONS.map(n => (
                                            <option key={n} value={n}>{n} players</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Packs</label>
                                    <select
                                        className="form-select"
                                        value={packs}
                                        onChange={(e) => setPacks(Number(e.target.value))}
                                    >
                                        {PACK_OPTIONS.map(n => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'pack' : 'packs'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Timer</label>
                                    <select
                                        className="form-select"
                                        value={timer}
                                        onChange={(e) => setTimer(Number(e.target.value))}
                                    >
                                        {TIMER_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {draftMode === 'sealed' && (
                            <div className="form-group">
                                <label className="form-label">Packs to open</label>
                                <select
                                    className="form-select"
                                    value={sealedPacks}
                                    onChange={(e) => setSealedPacks(Number(e.target.value))}
                                >
                                    {SEALED_PACK_OPTIONS.map(n => (
                                        <option key={n} value={n}>{n} packs</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="config-actions">
                        <button
                            className="btn btn-ghost"
                            onClick={() => setSelectedSet(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleStart}
                        >
                            {draftMode === 'sealed' ? 'Open packs' : 'Start draft'}
                        </button>
                    </div>
                </div>
            )}

            <div className="set-grid">
                {filteredSets.map(set => (
                    <div
                        key={set.id}
                        className={`set-card ${selectedSet?.id === set.id ? 'selected' : ''}`}
                        onClick={() => handleSetSelect(set)}
                    >
                        <img
                            src={set.icon_svg_uri}
                            alt={set.name}
                            className="set-icon"
                        />
                        <div className="set-info">
                            <span className="set-name">{set.name}</span>
                            <span className="set-code">{set.code} · {set.released_at}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
