// LDS Kernel Data Model for KernelADHD

export interface LDSMeta {
  v: string;
  type: string;
  id: string;
  created: string;
  updated: string;
  content_hash: string;
}

export type EnergyLevel = 'low' | 'medium' | 'high';
export type Importance = 'important' | 'optional' | 'someday';
export type TaskStatus = 'pending' | 'active' | 'completed' | 'deferred';
export type EdgeType = 'depends_on' | 'blocks' | 'related_to' | 'part_of' | 'scheduled_after';

export interface MicroStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}

export interface Task {
  $lds: LDSMeta;
  title: string;
  description: string;
  status: TaskStatus;
  energy: EnergyLevel;
  importance: Importance;
  micro_steps: MicroStep[];
  due_date: string | null;
  scheduled_date: string | null;
  tags: string[];
  recurring: RecurringConfig | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringConfig {
  frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly';
  days?: number[]; // 0=Sun..6=Sat
  time?: string;   // HH:MM
}

export interface Routine {
  $lds: LDSMeta;
  name: string;
  description: string;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
  task_ids: string[];
  active: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity_type: 'task' | 'routine' | 'edge' | 'kernel' | 'ai_suggestion';
  entity_id: string;
  details: Record<string, unknown>;
}

export type AuditAction =
  | 'task_created'
  | 'task_edited'
  | 'task_completed'
  | 'task_deferred'
  | 'task_deleted'
  | 'routine_created'
  | 'routine_edited'
  | 'edge_created'
  | 'edge_deleted'
  | 'kernel_imported'
  | 'kernel_exported'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_rejected';

export interface UserPreferences {
  theme: 'calm' | 'ocean' | 'forest' | 'sunset' | 'midnight';
  default_view: ViewType;
  max_visible_tasks: number;
  audio_enabled: boolean;
  notifications_enabled: boolean;
  ai_api_key: string | null;
  ai_provider: 'groq' | 'anthropic' | 'openai';
}

export type ViewType = 'list' | 'focus' | 'graph' | 'timeline' | 'history';

export interface AppState {
  tasks: Task[];
  edges: TaskEdge[];
  routines: Routine[];
  auditLog: AuditEntry[];
  preferences: UserPreferences;
  currentView: ViewType;
  selectedTaskId: string | null;
  editingTaskId: string | null;
  showTaskEditor: boolean;
  isLoading: boolean;
  aiSuggestion: string | null;
}
