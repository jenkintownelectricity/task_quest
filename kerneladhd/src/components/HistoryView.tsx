import { useMemo, useState } from 'react';
import { CheckCircle, TrendingUp, Calendar, Flame } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';
import type { Task } from '../types/kernel';

export function HistoryView() {
  const { state } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [daysBack, setDaysBack] = useState(7);

  const completedTasks = useMemo(() => {
    return state.tasks
      .filter((t) => t.status === 'completed' && t.completed_at)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  }, [state.tasks]);

  const stats = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysBack * 86400000);
    const recentTasks = completedTasks.filter(
      (t) => new Date(t.completed_at!) >= cutoff
    );

    // Completion by day
    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      dailyCounts[d.toISOString().split('T')[0]] = 0;
    }
    recentTasks.forEach((t) => {
      const date = t.completed_at!.split('T')[0];
      if (dailyCounts[date] !== undefined) {
        dailyCounts[date]++;
      }
    });

    // Streak
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
      const dayCompleted = completedTasks.some((t) => t.completed_at?.startsWith(d));
      if (dayCompleted) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // By tag
    const tagCounts: Record<string, number> = {};
    recentTasks.forEach((t) => {
      t.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // By energy
    const energyCounts = { low: 0, medium: 0, high: 0 };
    recentTasks.forEach((t) => {
      energyCounts[t.energy]++;
    });

    return {
      total: recentTasks.length,
      dailyCounts: Object.entries(dailyCounts).reverse(),
      streak,
      tagCounts: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]),
      energyCounts,
      avgPerDay: recentTasks.length / daysBack,
    };
  }, [completedTasks, daysBack]);

  const maxDaily = Math.max(...stats.dailyCounts.map(([, c]) => c), 1);

  // Group completed tasks by day
  const groupedHistory = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    completedTasks.slice(0, 50).forEach((t) => {
      const date = t.completed_at!.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.entries(groups);
  }, [completedTasks]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: 0 }}>
          History
        </h1>
        <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '4px 0 0' }}>
          Your completed tasks and patterns
        </p>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDaysBack(d)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: daysBack === d ? 600 : 400,
              cursor: 'pointer',
              background: daysBack === d ? theme.primary : theme.surfaceHover,
              color: daysBack === d ? '#fff' : theme.textSecondary,
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <CheckCircle size={20} color={theme.success} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '28px', fontWeight: 700, color: theme.text }}>{stats.total}</div>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>Completed</div>
        </div>
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <TrendingUp size={20} color={theme.primary} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '28px', fontWeight: 700, color: theme.text }}>{stats.avgPerDay.toFixed(1)}</div>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>Avg/day</div>
        </div>
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <Flame size={20} color={theme.accent} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '28px', fontWeight: 700, color: theme.text }}>{stats.streak}</div>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>Day streak</div>
        </div>
      </div>

      {/* Daily chart */}
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: theme.textSecondary, marginBottom: '12px', margin: '0 0 12px' }}>
          Daily Completions
        </h3>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '80px' }}>
          {stats.dailyCounts.map(([date, count]) => (
            <div
              key={date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '32px',
                  height: `${Math.max((count / maxDaily) * 60, 4)}px`,
                  background: count > 0 ? theme.primary : theme.border,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                }}
                title={`${date}: ${count} tasks`}
              />
              <span style={{ fontSize: '9px', color: theme.textMuted }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tag breakdown */}
      {stats.tagCounts.length > 0 && (
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: theme.textSecondary, margin: '0 0 12px' }}>
            By Category
          </h3>
          {stats.tagCounts.slice(0, 6).map(([tag, count]) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '13px', color: theme.text, width: '80px' }}>{tag}</span>
              <div style={{ flex: 1, height: '8px', background: theme.surfaceHover, borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(count / stats.total) * 100}%`,
                    height: '100%',
                    background: theme.primaryLight,
                    borderRadius: '4px',
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: theme.textMuted, width: '24px', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Completed tasks list */}
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: theme.textSecondary, marginBottom: '12px' }}>
        Completed Tasks
      </h3>
      {groupedHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.textMuted }}>
          <p>No completed tasks yet. Get started!</p>
        </div>
      ) : (
        groupedHistory.map(([date, tasks]) => (
          <div key={date} style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.textMuted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
              <span style={{ fontWeight: 400, marginLeft: '8px' }}>({tasks.length})</span>
            </div>
            {tasks.map((task) => (
              <div
                key={task.$lds.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  marginBottom: '4px',
                }}
              >
                <CheckCircle size={16} color={theme.success} />
                <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                  {task.title}
                </span>
                <span style={{ fontSize: '11px', color: theme.textMuted, marginLeft: 'auto' }}>
                  {task.completed_at ? new Date(task.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
