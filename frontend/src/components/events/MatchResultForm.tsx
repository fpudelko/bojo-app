'use client';

import { useState } from 'react';
import { Trophy, Plus, Minus, Medal } from 'lucide-react';
import { saveMatchResult } from '@/lib/eventFeatures';
import type {
  MatchResult, EventParticipant, MatchResultData,
  GoalsScorerStat, VolleyballSet, BasketballPlayerStat, RacingRank,
} from '@/types';

// ---------------------------------------------------------------------------
// Sport detection helpers
// ---------------------------------------------------------------------------
type SportFamily = 'goals' | 'volleyball' | 'basketball' | 'racing' | 'generic';

function sportFamily(sport: string): SportFamily {
  const s = sport.toLowerCase();
  if (['piłka nożna', 'futsal', 'piłka ręczna'].includes(s)) return 'goals';
  if (['siatkówka', 'siatkówka plażowa'].includes(s)) return 'volleyball';
  if (s === 'koszykówka') return 'basketball';
  if (s === 'gokarty') return 'racing';
  return 'generic';
}

// ---------------------------------------------------------------------------
// Score display (read-only)
// ---------------------------------------------------------------------------
function ResultSummary({ result }: { result: MatchResult }) {
  const rd = result.resultData;
  if (!rd) {
    return (
      <div className="text-center py-2 mb-4">
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{result.scoreA} — {result.scoreB}</p>
        <p className="text-xs text-slate-400 mt-1">Drużyna A · Drużyna B</p>
      </div>
    );
  }
  if (rd.type === 'goals') {
    return (
      <div className="text-center py-2 mb-4">
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{rd.scoreA} — {rd.scoreB}</p>
        <p className="text-xs text-slate-400 mt-1">Drużyna A · Drużyna B</p>
        {rd.scorers && rd.scorers.length > 0 && (
          <p className="text-xs text-slate-500 mt-1">{rd.scorers.length} bramka{rd.scorers.length > 1 ? 'rzy' : 'rz'}</p>
        )}
      </div>
    );
  }
  if (rd.type === 'volleyball') {
    return (
      <div className="py-2 mb-4">
        <p className="text-3xl font-bold text-slate-900 tracking-tight text-center">{rd.setsA} — {rd.setsB} <span className="text-base font-normal text-slate-400">sety</span></p>
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          {rd.sets.map((s, i) => (
            <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{s.a}:{s.b}</span>
          ))}
        </div>
      </div>
    );
  }
  if (rd.type === 'basketball') {
    return (
      <div className="text-center py-2 mb-4">
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{rd.scoreA} — {rd.scoreB}</p>
        <p className="text-xs text-slate-400 mt-1">pkt</p>
      </div>
    );
  }
  if (rd.type === 'racing') {
    return (
      <div className="py-2 mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Klasyfikacja:</p>
        <ol className="space-y-1">
          {rd.rankings.map((r, i) => (
            <li key={r.participantId} className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
              <span className="text-slate-800">{r.participantId}</span>
              {r.lapTime && <span className="text-slate-400 text-xs">{r.lapTime}</span>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (rd.type === 'generic') {
    return (
      <div className="py-2 mb-4 text-center">
        <p className="text-lg font-semibold text-slate-900">{rd.text}</p>
        {rd.winner && <p className="text-xs text-slate-500 mt-1">Zwycięzca: Drużyna {rd.winner}</p>}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  sport: string;
  eventId: string;
  organizerId: string;
  currentUserId: string;
  isOrganizer: boolean;
  participants: EventParticipant[];
  initialResult: MatchResult | null;
  initialGoals: Array<{ participantId: string; goals: number }>;
  onSaved: (result: MatchResult) => void;
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------
export default function MatchResultForm({
  sport, eventId, organizerId, currentUserId, isOrganizer,
  participants, initialResult, initialGoals, onSaved,
}: Props) {
  const family = sportFamily(sport);
  const regulars = participants.filter((p) => !p.isReserve);

  // --- Goals / football / futsal / handball ---
  const [scoreA, setScoreA] = useState(String(initialResult?.resultData && 'scoreA' in initialResult.resultData ? (initialResult.resultData as { scoreA: number }).scoreA : (initialResult?.scoreA ?? '')));
  const [scoreB, setScoreB] = useState(String(initialResult?.resultData && 'scoreB' in initialResult.resultData ? (initialResult.resultData as { scoreB: number }).scoreB : (initialResult?.scoreB ?? '')));
  const [scorers, setScorers] = useState<GoalsScorerStat[]>(
    (initialResult?.resultData as { type: 'goals'; scorers?: GoalsScorerStat[] } | undefined)?.scorers ??
    initialGoals.map((g) => ({ participantId: g.participantId, goals: g.goals }))
  );

  // --- Volleyball ---
  const initSets = (initialResult?.resultData as { type: 'volleyball'; sets?: VolleyballSet[] } | undefined)?.sets ?? [{ a: 0, b: 0 }];
  const [sets, setSets] = useState<VolleyballSet[]>(initSets);
  const setsA = sets.filter((s) => s.a > s.b).length;
  const setsB = sets.filter((s) => s.b > s.a).length;

  // --- Basketball ---
  const [basketA, setBasketA] = useState(String(initialResult?.resultData && 'scoreA' in initialResult.resultData ? (initialResult.resultData as { scoreA: number }).scoreA : (initialResult?.scoreA ?? '')));
  const [basketB, setBasketB] = useState(String(initialResult?.resultData && 'scoreB' in initialResult.resultData ? (initialResult.resultData as { scoreB: number }).scoreB : (initialResult?.scoreB ?? '')));
  const [basketStats, setBasketStats] = useState<BasketballPlayerStat[]>(
    (initialResult?.resultData as { type: 'basketball'; players?: BasketballPlayerStat[] } | undefined)?.players ?? []
  );

  // --- Racing ---
  const initRankings: RacingRank[] = (initialResult?.resultData as { type: 'racing'; rankings?: RacingRank[] } | undefined)?.rankings ??
    regulars.map((p, i) => ({ participantId: p.id, position: i + 1 }));
  const [rankings, setRankings] = useState<RacingRank[]>(initRankings);

  // --- Generic ---
  const [genericText, setGenericText] = useState((initialResult?.resultData as { type: 'generic'; text?: string } | undefined)?.text ?? '');
  const [genericWinner, setGenericWinner] = useState<'A' | 'B' | 'remis' | ''>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Helper: stepper ---
  function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-sm">
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-5 text-center text-sm font-semibold">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-sm">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Build result_data + save
  // ---------------------------------------------------------------------------
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let rd: MatchResultData;
      let sa = 0, sb = 0;
      let winner: 'A' | 'B' | 'remis' | undefined;

      if (family === 'goals') {
        sa = parseInt(scoreA, 10) || 0;
        sb = parseInt(scoreB, 10) || 0;
        winner = sa > sb ? 'A' : sb > sa ? 'B' : 'remis';
        rd = { type: 'goals', scoreA: sa, scoreB: sb, scorers: scorers.filter((s) => s.goals > 0) };
      } else if (family === 'volleyball') {
        winner = setsA > setsB ? 'A' : setsB > setsA ? 'B' : 'remis';
        rd = { type: 'volleyball', setsA, setsB, sets };
      } else if (family === 'basketball') {
        sa = parseInt(basketA, 10) || 0;
        sb = parseInt(basketB, 10) || 0;
        winner = sa > sb ? 'A' : sb > sa ? 'B' : 'remis';
        rd = { type: 'basketball', scoreA: sa, scoreB: sb, players: basketStats.filter((p) => p.points > 0) };
      } else if (family === 'racing') {
        rd = { type: 'racing', rankings };
      } else {
        if (!genericText.trim()) { setError('Wpisz wynik'); setSaving(false); return; }
        winner = genericWinner || undefined;
        rd = { type: 'generic', text: genericText, winner: winner as 'A' | 'B' | 'remis' | undefined };
      }

      await saveMatchResult(eventId, sa, sb, currentUserId, rd, winner);

      onSaved({
        id: initialResult?.id ?? '',
        eventId,
        scoreA: sa,
        scoreB: sb,
        winner,
        resultData: rd,
        recordedBy: currentUserId,
        recordedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4" /> Wynik meczu
      </h2>

      {/* Read-only summary for non-organizers or when result exists */}
      {initialResult && !isOrganizer && <ResultSummary result={initialResult} />}
      {!initialResult && !isOrganizer && (
        <p className="text-sm text-slate-400 text-center py-3">Wynik nie został jeszcze wpisany.</p>
      )}

      {/* Organizer edit form */}
      {isOrganizer && (
        <div className="space-y-5">
          {initialResult && (
            <div className="bg-slate-50 rounded-xl p-3 mb-2">
              <ResultSummary result={initialResult} />
            </div>
          )}

          {/* --- GOALS (football / futsal / handball) --- */}
          {family === 'goals' && (
            <>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Wynik końcowy</p>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={99} value={scoreA} onChange={(e) => setScoreA(e.target.value)}
                    className="w-16 text-center border border-slate-300 rounded-lg px-2 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="A" />
                  <span className="text-slate-400 font-bold text-xl">—</span>
                  <input type="number" min={0} max={99} value={scoreB} onChange={(e) => setScoreB(e.target.value)}
                    className="w-16 text-center border border-slate-300 rounded-lg px-2 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="B" />
                </div>
              </div>

              {regulars.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Strzelcy (gole + asysty)</p>
                  <ul className="space-y-2">
                    {regulars.map((p) => {
                      const s = scorers.find((x) => x.participantId === p.id) ?? { participantId: p.id, goals: 0, assists: 0 };
                      const updateStat = (key: 'goals' | 'assists', val: number) =>
                        setScorers((prev) => {
                          const idx = prev.findIndex((x) => x.participantId === p.id);
                          const upd = { ...s, [key]: val };
                          if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n; }
                          return [...prev, upd];
                        });
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-3 py-1">
                          <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">Gole</span>
                              <Stepper value={s.goals} onChange={(v) => updateStat('goals', v)} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">Asysty</span>
                              <Stepper value={s.assists ?? 0} onChange={(v) => updateStat('assists', v)} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* --- VOLLEYBALL --- */}
          {family === 'volleyball' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Sety</p>
                <div className="text-2xl font-bold text-slate-900">{setsA} — {setsB}</div>
              </div>
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-10">Set {i + 1}</span>
                    <input type="number" min={0} max={99} value={s.a}
                      onChange={(e) => setSets((prev) => { const n = [...prev]; n[i] = { ...n[i], a: parseInt(e.target.value) || 0 }; return n; })}
                      className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
                    <span className="text-slate-400">:</span>
                    <input type="number" min={0} max={99} value={s.b}
                      onChange={(e) => setSets((prev) => { const n = [...prev]; n[i] = { ...n[i], b: parseInt(e.target.value) || 0 }; return n; })}
                      className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
                    {sets.length > 1 && (
                      <button type="button" onClick={() => setSets((prev) => prev.filter((_, j) => j !== i))}
                        className="text-xs text-red-400 hover:text-red-600">Usuń</button>
                    )}
                  </div>
                ))}
              </div>
              {sets.length < 5 && (
                <button type="button" onClick={() => setSets((prev) => [...prev, { a: 0, b: 0 }])}
                  className="mt-2 text-xs text-green-700 hover:text-green-800 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Dodaj set
                </button>
              )}
            </div>
          )}

          {/* --- BASKETBALL --- */}
          {family === 'basketball' && (
            <>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Wynik końcowy (pkt)</p>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} value={basketA} onChange={(e) => setBasketA(e.target.value)}
                    className="w-20 text-center border border-slate-300 rounded-lg px-2 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="A" />
                  <span className="text-slate-400 font-bold text-xl">—</span>
                  <input type="number" min={0} value={basketB} onChange={(e) => setBasketB(e.target.value)}
                    className="w-20 text-center border border-slate-300 rounded-lg px-2 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="B" />
                </div>
              </div>
              {regulars.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Statystyki graczy (opcjonalnie)</p>
                  <ul className="space-y-2">
                    {regulars.map((p) => {
                      const bs: BasketballPlayerStat = basketStats.find((x) => x.participantId === p.id) ?? { participantId: p.id, points: 0 };
                      const update = (patch: Partial<BasketballPlayerStat>) =>
                        setBasketStats((prev) => {
                          const idx = prev.findIndex((x) => x.participantId === p.id);
                          const upd = { ...bs, ...patch };
                          if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n; }
                          return [...prev, upd];
                        });
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Pkt</span>
                            <Stepper value={bs.points} onChange={(v) => update({ points: v })} />
                            <span className="text-xs text-slate-400">Zbiórki</span>
                            <Stepper value={bs.rebounds ?? 0} onChange={(v) => update({ rebounds: v })} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* --- RACING / KARTING --- */}
          {family === 'racing' && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">
                <Medal className="w-4 h-4 inline mr-1" />Klasyfikacja — przeciągnij aby zmienić kolejność
              </p>
              <ul className="space-y-2">
                {rankings.map((r, i) => {
                  const p = participants.find((x) => x.id === r.participantId);
                  return (
                    <li key={r.participantId} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                      <span className="text-sm text-slate-800 flex-1">{p?.name ?? r.participantId}</span>
                      <div className="flex gap-1">
                        {i > 0 && (
                          <button type="button" onClick={() => setRankings((prev) => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n.map((x, j) => ({ ...x, position: j + 1 })); })}
                            className="text-xs text-slate-400 hover:text-slate-700 px-1">↑</button>
                        )}
                        {i < rankings.length - 1 && (
                          <button type="button" onClick={() => setRankings((prev) => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n.map((x, j) => ({ ...x, position: j + 1 })); })}
                            className="text-xs text-slate-400 hover:text-slate-700 px-1">↓</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* --- GENERIC --- */}
          {family === 'generic' && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Wynik</p>
                <input type="text" value={genericText} onChange={(e) => setGenericText(e.target.value)}
                  placeholder="np. 3:1, 120:110, itd."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Zwycięzca (opcjonalnie)</p>
                <div className="flex gap-2">
                  {(['A', 'B', 'remis'] as const).map((w) => (
                    <button key={w} type="button" onClick={() => setGenericWinner((prev) => prev === w ? '' : w)}
                      className={['px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                        genericWinner === w ? 'bg-green-700 text-white border-green-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      ].join(' ')}>
                      {w === 'remis' ? 'Remis' : `Drużyna ${w}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors">
            {saving ? 'Zapisuję…' : (initialResult ? 'Zaktualizuj wynik' : 'Zapisz wynik')}
          </button>
        </div>
      )}
    </div>
  );
}
