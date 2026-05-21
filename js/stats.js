/* ==========================================================================
   CrickDesk – Stats Module (js/stats.js)
   Renders into #page-stats
   ========================================================================== */

window.Stats = (() => {
  // ── State ──────────────────────────────────────────────────────────────
  let activeTab = 'batting';
  let battingSortKey = 'runs';
  let battingSortDir = 'desc';
  let bowlingSortKey = 'wickets';
  let bowlingSortDir = 'desc';
  let allRounderSortKey = 'mvpPoints';
  let allRounderSortDir = 'desc';
  let minMatchFilter = 1;
  let h2hTeam1 = '';
  let h2hTeam2 = '';
  let h2hBatsman = '';
  let h2hBowler = '';

  // ── Helpers ────────────────────────────────────────────────────────────
  const Data = () => window.CrickDeskData;
  const Utils = () => window.CrickDeskUtils;

  function completedMatches() {
    return Data().getMatches().filter(m => m.status === 'completed');
  }

  // ── Batting Stats Computation ──────────────────────────────────────────
  function computeBattingStats() {
    const matches = completedMatches();
    const players = Data().getPlayers();
    const map = {};

    players.forEach(p => {
      map[p.id] = {
        playerId: p.id,
        name: p.name,
        teamId: p.teamId,
        matches: 0,
        innings: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dotBalls: 0,
        highScore: 0,
        hsNotOut: false,
        fifties: 0,
        hundreds: 0,
        notOuts: 0,
        matchSet: new Set()
      };
    });

    matches.forEach(match => {
      if (!match.innings) return;
      match.innings.forEach(inn => {
        if (!inn.battingScorecard) return;
        inn.battingScorecard.forEach(entry => {
          const s = map[entry.playerId];
          if (!s) return;
          if (!s.matchSet.has(match.id)) {
            s.matchSet.add(match.id);
            s.matches++;
          }
          if (entry.balls > 0 || entry.runs > 0 || entry.howOut) {
            s.innings++;
          }
          s.runs += entry.runs || 0;
          s.balls += entry.balls || 0;
          s.fours += entry.fours || 0;
          s.sixes += entry.sixes || 0;
          s.dotBalls += entry.dotBalls || 0;

          const isNotOut = !entry.howOut || entry.howOut === 'not out' || entry.howOut === 'Not Out' || entry.howOut === 'retired';
          if (isNotOut) s.notOuts++;

          const score = entry.runs || 0;
          if (score > s.highScore) {
            s.highScore = score;
            s.hsNotOut = isNotOut;
          } else if (score === s.highScore && isNotOut) {
            s.hsNotOut = true;
          }

          if (score >= 100) s.hundreds++;
          else if (score >= 50) s.fifties++;
        });
      });
    });

    return Object.values(map).filter(s => s.matches >= minMatchFilter && s.innings > 0);
  }

  // ── Bowling Stats Computation ──────────────────────────────────────────
  function computeBowlingStats() {
    const matches = completedMatches();
    const players = Data().getPlayers();
    const map = {};

    players.forEach(p => {
      map[p.id] = {
        playerId: p.id,
        name: p.name,
        teamId: p.teamId,
        matches: 0,
        totalBalls: 0,
        wickets: 0,
        runs: 0,
        maidens: 0,
        dotBalls: 0,
        wides: 0,
        noBalls: 0,
        bestWickets: 0,
        bestRuns: 9999,
        matchSet: new Set()
      };
    });

    matches.forEach(match => {
      if (!match.innings) return;
      const bpo = (match.overs && match.innings[0]) ? (Data().getTournament().ballsPerOver || 6) : 6;
      match.innings.forEach(inn => {
        if (!inn.bowlingScorecard) return;
        inn.bowlingScorecard.forEach(entry => {
          const s = map[entry.playerId];
          if (!s) return;
          if (!s.matchSet.has(match.id)) {
            s.matchSet.add(match.id);
            s.matches++;
          }
          const entryBalls = (entry.overs ? Math.floor(entry.overs) * bpo + Math.round((entry.overs % 1) * 10) : entry.balls || 0);
          s.totalBalls += entryBalls;
          s.wickets += entry.wickets || 0;
          s.runs += entry.runs || 0;
          s.maidens += entry.maidens || 0;
          s.dotBalls += entry.dotBalls || 0;
          s.wides += entry.wides || 0;
          s.noBalls += entry.noBalls || 0;

          const w = entry.wickets || 0;
          const r = entry.runs || 0;
          if (w > s.bestWickets || (w === s.bestWickets && r < s.bestRuns)) {
            s.bestWickets = w;
            s.bestRuns = r;
          }
        });
      });
    });

    return Object.values(map).filter(s => s.matches >= minMatchFilter && s.totalBalls > 0);
  }

  // ── All-rounder / MVP Stats ────────────────────────────────────────────
  function computeAllRounderStats() {
    const tournament = Data().getTournament();
    const weights = (tournament && tournament.mvpWeights) ? tournament.mvpWeights : { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 };
    const matches = completedMatches();
    const players = Data().getPlayers();
    const map = {};

    players.forEach(p => {
      map[p.id] = {
        playerId: p.id,
        name: p.name,
        teamId: p.teamId,
        runs: 0,
        wickets: 0,
        catches: 0,
        runOuts: 0,
        momAwards: 0,
        mvpPoints: 0
      };
    });

    matches.forEach(match => {
      if (match.manOfMatch && map[match.manOfMatch]) {
        map[match.manOfMatch].momAwards++;
      }
      if (!match.innings) return;
      match.innings.forEach(inn => {
        if (inn.battingScorecard) {
          inn.battingScorecard.forEach(entry => {
            if (map[entry.playerId]) {
              map[entry.playerId].runs += entry.runs || 0;
            }
          });
        }
        if (inn.bowlingScorecard) {
          inn.bowlingScorecard.forEach(entry => {
            if (map[entry.playerId]) {
              map[entry.playerId].wickets += entry.wickets || 0;
            }
          });
        }
        // Count catches and run outs from ball-by-ball data
        if (inn.balls) {
          inn.balls.forEach(ball => {
            if (ball.wicket) {
              if (ball.wicket.type === 'caught' && ball.wicket.fielderId && map[ball.wicket.fielderId]) {
                map[ball.wicket.fielderId].catches++;
              }
              if (ball.wicket.type === 'run out' && ball.wicket.fielderId && map[ball.wicket.fielderId]) {
                map[ball.wicket.fielderId].runOuts++;
              }
            }
          });
        }
      });
    });

    Object.values(map).forEach(s => {
      s.mvpPoints = Math.round(
        (s.runs * weights.runs) +
        (s.wickets * weights.wickets) +
        (s.catches * weights.catches) +
        (s.runOuts * weights.runOuts) +
        (s.momAwards * weights.momAward)
      );
    });

    return Object.values(map).filter(s => s.mvpPoints > 0);
  }

  // ── Records Computation ────────────────────────────────────────────────
  function computeRecords() {
    const matches = completedMatches();
    const records = {
      highestTeamScore: null,
      lowestTeamScore: null,
      highestIndividual: null,
      bestBowling: null,
      mostSixesInnings: null,
      mostDotsInnings: null
    };

    matches.forEach(match => {
      if (!match.innings) return;
      match.innings.forEach(inn => {
        const battingTeam = Data().getTeam(inn.battingTeamId);
        const bowlingTeam = Data().getTeam(inn.bowlingTeamId);
        const teamName = battingTeam ? battingTeam.name : 'Unknown';
        const oppName = bowlingTeam ? bowlingTeam.name : 'Unknown';
        const totalRuns = inn.totalRuns || 0;
        const totalWickets = inn.totalWickets || 0;
        const bpo = Data().getTournament().ballsPerOver || 6;
        const oversStr = Utils().formatOvers(inn.totalBalls || 0, bpo);

        // Highest team score
        if (!records.highestTeamScore || totalRuns > records.highestTeamScore.score) {
          records.highestTeamScore = { team: teamName, score: `${totalRuns}/${totalWickets}`, scoreVal: totalRuns, overs: oversStr, vs: oppName, date: match.date, matchId: match.id };
        }

        // Lowest team score (must have batted at least 1 ball)
        if ((inn.totalBalls || 0) > 0) {
          if (!records.lowestTeamScore || totalRuns < records.lowestTeamScore.scoreVal) {
            records.lowestTeamScore = { team: teamName, score: `${totalRuns}/${totalWickets}`, scoreVal: totalRuns, overs: oversStr, vs: oppName, date: match.date, matchId: match.id };
          }
        }

        // Highest individual score
        if (inn.battingScorecard) {
          inn.battingScorecard.forEach(entry => {
            const player = Data().getPlayer(entry.playerId);
            const pName = player ? player.name : 'Unknown';
            const runs = entry.runs || 0;
            if (!records.highestIndividual || runs > records.highestIndividual.runs) {
              records.highestIndividual = { player: pName, playerId: entry.playerId, runs, balls: entry.balls || 0, vs: oppName, date: match.date, matchId: match.id };
            }
          });

          // Most sixes in an innings
          inn.battingScorecard.forEach(entry => {
            const player = Data().getPlayer(entry.playerId);
            const pName = player ? player.name : 'Unknown';
            const sixes = entry.sixes || 0;
            if (sixes > 0 && (!records.mostSixesInnings || sixes > records.mostSixesInnings.count)) {
              records.mostSixesInnings = { player: pName, playerId: entry.playerId, count: sixes, vs: oppName, date: match.date, matchId: match.id };
            }
          });
        }

        // Best bowling
        if (inn.bowlingScorecard) {
          inn.bowlingScorecard.forEach(entry => {
            const player = Data().getPlayer(entry.playerId);
            const pName = player ? player.name : 'Unknown';
            const w = entry.wickets || 0;
            const r = entry.runs || 0;
            if (!records.bestBowling || w > records.bestBowling.wickets || (w === records.bestBowling.wickets && r < records.bestBowling.runs)) {
              const bowlingTeamForBowler = battingTeam; // bowler bowls against batting team
              records.bestBowling = { player: pName, playerId: entry.playerId, wickets: w, runs: r, figures: `${w}/${r}`, vs: teamName, date: match.date, matchId: match.id };
            }
          });

          // Most dot balls bowled in an innings
          inn.bowlingScorecard.forEach(entry => {
            const player = Data().getPlayer(entry.playerId);
            const pName = player ? player.name : 'Unknown';
            const dots = entry.dotBalls || 0;
            if (dots > 0 && (!records.mostDotsInnings || dots > records.mostDotsInnings.count)) {
              records.mostDotsInnings = { player: pName, playerId: entry.playerId, count: dots, vs: oppName, date: match.date, matchId: match.id };
            }
          });
        }
      });
    });

    return records;
  }

  // ── Head-to-Head Computation ───────────────────────────────────────────
  function computeH2H(t1Id, t2Id) {
    const matches = completedMatches().filter(m =>
      (m.team1Id === t1Id && m.team2Id === t2Id) || (m.team1Id === t2Id && m.team2Id === t1Id)
    );

    let team1Wins = 0, team2Wins = 0, draws = 0;
    const matchHistory = [];

    matches.forEach(m => {
      const result = m.result || '';
      const t1 = Data().getTeam(t1Id);
      const t2 = Data().getTeam(t2Id);

      let t1Score = '--', t2Score = '--';
      if (m.innings) {
        m.innings.forEach(inn => {
          const bpo = Data().getTournament().ballsPerOver || 6;
          const scoreStr = `${inn.totalRuns || 0}/${inn.totalWickets || 0} (${Utils().formatOvers(inn.totalBalls || 0, bpo)})`;
          if (inn.battingTeamId === t1Id) t1Score = scoreStr;
          if (inn.battingTeamId === t2Id) t2Score = scoreStr;
        });
      }

      if (result.toLowerCase().includes('tied') || result.toLowerCase().includes('tie') || m.status === 'tied') {
        draws++;
      } else if (result.includes(t1 ? t1.name : '___NOMATCH___')) {
        team1Wins++;
      } else if (result.includes(t2 ? t2.name : '___NOMATCH___')) {
        team2Wins++;
      } else {
        // Try to figure out from result field
        draws++;
      }

      matchHistory.push({ matchId: m.id, date: m.date, t1Score, t2Score, result, venue: m.venue });
    });

    return { team1Wins, team2Wins, draws, matches: matchHistory, totalMatches: matches.length, rawMatches: matches };
  }

  function computeBatsmanVsBowler(batsmanId, bowlerId) {
    const matches = completedMatches();
    let balls = 0, runs = 0, dismissals = 0;

    matches.forEach(match => {
      if (!match.innings) return;
      match.innings.forEach(inn => {
        if (!inn.balls) return;
        inn.balls.forEach(ball => {
          if (ball.batsmanId === batsmanId && ball.bowlerId === bowlerId) {
            balls++;
            runs += ball.runs || 0;
            if (ball.wicket && ball.wicket.playerId === batsmanId) {
              dismissals++;
            }
          }
        });
      });
    });

    return { balls, runs, dismissals, sr: balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0' };
  }

  // ── Sort Helper ────────────────────────────────────────────────────────
  function sortData(data, key, dir) {
    return [...data].sort((a, b) => {
      let va = a[key] ?? 0;
      let vb = b[key] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (dir === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
      return va < vb ? 1 : va > vb ? -1 : 0;
    });
  }

  // ── Rank Badge ─────────────────────────────────────────────────────────
  function rankBadge(i) {
    if (i === 0) return '<span class="badge" style="background:linear-gradient(135deg,#ffd700,#b8860b);color:#000;font-weight:700;">🥇 1</span>';
    if (i === 1) return '<span class="badge" style="background:linear-gradient(135deg,#c0c0c0,#808080);color:#000;font-weight:700;">🥈 2</span>';
    if (i === 2) return '<span class="badge" style="background:linear-gradient(135deg,#cd7f32,#8b4513);color:#fff;font-weight:700;">🥉 3</span>';
    return `<span style="color:var(--text-secondary);font-weight:500;">${i + 1}</span>`;
  }

  function getTeamShort(teamId) {
    const t = Data().getTeam(teamId);
    return t ? t.shortName || t.name : '—';
  }

  function playerAvatar(name, teamId) {
    const initials = Utils().getPlayerInitials(name);
    const color = Utils().getTeamColor(teamId);
    return `<div class="avatar avatar-sm" style="background:${color};color:#fff;font-weight:600;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;font-size:12px;flex-shrink:0;">${initials}</div>`;
  }

  // ── Canvas: Horizontal Bar Chart ──────────────────────────────────────
  function drawHorizontalBarChart(canvasId, labels, values, color1, color2, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth || 700;
    const h = Math.max(300, labels.length * 40 + 80);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = 'rgba(17,24,39,0.5)';
    ctx.beginPath();
    roundRect(ctx, 0, 0, w, h, 12);
    ctx.fill();

    // Title
    ctx.fillStyle = '#f9fafb';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 20, 30);

    if (labels.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '400 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', w / 2, h / 2);
      return;
    }

    const maxVal = Math.max(...values, 1);
    const barHeight = 24;
    const gap = 12;
    const startY = 50;
    const labelW = 120;
    const barAreaW = w - labelW - 80;

    labels.forEach((label, i) => {
      const y = startY + i * (barHeight + gap);

      // Label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '400 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      const displayName = label.length > 14 ? label.substring(0, 14) + '…' : label;
      ctx.fillText(displayName, labelW - 10, y + barHeight / 2 + 4);

      // Bar
      const barW = Math.max(4, (values[i] / maxVal) * barAreaW);
      const grad = ctx.createLinearGradient(labelW, y, labelW + barW, y);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      roundRect(ctx, labelW, y, barW, barHeight, 6);
      ctx.fill();

      // Value
      ctx.fillStyle = '#f9fafb';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(values[i], labelW + barW + 8, y + barHeight / 2 + 4);
    });
  }

  // ── Canvas: Radar Chart ───────────────────────────────────────────────
  function drawRadarChart(canvasId, playersData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement.clientWidth || 500, 500);
    canvas.width = size * dpr;
    canvas.height = (size + 40) * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = (size + 40) + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'rgba(17,24,39,0.5)';
    ctx.beginPath();
    roundRect(ctx, 0, 0, size, size + 40, 12);
    ctx.fill();

    if (playersData.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '400 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', size / 2, size / 2);
      return;
    }

    const categories = ['Batting', 'Bowling', 'Fielding', 'Consistency', 'Impact'];
    const cx = size / 2;
    const cy = size / 2 - 10;
    const radius = size * 0.32;
    const angleStep = (Math.PI * 2) / categories.length;
    const levels = 5;

    // Grid
    for (let l = 1; l <= levels; l++) {
      const r = (radius / levels) * l;
      ctx.beginPath();
      for (let i = 0; i <= categories.length; i++) {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axes & labels
    categories.forEach((cat, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();

      const lx = cx + (radius + 18) * Math.cos(angle);
      const ly = cy + (radius + 18) * Math.sin(angle);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '500 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cat, lx, ly);
    });

    // Data
    const colors = ['rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(139,92,246,0.7)'];
    const fills = ['rgba(16,185,129,0.15)', 'rgba(245,158,11,0.15)', 'rgba(139,92,246,0.15)'];

    playersData.forEach((pd, pi) => {
      ctx.beginPath();
      pd.values.forEach((v, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = (v / 100) * radius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fills[pi] || fills[0];
      ctx.fill();
      ctx.strokeStyle = colors[pi] || colors[0];
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dots
      pd.values.forEach((v, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = (v / 100) * radius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = colors[pi] || colors[0];
        ctx.fill();
      });
    });

    // Legend
    const legendY = size + 10;
    let legendX = 20;
    playersData.forEach((pd, pi) => {
      ctx.fillStyle = colors[pi] || colors[0];
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f9fafb';
      ctx.font = '400 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(pd.name, legendX + 14, legendY + 4);
      legendX += ctx.measureText(pd.name).width + 30;
    });
  }

  // ── Canvas: H2H Bar Chart ────────────────────────────────────────────
  function drawH2HChart(canvasId, matchLabels, t1Runs, t2Runs, t1Name, t2Name, t1Color, t2Color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth || 700;
    const h = 300;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'rgba(17,24,39,0.5)';
    ctx.beginPath();
    roundRect(ctx, 0, 0, w, h, 12);
    ctx.fill();

    if (matchLabels.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '400 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No matches played', w / 2, h / 2);
      return;
    }

    const maxVal = Math.max(...t1Runs, ...t2Runs, 1);
    const padding = { top: 40, right: 30, bottom: 50, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const groupW = chartW / matchLabels.length;
    const barW = Math.min(groupW * 0.35, 30);

    // Title
    ctx.fillStyle = '#f9fafb';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Runs Scored Per Match', 20, 25);

    // Y-axis
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const v = Math.round((maxVal / ySteps) * i);
      const y = padding.top + chartH - (i / ySteps) * chartH;
      ctx.fillStyle = '#6b7280';
      ctx.font = '400 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v, padding.left - 8, y + 3);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.stroke();
    }

    matchLabels.forEach((lbl, i) => {
      const gx = padding.left + i * groupW + groupW / 2;

      // Team 1 bar
      const h1 = (t1Runs[i] / maxVal) * chartH;
      ctx.fillStyle = t1Color;
      ctx.beginPath();
      roundRect(ctx, gx - barW - 2, padding.top + chartH - h1, barW, h1, 4);
      ctx.fill();

      // Team 2 bar
      const h2 = (t2Runs[i] / maxVal) * chartH;
      ctx.fillStyle = t2Color;
      ctx.beginPath();
      roundRect(ctx, gx + 2, padding.top + chartH - h2, barW, h2, 4);
      ctx.fill();

      // Match label
      ctx.fillStyle = '#6b7280';
      ctx.font = '400 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, gx, h - padding.bottom + 16);
    });

    // Legend
    const ly = h - 12;
    ctx.fillStyle = t1Color;
    ctx.fillRect(w / 2 - 100, ly - 6, 12, 12);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t1Name, w / 2 - 84, ly + 4);
    ctx.fillStyle = t2Color;
    ctx.fillRect(w / 2 + 20, ly - 6, 12, 12);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(t2Name, w / 2 + 36, ly + 4);
  }

  // ── Canvas Utility ────────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) w = 0;
    if (h < 0) h = 0;
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ── Sort Indicator ────────────────────────────────────────────────────
  function sortArrow(key, currentKey, currentDir) {
    if (key !== currentKey) return '<span style="opacity:0.3;font-size:10px;">⇅</span>';
    return currentDir === 'desc' ? '<span style="color:var(--accent-green);font-size:10px;">▼</span>' : '<span style="color:var(--accent-green);font-size:10px;">▲</span>';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  RENDER FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

  function renderBattingTab() {
    let stats = computeBattingStats();
    stats = sortData(stats, battingSortKey, battingSortDir);
    const bpo = Data().getTournament().ballsPerOver || 6;

    const rows = stats.map((s, i) => {
      const avg = Utils().calculateAverage(s.runs, s.innings - s.notOuts);
      const sr = Utils().calculateStrikeRate(s.runs, s.balls);
      const hs = s.highScore + (s.hsNotOut ? '*' : '');
      return `<tr class="${i < 3 ? 'top-rank' : ''}">
        <td>${rankBadge(i)}</td>
        <td><div style="display:flex;align-items:center;gap:8px;">${playerAvatar(s.name, s.teamId)}<span>${s.name}</span></div></td>
        <td>${getTeamShort(s.teamId)}</td>
        <td>${s.matches}</td>
        <td>${s.innings}</td>
        <td><strong style="color:var(--text-primary);">${s.runs}</strong></td>
        <td>${avg}</td>
        <td>${sr}</td>
        <td>${hs}</td>
        <td>${s.fifties}</td>
        <td>${s.hundreds}</td>
        <td>${s.fours}</td>
        <td>${s.sixes}</td>
        <td>${s.dotBalls}</td>
      </tr>`;
    }).join('');

    return `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <span style="color:var(--text-secondary);font-size:13px;line-height:32px;">Min Matches:</span>
        <button class="chip ${minMatchFilter === 1 ? 'active' : ''}" data-min="1" id="stats-bat-min-1">1+</button>
        <button class="chip ${minMatchFilter === 3 ? 'active' : ''}" data-min="3" id="stats-bat-min-3">3+</button>
        <button class="chip ${minMatchFilter === 5 ? 'active' : ''}" data-min="5" id="stats-bat-min-5">5+</button>
      </div>
      <div class="data-table-responsive">
        <table class="data-table" id="stats-batting-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th class="sortable-col" data-sort="matches">Mat ${sortArrow('matches', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="innings">Inn ${sortArrow('innings', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="runs">Runs ${sortArrow('runs', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="avg">Avg ${sortArrow('avg', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="sr">SR ${sortArrow('sr', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="highScore">HS ${sortArrow('highScore', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="fifties">50s ${sortArrow('fifties', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="hundreds">100s ${sortArrow('hundreds', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="fours">4s ${sortArrow('fours', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="sixes">6s ${sortArrow('sixes', battingSortKey, battingSortDir)}</th>
              <th class="sortable-col" data-sort="dotBalls">Dots ${sortArrow('dotBalls', battingSortKey, battingSortDir)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="14" class="empty-state" style="padding:40px;text-align:center;"><div>🏏</div><div style="margin-top:8px;color:var(--text-muted);">No batting stats yet. Complete some matches first!</div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="margin-top:24px;">
        <canvas id="stats-batting-chart" style="width:100%;"></canvas>
      </div>
    `;
  }

  function renderBowlingTab() {
    let stats = computeBowlingStats();
    stats = sortData(stats, bowlingSortKey, bowlingSortDir);
    const bpo = Data().getTournament().ballsPerOver || 6;

    const rows = stats.map((s, i) => {
      const overs = Utils().formatOvers(s.totalBalls, bpo);
      const avg = s.wickets > 0 ? (s.runs / s.wickets).toFixed(2) : '—';
      const econ = Utils().calculateEconomy(s.runs, s.totalBalls, bpo);
      const bbi = s.bestWickets > 0 ? `${s.bestWickets}/${s.bestRuns === 9999 ? 0 : s.bestRuns}` : '—';
      return `<tr class="${i < 3 ? 'top-rank' : ''}">
        <td>${rankBadge(i)}</td>
        <td><div style="display:flex;align-items:center;gap:8px;">${playerAvatar(s.name, s.teamId)}<span>${s.name}</span></div></td>
        <td>${getTeamShort(s.teamId)}</td>
        <td>${s.matches}</td>
        <td>${overs}</td>
        <td><strong style="color:var(--text-primary);">${s.wickets}</strong></td>
        <td>${s.runs}</td>
        <td>${avg}</td>
        <td>${econ}</td>
        <td>${bbi}</td>
        <td>${s.maidens}</td>
        <td>${s.dotBalls}</td>
        <td>${s.wides}</td>
        <td>${s.noBalls}</td>
      </tr>`;
    }).join('');

    return `
      <div class="data-table-responsive">
        <table class="data-table" id="stats-bowling-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th class="sortable-col" data-sort="matches">Mat ${sortArrow('matches', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="totalBalls">Overs ${sortArrow('totalBalls', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="wickets">Wkts ${sortArrow('wickets', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="runs">Runs ${sortArrow('runs', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="avg">Avg</th>
              <th class="sortable-col" data-sort="econ">Econ</th>
              <th>BBI</th>
              <th class="sortable-col" data-sort="maidens">Mdn ${sortArrow('maidens', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="dotBalls">Dots ${sortArrow('dotBalls', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="wides">Wd ${sortArrow('wides', bowlingSortKey, bowlingSortDir)}</th>
              <th class="sortable-col" data-sort="noBalls">NB ${sortArrow('noBalls', bowlingSortKey, bowlingSortDir)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="14" class="empty-state" style="padding:40px;text-align:center;"><div>🎯</div><div style="margin-top:8px;color:var(--text-muted);">No bowling stats yet. Complete some matches first!</div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="margin-top:24px;">
        <canvas id="stats-bowling-chart" style="width:100%;"></canvas>
      </div>
    `;
  }

  function renderAllRoundersTab() {
    let stats = computeAllRounderStats();
    stats = sortData(stats, allRounderSortKey, allRounderSortDir);

    const rows = stats.map((s, i) => {
      return `<tr class="${i < 3 ? 'top-rank' : ''}">
        <td>${rankBadge(i)}</td>
        <td><div style="display:flex;align-items:center;gap:8px;">${playerAvatar(s.name, s.teamId)}<span>${s.name}</span></div></td>
        <td>${getTeamShort(s.teamId)}</td>
        <td>${s.runs}</td>
        <td>${s.wickets}</td>
        <td>${s.catches}</td>
        <td>${s.runOuts}</td>
        <td>${s.momAwards}</td>
        <td><strong style="color:var(--accent-amber);font-weight:700;">${s.mvpPoints}</strong></td>
      </tr>`;
    }).join('');

    // Compute radar data for top 3
    const top3 = stats.slice(0, 3);
    const maxRuns = Math.max(...stats.map(s => s.runs), 1);
    const maxWickets = Math.max(...stats.map(s => s.wickets), 1);
    const maxFielding = Math.max(...stats.map(s => s.catches + s.runOuts), 1);
    const maxMom = Math.max(...stats.map(s => s.momAwards), 1);
    const maxMvp = Math.max(...stats.map(s => s.mvpPoints), 1);

    const radarData = top3.map(s => ({
      name: s.name,
      values: [
        Math.round((s.runs / maxRuns) * 100),
        Math.round((s.wickets / maxWickets) * 100),
        Math.round(((s.catches + s.runOuts) / maxFielding) * 100),
        Math.round((s.momAwards / maxMom) * 100) || 10, // Consistency proxy
        Math.round((s.mvpPoints / maxMvp) * 100) // Impact
      ]
    }));

    // Store for canvas render
    window._statsRadarData = radarData;

    return `
      <div class="data-table-responsive">
        <table class="data-table" id="stats-allrounders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th class="sortable-col" data-sort="runs">Runs ${sortArrow('runs', allRounderSortKey, allRounderSortDir)}</th>
              <th class="sortable-col" data-sort="wickets">Wkts ${sortArrow('wickets', allRounderSortKey, allRounderSortDir)}</th>
              <th class="sortable-col" data-sort="catches">Catches ${sortArrow('catches', allRounderSortKey, allRounderSortDir)}</th>
              <th class="sortable-col" data-sort="runOuts">RunOuts ${sortArrow('runOuts', allRounderSortKey, allRounderSortDir)}</th>
              <th class="sortable-col" data-sort="momAwards">MoM ${sortArrow('momAwards', allRounderSortKey, allRounderSortDir)}</th>
              <th class="sortable-col" data-sort="mvpPoints">MVP Pts ${sortArrow('mvpPoints', allRounderSortKey, allRounderSortDir)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" class="empty-state" style="padding:40px;text-align:center;"><div>⭐</div><div style="margin-top:8px;color:var(--text-muted);">No all-rounder data yet.</div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="margin-top:24px;">
        <h3 class="section-title" style="margin-bottom:12px;">Top 3 MVP Radar</h3>
        <canvas id="stats-radar-chart" style="width:100%;max-width:500px;"></canvas>
      </div>
    `;
  }

  function renderRecordsTab() {
    const r = computeRecords();

    function recordCard(emoji, title, data, detailFn) {
      if (!data) {
        return `<div class="card glass" style="padding:24px;">
          <div style="font-size:28px;margin-bottom:8px;">${emoji}</div>
          <div class="section-title" style="margin-bottom:8px;">${title}</div>
          <div style="color:var(--text-muted);font-size:13px;">No data yet</div>
        </div>`;
      }
      return `<div class="card glass" style="padding:24px;">
        <div style="font-size:28px;margin-bottom:8px;">${emoji}</div>
        <div class="section-title" style="margin-bottom:12px;">${title}</div>
        ${detailFn(data)}
      </div>`;
    }

    return `
      <div class="bento-grid grid-3" style="gap:16px;">
        ${recordCard('🏟️', 'Highest Team Score', r.highestTeamScore, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-green);">${d.score}</div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.team} vs ${d.vs}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}

        ${recordCard('📉', 'Lowest Team Score', r.lowestTeamScore, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-red);">${d.score}</div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.team} vs ${d.vs}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}

        ${recordCard('🏏', 'Highest Individual Score', r.highestIndividual, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-amber);">${d.runs}<span style="font-size:16px;color:var(--text-muted);"> (${d.balls}b)</span></div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.player}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">vs ${d.vs} • ${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}

        ${recordCard('🎯', 'Best Bowling', r.bestBowling, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-purple);">${d.figures}</div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.player}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">vs ${d.vs} • ${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}

        ${recordCard('💥', 'Most Sixes in an Innings', r.mostSixesInnings, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-amber-light);">${d.count}</div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.player}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">vs ${d.vs} • ${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}

        ${recordCard('⏺️', 'Most Dot Balls Bowled', r.mostDotsInnings, d => `
          <div class="stat-value" style="font-size:32px;color:var(--accent-blue);">${d.count}</div>
          <div style="color:var(--text-secondary);margin-top:4px;">${d.player}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">vs ${d.vs} • ${d.date ? Utils().formatDate(d.date) : ''}</div>
        `)}
      </div>
    `;
  }

  function renderHeadToHeadTab() {
    const teams = Data().getTeams();
    const teamOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    let h2hContent = '';
    if (h2hTeam1 && h2hTeam2 && h2hTeam1 !== h2hTeam2) {
      const h2h = computeH2H(h2hTeam1, h2hTeam2);
      const t1 = Data().getTeam(h2hTeam1);
      const t2 = Data().getTeam(h2hTeam2);
      const t1Name = t1 ? t1.name : 'Team 1';
      const t2Name = t2 ? t2.name : 'Team 2';
      const t1Color = Utils().getTeamColor(h2hTeam1);
      const t2Color = Utils().getTeamColor(h2hTeam2);

      // Match history
      const historyRows = h2h.matches.map(m => `
        <tr>
          <td>${m.date ? Utils().formatDate(m.date) : '—'}</td>
          <td>${m.t1Score}</td>
          <td>${m.t2Score}</td>
          <td style="font-size:12px;color:var(--text-muted);">${m.result || '—'}</td>
        </tr>
      `).join('');

      // Build runs arrays for chart
      const matchLabels = h2h.matches.map((_, i) => `Match ${i + 1}`);
      const t1RunsArr = [];
      const t2RunsArr = [];
      h2h.rawMatches.forEach(m => {
        let r1 = 0, r2 = 0;
        if (m.innings) {
          m.innings.forEach(inn => {
            if (inn.battingTeamId === h2hTeam1) r1 = inn.totalRuns || 0;
            if (inn.battingTeamId === h2hTeam2) r2 = inn.totalRuns || 0;
          });
        }
        t1RunsArr.push(r1);
        t2RunsArr.push(r2);
      });

      window._h2hChartData = { matchLabels, t1RunsArr, t2RunsArr, t1Name, t2Name, t1Color, t2Color };

      // Batsman vs Bowler selectors
      const t1Players = Data().getPlayersByTeam(h2hTeam1);
      const t2Players = Data().getPlayersByTeam(h2hTeam2);
      const batOpts = t1Players.map(p => `<option value="${p.id}" ${p.id === h2hBatsman ? 'selected' : ''}>${p.name}</option>`).join('');
      const bowlOpts = t2Players.map(p => `<option value="${p.id}" ${p.id === h2hBowler ? 'selected' : ''}>${p.name}</option>`).join('');

      let bvbHtml = '';
      if (h2hBatsman && h2hBowler) {
        const bvb = computeBatsmanVsBowler(h2hBatsman, h2hBowler);
        const bat = Data().getPlayer(h2hBatsman);
        const bowl = Data().getPlayer(h2hBowler);
        bvbHtml = `
          <div class="bento-grid grid-4" style="margin-top:12px;">
            <div class="stat-card card glass" style="padding:16px;text-align:center;">
              <div class="stat-value" style="color:var(--accent-green);">${bvb.balls}</div>
              <div class="stat-label">Balls Faced</div>
            </div>
            <div class="stat-card card glass" style="padding:16px;text-align:center;">
              <div class="stat-value" style="color:var(--accent-amber);">${bvb.runs}</div>
              <div class="stat-label">Runs Scored</div>
            </div>
            <div class="stat-card card glass" style="padding:16px;text-align:center;">
              <div class="stat-value" style="color:var(--accent-red);">${bvb.dismissals}</div>
              <div class="stat-label">Dismissals</div>
            </div>
            <div class="stat-card card glass" style="padding:16px;text-align:center;">
              <div class="stat-value" style="color:var(--accent-blue);">${bvb.sr}</div>
              <div class="stat-label">Strike Rate</div>
            </div>
          </div>
        `;
      }

      h2hContent = `
        <div class="bento-grid grid-3" style="margin-top:20px;gap:16px;">
          <div class="stat-card card glass" style="padding:20px;text-align:center;border-top:3px solid ${t1Color};">
            <div class="stat-value" style="font-size:36px;color:${t1Color};">${h2h.team1Wins}</div>
            <div class="stat-label">${t1Name} Wins</div>
          </div>
          <div class="stat-card card glass" style="padding:20px;text-align:center;border-top:3px solid var(--text-muted);">
            <div class="stat-value" style="font-size:36px;color:var(--text-muted);">${h2h.draws}</div>
            <div class="stat-label">Draws / Ties</div>
          </div>
          <div class="stat-card card glass" style="padding:20px;text-align:center;border-top:3px solid ${t2Color};">
            <div class="stat-value" style="font-size:36px;color:${t2Color};">${h2h.team2Wins}</div>
            <div class="stat-label">${t2Name} Wins</div>
          </div>
        </div>

        <div class="card glass" style="padding:20px;margin-top:20px;">
          <h3 class="section-title" style="margin-bottom:12px;">Match History</h3>
          ${h2h.matches.length > 0 ? `
            <div class="data-table-responsive">
              <table class="data-table">
                <thead><tr><th>Date</th><th>${t1Name}</th><th>${t2Name}</th><th>Result</th></tr></thead>
                <tbody>${historyRows}</tbody>
              </table>
            </div>
          ` : '<div style="color:var(--text-muted);text-align:center;padding:20px;">No matches played between these teams.</div>'}
        </div>

        <div style="margin-top:20px;">
          <canvas id="stats-h2h-chart" style="width:100%;"></canvas>
        </div>

        <div class="card glass" style="padding:20px;margin-top:20px;">
          <h3 class="section-title" style="margin-bottom:12px;">🏏 Batsman vs Bowler</h3>
          <div class="form-row" style="gap:12px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Batsman (${t1Name})</label>
              <select class="form-select" id="stats-h2h-batsman">
                <option value="">Select batsman</option>
                ${batOpts}
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Bowler (${t2Name})</label>
              <select class="form-select" id="stats-h2h-bowler">
                <option value="">Select bowler</option>
                ${bowlOpts}
              </select>
            </div>
          </div>
          ${bvbHtml}
        </div>
      `;
    } else if (h2hTeam1 && h2hTeam2 && h2hTeam1 === h2hTeam2) {
      h2hContent = '<div style="color:var(--accent-amber);text-align:center;padding:30px;margin-top:20px;" class="card glass">⚠️ Please select two different teams.</div>';
    }

    return `
      <div class="form-row" style="gap:12px;margin-bottom:8px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Team 1</label>
          <select class="form-select" id="stats-h2h-team1">
            <option value="">Select team</option>
            ${teamOpts}
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Team 2</label>
          <select class="form-select" id="stats-h2h-team2">
            <option value="">Select team</option>
            ${teamOpts}
          </select>
        </div>
      </div>
      ${h2hContent}
    `;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════

  function render() {
    const tabs = [
      { key: 'batting', label: 'Batting' },
      { key: 'bowling', label: 'Bowling' },
      { key: 'allrounders', label: 'All-rounders' },
      { key: 'records', label: 'Records' },
      { key: 'h2h', label: 'Head-to-Head' }
    ];

    const tabsHtml = tabs.map(t =>
      `<button class="tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}" id="stats-tab-${t.key}">${t.label}</button>`
    ).join('');

    let tabContent = '';
    switch (activeTab) {
      case 'batting': tabContent = renderBattingTab(); break;
      case 'bowling': tabContent = renderBowlingTab(); break;
      case 'allrounders': tabContent = renderAllRoundersTab(); break;
      case 'records': tabContent = renderRecordsTab(); break;
      case 'h2h': tabContent = renderHeadToHeadTab(); break;
    }

    return `
      <div class="page-header">
        <div>
          <h1 style="font-family:var(--font-heading);font-size:28px;font-weight:700;color:var(--text-primary);">📈 Statistics</h1>
          <p class="section-subtitle" style="margin-top:4px;">Comprehensive tournament analytics</p>
        </div>
      </div>
      <div class="page-content">
        <div class="tab-group" id="stats-tab-group" style="margin-bottom:20px;">
          ${tabsHtml}
        </div>
        <div id="stats-tab-content">
          ${tabContent}
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  DRAW CHARTS
  // ══════════════════════════════════════════════════════════════════════

  function drawCharts() {
    if (activeTab === 'batting') {
      const stats = sortData(computeBattingStats(), 'runs', 'desc').slice(0, 10);
      drawHorizontalBarChart(
        'stats-batting-chart',
        stats.map(s => s.name),
        stats.map(s => s.runs),
        '#10b981', '#34d399',
        'Top 10 Run Scorers'
      );
    } else if (activeTab === 'bowling') {
      const stats = sortData(computeBowlingStats(), 'wickets', 'desc').slice(0, 10);
      drawHorizontalBarChart(
        'stats-bowling-chart',
        stats.map(s => s.name),
        stats.map(s => s.wickets),
        '#ef4444', '#f87171',
        'Top 10 Wicket Takers'
      );
    } else if (activeTab === 'allrounders') {
      const data = window._statsRadarData || [];
      drawRadarChart('stats-radar-chart', data);
    } else if (activeTab === 'h2h') {
      const d = window._h2hChartData;
      if (d) {
        drawH2HChart('stats-h2h-chart', d.matchLabels, d.t1RunsArr, d.t2RunsArr, d.t1Name, d.t2Name, d.t1Color, d.t2Color);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ATTACH EVENTS
  // ══════════════════════════════════════════════════════════════════════

  function attachEvents() {
    const container = document.getElementById('page-stats');
    if (!container || container.dataset.eventsAttached) return;
    container.dataset.eventsAttached = 'true';

    container.addEventListener('click', e => {
      // Tab switching
      const tab = e.target.closest('.tab[data-tab]');
      if (tab) {
        activeTab = tab.dataset.tab;
        reRender();
        return;
      }

      // Min-match filter chips
      const chip = e.target.closest('.chip[data-min]');
      if (chip) {
        minMatchFilter = parseInt(chip.dataset.min, 10);
        reRender();
        return;
      }

      // Sortable column headers - Batting
      const sortCol = e.target.closest('.sortable-col[data-sort]');
      if (sortCol) {
        const key = sortCol.dataset.sort;
        if (activeTab === 'batting') {
          if (battingSortKey === key) battingSortDir = battingSortDir === 'desc' ? 'asc' : 'desc';
          else { battingSortKey = key; battingSortDir = 'desc'; }
        } else if (activeTab === 'bowling') {
          if (bowlingSortKey === key) bowlingSortDir = bowlingSortDir === 'desc' ? 'asc' : 'desc';
          else { bowlingSortKey = key; bowlingSortDir = 'desc'; }
        } else if (activeTab === 'allrounders') {
          if (allRounderSortKey === key) allRounderSortDir = allRounderSortDir === 'desc' ? 'asc' : 'desc';
          else { allRounderSortKey = key; allRounderSortDir = 'desc'; }
        }
        reRender();
        return;
      }
    });

    container.addEventListener('change', e => {
      if (e.target.id === 'stats-h2h-team1') {
        h2hTeam1 = e.target.value;
        h2hBatsman = '';
        h2hBowler = '';
        reRender();
      } else if (e.target.id === 'stats-h2h-team2') {
        h2hTeam2 = e.target.value;
        h2hBatsman = '';
        h2hBowler = '';
        reRender();
      } else if (e.target.id === 'stats-h2h-batsman') {
        h2hBatsman = e.target.value;
        reRender();
      } else if (e.target.id === 'stats-h2h-bowler') {
        h2hBowler = e.target.value;
        reRender();
      }
    });
  }

  function reRender() {
    const container = document.getElementById('page-stats');
    if (!container) return;
    container.innerHTML = render();
    requestAnimationFrame(() => drawCharts());
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  return {
    init() {
      const container = document.getElementById('page-stats');
      if (!container) return;
      container.innerHTML = render();
      this.attachEvents();
      requestAnimationFrame(() => drawCharts());
    },
    render,
    attachEvents
  };
})();
