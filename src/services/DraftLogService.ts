import type { DraftLog, DraftSettings } from '../types';

const STORAGE_KEY = 'mtg-draft-logs';

export const DraftLogService = {
    getAllLogs(): DraftLog[] {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            return json ? JSON.parse(json) : [];
        } catch (error) {
            console.error('Failed to parse draft logs', error);
            return [];
        }
    },

    getLog(id: string): DraftLog | undefined {
        const logs = this.getAllLogs();
        return logs.find(log => log.id === id);
    },

    saveLog(log: DraftLog): void {
        const logs = this.getAllLogs();
        // Check if log already exists and update it, or add new
        const existingIndex = logs.findIndex(l => l.id === log.id);

        if (existingIndex >= 0) {
            logs[existingIndex] = log;
        } else {
            logs.unshift(log); // Add to beginning
        }

        // Limit to last 50 drafts to save space
        if (logs.length > 50) {
            logs.length = 50;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    },

    deleteLog(id: string): void {
        const logs = this.getAllLogs().filter(l => l.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    },

    // Helper to create a new log entry
    createLog(settings: DraftSettings): DraftLog {
        return {
            id: crypto.randomUUID(),
            date: Date.now(),
            settings,
            picks: []
        };
    }
};
