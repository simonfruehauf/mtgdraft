import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLogService } from '../../services/DraftLogService';
import type { DraftLog } from '../../types';
import './DraftLog.css';

export function DraftLogList() {
    const [logs, setLogs] = useState<DraftLog[]>(() => DraftLogService.getAllLogs());
    const navigate = useNavigate();

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this log?')) {
            DraftLogService.deleteLog(id);
            setLogs(DraftLogService.getAllLogs());
        }
    };

    return (
        <div className="draft-log-container">
            <h1>Draft History</h1>
            {logs.length === 0 ? (
                <p className="no-logs">No drafts recorded yet.</p>
            ) : (
                <div className="log-list">
                    {logs.map(log => (
                        <div key={log.id} className="log-item" onClick={() => navigate(`/draft/log/${log.id}`)}>
                            <div className="log-header">
                                <span className="log-set">{log.settings.setName}</span>
                                <span className="log-date">{new Date(log.date).toLocaleString()}</span>
                            </div>
                            <div className="log-details">
                                <span>{log.picks.length} picks</span>
                                <span>{log.settings.draftMode}</span>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(e, log.id)}>
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
    );
}


