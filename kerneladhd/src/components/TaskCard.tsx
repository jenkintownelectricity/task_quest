import { useState } from 'react';
import {
  Check, ChevronDown, ChevronRight, Clock, Zap,
  Pencil, Trash2, Pause, MoreHorizontal,
} from 'lucide-react';
import { useApp } from '../store/context';
import type { Task } from '../types/kernel';
import { getTheme } from '../utils/theme';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
}

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const { state, completeTask, deferTask, removeTask, editTask, updateTask, selectTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const completedSteps = task.micro_steps.filter((s) => s.completed).length;
  const totalSteps = task.micro_steps.length;
  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;

  const energyColors = {
    low: theme.energyLow,
    medium: theme.energyMed,
    high: theme.energyHigh,
  };

  const importanceLabels = {
    important: 'Important',
    optional: 'Optional',
    someday: 'Someday',
  };

  const isCompleted = task.status === 'completed';
  const isDeferred = task.status === 'deferred';

  const toggleStep = async (stepId: string) => {
    const updated = {
      ...task,
      micro_steps: task.micro_steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    };
    await updateTask(updated);
  };

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: compact ? '12px 16px' : '16px 20px',
        marginBottom: '8px',
        opacity: isCompleted || isDeferred ? 0.6 : 1,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => selectTask(task.$lds.id)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Complete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCompleted) completeTask(task.$lds.id);
          }}
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            borderRadius: '50%',
            border: `2px solid ${isCompleted ? theme.success : theme.border}`,
            background: isCompleted ? theme.success : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isCompleted ? 'default' : 'pointer',
            marginTop: '2px',
            transition: 'all 0.2s',
          }}
          title={isCompleted ? 'Completed' : 'Mark complete'}
        >
          {isCompleted && <Check size={14} color="#fff" />}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: compact ? '14px' : '15px',
                fontWeight: 500,
                color: theme.text,
                textDecoration: isCompleted ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </span>

            {/* Energy badge */}
            <span
              style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 600,
                background: energyColors[task.energy],
                color: theme.text,
              }}
            >
              <Zap size={10} style={{ marginRight: '2px', verticalAlign: 'middle' }} />
              {task.energy}
            </span>

            {/* Importance */}
            {task.importance !== 'optional' && (
              <span
                style={{
                  fontSize: '11px',
                  color: task.importance === 'important' ? theme.accent : theme.textMuted,
                  fontWeight: 500,
                }}
              >
                {importanceLabels[task.importance]}
              </span>
            )}
          </div>

          {/* Description (non-compact) */}
          {!compact && task.description && (
            <p
              style={{
                fontSize: '13px',
                color: theme.textSecondary,
                margin: '4px 0 0',
                lineHeight: 1.4,
              }}
            >
              {task.description}
            </p>
          )}

          {/* Due date */}
          {task.due_date && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
                fontSize: '12px',
                color: theme.textSecondary,
              }}
            >
              <Clock size={12} />
              Due {task.due_date}
            </div>
          )}

          {/* Progress bar for micro-steps */}
          {totalSteps > 0 && !compact && (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? <ChevronDown size={14} color={theme.textSecondary} /> : <ChevronRight size={14} color={theme.textSecondary} />}
                <div
                  style={{
                    flex: 1,
                    height: '4px',
                    background: theme.border,
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress * 100}%`,
                      height: '100%',
                      background: theme.primary,
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>
                  {completedSteps}/{totalSteps}
                </span>
              </div>

              {/* Expanded micro-steps */}
              {expanded && (
                <div style={{ marginTop: '8px', paddingLeft: '4px' }}>
                  {task.micro_steps.map((step) => (
                    <div
                      key={step.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 0',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStep(step.id);
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          minWidth: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${step.completed ? theme.success : theme.border}`,
                          background: step.completed ? theme.success : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {step.completed && <Check size={11} color="#fff" />}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          color: step.completed ? theme.textMuted : theme.textSecondary,
                          textDecoration: step.completed ? 'line-through' : 'none',
                        }}
                      >
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {!compact && task.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: theme.surfaceHover,
                    color: theme.textSecondary,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions menu */}
        {!isCompleted && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                color: theme.textMuted,
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  minWidth: '140px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editTask(task.$lds.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: theme.text,
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deferTask(task.$lds.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: theme.warning,
                  }}
                >
                  <Pause size={14} /> Defer
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTask(task.$lds.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: theme.danger,
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
