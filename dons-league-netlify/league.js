const KEY_TEAMS = 'thedons_teams_v1';
const KEY_MATCHES = 'thedons_matches_v1';
const KEY_THEME  = 'thedons_theme_v1';

// Data
let teams = JSON.parse(localStorage.getItem(KEY_TEAMS) || '[]'); // {name, color, logo}
let matches = JSON.parse(localStorage.getItem(KEY_MATCHES) || '[]'); // {home, away, date, time, played:boolean, homeScore, awayScore}

// UI refs
const teamForm = document.getElementById('teamForm');
const teamName = document.getElementById('teamName');
const teamColor = document.getElementById('teamColor');
const teamLogo = document.getElementById('teamLogo');
const teamList = document.getElementById('teamList');

const homeSelect = document.getElementById('homeSelect');
const awaySelect = document.getElementById('awaySelect');
const matchForm = document.getElementById('matchForm');
const scheduleList = document.getElementById('scheduleList');

const completedList = document.getElementById('completedList');
const standingsTable = document.querySelector('#standings tbody');

const modal = document.getElementById('modal');
const editForm = document.getElementById('editForm');
const editHome = document.getElementById('editHome');
const editAway = document.getElementById('editAway');
const editDate = document.getElementById('editDate');
const editTime = document.getElementById('editTime');
const modalClose = document.getElementById('modalClose');
const markCompleteBtn = document.getElementById('markComplete');

const searchInput = document.getElementById('searchInput');
const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');
const onlyUpcoming = document.getElementById('onlyUpcoming');
const themeToggle = document.getElementById('themeToggle');
const generateBtn = document.getElementById('generateBtn');

let editingIndex = null;

// Password protection
const ADMIN_PASSWORD = 'zayday1';
let isAuthenticated = false;

function checkPassword() {
  if (isAuthenticated) return true;
  const pwd = prompt('🔐 Enter password to make changes:');
  if (pwd === null) return false;
  if (pwd === ADMIN_PASSWORD) {
    isAuthenticated = true;
    alert('✅ Access granted!');
    return true;
  } else {
    alert('❌ Incorrect password.');
    return false;
  }
}

// --- Initialization
renderAll();
applyThemeFromStorage();

// --- Team handling ---
teamForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!checkPassword()) return;
  const name = teamName.value.trim();
  if(!name) return;
  let logoData = null;
  if(teamLogo.files && teamLogo.files[0]) {
    logoData = await fileToDataUrl(teamLogo.files[0]);
  }
  teams.push({ name, color: teamColor.value, logo: logoData });
  saveTeams();
  teamForm.reset();
  renderAll();
});

function fileToDataUrl(file){ return new Promise(res=>{
  const r = new FileReader(); r.onload = ()=>res(r.result); r.readAsDataURL(file);
}); }

function saveTeams(){ localStorage.setItem(KEY_TEAMS, JSON.stringify(teams)); }
function saveMatches(){ localStorage.setItem(KEY_MATCHES, JSON.stringify(matches)); }

function renderTeams(){
  // list and fill selects
  teamList.innerHTML = '';
  homeSelect.innerHTML = '<option disabled selected>Home</option>';
  awaySelect.innerHTML = '<option disabled selected>Away</option>';
  editHome.innerHTML = '<option disabled selected>Home</option>';
  editAway.innerHTML = '<option disabled selected>Away</option>';
  teams.forEach((t,i)=>{
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <img src="${t.logo||''}" class="logo" onerror="this.style.display='none'">
      <div class="meta">
        <div class="teams" style="color:${t.color}">${t.name}</div>
        <div class="time small-muted">Color: ${t.color}</div>
      </div>
      <div class="actions">
        <button class="btn" onclick="prefillCreate('${escapeQuotes(t.name)}')">Use</button>
      </div>
    `;
    teamList.appendChild(li);
    // selects
    const o1 = document.createElement('option'); o1.value = t.name; o1.textContent = t.name; homeSelect.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = t.name; o2.textContent = t.name; awaySelect.appendChild(o2);
    const o3 = document.createElement('option'); o3.value = t.name; o3.textContent = t.name; editHome.appendChild(o3);
    const o4 = document.createElement('option'); o4.value = t.name; o4.textContent = t.name; editAway.appendChild(o4);
  });
}

// Quick use button fills home select
function prefillCreate(name){
  homeSelect.value = name;
}

// --- Match scheduling ---
matchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!checkPassword()) return;
  const home = homeSelect.value;
  const away = awaySelect.value;
  const date = document.getElementById('matchDate').value;
  const time = document.getElementById('matchTime').value;
  if(!home || !away || home===away) return alert('Choose two different teams');
  matches.push({ home, away, date, time, played:false, homeScore:null, awayScore:null });
  saveMatches(); renderAll();
});

generateBtn.addEventListener('click', () => {
  if (!checkPassword()) return;
  if(teams.length < 2) return alert('Add at least 2 teams');
  // round robin, single leg
  matches = matches.concat(roundRobinFixtures(teams.map(t=>t.name)));
  saveMatches(); renderAll();
});

function roundRobinFixtures(names){
  const list = [...names];
  const isOdd = list.length % 2 === 1;
  if(isOdd) list.push('__BYE__');
  const rounds = list.length -1;
  const half = list.length/2;
  const out = [];
  for(let r=0;r<rounds;r++){
    for(let i=0;i<half;i++){
      const t1 = list[i], t2 = list[list.length-1-i];
      if(t1!=='__BYE__' && t2!=='__BYE__'){
        out.push({home: t1, away: t2, date:'', time:'', played:false, homeScore:null, awayScore:null});
      }
    }
    list.splice(1,0,list.pop());
  }
  return out;
}

// --- Render schedule & completed ---
function renderSchedule(){
  scheduleList.innerHTML = '';
  const filtered = applyFilters(matches.filter(m=>!m.played));
  filtered.forEach((m,i)=>{
    const el = document.createElement('li'); el.className='item';
    const homeObj = teams.find(t=>t.name===m.home) || {};
    const awayObj = teams.find(t=>t.name===m.away) || {};
    el.innerHTML = `
      <img src="${homeObj.logo||''}" class="logo" onerror="this.style.display='none'">
      <div class="meta">
        <div class="teams">${m.home} <span class="small-muted">vs</span> ${m.away}</div>
        <div class="time">${m.date || 'TBD'} • ${m.time || 'TBD'}</div>
      </div>
      <div class="actions">
        <button class="btn" onclick="openEdit(${findMatchIndex(m)})">Edit</button>
        <button class="btn gold" onclick="promptComplete(${findMatchIndex(m)})">Complete</button>
      </div>
    `;
    scheduleList.appendChild(el);
  });
}

function renderCompleted(){
  completedList.innerHTML = '';
  matches.filter(m=>m.played).forEach(m=>{
    const homeObj = teams.find(t=>t.name===m.home) || {};
    const awayObj = teams.find(t=>t.name===m.away) || {};
    const li = document.createElement('li'); li.className='item';
    li.innerHTML = `
      <img src="${homeObj.logo||''}" class="logo" onerror="this.style.display='none'">
      <div class="meta">
        <div class="teams">${m.home} <strong>${m.homeScore}</strong> - <strong>${m.awayScore}</strong> ${m.away}</div>
        <div class="time small-muted">${m.date || 'TBD'} • ${m.time || 'TBD'}</div>
      </div>
      <div class="actions"><button class="btn" onclick="viewMatch(${findMatchIndex(m)})">View</button></div>
    `;
    completedList.appendChild(li);
  });
}

// find the index (because filtering may reorder)
function findMatchIndex(match){
  return matches.findIndex(x => x === match || (x.home===match.home && x.away===match.away && x.date===match.date && x.time===match.time && x.played===match.played));
}

// --- Edit modal ---
function openEdit(index){
  if (!checkPassword()) return;
  editingIndex = index;
  const m = matches[index];
  editHome.value = m.home; editAway.value = m.away; editDate.value = m.date; editTime.value = m.time;
  modal.classList.remove('hidden');
}
modalClose.addEventListener('click', ()=>{ modal.classList.add('hidden'); editingIndex = null; });

editForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  if (!checkPassword()) return;
  if(editingIndex === null) return;
  matches[editingIndex].home = editHome.value;
  matches[editingIndex].away = editAway.value;
  matches[editingIndex].date = editDate.value;
  matches[editingIndex].time = editTime.value;
  saveMatches(); modal.classList.add('hidden'); editingIndex = null; renderAll();
});

// mark complete from modal
markCompleteBtn.addEventListener('click', ()=>{ if(editingIndex===null) return; promptComplete(editingIndex); modal.classList.add('hidden'); editingIndex=null; });

// --- Complete a match (enter score) ---
function promptComplete(index){
  if (!checkPassword()) return;
  const m = matches[index];
  const h = prompt(`Enter goals for ${m.home}:`, m.homeScore ?? 0);
  if(h === null) return;
  const a = prompt(`Enter goals for ${m.away}:`, m.awayScore ?? 0);
  if(a === null) return;
  const homeScore = Number(h), awayScore = Number(a);
  matches[index].homeScore = homeScore;
  matches[index].awayScore = awayScore;
  matches[index].played = true;
  saveMatches();
  updateStandings();
  renderAll();
}

// --- View match (simple alert) ---
function viewMatch(index){
  const m = matches[index];
  alert(`${m.home} ${m.homeScore} - ${m.awayScore} ${m.away}\n${m.date || 'TBD'} • ${m.time || 'TBD'}`);
}

// --- Standings logic ---
function updateStandings(){
  // reset stats
  const stats = {};
  teams.forEach(t => stats[t.name] = { team: t.name, P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, Pts:0 });

  matches.filter(m=>m.played).forEach(m=>{
    const H = stats[m.home]; const A = stats[m.away];
    if(!H || !A) return;
    H.P++; A.P++;
    H.GF += m.homeScore; H.GA += m.awayScore;
    A.GF += m.awayScore; A.GA += m.homeScore;
    if(m.homeScore > m.awayScore){ H.W++; A.L++; H.Pts += 3; }
    else if(m.homeScore < m.awayScore){ A.W++; H.L++; A.Pts += 3; }
    else { H.D++; A.D++; H.Pts++; A.Pts++; }
  });

  Object.values(stats).forEach(s => s.GD = s.GF - s.GA);
  const sorted = Object.values(stats).sort((a,b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.team.localeCompare(b.team));
  renderStandings(sorted);
}

function renderStandings(rows){
  standingsTable.innerHTML = '';
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td style="text-align:left;padding-left:12px">${r.team}</td><td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}</td><td>${r.GA}</td><td>${r.GD>=0? '+'+r.GD: r.GD}</td><td>${r.Pts}</td>`;
    standingsTable.appendChild(tr);
  });
}

// --- Filters & Search ---
function applyFilters(list){
  const q = (searchInput.value || '').toLowerCase().trim();
  const from = filterFrom.value;
  const to = filterTo.value;
  const upcomingOnly = onlyUpcoming.checked;
  const now = new Date();

  return list.filter(m => {
    // upcoming filter
    if(upcomingOnly && m.date){
      const dt = new Date(`${m.date}T${m.time || '00:00'}`);
      if(dt < now) return false;
    }
    // date range filter
    if(from && m.date && m.date < from) return false;
    if(to && m.date && m.date > to) return false;

    // search filter: team name or date substring
    if(q){
      const inTeams = (m.home + ' ' + m.away).toLowerCase().includes(q);
      const inDate = (m.date || '').includes(q);
      if(!inTeams && !inDate) return false;
    }
    return true;
  });
}

// --- Search events
[searchInput, filterFrom, filterTo, onlyUpcoming].forEach(el => el && el.addEventListener('input', renderAll));

// --- Helper find index by identity
function identityIndexOf(item){ return matches.indexOf(item); }

// --- Utilities
function escapeQuotes(s){ return s.replace(/'/g,"\\'").replace(/\"/g,"\\\""); }

// --- Theme
themeToggle.addEventListener('change', () => {
  const dark = themeToggle.checked;
  document.body.classList.toggle('light', !dark);
  localStorage.setItem(KEY_THEME, dark ? 'dark' : 'light');
});
function applyThemeFromStorage(){
  const stored = localStorage.getItem(KEY_THEME) || 'dark';
  const dark = stored === 'dark';
  themeToggle.checked = dark;
  document.body.classList.toggle('light', !dark);
}

// --- Persistence rendering
function renderAll(){
  renderTeams();
  renderSchedule();
  renderCompleted();
  updateStandings();
}

// --- Save & load already handled on changes; ensure save on unload
window.addEventListener('beforeunload', ()=>{ saveTeams(); saveMatches(); });

// initial render
renderAll();
