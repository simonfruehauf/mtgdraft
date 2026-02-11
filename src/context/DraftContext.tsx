import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { DraftSettings } from '../types';


interface DraftContextType {
    draftSettings: DraftSettings | null;
    startDraft: (settings: DraftSettings) => void;
    endDraft: () => void;


}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

export function DraftProvider({ children }: { children: ReactNode }) {
    const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);


    function startDraft(settings: DraftSettings) {
        setDraftSettings(settings);
    }

    function endDraft() {
        setDraftSettings(null);
    }



    return (
        <DraftContext.Provider value={{
            draftSettings,
            startDraft,
            endDraft
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
