import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { SignIn } from './components/SignIn';
import { SignUp } from './components/SignUp';
import { Dashboard } from './components/Dashboard';
import { CollectiveTasks } from './components/CollectiveTasks';
import { CreateTask } from './components/CreateTask';
import { Profile } from './components/Profile';
import { TaskDetails } from './components/TaskDetails';
import { Invitations } from './components/Invitations';
import { AiAssistant } from './components/AiAssistant';
import { Notifications } from './components/Notifications';
import { LandingPage } from './components/LandingPage';
import { ContactsPage } from './components/ContactsPage';

type NavEntry = { page: string; data?: any };

function App() {
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'landing' | 'signin' | 'signup'>('landing');

  // Restore navStack from sessionStorage on mount
  const [navStack, setNavStack] = useState<NavEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem('navStack');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [{ page: 'dashboard' }];
  });

  // Persist navStack to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem('navStack', JSON.stringify(navStack));
  }, [navStack]);

  // Current page is always the last item in the stack
  const currentEntry = navStack[navStack.length - 1];
  const currentPage = currentEntry.page;
  const selectedTask = currentEntry.data || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setNavStack([{ page: 'dashboard' }]);
        sessionStorage.removeItem('navStack');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    if (authMode === 'landing') {
      return <LandingPage onLoginClick={() => setAuthMode('signin')} />;
    }
    return authMode === 'signin' ? (
      <SignIn onToggleMode={() => setAuthMode('signup')} />
    ) : (
      <SignUp onToggleMode={() => setAuthMode('signin')} />
    );
  }

  const handleNavigate = (page: string, data?: any) => {
    if (page === 'back') {
      setNavStack(prev => {
        if (prev.length <= 1) return prev;
        return prev.slice(0, -1);
      });
      return;
    }

    setNavStack(prev => [...prev, { page, data }]);
  };

  return (
    <>
      {currentPage === 'dashboard' && (
        <Dashboard
          user={session.user}
          onSignOut={() => supabase.auth.signOut()}
          onNavigate={handleNavigate}
        />
      )}
      {currentPage === 'collective' && (
        <CollectiveTasks
          user={session.user}
          onNavigate={handleNavigate}
        />
      )}
      {currentPage === 'create' && (
        <CreateTask
          user={session.user}
          onNavigate={handleNavigate}
        />
      )}
      {currentPage === 'profile' && (
        <Profile
          user={session.user}
          onSignOut={() => supabase.auth.signOut()}
          onNavigate={handleNavigate}
        />
      )}
      {currentPage === 'taskDetails' && (
        <TaskDetails
          task={selectedTask}
          onNavigate={handleNavigate}
          user={session.user}
        />
      )}
      {currentPage === 'invitations' && (
        <Invitations onNavigate={handleNavigate} />
      )}
      {currentPage === 'ai-assistant' && (
        <AiAssistant user={session.user} onNavigate={handleNavigate} />
      )}
      {currentPage === 'notifications' && (
        <Notifications user={session.user} onNavigate={handleNavigate} />
      )}
      {currentPage === 'contacts' && (
        <ContactsPage user={session.user} onNavigate={handleNavigate} />
      )}
    </>
  );
}

export default App;
