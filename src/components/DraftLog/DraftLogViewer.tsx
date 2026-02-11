import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DraftLogService } from '../../services/DraftLogService';
import type { DraftLog } from '../../types';
import { Card } from '../Card';
import './DraftLog.css';

export function DraftLogViewer() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const log = useMemo<DraftLog | null>(() => {
        if (!id) return null;
        return DraftLogService.getLog(id) ?? null;
    }, [id]);

    useEffect(() => {
        if (id && !log) {
            navigate('/draft/logs');
        }
    }, [id, log, navigate]);

    if (!log) return <div>Loading...</div>;

    return (
        <div className="draft-viewer-container">
            <header className="viewer-header">
                <button className="btn btn-secondary" onClick={() => navigate('/draft/logs')}>&larr; Back</button>
                <div className="header-info">
                    <h1>{log.settings.setName} Draft</h1>
                    <span className="timestamp">{new Date(log.date).toLocaleString()}</span>
                </div>
                <div className="actions">
                    <button className="btn btn-primary" onClick={() => {
                        // TODO: Implement export to clipboard
                        alert('Deck export coming soon');
                    }}>Export Deck</button>
                </div>
            </header>

            <div className="picks-grid">
                {log.picks.map((pick, index) => (
                    <div key={index} className="pick-entry">
                        <div className="pick-meta">
                            <span className="pack-pick">P{pick.packNumber + 1}P{pick.pickNumber + 1}</span>
                        </div>
                        <div className="pick-card">
                            <Card card={pick.pickedCard} />
                        </div>
                        {/* Optionally show what was passed? Maybe too much clutter for now */}
                    </div>
                ))}
            </div>
        </div>
    );
}
