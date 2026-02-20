import {
  List, Target, GitBranch, Clock, History, Settings as SettingsIcon, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';
import { AudioSummary } from './AudioSummary';
import type { ViewType } from '../types/kernel';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems: { view: ViewType | 'settings'; icon: typeof List; label: string }[] = [
  { view: 'list', icon: List, label: 'Today' },
  { view: 'focus', icon: Target, label: 'Focus' },
  { view: 'graph', icon: GitBranch, label: 'Graph' },
  { view: 'timeline', icon: Clock, label: 'Timeline' },
  { view: 'history', icon: History, label: 'History' },
  { view: 'settings', icon: SettingsIcon, label: 'Settings' },
];

export function Layout({ children }: LayoutProps) {
  const { state, setView, dispatch } = useApp();
  const theme = getTheme(state.preferences.theme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentView = state.currentView;

  const handleNav = (view: string) => {
    if (view === 'settings') {
      setView('list'); // settings is handled by showing settings component
      dispatch({ type: 'SET_VIEW', payload: 'settings' as ViewType });
    } else {
      setView(view as ViewType);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          background: theme.surface,
          borderBottom: `1px solid ${theme.border}`,
          padding: '0 20px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.textSecondary,
              padding: '8px',
              display: 'none',
            }}
            className="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryLight})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>K</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: theme.text, letterSpacing: '-0.5px' }}>
              KernelADHD
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AudioSummary />
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar nav — desktop */}
        <nav
          style={{
            width: '200px',
            background: theme.surface,
            borderRight: `1px solid ${theme.border}`,
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            flexShrink: 0,
          }}
          className="desktop-nav"
        >
          {navItems.map(({ view, icon: Icon, label }) => {
            const isActive = currentView === view;
            return (
              <button
                key={view}
                onClick={() => handleNav(view)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? `${theme.primary}15` : 'transparent',
                  color: isActive ? theme.primary : theme.textSecondary,
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  width: '100%',
                  minHeight: '44px',
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            padding: '24px',
            maxWidth: '800px',
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: theme.surface,
          borderTop: `1px solid ${theme.border}`,
          display: 'none',
          justifyContent: 'space-around',
          padding: '6px 0 env(safe-area-inset-bottom, 6px)',
          zIndex: 40,
        }}
        className="mobile-nav"
      >
        {navItems.slice(0, 5).map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              onClick={() => handleNav(view)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: isActive ? theme.primary : theme.textMuted,
                fontSize: '10px',
                cursor: 'pointer',
                minWidth: '48px',
                minHeight: '48px',
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
