import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ImportPage from './components/ImportPage';
import DataQualityPage from './components/DataQualityPage';
import SettingsPage from './components/SettingsPage';
import ChatPage from './components/ChatPage';
import { count } from './db/database';

function App() {
  const location = useLocation();
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    count('sleepSessions').then(setSessionCount);
  }, [location]);

  // Dashboard and Chat have their own headers, so we only show nav for other pages
  const showNav = location.pathname !== '/' && location.pathname !== '/chat';

  return (
    <div className="min-h-screen bg-void-950">
      {/* Navigation for non-dashboard pages */}
      {showNav && (
        <header className="border-b border-void-700/50 bg-void-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <h1 className="font-semibold text-white tracking-tight">VaultHealth</h1>
            </Link>

            <nav className="flex gap-1">
              <NavLink to="/" label="Dashboard" />
              <NavLink to="/chat" label="AI Assistant" highlight />
              <NavLink to="/import" label="Import" />
              <NavLink to="/quality" label="Data Quality" />
              <NavLink to="/settings" label="Settings" />
            </nav>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={showNav ? 'max-w-7xl mx-auto px-4 py-6' : ''}>
        {sessionCount === 0 && location.pathname === '/' ? (
          <OnboardingPrompt />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/quality" element={<DataQualityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        )}
      </main>

      {/* Footer - only on non-dashboard pages */}
      {showNav && (
        <footer className="border-t border-void-700/50 mt-12 py-6">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-xs text-zinc-600 italic">
              <strong className="text-zinc-500">Wellness insights only.</strong> VaultHealth provides general wellness information
              based on your personal data. This is not medical advice. Your data is stored locally and never sent to our servers.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

function NavLink({ to, label, highlight }: { to: string; label: string; highlight?: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded text-sm transition-all ${
        isActive
          ? highlight
            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
          : highlight
            ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
            : 'text-zinc-500 hover:text-white'
      }`}
    >
      {label}
      {highlight && !isActive && (
        <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-violet-500/20 rounded">AI</span>
      )}
    </Link>
  );
}

function OnboardingPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          VaultHealth
        </h1>
        <p className="text-zinc-500 mb-8">
          Your personal health data observatory. Import your sleep and workout data to get started.
        </p>

        <Link
          to="/import"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-void-950 font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
        >
          Import Your Data
          <span>→</span>
        </Link>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="data-panel p-5">
            <div className="text-cyan-400 text-2xl mb-3">●</div>
            <h3 className="font-semibold text-white mb-2">Local-First</h3>
            <p className="text-sm text-zinc-500">
              Your data never leaves your device. Complete privacy by design.
            </p>
          </div>
          <div className="data-panel p-5">
            <div className="text-violet-400 text-2xl mb-3">●</div>
            <h3 className="font-semibold text-white mb-2">Multi-Source</h3>
            <p className="text-sm text-zinc-500">
              Blend data from Eight Sleep, Apple Health, Oura, Peloton, and more.
            </p>
          </div>
          <div className="data-panel p-5">
            <div className="text-emerald-400 text-2xl mb-3">●</div>
            <h3 className="font-semibold text-white mb-2">Actionable Insights</h3>
            <p className="text-sm text-zinc-500">
              Discover patterns and correlations in your health data.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <div className="text-xs text-zinc-600 uppercase tracking-widest mb-4">Supported Sources</div>
          <div className="flex justify-center gap-2 flex-wrap">
            <span className="badge badge-cyan">Apple Health</span>
            <span className="badge badge-cyan">Eight Sleep</span>
            <span className="badge badge-coral">Peloton</span>
            <span className="badge badge-coral">Orangetheory</span>
            <span className="badge badge-violet">Oura</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
