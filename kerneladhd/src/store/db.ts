import { openDB, type IDBPDatabase } from 'idb';
import type { Task, TaskEdge, Routine, AuditEntry, UserPreferences } from '../types/kernel';

const DB_NAME = 'kerneladhd';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: '$lds.id' });
        taskStore.createIndex('status', 'status');
        taskStore.createIndex('scheduled_date', 'scheduled_date');
        taskStore.createIndex('importance', 'importance');
      }
      if (!db.objectStoreNames.contains('edges')) {
        const edgeStore = db.createObjectStore('edges', { keyPath: 'id' });
        edgeStore.createIndex('source', 'source');
        edgeStore.createIndex('target', 'target');
        edgeStore.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('routines')) {
        db.createObjectStore('routines', { keyPath: '$lds.id' });
      }
      if (!db.objectStoreNames.contains('audit')) {
        const auditStore = db.createObjectStore('audit', { keyPath: 'id' });
        auditStore.createIndex('timestamp', 'timestamp');
        auditStore.createIndex('entity_id', 'entity_id');
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// Tasks
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function putTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', taskId);
}

// Edges
export async function getAllEdges(): Promise<TaskEdge[]> {
  const db = await getDB();
  return db.getAll('edges');
}

export async function putEdge(edge: TaskEdge): Promise<void> {
  const db = await getDB();
  await db.put('edges', edge);
}

export async function deleteEdge(edgeId: string): Promise<void> {
  const db = await getDB();
  await db.delete('edges', edgeId);
}

// Routines
export async function getAllRoutines(): Promise<Routine[]> {
  const db = await getDB();
  return db.getAll('routines');
}

export async function putRoutine(routine: Routine): Promise<void> {
  const db = await getDB();
  await db.put('routines', routine);
}

// Audit Log (append-only)
export async function getAllAuditEntries(): Promise<AuditEntry[]> {
  const db = await getDB();
  return db.getAll('audit');
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  const db = await getDB();
  await db.add('audit', entry);
}

// Preferences
export async function getPreferences(): Promise<UserPreferences | null> {
  const db = await getDB();
  const result = await db.get('preferences', 'user_prefs');
  if (!result) return null;
  const { id: _, ...prefs } = result;
  return prefs as UserPreferences;
}

export async function putPreferences(prefs: UserPreferences): Promise<void> {
  const db = await getDB();
  await db.put('preferences', { id: 'user_prefs', ...prefs });
}

// Check if seeded
export async function isSeeded(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('tasks');
  return count > 0;
}

// Export entire kernel
export async function exportKernel(): Promise<{
  tasks: Task[];
  edges: TaskEdge[];
  routines: Routine[];
  audit: AuditEntry[];
  preferences: UserPreferences | null;
}> {
  return {
    tasks: await getAllTasks(),
    edges: await getAllEdges(),
    routines: await getAllRoutines(),
    audit: await getAllAuditEntries(),
    preferences: await getPreferences(),
  };
}

// Import kernel (replaces all data)
export async function importKernel(data: {
  tasks: Task[];
  edges: TaskEdge[];
  routines: Routine[];
  preferences?: UserPreferences;
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tasks', 'edges', 'routines', 'preferences'], 'readwrite');

  await tx.objectStore('tasks').clear();
  for (const task of data.tasks) {
    await tx.objectStore('tasks').put(task);
  }

  await tx.objectStore('edges').clear();
  for (const edge of data.edges) {
    await tx.objectStore('edges').put(edge);
  }

  await tx.objectStore('routines').clear();
  for (const routine of data.routines) {
    await tx.objectStore('routines').put(routine);
  }

  if (data.preferences) {
    await tx.objectStore('preferences').put({ id: 'user_prefs', ...data.preferences });
  }

  await tx.done;
}
