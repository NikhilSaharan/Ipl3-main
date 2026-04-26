export const calculatePoints = (stats, role, played, isCaptain = false, isVC = false) => {
  let p = 0;
  if (!played) return 0;

  p += 4; // Playing XI Bonus

  // --- BATTING ---
  p += (stats.runs || 0) * 1;
  if (stats.fours) p += stats.fours * 4;
  if (stats.sixes) p += stats.sixes * 6;
  if (stats.runs >= 100) p += 16;
  else if (stats.runs >= 75) p += 12;
  else if (stats.runs >= 50) p += 8;
  else if (stats.runs >= 25) p += 4;
 if (stats.isDuck && role !== "Bowler") {
  p -= 2;
}

  // --- STRIKE RATE (only Batsman & Allrounder, min 10 balls) ---
  if (role !== "Bowler" && (stats.balls || 0) >= 10) {
    const sr = ((stats.runs || 0) / stats.balls) * 100;
    if      (sr > 170)              p += 6;
    else if (sr > 150)              p += 4;
    else if (sr >= 130)             p += 2;
    else if (sr >= 60 && sr <= 70)  p -= 2;
    else if (sr >= 50 && sr < 60)   p -= 4;
    else if (sr < 50)               p -= 6;
  }

  // --- BOWLING ---
  p += (stats.wickets || 0) * 30;
  if (stats.lbw_or_bowled) p += stats.lbw_or_bowled * 8;
  p += (stats.dots || 0) * 1;
  if (stats.maiden) p += stats.maiden * 12;
  if (stats.wickets >= 5) p += 12;
  else if (stats.wickets >= 4) p += 8;
  else if (stats.wickets >= 3) p += 4;

  // --- FIELDING ---
  p += (stats.catches || 0) * 8;
  if (stats.catches >= 3) p += 4;
  p += (stats.stumping || 0) * 12;
  p += (stats.runout_direct || 0) * 12;
  p += (stats.runout_indirect || 0) * 6;

 // --- ECONOMY RATE (min 2 overs) ---
if ((stats.overs || 0) >= 2) {
  const econ = (stats.runs_conceded || 0) / stats.overs;

  if (econ < 5) {
    p += 6;
  } 
  else if (econ >= 5 && econ <= 5.99) {
    p += 4;
  } 
  else if (econ >= 6 && econ <= 7) {
    p += 2;
  } 
  else if (econ >= 10 && econ <= 11) {
    p -= 2;
  } 
  else if (econ > 11 && econ <= 12) {
    p -= 4;
  } 
  else if (econ > 12) {
    p -= 6;
  }
}

  // --- CAPTAIN & VICE-CAPTAIN ---
  if (isCaptain)   return p * 2;
  else if (isVC)   return p * 1.5;

  return p;
};
