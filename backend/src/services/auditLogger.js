import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LOGS_DIR = path.resolve('logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'audit.jsonl');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Generate SHA-256 checksum for immutable audit compliance verification
 */
export const generateIntegrityHash = (data) => {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Append audit event entry to ./logs/audit.jsonl
 */
export const recordAuditEvent = async ({
  action,
  targetType,
  targetId,
  actor = 'admin',
  reason = '',
  metadata = {},
}) => {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload = {
    id: eventId,
    timestamp,
    actor,
    action,
    targetType,
    targetId,
    reason,
    metadata,
  };

  const integrityHash = generateIntegrityHash(payload);
  const auditRecord = {
    ...payload,
    integrityHash,
  };

  const line = JSON.stringify(auditRecord) + '\n';
  await fs.promises.appendFile(AUDIT_LOG_FILE, line, 'utf-8');

  return auditRecord;
};

/**
 * Read all local audit logs from ./logs/audit.jsonl
 */
export const getLocalAuditLogs = async () => {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return [];
  }

  try {
    const raw = await fs.promises.readFile(AUDIT_LOG_FILE, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    return lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error reading local audit logs:', error);
    return [];
  }
};

