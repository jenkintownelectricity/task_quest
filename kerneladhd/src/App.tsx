import { AppProvider, useApp } from './store/context';
import { Layout } from './components/Layout';
import { ListView } from './components/ListView';
import { FocusView } from './components/FocusView';
import { GraphView } from './components/GraphView';
import { TimelineView } from './components/TimelineView';
import { HistoryView } from './components/HistoryView';
import { CalendarView } from './components/CalendarView';
import { Settings } from './components/Settings';
import { TaskEditor } from './components/TaskEditor';
import { AIAssist } from './components/AIAssist';
import { getTheme } from './utils/theme';

function AppContent() {
  const { state } = useApp();
  const theme = getTheme(state.preferences.theme);

  if (state.isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: theme.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryLight})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <span style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>K</span>
        </div>
        <span style={{ color: theme.textSecondary, fontSize: '14px' }}>Loading your kernel...</span>
      </div>
    );
  }

  const renderView = () => {
    switch (state.currentView) {
      case 'list':
        return <ListView />;
      case 'focus':
        return <FocusView />;
      case 'graph':
        return <GraphView />;
      case 'timeline':
        return <TimelineView />;
      case 'calendar':
        return <CalendarView />;
      case 'history':
        return <HistoryView />;
      case 'settings' as string:
        return <Settings />;
      default:
        return <ListView />;
    }
  };

  return (
    <>
      <Layout>{renderView()}</Layout>
      {state.showTaskEditor && <TaskEditor />}
      <AIAssist />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
