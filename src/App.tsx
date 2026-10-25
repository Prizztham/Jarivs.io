/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Banner } from './components/Banner';
import { Navbar, TabType } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { AskView } from './components/AskView';
import { GrowthView } from './components/GrowthView';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { LeadershipView } from './components/LeadershipView';
import { OnboardingModal } from './components/OnboardingModal';
import { RehearsalModal } from './components/RehearsalModal';
import { RecallModal } from './components/RecallModal';
import { LogHoursModal } from './components/LogHoursModal';

import { Storage, subscribeToStorage } from './utils/storage';
import { Recall, SpacedRevisitQuiz } from './types';

export default function App() {
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Application State from Storage
  const [user, setUser] = useState(Storage.getUserProfile());
  const [domains, setDomains] = useState(Storage.getDomains());
  const [sessions, setSessions] = useState(Storage.getSessions());
  const [decisions, setDecisions] = useState(Storage.getDecisions());
  const [rehearsals, setRehearsals] = useState(Storage.getRehearsals());
  const [recalls, setRecalls] = useState(Storage.getRecalls());
  const [logEntries, setLogEntries] = useState(Storage.getLogEntries());
  const [pointEvents, setPointEvents] = useState(Storage.getPointEvents());
  const [wallet, setWallet] = useState(Storage.getWallet());
  const [coupons, setCoupons] = useState(Storage.getCoupons());
  const [trackerEntries, setTrackerEntries] = useState(Storage.getTrackerEntries());
  const [config, setConfig] = useState(Storage.getConfig());
  const [analyticsEvents, setAnalyticsEvents] = useState(Storage.getAnalyticsEvents());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => Storage.getTheme());

  // Modals state
  const [showOnboarding, setShowOnboarding] = useState(!user.onboardingDone);
  const [rehearsalDraft, setRehearsalDraft] = useState<string>('');
  const [showRehearsal, setShowRehearsal] = useState(false);
  const [activeRecallItem, setActiveRecallItem] = useState<Recall | null>(null);
  const [activeQuizItem, setActiveQuizItem] = useState<SpacedRevisitQuiz | null>(null);
  const [showLogHours, setShowLogHours] = useState(false);

  // Pre-filled Ask question (e.g. from Home quick-ask or Coach)
  const [askPrefill, setAskPrefill] = useState<string>('');

  // Subscribe to storage changes
  useEffect(() => {
    const syncState = () => {
      setUser(Storage.getUserProfile());
      setDomains(Storage.getDomains());
      setSessions(Storage.getSessions());
      setDecisions(Storage.getDecisions());
      setRehearsals(Storage.getRehearsals());
      setRecalls(Storage.getRecalls());
      setLogEntries(Storage.getLogEntries());
      setPointEvents(Storage.getPointEvents());
      setWallet(Storage.getWallet());
      setCoupons(Storage.getCoupons());
      setTrackerEntries(Storage.getTrackerEntries());
      setConfig(Storage.getConfig());
      setAnalyticsEvents(Storage.getAnalyticsEvents());
    };

    return subscribeToStorage(syncState);
  }, []);

  // Update theme class on HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    Storage.setTheme(next);
  };

  // Check URL query parameters for direct navigation or autostart
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as TabType;
    if (tabParam && ['home', 'ask', 'growth', 'wallet', 'settings', 'leadership'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    if (params.get('autostart') === '1') {
      setShowOnboarding(false);
    }
    if (params.get('seed') === '1' && sessions.length === 0) {
      Storage.loadDemoData();
    }
  }, []);

  // If user has no sessions on first load, seed with demo data to look populated as requested in PRD Section 0
  useEffect(() => {
    if (sessions.length === 0 && pointEvents.length === 0) {
      Storage.loadDemoData();
    }
  }, [sessions.length, pointEvents.length]);


  const handleDisableUrgent = () => {
    Storage.saveUserProfile({
      ...user,
      urgentOverrideUntil: undefined,
    });
  };

  const handleOpenRehearsal = (draft?: string) => {
    setRehearsalDraft(draft || '');
    setShowRehearsal(true);
  };

  const handleNavigateToAsk = (prefill?: string) => {
    if (prefill) {
      setAskPrefill(prefill);
    }
    setActiveTab('ask');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* Top Persistent Banners (Simulated funds + Urgent lock) */}
      <Banner
        urgentActiveUntil={user.urgentOverrideUntil}
        onDisableUrgent={handleDisableUrgent}
      />

      {/* Main Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        rewardBalance={wallet.rewardBalance}
        plan={user.plan}
        onOpenRehearsal={() => handleOpenRehearsal()}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'home' && (
          <HomeView
            user={user}
            config={config}
            pointEvents={pointEvents}
            sessions={sessions}
            recalls={recalls}
            trackerEntries={trackerEntries}
            onNavigateToAsk={handleNavigateToAsk}
            onOpenRehearsal={handleOpenRehearsal}
            onOpenRecall={r => setActiveRecallItem(r)}
            onOpenQuiz={q => setActiveQuizItem(q)}
            onOpenLogHours={() => setShowLogHours(true)}
          />
        )}

        {activeTab === 'ask' && (
          <AskView
            user={user}
            config={config}
            domains={domains}
            initialQuestion={askPrefill}
            onOpenRehearsalWithText={text => handleOpenRehearsal(text)}
            onRefreshUserData={() => {}}
          />
        )}

        {activeTab === 'growth' && (
          <GrowthView
            user={user}
            domains={domains}
            decisions={decisions}
            sessions={sessions}
            rehearsals={rehearsals}
            logEntries={logEntries}
            trackerEntries={trackerEntries}
            config={config}
            onNavigateToAskDomain={domId => {
              setActiveTab('ask');
            }}
            onOpenLogHours={() => setShowLogHours(true)}
            onRefreshData={() => {}}
          />
        )}

        {activeTab === 'wallet' && (
          <WalletView
            wallet={wallet}
            coupons={coupons}
            pointEvents={pointEvents}
            onRefreshData={() => {}}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={user}
            domains={domains}
            config={config}
            analyticsEvents={analyticsEvents}
            onRefreshData={() => {}}
            onNavigateToLeadership={() => setActiveTab('leadership')}
          />
        )}

        {activeTab === 'leadership' && (
          <LeadershipView onBack={() => setActiveTab('settings')} />
        )}
      </main>

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {showRehearsal && (
        <RehearsalModal
          isOpen={showRehearsal}
          onClose={() => setShowRehearsal(false)}
          initialDraft={rehearsalDraft}
          onCompleted={() => {}}
          onSelectCoachTopic={topic => {
            setShowRehearsal(false);
            setAskPrefill(topic);
            setActiveTab('ask');
          }}
        />
      )}

      {(activeRecallItem || activeQuizItem) && (
        <RecallModal
          isOpen={Boolean(activeRecallItem || activeQuizItem)}
          onClose={() => {
            setActiveRecallItem(null);
            setActiveQuizItem(null);
          }}
          recall={activeRecallItem || undefined}
          quiz={activeQuizItem || undefined}
          onCompleted={() => {
            setActiveRecallItem(null);
            setActiveQuizItem(null);
          }}
        />
      )}

      {showLogHours && (
        <LogHoursModal
          isOpen={showLogHours}
          onClose={() => setShowLogHours(false)}
          onSaved={() => setShowLogHours(false)}
        />
      )}
    </div>
  );
}
