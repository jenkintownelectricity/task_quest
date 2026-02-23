import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../store/context';
import type { EnergyLevel, Importance, MicroStep } from '../types/kernel';
import { getTheme } from '../utils/theme';
import { generateId } from '../utils/canonical';

export function TaskEditor() {
  const { state, createTask, updateTask, showEditor, editTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const editingTask = state.editingTaskId
    ? state.tasks.find((t) => t.$lds.id === state.editingTaskId)
    : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [importance, setImportance] = useState<Importance>('optional');
  const [dueDate, setDueDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [tags, setTags] = useState('');
  const [microSteps, setMicroSteps] = useState<MicroStep[]>([]);
  const [newStep, setNewStep] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setEnergy(editingTask.energy);
      setImportance(editingTask.importance);
      setDueDate(editingTask.due_date || '');
      setScheduledDate(editingTask.scheduled_date || '');
      setTags(editingTask.tags.join(', '));
      setMicroSteps([...editingTask.micro_steps]);
    } else {
      setTitle('');
      setDescription('');
      setEnergy('medium');
      setImportance('optional');
      setDueDate('');
      setScheduledDate('');
      setTags('');
      setMicroSteps([]);
    }
  }, [editingTask]);

  const addStep = () => {
    if (!newStep.trim()) return;
    setMicroSteps([...microSteps, { id: generateId('ms'), text: newStep.trim(), completed: false }]);
    setNewStep('');
  };

  const removeStep = (id: string) => {
    setMicroSteps(microSteps.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingTask) {
      await updateTask({
        ...editingTask,
        title: title.trim(),
        description: description.trim(),
        energy,
        importance,
        due_date: dueDate || null,
        scheduled_date: scheduledDate || null,
        tags: tagList,
        micro_steps: microSteps,
        updated_at: new Date().toISOString(),
      });
    } else {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
        energy,
        importance,
        due_date: dueDate || null,
        scheduled_date: scheduledDate || null,
        tags: tagList,
        micro_steps: microSteps,
        recurring: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    showEditor(false);
    editTask(null);
  };

  const close = () => {
    showEditor(false);
    editTask(null);
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 600 as const,
    color: theme.textSecondary,
    marginBottom: '4px',
    display: 'block' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
      }}
      onClick={close}
    >
      <div
        style={{
          background: theme.surface,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: theme.text, margin: 0 }}>
            {editingTask ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}>
            <X size={20} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra context? (optional)"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Energy + Importance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Energy</label>
            <select value={energy} onChange={(e) => setEnergy(e.target.value as EnergyLevel)} style={inputStyle}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Importance</label>
            <select value={importance} onChange={(e) => setImportance(e.target.value as Importance)} style={inputStyle}>
              <option value="important">Important</option>
              <option value="optional">Optional</option>
              <option value="someday">Someday</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="work, health, daily"
            style={inputStyle}
          />
        </div>

        {/* Micro-steps */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Micro-Steps</label>
          {microSteps.map((step) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 0',
              }}
            >
              <span style={{ flex: 1, fontSize: '13px', color: theme.text }}>{step.text}</span>
              <button
                onClick={() => removeStep(step.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.danger, padding: '4px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a step..."
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
            />
            <button
              onClick={addStep}
              style={{
                background: theme.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: title.trim() ? theme.primary : theme.border,
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Save size={16} />
          {editingTask ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
