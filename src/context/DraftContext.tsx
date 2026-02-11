import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { DraftSettings, DraftLog, DraftPickLog } from '../types';
import { DraftLogService } from '../services/DraftLogService';

interface DraftContextType {
    draftSettings: DraftSettings | null;
    startDraft: (settings: DraftSettings) => void;
    endDraft: () => void;

    // Logging features
    currentLog: DraftLog | null;
    logPick: (pick: DraftPickLog) => void;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

export function DraftProvider({ children }: { children: ReactNode }) {
    const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
    const [currentLog, setCurrentLog] = useState<DraftLog | null>(null);

    function startDraft(settings: DraftSettings) {
        setDraftSettings(settings);
        // Initialize a new log
        const newLog = DraftLogService.createLog(settings);
        setCurrentLog(newLog);
        DraftLogService.saveLog(newLog); // Initial save
    }

    function endDraft() {
        setDraftSettings(null);
        setCurrentLog(null);
    }

    function logPick(pick: DraftPickLog) {
        if (!currentLog) return;

        const updatedLog = {
            ...currentLog,
            picks: [...currentLog.picks, pick]
        };

        setCurrentLog(updatedLog);
        DraftLogService.saveLog(updatedLog);
    }

    return (
        <DraftContext.Provider value={{
            draftSettings,
            startDraft,
            endDraft,
            currentLog,
            logPick
        }}>
            {children}
        </DraftContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDraft() {
    const context = useContext(DraftContext);
    if (context === undefined) {
        throw new Error('useDraft must be used within a DraftProvider');
    }
    return context;
}
