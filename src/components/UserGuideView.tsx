import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  FolderTree,
  Play,
  History,
  BarChart2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Smartphone,
  Layers,
  HelpCircle,
  Lightbulb,
  Clock,
  Shuffle,
  Eye,
  AlertTriangle,
  Train,
  FlaskConical,
} from 'lucide-react';
import { NavTab } from '../types';

interface UserGuideViewProps {
  onNavigateTab: (tab: NavTab) => void;
  onSelectJourney?: (journeyId: string) => void;
  onOpenStartSession?: () => void;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({
  onNavigateTab,
  onSelectJourney,
  onOpenStartSession,
}) => {
  const [selectedSection, setSelectedSection] = useState<
    'OVERVIEW' | 'TABS' | 'JOURNEYS' | 'PRINCIPLES' | 'MOBILE_UX' | 'TEST_CHECKLIST'
  >('OVERVIEW');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner - Telegram / Meta style elevated header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5 text-stone-900" />
              <span>Interactive User Guide & Prototype Manual</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Welcome to Human Drift
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              An R&D prototype investigating <strong>plan-execution drift</strong> by preserving
              intention, logging reality with zero friction, and maintaining continuity of meaning.
              Designed with <strong>Telegram & Meta mobile-first principles</strong> for fast,
              reliable testing on phones and desktops alike.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => onNavigateTab('SESSION')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Jump into Active Session</span>
            </button>
            <button
              onClick={() => onNavigateTab('HIERARCHY')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-all active:scale-98 cursor-pointer"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Explore Work Tree</span>
            </button>
          </div>
        </div>

        {/* Telegram-style Segmented Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-6 mt-6 border-t border-stone-100 no-scrollbar">
          {[
            { id: 'OVERVIEW', label: '1. What is Human Drift?', icon: Compass },
            { id: 'TABS', label: '2. What Does Each Tab Do?', icon: Layers },
            { id: 'JOURNEYS', label: '3. The Two Clarified Journeys', icon: Train },
            { id: 'PRINCIPLES', label: '4. Core Architecture Rules', icon: ShieldCheck },
            { id: 'MOBILE_UX', label: '5. Mobile-First (Telegram & Meta)', icon: Smartphone },
            { id: 'TEST_CHECKLIST', label: '6. 3-Minute Testing Checklist', icon: CheckCircle2 },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = selectedSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSection(sec.id as any)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: OVERVIEW */}
      {selectedSection === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-3 md:col-span-2">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-stone-900" />
              The Mission: Continuity of Meaning
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Most tools force a choice: you are either rigidly following an outdated plan, or you
              are drowning in untracked chaos. <strong>Human Drift</strong> is built on a different
              premise:
            </p>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs font-serif text-stone-800 italic">
              <div>"Preserve what was intended."</div>
              <div>"Log what actually happened."</div>
              <div className="font-sans font-semibold not-italic text-stone-900">
                → And preserve the relationship between them with zero retroactive whitewashing.
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              When work veers off course, it is not a "failure" to be erased. It is evidence.
              Discoveries, interruptions, and pivots are captured as first-class domain entities.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              What This Is NOT
            </h3>
            <ul className="text-xs text-stone-600 space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span><strong>Not a todo list:</strong> We don't just check off checkboxes; we measure drift.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span><strong>Not a gamified habit tracker:</strong> No fake streaks, no point systems.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                <span><strong>Not an automatic spy:</strong> Manual, conscious, 1-tap deliberate input.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 2: WHAT DOES EACH TAB DO? */}
      {selectedSection === 'TABS' && (
        <div className="space-y-4">
          <div className="p-4 bg-stone-900 text-white rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Comprehensive Tab Navigation Map</div>
              <p className="text-xs text-stone-300">
                Here is exactly what each of the 5 primary views accomplishes in the prototype.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tab 1 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-stone-100 text-stone-900">
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Tab 1: Work Tree (Hierarchy)</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('HIERARCHY')}
                  className="text-2xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  Open View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Represents your <strong>planned structure of work</strong>. Each Journey contains a
                tree of Nodes (Tasks, Projects, Milestones, and Notes).
              </p>
              <ul className="text-2xs text-stone-600 space-y-1.5 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
                <li>• <strong>Duration Estimates:</strong> Assign planned minutes to compare later against reality.</li>
                <li>• <strong>Sub-Node Nesting:</strong> Break down high-level projects into discrete units.</li>
                <li>• <strong>Quick Action:</strong> Click the <em>Play</em> icon next to any node to start working immediately.</li>
              </ul>
            </div>

            {/* Tab 2 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <Play className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Tab 2: Active Session (Logger)</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('SESSION')}
                  className="text-2xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  Open View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Your <strong>real-time cockpit</strong> while doing active work. Built for 1-tap thumb interactions.
              </p>
              <ul className="text-2xs text-stone-600 space-y-1.5 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
                <li>• <strong>Intention Locking:</strong> Your declared intention is locked at the start and never overwritten.</li>
                <li>• <strong>1-Tap Action Bar:</strong> Start Task, Pause, Switch Context, Switch Journey, Log Discovery, Revise Intention.</li>
                <li>• <strong>Sticky Conditions:</strong> 1-tap toggles for Energy, Focus, Location, and Environment.</li>
              </ul>
            </div>

            {/* Tab 3 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                    <History className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Tab 3: Session History</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('HISTORY')}
                  className="text-2xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  Open View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Chronological ledger of past working periods, reflections, and quality ratings.
              </p>
              <ul className="text-2xs text-stone-600 space-y-1.5 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
                <li>• <strong>First-Class Gap Intervals:</strong> Inspect exact Unclassified Context Pauses between tasks.</li>
                <li>• <strong>Append-Only Corrections:</strong> Fix typos or timestamps without destroying original recorded facts.</li>
                <li>• <strong>Conflict Resolution:</strong> Review and resolve overlapping session anomalies.</li>
              </ul>
            </div>

            {/* Tab 4 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Tab 4: Priority Queries</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('QUERIES')}
                  className="text-2xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  Open View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Empirical answers to the core research questions of the prototype.
              </p>
              <ul className="text-2xs text-stone-600 space-y-1.5 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
                <li>• <strong>Query 1 (Actual vs Estimate):</strong> Calculates true active duration computed from paired session events vs estimated minutes.</li>
                <li>• <strong>Query 2 (Program Progress):</strong> Real-time breakdown of planned, in-progress, and completed work across the journey.</li>
              </ul>
            </div>

            {/* Tab 5 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Tab 5: Audit Log (Immutable Event Ledger)</h4>
                </div>
                <button
                  onClick={() => onNavigateTab('AUDIT')}
                  className="text-2xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                >
                  Open View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                The cryptographic and historical backbone. Every state mutation (session start, node
                creation, estimate revision, context switch) generates an append-only event record with
                an actor ID and UTC ISO timestamp. Guarantees complete auditability and zero data loss.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: THE TWO CLARIFIED JOURNEYS */}
      {selectedSection === 'JOURNEYS' && (
        <div className="space-y-4">
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-1">
            <h3 className="text-sm font-bold text-stone-900">The Two Pre-Seeded Demonstration Journeys</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Human Drift is designed to test both <strong>physical transit drift</strong> and
              <strong>cognitive research workflow drift</strong>. Both journeys are pre-configured
              and can be switched via the top header switcher:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Journey 1: Train Performance Study */}
            <div className="bg-white border-2 border-stone-300 hover:border-stone-900 rounded-2xl p-6 shadow-xs space-y-4 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-stone-100 rounded-xl">🚆</span>
                <div>
                  <span className="text-2xs font-mono uppercase tracking-wider text-stone-500 font-semibold">
                    Physical Domain Drift
                  </span>
                  <h4 className="text-base font-bold text-stone-900">
                    Train Performance Study
                  </h4>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Investigates schedule vs. actual arrival drift, station dwell times, and departure
                variance across a mainline passenger rail corridor.
              </p>

              <div className="space-y-2 bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-xs">
                <div className="font-semibold text-stone-800 text-2xs uppercase tracking-wider">
                  Pre-Configured Stations & Segments:
                </div>
                <ul className="text-2xs text-stone-600 space-y-1">
                  <li>• Central Terminal Platform 4 Departure (Est: 15m · Completed)</li>
                  <li>• Express Mainline Transit Segment (Est: 25m · Completed)</li>
                  <li>• Midtown Station Dwell & Passenger Transfer (Est: 10m · Completed)</li>
                  <li>• North Interlocking Signal Clearance & Switch (In Progress)</li>
                  <li>• North Terminal Arrival & Reconciliation (Planned)</li>
                </ul>
              </div>

              <div className="p-3 bg-stone-100/80 rounded-xl text-2xs text-stone-700 font-medium">
                <strong>Why it matters:</strong> Shows how physical scheduled operations experience
                delays and dwell time variance that can be captured with zero guesswork.
              </div>

              <button
                onClick={() => {
                  if (onSelectJourney) onSelectJourney('jrn-train-commuter-corridor');
                  onNavigateTab('HIERARCHY');
                }}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Switch to Train Journey</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Journey 2: User Journey 002 */}
            <div className="bg-white border-2 border-stone-300 hover:border-stone-900 rounded-2xl p-6 shadow-xs space-y-4 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-stone-100 rounded-xl">🔬</span>
                <div>
                  <span className="text-2xs font-mono uppercase tracking-wider text-stone-500 font-semibold">
                    Cognitive Knowledge Work Drift
                  </span>
                  <h4 className="text-base font-bold text-stone-900">
                    User Journey 002 — R&D Work Logger
                  </h4>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Investigates cognitive drift in deep research and system engineering by preserving
                starting intentions, recording pivot revisions, and capturing unclassified pauses.
              </p>

              <div className="space-y-2 bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-xs">
                <div className="font-semibold text-stone-800 text-2xs uppercase tracking-wider">
                  Pre-Configured Work Hierarchy:
                </div>
                <ul className="text-2xs text-stone-600 space-y-1">
                  <li>• Implement Domain Model v1 (Est: 60m · Completed)</li>
                  <li>• Atomic File Writes & Storage Resilience (Est: 45m · Completed)</li>
                  <li>• Cross-Journey Transition Verification (AD-002) (Planned)</li>
                  <li>• Telegram & Meta Mobile-First Ergonomics (In Progress)</li>
                </ul>
              </div>

              <div className="p-3 bg-stone-100/80 rounded-xl text-2xs text-stone-700 font-medium">
                <strong>Why it matters:</strong> Validates that emergent thoughts ("Discoveries") and
                pivots ("Intention Revisions") do not corrupt the original plan history.
              </div>

              <button
                onClick={() => {
                  if (onSelectJourney) onSelectJourney('jrn-df2a6498-333b-47e0-890d-a0446a35e192');
                  onNavigateTab('HIERARCHY');
                }}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Switch to User Journey 002</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: CORE ARCHITECTURE RULES */}
      {selectedSection === 'PRINCIPLES' && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-stone-900">Foundational Architectural Decisions</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              These decisions govern how reality is represented in the database and user interface.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Decision 1: Gap-Time Accounting</span>
                </div>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  Default gap time between task entries to <strong>Unclassified Context Pause</strong>,
                  not "untracked overhead".
                </p>
                <div className="p-2.5 bg-white border border-stone-200 rounded-lg text-2xs text-stone-700 font-mono">
                  Observed fact → Recorded event → Current state → Inference
                </div>
                <p className="text-2xs text-stone-500">
                  Calling a 45-minute pause "overhead" is a biased guess. Leaving it as an unclassified pause
                  is an objective fact.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span>Decision 2: Cross-Journey Scope</span>
                </div>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  A Session belongs to <strong>exactly one Journey</strong>. Crossing into another Journey
                  completes the current session and creates a linked successor session.
                </p>
                <div className="p-2.5 bg-white border border-stone-200 rounded-lg text-2xs text-stone-700 font-mono">
                  Session A [Journey 1] → Linked Successor Session B [Journey 2]
                </div>
                <p className="text-2xs text-stone-500">
                  Preserves clean analytical boundaries for Query 1 and Query 2 without messy multi-parent ambiguity.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Rule 2: Immutable Intention</span>
                </div>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  The initial intention declared when beginning a session is locked permanently. If your
                  focus shifts, you tap <strong>Revise Intention</strong> to record the pivot.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span>Rule 3: Append-Only Corrections</span>
                </div>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  Corrections never overwrite original database rows. They append a correction log
                  preserving the original value, timestamp, and human rationale.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: TELEGRAM & META MOBILE-FIRST DESIGN */}
      {selectedSection === 'MOBILE_UX' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
            <Smartphone className="w-5 h-5 text-stone-800" />
            <span>Telegram & Meta Mobile-First Ergonomics</span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            In our R&D architecture, the <strong>laptop serves as the server</strong> and the
            <strong>smartphone is the primary client via local WiFi</strong>. The interface is optimized
            specifically for thumb interactions:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="font-semibold text-xs text-stone-900">Sticky Bottom Navigation</div>
              <p className="text-2xs text-stone-600">
                On mobile screens, navigation moves to a fixed thumb-accessible bottom bar with 48px touch targets,
                mirroring Telegram and Instagram navigation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="font-semibold text-xs text-stone-900">Telegram Chat-Stream Cards</div>
              <p className="text-2xs text-stone-600">
                Active session entries and history items are styled like message bubbles with clear timestamps,
                high-contrast status badges, and zero visual clutter.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="font-semibold text-xs text-stone-900">1-Tap Environmental Chips</div>
              <p className="text-2xs text-stone-600">
                Energy (High/Normal/Low) and Focus (Deep/Normal/Scattered) toggle in a single tap without
                opening heavy modals or interrupting workflow.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: 3-MINUTE TESTING CHECKLIST */}
      {selectedSection === 'TEST_CHECKLIST' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">The 3-Minute Tester Walkthrough</h3>
              <p className="text-xs text-stone-500">
                Follow these exact steps to test the full lifecycle of the Human Drift prototype.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Ready to Test
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {[
              {
                step: 'Step 1',
                title: 'Select a Journey from the Header Switcher',
                desc: 'Toggle between "🚆 Train Performance Study" and "🔬 User Journey 002". Notice how nodes and context immediately adapt.',
                actionLabel: 'Go to Work Tree',
                onAction: () => onNavigateTab('HIERARCHY'),
              },
              {
                step: 'Step 2',
                title: 'Start a Session & Lock Intention',
                desc: 'Select a task from the Work Tree and tap "Start Session". Enter your intention. Notice that the intention is permanently locked.',
                actionLabel: 'Start Session',
                onAction: () => {
                  if (onOpenStartSession) onOpenStartSession();
                  else onNavigateTab('SESSION');
                },
              },
              {
                step: 'Step 3',
                title: 'Log Actions in Active Session',
                desc: 'Tap "Pause" to see how unclassified context pauses are tracked. Tap "Log Discovery" to create emergent work without losing lineage. Tap "Switch Journey" to test cross-journey session transitions (AD-002).',
                actionLabel: 'Go to Active Session',
                onAction: () => onNavigateTab('SESSION'),
              },
              {
                step: 'Step 4',
                title: 'End Session & Inspect History & Queries',
                desc: 'Tap "Complete & Save Session", add a reflection, and open "Priority Queries" to observe Query 1 (Actual vs Estimate) calculate real durations.',
                actionLabel: 'View Priority Queries',
                onAction: () => onNavigateTab('QUERIES'),
              },
            ].map((s, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-800">
                      {s.step}
                    </span>
                    <h5 className="text-xs font-bold text-stone-900">{s.title}</h5>
                  </div>
                  <p className="text-2xs text-stone-600 leading-relaxed">{s.desc}</p>
                </div>
                <button
                  onClick={s.onAction}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  <span>{s.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
