import { useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';

export function AudioSummary() {
  const { state } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [speaking, setSpeaking] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const buildSummary = useCallback(() => {
    const pendingToday = state.tasks.filter(
      (t) =>
        (t.scheduled_date === today || (!t.scheduled_date && t.importance === 'important')) &&
        t.status !== 'completed' &&
        t.status !== 'deferred'
    );
    const completedToday = state.tasks.filter(
      (t) => t.status === 'completed' && t.completed_at?.startsWith(today)
    );

    const parts: string[] = [];

    if (completedToday.length > 0) {
      parts.push(`You've already completed ${completedToday.length} task${completedToday.length !== 1 ? 's' : ''} today. Nice work.`);
    }

    if (pendingToday.length === 0) {
      parts.push('You have no more tasks scheduled for today. Take it easy or plan ahead.');
    } else {
      parts.push(`You have ${pendingToday.length} task${pendingToday.length !== 1 ? 's' : ''} remaining today.`);

      const important = pendingToday.filter((t) => t.importance === 'important');
      if (important.length > 0) {
        parts.push(`${important.length} ${important.length === 1 ? 'is' : 'are'} marked important.`);
      }

      const topTask = pendingToday[0];
      if (topTask) {
        parts.push(`Your top priority is: ${topTask.title}.`);
        if (topTask.description) {
          parts.push(topTask.description);
        }
      }

      const lowEnergy = pendingToday.filter((t) => t.energy === 'low');
      if (lowEnergy.length > 0 && pendingToday.length > 1) {
        parts.push(`If you're low on energy, ${lowEnergy[0].title} is a good low-effort option.`);
      }
    }

    // Due dates
    const dueSoon = state.tasks.filter(
      (t) => t.due_date && t.due_date <= today && t.status !== 'completed'
    );
    if (dueSoon.length > 0) {
      parts.push(`Heads up: ${dueSoon.length} task${dueSoon.length !== 1 ? 's have' : ' has'} a due date today or earlier.`);
    }

    return parts.join(' ');
  }, [state.tasks, today]);

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const text = buildSummary();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Try to find a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [speaking, buildSummary]);

  if (!state.preferences.audio_enabled || !('speechSynthesis' in window)) {
    return null;
  }

  return (
    <button
      onClick={speak}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '10px',
        border: `1px solid ${theme.border}`,
        background: speaking ? theme.primary : 'transparent',
        color: speaking ? '#fff' : theme.textSecondary,
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        minHeight: '40px',
      }}
      title={speaking ? 'Stop audio' : 'Listen to today\'s summary'}
    >
      {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}
