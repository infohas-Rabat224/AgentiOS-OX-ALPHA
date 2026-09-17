import fs from 'node:fs';
import path from 'node:path';
import { agenticOSEventBus } from './agenticOSEventBus';
import type { GatewayPlatform, AllowlistEntry } from './messagingGatewayService';

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  platform: GatewayPlatform;
  identifier: string;
  senderName: string;
  action: string;
  allowed: boolean;
  reason: string;
  role?: string;
}

export type AccessPolicy = 'allowlist_only' | 'trusted_open' | 'admin_only';

/**
 * AgenticOS Access Controller Service
 * 
 * Enforces persistent allowlists and role-based access control for WhatsApp and Telegram IDs.
 * Ensures only authorized contacts can trigger agent missions, commands, or workflows
 * through the messaging gateways.
 */
export class AccessControllerService {
  private static instance: AccessControllerService;
  private storageDir: string;
  private allowlistPath: string;
  private auditLogPath: string;

  private policy: AccessPolicy = 'allowlist_only';
  private rateLimitPerMinute = 20;
  private entries: Map<string, AllowlistEntry> = new Map();
  private auditLogs: SecurityAuditEntry[] = [];
  private rateLimitTracker: Map<string, { count: number; resetAt: number }> = new Map();

  public static getInstance(): AccessControllerService {
    if (!AccessControllerService.instance) {
      AccessControllerService.instance = new AccessControllerService();
    }
    return AccessControllerService.instance;
  }

  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
    this.storageDir = path.join(home, '.agenticos', 'security');
    this.allowlistPath = path.join(this.storageDir, 'allowlist.json');
    this.auditLogPath = path.join(this.storageDir, 'access-audit.json');

    this.ensureDirectory();
    this.loadAllowlist();
    this.loadAuditLogs();
  }

  private ensureDirectory() {
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
      } catch {
        try {
          fs.mkdirSync(this.storageDir, { recursive: true });
        } catch {}
      }
    }
  }

  private loadAllowlist() {
    try {
      if (fs.existsSync(this.allowlistPath)) {
        const raw = fs.readFileSync(this.allowlistPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.policy) this.policy = data.policy;
        if (data.rateLimitPerMinute) this.rateLimitPerMinute = data.rateLimitPerMinute;

        this.entries.clear();
        if (Array.isArray(data.entries)) {
          for (const entry of data.entries) {
            const key = `${entry.platform}:${entry.identifier.toLowerCase()}`;
            this.entries.set(key, entry);
          }
        }
      } else {
        // Seed default administrator if fresh install
        this.addDefaultAdministrator();
      }
    } catch (err: any) {
      console.error('[AccessController] Error loading allowlist:', err.message);
      this.addDefaultAdministrator();
    }
  }

  private addDefaultAdministrator() {
    // Clean initial state with standard operator template
    const admin: AllowlistEntry = {
      id: 'allow-initial-admin',
      platform: 'whatsapp',
      identifier: '+15559876543',
      name: 'Primary System Administrator',
      role: 'Administrator',
      status: 'ALLOWED',
      addedAt: new Date().toISOString(),
    };
    this.entries.set(`${admin.platform}:${admin.identifier.toLowerCase()}`, admin);
    this.persistAllowlist();
  }

  private persistAllowlist() {
    try {
      this.ensureDirectory();
      const list = Array.from(this.entries.values());
      const payload = {
        version: 2,
        policy: this.policy,
        rateLimitPerMinute: this.rateLimitPerMinute,
        updatedAt: new Date().toISOString(),
        entries: list,
      };

      const tmp = `${this.allowlistPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmp, this.allowlistPath);
    } catch (err: any) {
      console.error('[AccessController] Failed to persist allowlist:', err.message);
    }
  }

  private loadAuditLogs() {
    try {
      if (fs.existsSync(this.auditLogPath)) {
        const raw = fs.readFileSync(this.auditLogPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.auditLogs = parsed.slice(-100);
        }
      }
    } catch {}
  }

  private persistAuditLogs() {
    try {
      this.ensureDirectory();
      const tmp = `${this.auditLogPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.auditLogs.slice(-100), null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmp, this.auditLogPath);
    } catch {}
  }

  /**
   * Evaluates if a sender is authorized to interact with the system and trigger missions.
   */
  public authorize(
    platform: GatewayPlatform,
    identifier: string,
    senderName: string,
    isTriggerOrMission = false
  ): {
    allowed: boolean;
    role: 'Guest' | 'Trusted User' | 'Administrator';
    status: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'BLOCKED';
    reason?: string;
    entry?: AllowlistEntry;
  } {
    const cleanId = identifier.trim().toLowerCase();
    const rateKey = `${platform}:${cleanId}`;
    const now = Date.now();

    // 1. Enforce Rate Limiting
    const rate = this.rateLimitTracker.get(rateKey) || { count: 0, resetAt: now + 60000 };
    if (now > rate.resetAt) {
      rate.count = 1;
      rate.resetAt = now + 60000;
    } else {
      rate.count++;
    }
    this.rateLimitTracker.set(rateKey, rate);

    if (rate.count > this.rateLimitPerMinute) {
      const reason = `Rate limit exceeded (${this.rateLimitPerMinute} requests/min)`;
      this.recordAudit(platform, identifier, senderName, 'rate_limit', false, reason);
      return { allowed: false, role: 'Guest', status: 'DENIED', reason };
    }

    // 2. Lookup in Persistent Allowlist
    const key = `${platform}:${cleanId}`;
    const entry = this.entries.get(key);

    if (entry) {
      entry.lastActive = new Date().toISOString();
      this.persistAllowlist();

      if (entry.status === 'BLOCKED' || entry.status === 'DENIED') {
        const reason = `Account explicitly ${entry.status} by administrator`;
        this.recordAudit(platform, identifier, senderName, 'mission_trigger', false, reason, entry.role);
        return { allowed: false, role: entry.role, status: entry.status, reason, entry };
      }

      if (entry.status === 'PENDING_APPROVAL') {
        const reason = 'Contact is awaiting operator approval before access is granted';
        this.recordAudit(platform, identifier, senderName, 'mission_trigger', false, reason, entry.role);
        return { allowed: false, role: entry.role, status: 'PENDING_APPROVAL', reason, entry };
      }

      // Check admin-only policy
      if (this.policy === 'admin_only' && entry.role !== 'Administrator') {
        const reason = 'Gateway restricted to Administrator role only';
        this.recordAudit(platform, identifier, senderName, 'mission_trigger', false, reason, entry.role);
        return { allowed: false, role: entry.role, status: entry.status, reason, entry };
      }

      this.recordAudit(platform, identifier, senderName, 'mission_trigger', true, 'Authorized via allowlist', entry.role);
      return { allowed: true, role: entry.role, status: entry.status, entry };
    }

    // 3. Unrecognized contact handling
    if (this.policy === 'trusted_open') {
      this.recordAudit(platform, identifier, senderName, 'open_access', true, 'Trusted open policy active', 'Trusted User');
      return { allowed: true, role: 'Trusted User', status: 'ALLOWED' };
    }

    // If allowlist_only or admin_only, register as PENDING_APPROVAL so operator can review
    const pendingEntry: AllowlistEntry = {
      id: `pending-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      platform,
      identifier,
      name: senderName,
      role: 'Guest',
      status: 'PENDING_APPROVAL',
      addedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    this.entries.set(key, pendingEntry);
    this.persistAllowlist();

    const reason = 'Access denied: Contact not authorized on persistent allowlist (registered for review)';
    this.recordAudit(platform, identifier, senderName, 'mission_trigger', false, reason, 'Guest');

    // Notify Event Bus
    agenticOSEventBus.publish(
      'gateway.security.denied',
      {
        platform,
        identifier,
        senderName,
        reason,
        pendingEntry,
      },
      'access-controller'
    );

    return {
      allowed: false,
      role: 'Guest',
      status: 'PENDING_APPROVAL',
      reason,
      entry: pendingEntry,
    };
  }

  private recordAudit(
    platform: GatewayPlatform,
    identifier: string,
    senderName: string,
    action: string,
    allowed: boolean,
    reason: string,
    role?: string
  ) {
    const audit: SecurityAuditEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      platform,
      identifier,
      senderName,
      action,
      allowed,
      reason,
      role,
    };
    this.auditLogs.unshift(audit);
    if (this.auditLogs.length > 100) this.auditLogs.pop();
    this.persistAuditLogs();
  }

  public getAllowlist(): AllowlistEntry[] {
    return Array.from(this.entries.values());
  }

  public getPolicy(): AccessPolicy {
    return this.policy;
  }

  public setPolicy(policy: AccessPolicy) {
    this.policy = policy;
    this.persistAllowlist();
  }

  public addEntry(entry: Omit<AllowlistEntry, 'id' | 'addedAt'>): AllowlistEntry {
    const cleanId = entry.identifier.trim();
    const key = `${entry.platform}:${cleanId.toLowerCase()}`;
    const newEntry: AllowlistEntry = {
      ...entry,
      identifier: cleanId,
      id: `allow-${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    this.entries.set(key, newEntry);
    this.persistAllowlist();
    return newEntry;
  }

  public updateEntry(id: string, updates: Partial<AllowlistEntry>): AllowlistEntry | null {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.id === id) {
        const updated = { ...entry, ...updates };
        this.entries.set(key, updated);
        this.persistAllowlist();
        return updated;
      }
    }
    return null;
  }

  public removeEntry(id: string): boolean {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.id === id) {
        this.entries.delete(key);
        this.persistAllowlist();
        return true;
      }
    }
    return false;
  }

  public getAuditLogs(): SecurityAuditEntry[] {
    return this.auditLogs;
  }
}

export const accessControllerService = AccessControllerService.getInstance();
