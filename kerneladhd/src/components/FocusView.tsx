import { useMemo, useState } from 'react';
import { Check, Zap, Clock, SkipForward, PartyPopper } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';

export function FocusView() {
  const { state, completeTask, updateTask, deferTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const today = new Date().toISOString().split('T')[0];
  const [justCompleted, setJustCompleted] = useState(false);

  const focusQueue = useMemo(() => {
    return state.tasks
      .filter((t) => t.status !== 'completed' && t.status !== 'deferred')
      .filter((t) => t.scheduled_date === today || (!t.scheduled_date && t.importance === 'important'))
      .sort((a, b) => {
        const importanceOrder = { important: 0, optional: 1, someday: 2 };
        if (importanceOrder[a.importance] !== importanceOrder[b.importance]) {
          return importanceOrder[a.importance] - importanceOrder[b.importance];
        }
        const energyOrder = { low: 0, medium: 1, high: 2 };
        return energyOrder[a.energy] - energyOrder[b.energy];
      });
  }, [state.tasks, today]);

  const currentTask = focusQueue[0];
  const remainingCount = focusQueue.length - 1;

  const handleComplete = async () => {
    if (!currentTask) return;
    setJustCompleted(true);
    await completeTask(currentTask.$lds.id);
    setTimeout(() => setJustCompleted(false), 1500);
  };

  const handleSkip = async () => {
    if (!currentTask) return;
    await deferTask(currentTask.$lds.id);
  };

  const toggleStep = async (stepId: string) => {
    if (!currentTask) return;
    const updated = {
      ...currentTask,
      micro_steps: currentTask.micro_steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    };
    await updateTask(updated);
  };

  const allStepsDone = currentTask?.micro_steps.length > 0 &&
    currentTask.micro_steps.every((s) => s.completed);

  if (justCompleted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>
          <PartyPopper size={64} color={theme.success} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
          Done!
        </h2>
        <p style={{ fontSize: '15px', color: theme.textSecondary }}>
          Nice work. Moving to next task...
        </p>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: theme.primaryLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <Check size={40} color="#fff" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
          All clear for today
        </h2>
        <p style={{ fontSize: '15px', color: theme.textSecondary, maxWidth: '300px' }}>
          You have no more tasks scheduled. Take a break or switch to list view to plan ahead.
        </p>
      </div>
    );
  }

  const completedSteps = currentTask.micro_steps.filter((s) => s.completed).length;
  const totalSteps = currentTask.micro_steps.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
      }}
    >
      {/* Remaining counter */}
      <div
        style={{
          fontSize: '12px',
          color: theme.textMuted,
          marginBottom: '24px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: 600,
        }}
      >
        {remainingCount > 0
          ? `${remainingCount} more task${remainingCount !== 1 ? 's' : ''} after this`
          : 'Last task for today'}
      </div>

      {/* Main task card */}
      <div
        style={{
          background: theme.surface,
          border: `2px solid ${theme.primary}`,
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Energy + Importance badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              background: { low: theme.energyLow, medium: theme.energyMed, high: theme.energyHigh }[currentTask.energy],
              color: theme.text,
            }}
          >
            <Zap size={12} /> {currentTask.energy} energy
          </span>
          {currentTask.due_date && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                background: theme.surfaceHover,
                color: theme.textSecondary,
              }}
            >
              <Clock size={12} /> Due {currentTask.due_date}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 700,
            color: theme.text,
            marginBottom: '8px',
            lineHeight: 1.3,
          }}
        >
          {currentTask.title}
        </h2>

        {/* Description */}
        {currentTask.description && (
          <p style={{ fontSize: '15px', color: theme.textSecondary, lineHeight: 1.5, marginBottom: '20px' }}>
            {currentTask.description}
          </p>
        )}

        {/* Micro-steps */}
        {totalSteps > 0 && (
          <div style={{ textAlign: 'left', marginTop: '20px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: theme.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px',
              }}
            >
              Steps ({completedSteps}/{totalSteps})
            </div>
            {currentTask.micro_steps.map((step) => (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  marginBottom: '6px',
                  borderRadius: '10px',
                  border: `1px solid ${step.completed ? theme.success : theme.border}`,
                  background: step.completed ? `${theme.success}10` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  minHeight: '48px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    minWidth: '24px',
                    borderRadius: '50%',
                    border: `2px solid ${step.completed ? theme.success : theme.border}`,
                    background: step.completed ? theme.success : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {step.completed && <Check size={13} color="#fff" />}
                </div>
                <span
                  style={{
                    fontSize: '15px',
                    color: step.completed ? theme.textMuted : theme.text,
                    textDecoration: step.completed ? 'line-through' : 'none',
                  }}
                >
                  {step.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%', maxWidth: '480px' }}>
        <button
          onClick={handleSkip}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            background: 'transparent',
            color: theme.textSecondary,
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minHeight: '52px',
          }}
        >
          <SkipForward size={16} /> Skip for now
        </button>
        <button
          onClick={handleComplete}
          style={{
            flex: 2,
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: allStepsDone || totalSteps === 0 ? theme.success : theme.primary,
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minHeight: '52px',
            transition: 'background 0.2s',
          }}
        >
          <Check size={18} /> {allStepsDone || totalSteps === 0 ? 'Complete!' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}
