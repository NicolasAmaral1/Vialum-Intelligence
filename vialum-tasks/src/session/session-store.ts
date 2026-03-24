import { ChildProcess } from 'child_process';

export interface SessionInfo {
  workflowId: string;
  accountId: string;
  process: ChildProcess | null;
  sessionId: string | null;
  status: 'starting' | 'running' | 'stopping';
  startedAt: Date;
  commandQueue: string[];
}

/**
 * In-memory store of active sessions.
 * This is intentionally NOT persistent — persistence lives in the DB (workflow.sessionId, workflow.status).
 * On restart, recoverStaleSessions() in index.ts marks orphaned workflows as 'paused'.
 */
class SessionStore {
  private sessions = new Map<string, SessionInfo>();
  private locks = new Set<string>(); // mutex per workflowId

  get(workflowId: string): SessionInfo | undefined {
    return this.sessions.get(workflowId);
  }

  set(workflowId: string, info: SessionInfo): void {
    this.sessions.set(workflowId, info);
  }

  delete(workflowId: string): void {
    this.sessions.delete(workflowId);
    this.locks.delete(workflowId);
  }

  has(workflowId: string): boolean {
    return this.sessions.has(workflowId);
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  activeCountForTenant(accountId: string): number {
    let count = 0;
    for (const info of this.sessions.values()) {
      if (info.accountId === accountId) count++;
    }
    return count;
  }

  allActive(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  // Simple mutex — prevents two concurrent spawns for the same workflow
  acquireLock(workflowId: string): boolean {
    if (this.locks.has(workflowId)) return false;
    this.locks.add(workflowId);
    return true;
  }

  releaseLock(workflowId: string): void {
    this.locks.delete(workflowId);
  }
}

export const sessionStore = new SessionStore();
