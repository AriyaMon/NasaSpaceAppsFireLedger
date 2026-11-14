import React, { useState } from 'react';
import { RESPONDER_ROLE_META } from '../lib/brief.ts';
import type { ResponderBriefResult, ResponderRole } from '../lib/types.ts';

interface ResponderBriefingPanelProps {
  role: ResponderRole;
  onSelectRole: (role: ResponderRole) => void;
  brief: ResponderBriefResult | null;
  loading: boolean;
  localLlmConfigured: boolean;
  onQueueKaggleRequest?: () => void;
  queuingKaggleRequest?: boolean;
  kaggleQueueMessage?: string | null;
}

const ROLE_ORDER: ResponderRole[] = [
  'firefighting',
  'police',
  'ambulance',
  'scientist',
  'land_manager',
];

export const ResponderBriefingPanel: React.FC<ResponderBriefingPanelProps> = ({
  role,
  onSelectRole,
  brief,
  loading,
  onQueueKaggleRequest,
  queuingKaggleRequest,
  kaggleQueueMessage,
}) => {
  const [showLedger, setShowLedger] = useState(false);

  return (
    <div className="flex h-full flex-col justify-between gap-4 border-t border-white/[0.08] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <div className="flex flex-col gap-4">
        {/* Clean Editorial Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
              Responder Operational Brief
            </h2>
            <p className="mt-0.5 text-xs text-[#a19d94]">
              Mistral 7B QLoRA (Kaggle Worker) · Grounded against Fact Ledger
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#e5a93c]">
            {brief?.modelName ?? 'Verified Grounded Engine'}
          </span>
        </div>

        {/* Role Switcher */}
        <div className="flex flex-wrap gap-1.5">
          {ROLE_ORDER.map((r) => {
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelectRole(r)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#e5a93c]/18 text-[#f7d083] ring-1 ring-[#e5a93c]/50'
                    : 'bg-[#101216] text-[#a19d94] hover:text-[#f3f1ec]'
                }`}
              >
                {RESPONDER_ROLE_META[r].shortLabel}
              </button>
            );
          })}
        </div>

        {/* Briefing Narrative */}
        {loading || !brief ? (
          <div className="py-6 text-xs text-[#73706a]">
            Synthesizing role-specific operational brief and verifying telemetry numbers...
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-[13px] leading-[1.65] text-[#e3dfd6] whitespace-pre-line">
              {brief.text}
            </div>

            {/* 3-Point Tactical Checklist */}
            <div className="border-t border-white/[0.08] pt-3.5">
              <div className="mb-2 text-xs font-semibold text-[#e5a93c]">
                Immediate {RESPONDER_ROLE_META[role].shortLabel} Priorities
              </div>
              <ul className="space-y-2 text-xs leading-relaxed text-[#c9c5bc]">
                {brief.tacticalChecklist.map((item, idx) => (
                  <li key={idx} className="flex gap-2.5">
                    <span className="font-mono text-[11px] text-[#73706a]">0{idx + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Strict Numeric Fact-Verifier & Kaggle SQL Queue Footer */}
      {brief && !loading && (
        <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <div className="text-[#73706a]">
              Audit:{' '}
              <span className="text-emerald-400">
                {brief.verifiedNumbers.length} figures verified
              </span>{' '}
              ·{' '}
              <span
                className={
                  brief.rejectedNumbers.length === 0 ? 'text-[#a19d94]' : 'text-rose-400'
                }
              >
                {brief.rejectedNumbers.length} ungrounded blocked
              </span>
            </div>

            <div className="flex items-center gap-3">
              {onQueueKaggleRequest && (
                <button
                  type="button"
                  disabled={queuingKaggleRequest}
                  onClick={onQueueKaggleRequest}
                  className="text-[#e5a93c] hover:underline disabled:opacity-50"
                >
                  {queuingKaggleRequest ? 'Queuing SQLite...' : 'Ask Kaggle Mistral 7B'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLedger((v) => !v)}
                className="text-sky-300 hover:underline"
              >
                {showLedger ? 'Hide Fact Ledger' : 'Inspect Fact Ledger'}
              </button>
            </div>
          </div>

          {kaggleQueueMessage && (
            <div className="font-mono text-[11px] text-sky-300">{kaggleQueueMessage}</div>
          )}

          {showLedger && (
            <pre className="max-h-48 overflow-auto border border-white/[0.08] bg-[#060709] p-3 font-mono text-[11px] text-[#c9c5bc]">
              {JSON.stringify(brief.factLedger, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
