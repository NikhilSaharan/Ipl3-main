/* eslint-disable no-unused-vars */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { INITIAL_TEAMS } from './data/teams';
import { calculatePoints } from './utils/scoring';
import { RefreshCw, Zap, Trophy, CheckCircle2, Star, Shield } from 'lucide-react';


const RAPID_API_KEYS = [
  "771a33ee3cmsh1a4213e76ee6caep1fa8d5jsn0f11c5431396",
  "cb9682b781mshdee42b0a24e7a73p16f641jsnee74b56ee34d",
  "3c1e110b5dmsh18f103eaef293a2p15297ajsnc1841ae109e2"
];
const RAPID_API_HOST = "cricbuzz-cricket.p.rapidapi.com";
const IPL_SERIES_ID = "9241"; // IPL 2026

const fetchFromRapidAPI = async (endpoint) => {
  let startIndex = parseInt(localStorage.getItem('rapidapi_key_index') || "0");
  let attempts = 0;

  while (attempts < RAPID_API_KEYS.length) {
    let currentIndex = (startIndex + attempts) % RAPID_API_KEYS.length;
    let apiKey = RAPID_API_KEYS[currentIndex];

    try {
      const res = await axios.get(`https://${RAPID_API_HOST}${endpoint}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPID_API_HOST
        }
      });

      // Sometimes RapidAPI returns 200 OK but with an error message in body if limit exceeded or not subscribed
      if (res.data && res.data.message) {
        const msg = res.data.message.toLowerCase();
        if (msg.includes("not subscribed") || msg.includes("exceeded")) {
          console.warn(`Key ${apiKey} limit exceeded or not subscribed. Trying next...`);
          attempts++;
          continue;
        }
      }

      // Success! Save the working key index.
      localStorage.setItem('rapidapi_key_index', currentIndex.toString());
      return res.data;

    } catch (err) {
      // Axios throws error for 4xx/5xx status codes (e.g., 429 Too Many Requests, 403 Forbidden)
      console.warn(`Key ${apiKey} failed with error (Status: ${err.response?.status || 'unknown'}). Trying next...`);
      attempts++;
    }
  }

  return null; // All keys exhausted or failed
};

const NAME_MAP = {
  "Sheheferd": "Romario Shepherd",
  "Rizvi": "Sameer Rizvi",
  "Jurel": "Dhruv Jurel",
  "Vaibhav arorra": "Vaibhav Arora",
  "Nitinsh Rana": "Nitish Rana",
  "Surya": "Suryakumar Yadav",
  "Phil Salt": "Philip Salt",
  "Phill Salt": "Philip Salt",
  "PS Salt": "Philip Salt",
  "V Kohli": "Virat Kohli",
  "RG Sharma": "Rohit Sharma",
  "H Pandya": "Hardik Pandya",
  "JJ Bumrah": "Jasprit Bumrah",
  "M Siraj": "Mohammed Siraj",
  "M Shami": "Mohammed Shami",
  "A Singh": "Arshdeep Singh",
  "Y Chahal": "Yuzvendra Chahal",
  "K Yadav": "Kuldeep Yadav",
  "RA Jadeja": "Ravindra Jadeja",
  "AR Patel": "Axar Patel",
  "Varun Chakravarthy": "Varun Chakaravarthy",
  "I Kishan": "Ishan Kishan",
  "S Samson": "Sanju Samson",
  "RR Pant": "Rishabh Pant",
  "K Rahul": "KL Rahul",
  "JC Buttler": "Jos Buttler",
  "N Pooran": "Nicholas Pooran",
  "S Gill": "Shubman Gill",
  "RD Gaikwad": "Ruturaj Gaikwad",
  "YBK Jaiswal": "Yashasvi Jaiswal",
  "SK Yadav": "Suryakumar Yadav",
  "T Varma": "Tilak Varma",
  "SS Iyer": "Shreyas Iyer",
  "D Padikkal": "Devdutt Padikkal",
  "R Patidar": "Rajat Patidar",
  "B Sudharsan": "Sai Sudharsan",
  "AK Markram": "Aiden Markram",
  "TM Head": "Travis Head",
  "MR Marsh": "Mitchell Marsh",
  "M Jansen": "Marco Jansen",
  "S Dube": "Shivam Dube",
  "A Sharma": "Abhishek Sharma",
  "Nitish Reddy": "Nitish Kumar Reddy",
  "HE Klaasen": "Heinrich Klaasen",
  "V Sooryavanshi": "Vaibhav Sooryavanshi",
  "P Krishna": "Prasidh Krishna",
};


const normalizeName = (rawName) => {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  return NAME_MAP[trimmed] || trimmed;
};

function App() {
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('ipl_fantasy_v3');
    return saved ? JSON.parse(saved) : INITIAL_TEAMS.map(t => ({
      ...t,
      totalPoints: 0,
      syncedMatches: [],
      players: t.players.map(p => ({ ...p, points: 0 }))
    }));
  });

  const [loading, setLoading] = useState(false);
  const [errorMatches, setErrorMatches] = useState([]);
  const [syncStatus, setSyncStatus] = useState("");
  const [availableMatches, setAvailableMatches] = useState([]); // ✅ NEW

  useEffect(() => {
    localStorage.setItem('ipl_fantasy_v3', JSON.stringify(teams));
  }, [teams]);

  const buildPlayerStatsMap = (scorecard) => {
    const statsMap = {};

    const ensure = (rawName) => {
      const name = normalizeName(rawName);
      if (!name) return null;
      if (!statsMap[name]) statsMap[name] = { played: true };
      return name;
    };

    const addCatch = (rawName) => {
      const name = ensure(rawName);
      if (name) statsMap[name].catches = (statsMap[name].catches || 0) + 1;
    };

    const addStumping = (rawName) => {
      const name = ensure(rawName);
      if (name) statsMap[name].stumping = (statsMap[name].stumping || 0) + 1;
    };

    scorecard.forEach(inning => {
      // --- CRICBUZZ RAPIDAPI FORMAT ---
      if (inning.batsman) {
        inning.batsman.forEach(b => {
          const batsmanName = ensure(b.name);
          if (!batsmanName) return;

          statsMap[batsmanName].runs = (statsMap[batsmanName].runs || 0) + (b.runs || 0);
          statsMap[batsmanName].balls = (statsMap[batsmanName].balls || 0) + (b.balls || 0);
          statsMap[batsmanName].fours = (statsMap[batsmanName].fours || 0) + (b.fours || 0);
          statsMap[batsmanName].sixes = (statsMap[batsmanName].sixes || 0) + (b.sixes || 0);

          if (b.runs === 0 && b.outdec && b.outdec.toLowerCase() !== "not out" && b.outdec !== "") {
            statsMap[batsmanName].isDuck = true;
          }

          const rawOutDesc = b.outdec || '';
          const outDescLower = rawOutDesc.toLowerCase();

          if (outDescLower.includes(' b ') || outDescLower.match(/^b\s+/)) {
            if (outDescLower.startsWith('c ') && !outDescLower.startsWith('c & b')) {
              const match = rawOutDesc.match(/^c\s+(.+?)\s+b\s+/i);
              if (match && match[1]) {
                const catcher = match[1].replace(/^\(sub\)\s+/i, '');
                addCatch(catcher);
              }
            } else if (outDescLower.startsWith('st ')) {
              const match = rawOutDesc.match(/^st\s+(.+?)\s+b\s+/i);
              if (match && match[1]) addStumping(match[1]);
            } else if (outDescLower.startsWith('c & b ')) {
              const match = rawOutDesc.match(/^c\s*&\s*b\s+(.+)/i);
              if (match && match[1]) addCatch(match[1]);
            }

            if (outDescLower.includes('lbw b ') || outDescLower.match(/^b\s+/)) {
              const bowlerMatch = rawOutDesc.match(/(?:lbw\s+)?b\s+(.+)$/i);
              if (bowlerMatch && bowlerMatch[1]) {
                const bowlerName = ensure(bowlerMatch[1]);
                if (bowlerName) {
                  statsMap[bowlerName].lbw_or_bowled = (statsMap[bowlerName].lbw_or_bowled || 0) + 1;
                }
              }
            }
          }
        });
      }

      if (inning.bowler) {
        inning.bowler.forEach(bw => {
          const name = ensure(bw.name);
          if (!name) return;
          statsMap[name].wickets = (statsMap[name].wickets || 0) + (bw.wickets || 0);
          statsMap[name].overs = (statsMap[name].overs || 0) + (bw.overs || 0);
          statsMap[name].runs_conceded = (statsMap[name].runs_conceded || 0) + (bw.runs || 0);
        });
      }

      // --- CRICAPI FORMAT FALLBACK ---
      if (inning.batting) {
        inning.batting.forEach(b => {
          const batsmanName = ensure(b.batsman?.name);
          if (!batsmanName) return;

          statsMap[batsmanName].runs = (statsMap[batsmanName].runs || 0) + (b.r || 0);
          statsMap[batsmanName].balls = (statsMap[batsmanName].balls || 0) + (b.b || 0);
          statsMap[batsmanName].fours = (statsMap[batsmanName].fours || 0) + (b['4s'] || 0);
          statsMap[batsmanName].sixes = (statsMap[batsmanName].sixes || 0) + (b['6s'] || 0);
          if (b.r === 0 && b.dismissal) statsMap[batsmanName].isDuck = true;

          const dismissal = (b.dismissal || '').toLowerCase();
          const dismissalText = (b['dismissal-text'] || '').toLowerCase();

          if (dismissal === 'lbw' || dismissal === 'bowled') {
            const bowlerName = ensure(b.bowler?.name);
            if (bowlerName) {
              statsMap[bowlerName].lbw_or_bowled = (statsMap[bowlerName].lbw_or_bowled || 0) + 1;
            }
          }

          if (dismissal === 'catch') {
            if (b.catcher?.name) {
              addCatch(b.catcher.name);
            } else if (b['dismissal-text']) {
              const text = b['dismissal-text'];
              const match = text.match(/^c\s+(.+?)\s+b/i);
              if (match && match[1]) {
                console.log(`🛠 Parsed catcher from text: ${match[1]}`);
                addCatch(match[1]);
              }
            }
          } else if (dismissal === 'stumped' && b.catcher?.name) {
            addStumping(b.catcher.name);
          } else if (
            dismissal === 'caught and bowled' ||
            dismissalText.startsWith('c&b')
          ) {
            if (b.bowler?.name) addCatch(b.bowler.name);
          }
        });
      }

      if (inning.bowling) {
        inning.bowling.forEach(bw => {
          const name = ensure(bw.bowler?.name);
          if (!name) return;
          statsMap[name].wickets = (statsMap[name].wickets || 0) + (bw.w || 0);
          statsMap[name].overs = (statsMap[name].overs || 0) + (bw.o || 0);
          statsMap[name].runs_conceded = (statsMap[name].runs_conceded || 0) + (bw.r || 0);
        });
      }

    });

    return statsMap;
  };

  // ✅ FETCH MATCH LIST ONLY
  const syncTournament = async () => {
    if (loading) return;
    setLoading(true);
    setSyncStatus("Fetching Matches...");

    try {
      const apiData = await fetchFromRapidAPI(`/series/v1/${IPL_SERIES_ID}`);

      if (!apiData || (!apiData.matchDetails && !apiData.data)) {
        console.error("❌ API FAIL: RapidAPI data failed");
        alert("API se data nahi aaya (Limit khtm ho gayi hai ya error hai)");
        return;
      }

      let allMatches = [];

      // Parse Cricbuzz RapidAPI format
      if (apiData.matchDetails) {
        apiData.matchDetails.forEach(md => {
          if (md.matchDetailsMap && md.matchDetailsMap.match) {
            md.matchDetailsMap.match.forEach(m => {
              if (m.matchInfo) {
                allMatches.push({
                  id: m.matchInfo.matchId,
                  name: m.matchInfo.matchDesc,
                  teams: [
                    m.matchInfo.team1?.teamSName || m.matchInfo.team1?.teamName || "Team 1",
                    m.matchInfo.team2?.teamSName || m.matchInfo.team2?.teamName || "Team 2"
                  ],
                  matchEnded: m.matchInfo.state && (m.matchInfo.state.toLowerCase() === 'complete' || m.matchInfo.state.toLowerCase() === 'results')
                });
              }
            });
          }
        });
      }
      // Fallback if the user actually meant CricAPI format on RapidAPI
      else if (apiData.data && apiData.data.matchList) {
        allMatches = apiData.data.matchList;
      }

      const alreadySynced = teams[0].syncedMatches || [];
      const failedMatches = errorMatches || [];

      const pending = allMatches
        .filter(m =>
          m.matchEnded &&
          (
            !alreadySynced.includes(m.id) ||
            failedMatches.includes(m.id)
          )
        )
        .sort((a, b) => {
          const getMatchNo = (name) => {
            const match = name.match(/(\d+)(st|nd|rd|th)\sMatch/i);
            return match ? parseInt(match[1]) : 0;
          };

          return getMatchNo(a.name) - getMatchNo(b.name);
        })
        .slice(48);

      setAvailableMatches(pending);

      if (pending.length === 0) alert("All matches already synced!");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSyncStatus("");
    }
  };

  // ✅ SINGLE MATCH SYNC
  const syncSingleMatch = async (match, selectedTeam = "ALL") => {
    try {
      setLoading(true);
      setSyncStatus(`Syncing ${match.name}`);

      const apiData = await fetchFromRapidAPI(`/mcenter/v1/${match.id}/hscard`);

      // Determine scorecard data source based on API type
      let scorecardData = null;
      if (apiData && apiData.scorecard) {
        scorecardData = apiData.scorecard; // Cricbuzz format
      } else if (apiData && apiData.data && apiData.data.scorecard) {
        scorecardData = apiData.data.scorecard; // CricAPI fallback format
      }

      if (!scorecardData) {
        setErrorMatches(prev => [...prev, match.id]);
        return;
      }

      const statsMap = buildPlayerStatsMap(scorecardData);

      // Build set of players who actually played in this match
      const teamAFull = match.teams[0].toLowerCase();
      const teamBFull = match.teams[1].toLowerCase();

      const playerToIPLTeam = {};

      scorecardData.forEach(inning => {
        // --- CRICBUZZ ---
        if (inning.batsman && inning.batteamsname) {
          const battingTeam = inning.batteamsname.toLowerCase();
          
          let bowlingTeam = "";
          if (teamAFull.includes(battingTeam) || battingTeam.includes(teamAFull)) {
            bowlingTeam = teamBFull;
          } else {
            bowlingTeam = teamAFull;
          }

          inning.batsman.forEach(b => {
            const name = normalizeName(b.name);
            if (name) playerToIPLTeam[name] = battingTeam;
          });
          
          if (inning.bowler) {
            inning.bowler.forEach(bw => {
              const name = normalizeName(bw.name);
              if (name) playerToIPLTeam[name] = bowlingTeam;
            });
          }
        }

        // --- CRICAPI FALLBACK ---
        const inningTeam = (inning.inning || "").toLowerCase();
        if (inningTeam) {
          const isTeamA = inningTeam.includes(teamAFull);
          const isTeamB = inningTeam.includes(teamBFull);

          inning.batting?.forEach(b => {
            const name = normalizeName(b.batsman?.name);
            if (!name) return;
            if (isTeamA) playerToIPLTeam[name] = teamAFull;
            else if (isTeamB) playerToIPLTeam[name] = teamBFull;
          });

          inning.bowling?.forEach(bw => {
            const name = normalizeName(bw.bowler?.name);
            if (!name) return;
            if (isTeamA) playerToIPLTeam[name] = teamBFull;
            else if (isTeamB) playerToIPLTeam[name] = teamAFull;
          });
        }
      });

      const updated = teams.map(team => {
        let pts = 0;
        const players = team.players.map(p => {
          const normalizedName = normalizeName(p.name);
          const stats = statsMap[p.name] || statsMap[normalizedName];

          // Team filter
          if (selectedTeam !== "ALL") {
            const selected = selectedTeam.toLowerCase();
            const playerTeam = playerToIPLTeam[normalizedName] || playerToIPLTeam[p.name];

            // Check if player belongs to selected team
            const belongsToSelected = playerTeam && selected.includes(playerTeam);
            if (!belongsToSelected) return p;
          }

          if (!stats) return p;

          const newPts = calculatePoints(stats, p.role, true, p.isCaptain, p.isVC);
          pts += newPts;

          return { ...p, points: (p.points || 0) + newPts };
        });

        return {
          ...team,
          totalPoints: team.totalPoints + pts,
          players,
          syncedMatches: Array.from(
            new Set([...(team.syncedMatches || []), match.id])
          )
        };
      });

      setTeams(updated);

    } catch (e) {
      console.error(e);
      setErrorMatches(prev => [...prev, match.id]);
    } finally {
      setLoading(false);
      setSyncStatus("");
    }
  };
  const retryMatch = async (match) => {
    setErrorMatches(prev => prev.filter(id => id !== match.id));
    await syncSingleMatch(match, "ALL");
  };

  const resetAll = () => {
    const fresh = INITIAL_TEAMS.map(t => ({
      ...t,
      totalPoints: 0,
      syncedMatches: [],
      players: t.players.map(p => ({ ...p, points: 0 }))
    }));
    setTeams(fresh);
    localStorage.removeItem('ipl_fantasy_v3');
  };

  const sortedTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* HEADER SAME */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 mb-10 shadow-2xl backdrop-blur-md">
          <div>
            <h1 className="text-5xl font-black italic text-yellow-500">IPL 2026 TRACKER</h1>
          </div>
          <div className="mt-8 md:mt-0 flex flex-col items-center gap-3">
            <button onClick={syncTournament} disabled={loading}
              className="bg-white text-black px-10 py-5 rounded-[2rem] font-black flex gap-3">
              {loading ? "Loading..." : "SYNC TOURNAMENT"}
            </button>
            {syncStatus && <p className="text-yellow-500 text-xs">{syncStatus}</p>}
            <button onClick={resetAll}>Reset</button>
          </div>
        </header>

        {/* ✅ MATCH LIST */}
        {availableMatches.length > 0 && (
          <div className="mb-10 space-y-2">
            {availableMatches.map(match => {
              const teamsFromMatch = match.name.split(" vs ");

              const teamA = match.teams[0];
              const teamB = match.teams[1];

              return (

                <div key={match.id} className="flex justify-between bg-zinc-900 p-3 rounded-xl">

                  <span>{match.name}</span>
                  {teams[0].syncedMatches?.includes(match.id) ? (
                    <span className="text-green-500 font-bold">Synced</span>
                  ) : errorMatches.includes(match.id) ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-red-500 font-bold">Limit Over</span>
                      <button
                        onClick={() => retryMatch(match)}
                        className="text-blue-400 text-xs underline"
                      >
                        Refresh
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => syncSingleMatch(match, "ALL")}
                        className="text-yellow-400 text-xs"
                      >
                        ALL
                      </button>

                      <button
                        onClick={() => syncSingleMatch(match, teamA)}
                        className="text-green-400 text-xs"
                      >
                        {teamA}
                      </button>

                      <button
                        onClick={() => syncSingleMatch(match, teamB)}
                        className="text-blue-400 text-xs"
                      >
                        {teamB}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TEAM UI SAME */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teams.map((team, i) => (
            <div key={i} className="group bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden transition-all hover:border-yellow-500/30 shadow-lg">

              <div className="p-8 bg-zinc-800/50 flex justify-between items-center border-b border-white/5 group-hover:bg-zinc-800 transition-colors">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter">{team.owner}</h2>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                    {team.syncedMatches?.length || 0} Matches Synced
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-yellow-500 uppercase">Points</p>
                  <p className="text-3xl font-mono font-black">{team.totalPoints}</p>
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[450px] overflow-y-auto bg-black/20">
                {team.players.map((p, j) => (
                  <div key={j} className="flex justify-between items-center p-3 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800 transition-all">

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-300 group-hover:text-white">{p.name}</span>

                        {p.isCaptain && (
                          <span className="bg-yellow-500 text-black text-[8px] px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5">
                            <Star size={8} fill="black" /> C
                          </span>
                        )}

                        {p.isVC && (
                          <span className="bg-zinc-400 text-black text-[8px] px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5">
                            <Shield size={8} fill="black" /> VC
                          </span>
                        )}
                      </div>

                      <span className="text-[9px] uppercase font-black text-zinc-600 tracking-wider">
                        {p.role}
                      </span>
                    </div>

                    <span className="text-lg font-mono font-black text-yellow-500">
                      {p.points}
                    </span>

                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;

