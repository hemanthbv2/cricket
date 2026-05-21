/* ============================================
   CrickDesk - Data Persistence Layer
   ============================================ */

window.CrickDeskData = {

  STORAGE_KEY: 'crickdesk_data',

  _data: null,

  /**
   * Get the default empty data structure
   */
  _defaultData() {
    return {
      tournament: {
        name: '',
        startDate: '',
        endDate: '',
        format: 'round-robin',
        oversPerMatch: 6,
        ballsPerOver: 6,
        playersPerTeam: 8,
        lastManStands: false,
        widesEnabled: true,
        noBallsEnabled: true,
        bonusRunsEnabled: false,
        pointsSystem: { win: 2, loss: 0, tie: 1, nr: 1, bonus: 1 },
        mvpWeights: { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 }
      },
      venues: [],
      teams: [],
      players: [],
      matches: [],
      hallOfFame: { manOfTournament: null, awards: [] },
      pastScores: []
    };
  },

  /**
   * Load data from localStorage
   */
  load() {
    if (this._data) return this._data;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this._data = JSON.parse(stored);
        // Merge with defaults to handle missing keys after schema upgrades
        const defaults = this._defaultData();
        for (const key of Object.keys(defaults)) {
          if (this._data[key] === undefined) {
            this._data[key] = defaults[key];
          }
        }
      } else {
        this._data = this._defaultData();
      }
    } catch (e) {
      console.error('[CrickDesk] Failed to load data:', e);
      this._data = this._defaultData();
    }
    return this._data;
  },

  /**
   * Save data to localStorage
   */
  save(data) {
    if (data) this._data = data;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error('[CrickDesk] Failed to save data:', e);
    }
  },

  // ---- Tournament ----
  getTournament() {
    return this.load().tournament;
  },
  saveTournament(t) {
    const data = this.load();
    data.tournament = { ...data.tournament, ...t };
    this.save(data);
  },

  // ---- Teams ----
  getTeams() {
    return this.load().teams || [];
  },
  getTeam(id) {
    return this.getTeams().find(t => t.id === id) || null;
  },
  saveTeam(team) {
    const data = this.load();
    const idx = data.teams.findIndex(t => t.id === team.id);
    if (idx >= 0) {
      data.teams[idx] = team;
    } else {
      data.teams.push(team);
    }
    this.save(data);
  },
  deleteTeam(id) {
    const data = this.load();
    data.teams = data.teams.filter(t => t.id !== id);
    data.players = data.players.filter(p => p.teamId !== id);
    this.save(data);
  },

  // ---- Players ----
  getPlayers() {
    return this.load().players || [];
  },
  getPlayersByTeam(teamId) {
    return this.getPlayers().filter(p => p.teamId === teamId);
  },
  getPlayer(id) {
    return this.getPlayers().find(p => p.id === id) || null;
  },
  savePlayer(player) {
    const data = this.load();
    const idx = data.players.findIndex(p => p.id === player.id);
    if (idx >= 0) {
      data.players[idx] = player;
    } else {
      data.players.push(player);
    }
    this.save(data);
  },
  deletePlayer(id) {
    const data = this.load();
    data.players = data.players.filter(p => p.id !== id);
    this.save(data);
  },

  // ---- Matches ----
  getMatches() {
    return this.load().matches || [];
  },
  getMatch(id) {
    return this.getMatches().find(m => m.id === id) || null;
  },
  getMatchesByTeam(teamId) {
    return this.getMatches().filter(m => m.team1Id === teamId || m.team2Id === teamId);
  },
  getMatchesByStatus(status) {
    return this.getMatches().filter(m => m.status === status);
  },
  saveMatch(match) {
    const data = this.load();
    const idx = data.matches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      data.matches[idx] = match;
    } else {
      data.matches.push(match);
    }
    this.save(data);
  },
  deleteMatch(id) {
    const data = this.load();
    data.matches = data.matches.filter(m => m.id !== id);
    this.save(data);
  },

  // ---- Venues ----
  getVenues() {
    return this.load().venues || [];
  },
  saveVenue(venue) {
    const data = this.load();
    const idx = data.venues.findIndex(v => v.id === venue.id);
    if (idx >= 0) {
      data.venues[idx] = venue;
    } else {
      data.venues.push(venue);
    }
    this.save(data);
  },
  deleteVenue(id) {
    const data = this.load();
    data.venues = data.venues.filter(v => v.id !== id);
    this.save(data);
  },

  // ---- Past Scores ----
  getPastScores(playerId) {
    const data = this.load();
    if (playerId) return (data.pastScores || []).filter(s => s.playerId === playerId);
    return data.pastScores || [];
  },
  savePastScore(score) {
    const data = this.load();
    if (!data.pastScores) data.pastScores = [];
    const idx = data.pastScores.findIndex(s => s.id === score.id);
    if (idx >= 0) {
      data.pastScores[idx] = score;
    } else {
      data.pastScores.push(score);
    }
    this.save(data);
  },

  // ---- Hall of Fame ----
  getHallOfFame() {
    return this.load().hallOfFame || { manOfTournament: null, awards: [] };
  },
  saveHallOfFame(h) {
    const data = this.load();
    data.hallOfFame = h;
    this.save(data);
  },

  // ---- Export / Import ----
  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },
  importJSON(str) {
    try {
      const parsed = JSON.parse(str);
      // Basic validation: must have teams and matches arrays
      if (!parsed || typeof parsed !== 'object') return false;
      if (!Array.isArray(parsed.teams)) return false;
      if (!Array.isArray(parsed.matches)) return false;

      const defaults = this._defaultData();
      for (const key of Object.keys(defaults)) {
        if (parsed[key] === undefined) {
          parsed[key] = defaults[key];
        }
      }
      this._data = parsed;
      this.save();
      return true;
    } catch (e) {
      console.error('[CrickDesk] Import error:', e);
      return false;
    }
  },

  /**
   * Clear all data
   */
  clearAll() {
    localStorage.removeItem(this.STORAGE_KEY);
    this._data = null;
  },

  /* ============================================
     SEED DEMO DATA
     ============================================ */
  seedDemoData() {
    const id = (prefix) => prefix + '_' + Math.random().toString(36).substring(2, 10);

    // ---- Venues ----
    const venueA = { id: id('v'), name: 'Office Ground A', location: 'Building 3 Campus' };
    const venueB = { id: id('v'), name: 'Rooftop Arena', location: 'Tower B Terrace' };

    // ---- Teams ----
    const teamDefs = [
      { name: 'Thunder Strikers', shortName: 'TSK', color: '#ef4444' },
      { name: 'Royal Challengers', shortName: 'RCH', color: '#3b82f6' },
      { name: 'Super Kings', shortName: 'SPK', color: '#f59e0b' },
      { name: 'Knight Riders', shortName: 'KNR', color: '#8b5cf6' },
      { name: 'Sunrisers', shortName: 'SRH', color: '#f97316' },
      { name: 'Delhi Capitals', shortName: 'DLC', color: '#06b6d4' }
    ];

    // ---- Players per team (8 each) ----
    const playerNames = [
      // Thunder Strikers (0)
      [
        { name: 'Rohit Mehta', role: 'batsman', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Vikram Rathore', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Arjun Patil', role: 'all-rounder', bat: 'left', bowl: 'left-arm medium' },
        { name: 'Suresh Yadav', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Anil Kapoor', role: 'wicket-keeper', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Deepak Nair', role: 'bowler', bat: 'right', bowl: 'left-arm spin' },
        { name: 'Karan Malhotra', role: 'batsman', bat: 'right', bowl: 'right-arm leg-break' },
        { name: 'Rajesh Iyer', role: 'all-rounder', bat: 'right', bowl: 'right-arm medium' }
      ],
      // Royal Challengers (1)
      [
        { name: 'Virat Singh', role: 'batsman', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Faisal Khan', role: 'batsman', bat: 'left', bowl: 'left-arm spin' },
        { name: 'Dinesh Karthik', role: 'wicket-keeper', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Yuzvendra Chahal', role: 'bowler', bat: 'right', bowl: 'right-arm leg-break' },
        { name: 'Mohammed Siraj', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Glen Patel', role: 'all-rounder', bat: 'left', bowl: 'left-arm fast' },
        { name: 'Sanjay Bangar', role: 'batsman', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Ravi Ashwin', role: 'all-rounder', bat: 'right', bowl: 'right-arm off-break' }
      ],
      // Super Kings (2)
      [
        { name: 'MS Dhawan', role: 'wicket-keeper', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Ruturaj Deshmukh', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Shivam Dubey', role: 'all-rounder', bat: 'left', bowl: 'right-arm medium' },
        { name: 'Deepak Chahar', role: 'bowler', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Ravindra Joshi', role: 'bowler', bat: 'left', bowl: 'left-arm spin' },
        { name: 'Ambati Raju', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Tushar Sharma', role: 'batsman', bat: 'left', bowl: 'left-arm medium' },
        { name: 'Moeen Kumar', role: 'all-rounder', bat: 'left', bowl: 'right-arm off-break' }
      ],
      // Knight Riders (3)
      [
        { name: 'Shreyas Venkat', role: 'batsman', bat: 'right', bowl: 'right-arm leg-break' },
        { name: 'Andre Mishra', role: 'all-rounder', bat: 'left', bowl: 'right-arm fast' },
        { name: 'Sunil Rana', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Nitish Gupta', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Varun Pillai', role: 'bowler', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Rinku Verma', role: 'batsman', bat: 'left', bowl: 'right-arm medium' },
        { name: 'Umesh Patel', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Rahul Tiwari', role: 'wicket-keeper', bat: 'right', bowl: 'right-arm medium' }
      ],
      // Sunrisers (4)
      [
        { name: 'Abhishek Reddy', role: 'batsman', bat: 'left', bowl: 'left-arm spin' },
        { name: 'Travis Hegde', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Heinrich Prasad', role: 'wicket-keeper', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Bhuvnesh Kumar', role: 'bowler', bat: 'right', bowl: 'right-arm medium' },
        { name: 'Thangarasu Naidu', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Aiden Menon', role: 'all-rounder', bat: 'left', bowl: 'left-arm fast' },
        { name: 'Rahul Tripathi', role: 'batsman', bat: 'right', bowl: 'right-arm leg-break' },
        { name: 'Washington Singh', role: 'all-rounder', bat: 'left', bowl: 'right-arm off-break' }
      ],
      // Delhi Capitals (5)
      [
        { name: 'David Mishra', role: 'batsman', bat: 'left', bowl: 'right-arm leg-break' },
        { name: 'Rishabh Saxena', role: 'wicket-keeper', bat: 'left', bowl: 'right-arm medium' },
        { name: 'Axar Pandey', role: 'all-rounder', bat: 'left', bowl: 'left-arm spin' },
        { name: 'Anrich Kulkarni', role: 'bowler', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Prithvi Shukla', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' },
        { name: 'Kuldeep Sahu', role: 'bowler', bat: 'right', bowl: 'left-arm spin' },
        { name: 'Mitchell Jain', role: 'all-rounder', bat: 'right', bowl: 'right-arm fast' },
        { name: 'Lalit Bhatia', role: 'batsman', bat: 'right', bowl: 'right-arm off-break' }
      ]
    ];

    // Build teams and players
    const teams = [];
    const players = [];

    teamDefs.forEach((td, ti) => {
      const teamId = id('team');
      const teamPlayers = playerNames[ti].map((pd, pi) => {
        const pid = id('p');
        return {
          id: pid,
          name: pd.name,
          teamId: teamId,
          role: pd.role,
          battingStyle: pd.bat,
          bowlingStyle: pd.bowl
        };
      });

      const captain = teamPlayers.find(p => p.role === 'batsman') || teamPlayers[0];

      teams.push({
        id: teamId,
        name: td.name,
        shortName: td.shortName,
        color: td.color,
        captainId: captain.id,
        logo: ''
      });

      players.push(...teamPlayers);
    });

    // Helpers
    const bpo = 6;
    const oversPerMatch = 6;
    const totalBallsPerInnings = oversPerMatch * bpo;

    function getTeamPlayers(teamId) {
      return players.filter(p => p.teamId === teamId);
    }

    function pickBowlers(teamPlayers) {
      const bowlers = teamPlayers.filter(p => p.role === 'bowler' || p.role === 'all-rounder');
      if (bowlers.length < 3) {
        const others = teamPlayers.filter(p => !bowlers.includes(p));
        while (bowlers.length < 3 && others.length > 0) {
          bowlers.push(others.shift());
        }
      }
      return bowlers;
    }

    function pickBattingOrder(teamPlayers) {
      const order = [];
      const keeper = teamPlayers.find(p => p.role === 'wicket-keeper');
      const batsmen = teamPlayers.filter(p => p.role === 'batsman');
      const allRounders = teamPlayers.filter(p => p.role === 'all-rounder');
      const bowlersOnly = teamPlayers.filter(p => p.role === 'bowler');

      if (keeper) order.push(keeper);
      order.push(...batsmen);
      order.push(...allRounders);
      order.push(...bowlersOnly);

      // De-duplicate
      const unique = [];
      const seen = new Set();
      for (const p of order) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          unique.push(p);
        }
      }
      return unique;
    }

    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function choice(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    // Simulate one innings
    function simulateInnings(battingTeamId, bowlingTeamId, targetScore) {
      const battingPlayers = getTeamPlayers(battingTeamId);
      const bowlingPlayers = getTeamPlayers(bowlingTeamId);
      const battingOrder = pickBattingOrder(battingPlayers);
      const bowlerPool = pickBowlers(bowlingPlayers);
      const maxWickets = battingOrder.length - 1;

      const innings = {
        battingTeamId,
        bowlingTeamId,
        totalRuns: 0,
        totalWickets: 0,
        totalBalls: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        balls: [],
        battingScorecard: [],
        bowlingScorecard: [],
        fallOfWickets: [],
        partnerships: []
      };

      // Init batting scorecard for all players
      const batSC = {};
      battingOrder.forEach(p => {
        batSC[p.id] = {
          playerId: p.id, runs: 0, balls: 0, fours: 0, sixes: 0,
          dotBalls: 0, howOut: '', bowlerId: '', fielderId: ''
        };
      });

      // Init bowling scorecard
      const bowlSC = {};
      bowlerPool.forEach(p => {
        bowlSC[p.id] = {
          playerId: p.id, overs: 0, balls: 0, maidens: 0, runs: 0,
          wickets: 0, wides: 0, noBalls: 0, dotBalls: 0
        };
      });

      let strikerIdx = 0;
      let nonStrikerIdx = 1;
      let currentBowlerIdx = 0;
      let overRuns = 0;
      let overBallCount = 0;

      for (let ballNum = 0; ballNum < totalBallsPerInnings; ballNum++) {
        if (innings.totalWickets >= maxWickets) break;
        if (targetScore !== null && innings.totalRuns > targetScore) break;

        const over = Math.floor(ballNum / bpo);
        const ball = (ballNum % bpo) + 1;

        // Rotate bowler each over
        if (ball === 1 && ballNum > 0) {
          // Check for maiden
          if (overRuns === 0 && overBallCount > 0) {
            const prevBowlerId = bowlerPool[(currentBowlerIdx) % bowlerPool.length].id;
            if (bowlSC[prevBowlerId]) bowlSC[prevBowlerId].maidens++;
          }
          overRuns = 0;
          overBallCount = 0;
          currentBowlerIdx = (currentBowlerIdx + 1) % bowlerPool.length;
          // Swap striker/non-striker at end of over
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }

        const striker = battingOrder[strikerIdx];
        const bowler = bowlerPool[currentBowlerIdx];
        const fielders = bowlingPlayers.filter(p => p.id !== bowler.id);

        let runs = 0;
        let extraType = null;
        let extraRuns = 0;
        let wicket = null;

        // Determine outcome
        const rand = Math.random();

        if (rand < 0.02) {
          // Wide
          extraType = 'wide';
          extraRuns = 1;
          innings.extras.wides++;
          if (bowlSC[bowler.id]) { bowlSC[bowler.id].wides++; bowlSC[bowler.id].runs++; }
          innings.totalRuns += 1;
          overRuns += 1;
          innings.balls.push({
            over, ball, batsmanId: striker.id, bowlerId: bowler.id,
            runs: 0, extras: { type: 'wide', runs: 1 }, wicket: null, shotRegion: 0
          });
          // Wide doesn't count as a ball faced — adjust loop
          ballNum--;
          continue;
        } else if (rand < 0.035) {
          // No Ball
          extraType = 'no-ball';
          extraRuns = 1;
          innings.extras.noBalls++;
          runs = choice([0, 0, 1, 1, 2, 4, 6]);
          if (bowlSC[bowler.id]) { bowlSC[bowler.id].noBalls++; bowlSC[bowler.id].runs += 1 + runs; }
          if (batSC[striker.id]) {
            batSC[striker.id].balls++;
            batSC[striker.id].runs += runs;
            if (runs === 4) batSC[striker.id].fours++;
            if (runs === 6) batSC[striker.id].sixes++;
          }
          innings.totalRuns += 1 + runs;
          overRuns += 1 + runs;
          innings.balls.push({
            over, ball, batsmanId: striker.id, bowlerId: bowler.id,
            runs: runs, extras: { type: 'no-ball', runs: 1 }, wicket: null, shotRegion: randInt(1, 8)
          });
          ballNum--;
          continue;
        } else if (rand < 0.15 && innings.totalWickets < maxWickets - 1) {
          // Wicket
          const wicketTypes = ['bowled', 'caught', 'caught', 'caught', 'lbw', 'run-out', 'stumped'];
          const wType = choice(wicketTypes);
          let fielderId = null;
          if (wType === 'caught' || wType === 'run-out' || wType === 'stumped') {
            fielderId = choice(fielders).id;
          }
          wicket = { type: wType, playerId: striker.id, fielderId: fielderId };
          runs = 0;

          if (batSC[striker.id]) {
            batSC[striker.id].balls++;
            batSC[striker.id].dotBalls++;
            batSC[striker.id].howOut = wType;
            batSC[striker.id].bowlerId = bowler.id;
            batSC[striker.id].fielderId = fielderId || '';
          }
          if (bowlSC[bowler.id]) {
            bowlSC[bowler.id].balls++;
            if (wType !== 'run-out') bowlSC[bowler.id].wickets++;
            bowlSC[bowler.id].dotBalls++;
          }

          innings.totalWickets++;
          innings.totalBalls++;
          overBallCount++;

          innings.fallOfWickets.push({
            wicketNumber: innings.totalWickets,
            runs: innings.totalRuns,
            overs: `${over}.${ball}`,
            playerId: striker.id
          });

          innings.balls.push({
            over, ball, batsmanId: striker.id, bowlerId: bowler.id,
            runs: 0, extras: null, wicket: wicket, shotRegion: randInt(1, 8)
          });

          // Next batsman comes in
          strikerIdx = innings.totalWickets + 1;
          if (strikerIdx >= battingOrder.length) break;
          continue;
        }

        // Normal delivery — runs
        const runProbs = Math.random();
        if (runProbs < 0.35) runs = 0;
        else if (runProbs < 0.60) runs = 1;
        else if (runProbs < 0.75) runs = 2;
        else if (runProbs < 0.80) runs = 3;
        else if (runProbs < 0.92) runs = 4;
        else runs = 6;

        if (batSC[striker.id]) {
          batSC[striker.id].balls++;
          batSC[striker.id].runs += runs;
          if (runs === 0) batSC[striker.id].dotBalls++;
          if (runs === 4) batSC[striker.id].fours++;
          if (runs === 6) batSC[striker.id].sixes++;
        }
        if (bowlSC[bowler.id]) {
          bowlSC[bowler.id].balls++;
          bowlSC[bowler.id].runs += runs;
          if (runs === 0) bowlSC[bowler.id].dotBalls++;
        }

        innings.totalRuns += runs;
        innings.totalBalls++;
        overRuns += runs;
        overBallCount++;

        innings.balls.push({
          over, ball, batsmanId: striker.id, bowlerId: bowler.id,
          runs: runs, extras: null, wicket: null, shotRegion: randInt(1, 8)
        });

        // Rotate strike on odd runs
        if (runs % 2 === 1) {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }
      }

      // Final over maiden check
      if (overRuns === 0 && overBallCount > 0) {
        const lastBowlerId = bowlerPool[currentBowlerIdx % bowlerPool.length].id;
        if (bowlSC[lastBowlerId]) bowlSC[lastBowlerId].maidens++;
      }

      // Build scorecards
      innings.battingScorecard = battingOrder.map(p => {
        const sc = batSC[p.id];
        if (!sc.howOut && sc.balls > 0) sc.howOut = 'not out';
        if (sc.balls === 0 && innings.totalWickets < maxWickets) sc.howOut = 'did not bat';
        return sc;
      });

      innings.bowlingScorecard = bowlerPool.map(p => {
        const sc = bowlSC[p.id];
        sc.overs = Math.floor(sc.balls / bpo);
        return sc;
      }).filter(sc => sc.balls > 0);

      // Build partnerships (simplified)
      innings.partnerships = [];
      let partnershipRuns = 0;
      let partnershipBalls = 0;
      let bat1Idx = 0;
      let bat2Idx = 1;
      let fowIdx = 0;
      innings.balls.forEach(b => {
        partnershipRuns += b.runs + (b.extras ? b.extras.runs : 0);
        partnershipBalls++;
        if (b.wicket) {
          innings.partnerships.push({
            bat1Id: battingOrder[bat1Idx] ? battingOrder[bat1Idx].id : null,
            bat2Id: battingOrder[bat2Idx] ? battingOrder[bat2Idx].id : null,
            runs: partnershipRuns,
            balls: partnershipBalls
          });
          partnershipRuns = 0;
          partnershipBalls = 0;
          fowIdx++;
          if (battingOrder[bat1Idx] && b.wicket.playerId === battingOrder[bat1Idx].id) {
            bat1Idx = fowIdx + 1;
          } else {
            bat2Idx = fowIdx + 1;
          }
        }
      });
      // Final partnership
      if (partnershipBalls > 0) {
        innings.partnerships.push({
          bat1Id: battingOrder[bat1Idx] ? battingOrder[bat1Idx].id : null,
          bat2Id: battingOrder[bat2Idx] ? battingOrder[bat2Idx].id : null,
          runs: partnershipRuns,
          balls: partnershipBalls
        });
      }

      return innings;
    }

    // Generate completed matches
    const matches = [];
    const matchPairs = [
      [0, 1], [2, 3], [4, 5], [0, 2], [1, 3],
      [0, 4], [2, 5], [1, 4], [3, 5], [0, 3]
    ];

    const baseDate = new Date('2026-05-05');
    matchPairs.forEach((pair, mi) => {
      const t1 = teams[pair[0]];
      const t2 = teams[pair[1]];
      const matchDate = new Date(baseDate);
      matchDate.setDate(matchDate.getDate() + mi);

      const tossWinner = Math.random() < 0.5 ? t1.id : t2.id;
      const tossDecision = Math.random() < 0.5 ? 'bat' : 'bowl';
      const battingFirst = tossDecision === 'bat' ? tossWinner : (tossWinner === t1.id ? t2.id : t1.id);
      const bowlingFirst = battingFirst === t1.id ? t2.id : t1.id;

      // Simulate first innings
      const inn1 = simulateInnings(battingFirst, bowlingFirst, null);

      // Simulate second innings (chasing)
      const inn2 = simulateInnings(bowlingFirst, battingFirst, inn1.totalRuns);

      // Determine result
      let result = '';
      let status = 'completed';
      if (inn2.totalRuns > inn1.totalRuns) {
        const wicketsRemaining = (getTeamPlayers(bowlingFirst).length - 1) - inn2.totalWickets;
        const winTeam = teams.find(t => t.id === bowlingFirst);
        result = `${winTeam.name} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
      } else if (inn2.totalRuns < inn1.totalRuns) {
        const runDiff = inn1.totalRuns - inn2.totalRuns;
        const winTeam = teams.find(t => t.id === battingFirst);
        result = `${winTeam.name} won by ${runDiff} run${runDiff !== 1 ? 's' : ''}`;
      } else {
        result = 'Match Tied';
        status = 'tied';
      }

      // Pick MOM — highest scorer or best bowler
      const allScorecards = [...inn1.battingScorecard, ...inn2.battingScorecard];
      const topBat = allScorecards.reduce((best, sc) => sc.runs > (best ? best.runs : -1) ? sc : best, null);
      const allBowling = [...inn1.bowlingScorecard, ...inn2.bowlingScorecard];
      const topBowl = allBowling.reduce((best, sc) => sc.wickets > (best ? best.wickets : -1) ? sc : best, null);

      let mom = topBat ? topBat.playerId : null;
      if (topBowl && topBowl.wickets >= 3) mom = topBowl.playerId;

      matches.push({
        id: id('m'),
        team1Id: t1.id,
        team2Id: t2.id,
        date: matchDate.toISOString().split('T')[0],
        venue: mi % 2 === 0 ? venueA.name : venueB.name,
        overs: oversPerMatch,
        status: status,
        tossWonBy: tossWinner,
        tossDecision: tossDecision,
        result: result,
        manOfMatch: mom,
        commentary: [],
        innings: [inn1, inn2]
      });
    });

    // Generate upcoming matches
    const upcomingPairs = [[1, 5], [2, 4], [0, 5], [3, 4], [1, 2]];
    const futureBase = new Date('2026-05-22');
    upcomingPairs.forEach((pair, ui) => {
      const t1 = teams[pair[0]];
      const t2 = teams[pair[1]];
      const matchDate = new Date(futureBase);
      matchDate.setDate(matchDate.getDate() + ui * 2);

      matches.push({
        id: id('m'),
        team1Id: t1.id,
        team2Id: t2.id,
        date: matchDate.toISOString().split('T')[0],
        venue: ui % 2 === 0 ? venueA.name : venueB.name,
        overs: oversPerMatch,
        status: 'upcoming',
        tossWonBy: null,
        tossDecision: null,
        result: '',
        manOfMatch: null,
        commentary: [],
        innings: []
      });
    });

    // Hall of Fame — auto-detect top performers
    const completedMatches = matches.filter(m => m.status === 'completed' || m.status === 'tied');

    // Aggregate stats
    const playerStats = {};
    players.forEach(p => {
      playerStats[p.id] = { runs: 0, wickets: 0, catches: 0, momCount: 0 };
    });

    completedMatches.forEach(m => {
      if (m.manOfMatch && playerStats[m.manOfMatch]) {
        playerStats[m.manOfMatch].momCount++;
      }
      m.innings.forEach(inn => {
        inn.battingScorecard.forEach(sc => {
          if (playerStats[sc.playerId]) playerStats[sc.playerId].runs += sc.runs;
        });
        inn.bowlingScorecard.forEach(sc => {
          if (playerStats[sc.playerId]) playerStats[sc.playerId].wickets += sc.wickets;
        });
        // Count catches from wickets
        inn.balls.forEach(b => {
          if (b.wicket && b.wicket.type === 'caught' && b.wicket.fielderId) {
            if (playerStats[b.wicket.fielderId]) playerStats[b.wicket.fielderId].catches++;
          }
        });
      });
    });

    // Find top run scorer
    let topRunScorer = null;
    let maxRuns = 0;
    Object.entries(playerStats).forEach(([pid, stats]) => {
      if (stats.runs > maxRuns) { maxRuns = stats.runs; topRunScorer = pid; }
    });

    // Find top wicket taker
    let topWicketTaker = null;
    let maxWickets = 0;
    Object.entries(playerStats).forEach(([pid, stats]) => {
      if (stats.wickets > maxWickets) { maxWickets = stats.wickets; topWicketTaker = pid; }
    });

    // Find most MOM awards
    let mostMom = null;
    let maxMom = 0;
    Object.entries(playerStats).forEach(([pid, stats]) => {
      if (stats.momCount > maxMom) { maxMom = stats.momCount; mostMom = pid; }
    });

    const hallOfFame = {
      manOfTournament: null,
      awards: [
        { id: id('a'), type: 'Most Runs', playerId: topRunScorer, matchId: null, value: maxRuns, description: `Scored ${maxRuns} runs in the tournament` },
        { id: id('a'), type: 'Most Wickets', playerId: topWicketTaker, matchId: null, value: maxWickets, description: `Took ${maxWickets} wickets in the tournament` },
      ]
    };
    if (mostMom && maxMom > 1) {
      hallOfFame.awards.push({
        id: id('a'), type: 'Most MOM Awards', playerId: mostMom, matchId: null, value: maxMom, description: `Won ${maxMom} Man of the Match awards`
      });
    }

    // Build final data
    const data = {
      tournament: {
        name: 'Office Premier League 2026',
        startDate: '2026-05-05',
        endDate: '2026-06-15',
        format: 'round-robin',
        oversPerMatch: oversPerMatch,
        ballsPerOver: bpo,
        playersPerTeam: 8,
        lastManStands: false,
        widesEnabled: true,
        noBallsEnabled: true,
        bonusRunsEnabled: false,
        pointsSystem: { win: 2, loss: 0, tie: 1, nr: 1, bonus: 1 },
        mvpWeights: { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 }
      },
      venues: [venueA, venueB],
      teams: teams,
      players: players,
      matches: matches,
      hallOfFame: hallOfFame,
      pastScores: []
    };

    this._data = data;
    this.save();
    return data;
  }
};
