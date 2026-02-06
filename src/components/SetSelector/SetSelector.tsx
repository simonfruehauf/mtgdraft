import { useState, useEffect } from 'react';
import type { ScryfallSet, BoosterType } from '../../types';
import { fetchSets, getAvailableBoosterTypes } from '../../services/scryfall';
import './SetSelector.css';

interface SetSelectorProps {
    onSelect: (set: ScryfallSet, boosterType: BoosterType) => void;
}

export function SetSelector({ onSelect }: SetSelectorProps) {
    const [sets, setSets] = useState<ScryfallSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSet, setSelectedSet] = useState<ScryfallSet | null>(null);
    const [selectedBoosterType, setSelectedBoosterType] = useState<BoosterType>('draft');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadSets();
    }, []);

    async function loadSets() {
        try {
            setLoading(true);
            const allSets = await fetchSets();
            // Sort by release date, newest first
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
        const boosterTypes = getAvailableBoosterTypes(set);
        // Auto-select the first available booster type
        setSelectedBoosterType(boosterTypes[0]);
    }

    function handleStartDraft() {
        if (selectedSet) {
            onSelect(selectedSet, selectedBoosterType);
        }
    }

    const filteredSets = sets.filter(set =>
        set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const availableBoosterTypes = selectedSet
        ? getAvailableBoosterTypes(selectedSet)
        : [];

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Loading sets from Scryfall...</p>
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
                <h2>Select a Set</h2>
                <input
                    type="text"
                    className="form-input search-input"
                    placeholder="Search sets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

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
                            <span className="set-code">{set.code} • {set.released_at}</span>
                        </div>
                    </div>
                ))}
            </div>

            {selectedSet && (
                <div className="set-selector-footer slide-in">
                    <div className="selected-set-info">
                        <img
                            src={selectedSet.icon_svg_uri}
                            alt={selectedSet.name}
                            className="set-icon"
                        />
                        <div>
                            <h3>{selectedSet.name}</h3>
                            <p className="set-card-count">{selectedSet.card_count} cards</p>
                        </div>
                    </div>

                    <div className="booster-type-selector">
                        <label className="form-label">Booster Type</label>
                        <div className="booster-type-buttons">
                            {availableBoosterTypes.map(type => (
                                <button
                                    key={type}
                                    className={`btn ${selectedBoosterType === type ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSelectedBoosterType(type)}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)} Booster
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-large"
                        onClick={handleStartDraft}
                    >
                        Start Draft
                    </button>
                </div>
            )}
        </div>
    );
}
