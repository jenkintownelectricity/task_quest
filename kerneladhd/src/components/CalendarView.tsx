import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';
import type { Task } from '../types/kernel';

type CalendarFilter = 'all' | 'due' | 'scheduled' | 'unscheduled';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView() {
  const { state, completeTask, setView, selectTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const today = toDateStr(new Date());

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Filter tasks
  const activeTasks = useMemo(() => {
    return state.tasks.filter((t) => t.status !== 'completed' && t.status !== 'deferred');
  }, [state.tasks]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'due':
        return activeTasks.filter((t) => t.due_date);
      case 'scheduled':
        return activeTasks.filter((t) => t.scheduled_date || (t.due_date && t.due_date >= today));
      case 'unscheduled':
        return activeTasks.filter((t) => !t.due_date && !t.scheduled_date);
      default:
        return activeTasks;
    }
  }, [activeTasks, filter, today]);

  // Group tasks by day
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDates.forEach((d) => {
      map[toDateStr(d)] = [];
    });

    filteredTasks.forEach((task) => {
      const dateKey = task.due_date || task.scheduled_date;
      if (dateKey && map[dateKey]) {
        map[dateKey].push(task);
      }
    });

    // Overdue tasks go to today's column
    const todayKey = today;
    if (map[todayKey]) {
      filteredTasks.forEach((task) => {
        const dateKey = task.due_date || task.scheduled_date;
        if (dateKey && dateKey < toDateStr(weekStart) && !map[todayKey].some((t) => t.$lds.id === task.$lds.id)) {
          map[todayKey].push({ ...task, _overdue: true } as Task & { _overdue: boolean });
        }
      });
    }

    return map;
  }, [weekDates, filteredTasks, today, weekStart]);

  const unscheduledTasks = useMemo(() => {
    return filteredTasks.filter((t) => !t.due_date && !t.scheduled_date);
  }, [filteredTasks]);

  const handleChipClick = (task: Task) => {
    selectTask(task.$lds.id);
    setView('focus');
  };

  const handleComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await completeTask(taskId);
  };

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  const filterOptions: { value: CalendarFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'due', label: 'Due' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'unscheduled', label: 'Unscheduled' },
  ];

  const renderChip = (task: Task) => {
    const isOverdue = (task as Task & { _overdue?: boolean })._overdue || (task.due_date && task.due_date < today);
    const energyColors = {
      low: theme.energyLow,
      medium: theme.energyMed,
      high: theme.energyHigh,
    };

    return (
      <button
        key={task.$lds.id}
        onClick={() => handleChipClick(task)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 8px',
          marginBottom: '4px',
          borderRadius: '8px',
          border: `1px solid ${isOverdue ? theme.danger + '40' : theme.border}`,
          background: isOverdue ? theme.danger + '08' : theme.surface,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '12px',
          color: theme.text,
          minHeight: '36px',
          transition: 'background 0.15s',
        }}
      >
        {/* Energy dot */}
        <div
          style={{
            width: '8px',
            height: '8px',
            minWidth: '8px',
            borderRadius: '50%',
            background: energyColors[task.energy],
          }}
        />

        {/* Overdue indicator */}
        {isOverdue && (
          <div
            style={{
              width: '6px',
              height: '6px',
              minWidth: '6px',
              borderRadius: '50%',
              background: theme.danger,
            }}
          />
        )}

        {/* Title */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title.length > 18 ? task.title.slice(0, 17) + '\u2026' : task.title}
        </span>

        {/* Complete button */}
        <button
          onClick={(e) => handleComplete(e, task.$lds.id)}
          style={{
            width: '20px',
            height: '20px',
            minWidth: '20px',
            borderRadius: '50%',
            border: `1.5px solid ${theme.border}`,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
          title="Mark complete"
        >
          <Check size={10} color={theme.textMuted} />
        </button>
      </button>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: 0 }}>
          Calendar
        </h1>
      </div>

      {/* Week nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          padding: '10px 16px',
        }}
      >
        <button
          onClick={prevWeek}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.textSecondary,
            padding: '6px',
            borderRadius: '8px',
            minHeight: '36px',
            minWidth: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>
            {weekLabel}
          </span>
          {toDateStr(weekStart) !== toDateStr(getMonday(new Date())) && (
            <button
              onClick={goToday}
              style={{
                marginLeft: '8px',
                fontSize: '11px',
                color: theme.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={nextWeek}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.textSecondary,
            padding: '6px',
            borderRadius: '8px',
            minHeight: '36px',
            minWidth: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: filter === opt.value ? 600 : 400,
              cursor: 'pointer',
              background: filter === opt.value ? theme.primary : theme.surfaceHover,
              color: filter === opt.value ? '#fff' : theme.textSecondary,
              minHeight: '36px',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Week grid — desktop */}
      <div
        className="calendar-week-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          marginBottom: '20px',
        }}
      >
        {weekDates.map((date, i) => {
          const dateStr = toDateStr(date);
          const isToday = dateStr === today;
          const dayTasks = tasksByDay[dateStr] || [];

          return (
            <div
              key={dateStr}
              style={{
                background: isToday ? theme.primary + '15' : theme.surface,
                border: `1px solid ${isToday ? theme.primary + '40' : theme.border}`,
                borderRadius: '10px',
                padding: '8px',
                minHeight: '120px',
              }}
            >
              {/* Day header */}
              <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? theme.primary : theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {DAY_NAMES[i]}
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? theme.primary : theme.text,
                    lineHeight: 1.3,
                  }}
                >
                  {date.getDate()}
                </div>
                {isToday && (
                  <div
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      color: theme.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    TODAY
                  </div>
                )}
              </div>

              {/* Task chips */}
              {dayTasks.map((task) => renderChip(task))}

              {dayTasks.length === 0 && (
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.textMuted,
                    textAlign: 'center',
                    padding: '8px 0',
                  }}
                >
                  &mdash;
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile week — vertical day list */}
      <div
        className="calendar-week-mobile"
        style={{ display: 'none', marginBottom: '20px' }}
      >
        {/* Today first, then other days */}
        {[...weekDates].sort((a, b) => {
          const aStr = toDateStr(a);
          const bStr = toDateStr(b);
          if (aStr === today) return -1;
          if (bStr === today) return 1;
          return a.getTime() - b.getTime();
        }).map((date) => {
          const dateStr = toDateStr(date);
          const isToday = dateStr === today;
          const dayTasks = tasksByDay[dateStr] || [];
          const dayIdx = weekDates.findIndex((d) => toDateStr(d) === dateStr);

          return (
            <div
              key={dateStr}
              style={{
                background: isToday ? theme.primary + '15' : theme.surface,
                border: `1px solid ${isToday ? theme.primary + '40' : theme.border}`,
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: dayTasks.length > 0 ? '8px' : '0',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? theme.primary : theme.text,
                  }}
                >
                  {DAY_NAMES[dayIdx]} {date.getDate()}
                </span>
                {isToday && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#fff',
                      background: theme.primary,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Today
                  </span>
                )}
                <span style={{ fontSize: '12px', color: theme.textMuted, marginLeft: 'auto' }}>
                  {dayTasks.length > 0 ? `${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
              {dayTasks.map((task) => renderChip(task))}
            </div>
          );
        })}
      </div>

      {/* Unscheduled section */}
      {filter !== 'due' && filter !== 'scheduled' && unscheduledTasks.length > 0 && (
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setUnscheduledOpen(!unscheduledOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: theme.text,
              fontSize: '14px',
              fontWeight: 600,
              minHeight: '48px',
            }}
          >
            <span>
              Unscheduled ({unscheduledTasks.length} task{unscheduledTasks.length !== 1 ? 's' : ''})
            </span>
            {unscheduledOpen ? <ChevronUp size={16} color={theme.textMuted} /> : <ChevronDown size={16} color={theme.textMuted} />}
          </button>
          {unscheduledOpen && (
            <div style={{ padding: '0 12px 12px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '4px',
                }}
              >
                {unscheduledTasks.map((task) => renderChip(task))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
