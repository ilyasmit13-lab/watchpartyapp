
export interface PlaybackState {
    isPlaying: boolean;
    positionMs: number;
    updatedAt: number; // Server timestamp (Date.now())
    playbackRate: number;
}

export type SyncAction =
    | { type: 'NONE' }
    | { type: 'SEEK', targetMs: number }
    | { type: 'SET_RATE', rate: number }
    | { type: 'PLAY' }
    | { type: 'PAUSE' };

const DRIFT_THRESHOLD_SOFT_MS = 50;  // Threshold to start soft correction
const DRIFT_THRESHOLD_HARD_MS = 800; // Threshold to force seek
const SYNC_INTERVAL_MS = 1000;       // How often to check sync

export class PlaybackSyncService {
    private serverState: PlaybackState | null = null;
    private serverTimeOffset: number = 0; // Difference between local Date.now() and server time

    /**
     * Update the authoritative state received from server
     */
    updateServerState(state: PlaybackState, serverTimestampReceived: number) {
        this.serverState = state;
        // Simple clock sync approximation: 
        // We assume latency is symmetrical (not always true but usually play for prototypes)
        // Ideally we use an NTP-like exchange. Here we assume device clocks are roughly 
        // accurate or we use the timestamp from the socket handshake.
        // For this logic, we'll assume `state.updatedAt` is in the same timeframe 
        // or we calculated an offset.
    }

    /**
     * Set the calculated offset between local clock and server clock
     * offset = serverTime - localTime
     */
    setClockOffset(offset: number) {
        this.serverTimeOffset = offset;
    }

    private getServerTime(): number {
        return Date.now() + this.serverTimeOffset;
    }

    /**
     * Calculate where the video SHOULD be right now
     */
    getTargetPosition(): number {
        if (!this.serverState) return 0;

        if (!this.serverState.isPlaying) {
            return this.serverState.positionMs;
        }

        const now = this.getServerTime();
        const elapsed = Math.max(0, now - this.serverState.updatedAt);
        return this.serverState.positionMs + (elapsed * this.serverState.playbackRate);
    }

    /**
     * Determine what action the player needs to take to stay in sync
     * @param currentLocalPosMs Current position of the local player
     * @param isLocalPlaying Current playing state of local player
     */
    calculateSyncAction(currentLocalPosMs: number, isLocalPlaying: boolean): SyncAction {
        if (!this.serverState) return { type: 'NONE' };

        // 1. Check Play/Pause state
        if (this.serverState.isPlaying !== isLocalPlaying) {
            return this.serverState.isPlaying ? { type: 'PLAY' } : { type: 'PAUSE' };
        }

        // If paused, just ensure we are at the right frame
        if (!this.serverState.isPlaying) {
            const drift = Math.abs(currentLocalPosMs - this.serverState.positionMs);
            if (drift > DRIFT_THRESHOLD_HARD_MS) {
                return { type: 'SEEK', targetMs: this.serverState.positionMs };
            }
            return { type: 'NONE' };
        }

        // 2. Playback is active, check timing drift
        const targetMs = this.getTargetPosition();
        const drift = targetMs - currentLocalPosMs; // Positive = we are behind, Negative = we are ahead

        // CASE A: Hard Drift (Too far behind or ahead) -> Seek
        if (Math.abs(drift) > DRIFT_THRESHOLD_HARD_MS) {
            return { type: 'SEEK', targetMs: targetMs };
        }

        // CASE B: Soft Drift (Behind) -> Speed up
        if (drift > DRIFT_THRESHOLD_SOFT_MS) {
            // Speed up slightly (e.g. 5%)
            // Only if current rate is normal (1.0)
            return { type: 'SET_RATE', rate: this.serverState.playbackRate * 1.05 };
        }

        // CASE C: Soft Drift (Ahead) -> Slow down
        if (drift < -DRIFT_THRESHOLD_SOFT_MS) {
            // Slow down slightly
            return { type: 'SET_RATE', rate: this.serverState.playbackRate * 0.95 };
        }

        // CASE D: In Sync -> Ensure normal rate
        return { type: 'SET_RATE', rate: this.serverState.playbackRate };
    }
}

export const playbackSync = new PlaybackSyncService();
