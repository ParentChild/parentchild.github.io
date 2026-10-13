/* Between Sessions — PCIC family app.
   Everything a family enters is stored only in this phone's browser storage.
   The app makes no network requests of its own and loads nothing from outside companies. */
(function () {
'use strict';
var VERSION = '1.2.0';
var KEY = 'pcic-between-sessions';
var KEEP_DAYS = 90;
var DAY = 864e5;

/* ---------- Small helpers ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return String(n).padStart(2, '0'); }
function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fromKey(k) { var p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function last7(off) { off = off || 0; var t = today0(), a = []; for (var i = 6; i >= 0; i--) a.push(addDays(t, -(i + off))); return a; }
function fmtDay(d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtShort(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtLong(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function todayKey() { return dkey(today0()); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var DL = 'SMTWTFS';
var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function isStandalone() { return navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
var hasCrypto = !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false);

/* ---------- Content ---------- */
var RATE = ['', 'Rough', 'Hard', 'Okay', 'Good', 'Great'];
var FACES = [['great', 'Great'], ['excited', 'Excited'], ['okay', 'Okay'], ['sad', 'Sad'], ['mad', 'Mad'], ['worried', 'Worried'], ['scared', 'Scared']];
var FACE_LABEL = { great: 'Great', excited: 'Excited', okay: 'Okay', sad: 'Sad', mad: 'Mad', worried: 'Worried', scared: 'Scared' };
/* Where a feeling shows up in the body. Arms, hands, legs and feet each have two shapes on the figure. */
var BODY = [['head', 'Head & face'], ['throat', 'Throat'], ['shoulders', 'Shoulders'], ['chest', 'Chest'], ['tummy', 'Tummy'], ['arms', 'Arms'], ['hands', 'Hands'], ['legs', 'Legs'], ['feet', 'Feet']];
var BODY_LABEL = { none: 'Nowhere or not sure' }; BODY.forEach(function (b) { BODY_LABEL[b[0]] = b[1]; });
var BODY_SHAPES = [
  ['head', '<circle cx="100" cy="40" r="30"/>'],
  ['throat', '<rect x="88" y="71" width="24" height="16" rx="4"/>'],
  ['shoulders', '<path d="M40 108 Q40 89 64 89 H136 Q160 89 160 108 Z"/>'],
  ['chest', '<rect x="64" y="110" width="72" height="42" rx="6"/>'],
  ['tummy', '<path d="M64 154 H136 V186 Q136 198 124 198 H76 Q64 198 64 186 Z"/>'],
  ['arms', '<rect x="38" y="110" width="22" height="80" rx="11"/>'], ['arms', '<rect x="140" y="110" width="22" height="80" rx="11"/>'],
  ['hands', '<circle cx="49" cy="203" r="12"/>'], ['hands', '<circle cx="151" cy="203" r="12"/>'],
  ['legs', '<rect x="68" y="200" width="28" height="64" rx="13"/>'], ['legs', '<rect x="104" y="200" width="28" height="64" rx="13"/>'],
  ['feet', '<ellipse cx="80" cy="274" rx="18" ry="9"/>'], ['feet', '<ellipse cx="120" cy="274" rx="18" ry="9"/>']
];
function bodyOrder(arr) { var o = BODY.map(function (b) { return b[0]; }).concat(['none']); return arr.slice().sort(function (a, b) { return o.indexOf(a) - o.indexOf(b); }); }
function bodyText(arr) { return bodyOrder(arr).map(function (k) { return BODY_LABEL[k]; }).join(', '); }
var OTHER = 'Other undesirable behavior';
function isOther(l) { return /^Other/.test(l || ''); }
var BEHAVIOR_CHOICES = ['Tantrum', 'Hitting or kicking', 'Not following directions', 'Bedtime battle', 'Arguing', 'Refusing homework', 'Sibling fights', 'Yelling or slamming doors', 'Shutting down, won’t talk', OTHER];
var BEHAVIOR_DEFAULTS = ['Tantrum', 'Not following directions', OTHER];
/* ABC details: A = what was going on and what happened right before, B = the behavior, C = what happened after */
var ACTIVITIES = ['Playing', 'Mealtime', 'Getting ready', 'Bedtime', 'Homework or chores', 'Screen time', 'In the car', 'Out in public', 'Something else'];
var BEFORE = ['Asked to do something', 'Told “no”', 'Had to stop or switch', 'Screen time ended', 'Attention was elsewhere', 'Tired', 'Hungry', 'Sibling conflict', 'Not sure'];
var LEVELS = ['Small', 'Medium', 'Big'];
var DURATIONS = ['Under a minute', '1–5 min', '5–15 min', 'Over 15 min'];
var AFTER = ['Calmed down on their own', 'Took a break', 'Ignored it and waited', 'Talked it through', 'Comforted them', 'Gave a consequence', 'They got what they wanted', 'They didn’t have to do it', 'Something else'];
var VAGUE = { 'Not sure': 1, 'Something else': 1, 'Other': 1 };
var DAYPARTS = [[6, 11, 'Morning (6–11 AM)'], [11, 15, 'Midday (11 AM–3 PM)'], [15, 18, 'Afternoon (3–6 PM)'], [18, 21, 'Evening (6–9 PM)']];
function daypart(ts) { var h = new Date(ts).getHours(); for (var i = 0; i < DAYPARTS.length; i++) if (h >= DAYPARTS[i][0] && h < DAYPARTS[i][1]) return DAYPARTS[i][2]; return 'Night (9 PM–6 AM)'; }
function partA(l) { return !!(l.activity || (l.before && l.before.length)); }
function partB(l) { return !!(l.what || l.level || l.dur); }
function partC(l) { return !!((l.after && l.after.length) || l.handled); }
function hasDetails(l) { return partA(l) || partB(l) || partC(l); }
var EMO = [['sad', 'Sadness'], ['anx', 'Anxiety'], ['ang', 'Anger'], ['shame', 'Shame'], ['joy', 'Joy']];
var URGE = [['harm', 'Self-harm', 'Self-harm'], ['use', 'Alcohol or drugs', 'Substances'], ['quit', 'Quit therapy', 'Quit therapy']];
var SKILLS = ['Wise mind', 'Observe & describe', 'Paced breathing', 'STOP', 'Self-soothe', 'Distract', 'Radical acceptance', 'Opposite action', 'Check the facts', 'PLEASE', 'DEAR MAN', 'GIVE', 'FAST'];
var QSETS = [
  ['What’s one thing someone in the family did this week that helped you?', 'What felt hard at home this week?', 'What’s one thing we’ll try differently next week?'],
  ['When did the family work well together this week?', 'When did things get tense, and what was going on?', 'What’s one small change that would make next week easier?'],
  ['Who deserves a thank-you this week, and why?', 'What did someone need this week that they didn’t get?', 'What will each person do to help next week go better?'],
  ['What made you laugh together this week?', 'What disagreement came up more than once?', 'What’s one routine we want to try?']
];
var PARTS = [['a', 'Appreciation'], ['c', 'Challenge'], ['p', 'Plan']];
var PLAN_STEPS = [
  ['Warning signs', 'Thoughts, feelings or situations that tell me a hard time is starting'],
  ['Things I can do on my own', 'Ways to calm down or take my mind off things'],
  ['People and places that help me feel better', 'Who I can be around, or where I can go'],
  ['People I can ask for help', 'Adults I trust'],
  ['Professionals', 'My therapist and other people whose job is to help. Crisis lines are always listed below.'],
  ['Keeping my space safe', 'What I agreed to with my therapist and family']
];
function qsetFor(mon) { var n = Math.round(mon.getTime() / (7 * DAY)); return QSETS[((n % 4) + 4) % 4].slice(); }
function childName() { return (S.child || '').trim(); }
function kid() { return childName() || 'your child'; }
function Kid() { return childName() || 'Your child'; }
function kidPoss() { var n = childName(); return n ? n + '’s' : 'your child’s'; }
function tips() {
  var k = kid();
  return [
    'Let ' + k + ' pick the activity, and follow along.',
    'Say out loud what ' + k + ' is doing: “You’re building a tall tower.”',
    'Praise effort, not results: “You kept trying until it fit.”',
    'Set the phone face down. The timer will tell you when time’s up.',
    'Match ' + kidPoss() + ' pace. If things are quiet, be quiet together.',
    'This isn’t the time for teaching or correcting. Just enjoy being together.',
    'When time’s up, tell ' + k + ' one thing you enjoyed.'
  ];
}

/* ---------- Saved data (this phone only) ---------- */
function blank() {
  return { v: 1, mode: null, setupDone: false, child: '', behaviors: [], connectMinutes: 10, tracker: 'feelings', safetyOn: false, safety: ['', '', '', '', '', ''],
    connect: [], log: [], daily: {}, diary: {}, checkins: {}, lock: null, skipInstall: false };
}
function load() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && o.v === 1) {
        var b = blank(); Object.keys(o).forEach(function (k) { b[k] = o[k]; });
        // Earlier versions used "Transition" for the lead-up now called "Had to stop or switch".
        (b.log || []).forEach(function (l) { if (l.before) l.before = l.before.map(function (x) { return x === 'Transition' ? 'Had to stop or switch' : x; }); });
        return b;
      }
    }
  } catch (e) {}
  return blank();
}
var S = load();
var saveWarned = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { if (!saveWarned) { saveWarned = true; toast('This phone couldn’t save. Turn off private browsing and try again.'); } return false; }
}
function prune() {
  var cut = addDays(today0(), -KEEP_DAYS), ck = dkey(cut), cms = cut.getTime(), wk = dkey(addDays(mondayOf(cut), 0));
  S.connect = S.connect.filter(function (c) { return c.d >= ck; });
  S.log = S.log.filter(function (l) { return l.ts >= cms; });
  ['daily', 'diary'].forEach(function (f) { Object.keys(S[f]).forEach(function (k) { if (k < ck) delete S[f][k]; }); });
  Object.keys(S.checkins).forEach(function (k) { if (k < wk) delete S.checkins[k]; });
}
prune(); save();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}

/* ---------- Screen state (not saved) ---------- */
var ui = { tab: 'today', screen: null, locked: !!S.lock, step: 'welcome', sd: null, ciEdit: false, diaryDate: null, concern: null, planEdit: false,
  pin: '', pinMode: 'unlock', pinFirst: '', pinFails: 0, pinWait: 0, hiddenAt: 0, forgot: false };
var installEvt = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (!S.setupDone) render(); });

/* ---------- Icons ---------- */
function sv(p) { return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
var ICON = {
  today: sv('<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  connect: sv('<path d="M12 20c-6.5-4.2-8.5-8-7-11 1.6-3 5.2-3 7-.4 1.8-2.6 5.4-2.6 7 .4 1.5 3-.5 6.8-7 11z"/>'),
  log: sv('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  checkin: sv('<path d="M4 5h12v8H9l-4 3v-3H4z"/><path d="M18 9h2v8h-1v3l-4-3h-5v-2"/>'),
  diary: sv('<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  plan: sv('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  summary: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  help: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  lock: sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  phone: sv('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>')
};
function brandMark(cls) { return '<svg class="' + (cls || 'brandmark') + '" viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="14" r="10" style="fill:var(--spruce)"/><circle cx="22.5" cy="20.5" r="6.5" style="fill:var(--marigold)"/></svg>'; }
function faceSVG(kind, size) {
  size = size || 44;
  var fill = { great: '--marigold-soft', excited: '--rose-soft', okay: '--spruce-soft', sad: '--sky-soft', mad: '--alert-soft', worried: '--plum-soft', scared: '--mist-soft' }[kind] || '--spruce-soft';
  var mouth = { great: '<path d="M13 23 Q20 31 27 23"/>', excited: '<path d="M12.5 22.5 Q20 34 27.5 22.5 Z" style="fill:var(--ink)"/>', okay: '<path d="M14 25 L26 25"/>', sad: '<path d="M14 28 Q20 22 26 28"/>', mad: '<path d="M14 28 Q20 23.5 26 28"/>', worried: '<path d="M14 27 Q17 24 20 27 Q23 30 26 27"/>', scared: '<ellipse cx="20" cy="27.5" rx="3" ry="3.6"/>' }[kind] || '';
  var brows = { mad: 'M11 12.5 L17 15.5 M29 12.5 L23 15.5', worried: 'M11 15 L17 12 M29 15 L23 12', excited: 'M11.5 12.5 Q14.5 9.5 17.5 12.5 M22.5 12.5 Q25.5 9.5 28.5 12.5', scared: 'M11 13.5 Q14 10 17 12 M29 13.5 Q26 10 23 12' }[kind];
  var er = kind === 'scared' ? 2.8 : 1.9;
  return '<svg viewBox="0 0 40 40" width="' + size + '" height="' + size + '" aria-hidden="true"><circle cx="20" cy="20" r="17" style="fill:var(' + fill + ');stroke:var(--ink);stroke-width:1.6"/><g style="fill:none;stroke:var(--ink);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">' + (brows ? '<path d="' + brows + '"/>' : '') + mouth + '</g><circle cx="15" cy="18.5" r="' + er + '" style="fill:var(--ink)"/><circle cx="25" cy="18.5" r="' + er + '" style="fill:var(--ink)"/></svg>';
}

/* ---------- Numbers for the week ---------- */
function isConcern(e) { return !!e && ((e.urge && e.urge.harm >= 4) || e.acted === true); }
function inSet(days) { var o = {}; days.forEach(function (d) { o[dkey(d)] = 1; }); return o; }
function stats() {
  var set7 = inSet(last7()), setP = inSet(last7(7));
  var conn = S.connect.filter(function (c) { return set7[c.d]; });
  var cd = {}; conn.forEach(function (c) { cd[c.d] = 1; });
  var rated = conn.filter(function (c) { return c.rating; });
  var avg = rated.length ? rated.reduce(function (a, c) { return a + c.rating; }, 0) / rated.length : null;
  var logs7 = S.log.filter(function (l) { return set7[dkey(new Date(l.ts))]; });
  var logsP = S.log.filter(function (l) { return setP[dkey(new Date(l.ts))]; });
  var byB = {};
  logs7.forEach(function (l) { byB[l.lab] = (byB[l.lab] || 0) + 1; });
  var sortE = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
  // Most common answer for one ABC field, ignoring "Not sure" and "Something else". n = entries that answered it.
  function top(get) {
    var o = {}, n = 0;
    logs7.forEach(function (l) {
      var v = get(l); v = Array.isArray(v) ? v : (v ? [v] : []);
      var real = v.filter(function (x) { return !VAGUE[x]; });
      if (real.length) n++;
      real.forEach(function (x) { o[x] = (o[x] || 0) + 1; });
    });
    var s = sortE(o);
    if (!s.length) return null;
    var tie = s[1] && s[1][1] === s[0][1];
    return { label: tie ? s[0][0] + ' and ' + s[1][0] : s[0][0], count: s[0][1], n: n, tie: !!tie };
  }
  var dbt = S.mode === 'teen' && S.tracker === 'dbt';
  var src = dbt ? S.diary : S.daily;
  var trackDays = Object.keys(set7).filter(function (k) { return src[k]; }).length;
  return {
    connectDays: Object.keys(cd).length, avg: avg, logThis: logs7.length, logPrev: logsP.length,
    byB: sortE(byB),
    when: logs7.length >= 2 ? top(function (l) { return daypart(l.ts); }) : null,
    activity: top(function (l) { return l.activity; }),
    lead: top(function (l) { return l.before; }),
    after: top(function (l) { return l.after; }),
    detailed: logs7.filter(hasDetails).sort(function (a, b) { return b.ts - a.ts; }),
    needDetails: logs7.filter(function (l) { return !hasDetails(l); }).length,
    ci: S.checkins[dkey(mondayOf(today0()))] || null, trackDays: trackDays
  };
}

/* ---------- Shared pieces ---------- */
function head(title, eyebrow, withSettings) {
  return '<div class="scr-head"><div><p class="eyebrow">' + esc(eyebrow || fmtLong(today0())) + '</p><h1>' + esc(title) + '</h1></div><div class="head-btns">' +
    (withSettings ? '<button class="icon-btn" data-act="settings" aria-label="Settings">' + ICON.gear + '</button>' : '') +
    '<button class="help-pill" data-act="help">' + ICON.help + 'Get help now</button></div></div>';
}
function weekDots(doneSet) {
  var tk = todayKey();
  return '<ol class="dots" aria-label="Last 7 days">' + last7().map(function (d) {
    var k = dkey(d), on = !!doneSet[k];
    return '<li class="' + (on ? 'on ' : '') + (k === tk ? 'today' : '') + '"><span class="dot" aria-hidden="true">' + (on ? ICON.check : '') + '</span><span class="dl" aria-hidden="true">' + DL[d.getDay()] + '</span><span class="sr">' + fmtDay(d) + ': ' + (on ? 'done' : 'not done') + '</span></li>';
  }).join('') + '</ol>';
}
function bars(series) {
  var max = Math.max.apply(null, [1].concat(series.map(function (s) { return s.value; })));
  return '<div class="bars" style="--n:' + series.length + '" role="img" aria-label="' + esc(series.map(function (s) { return s.full + ': ' + s.value; }).join(', ')) + '">' + series.map(function (s) {
    return '<div class="bar-col' + (s.cur ? ' cur' : '') + (s.today ? ' today' : '') + '"><span class="bar-val">' + s.value + '</span><div class="bar-track"><div class="bar" style="height:' + (s.value / max * 100).toFixed(1) + '%"></div></div><span class="bar-lab">' + s.label + '</span></div>';
  }).join('') + '</div>';
}
function daySeries(days, curFrom) {
  var tk = todayKey();
  return days.map(function (d, i) { var k = dkey(d); return { label: DL[d.getDay()], full: fmtDay(d), value: S.log.filter(function (l) { return dkey(new Date(l.ts)) === k; }).length, cur: i >= curFrom, today: k === tk }; });
}
function crisisList() {
  return '<ul class="crisis">' +
    '<li><div><strong>988 Suicide &amp; Crisis Lifeline</strong><span>Call or text 988, any time</span></div><div class="row-btns"><a class="btn call" href="tel:988">Call 988</a><a class="btn textbtn" href="sms:988">Text 988</a></div></li>' +
    '<li><div><strong>Colorado Crisis Services</strong><span>1-844-493-8255, or text TALK to 38255, any time</span></div><div class="row-btns"><a class="btn call" href="tel:18444938255">Call</a><a class="btn textbtn" href="sms:38255?&amp;body=TALK">Text TALK</a></div></li>' +
    '<li><div><strong>Emergency</strong><span>Call 911 if someone is in danger right now</span></div><div class="row-btns"><a class="btn call" href="tel:911">Call 911</a></div></li>' +
  '</ul>';
}
function helpSheet() {
  return '<h2>Get help now</h2>' + crisisList() + '<p class="small muted">This app doesn’t send anything to anyone, and PCIC isn’t a crisis service. If you need help now, use one of these numbers.</p><button class="btn ghost" data-act="closeSheet">Close</button>';
}
function faceCard(title, sub) {
  var tk = todayKey(), e = S.daily[tk], sel = e && e.face;
  var bodyLine = !e ? '' : '<div class="body-line">' + (e.body && e.body.length
    ? '<span><span class="muted">Feel it in:</span> ' + esc(bodyText(e.body)) + '</span><button class="link" data-act="bodyOpen">Change</button>'
    : '<button class="link" data-act="bodyOpen">Add where you feel it in your body</button>') + '</div>';
  return '<section class="card"><div class="card-head"><h2>' + esc(title) + '</h2>' + (sel ? '<span class="chip ok">Saved</span>' : '') + '</div><p class="muted">' + esc(sub) + '</p><div class="faces" role="group" aria-label="Feelings">' + FACES.map(function (x) {
    return '<button class="face" data-act="face" data-k="' + x[0] + '" aria-pressed="' + (sel === x[0]) + '">' + faceSVG(x[0]) + '<span>' + x[1] + '</span></button>';
  }).join('') + '</div>' + bodyLine + '</section>';
}
/* fillFor(part) returns true (picked), a CSS color (shaded by how often), or false. */
function bodySVG(fillFor, live) {
  return '<svg class="bodymap' + (live ? ' live' : '') + '" viewBox="0 0 200 290" aria-hidden="true">' + BODY_SHAPES.map(function (s) {
    var f = fillFor(s[0]);
    return '<g class="bm-part' + (f === true ? ' on' : '') + '" data-k="' + s[0] + '"' + (live ? ' data-act="bodyTap"' : '') + (typeof f === 'string' ? ' style="--bm:' + f + '"' : '') + '>' + s[1] + '</g>';
  }).join('') + '<g class="bm-deco"><circle cx="90" cy="37" r="2.6"/><circle cx="110" cy="37" r="2.6"/><path d="M90 49 Q100 56 110 49"/></g></svg>';
}
var bodySel = [];
function bodySheet(face) {
  return '<div class="body-head">' + faceSVG(face, 46) + '<h2>Where do you feel ' + FACE_LABEL[face].toLowerCase() + ' in your body?</h2></div>' +
    '<p class="muted">Tap the body or the words. Pick as many as you want.</p>' +
    '<div class="bodywrap">' + bodySVG(function (k) { return bodySel.indexOf(k) > -1; }, true) + '</div>' +
    '<div class="picks" role="group" aria-label="Places in the body">' + BODY.concat([['none', BODY_LABEL.none]]).map(function (b) {
      return '<button class="pick" data-act="bodyPick" data-k="' + b[0] + '" aria-pressed="' + (bodySel.indexOf(b[0]) > -1) + '">' + b[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="sheet-actions"><button class="btn ghost" data-act="bodySkip">Skip</button><button class="btn primary" data-act="bodyDone">Done</button></div>';
}
function openBody() { var e = S.daily[todayKey()]; if (!e) return; bodySel = (e.body || []).slice(); openSheet(bodySheet(e.face)); }
function toggleBody(k) {
  if (k === 'none') bodySel = bodySel.indexOf('none') > -1 ? [] : ['none'];
  else { bodySel = bodySel.filter(function (x) { return x !== 'none'; }); var i = bodySel.indexOf(k); if (i < 0) bodySel.push(k); else bodySel.splice(i, 1); }
  $$('.sheet .bm-part').forEach(function (g) { g.classList.toggle('on', bodySel.indexOf(g.getAttribute('data-k')) > -1); });
  $$('.sheet [data-act="bodyPick"]').forEach(function (b) { b.setAttribute('aria-pressed', String(bodySel.indexOf(b.dataset.k) > -1)); });
}
function bodyWeek(days) {
  var counts = {}, rows = [];
  days.forEach(function (d) {
    var e = S.daily[dkey(d)]; if (!e || !e.body || !e.body.length) return;
    rows.push([d, e]); e.body.forEach(function (k) { if (k !== 'none') counts[k] = (counts[k] || 0) + 1; });
  });
  if (!rows.length) return '';
  var max = Math.max.apply(null, [1].concat(Object.keys(counts).map(function (k) { return counts[k]; })));
  var fig = bodySVG(function (k) { var c = counts[k]; return c ? 'color-mix(in srgb, var(--marigold) ' + Math.round(35 + 65 * c / max) + '%, var(--card))' : false; }, false);
  return '<div class="bodyweek"><span class="eyebrow">Where it was felt</span><div class="bw-grid"><div class="bw-fig">' + fig + '<p class="small muted">Darker means more days.</p></div><ul class="notelist">' +
    rows.reverse().map(function (r) { return '<li><span class="small muted">' + fmtDay(r[0]) + ' · ' + FACE_LABEL[r[1].face] + '</span><span>' + esc(bodyText(r[1].body)) + '</span></li>'; }).join('') + '</ul></div></div>';
}
function faceRow(days) {
  return '<div class="facerow">' + days.map(function (d) {
    var e = S.daily[dkey(d)];
    return '<div class="fr-cell"><span class="small muted">' + DL[d.getDay()] + '</span>' + (e ? faceSVG(e.face, 34) : '<span class="fr-empty" aria-hidden="true">–</span>') + '<span class="small">' + (e ? FACE_LABEL[e.face] : '<span class="sr">No check-in</span>') + '</span></div>';
  }).join('') + '</div>';
}
function tile(label, value, sub) { return '<div class="tile"><span class="eyebrow">' + label + '</span><span class="tile-v">' + value + '</span><span class="small muted">' + sub + '</span></div>'; }
function abcDots(l) {
  var parts = [['A', partA(l), 'Before'], ['B', partB(l), 'Behavior'], ['C', partC(l), 'After']];
  return '<span class="abcdots">' + parts.map(function (p) { return '<span class="' + (p[1] ? 'on' : '') + '" title="' + p[2] + '">' + p[0] + '</span>'; }).join('') + '<span class="sr">Details filled in: ' + (parts.filter(function (p) { return p[1]; }).map(function (p) { return p[2]; }).join(', ') || 'none') + '</span></span>';
}
function patternsBlock(st) {
  var rows = [];
  if (st.when) rows.push(['Most often', st.when]);
  if (st.activity) rows.push(['Usually during', st.activity]);
  if (st.lead) rows.push(['Most common lead-up (A)', st.lead]);
  if (st.after) rows.push(['Most often after (C)', st.after]);
  if (!rows.length) return '';
  return '<div class="pats-wrap"><span class="eyebrow">Patterns this week</span><ul class="pats">' + rows.map(function (r) {
    return '<li><span><span class="pl">' + r[0] + '</span>' + esc(r[1].label) + '</span><span class="num">' + r[1].count + ' of ' + r[1].n + (r[1].tie ? ' each' : '') + '</span></li>';
  }).join('') + '</ul></div>';
}
function abcCard(l) {
  var rows = [];
  if (l.activity) rows.push(['Doing', l.activity]);
  if (l.before && l.before.length) rows.push(['A · Before', l.before.join(', ')]);
  var b = [l.what, l.level, l.dur].filter(Boolean);
  if (b.length) rows.push(['B · Behavior', b.join(' · ')]);
  if (l.after && l.after.length) rows.push(['C · After', l.after.join(', ')]);
  if (l.handled) rows.push(['Notes', l.handled]);
  return '<li class="abc"><div class="abc-top"><strong>' + esc(l.lab) + '</strong><span class="small muted">' + fmtDay(new Date(l.ts)) + ', ' + fmtTime(l.ts) + '</span></div><dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></li>';
}

/* ---------- Setup (first run) ---------- */
function progress(n, of) { var s = ''; for (var i = 1; i <= of; i++) s += '<span class="' + (i <= n ? 'on' : '') + '"></span>'; return '<div class="progress" aria-label="Step ' + n + ' of ' + of + '">' + s + '</div>'; }
function setupScreen() {
  var st = ui.step, sd = ui.sd;
  if (st === 'welcome') {
    var needsHome = isIOS && !isStandalone() && !S.skipInstall;
    return '<main class="screen-body" id="sbody">' + brandMark() +
      '<h1 class="setup-h">Between Sessions</h1><p class="lede">Simple practice between therapy sessions at PCIC: a few minutes of connection time, a quick behavior log, feelings check-ins, and a weekly family conversation.</p>' +
      '<section class="card"><h2>Your privacy</h2><ul class="steps"><li>Everything you enter stays on this phone.</li><li>PCIC can’t see it. You choose what to show your therapist in session.</li><li>No account, no email, and no names needed.</li><li>Entries older than 90 days delete themselves.</li></ul></section>' +
      (needsHome
        ? '<section class="card"><div class="card-head"><h2>First, add it to your Home Screen</h2></div><ol class="steps"><li>Tap the Share button at the bottom of Safari (the square with an arrow).</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Open Between Sessions from your Home Screen and set it up there.</li></ol><p class="small muted">The Home Screen app keeps its own data, so anything entered here in Safari won’t carry over.</p></section>' +
          '<div class="setup-foot"><button class="link center" data-act="skipInstall">Use it in Safari instead</button></div>'
        : (installEvt ? '<button class="btn ghost" data-act="install">' + ICON.phone + '&nbsp;Add to Home Screen</button>' : '') +
          '<div class="setup-foot"><button class="btn primary block" data-act="setupNext" data-to="who">Get started</button><p class="foot">PCIC isn’t a crisis service. In an emergency, call 911 or call or text 988.</p></div>') +
      '</main>';
  }
  if (st === 'who') {
    return '<main class="screen-body" id="sbody">' + progress(1, 4) + '<h1 class="setup-h">Who will use the app on this phone?</h1>' +
      '<button class="choice" data-act="setMode" data-v="parent" aria-pressed="' + (sd.mode === 'parent') + '"><strong>I’m a parent or caregiver</strong><span class="muted">Connection time, behavior log, your child’s feelings, and the family check-in.</span></button>' +
      '<button class="choice" data-act="setMode" data-v="teen" aria-pressed="' + (sd.mode === 'teen') + '"><strong>I’m a teen</strong><span class="muted">A daily check-in for you, and an optional safety plan.</span></button>' +
      '<p class="small muted">If a parent and a teen both use the app, each should use their own phone.</p>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="welcome">Back</button><button class="btn primary" data-act="setupNext" data-to="' + (sd.mode === 'teen' ? 'tracker' : 'name') + '"' + (sd.mode ? '' : ' disabled') + '>Next</button></div></div></main>';
  }
  if (st === 'name') {
    return '<main class="screen-body" id="sbody">' + progress(2, 4) + '<h1 class="setup-h">What should we call your child?</h1>' +
      '<div class="field"><label class="field-lab" for="su-name">First name or nickname</label><input id="su-name" maxlength="24" autocomplete="off" value="' + esc(sd.child) + '" placeholder="Optional"><p class="small muted">You can leave this blank. It’s only used to word things in the app, and it stays on this phone.</p></div>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="who">Back</button><button class="btn primary" data-act="setupNext" data-to="behaviors">Next</button></div></div></main>';
  }
  if (st === 'behaviors') {
    var chosen = sd.behaviors;
    var extras = chosen.filter(function (b) { return BEHAVIOR_CHOICES.indexOf(b) < 0; });
    return '<main class="screen-body" id="sbody">' + progress(3, 4) + '<h1 class="setup-h">What do you want to keep track of?</h1><p class="lede">Pick the behaviors you want to log. Your therapist may suggest a few. You can change these later.</p>' +
      '<div class="picks" role="group" aria-label="Behaviors">' + BEHAVIOR_CHOICES.concat(extras).map(function (b) { return '<button class="pick" data-act="suBeh" data-v="' + esc(b) + '" aria-pressed="' + (chosen.indexOf(b) > -1) + '">' + esc(b) + '</button>'; }).join('') + '</div>' +
      '<form class="addrow" data-form="suAddBeh"><label class="sr" for="su-beh">Add your own</label><input id="su-beh" maxlength="40" placeholder="Add your own" autocomplete="off"><button class="btn ghost" type="submit">Add</button></form>' +
      '<p class="err" id="su-err" hidden>Pick at least one.</p>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="name">Back</button><button class="btn primary" data-act="setupNext" data-to="length">Next</button></div></div></main>';
  }
  if (st === 'length') {
    return '<main class="screen-body" id="sbody">' + progress(4, 4) + '<h1 class="setup-h">How long is connection time?</h1><p class="lede">Connection time is a few minutes a day of one-on-one time where your child picks the activity. Ask your therapist what length to start with.</p>' +
      '<div class="seg" style="--cols:3" role="group" aria-label="Length">' + [5, 10, 15].map(function (m) { return '<button data-act="suLen" data-m="' + m + '" aria-pressed="' + (sd.minutes === m) + '">' + m + ' min</button>'; }).join('') + '</div>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="behaviors">Back</button><button class="btn primary" data-act="finishSetup">Finish</button></div></div></main>';
  }
  if (st === 'tracker') {
    return '<main class="screen-body" id="sbody">' + progress(2, 4) + '<h1 class="setup-h">Which daily check-in do you want?</h1>' +
      '<button class="choice" data-act="suTrack" data-v="feelings" aria-pressed="' + (sd.tracker === 'feelings') + '"><strong>Feelings check-in</strong><span class="muted">Pick how you feel today. Takes about 10 seconds.</span></button>' +
      '<button class="choice" data-act="suTrack" data-v="dbt" aria-pressed="' + (sd.tracker === 'dbt') + '"><strong>Diary card</strong><span class="muted">Rate emotions and urges, and note the skills you used. Common in DBT.</span></button>' +
      '<p class="small muted">Not sure? Ask your therapist, or start with the feelings check-in. You can switch later.</p>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="who">Back</button><button class="btn primary" data-act="setupNext" data-to="plan">Next</button></div></div></main>';
  }
  if (st === 'plan') {
    return '<main class="screen-body" id="sbody">' + progress(3, 4) + '<h1 class="setup-h">Keep a safety plan in the app?</h1><p class="lede">If you made a safety plan with your therapist, you can type it in so it’s always with you. This is optional.</p>' +
      '<button class="choice" data-act="suPlan" data-v="yes" aria-pressed="' + (sd.safetyOn === true) + '"><strong>Yes, add one</strong><span class="muted">You’ll fill it in after setup.</span></button>' +
      '<button class="choice" data-act="suPlan" data-v="no" aria-pressed="' + (sd.safetyOn === false) + '"><strong>Not now</strong><span class="muted">You can turn it on later in Settings.</span></button>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="tracker">Back</button><button class="btn primary" data-act="setupNext" data-to="teenDone">Next</button></div></div></main>';
  }
  if (st === 'teenDone') {
    return '<main class="screen-body" id="sbody">' + progress(4, 4) + '<h1 class="setup-h">One more thing</h1>' +
      '<section class="card"><ul class="steps"><li>What you enter stays on this phone. Nobody sees it unless you show them.</li><li>If other people use this phone, set an app passcode in Settings.</li><li>This app doesn’t alert anyone. If you need help right now, tap <strong>Get help now</strong> at the top of any screen.</li></ul></section>' +
      '<div class="setup-foot"><div class="two"><button class="btn ghost" data-act="setupNext" data-to="plan">Back</button><button class="btn primary" data-act="finishSetup">Finish</button></div></div></main>';
  }
  return '';
}
function startSetup() { ui.step = 'welcome'; ui.sd = { mode: null, child: '', behaviors: BEHAVIOR_DEFAULTS.slice(), minutes: 10, tracker: 'feelings', safetyOn: false }; }

/* ---------- Parent screens ---------- */
function pToday() {
  var tk = todayKey(), st = stats();
  var done = {}; S.connect.forEach(function (c) { done[c.d] = 1; });
  var doneToday = !!done[tk];
  var todayLogs = S.log.filter(function (l) { return dkey(new Date(l.ts)) === tk; }).length;
  return head('Today', null, true) +
    '<section class="card"><div class="card-head"><h2>Connection time</h2>' + (doneToday ? '<span class="chip ok">Done today</span>' : '<span class="chip">Not yet today</span>') + '</div>' + weekDots(done) +
    '<p class="muted small">' + st.connectDays + ' of the last 7 days</p><button class="btn primary" data-act="tab" data-tab="connect">' + (doneToday ? 'Do another round' : 'Start ' + S.connectMinutes + ' minutes') + '</button></section>' +
    faceCard(Kid() + '’s feelings', 'Hand ' + kid() + ' the phone and ask: how are you feeling today?') +
    '<section class="card"><div class="card-head"><h2>Behavior log</h2><span class="muted small">Today: ' + todayLogs + '</span></div><p class="muted">Tap when it happens.</p><div class="quick">' + S.behaviors.map(function (b) {
      return '<button class="qbtn" data-act="quicklog" data-b="' + b.id + '">' + esc(b.label) + '</button>'; }).join('') + '</div>' +
    '<p class="small muted">Last 7 days: ' + st.logThis + ' · The 7 days before: ' + st.logPrev + '</p>' +
    (st.needDetails ? '<button class="link" data-act="tab" data-tab="log">Add details to ' + st.needDetails + (st.needDetails === 1 ? ' entry' : ' entries') + ' from this week</button>' : '') + '</section>' +
    '<section class="card"><div class="card-head"><h2>Family check-in</h2>' + (st.ci ? '<span class="chip ok">Done this week</span>' : '<span class="chip warn">This week</span>') + '</div><p class="muted">' + (st.ci ? 'Show your answers at your next session.' : 'Three questions to talk through together before your next session.') + '</p>' +
    '<button class="btn ghost" data-act="tab" data-tab="checkin">' + (st.ci ? 'View answers' : 'Open this week’s questions') + '</button></section>' +
    '<section class="card"><h2>At your session</h2><p class="muted">Open the summary and show your therapist. Nothing is sent anywhere.</p><button class="btn ghost" data-act="tab" data-tab="summary">Open summary</button></section>';
}

var T = { total: 600, remaining: 600, running: false, last: 0, iv: null, tipIdx: 0, tipElapsed: 0, userLen: false, pendingRate: false };
var wakeLock = null;
function mmss(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + pad(s % 60); }
function ensureTimer() { if (!T.running && !T.userLen && T.remaining === T.total && T.total !== S.connectMinutes * 60) T.total = T.remaining = S.connectMinutes * 60; }
function ringOffset() { var C = 2 * Math.PI * 88; return (C * (1 - (T.total ? T.remaining / T.total : 0))).toFixed(1); }
function pConnect() {
  ensureTimer();
  var set7 = inSet(last7()), tp = tips();
  var week = S.connect.filter(function (c) { return set7[c.d]; }).slice().reverse();
  var C = (2 * Math.PI * 88).toFixed(1);
  return head('Connection time', Kid() + ' leads') +
    '<p class="lede">Give ' + esc(kid()) + ' your full attention for a few minutes. ' + esc(Kid()) + ' picks the activity, and you follow along.</p>' +
    '<div class="seg" style="--cols:3" role="group" aria-label="Length">' + [5, 10, 15].map(function (m) { return '<button data-act="len" data-m="' + m + '" aria-pressed="' + (T.total === m * 60) + '"' + (T.running ? ' disabled' : '') + '>' + m + ' min</button>'; }).join('') + '</div>' +
    '<div class="timer"><svg viewBox="0 0 200 200" class="ring" aria-hidden="true"><circle cx="100" cy="100" r="88" class="ring-track"/><circle cx="100" cy="100" r="88" class="ring-prog" id="ring-prog" stroke-dasharray="' + C + '" style="stroke-dashoffset:' + ringOffset() + '"/></svg><div class="ring-label" role="timer" aria-label="Time left"><span id="t-left">' + mmss(T.remaining) + '</span><span class="small muted" id="t-sub">' + (T.running ? 'Time left' : 'of ' + Math.round(T.total / 60) + ' min') + '</span></div></div>' +
    '<div class="two"><button class="btn primary" data-act="tstart" id="t-main">' + (T.running ? 'Pause' : (T.remaining < T.total && T.remaining > 0 ? 'Resume' : 'Start')) + '</button><button class="btn ghost" data-act="tdone">Done, log it</button></div>' +
    '<section class="card tip" aria-live="polite"><p class="eyebrow">Tip <span id="tip-n">' + ((T.tipIdx % tp.length) + 1) + '</span> of ' + tp.length + '</p><p id="tip-t" class="tip-text">' + esc(tp[T.tipIdx % tp.length]) + '</p><button class="link" data-act="nexttip">Next tip</button></section>' +
    '<h3>Last 7 days</h3>' + (week.length ? '<ul class="hist">' + week.map(function (c) {
      return '<li><div class="hist-top"><strong>' + fmtDay(fromKey(c.d)) + '</strong><span class="chip' + (c.rating >= 4 ? ' ok' : '') + '">' + (RATE[c.rating] || 'No rating') + '</span></div><span class="muted small">' + c.min + ' min' + (c.note ? ' · ' + esc(c.note) : '') + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing yet this week.</p>');
}
function entryRow(l) {
  var meta = [fmtTime(l.ts)]; if (l.activity) meta.push(l.activity); if (l.what) meta.push(l.what);
  return '<li><div><strong>' + esc(l.lab) + '</strong><span class="muted small">' + esc(meta.join(' · ')) + '</span>' + abcDots(l) + '</div><button class="link" data-act="details" data-id="' + l.id + '">' + (hasDetails(l) ? 'Edit' : 'Add details') + '</button></li>';
}
function dayLabel(k) { var t = todayKey(), y = dkey(addDays(today0(), -1)); return k === t ? 'Today' : k === y ? 'Yesterday' : fmtDay(fromKey(k)); }
function pLog() {
  var tk = todayKey(), st = stats(), since = addDays(today0(), -6).getTime();
  var recent = S.log.filter(function (l) { return l.ts >= since; }).sort(function (a, b) { return b.ts - a.ts; });
  var counts = {}; recent.forEach(function (l) { if (dkey(new Date(l.ts)) === tk) counts[l.b] = (counts[l.b] || 0) + 1; });
  var groups = [], cur = null;
  recent.forEach(function (l) { var k = dkey(new Date(l.ts)); if (!cur || cur.k !== k) { cur = { k: k, items: [] }; groups.push(cur); } cur.items.push(l); });
  var pats = patternsBlock(st);
  return head('Behavior log', 'Tap when it happens') +
    '<p class="lede">One tap saves the time. Then add what happened before, during, and after when you have a minute.</p>' +
    '<div class="bgrid">' + S.behaviors.map(function (b) { return '<button class="bbtn" data-act="quicklog" data-b="' + b.id + '"><span>' + esc(b.label) + '</span>' + (counts[b.id] ? '<span class="count">' + counts[b.id] + ' today</span>' : '<span class="count muted">Tap to log</span>') + '</button>'; }).join('') + '</div>' +
    '<section class="card"><div class="card-head"><h2>Last 7 days</h2><span class="muted small">' + st.logThis + ' logged</span></div>' + bars(daySeries(last7(), 0)) + pats + '</section>' +
    '<h3>Recent</h3>' + (groups.length ? groups.map(function (g) { return '<p class="daylab">' + dayLabel(g.k) + '</p><ul class="entries">' + g.items.map(entryRow).join('') + '</ul>'; }).join('') : '<p class="muted">Nothing logged in the last 7 days.</p>') +
    '<button class="link" data-act="settings">Change which behaviors you track</button>';
}
function pCheckin() {
  var mon = mondayOf(today0()), wk = dkey(mon), ci = S.checkins[wk], q = ci ? ci.q : qsetFor(mon);
  var body;
  if (!ci || ui.ciEdit) {
    body = '<form data-form="checkin" class="ci-form">' + PARTS.map(function (p, i) {
      return '<div class="ci-part"><p class="eyebrow">' + p[1] + '</p><label for="ci-' + p[0] + '" class="ci-q">' + esc(q[i]) + '</label><textarea id="ci-' + p[0] + '" rows="3" maxlength="600" placeholder="A few words is plenty">' + (ci ? esc(ci[p[0]]) : '') + '</textarea></div>';
    }).join('') + '<p class="err" id="ci-err" hidden>Write something for at least one question.</p><button class="btn primary" type="submit">Save answers</button></form>';
  } else {
    body = '<div class="ci-done">' + PARTS.map(function (p, i) {
      return '<div class="ci-part"><p class="eyebrow">' + p[1] + '</p><p class="ci-q">' + esc(q[i]) + '</p><p>' + (esc(ci[p[0]]) || '<span class="muted">No answer</span>') + '</p></div>';
    }).join('') + '<p class="muted small">Saved ' + fmtDay(new Date(ci.at)) + ' at ' + fmtTime(ci.at) + '. They’re in your summary for your next session.</p><button class="btn ghost" data-act="ciEdit">Edit answers</button></div>';
  }
  var past = Object.keys(S.checkins).filter(function (k) { return k !== wk; }).sort().reverse();
  return head('Family check-in', 'Week of ' + fmtShort(mon)) +
    '<p class="lede">Talk these through together, at dinner or in the car. Then write a few words for each.</p>' + body +
    (past.length ? '<h3>Earlier weeks</h3>' + past.map(function (k) {
      var c = S.checkins[k];
      return '<details class="past"><summary>Week of ' + fmtShort(fromKey(k)) + '</summary>' + PARTS.map(function (p, i) { return '<div class="ci-part"><p class="eyebrow">' + p[1] + '</p><p class="muted small">' + esc(c.q[i]) + '</p><p>' + (esc(c[p[0]]) || '<span class="muted">No answer</span>') + '</p></div>'; }).join('') + '</details>';
    }).join('') : '');
}
function pSummary() {
  var st = stats(), d = last7();
  var trend = st.logThis < st.logPrev ? 'Down from ' + st.logPrev + ' the week before' : st.logThis > st.logPrev ? 'Up from ' + st.logPrev + ' the week before' : 'Same as the week before';
  var conn = {}; S.connect.forEach(function (c) { conn[c.d] = 1; });
  var set7 = inSet(d);
  var cNotes = S.connect.filter(function (c) { return set7[c.d]; }).slice().reverse();
  return head('Summary', 'Show your therapist') +
    '<p class="lede">Open this at the start of your session and show your therapist. Nothing is sent anywhere.</p>' +
    '<p class="eyebrow">' + fmtShort(d[0]) + ' to ' + fmtShort(d[6]) + '</p>' +
    '<div class="tiles">' +
      tile('Connection time', st.connectDays + '<small> / 7 days</small>', st.avg ? 'Usually ' + RATE[Math.round(st.avg)].toLowerCase() : 'No ratings yet') +
      tile('Behaviors logged', String(st.logThis), trend) +
      tile('Feelings check-ins', st.trackDays + '<small> / 7 days</small>', childName() ? esc(childName()) : 'Your child') +
      tile('Family check-in', st.ci ? 'Done' : 'Not yet', st.ci ? fmtDay(new Date(st.ci.at)) : 'This week') +
    '</div>' +
    '<section class="card"><h2>Family check-in</h2>' + (st.ci ? '<div class="qa">' + PARTS.map(function (p, i) { return '<div><span class="eyebrow">' + p[1] + '</span><p class="q">' + esc(st.ci.q[i]) + '</p><p>' + (esc(st.ci[p[0]]) || '<span class="muted">No answer</span>') + '</p></div>'; }).join('') + '</div>' : '<p class="muted">Not done yet this week.</p>') + '</section>' +
    '<section class="card"><div class="card-head"><h2>Behaviors</h2><span class="muted small">Last 14 days</span></div><div class="legend"><span><span class="key prev"></span>The 7 days before</span><span><span class="key cur"></span>Last 7 days</span></div>' + bars(daySeries(last7(7).concat(d), 7)) +
      '<ul class="breakdown">' + (st.byB.length ? st.byB.map(function (b) { return '<li><span>' + esc(b[0]) + '</span><span class="num">' + b[1] + '</span></li>'; }).join('') : '<li><span class="muted">Nothing logged in the last 7 days</span></li>') + '</ul>' +
      patternsBlock(st) + '</section>' +
    abcSection(st) +
    '<section class="card"><h2>' + esc(Kid()) + '’s feelings</h2>' + faceRow(d) + bodyWeek(d) + '</section>' +
    '<section class="card"><div class="card-head"><h2>Connection time</h2><span class="muted small">' + S.connectMinutes + ' min goal</span></div>' + weekDots(conn) +
      (cNotes.length ? '<ul class="notelist">' + cNotes.map(function (c) { return '<li><span class="small muted">' + fmtDay(fromKey(c.d)) + ' · ' + c.min + ' min · ' + (RATE[c.rating] || 'No rating') + '</span>' + (c.note ? '<span>' + esc(c.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">None in the last 7 days.</p>') + '</section>';
}

function abcSection(st) {
  if (!st.logThis) return '';
  var list = st.detailed, shown = ui.abcAll ? list : list.slice(0, 5);
  return '<section class="card"><div class="card-head"><h2>Behavior details</h2><span class="muted small">A · B · C</span></div>' +
    (list.length ? '<ul class="abcs">' + shown.map(abcCard).join('') + '</ul>' +
      (list.length > 5 ? '<button class="link" data-act="abcAll">' + (ui.abcAll ? 'Show fewer' : 'Show all ' + list.length) + '</button>' : '')
      : '<p class="muted">No details added this week.</p>') +
    (st.needDetails ? '<p class="small muted">' + st.needDetails + (st.needDetails === 1 ? ' entry has' : ' entries have') + ' no details.</p>' : '') + '</section>';
}

/* ---------- Teen screens ---------- */
function tToday() {
  var tk = todayKey(), dbt = S.tracker === 'dbt', src = dbt ? S.diary : S.daily;
  var filled = !!src[tk], set = {}, n = 0;
  last7().forEach(function (d) { var k = dkey(d); if (src[k]) { set[k] = 1; n++; } });
  return head('Today', null, true) +
    '<p class="note">' + ICON.lock + '<span>What you enter stays on this phone. Nobody sees it unless you show them.' + (S.lock ? '' : ' If others use this phone, set a passcode in Settings.') + '</span></p>' +
    '<section class="card"><div class="card-head"><h2>' + (dbt ? 'Diary card' : 'Feelings check-in') + '</h2>' + (filled ? '<span class="chip ok">Done today</span>' : '<span class="chip">Not yet today</span>') + '</div>' + weekDots(set) +
    '<p class="muted small">' + n + ' of the last 7 days</p><button class="btn primary" data-act="tab" data-tab="diary">' + (filled ? 'Review today' : (dbt ? 'Fill out today’s card' : 'Check in')) + '</button></section>' +
    (S.safetyOn ? '<section class="card"><h2>My safety plan</h2><p class="muted">Your plan, ready when you need it.</p><button class="btn ghost" data-act="tab" data-tab="plan">Open my plan</button></section>' : '') +
    '<section class="card"><h2>At your session</h2><p class="muted">Open the summary and show your therapist. Nothing is sent anywhere.</p><button class="btn ghost" data-act="tab" data-tab="summary">Open summary</button></section>';
}
var draft = null, draftKey = null;
function loadDraft(k) { var e = S.diary[k]; draft = e ? clone(e) : { emo: { sad: null, anx: null, ang: null, shame: null, joy: null }, urge: { harm: null, use: null, quit: null }, acted: null, skills: [], note: '' }; draftKey = k; }
function segRow(grp, k, label) {
  return '<div class="seg-row"><span class="seg-lab" id="l-' + grp + '-' + k + '">' + label + '</span><div class="seg six" role="group" aria-labelledby="l-' + grp + '-' + k + '">' + [0, 1, 2, 3, 4, 5].map(function (v) {
    return '<button data-act="dseg" data-g="' + grp + '" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + (draft[grp][k] === v) + '">' + v + '</button>';
  }).join('') + '</div></div>';
}
function concernCard() {
  return '<section class="card concern" role="status"><h2>Thanks for being honest about today.</h2><p>That sounds like a hard day. If you might act on an urge, reach out now. Call or text 988, any time.</p>' +
    '<div class="row-btns">' + (S.safetyOn ? '<button class="btn primary" data-act="tab" data-tab="plan">Open my safety plan</button>' : '') + '<button class="btn ghost" data-act="help">Get help now</button></div>' +
    '<p class="small">This app doesn’t alert anyone. Show this to your therapist at your next session.</p></section>';
}
function heatTable() {
  var days = last7();
  function cell(v, urge) {
    if (v == null) return '<td class="empty">–</td>';
    var c = urge ? 'var(--alert)' : 'var(--spruce)';
    return '<td class="' + (v >= 3 ? (urge ? 'hot-a' : 'hot') : '') + '" style="background:color-mix(in srgb, ' + c + ' ' + (v * 16) + '%, var(--card))">' + v + '</td>';
  }
  var th = '<thead><tr><th scope="col"><span class="sr">Item</span></th>' + days.map(function (d) { return '<th scope="col"><span aria-hidden="true">' + DL[d.getDay()] + '</span><span class="sr">' + fmtDay(d) + '</span></th>'; }).join('') + '</tr></thead>';
  var rows = '<tr class="grp"><th colspan="8">Emotions</th></tr>' + EMO.map(function (r) { return '<tr><th scope="row">' + r[1] + '</th>' + days.map(function (d) { var e = S.diary[dkey(d)]; return cell(e ? e.emo[r[0]] : null, false); }).join('') + '</tr>'; }).join('') +
    '<tr class="grp"><th colspan="8">Urges</th></tr>' + URGE.map(function (r) { return '<tr><th scope="row">' + r[2] + '</th>' + days.map(function (d) { var e = S.diary[dkey(d)]; return cell(e ? e.urge[r[0]] : null, true); }).join('') + '</tr>'; }).join('') +
    '<tr><th scope="row">Acted on urge</th>' + days.map(function (d) { var e = S.diary[dkey(d)]; if (!e || e.acted == null) return '<td class="empty">–</td>'; return e.acted ? '<td class="hot-a" style="background:var(--alert)">Yes</td>' : '<td>No</td>'; }).join('') + '</tr>' +
    '<tr class="grp"><th colspan="8">Skills</th></tr><tr><th scope="row">Skills used</th>' + days.map(function (d) { var e = S.diary[dkey(d)]; return e ? '<td>' + e.skills.length + '</td>' : '<td class="empty">–</td>'; }).join('') + '</tr>';
  return '<div class="tablewrap"><table class="heat">' + th + '<tbody>' + rows + '</tbody></table></div><p class="small muted">Darker cells mean higher ratings, from 0 to 5. Urges use a red scale. A dash means no card that day.</p>';
}
function tDiary() {
  if (S.tracker !== 'dbt') {
    return head('Check-in', 'How are you today?') + faceCard('How are you feeling today?', 'Pick the one that fits best.') +
      '<section class="card"><h2>This week</h2>' + faceRow(last7()) + bodyWeek(last7()) + '</section>';
  }
  var days = last7(), tk = todayKey(), k = ui.diaryDate;
  if (!k || !days.some(function (d) { return dkey(d) === k; })) k = tk;
  if (draftKey !== k) loadDraft(k);
  var saved = !!S.diary[k];
  var concern = ui.concern === k && isConcern(S.diary[k]);
  return head('Diary card', k === tk ? 'Today' : fmtDay(fromKey(k))) + (concern ? concernCard() : '') +
    '<div class="datechips" role="group" aria-label="Day">' + days.map(function (d) {
      var dk = dkey(d);
      return '<button class="datechip' + (S.diary[dk] ? ' has' : '') + '" data-act="ddate" data-k="' + dk + '" aria-pressed="' + (dk === k) + '"><span>' + (dk === tk ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })) + '</span><span class="n">' + d.getDate() + '</span></button>';
    }).join('') + '</div>' +
    '<section class="card"><h2>Emotions</h2><p class="muted small">0 means none. 5 means the most intense.</p>' + EMO.map(function (r) { return segRow('emo', r[0], r[1]); }).join('') + '</section>' +
    '<section class="card"><h2>Urges</h2><p class="muted small">0 means none. 5 means the strongest.</p>' + URGE.map(function (r) { return segRow('urge', r[0], r[1]); }).join('') +
      '<div class="seg-row"><span class="seg-lab" id="acted-l">Did you act on any urge?</span><div class="seg" style="--cols:2" role="group" aria-labelledby="acted-l"><button data-act="acted" data-v="no" aria-pressed="' + (draft.acted === false) + '">No</button><button data-act="acted" data-v="yes" aria-pressed="' + (draft.acted === true) + '">Yes</button></div></div></section>' +
    '<section class="card"><h2>Skills I used</h2><div class="picks">' + SKILLS.map(function (s) { return '<button class="pick" data-act="dskill" data-s="' + esc(s) + '" aria-pressed="' + (draft.skills.indexOf(s) > -1) + '">' + esc(s) + '</button>'; }).join('') + '</div></section>' +
    '<section class="card"><h2><label for="d-note">Anything else?</label></h2><textarea id="d-note" rows="3" maxlength="600" placeholder="Optional">' + esc(draft.note) + '</textarea></section>' +
    '<button class="btn primary block" data-act="saveDiary">' + (saved ? 'Update card' : 'Save card') + '</button>' +
    '<section class="card"><h2>My week</h2>' + heatTable() + '</section>';
}
function planHasContent() { return S.safety.some(function (t) { return (t || '').trim(); }); }
function tPlan() {
  if (ui.planEdit || !planHasContent()) {
    return head('My safety plan', 'Edit') + '<p class="lede">Type in the plan you made with your therapist. Put each idea on its own line.</p>' +
      '<form data-form="plan" class="ci-form">' + PLAN_STEPS.map(function (p, i) {
        return '<div class="ci-part"><p class="eyebrow">Step ' + (i + 1) + '</p><label class="ci-q" for="plan-' + i + '">' + p[0] + '</label><p class="small muted">' + p[1] + '</p><textarea id="plan-' + i + '" rows="3" maxlength="800">' + esc(S.safety[i]) + '</textarea></div>';
      }).join('') + '<button class="btn primary" type="submit">Save my plan</button>' + (planHasContent() ? '<button class="btn ghost" type="button" data-act="planCancel">Cancel</button>' : '') + '</form>' +
      '<h3>Crisis lines</h3>' + crisisList();
  }
  return head('My safety plan', 'Made with your therapist') + '<p class="lede">Work down the list. If one step doesn’t help, go to the next.</p>' +
    '<ol class="plan">' + PLAN_STEPS.map(function (p, i) {
      var items = (S.safety[i] || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      return '<li><div class="plan-n" aria-hidden="true">' + (i + 1) + '</div><div class="plan-b"><h2>' + p[0] + '</h2>' + (items.length ? '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted small">Nothing added yet.</p>') + (i === 4 ? crisisList() : '') + '</div></li>';
    }).join('') + '</ol><button class="btn ghost" data-act="planEdit">Edit my plan</button>';
}
function tSummary() {
  var st = stats(), d = last7(), dbt = S.tracker === 'dbt';
  var body;
  if (dbt) {
    var c = {}; d.forEach(function (x) { var e = S.diary[dkey(x)]; if (e) e.skills.forEach(function (s) { c[s] = (c[s] || 0) + 1; }); });
    var tally = Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var notes = d.map(function (x) { var e = S.diary[dkey(x)]; return e && e.note ? [x, e.note] : null; }).filter(Boolean).reverse();
    var acted = d.filter(function (x) { var e = S.diary[dkey(x)]; return e && e.acted === true; }).length;
    body = '<div class="tiles">' + tile('Cards filled', st.trackDays + '<small> / 7 days</small>', 'Diary card') + tile('Acted on an urge', String(acted), acted === 1 ? 'day' : 'days') + '</div>' +
      '<section class="card"><h2>Diary card</h2>' + heatTable() + '</section>' +
      '<section class="card"><h2>Skills used most</h2><div class="picks">' + (tally.length ? tally.slice(0, 8).map(function (t) { return '<span class="chip ok">' + esc(t[0]) + ' ×' + t[1] + '</span>'; }).join('') : '<span class="muted">None logged</span>') + '</div></section>' +
      (notes.length ? '<section class="card"><h2>My notes</h2><ul class="notelist">' + notes.map(function (x) { return '<li><span class="small muted">' + fmtDay(x[0]) + '</span><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul></section>' : '');
  } else {
    var cnt = {}; d.forEach(function (x) { var e = S.daily[dkey(x)]; if (e) cnt[e.face] = (cnt[e.face] || 0) + 1; });
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
    body = '<div class="tiles">' + tile('Check-ins', st.trackDays + '<small> / 7 days</small>', 'Feelings') + tile('Most often', top ? FACE_LABEL[top] : '–', top ? cnt[top] + ' of ' + st.trackDays + ' days' : 'No check-ins yet') + '</div>' +
      '<section class="card"><h2>My feelings this week</h2>' + faceRow(d) + bodyWeek(d) + '</section>';
  }
  return head('Summary', 'Show your therapist') + '<p class="lede">Open this at the start of your session and show your therapist. Nothing is sent anywhere.</p><p class="eyebrow">' + fmtShort(d[0]) + ' to ' + fmtShort(d[6]) + '</p>' + body;
}

/* ---------- Settings ---------- */
function settingsScreen() {
  var parent = S.mode === 'parent';
  return '<div class="scr-head"><div><p class="eyebrow">Between Sessions</p><h1>Settings</h1></div><div class="head-btns"><button class="btn ghost" data-act="closeSettings">Done</button></div></div>' +
    (parent
      ? '<section class="card"><h2>Your child</h2><form class="addrow" data-form="name"><label class="sr" for="set-name">First name or nickname</label><input id="set-name" maxlength="24" autocomplete="off" value="' + esc(S.child) + '" placeholder="First name or nickname (optional)"><button class="btn ghost" type="submit">Save</button></form></section>' +
        '<section class="card"><h2>Behaviors you track</h2><ul class="list">' + S.behaviors.map(function (b) { return '<li><span>' + esc(b.label) + '</span><button class="link danger" data-act="rmBeh" data-id="' + b.id + '" aria-label="Remove ' + esc(b.label) + '">Remove</button></li>'; }).join('') + '</ul>' +
          '<form class="addrow" data-form="addBeh"><label class="sr" for="set-beh">Add a behavior</label><input id="set-beh" maxlength="40" placeholder="Add a behavior" autocomplete="off"><button class="btn ghost" type="submit">Add</button></form>' +
          '<p class="small muted">Removing a behavior keeps what you already logged.</p></section>' +
        '<section class="card"><h2>Connection time length</h2><div class="seg" style="--cols:3" role="group" aria-label="Connection time length">' + [5, 10, 15].map(function (m) { return '<button data-act="setLen" data-m="' + m + '" aria-pressed="' + (S.connectMinutes === m) + '">' + m + ' min</button>'; }).join('') + '</div></section>'
      : '<section class="card"><h2>Daily check-in</h2><div class="seg" style="--cols:2" role="group" aria-label="Daily check-in">' + [['feelings', 'Feelings check-in'], ['dbt', 'Diary card']].map(function (x) { return '<button data-act="setTrack" data-v="' + x[0] + '" aria-pressed="' + (S.tracker === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><p class="small muted">Switching keeps what you already entered.</p></section>' +
        '<section class="card"><h2>Safety plan</h2><div class="seg" style="--cols:2" role="group" aria-label="Safety plan">' + [['on', 'Show it'], ['off', 'Hide it']].map(function (x) { return '<button data-act="setPlan" data-v="' + x[0] + '" aria-pressed="' + ((x[0] === 'on') === S.safetyOn) + '">' + x[1] + '</button>'; }).join('') + '</div><p class="small muted">Hiding it keeps what you typed.</p></section>') +
    '<section class="card"><h2>App passcode</h2>' + (hasCrypto
      ? (S.lock ? '<p class="muted">On. The app asks for it when you open it, and after a minute away.</p><div class="two"><button class="btn ghost" data-act="pinSet">Change</button><button class="btn ghost danger" data-act="pinOff">Turn off</button></div>'
                : '<p class="muted">Keeps others who pick up your phone out of the app. If you forget it, the only fix is erasing the app’s data.</p><button class="btn ghost" data-act="pinSet">Set a passcode</button>')
      : '<p class="muted">Not available in this browser.</p>') + '</section>' +
    '<section class="card"><h2>Privacy</h2><ul class="steps small"><li>Everything stays on this phone. The app doesn’t send anything anywhere.</li><li>PCIC can’t see, back up, or recover anything here.</li><li>Entries older than 90 days delete themselves.</li><li>Deleting the app, or clearing this browser’s data, erases everything.</li></ul></section>' +
    '<section class="card"><h2>Start over</h2><p class="muted">Erase everything on this phone and set the app up again.</p><button class="btn ghost danger" data-act="erase">Erase everything</button></section>' +
    '<p class="foot">Between Sessions ' + VERSION + ' · PCIC</p>';
}

/* ---------- Passcode ---------- */
function hashPin(pin, salt) {
  var data = new TextEncoder().encode(salt + ':' + pin);
  return crypto.subtle.digest('SHA-256', data).then(function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return pad(b.toString(16)); }).join(''); });
}
function keypad() {
  var k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return '<div class="keypad">' + k.map(function (x) {
    if (!x) return '<button class="kp-blank" tabindex="-1" aria-hidden="true"></button>';
    if (x === 'del') return '<button class="kp-del" data-act="key" data-k="del" aria-label="Delete">Delete</button>';
    return '<button data-act="key" data-k="' + x + '">' + x + '</button>';
  }).join('') + '</div>';
}
function pinDots() { var s = ''; for (var i = 0; i < 4; i++) s += '<span class="' + (i < ui.pin.length ? 'on' : '') + '"></span>'; return '<div class="pin-dots" aria-label="' + ui.pin.length + ' of 4 digits entered">' + s + '</div>'; }
function lockScreen() {
  if (ui.forgot) {
    return '<main class="screen-body center" id="sbody"><div class="lockbox">' + brandMark() + '<h1 class="setup-h">Forgot your passcode?</h1><p class="lede">The passcode can’t be recovered, by you or by PCIC. To keep using the app, erase everything on this phone and set it up again.</p>' +
      '<button class="btn ghost danger" data-act="erase">Erase everything</button><button class="link center" data-act="forgotBack">Go back</button></div></main>';
  }
  var wait = ui.pinWait > Date.now();
  return '<main class="screen-body center" id="sbody"><div class="lockbox">' + brandMark() + '<h1 class="setup-h">Enter passcode</h1>' + pinDots() +
    '<p class="err" id="pin-err"' + (wait ? '' : ' hidden') + '>' + (wait ? 'Too many tries. Wait 30 seconds.' : '') + '</p>' + keypad() +
    '<button class="link center" data-act="forgot">Forgot passcode?</button><button class="link center" data-act="help">Get help now</button></div></main><div class="sheet-wrap" id="sheet" hidden></div>';
}
function pinSheet() {
  var title = ui.pinMode === 'set2' ? 'Enter it again' : 'Choose a 4-digit passcode';
  return '<div class="lockbox"><h2>' + title + '</h2>' + pinDots() + '<p class="err" id="pin-err" hidden></p>' + keypad() + '<button class="btn ghost" data-act="pinCancel">Cancel</button></div>';
}
function refreshPin() { var d = $('.pin-dots'); if (d) d.outerHTML = pinDots(); }
function pinError(msg) { var e = $('#pin-err'); if (e) { e.textContent = msg; e.hidden = false; } }
function onKey(k) {
  if (ui.pinMode === 'unlock' && ui.pinWait > Date.now()) return;
  if (k === 'del') ui.pin = ui.pin.slice(0, -1); else if (ui.pin.length < 4) ui.pin += k;
  refreshPin();
  if (ui.pin.length < 4) return;
  var pin = ui.pin;
  if (ui.pinMode === 'unlock') {
    hashPin(pin, S.lock.salt).then(function (h) {
      if (h === S.lock.hash) { ui.locked = false; ui.pin = ''; ui.pinFails = 0; render(false); }
      else {
        ui.pin = ''; ui.pinFails++;
        if (ui.pinFails >= 5) { ui.pinFails = 0; ui.pinWait = Date.now() + 30000; render(false); setTimeout(function () { if (ui.locked) render(false); }, 30500); }
        else { refreshPin(); pinError('That’s not it. Try again.'); }
      }
    });
  } else if (ui.pinMode === 'set1') {
    ui.pinFirst = pin; ui.pin = ''; ui.pinMode = 'set2'; openSheet(pinSheet());
  } else if (ui.pinMode === 'set2') {
    if (pin !== ui.pinFirst) { ui.pin = ''; ui.pinFirst = ''; ui.pinMode = 'set1'; openSheet(pinSheet()); pinError('Those didn’t match. Choose one again.'); return; }
    var salt = uid() + uid();
    hashPin(pin, salt).then(function (h) { S.lock = { salt: salt, hash: h }; ui.pin = ''; ui.pinFirst = ''; ui.pinMode = 'unlock'; save(); closeSheet(); render(); toast('Passcode set.'); });
  }
}

/* ---------- Render ---------- */
function tabsFor() {
  if (S.mode === 'parent') return [['today', 'Today'], ['connect', 'Connect'], ['log', 'Log'], ['checkin', 'Check-in'], ['summary', 'Summary']];
  var t = [['today', 'Today'], ['diary', S.tracker === 'dbt' ? 'Diary card' : 'Check-in']];
  if (S.safetyOn) t.push(['plan', 'My plan']);
  t.push(['summary', 'Summary']);
  return t;
}
var SCREENS = {
  parent: { today: pToday, connect: pConnect, log: pLog, checkin: pCheckin, summary: pSummary },
  teen: { today: tToday, diary: tDiary, plan: tPlan, summary: tSummary }
};
var TAB_ICON = { today: 'today', connect: 'connect', log: 'log', checkin: 'checkin', summary: 'summary', diary: 'diary', plan: 'plan' };
var lastView = '';
function render(keep) {
  if (keep === undefined) keep = true;
  var app = $('#app'), sb = $('#sbody'), top = sb ? sb.scrollTop : 0, view;
  if (ui.locked) { app.innerHTML = lockScreen(); lastView = 'lock'; return; }
  if (!S.setupDone) { if (!ui.sd) startSetup(); app.innerHTML = setupScreen() + '<div class="toast low" id="toast" hidden></div>'; lastView = 'setup'; return; }
  var tabs = tabsFor();
  if (!tabs.some(function (t) { return t[0] === ui.tab; })) ui.tab = 'today';
  var body = ui.screen === 'settings' ? settingsScreen() : SCREENS[S.mode][ui.tab]();
  view = ui.screen === 'settings' ? 'settings' : ui.tab;
  app.innerHTML = '<main class="screen-body" id="sbody">' + body + '</main>' +
    '<nav class="tabbar" aria-label="App sections">' + tabs.map(function (t) { return '<button class="tabbtn" data-act="tab" data-tab="' + t[0] + '"' + (t[0] === ui.tab && ui.screen !== 'settings' ? ' aria-current="page"' : '') + '>' + ICON[TAB_ICON[t[0]]] + '<span>' + t[1] + '</span></button>'; }).join('') + '</nav>' +
    '<div class="toast" id="toast" hidden></div><div class="sheet-wrap" id="sheet" hidden></div>';
  var nb = $('#sbody');
  if (nb && keep && view === lastView) nb.scrollTop = top;
  lastView = view;
  if (T.pendingRate && S.mode === 'parent') { T.pendingRate = false; openRate(); }
}

/* ---------- Sheets and toasts ---------- */
var toastT = null;
function toast(msg, act) {
  var t = $('#toast'); if (!t) return;
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (act ? '<button class="toast-btn" data-act="' + act.act + '" ' + (act.attrs || '') + '>' + esc(act.label) + '</button>' : '');
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, act ? 6000 : 3200);
}
var lastFocus = null;
function openSheet(html) {
  var s = $('#sheet'); if (!s) return;
  if (s.hidden) lastFocus = document.activeElement;
  s.innerHTML = '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
  s.hidden = false;
  var f = s.querySelector('.sheet button, .sheet a'); if (f) f.focus({ preventScroll: true });
}
function closeSheet() {
  var s = $('#sheet');
  if (s && !s.hidden) { s.hidden = true; s.innerHTML = ''; if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true }); }
  if (ui.pinMode !== 'unlock') { ui.pinMode = 'unlock'; ui.pin = ''; ui.pinFirst = ''; }
}
function pressOne(t) { $$('button', t.parentElement).forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); }); }

/* ---------- Timer ---------- */
function updateTimer() {
  var l = $('#t-left'); if (!l) return;
  l.textContent = mmss(T.remaining);
  var p = $('#ring-prog'); if (p) p.style.strokeDashoffset = ringOffset();
  var s = $('#t-sub'); if (s) s.textContent = T.running ? 'Time left' : 'of ' + Math.round(T.total / 60) + ' min';
  var m = $('#t-main'); if (m) m.textContent = T.running ? 'Pause' : (T.remaining < T.total && T.remaining > 0 ? 'Resume' : 'Start');
  $$('[data-act="len"]').forEach(function (b) { b.disabled = T.running; });
}
function updateTip() { var tp = tips(), n = $('#tip-n'), tt = $('#tip-t'); if (n) n.textContent = (T.tipIdx % tp.length) + 1; if (tt) tt.textContent = tp[T.tipIdx % tp.length]; }
function tick() {
  var now = performance.now(), dt = (now - T.last) / 1000; T.last = now;
  T.remaining = Math.max(0, T.remaining - dt); T.tipElapsed += dt;
  if (T.tipElapsed >= 45) { T.tipElapsed = 0; T.tipIdx++; updateTip(); }
  updateTimer();
  if (T.remaining <= 0) {
    pauseTimer();
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    if ($('#sheet') && !ui.locked) openRate(); else T.pendingRate = true;
  }
}
function startTimer() {
  if (T.remaining <= 0) T.remaining = T.total;
  T.running = true; T.last = performance.now(); clearInterval(T.iv); T.iv = setInterval(tick, 250);
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }, function () {}); } catch (e) {}
  updateTimer();
}
function pauseTimer() { T.running = false; clearInterval(T.iv); T.iv = null; try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; updateTimer(); }
function resetTimer() { pauseTimer(); if (!T.userLen) T.total = S.connectMinutes * 60; T.remaining = T.total; T.tipElapsed = 0; }
var rateSel = null;
function elapsedMin() { var el = T.total - T.remaining; return el >= 30 ? Math.max(1, Math.round(el / 60)) : Math.round(T.total / 60); }
function openRate() {
  var min = elapsedMin(); rateSel = null;
  openSheet('<h2>How did it go?</h2><p class="muted">' + min + ' minute' + (min === 1 ? '' : 's') + ' with ' + esc(kid()) + '</p><div class="rate-row" role="group" aria-label="How it went">' + [1, 2, 3, 4, 5].map(function (v) { return '<button data-act="rate" data-v="' + v + '" aria-pressed="false">' + RATE[v] + '</button>'; }).join('') + '</div>' +
    '<p class="err" id="rate-err" hidden>Pick how it went.</p><div class="field"><label class="field-lab" for="cn-note">Anything you noticed? (optional)</label><textarea id="cn-note" rows="3" maxlength="300"></textarea></div>' +
    '<div class="sheet-actions"><button class="btn ghost" data-act="closeSheet">Not now</button><button class="btn primary" data-act="saveConnect">Save</button></div>');
}
var det = null;
function toLocalInput(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function pickGroup(id, label, hint, act, options, isOn) {
  return '<div class="field"><p class="field-lab" id="' + id + '">' + label + '</p>' + (hint ? '<p class="small muted">' + hint + '</p>' : '') +
    '<div class="picks" role="group" aria-labelledby="' + id + '">' + options.map(function (v) { return '<button class="pick" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="' + isOn(v) + '">' + esc(v) + '</button>'; }).join('') + '</div></div>';
}
function abcHead(letter, title) { return '<div class="abc-head"><span class="abc-badge" aria-hidden="true">' + letter + '</span><h3>' + title + '</h3></div>'; }
function openDetails(id) {
  var l = S.log.filter(function (x) { return x.id === id; })[0]; if (!l) return;
  det = { id: id, activity: l.activity || null, before: (l.before || []).slice(), level: l.level || null, dur: l.dur || null, after: (l.after || []).slice() };
  var other = isOther(l.lab);
  var minT = toLocalInput(addDays(today0(), -(KEEP_DAYS - 1)).getTime()), maxT = toLocalInput(Date.now());
  openSheet('<h2>' + esc(l.lab) + '</h2><p class="muted">Fill in what you remember. It’s all optional, and it helps you and your therapist spot patterns.</p>' +
    '<div class="field"><label class="field-lab" for="det-t">When did it happen?</label><input id="det-t" type="datetime-local" value="' + toLocalInput(l.ts) + '" min="' + minT + '" max="' + maxT + '"></div>' +
    abcHead('A', 'Before') +
    pickGroup('ac-l', 'What was going on?', '', 'detAct', ACTIVITIES, function (v) { return det.activity === v; }) +
    pickGroup('bf-l', 'What happened right before?', 'Pick any that fit.', 'detBf', BEFORE, function (v) { return det.before.indexOf(v) > -1; }) +
    abcHead('B', 'The behavior') +
    '<div class="field"><label class="field-lab" for="det-w">What did it look like?</label><textarea id="det-w" rows="2" maxlength="200" placeholder="' + (other ? 'For example: threw toys, ran off in the store' : 'For example: screamed and kicked the door') + '">' + esc(l.what || '') + '</textarea></div>' +
    '<div class="field"><p class="field-lab" id="lv-l">How big was it?</p><div class="seg" style="--cols:3" role="group" aria-labelledby="lv-l">' + LEVELS.map(function (v) { return '<button data-act="detLv" data-v="' + v + '" aria-pressed="' + (det.level === v) + '">' + v + '</button>'; }).join('') + '</div></div>' +
    pickGroup('du-l', 'How long did it last?', '', 'detDur', DURATIONS, function (v) { return det.dur === v; }) +
    abcHead('C', 'After') +
    pickGroup('af-l', 'What happened after?', 'Pick any that fit.', 'detAf', AFTER, function (v) { return det.after.indexOf(v) > -1; }) +
    '<div class="field"><label class="field-lab" for="det-h">Anything else?</label><textarea id="det-h" rows="2" maxlength="400" placeholder="Optional">' + esc(l.handled || '') + '</textarea></div>' +
    '<div class="sheet-actions"><button class="btn ghost danger" data-act="detDel">Delete entry</button><button class="btn primary" data-act="detSave">Save</button></div>');
  if (other) { var w = $('#det-w'); if (w) w.focus({ preventScroll: true }); }
}
function toggleOne(t, key) { var v = t.dataset.v; if (det[key] === v) { det[key] = null; t.setAttribute('aria-pressed', 'false'); } else { det[key] = v; pressOne(t); } }
function toggleMany(t, key) { var v = t.dataset.v, a = det[key], i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); t.setAttribute('aria-pressed', String(i < 0)); }
function armed(t, label) { if (t.dataset.armed) return true; t.dataset.armed = '1'; var old = t.textContent; t.textContent = label; setTimeout(function () { if (t.isConnected && t.dataset.armed) { delete t.dataset.armed; t.textContent = old; } }, 3500); return false; }
function eraseAll() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  S = blank(); ui.locked = false; ui.forgot = false; ui.screen = null; ui.tab = 'today'; ui.concern = null; ui.diaryDate = null; draft = null; draftKey = null;
  T.userLen = false; T.tipIdx = 0; resetTimer(); startSetup(); save(); render(false);
}

/* ---------- Actions ---------- */
var H = {
  tab: function (t) { ui.tab = t.dataset.tab; ui.screen = null; ui.planEdit = false; closeSheet(); render(false); var b = $('#sbody'); if (b) b.scrollTop = 0; },
  settings: function () { ui.screen = 'settings'; closeSheet(); render(false); },
  closeSettings: function () { ui.screen = null; render(false); },
  help: function () { if (!$('#sheet')) return; openSheet(helpSheet()); },
  closeSheet: function () { closeSheet(); },
  install: function () { if (!installEvt) return; installEvt.prompt(); installEvt = null; render(); },
  skipInstall: function () { S.skipInstall = true; save(); render(); },
  setupNext: function (t) {
    var to = t.dataset.to, from = ui.step;
    if (from === 'name') { var n = $('#su-name'); ui.sd.child = n ? n.value.trim().slice(0, 24) : ''; }
    if (from === 'behaviors' && to === 'length' && !ui.sd.behaviors.length) { $('#su-err').hidden = false; return; }
    ui.step = to; render(false);
  },
  setMode: function (t) { ui.sd.mode = t.dataset.v; render(); },
  suBeh: function (t) { var v = t.dataset.v, a = ui.sd.behaviors, i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); t.setAttribute('aria-pressed', String(i < 0)); var e = $('#su-err'); if (e) e.hidden = true; },
  suLen: function (t) { ui.sd.minutes = +t.dataset.m; pressOne(t); },
  suTrack: function (t) { ui.sd.tracker = t.dataset.v; pressOne(t); },
  suPlan: function (t) { ui.sd.safetyOn = t.dataset.v === 'yes'; pressOne(t); },
  finishSetup: function () {
    var sd = ui.sd;
    S.mode = sd.mode; S.setupDone = true;
    if (sd.mode === 'parent') {
      S.child = sd.child; S.connectMinutes = sd.minutes;
      var order = BEHAVIOR_CHOICES.concat(sd.behaviors.filter(function (b) { return BEHAVIOR_CHOICES.indexOf(b) < 0; }));
      S.behaviors = order.filter(function (b) { return sd.behaviors.indexOf(b) > -1; }).map(function (b) { return { id: 'b' + uid(), label: b }; });
      T.userLen = false; resetTimer();
    } else { S.tracker = sd.tracker; S.safetyOn = sd.safetyOn; }
    save(); ui.tab = (sd.mode === 'teen' && sd.safetyOn) ? 'plan' : 'today'; ui.sd = null; render(false);
    toast(S.mode === 'teen' && S.safetyOn ? 'You’re all set. Add your plan whenever you’re ready.' : 'You’re all set.');
  },
  face: function (t) {
    var tk = todayKey(), prev = S.daily[tk], k = t.dataset.k;
    S.daily[tk] = { face: k, body: prev && prev.face === k ? (prev.body || []) : [] };
    save(); render(); openBody();
  },
  bodyOpen: function () { openBody(); },
  bodyTap: function (t) { toggleBody(t.getAttribute('data-k')); },
  bodyPick: function (t) { toggleBody(t.dataset.k); },
  bodySkip: function () { var e = S.daily[todayKey()]; closeSheet(); if (e) toast('Saved: ' + FACE_LABEL[e.face] + ' today.'); },
  bodyDone: function () {
    var e = S.daily[todayKey()]; if (!e) { closeSheet(); return; }
    e.body = bodyOrder(bodySel); save(); closeSheet(); render();
    toast(e.body.length && e.body[0] !== 'none' ? 'Saved: ' + FACE_LABEL[e.face] + ' (' + bodyText(e.body).toLowerCase() + ').' : 'Saved: ' + FACE_LABEL[e.face] + ' today.');
  },
  quicklog: function (t) {
    var b = S.behaviors.filter(function (x) { return x.id === t.dataset.b; })[0]; if (!b) return;
    var e = { id: 'x' + uid(), ts: Date.now(), b: b.id, lab: b.label, level: null, before: [], handled: '' };
    S.log.push(e); save(); render();
    if (isOther(b.label)) { openDetails(e.id); return; }
    toast('Logged ' + b.label + ' at ' + fmtTime(e.ts) + '.', { act: 'details', label: 'Add details', attrs: 'data-id="' + e.id + '"' });
  },
  details: function (t) { var tt = $('#toast'); if (tt) tt.hidden = true; openDetails(t.dataset.id); },
  detAct: function (t) { toggleOne(t, 'activity'); },
  detBf: function (t) { toggleMany(t, 'before'); },
  detLv: function (t) { toggleOne(t, 'level'); },
  detDur: function (t) { toggleOne(t, 'dur'); },
  detAf: function (t) { toggleMany(t, 'after'); },
  detSave: function () {
    var l = S.log.filter(function (x) { return x.id === det.id; })[0], moved = null;
    if (l) {
      var tv = ($('#det-t') || {}).value, nt = tv ? new Date(tv).getTime() : NaN;
      var floor = addDays(today0(), -(KEEP_DAYS - 1)).getTime();
      if (!isNaN(nt) && nt <= Date.now() + 60000 && nt >= floor && Math.abs(nt - l.ts) >= 60000) {
        if (dkey(new Date(nt)) !== dkey(new Date(l.ts))) moved = dayLabel(dkey(new Date(nt)));
        l.ts = nt;
      }
      l.activity = det.activity; l.before = det.before.slice(); l.level = det.level; l.dur = det.dur; l.after = det.after.slice();
      l.what = ($('#det-w').value || '').trim(); l.handled = ($('#det-h').value || '').trim();
    }
    save(); closeSheet(); render(); toast(moved ? 'Saved under ' + moved + '.' : 'Details saved.');
  },
  abcAll: function () { ui.abcAll = !ui.abcAll; render(); },
  detDel: function (t) { if (!armed(t, 'Tap again to delete')) return; S.log = S.log.filter(function (x) { return x.id !== det.id; }); save(); closeSheet(); render(); toast('Entry deleted.'); },
  len: function (t) { if (T.running) return; T.total = T.remaining = +t.dataset.m * 60; T.userLen = true; render(); },
  tstart: function () { if (T.running) pauseTimer(); else startTimer(); },
  tdone: function () { pauseTimer(); openRate(); },
  nexttip: function () { T.tipIdx++; T.tipElapsed = 0; updateTip(); },
  rate: function (t) { rateSel = +t.dataset.v; pressOne(t); var e = $('#rate-err'); if (e) e.hidden = true; },
  saveConnect: function () {
    if (!rateSel) { var e = $('#rate-err'); if (e) e.hidden = false; return; }
    S.connect.push({ d: todayKey(), min: elapsedMin(), rating: rateSel, note: ($('#cn-note').value || '').trim() });
    save(); resetTimer(); closeSheet(); render(); toast('Saved. ' + stats().connectDays + ' of the last 7 days.');
  },
  ciEdit: function () { ui.ciEdit = true; render(); },
  ddate: function (t) { ui.diaryDate = t.dataset.k; ui.concern = null; draftKey = null; render(); },
  dseg: function (t) { draft[t.dataset.g][t.dataset.k] = +t.dataset.v; pressOne(t); },
  acted: function (t) { draft.acted = t.dataset.v === 'yes'; pressOne(t); },
  dskill: function (t) { var s = t.dataset.s, i = draft.skills.indexOf(s); if (i < 0) draft.skills.push(s); else draft.skills.splice(i, 1); t.setAttribute('aria-pressed', String(i < 0)); },
  saveDiary: function () {
    draft.note = ($('#d-note').value || '').trim(); S.diary[draftKey] = clone(draft);
    var c = isConcern(draft); ui.concern = c ? draftKey : null; save(); render();
    if (c) { var b = $('#sbody'); if (b) b.scrollTop = 0; } else toast('Saved.');
  },
  planEdit: function () { ui.planEdit = true; render(false); },
  planCancel: function () { ui.planEdit = false; render(false); },
  rmBeh: function (t) { if (S.behaviors.length <= 1) { toast('Keep at least one behavior.'); return; } S.behaviors = S.behaviors.filter(function (b) { return b.id !== t.dataset.id; }); save(); render(); toast('Removed.'); },
  setLen: function (t) { S.connectMinutes = +t.dataset.m; if (!T.running) { T.userLen = false; T.total = T.remaining = S.connectMinutes * 60; } save(); pressOne(t); toast('Connection time set to ' + S.connectMinutes + ' minutes.'); },
  setTrack: function (t) { S.tracker = t.dataset.v; save(); pressOne(t); render(); },
  setPlan: function (t) { S.safetyOn = t.dataset.v === 'on'; save(); render(); toast(S.safetyOn ? 'Your plan is in the tab bar.' : 'Plan hidden.'); },
  pinSet: function () { ui.pinMode = 'set1'; ui.pin = ''; ui.pinFirst = ''; openSheet(pinSheet()); },
  pinCancel: function () { closeSheet(); },
  pinOff: function (t) { if (!armed(t, 'Tap again')) return; S.lock = null; save(); render(); toast('Passcode turned off.'); },
  key: function (t) { onKey(t.dataset.k); },
  forgot: function () { ui.forgot = true; render(false); },
  forgotBack: function () { ui.forgot = false; render(false); },
  erase: function (t) { if (!armed(t, 'Tap again to erase everything')) return; eraseAll(); }
};
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]'); if (!t) return;
  var fn = H[t.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(t, e);
});
document.addEventListener('submit', function (e) {
  var form = e.target.closest('[data-form]'); if (!form) return; e.preventDefault();
  var kind = form.dataset.form;
  if (kind === 'checkin') {
    var mon = mondayOf(today0()), wk = dkey(mon);
    var v = { a: ($('#ci-a').value || '').trim(), c: ($('#ci-c').value || '').trim(), p: ($('#ci-p').value || '').trim() };
    if (!v.a && !v.c && !v.p) { $('#ci-err').hidden = false; return; }
    S.checkins[wk] = { q: (S.checkins[wk] && S.checkins[wk].q) || qsetFor(mon), a: v.a, c: v.c, p: v.p, at: Date.now() };
    ui.ciEdit = false; save(); render(); var b = $('#sbody'); if (b) b.scrollTop = 0; toast('Saved. Show it at your next session.');
  } else if (kind === 'suAddBeh') {
    var inp = $('#su-beh'), val = (inp.value || '').trim(); if (!val) return;
    if (ui.sd.behaviors.indexOf(val) < 0) ui.sd.behaviors.push(val);
    render(); var ni = $('#su-beh'); if (ni) ni.focus();
  } else if (kind === 'addBeh') {
    var bi = $('#set-beh'), bv = (bi.value || '').trim(); if (!bv) return;
    S.behaviors.push({ id: 'b' + uid(), label: bv }); save(); render(); var nb = $('#set-beh'); if (nb) nb.focus(); toast('Added.');
  } else if (kind === 'name') {
    S.child = ($('#set-name').value || '').trim().slice(0, 24); save(); render(); toast('Saved.');
  } else if (kind === 'plan') {
    S.safety = PLAN_STEPS.map(function (p, i) { var el = $('#plan-' + i); return el ? el.value.slice(0, 800) : ''; });
    ui.planEdit = false; save(); render(false); toast('Plan saved.');
  }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
// The app frame never scrolls; only the screen and sheets inside it do. Undo any shift a browser makes (for example when the keyboard opens).
(function () { var a = $('#app'); if (a) a.addEventListener('scroll', function () { if (a.scrollTop || a.scrollLeft) { a.scrollTop = 0; a.scrollLeft = 0; } }); })();
window.addEventListener('scroll', function () { if (window.scrollY && !document.activeElement.matches('input, textarea')) window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') { ui.hiddenAt = Date.now(); return; }
  if (S.lock && !ui.locked && ui.hiddenAt && Date.now() - ui.hiddenAt > 60000) { ui.locked = true; ui.pin = ''; ui.pinMode = 'unlock'; render(false); return; }
  if (T.running) { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }, function () {}); } catch (err) {} }
});

/* ---------- Offline support (only when installed from its own website) ---------- */
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}

render(false);
})();
