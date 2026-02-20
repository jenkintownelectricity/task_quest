import { useState } from 'react';
import { Sparkles, X, Send, ThumbsUp, ThumbsDown, Loader } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';

export function AIAssist() {
  const { state, logAudit, dispatch } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = state.tasks.filter(
    (t) => (t.scheduled_date === today || (!t.scheduled_date && t.importance === 'important'))
      && t.status !== 'completed' && t.status !== 'deferred'
  );

  const buildContext = () => {
    const taskSummary = todayTasks
      .map((t) => `- ${t.title} (${t.energy} energy, ${t.importance})`)
      .join('\n');

    const completedToday = state.tasks.filter(
      (t) => t.status === 'completed' && t.completed_at?.startsWith(today)
    ).length;

    return `User has ${todayTasks.length} pending tasks today and completed ${completedToday} so far.\n\nPending tasks:\n${taskSummary || 'None'}`;
  };

  const callAI = async (userPrompt: string) => {
    const apiKey = state.preferences.ai_api_key;
    if (!apiKey) {
      setError('Please set your AI API key in Settings first.');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    const context = buildContext();
    const systemPrompt = `You are a gentle, supportive ADHD task assistant. You help with:
- Suggesting which task to do next based on energy level
- Breaking tasks into smaller steps
- Rephrasing tasks for clarity
- Providing encouraging daily summaries

Rules:
- Never auto-complete or auto-delete tasks
- Keep responses brief and actionable (under 150 words)
- Be warm but not patronizing
- Focus on one suggestion at a time

Current context:
${context}`;

    try {
      let url: string;
      let headers: Record<string, string>;
      let body: unknown;

      if (state.preferences.ai_provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        body = {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.7,
        };
      } else if (state.preferences.ai_provider === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        headers = {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        };
        body = {
          model: 'claude-sonnet-4-20250514',
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 300,
        };
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        body = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      let text: string;

      if (state.preferences.ai_provider === 'anthropic') {
        text = data.content?.[0]?.text || 'No response';
      } else {
        text = data.choices?.[0]?.message?.content || 'No response';
      }

      setResponse(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'What should I do next?', prompt: 'Based on my current energy and pending tasks, what should I focus on next?' },
    { label: 'Break down a task', prompt: 'Help me break down my most important pending task into smaller, manageable steps.' },
    { label: 'Daily summary', prompt: 'Give me a brief, encouraging summary of my day so far and what is left.' },
    { label: 'Motivation nudge', prompt: 'I am feeling stuck. Give me a gentle, understanding nudge to get started on something small.' },
  ];

  const handleAccept = async () => {
    await logAudit('ai_suggestion_accepted', 'ai_suggestion', 'latest', { response: response.substring(0, 100) });
    setResponse('');
    setIsOpen(false);
  };

  const handleReject = async () => {
    await logAudit('ai_suggestion_rejected', 'ai_suggestion', 'latest', { response: response.substring(0, 100) });
    setResponse('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: theme.primary,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          transition: 'transform 0.2s',
        }}
        title="AI Assistant"
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '340px',
        maxHeight: '480px',
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color={theme.primary} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>AI Assist</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: '4px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {!response && !loading && !error && (
          <>
            <p style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px' }}>
              How can I help? Pick a quick action or type your own question.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => callAI(action.prompt)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: 'transparent',
                    color: theme.text,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    minHeight: '44px',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0', justifyContent: 'center' }}>
            <Loader size={16} color={theme.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px', color: theme.textSecondary }}>Thinking...</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: `${theme.danger}10`,
              border: `1px solid ${theme.danger}30`,
              color: theme.danger,
              fontSize: '13px',
              marginBottom: '8px',
            }}
          >
            {error}
          </div>
        )}

        {response && (
          <div>
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: theme.surfaceHover,
                fontSize: '14px',
                color: theme.text,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {response}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleReject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: 'transparent',
                  color: theme.textSecondary,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <ThumbsDown size={12} /> Not helpful
              </button>
              <button
                onClick={handleAccept}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.primary,
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <ThumbsUp size={12} /> Helpful
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            background: theme.bg,
            color: theme.text,
            fontSize: '13px',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim()) {
              callAI(prompt.trim());
              setPrompt('');
            }
          }}
        />
        <button
          onClick={() => {
            if (prompt.trim()) {
              callAI(prompt.trim());
              setPrompt('');
            }
          }}
          disabled={!prompt.trim()}
          style={{
            background: prompt.trim() ? theme.primary : theme.border,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0 12px',
            cursor: prompt.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
