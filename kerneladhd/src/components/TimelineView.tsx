import { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useApp } from '../store/context';
import { TaskCard } from './TaskCard';
import { getTheme } from '../utils/theme';

export function TimelineView() {
  const { state } = useApp();
  const theme = getTheme(state.preferences.theme);
  const today = new Date().toISOString().split('T')[0];

  const timeline = useMemo(() => {
    const activeTasks = state.tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'deferred'
    );

    // Group by date
    const groups: Record<string, typeof activeTasks> = {};

    // Overdue
    const overdue = activeTasks.filter(
      (t) => t.due_date && t.due_date < today
    );
    if (overdue.length > 0) groups['Overdue'] = overdue;

    // Today
    const todayTasks = activeTasks.filter(
      (t) => t.scheduled_date === today || (t.due_date === today && t.scheduled_date !== today)
    );
    if (todayTasks.length > 0) groups['Today'] = todayTasks;

    // Next 7 days
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

      const dayTasks = activeTasks.filter(
        (t) => t.scheduled_date === dateStr || t.due_date === dateStr
      );
      if (dayTasks.length > 0) groups[dayName] = dayTasks;
    }

    // Unscheduled
    const unscheduled = activeTasks.filter(
      (t) => !t.scheduled_date && !t.due_date
    );
    if (unscheduled.length > 0) groups['Unscheduled'] = unscheduled;

    return groups;
  }, [state.tasks, today]);

  const groupEntries = Object.entries(timeline);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: 0 }}>
          Timeline
        </h1>
        <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '4px 0 0' }}>
          Your tasks spread across the next week
        </p>
      </div>

      {groupEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted }}>
          <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No tasks on the timeline</p>
          <p style={{ fontSize: '13px' }}>Schedule tasks with dates to see them here.</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div
            style={{
              position: 'absolute',
              left: '11px',
              top: '24px',
              bottom: '24px',
              width: '2px',
              background: theme.border,
            }}
          />

          {groupEntries.map(([label, tasks]) => (
            <div key={label} style={{ position: 'relative', marginBottom: '24px' }}>
              {/* Timeline dot */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: label === 'Overdue' ? theme.danger : label === 'Today' ? theme.primary : theme.surfaceHover,
                    border: `2px solid ${label === 'Overdue' ? theme.danger : label === 'Today' ? theme.primary : theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  {label === 'Today' && <Clock size={10} color="#fff" />}
                </div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: label === 'Overdue' ? theme.danger : label === 'Today' ? theme.primary : theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    margin: 0,
                  }}
                >
                  {label}
                  <span style={{ fontWeight: 400, marginLeft: '8px', fontSize: '12px', color: theme.textMuted }}>
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                  </span>
                </h3>
              </div>

              {/* Tasks */}
              <div style={{ paddingLeft: '36px' }}>
                {tasks.map((task) => (
                  <TaskCard key={task.$lds.id} task={task} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
