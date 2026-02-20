import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type {
  AppState, Task, TaskEdge, Routine, AuditEntry,
  UserPreferences, ViewType, TaskStatus, AuditAction,
} from '../types/kernel';
import {
  getAllTasks, putTask, deleteTask as dbDeleteTask,
  getAllEdges, putEdge, deleteEdge as dbDeleteEdge,
  getAllRoutines, putRoutine,
  getAllAuditEntries, appendAudit,
  getPreferences, putPreferences,
  isSeeded, importKernel,
} from './db';
import { seedTasks, seedEdges, seedRoutines, seedAuditLog, defaultPreferences } from '../data/seed';
import { generateId, computeHash } from '../utils/canonical';
import { createAuditEntry } from '../utils/audit';

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_ALL'; payload: Omit<AppState, 'currentView' | 'selectedTaskId' | 'editingTaskId' | 'showTaskEditor' | 'isLoading' | 'aiSuggestion'> }
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'SET_EDITING'; payload: string | null }
  | { type: 'SHOW_EDITOR'; payload: boolean }
  | { type: 'UPSERT_TASK'; payload: Task }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'UPSERT_EDGE'; payload: TaskEdge }
  | { type: 'REMOVE_EDGE'; payload: string }
  | { type: 'ADD_AUDIT'; payload: AuditEntry }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'SET_AI_SUGGESTION'; payload: string | null }
  | { type: 'UPSERT_ROUTINE'; payload: Routine };

const initialState: AppState = {
  tasks: [],
  edges: [],
  routines: [],
  auditLog: [],
  preferences: defaultPreferences,
  currentView: 'list',
  selectedTaskId: null,
  editingTaskId: null,
  showTaskEditor: false,
  isLoading: true,
  aiSuggestion: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOAD_ALL':
      return {
        ...state,
        ...action.payload,
        currentView: action.payload.preferences.default_view,
        isLoading: false,
      };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SELECT_TASK':
      return { ...state, selectedTaskId: action.payload };
    case 'SET_EDITING':
      return { ...state, editingTaskId: action.payload, showTaskEditor: action.payload !== null };
    case 'SHOW_EDITOR':
      return { ...state, showTaskEditor: action.payload, editingTaskId: action.payload ? state.editingTaskId : null };
    case 'UPSERT_TASK': {
      const exists = state.tasks.find((t) => t.$lds.id === action.payload.$lds.id);
      return {
        ...state,
        tasks: exists
          ? state.tasks.map((t) => (t.$lds.id === action.payload.$lds.id ? action.payload : t))
          : [...state.tasks, action.payload],
      };
    }
    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.$lds.id !== action.payload),
        edges: state.edges.filter((e) => e.source !== action.payload && e.target !== action.payload),
      };
    case 'UPSERT_EDGE': {
      const exists = state.edges.find((e) => e.id === action.payload.id);
      return {
        ...state,
        edges: exists
          ? state.edges.map((e) => (e.id === action.payload.id ? action.payload : e))
          : [...state.edges, action.payload],
      };
    }
    case 'REMOVE_EDGE':
      return { ...state, edges: state.edges.filter((e) => e.id !== action.payload) };
    case 'ADD_AUDIT':
      return { ...state, auditLog: [...state.auditLog, action.payload] };
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.payload };
    case 'SET_AI_SUGGESTION':
      return { ...state, aiSuggestion: action.payload };
    case 'UPSERT_ROUTINE': {
      const exists = state.routines.find((r) => r.$lds.id === action.payload.$lds.id);
      return {
        ...state,
        routines: exists
          ? state.routines.map((r) => (r.$lds.id === action.payload.$lds.id ? action.payload : r))
          : [...state.routines, action.payload],
      };
    }
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  createTask: (task: Omit<Task, '$lds'>) => Promise<Task>;
  updateTask: (task: Task) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deferTask: (taskId: string) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  addEdge: (source: string, target: string, type: TaskEdge['type']) => Promise<void>;
  removeEdge: (edgeId: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  setView: (view: ViewType) => void;
  selectTask: (id: string | null) => void;
  editTask: (id: string | null) => void;
  showEditor: (show: boolean) => void;
  logAudit: (action: AuditAction, entityType: AuditEntry['entity_type'], entityId: string, details?: Record<string, unknown>) => Promise<void>;
  exportAllData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data on mount
  useEffect(() => {
    (async () => {
      const seeded = await isSeeded();
      if (!seeded) {
        await importKernel({
          tasks: seedTasks,
          edges: seedEdges,
          routines: seedRoutines,
          preferences: defaultPreferences,
        });
        for (const entry of seedAuditLog) {
          await appendAudit(entry);
        }
      }

      const [tasks, edges, routines, audit, prefs] = await Promise.all([
        getAllTasks(),
        getAllEdges(),
        getAllRoutines(),
        getAllAuditEntries(),
        getPreferences(),
      ]);

      dispatch({
        type: 'LOAD_ALL',
        payload: {
          tasks,
          edges,
          routines,
          auditLog: audit,
          preferences: prefs || defaultPreferences,
        },
      });
    })();
  }, []);

  const logAudit = useCallback(async (
    action: AuditAction,
    entityType: AuditEntry['entity_type'],
    entityId: string,
    details: Record<string, unknown> = {}
  ) => {
    const entry = createAuditEntry(action, entityType, entityId, details);
    await appendAudit(entry);
    dispatch({ type: 'ADD_AUDIT', payload: entry });
  }, []);

  const createTask = useCallback(async (taskData: Omit<Task, '$lds'>): Promise<Task> => {
    const id = generateId('task');
    const nowISO = new Date().toISOString();
    const task: Task = {
      ...taskData,
      $lds: {
        v: '1.0.0',
        type: 'kernel.task',
        id,
        created: nowISO,
        updated: nowISO,
        content_hash: '',
      },
    };
    task.$lds.content_hash = await computeHash(task);
    await putTask(task);
    dispatch({ type: 'UPSERT_TASK', payload: task });
    await logAudit('task_created', 'task', id, { title: task.title });
    return task;
  }, [logAudit]);

  const updateTask = useCallback(async (task: Task) => {
    task.$lds.updated = new Date().toISOString();
    task.$lds.content_hash = await computeHash(task);
    await putTask(task);
    dispatch({ type: 'UPSERT_TASK', payload: task });
    await logAudit('task_edited', 'task', task.$lds.id, { title: task.title });
  }, [logAudit]);

  const completeTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((t) => t.$lds.id === taskId);
    if (!task) return;
    const updated: Task = {
      ...task,
      status: 'completed' as TaskStatus,
      completed_at: new Date().toISOString(),
      micro_steps: task.micro_steps.map((s) => ({ ...s, completed: true })),
    };
    updated.$lds = { ...updated.$lds, updated: new Date().toISOString() };
    updated.$lds.content_hash = await computeHash(updated);
    await putTask(updated);
    dispatch({ type: 'UPSERT_TASK', payload: updated });
    await logAudit('task_completed', 'task', taskId, { title: task.title });
  }, [state.tasks, logAudit]);

  const deferTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((t) => t.$lds.id === taskId);
    if (!task) return;
    const updated: Task = { ...task, status: 'deferred' as TaskStatus };
    updated.$lds = { ...updated.$lds, updated: new Date().toISOString() };
    updated.$lds.content_hash = await computeHash(updated);
    await putTask(updated);
    dispatch({ type: 'UPSERT_TASK', payload: updated });
    await logAudit('task_deferred', 'task', taskId, { title: task.title });
  }, [state.tasks, logAudit]);

  const removeTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((t) => t.$lds.id === taskId);
    await dbDeleteTask(taskId);
    // Remove related edges
    const relatedEdges = state.edges.filter((e) => e.source === taskId || e.target === taskId);
    for (const edge of relatedEdges) {
      await dbDeleteEdge(edge.id);
    }
    dispatch({ type: 'REMOVE_TASK', payload: taskId });
    await logAudit('task_deleted', 'task', taskId, { title: task?.title || 'Unknown' });
  }, [state.tasks, state.edges, logAudit]);

  const addEdge = useCallback(async (source: string, target: string, type: TaskEdge['type']) => {
    const edge: TaskEdge = { id: generateId('edge'), source, target, type };
    await putEdge(edge);
    dispatch({ type: 'UPSERT_EDGE', payload: edge });
    await logAudit('edge_created', 'edge', edge.id, { source, target, type });
  }, [logAudit]);

  const removeEdge = useCallback(async (edgeId: string) => {
    await dbDeleteEdge(edgeId);
    dispatch({ type: 'REMOVE_EDGE', payload: edgeId });
    await logAudit('edge_deleted', 'edge', edgeId);
  }, [logAudit]);

  const updatePreferences = useCallback(async (partial: Partial<UserPreferences>) => {
    const updated = { ...state.preferences, ...partial };
    await putPreferences(updated);
    dispatch({ type: 'SET_PREFERENCES', payload: updated });
  }, [state.preferences]);

  const setView = useCallback((view: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  const selectTask = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_TASK', payload: id });
  }, []);

  const editTask = useCallback((id: string | null) => {
    dispatch({ type: 'SET_EDITING', payload: id });
  }, []);

  const showEditor = useCallback((show: boolean) => {
    dispatch({ type: 'SHOW_EDITOR', payload: show });
  }, []);

  const exportAllData = useCallback(async (): Promise<string> => {
    const data = await exportKernel();
    await logAudit('kernel_exported', 'kernel', 'full_export');
    return JSON.stringify(data, null, 2);
  }, [logAudit]);

  const importData = useCallback(async (json: string) => {
    const data = JSON.parse(json);
    await importKernel(data);

    const [tasks, edges, routines, audit, prefs] = await Promise.all([
      getAllTasks(),
      getAllEdges(),
      getAllRoutines(),
      getAllAuditEntries(),
      getPreferences(),
    ]);

    dispatch({
      type: 'LOAD_ALL',
      payload: {
        tasks,
        edges,
        routines,
        auditLog: audit,
        preferences: prefs || defaultPreferences,
      },
    });
    await logAudit('kernel_imported', 'kernel', 'full_import');
  }, [logAudit]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        createTask,
        updateTask,
        completeTask,
        deferTask,
        removeTask,
        addEdge,
        removeEdge,
        updatePreferences,
        setView,
        selectTask,
        editTask,
        showEditor,
        logAudit,
        exportAllData,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
