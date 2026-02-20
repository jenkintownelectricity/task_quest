import { useState, useMemo } from 'react';
import { Plus, Filter, ChevronDown } from 'lucide-react';
import { useApp } from '../store/context';
import { TaskCard } from './TaskCard';
import { getTheme } from '../utils/theme';
import type { EnergyLevel, Importance } from '../types/kernel';

export function ListView() {
  const { state, showEditor, editTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const today = new Date().toISOString().split('T')[0];

  const [showAll, setShowAll] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterEnergy, setFilterEnergy] = useState<EnergyLevel | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeTasks = useMemo(() => {
    let tasks = state.tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'deferred'
    );

    if (filterTag) {
      tasks = tasks.filter((t) => t.tags.includes(filterTag));
    }
    if (filterEnergy) {
      tasks = tasks.filter((t) => t.energy === filterEnergy);
    }

    // Sort: scheduled today first, then by importance, then by due date
    tasks.sort((a, b) => {
      const aToday = a.scheduled_date === today ? 0 : 1;
      const bToday = b.scheduled_date === today ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;

      const importanceOrder: Record<Importance, number> = { important: 0, optional: 1, someday: 2 };
      if (importanceOrder[a.importance] !== importanceOrder[b.importance]) {
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      }

      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    return tasks;
  }, [state.tasks, filterTag, filterEnergy, today]);

  const todayTasks = activeTasks.filter(
    (t) => t.scheduled_date === today || (!t.scheduled_date && t.importance === 'important')
  );
  const upcomingTasks = activeTasks.filter(
    (t) => t.scheduled_date && t.scheduled_date > today
  );
  const somedayTasks = activeTasks.filter(
    (t) => !t.scheduled_date && t.importance !== 'important'
  );

  const visibleToday = showAll ? todayTasks : todayTasks.slice(0, state.preferences.max_visible_tasks);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    state.tasks.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [state.tasks]);

  const handleNewTask = () => {
    editTask(null);
    showEditor(true);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: 0 }}>
            Today
          </h1>
          <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '4px 0 0' }}>
            {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''} for today
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? theme.primary : theme.surfaceHover,
              color: showFilters ? '#fff' : theme.textSecondary,
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <Filter size={14} /> Filter
          </button>
          <button
            onClick={handleNewTask}
            style={{
              background: theme.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              minHeight: '48px',
            }}
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 600 }}>TAG:</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterTag(null)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                background: !filterTag ? theme.primary : theme.surfaceHover,
                color: !filterTag ? '#fff' : theme.textSecondary,
              }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: filterTag === tag ? theme.primary : theme.surfaceHover,
                  color: filterTag === tag ? '#fff' : theme.textSecondary,
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 600, marginLeft: '8px' }}>ENERGY:</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['low', 'medium', 'high'] as EnergyLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFilterEnergy(filterEnergy === level ? null : level)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: filterEnergy === level ? theme.primary : theme.surfaceHover,
                  color: filterEnergy === level ? '#fff' : theme.textSecondary,
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's Tasks */}
      {visibleToday.length > 0 ? (
        <div>
          {visibleToday.map((task) => (
            <TaskCard key={task.$lds.id} task={task} />
          ))}
          {!showAll && todayTasks.length > state.preferences.max_visible_tasks && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px dashed ${theme.border}`,
                borderRadius: '10px',
                background: 'transparent',
                color: theme.textSecondary,
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '8px',
              }}
            >
              <ChevronDown size={14} />
              Show {todayTasks.length - state.preferences.max_visible_tasks} more
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: theme.textMuted,
          }}
        >
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>Nothing scheduled for today</p>
          <p style={{ fontSize: '13px' }}>Add a task or check upcoming items</p>
        </div>
      )}

      {/* Upcoming */}
      {upcomingTasks.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: theme.textSecondary, marginBottom: '12px' }}>
            Upcoming
          </h2>
          {upcomingTasks.slice(0, 5).map((task) => (
            <TaskCard key={task.$lds.id} task={task} compact />
          ))}
        </div>
      )}

      {/* Someday */}
      {somedayTasks.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: theme.textSecondary, marginBottom: '12px' }}>
            Someday / Maybe
          </h2>
          {somedayTasks.slice(0, 3).map((task) => (
            <TaskCard key={task.$lds.id} task={task} compact />
          ))}
        </div>
      )}
    </div>
  );
}
