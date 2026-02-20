import type { AuditEntry, AuditAction } from '../types/kernel';
import { generateId } from './canonical';

export function createAuditEntry(
  action: AuditAction,
  entityType: AuditEntry['entity_type'],
  entityId: string,
  details: Record<string, unknown> = {}
): AuditEntry {
  return {
    id: generateId('audit'),
    timestamp: new Date().toISOString(),
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  };
}
