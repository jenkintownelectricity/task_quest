import { useState } from 'react';
import { Download, Upload, Eye, EyeOff, Palette, Save } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme, themes, type ThemeName } from '../utils/theme';
import type { ViewType } from '../types/kernel';

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function safeJSONStringify(obj: unknown) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'function') return undefined;
      if (value === undefined) return undefined;
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    },
    2
  );
}

export function Settings() {
  const { state, updatePreferences, exportAllData, importData } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(state.preferences.ai_api_key || '');
  const [importError, setImportError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleExport = async () => {
    try {
      const exported = await exportAllData();
      const json = safeJSONStringify(exported);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`kerneladhd.export.${stamp}.lds.json`, json);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.lds.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        setImportError('');
      } catch {
        setImportError('Invalid file format. Please use a valid .lds.json export.');
      }
    };
    input.click();
  };

  const handleSaveApiKey = async () => {
    await updatePreferences({ ai_api_key: apiKey || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    marginBottom: '6px',
    display: 'block' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  const sectionStyle = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: '0 0 20px' }}>
        Settings
      </h1>

      {/* Theme */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Palette size={16} color={theme.primary} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: 0 }}>Theme</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {(Object.keys(themes) as ThemeName[]).map((name) => {
            const t = themes[name];
            const isActive = state.preferences.theme === name;
            return (
              <button
                key={name}
                onClick={() => updatePreferences({ theme: name })}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${isActive ? t.primary : t.border}`,
                  background: t.bg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.primary }} />
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.primaryLight }} />
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.accent }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: t.text }}>
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: '0 0 16px' }}>Display</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Default View</label>
          <select
            value={state.preferences.default_view}
            onChange={(e) => updatePreferences({ default_view: e.target.value as ViewType })}
            style={inputStyle}
          >
            <option value="list">List View</option>
            <option value="focus">Focus View</option>
            <option value="timeline">Timeline View</option>
          </select>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Max Visible Tasks (List View)</label>
          <input
            type="range"
            min="3"
            max="10"
            value={state.preferences.max_visible_tasks}
            onChange={(e) => updatePreferences({ max_visible_tasks: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: theme.primary }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textMuted }}>
            <span>3</span>
            <span style={{ fontWeight: 600, color: theme.primary }}>{state.preferences.max_visible_tasks}</span>
            <span>10</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '14px', color: theme.text }}>Audio summaries</label>
          <button
            onClick={() => updatePreferences({ audio_enabled: !state.preferences.audio_enabled })}
            style={{
              width: '48px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              background: state.preferences.audio_enabled ? theme.primary : theme.border,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '3px',
                left: state.preferences.audio_enabled ? '23px' : '3px',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {/* AI */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: '0 0 16px' }}>AI Assistant</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Provider</label>
          <select
            value={state.preferences.ai_provider}
            onChange={(e) => updatePreferences({ ai_provider: e.target.value as 'groq' | 'anthropic' | 'openai' })}
            style={inputStyle}
          >
            <option value="groq">Groq (Fast)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>API Key</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key..."
                style={inputStyle}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.textMuted,
                }}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={handleSaveApiKey}
              style={{
                background: saved ? theme.success : theme.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                whiteSpace: 'nowrap',
              }}
            >
              <Save size={14} /> {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: theme.textMuted, margin: '6px 0 0' }}>
            Your key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>

      {/* Data */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: '0 0 16px' }}>Data</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.text,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '48px',
            }}
          >
            <Download size={16} /> Export .lds.json
          </button>
          <button
            onClick={handleImport}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.text,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '48px',
            }}
          >
            <Upload size={16} /> Import .lds.json
          </button>
        </div>
        {importError && (
          <p style={{ fontSize: '12px', color: theme.danger, marginTop: '8px' }}>{importError}</p>
        )}
        <p style={{ fontSize: '11px', color: theme.textMuted, margin: '8px 0 0' }}>
          Export creates a full backup of all tasks, edges, routines, and preferences.
        </p>
      </div>

      {/* Audit Log summary */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: '0 0 12px' }}>Audit Log</h3>
        <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '0 0 8px' }}>
          {state.auditLog.length} entries recorded (append-only)
        </p>
        <div style={{ maxHeight: '200px', overflow: 'auto' }}>
          {state.auditLog
            .slice()
            .reverse()
            .slice(0, 20)
            .map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${theme.border}`,
                  fontSize: '12px',
                }}
              >
                <span style={{ color: theme.text }}>
                  {entry.action.replace(/_/g, ' ')}
                </span>
                <span style={{ color: theme.textMuted }}>
                  {new Date(entry.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
