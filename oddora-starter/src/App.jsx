import React, { Component, useEffect, useRef, useState } from "react";
import {
  Share2, RotateCcw, Bot, Users, Send,
  Zap, Check, Copy, Trophy, X, Inbox, ArrowRight, ArrowLeft, Maximize2, Radio
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, onValue, push, ref, runTransaction, set } from "firebase/database";

/* ============================================================================
   0. SAFE STORAGE, CANVAS POLYFILL, FULLSCREEN & POPPY SOUND ENGINE
============================================================================ */
function safeGetStorage(key, fallback = "") {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function drawRoundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

let sharedAudioCtx = null;

async function playPopSound(kind = "tap") {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === "suspended") await sharedAudioCtx.resume();

    const bank = {
      tap: [{ f: 620, d: 0.055, v: 0.12, w: "triangle", slide: 900 }],
      seal: [
        { f: 340, d: 0.08, v: 0.14, w: "sine", slide: 760 },
        { f: 880, d: 0.14, v: 0.14, w: "triangle", delay: 0.06, slide: 1180 }
      ],
      dodge: [
        { f: 300, d: 0.08, v: 0.13, w: "sine", slide: 720 },
        { f: 760, d: 0.07, v: 0.09, w: "triangle", delay: 0.05, slide: 500 }
      ],
      win: [
        { f: 523.25, d: 0.11, v: 0.14, w: "triangle" },
        { f: 659.25, d: 0.11, v: 0.14, w: "triangle", delay: 0.08 },
        { f: 783.99, d: 0.13, v: 0.15, w: "triangle", delay: 0.16 },
        { f: 1046.5, d: 0.3, v: 0.16, w: "sine", delay: 0.24 }
      ],
      prank: [
        { f: 440, d: 0.14, v: 0.13, w: "sawtooth", slide: 380 },
        { f: 360, d: 0.18, v: 0.13, w: "sawtooth", delay: 0.13, slide: 240 }
      ],
      notify: [
        { f: 880, d: 0.1, v: 0.14, w: "sine" },
        { f: 1174.66, d: 0.2, v: 0.15, w: "triangle", delay: 0.09 }
      ]
    };

    const notes = bank[kind] || bank.tap;
    const now = sharedAudioCtx.currentTime + 0.01;
    notes.forEach(n => {
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      const start = now + (n.delay || 0);
      osc.type = n.w;
      osc.frequency.setValueAtTime(n.f, start);
      if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, start + n.d);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(n.v, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    });
  } catch {}
}

function triggerHaptic(pattern = 14) {
  try {
    if (navigator?.userActivation && !navigator.userActivation.hasBeenActive) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

function fx(soundKind = "tap", hapticPattern = 14) {
  playPopSound(soundKind);
  triggerHaptic(hapticPattern);
}

function requestAppFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  } catch {}
}

function focusScrollCenter(e) {
  try {
    setTimeout(() => {
      e?.target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
  } catch {}
}

/* ============================================================================
   1. ERROR BOUNDARY
============================================================================ */
class SafeBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errMsg: error?.message || "Display error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="pop-fallback">
          <span className="pop-pill-black">⚡ ODDORA</span>
          <h2>Quick Refresh Needed</h2>
          <p>{this.state.errMsg}</p>
          <button type="button" className="pop-btn yellow" onClick={() => window.location.reload()}>
            Reload ODDORA
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================================
   2. CONFETTI OVERLAY + CHARACTER STICKERS + SHARE BAR
============================================================================ */
function ConfettiRain() {
  const colors = ["#FFD166", "#FF5A5F", "#A3E635", "#3B82F6", "#FF7AB8"];
  return (
    <div className="pop-confetti-layer" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, i) => (
        <span
          key={i}
          className="pop-confetti-piece"
          style={{
            left: `${(i * 4.7) % 98}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.25}s`,
            animationDuration: `${1.9 + (i % 4) * 0.35}s`
          }}
        />
      ))}
    </div>
  );
}

function PopCharacterArt({ variant = "lime" }) {
  if (variant === "crush" || variant === "pink") {
    return (
      <svg viewBox="0 0 160 120" className="pop-char-svg" aria-hidden="true">
        <circle cx="80" cy="60" r="46" fill="#FFD166" stroke="#14141A" strokeWidth="3.5" />
        <path d="M56 52 C56 45 65 45 65 52 C65 45 74 45 74 52 C74 60 65 66 65 66 C65 66 56 60 56 52 Z" fill="#FF3B5C" stroke="#14141A" strokeWidth="2" />
        <path d="M86 52 C86 45 95 45 95 52 C95 45 104 45 104 52 C104 60 95 66 95 66 C95 66 86 60 86 52 Z" fill="#FF3B5C" stroke="#14141A" strokeWidth="2" />
        <path d="M66 78 Q80 92 94 78" fill="none" stroke="#14141A" strokeWidth="4" strokeLinecap="round" />
        <text x="16" y="34" fontSize="20">💘</text>
        <text x="124" y="36" fontSize="20">✨</text>
      </svg>
    );
  }
  if (variant === "ldr" || variant === "cyan") {
    return (
      <svg viewBox="0 0 160 120" className="pop-char-svg" aria-hidden="true">
        <circle cx="80" cy="62" r="42" fill="#3B82F6" stroke="#14141A" strokeWidth="3.5" />
        <ellipse cx="80" cy="62" rx="58" ry="18" fill="none" stroke="#FFD166" strokeWidth="4" transform="rotate(-16 80 62)" />
        <circle cx="68" cy="56" r="5" fill="#14141A" />
        <circle cx="92" cy="56" r="5" fill="#14141A" />
        <path d="M70 72 Q80 82 90 72" fill="none" stroke="#14141A" strokeWidth="3.5" strokeLinecap="round" />
        <text x="18" y="32" fontSize="20">✈️</text>
        <text x="124" y="96" fontSize="20">🌍</text>
      </svg>
    );
  }
  if (variant === "bestie" || variant === "gold") {
    return (
      <svg viewBox="0 0 160 120" className="pop-char-svg" aria-hidden="true">
        <polygon points="40,86 50,36 74,58 80,26 86,58 110,36 120,86" fill="#FFD166" stroke="#14141A" strokeWidth="3.5" strokeLinejoin="round" />
        <rect x="40" y="88" width="80" height="14" rx="7" fill="#FF5A5F" stroke="#14141A" strokeWidth="3.5" />
        <circle cx="50" cy="34" r="6" fill="#3B82F6" stroke="#14141A" strokeWidth="2.5" />
        <circle cx="80" cy="24" r="6" fill="#A3E635" stroke="#14141A" strokeWidth="2.5" />
        <circle cx="110" cy="34" r="6" fill="#FF5A5F" stroke="#14141A" strokeWidth="2.5" />
        <text x="16" y="52" fontSize="18">🔥</text>
        <text x="126" y="52" fontSize="18">👑</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 120" className="pop-char-svg" aria-hidden="true">
      <circle cx="80" cy="62" r="44" fill="#A3E635" stroke="#14141A" strokeWidth="3.5" />
      <rect x="46" y="48" width="28" height="16" rx="4" fill="#14141A" />
      <rect x="86" y="48" width="28" height="16" rx="4" fill="#14141A" />
      <line x1="74" y1="54" x2="86" y2="54" stroke="#14141A" strokeWidth="4" />
      <line x1="51" y1="52" x2="60" y2="52" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="91" y1="52" x2="100" y2="52" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M64 78 Q80 92 96 76" fill="none" stroke="#14141A" strokeWidth="4" strokeLinecap="round" />
      <text x="16" y="36" fontSize="20">🍕</text>
      <text x="124" y="96" fontSize="20">💸</text>
    </svg>
  );
}

function UniversalShareBar({ url, shareText, title = "ODDORA Link" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    fx("tap", 14);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleNativeShare() {
    fx("tap", 14);
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${shareText}\n${url}`, url });
      } else {
        handleCopy();
      }
    } catch {}
  }

  function handleWhatsApp() {
    fx("tap", 14);
    const full = `${shareText}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="pop-share-bar">
      <button type="button" className="pop-btn white sm" onClick={handleCopy}>
        {copied ? <><Check size={15}/> Copied</> : <><Copy size={15}/> Copy</>}
      </button>
      <button type="button" className="pop-btn blue sm" onClick={handleNativeShare}>
        <Share2 size={15}/> Share
      </button>
      <button type="button" className="pop-btn green sm" onClick={handleWhatsApp}>
        💬 WhatsApp
      </button>
    </div>
  );
}

/* ============================================================================
   3. QUICK SPARKS, LANGUAGE DETECTOR & CONTEXT-AWARE MULTILINGUAL GENERATOR
============================================================================ */
const TRAP_SPARKS = [
  { id: "treat", tag: "🍕 Treat Trap", cardColor: "lime", title: "You owe me food today 🍕", yesLabel: "Fine, I'll pay 💸", noLabel: "No", yesMessage: "Screenshot locked! See you at the food spot 🍕🔥" },
  { id: "crush", tag: "💘 Coffee Date", cardColor: "pink", title: "Coffee & late drive tonight? ☕", yesLabel: "Lock it in 💘", noLabel: "No", yesMessage: "It's a date! Send your location ✨🚗" },
  { id: "fight", tag: "🥊 Fight Dare", cardColor: "gold", title: "Sandaiku va, sandaiku va da 🔥", yesLabel: "Bring it on 🥊", noLabel: "No", yesMessage: "Showdown locked! Loser buys biryani 🍗🔥" },
  { id: "ldr", tag: "🌍 Miss Me?", cardColor: "cyan", title: "Admit you miss me right now 👀", yesLabel: "100% Yes 🥺", noLabel: "No", yesMessage: "Caught in 4K! FaceTime tonight 🌍💞" }
];

const TRICK_SPARKS = [
  { id: "pink", label: "💘 Crush", defaultQ: "Will you go on a date with me? 💘" },
  { id: "lime", label: "🥊 Fight / Funny", defaultQ: "Sandaiku va, sandaiku va da 🔥" },
  { id: "cyan", label: "🌍 Long Distance", defaultQ: "Next time we meet, whole day is mine? 🌍" },
  { id: "gold", label: "👑 Bestie", defaultQ: "Best friends for life—no take-backs? 👑" }
];

const TALKING_NO_EN = ["Catch me 👀", "Too slow 😜", "Almost! 🏃‍♂️", "Okay fine..."];
const TALKING_NO_TA = ["Vandhu thodu 👀", "Mudinja va 🔥", "Ayyo miss! 😂", "Seri okay..."];
const SENDER_QUICK_REPLIES = ["Caught in 4K 📸", "Treat locked 🍕", "Haha gotcha 😂", "No take-backs! ⚡"];
const DUEL_TAUNTS = ["Too slow 💀", "Sweating? 😅", "Calculated 🧠", "Rematch rn 🔥"];
const XO_WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const HEART_CHOICES = ["❤️", "💖", "💜", "💙", "💚", "💛", "🧡", "🩷", "🤍"];

function isTamilOrTanglish(text = "") {
  const s = String(text || "");
  if (/[\u0B80-\u0BFF]/.test(s)) return true;
  if (/\b(da|di|va|vaa|vaada|venam|vendam|mudiyadhu|mudinja|pudichiruka|pudikuma|saapda|sapda|saapadu|sapadu|polama|pogalama|povoma|varriya|variya|sandai|machan|machi|mapla|mappillai|nanba|thala|unga|ungaluku|enna|ena|illa|aama|seri|vaangi|tharen|thariya|panra|pannuveenga|idhu|nalla|iruku|sollu|padam|padathuku|sarakku|ennudhu|unnodadhu|unaku|enaku|kodu|kudupa|vaanga|ponga)\b/i.test(s)) {
    return true;
  }
  return /(lama|viya|riya|veenga|duven|poren|varen|kitta|iruku|aagum)\b/i.test(s);
}

function generateWarmupQuestions(mainQuestion, themeId, variantIndex = 0) {
  const q = String(mainQuestion || "").toLowerCase();
  const tanglish = isTamilOrTanglish(q);

  // Context-aware pools — NEVER gives romantic options to a website/app/general question!
  const pools = {
    website: tanglish ? [
      [
        { q: "1. First impression-la idhu epdi iruku?", options: ["Semma clean-a iruku 🔥", "Konjam vibe-a iruku 👀", "Paathutu solren 😎"] },
        { q: "2. Friends group-la share panna worth-ah?", options: ["100% Share pannuven 🚀", "Kandippa prank pannuven 😂", "First naane try panren ⚡"] }
      ]
    ] : [
      [
        { q: "1. Honest first impression of this?", options: ["Super clean & fun 🔥", "Actually pretty cool 👀", "Let me test more 😎"] },
        { q: "2. Would you drop this in your group chat?", options: ["100% Yes 🚀", "Only to prank friends 😂", "Already thinking who 👀"] }
      ]
    ],
    fight: tanglish ? [
      [
        { q: "1. Indha sandaiku unoda weapon enna?", options: ["Sarcasm & Roasts 💀", "Odi poiduven 🏃‍♂️", "Biryani vaangi tharen 🍗"] },
        { q: "2. Honest-a sollu, eppovum yaar win pannuva?", options: ["Obviously Naan dhaan 👑", "Nee (cheating panni) 🙄", "50-50 Chaos 🤝"] }
      ]
    ] : [
      [
        { q: "1. Pick your weapon for this showdown:", options: ["Sarcasm & Roasts 💀", "Running away fast 🏃‍♂️", "Buying me biryani 🍗"] },
        { q: "2. Honestly, who wins 99% of our fights?", options: ["Obviously Me 👑", "You (by cheating) 🙄", "50-50 Chaos 🤝"] }
      ]
    ],
    food: tanglish ? [
      [
        { q: "1. Ippo treat-na unoda first choice enna?", options: ["Biryani / Shawarma 🍗", "Pizza & Fries 🍕", "Cold Coffee & Snacks ☕"] },
        { q: "2. Bill varumbodhu nee enna pannuva?", options: ["GPay ready-a irukkum 💸", "Phone silent poiduven 😂", "Split pannikalam 🤝"] }
      ]
    ] : [
      [
        { q: "1. What's the #1 craving right now?", options: ["Pizza / Burgers 🍕", "Biryani feast 🍗", "Iced coffee & dessert ☕"] },
        { q: "2. When the bill arrives, you usually:", options: ["Pay like a boss 💸", "Pretend to check phone 😂", "Rock-paper-scissors ✌️"] }
      ]
    ],
    marry: [
      [
        { q: "1. What's our #1 superpower as a duo?", options: ["Non-stop laughs 😂", "Surviving any chaos 🔥", "Reading each other's mind 🧠"] },
        { q: "2. Ready for lifetime unlimited food dates?", options: ["Born ready 🍕", "Only if you pay 💸", "100% Yes 💍"] }
      ]
    ],
    date: [
      [
        { q: "1. Ideal vibe for hanging out tonight?", options: ["Iced coffee + long drive ☕", "Street food hopping 🌮", "Late-night playlist & chill 🎧"] },
        { q: "2. Be honest—how fast do you get ready?", options: ["10 mins flat ⚡", "Fashionably late 😎", "Depends on the person 👀"] }
      ]
    ],
    ldr: [
      [
        { q: "1. Hardest part about being miles apart?", options: ["Missing you 🌙", "Can't steal your food 🍟", "Counting days till we meet ✈️"] },
        { q: "2. First thing when we finally link up?", options: ["Long drive 🚗", "Non-stop food tour 🍕", "Hours of talking 💜"] }
      ]
    ],
    bestie: [
      [
        { q: "1. Who brings 90% of the chaotic energy?", options: ["Definitely You 😎", "100% Me 👑", "50-50 Partners in Crime 🤝"] },
        { q: "2. Rule #1 of this friendship:", options: ["Never snitch 🔒", "Always share food 🍟", "Roast each other daily 💀"] }
      ]
    ],
    general: tanglish ? [
      [
        { q: "1. Honest-a answer pannuviya?", options: ["100% Honest-a solren 💯", "Question paathutu solren 👀", "No tension, kelunga ⚡"] },
        { q: "2. Ready-ah? Next dhaan main question!", options: ["Ready, drop it 🔥", "Konjam bayama iruku 😅", "Bring it on 😎"] }
      ]
    ] : [
      [
        { q: "1. Promise to answer 100% honestly?", options: ["100% Honest 💯", "Depends on the question 👀", "No fear, ask away ⚡"] },
        { q: "2. Ready? Next card is the real question!", options: ["Drop it 🔥", "Slightly nervous 😅", "Bring it on 😎"] }
      ]
    ]
  };

  let bucket = "general";
  if (/(website|app|site|link|design|ui|ux|project|product|share|pudichiruka|pudikuma|feedback)/i.test(q)) bucket = "website";
  else if (/(sandai|fight|clash|va da|vaada|beat|roast|challenge|dare|risk|bet)/i.test(q)) bucket = "fight";
  else if (/(food|treat|pizza|biryani|shawarma|pay|gpay|money|saapda|sapda|saapadu|sapadu|tiffin|lunch|dinner|breakfast|snacks|hotel|restaurant|bill|coffee|tea|tea shop)/i.test(q)) bucket = "food";
  else if (/(marry|wedding|kalyanam|shaadi|wife|husband|forever)/i.test(q)) bucket = "marry";
  else if (/(date|crush|love|valentine|propose|drive|hangout)/i.test(q)) bucket = "date";
  else if (/(miss|distance|meet|flight|london|usa|uk|airport)/i.test(q)) bucket = "ldr";
  else if (/(bestie|friend|bro|brother|machan|machi|nanba|duo)/i.test(q)) bucket = "bestie";
  else if (!q.trim()) {
    if (themeId === "pink") bucket = "date";
    else if (themeId === "lime") bucket = "fight";
    else if (themeId === "cyan") bucket = "ldr";
    else if (themeId === "gold") bucket = "bestie";
  }

  const list = pools[bucket] || pools.general;
  return list[variantIndex % list.length];
}

function generateSmartOutcomes(questionText, senderName) {
  const q = String(questionText || "").toLowerCase();
  const from = (senderName || "your friend").trim();

  if (/(website|app|site|link|design|ui|ux|project|pudichiruka|pudikuma)/i.test(q)) {
    return {
      yesMsg: `Awesome! ${from} is pumped you loved it — screenshot & share! ⚡🔥`,
      noTwist: `😂 GOTCHA! ${from} caught you trying to say No — honest review locked 💀`
    };
  }
  if (/(sandai|fight|clash|va da|vaada|beat|roast)/i.test(q)) {
    return {
      yesMsg: `Challenge accepted! ${from} is officially ready for the showdown 🔥🥊`,
      noTwist: `😂 CHICKENED OUT! ${from} caught you backing down—screenshot saved 💀🐔`
    };
  }
  if (/(marry|wedding|kalyanam|shaadi)/i.test(q)) {
    return {
      yesMsg: `I said YES to ${from}! Wedding bells & lifetime food dates locked in 💍✨`,
      noTwist: `😂 OD TRICK! Relax—you just got pranked by ${from}! Screenshot saved 💀💍`
    };
  }
  if (/(food|treat|pizza|biryani|shawarma|pay|gpay|money|saapda|sapda|saapadu|sapadu|tiffin|lunch|dinner|breakfast|snacks|hotel|bill|coffee)/i.test(q)) {
    return {
      yesMsg: `Deal locked! Screenshot saved—${from} is officially waiting for that treat 🍕💸`,
      noTwist: `😂 OD TRICK! Relax—pranked by ${from}! You dodged the bill, not the screenshot 💀`
    };
  }
  if (/(miss|distance|meet|call|video|london|usa|uk|chennai|flight)/i.test(q)) {
    return {
      yesMsg: `Accepted! Distance means nothing—call & meetup locked in with ${from} 🌍💞`,
      noTwist: `😂 GOTCHA! Pranked by ${from}! Nice try pressing No—you still miss me though 👀🌍`
    };
  }
  return {
    yesMsg: `Locked in with ${from}! Screenshot saved — no take-backs ⚡✨`,
    noTwist: `😂 OD TRICK! Relax, you just got pranked by ${from}! Caught in an ODDORA trick 💀`
  };
}

// Optional Cloudflare Worker + Gemini AI call (if VITE_ODDORA_AI_URL is configured), instant smart fallback otherwise
async function fetchAIWarmups(mainQuestion, themeId, variantIndex) {
  const endpoint = import.meta?.env?.VITE_ODDORA_AI_URL;
  if (endpoint && mainQuestion.trim().length > 3) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ question: mainQuestion.trim() })
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.questions) && json.questions.length >= 2) {
          return json.questions.slice(0, 2);
        }
      }
    } catch {}
  }
  return generateWarmupQuestions(mainQuestion, themeId, variantIndex);
}

/* ============================================================================
   4. COLLECTIBLE POP-ART STORY RECEIPT GENERATOR (1080x1350)
============================================================================ */
async function createCollectibleReceipt({ badge, headline, subline, statPill, quote, sender, recipient, cardColor = "lime", footerUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const palettes = {
    lime: { bg: "#A3E635", card: "#FFF8EE", accent: "#FFD166", pill: "#FF5A5F", emoji: "😎" },
    pink: { bg: "#FF5A5F", card: "#FFF8EE", accent: "#FF7AB8", pill: "#3B82F6", emoji: "😍" },
    cyan: { bg: "#3B82F6", card: "#FFF8EE", accent: "#67E8F9", pill: "#FF5A5F", emoji: "🌍" },
    gold: { bg: "#FFD166", card: "#FFF8EE", accent: "#A3E635", pill: "#FF5A5F", emoji: "👑" }
  };
  const pal = palettes[cardColor] || palettes.lime;

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = "rgba(20, 20, 26, 0.14)";
  for (let x = 32; x < 1060; x += 38) {
    for (let y = 32; y < 1330; y += 38) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#14141A";
  drawRoundRect(ctx, 78, 84, 944, 1200, 42);
  ctx.fill();

  ctx.fillStyle = pal.card;
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 8;
  drawRoundRect(ctx, 58, 64, 944, 1200, 42);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#14141A";
  drawRoundRect(ctx, 96, 102, 868, 68, 20);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#FFD166";
  ctx.font = "800 24px 'DM Mono', monospace";
  ctx.fillText(`⚡ ODDORA · ${badge.toUpperCase()}`, 124, 144);

  ctx.textAlign = "right";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 22px 'DM Mono', monospace";
  ctx.fillText(`${String(sender || "FRIEND").toUpperCase()} → ${String(recipient || "YOU").toUpperCase()}`, 936, 144);

  ctx.save();
  ctx.translate(530, 315);
  ctx.fillStyle = pal.accent;
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 5;
  const spikes = 16;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const rad = i % 2 === 0 ? 155 : 112;
    const ang = (i * Math.PI) / spikes;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pal.bg;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "112px Arial";
  ctx.fillText(pal.emoji, 0, 38);
  ctx.restore();

  ctx.save();
  ctx.translate(530, 520);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#14141A";
  drawRoundRect(ctx, -425, -56, 850, 112, 24);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFD166";
  ctx.font = "800 54px 'Space Grotesk', sans-serif";
  ctx.fillText(String(headline || "LOCKED IN!").toUpperCase().slice(0, 22), 0, 19);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#14141A";
  ctx.font = "800 34px 'Space Grotesk', sans-serif";
  ctx.fillText(String(subline || "").slice(0, 44), 530, 642);

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 5;
  drawRoundRect(ctx, 110, 682, 840, 165, 24);
  ctx.fill();
  ctx.stroke();

  const drawWrapped = (text, startY, maxWidth, lh, font, color) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const wList = String(text || "").split(" ");
    let line = "";
    let yy = startY;
    for (const w of wList) {
      const test = `${line} ${w}`.trim();
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 530, yy);
        line = w;
        yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, 530, yy);
  };
  drawWrapped(`“${quote || "DO OD!"}”`, 752, 780, 44, "700 31px 'Space Grotesk', sans-serif", "#14141A");

  if (statPill) {
    ctx.save();
    ctx.translate(530, 945);
    ctx.rotate(0.025);
    ctx.fillStyle = "#14141A";
    drawRoundRect(ctx, -372, -46, 756, 98, 24);
    ctx.fill();

    ctx.fillStyle = pal.pill;
    ctx.strokeStyle = "#14141A";
    ctx.lineWidth = 6;
    drawRoundRect(ctx, -380, -54, 756, 98, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 38px 'Space Grotesk', sans-serif";
    ctx.fillText(statPill, 0, 11);
    ctx.restore();
  }

  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(100, 1055);
  ctx.lineTo(960, 1055);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#14141A";
  drawRoundRect(ctx, 96, 1085, 868, 138, 24);
  ctx.fill();

  ctx.fillStyle = "#A3E635";
  ctx.font = "800 30px 'Space Grotesk', sans-serif";
  ctx.fillText(`TRY OUT ODDORA · ${String(recipient || "SOMEONE").toUpperCase()} TRIED IT!`, 530, 1144);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 25px 'DM Mono', monospace";
  ctx.fillText(`Make your own link in 10s → ${footerUrl}`, 530, 1192);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Blob failed");
  return new File([blob], "oddora-card.png", { type: "image/png" });
}

/* ============================================================================
   5. REUSABLE 📡 LIVE RADAR + 2-WAY SENDER REPLY PANEL
============================================================================ */
function LiveRadarPanel({ code, recipientName, senderName }) {
  const [events, setEvents] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sentFlash, setSentFlash] = useState("");

  useEffect(() => {
    if (!code) return undefined;
    let initialCount = -1;
    return onValue(
      ref(database, `live/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        if (initialCount !== -1 && list.length > initialCount) {
          fx("notify", [35, 50, 35]);
        }
        initialCount = list.length;
        setEvents(list.reverse());
      },
      () => {}
    );
  }, [code]);

  function sendLiveReply(textToSend) {
    const clean = String(textToSend || "").trim().slice(0, 120);
    if (!clean || !code) return;
    fx("tap", 14);
    setReplyText("");
    setSentFlash(`Sent: “${clean}” ✓`);
    setTimeout(() => setSentFlash(""), 2600);
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `senderReplies/${code}`), {
        from: senderName || "Your friend",
        text: clean,
        ts: Date.now()
      }).catch(() => {});
      push(ref(database, `live/${code}`), {
        msg: `📤 You replied: “${clean}”`,
        ts: Date.now()
      }).catch(() => {});
    });
  }

  return (
    <div className="pop-radar-box">
      <div className="pop-radar-head">
        <span className="pop-radar-dot" />
        📡 LIVE RADAR · WATCHING {String(recipientName || "FRIEND").toUpperCase()}
      </div>

      <div className="pop-radar-feed">
        {events.length === 0 ? (
          <div className="pop-radar-event">⏳ Waiting for {recipientName || "them"} to open your link...</div>
        ) : (
          events.map((ev, idx) => (
            <div className="pop-radar-event" key={idx}>{ev.msg}</div>
          ))
        )}
      </div>

      {/* 2-Way Live Reply back to Receiver! */}
      <div className="pop-radar-reply-wrap">
        <div className="pop-chips-row">
          {SENDER_QUICK_REPLIES.map(chip => (
            <button
              key={chip}
              type="button"
              className="pop-chip dark-chip"
              onClick={() => sendLiveReply(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          className="pop-react-form"
          onSubmit={e => { e.preventDefault(); sendLiveReply(replyText); }}
        >
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onFocus={focusScrollCenter}
            placeholder={`Send live reply to ${recipientName || "them"}...`}
            maxLength={120}
          />
          <button type="submit" className="pop-btn yellow sm" disabled={!replyText.trim()}>
            <Send size={14}/>
          </button>
        </form>
        {sentFlash && <small style={{ color: "#A3E635", fontWeight: 700 }}>{sentFlash}</small>}
      </div>
    </div>
  );
}

/* ============================================================================
   6. MAIN APP SHELL
============================================================================ */
function MainApp() {
  const [tab, setTab] = useState("links");
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [activeStudioMode, setActiveStudioMode] = useState(""); // "" | "trap" | "trick"
  const [watchLiveItem, setWatchLiveItem] = useState(null); // Reconnect Live Radar from Inbox!
  const [logoSpin, setLogoSpin] = useState(false);
  const [odcCode, setOdcCode] = useState("");
  const [duelRoute, setDuelRoute] = useState({ game: "", code: "" });
  const [inboxOpen, setInboxOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const knownReplyCountRef = useRef(-1);
  const needsFsReenterRef = useRef(false);

  const [pendingCard, setPendingCard] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_pending_card", "null")); } catch { return null; }
  });

  const [myLinks, setMyLinks] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_my_links", "[]")); } catch { return []; }
  });
  const [repliesMap, setRepliesMap] = useState({});

  const [topCreators, setTopCreators] = useState([
    { id: "t1", name: "Aarav", label: "OD Trap 🍕", count: 42 },
    { id: "t2", name: "Maya", label: "Miss Me? 🌍", count: 31 },
    { id: "t3", name: "Rohan", label: "OD Trick 🎭", count: 27 }
  ]);

  // Keep Full-Screen Persistence when returning from WhatsApp / background tabs
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "visible" && safeGetStorage("oddora_fs_pref") === "1") {
        needsFsReenterRef.current = true;
      }
    };
    const onFirstTap = () => {
      if (needsFsReenterRef.current) {
        needsFsReenterRef.current = false;
        requestAppFullscreen();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("click", onFirstTap, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("click", onFirstTap);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const createCode = (params.get("odc") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const xoCode = (params.get("xo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const heartCode = (params.get("heart") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const tapCode = (params.get("tap") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (createCode.length === 6) { setOdcCode(createCode); return; }
    if (xoCode.length === 6) { setTab("duels"); setDuelRoute({ game: "xo", code: xoCode }); return; }
    if (heartCode.length === 6) { setTab("duels"); setDuelRoute({ game: "heart", code: heartCode }); return; }
    if (tapCode.length === 6) { setTab("duels"); setDuelRoute({ game: "tap", code: tapCode }); return; }
  }, []);

  useEffect(() => {
    if (!myLinks.length) return undefined;
    const unsubs = myLinks.map(linkItem =>
      onValue(
        ref(database, `replies/${linkItem.code}`),
        snap => {
          const val = snap.exists() ? Object.values(snap.val()) : [];
          setRepliesMap(prev => {
            const nextMap = { ...prev, [linkItem.code]: val };
            const total = Object.values(nextMap).reduce((s, a) => s + a.length, 0);
            if (knownReplyCountRef.current !== -1 && total > knownReplyCountRef.current && val.length > 0) {
              const latest = val[val.length - 1];
              fx("notify", [40, 60, 80]);
              setToastMsg(`📬 ${latest.from || "Friend"}: “${latest.text}”`);
              setTimeout(() => setToastMsg(""), 4500);
            }
            knownReplyCountRef.current = total;
            return nextMap;
          });
        },
        () => {}
      )
    );
    return () => unsubs.forEach(fn => fn());
  }, [myLinks]);

  useEffect(() => {
    return onValue(
      ref(database, "creations"),
      snap => {
        if (!snap.exists()) return;
        const ranked = Object.values(snap.val())
          .filter(item => item && item.creatorName && (item.yesCount || 0) > 0)
          .sort((a, b) => (b.yesCount || 0) - (a.yesCount || 0))
          .slice(0, 3)
          .map((item, idx) => ({
            id: item.id || `c-${idx}`,
            name: item.creatorName,
            label: item.type === "propose" ? "OD Trick 🎭" : "OD Trap ⚡",
            count: item.yesCount || 1
          }));
        if (ranked.length > 0) setTopCreators(ranked);
      },
      () => {}
    );
  }, []);

  function handleSavedLink(newItem) {
    setMyLinks(prev => {
      const updated = [newItem, ...prev.filter(x => x.code !== newItem.code)].slice(0, 15);
      safeSetStorage("oddora_my_links", JSON.stringify(updated));
      return updated;
    });
  }

  function deleteInboxItem(codeToRemove) {
    fx("tap", 10);
    setMyLinks(prev => {
      const updated = prev.filter(x => x.code !== codeToRemove);
      safeSetStorage("oddora_my_links", JSON.stringify(updated));
      return updated;
    });
    setRepliesMap(prev => {
      const copy = { ...prev };
      delete copy[codeToRemove];
      return copy;
    });
  }

  function sendAnotherTo(friendName) {
    fx("tap", 12);
    setInboxOpen(false);
    if (friendName) {
      try { window.sessionStorage.setItem("oddora_reply_to", friendName); } catch {}
    }
    setPickerModalOpen(true);
  }

  function openModePicker() {
    fx("tap", 12);
    setPickerModalOpen(true);
  }

  function launchWizard(modeKey) {
    fx("tap", 14);
    safeSetStorage("oddora_fs_pref", "1");
    requestAppFullscreen();
    setPickerModalOpen(false);
    setActiveStudioMode(modeKey);
  }

  function dismissPendingCard() {
    fx("tap", 10);
    setPendingCard(null);
    safeRemoveStorage("oddora_pending_card");
  }

  // 1. FULL-SCREEN RECIPIENT TAKEOVER
  if (odcCode) {
    return (
      <FullScreenODRecipient
        code={odcCode}
        onPendingUpdate={cardObj => {
          setPendingCard(cardObj);
          if (cardObj) safeSetStorage("oddora_pending_card", JSON.stringify(cardObj));
          else safeRemoveStorage("oddora_pending_card");
        }}
        onExit={creatorName => {
          setOdcCode("");
          const u = new URL(window.location.href);
          u.searchParams.delete("odc");
          window.history.replaceState({}, "", u.toString());
          if (creatorName) {
            try { window.sessionStorage.setItem("oddora_reply_to", creatorName); } catch {}
            setPickerModalOpen(true);
          } else {
            setTab("links");
          }
        }}
      />
    );
  }

  // 2. FULL-SCREEN WATCH LIVE RECONNECT (From Inbox!)
  if (watchLiveItem) {
    const shareUrl = (() => {
      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("odc", watchLiveItem.code);
      return u.toString();
    })();
    return (
      <div className="pop-fs-stage theme-lime">
        <div className="pop-fs-topbar">
          <span className="pop-pill-black">📡 LIVE RADAR · {watchLiveItem.code}</span>
          <button type="button" className="pop-btn pink sm" onClick={() => { fx("tap", 10); setWatchLiveItem(null); }}>
            ✕ Back
          </button>
        </div>
        <div className="pop-fs-content">
          <div className="pop-ready-card" style={{ width: "100%" }}>
            <span className="pop-pill-black">TO: {String(watchLiveItem.to || "FRIEND").toUpperCase()}</span>
            <h2>{watchLiveItem.title}</h2>
            <UniversalShareBar
              url={shareUrl}
              shareText={`${watchLiveItem.from || "Someone"} sent you a Secret OD Card 👀⚡`}
              title="Secret OD Card"
            />
            <LiveRadarPanel
              code={watchLiveItem.code}
              recipientName={watchLiveItem.to}
              senderName={watchLiveItem.from || "You"}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. FULL-SCREEN 2-STEP LIVE PREVIEW CREATOR WIZARD (Never exits fullscreen on Exit!)
  if (activeStudioMode) {
    return (
      <FullScreenCreatorWizard
        initialMode={activeStudioMode === "trick" ? "propose" : "invite"}
        onLinkCreated={handleSavedLink}
        onClose={() => {
          fx("tap", 10);
          setActiveStudioMode("");
        }}
      />
    );
  }

  const totalReplies = Object.values(repliesMap).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="pop-shell">
      {toastMsg && (
        <div
          className="pop-toast"
          onClick={() => { fx("tap", 12); setToastMsg(""); setInboxOpen(true); }}
        >
          {toastMsg}
        </div>
      )}

      {/* FIXED TOP HEADER */}
      <header className="pop-header">
        <a
          href="#top"
          className="pop-brand"
          onClick={e => {
            e.preventDefault();
            fx("tap", 12);
            setLogoSpin(false);
            requestAnimationFrame(() => setLogoSpin(true));
            setTab("links");
          }}
        >
          <span className={logoSpin ? "pop-coin spin" : "pop-coin"} onAnimationEnd={() => setLogoSpin(false)}>O</span>
          <span className="pop-brand-title">ODDORA</span>
          <span className="pop-pill-black">DO OD</span>
        </a>

        <div className="pop-header-actions">
          <button type="button" className="pop-btn white sm pop-inbox-btn" onClick={() => { fx("tap", 12); setInboxOpen(true); }}>
            <Inbox size={15}/> Replies
            {totalReplies > 0 && <span className="pop-inbox-badge">{totalReplies}</span>}
          </button>
          <button
            type="button"
            className="pop-btn yellow sm"
            onClick={openModePicker}
          >
            ⚡ OD Links
          </button>
        </div>
      </header>

      <main className="pop-main" id="top">
        {/* PENDING CARD REMINDER BANNER (If receiver accidentally closed before completing!) */}
        {pendingCard && pendingCard.code && (
          <div className="pop-pending-banner">
            <div className="pop-pending-text">
              <strong>⚡ {pendingCard.from || "A friend"} set a secret card for you!</strong>
              <small>Tap to finish it without going back to WhatsApp.</small>
            </div>
            <div className="pop-pending-actions">
              <button
                type="button"
                className="pop-btn yellow sm"
                onClick={() => { fx("seal", 14); setOdcCode(pendingCard.code); }}
              >
                🔓 Complete
              </button>
              <button type="button" className="pop-btn white sm" onClick={dismissPendingCard} aria-label="Dismiss">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section className="pop-hero">
          <div className="pop-hero-top">
            <div className="pop-sticker-row">
              <span className="pop-tag pink">TAP</span>
              <span className="pop-tag blue">TRAP</span>
              <span className="pop-tag lime">WATCH LIVE</span>
            </div>
            <div className="pop-banner-title">
              <h1>LINKS THEY CAN'T SAY NO TO!</h1>
            </div>
            <p className="pop-hero-tagline">
              Drop an OD - Trap or OD - Trick in WhatsApp & Insta — watch them react live.
            </p>
          </div>

          <div className="pop-cards-fan">
            <div
              className="pop-trade-card coral tilt-left"
              onClick={openModePicker}
            >
              <span className="pop-card-num">01</span>
              <PopCharacterArt variant="lime" />
              <div className="pop-card-label">OD LINKS ⚡</div>
            </div>

            <HeroLiveCard
              logoSpin={logoSpin}
              onSpinLogo={() => { fx("tap", 14); setLogoSpin(false); requestAnimationFrame(() => setLogoSpin(true)); }}
            />

            <div
              className="pop-trade-card blue tilt-right"
              onClick={() => { fx("tap", 12); setTab("duels"); document.getElementById("play-deck")?.scrollIntoView({ behavior: "smooth" }); }}
            >
              <span className="pop-card-num">03</span>
              <PopCharacterArt variant="cyan" />
              <div className="pop-card-label">OD DUELS 🎮</div>
            </div>
          </div>
        </section>

        {/* MAIN 3 PILLAR TABS */}
        <div id="play-deck" className="pop-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "links"}
            className={tab === "links" ? "pop-tab active yellow" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("links"); }}
          >
            ⚡ OD Links
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "duels"}
            className={tab === "duels" ? "pop-tab active blue" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("duels"); }}
          >
            🎮 OD Duels
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "wall"}
            className={tab === "wall" ? "pop-tab active pink" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("wall"); }}
          >
            🔥 Flex Wall
          </button>
        </div>

        {/* SUB-CATEGORY LAUNCHER CARDS */}
        {tab === "links" && (
          <section className="pop-box">
            <div className="pop-box-head">
              <span>⚡ CHOOSE YOUR MOVE</span>
              <span className="pop-pill-black">10s SETUP</span>
            </div>

            <div className="pop-subcat-grid">
              <button
                type="button"
                className="pop-subcat-card lime"
                onClick={() => launchWizard("trap")}
              >
                <div className="pop-subcat-top">
                  <span className="pop-pill-black">NO-ESCAPE</span>
                  <ArrowRight size={18}/>
                </div>
                <PopCharacterArt variant="lime" />
                <h3>⚡ OD - Trap</h3>
                <p>The “No” button talks & runs away until they give in!</p>
              </button>

              <button
                type="button"
                className="pop-subcat-card pink"
                onClick={() => launchWizard("trick")}
              >
                <div className="pop-subcat-top">
                  <span className="pop-pill-black">3-STEP TRICK</span>
                  <ArrowRight size={18}/>
                </div>
                <PopCharacterArt variant="pink" />
                <h3>🎭 OD - Trick</h3>
                <p>2 hype warm-ups → 1 big question → prank or date reveal!</p>
              </button>
            </div>
          </section>
        )}

        {tab === "duels" && (
          <DuelsHub
            initialGame={duelRoute.game}
            initialCode={duelRoute.code}
            onClearRoute={() => setDuelRoute({ game: "", code: "" })}
          />
        )}

        {tab === "wall" && <FlexWall topCreators={topCreators} />}

        <section className="pop-box">
          <div className="pop-box-head">
            <span><Trophy size={16}/> TOP CREATORS TODAY</span>
            <span className="pop-pill-black">LIVE</span>
          </div>
          <div className="pop-lb-grid">
            {topCreators.map((c, idx) => (
              <div className="pop-lb-item" key={c.id}>
                <span className="pop-lb-rank">#{idx + 1}</span>
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.label}</small>
                </div>
                <span className="pop-lb-badge">{c.count} YES</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="pop-footer">
        <strong>⚡ ODDORA · DO OD</strong>
        <span>Built for DMs, Stories & Long-Distance Duos.</span>
      </footer>

      {/* CLEAN GLOBAL MODE PICKER MODAL */}
      {pickerModalOpen && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPickerModalOpen(false); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setPickerModalOpen(false)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card">
              <span className="pop-pill-black">⚡ OD LINKS</span>
              <h2>Pick your move ⚡</h2>

              <div className="pop-stack" style={{ width: "100%" }}>
                <button
                  type="button"
                  className="pop-btn lime lg full"
                  onClick={() => launchWizard("trap")}
                >
                  ⚡ OD - Trap (Runaway “No”)
                </button>
                <button
                  type="button"
                  className="pop-btn pink lg full"
                  onClick={() => launchWizard("trick")}
                >
                  🎭 OD - Trick (3-Step Reveal)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLIES INBOX MODAL (With 📡 Watch Live, ⚡ Send Another & 🗑️ Delete) */}
      {inboxOpen && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setInboxOpen(false); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setInboxOpen(false)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card">
              <span className="pop-pill-black">📬 YOUR LINK REPLIES</span>
              <h2>Friend Responses</h2>
              {myLinks.length === 0 ? (
                <p className="pop-muted">Create & share an OD link—friend reactions will pop up here live!</p>
              ) : (
                <div className="pop-stack" style={{ width: "100%" }}>
                  {myLinks.map(item => {
                    const list = repliesMap[item.code] || [];
                    return (
                      <div className="pop-inbox-item" key={item.code}>
                        <div className="pop-row-between">
                          <strong>To: {item.to}</strong>
                          <span className="pop-pill-black">{item.code}</span>
                        </div>
                        <small className="pop-muted">{item.title}</small>
                        {list.length === 0 ? (
                          <small className="pop-muted">Waiting for reply...</small>
                        ) : (
                          list.map((r, idx) => (
                            <div className="pop-inbox-reply" key={idx}>
                              💬 <strong>{r.from}:</strong> “{r.text}”
                            </div>
                          ))
                        )}
                        <div className="pop-inbox-actions">
                          <button
                            type="button"
                            className="pop-btn blue sm"
                            onClick={() => {
                              fx("tap", 12);
                              setInboxOpen(false);
                              setWatchLiveItem(item);
                            }}
                          >
                            <Radio size={13}/> Live
                          </button>
                          <button
                            type="button"
                            className="pop-btn yellow sm"
                            onClick={() => sendAnotherTo(item.to)}
                          >
                            ⚡ New
                          </button>
                          <button
                            type="button"
                            className="pop-btn white sm"
                            onClick={() => deleteInboxItem(item.code)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   7. HERO CENTER INTERACTIVE CARD (Max 3–4 Dodges + Talking No!)
============================================================================ */
function HeroLiveCard({ logoSpin, onSpinLogo }) {
  const [dodges, setDodges] = useState(0);
  const [limit] = useState(() => 3 + Math.floor(Math.random() * 2));
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [accepted, setAccepted] = useState(false);

  function dodgeNo() {
    if (accepted) return;
    fx("dodge", 14);
    const next = dodges + 1;
    setDodges(next);
    if (next >= limit) {
      setOffset({ x: 0, y: 0 });
      setAccepted(true);
      fx("win", [20, 35, 20]);
      return;
    }
    const rx = dodges % 2 === 0 ? 12 : -10;
    const ry = dodges % 2 === 0 ? 12 : -4;
    setOffset({ x: rx, y: ry });
  }

  return (
    <div className="pop-trade-card cream center-card">
      <div className="pop-card-top-row">
        <span className="pop-card-num">02 · LIVE</span>
        <button type="button" className={logoSpin ? "pop-mini-coin spin" : "pop-mini-coin"} onClick={onSpinLogo}>O</button>
      </div>

      {accepted ? (
        <div className="pop-demo-done">
          <div className="pop-big-emoji">🎉</div>
          <strong>LOCKED IN!</strong>
          <small>{dodges > 0 ? `Dodged ${dodges}x — still YES 💀` : "⚡ ZERO HESITATION!"}</small>
          <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); setAccepted(false); setDodges(0); setOffset({ x: 0, y: 0 }); }}>
            Reset
          </button>
        </div>
      ) : (
        <>
          <h3>“You're buying coffee today? ☕”</h3>
          <div className="pop-demo-btns">
            <button type="button" className="pop-btn lime sm" onClick={() => { fx("win", [20, 30, 20]); setAccepted(true); }}>
              Yes 💸
            </button>
            <button
              type="button"
              className="pop-btn pink sm pop-dodge-btn"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
              onMouseEnter={() => { if (dodges < 2) dodgeNo(); }}
              onClick={dodgeNo}
            >
              {dodges > 0 ? ["Nope 👀", "Miss! 😜", "Fast! 🏃"][Math.min(dodges - 1, 2)] : "No"}
            </button>
          </div>
          <small className="pop-hint">
            {dodges > 0 ? "Try catching it 😂" : "Bet you can't tap No 👀"}
          </small>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   8. 2-SCREEN LIVE PREVIEW CREATOR WIZARD (Zero Backspace, Back-Safe!)
   Screen 0 (1 of 2): Your Name, Their Name, & Your Question (with Sparks)
   Screen 1 (2 of 2): Live Card Preview (Tap to customize buttons/replies/options)
   Screen 2 (Ready): Armed & Ready + 📡 Live Radar + 2-Way Sender Reply
============================================================================ */
function FullScreenCreatorWizard({ initialMode = "invite", onLinkCreated, onClose }) {
  const [mode] = useState(initialMode); // "invite" (OD - Trap) | "propose" (OD - Trick)
  const [step, setStep] = useState(0); // 0 -> 1 -> 2
  const [busy, setBusy] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [liveCode, setLiveCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [autoVariant, setAutoVariant] = useState(0);

  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState(() => {
    try {
      const r = window.sessionStorage.getItem("oddora_reply_to") || "";
      if (r) window.sessionStorage.removeItem("oddora_reply_to");
      return r;
    } catch { return ""; }
  });
  const [cardColor, setCardColor] = useState(initialMode === "propose" ? "pink" : "lime");

  // Values start EMPTY so user NEVER has to backspace defaults — placeholders show suggestions!
  const [questionInput, setQuestionInput] = useState("");
  const [yesLabelInput, setYesLabelInput] = useState("");
  const [noLabelInput, setNoLabelInput] = useState("");
  const [yesMsgInput, setYesMsgInput] = useState("");
  const [noTwistInput, setNoTwistInput] = useState("");

  // Warm-up inputs stay EMPTY by default so suggestions appear as light-grey placeholders!
  const [autoWarmups, setAutoWarmups] = useState(() => generateWarmupQuestions("", initialMode === "propose" ? "pink" : "lime", 0));
  const [q1, setQ1] = useState("");
  const [q1Opts, setQ1Opts] = useState(["", "", ""]);
  const [q2, setQ2] = useState("");
  const [q2Opts, setQ2Opts] = useState(["", "", ""]);

  // Dynamic 2-word demo placeholders & smart fallbacks
  const demoQPlaceholder = mode === "invite" ? "Coffee tonight?" : "Saapda polama?";
  const defaultQ = mode === "invite" ? TRAP_SPARKS[0].title : "Will you go on a date with me? 💘";
  const effectiveQ = questionInput.trim() || defaultQ;
  const smartOut = generateSmartOutcomes(effectiveQ, senderName.trim() || "your friend");
  const defaultYesBtn = mode === "invite" ? "Yes, locked in ⚡" : "YES, 100% 💖";
  const defaultNoBtn = mode === "invite" ? "No" : "No 🙈";

  // Step-by-step guided spotlight on Screen 1: Your Name -> Their Name -> Question -> Next
  const activeFieldStep = !senderName.trim()
    ? "sender"
    : !recipientName.trim()
      ? "recipient"
      : !questionInput.trim()
        ? "question"
        : "ready";

  function pickTrapSpark(p) {
    fx("tap", 10);
    setCardColor(p.cardColor);
    setQuestionInput(p.title);
    setYesLabelInput(p.yesLabel);
    setNoLabelInput(p.noLabel);
    setYesMsgInput(p.yesMessage);
  }

  function pickTrickSpark(v) {
    fx("tap", 10);
    setCardColor(v.id);
    setQuestionInput(v.defaultQ);
  }

  async function goToLivePreview() {
    fx("tap", 12);
    if (mode === "propose") {
      setAiLoading(true);
      const gen = await fetchAIWarmups(effectiveQ, cardColor, autoVariant);
      setAutoWarmups(gen);
      setAiLoading(false);
    }
    setStep(1);
  }

  async function shuffleWarmups() {
    fx("tap", 12);
    const nextVar = autoVariant + 1;
    setAutoVariant(nextVar);
    setAiLoading(true);
    const gen = await fetchAIWarmups(effectiveQ, cardColor, nextVar);
    setAutoWarmups(gen);
    setQ1("");
    setQ1Opts(["", "", ""]);
    setQ2("");
    setQ2Opts(["", "", ""]);
    setAiLoading(false);
  }

  function buildData() {
    const from = (senderName.trim() || "Someone special").slice(0, 24);
    const to = (recipientName.trim() || "You").slice(0, 24);
    const secretLimit = 3 + Math.floor(Math.random() * 2); // Max 3 or 4 dodges!

    if (mode === "invite") {
      return {
        type: "invite",
        theme: cardColor,
        creatorName: from,
        recipientName: to,
        yesCount: 0,
        createdAt: Date.now(),
        payload: {
          title: effectiveQ.slice(0, 80),
          question: "Tap your answer below 👇",
          yesLabel: (yesLabelInput.trim() || defaultYesBtn).slice(0, 28),
          noLabel: (noLabelInput.trim() || defaultNoBtn).slice(0, 28),
          yesMessage: (yesMsgInput.trim() || smartOut.yesMsg).slice(0, 240),
          maxDodges: secretLimit
        }
      };
    }

    const finalQ1 = (q1.trim() || autoWarmups?.[0]?.q || "").slice(0, 140);
    const finalQ2 = (q2.trim() || autoWarmups?.[1]?.q || "").slice(0, 140);
    const cleanQ1Opts = [0, 1, 2]
      .map(i => (q1Opts[i]?.trim() || autoWarmups?.[0]?.options?.[i] || "").slice(0, 50))
      .filter(Boolean);
    const cleanQ2Opts = [0, 1, 2]
      .map(i => (q2Opts[i]?.trim() || autoWarmups?.[1]?.options?.[i] || "").slice(0, 50))
      .filter(Boolean);
    const questions = [];
    if (finalQ1 && cleanQ1Opts.length > 0) {
      questions.push({ q: finalQ1, options: cleanQ1Opts });
    }
    if (finalQ2 && cleanQ2Opts.length > 0) {
      questions.push({ q: finalQ2, options: cleanQ2Opts });
    }

    return {
      type: "propose",
      theme: cardColor,
      creatorName: from,
      recipientName: to,
      yesCount: 0,
      createdAt: Date.now(),
      payload: {
        questions,
        finalQuestion: effectiveQ.slice(0, 160),
        yesLabel: (yesLabelInput.trim() || defaultYesBtn).slice(0, 28),
        noLabel: (noLabelInput.trim() || defaultNoBtn).slice(0, 28),
        yesAckMessage: (yesMsgInput.trim() || smartOut.yesMsg).slice(0, 220),
        noTwistMessage: (noTwistInput.trim() || smartOut.noTwist).slice(0, 220)
      }
    };
  }

  async function publishLink() {
    if (busy) return;
    setBusy(true);
    fx("tap", 16);
    try {
      await signInPlayer().catch(() => null);
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snap = await get(ref(database, `creations/${code}`));
        exists = snap.exists();
      }
      if (exists) throw new Error("Could not generate code");

      const dataObj = buildData();
      await set(ref(database, `creations/${code}`), { id: code, ...dataObj });

      onLinkCreated?.({
        code,
        from: dataObj.creatorName,
        to: dataObj.recipientName,
        title: mode === "invite" ? dataObj.payload.title : dataObj.payload.finalQuestion,
        createdAt: Date.now()
      });

      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("odc", code);
      setShareUrl(u.toString());
      setLiveCode(code);
      setStep(2);
      fx("win", [20, 35, 20]);
    } catch {
      alert("Network issue. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`pop-fs-stage theme-${cardColor}`}>
      {/* Full-Screen Top Bar */}
      <div className="pop-fs-topbar">
        <span className="pop-pill-black">
          {mode === "invite" ? "⚡ OD - TRAP" : "🎭 OD - TRICK"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pop-btn white sm" onClick={requestAppFullscreen} title="Full Screen">
            <Maximize2 size={14}/>
          </button>
          <button type="button" className="pop-btn pink sm" onClick={onClose}>
            ✕ Exit
          </button>
        </div>
      </div>

      <div className="pop-fs-content">
        {step < 2 && (
          <div className="pop-wizard-dots" style={{ width: "100%" }}>
            {[0, 1].map(i => (
              <span key={i} className={`pop-w-dot ${step === i ? "active" : step > i ? "done" : ""}`} />
            ))}
          </div>
        )}

        {/* SCREEN 1 (1 OF 2): NAMES + MAIN QUESTION (With Visual Highlighter!) */}
        {step === 0 && (
          <div className="pop-wizard-card" style={{ width: "100%" }} key="w-0">
            <span className="pop-pill-black">STEP 1 OF 2 · THE HOOK</span>
            <h2 className="pop-wizard-prompt">Set up your card ⚡</h2>

            <div className="pop-grid-2">
              <label className={`pop-field ${activeFieldStep === "sender" ? "pop-highlight-field" : ""}`}>
                <span>YOUR NAME</span>
                <input
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  onFocus={focusScrollCenter}
                  placeholder="Karthik"
                  maxLength={24}
                />
              </label>
              <label className={`pop-field ${activeFieldStep === "recipient" ? "pop-highlight-field" : ""}`}>
                <span>THEIR NAME</span>
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  onFocus={focusScrollCenter}
                  placeholder="Ananya"
                  maxLength={24}
                />
              </label>
            </div>

            <div className="pop-chips-row center">
              {mode === "invite"
                ? TRAP_SPARKS.map(p => (
                    <button key={p.id} type="button" className="pop-chip" onClick={() => pickTrapSpark(p)}>
                      {p.tag}
                    </button>
                  ))
                : TRICK_SPARKS.map(v => (
                    <button key={v.id} type="button" className={cardColor === v.id ? "pop-chip active" : "pop-chip"} onClick={() => pickTrickSpark(v)}>
                      {v.label}
                    </button>
                  ))}
            </div>

            <label className={`pop-field ${activeFieldStep === "question" ? "pop-highlight-field" : ""}`}>
              <span>YOUR QUESTION (ANY LANGUAGE)</span>
              <input
                value={questionInput}
                onChange={e => setQuestionInput(e.target.value)}
                onFocus={focusScrollCenter}
                placeholder={demoQPlaceholder}
                maxLength={140}
              />
            </label>

            <button
              type="button"
              className={`pop-btn yellow full ${activeFieldStep === "ready" ? "pop-next-glow" : ""}`}
              onClick={goToLivePreview}
              disabled={aiLoading}
            >
              {aiLoading ? "Generating..." : <>Next: Live Preview <ArrowRight size={16}/></>}
            </button>
          </div>
        )}

        {/* SCREEN 2 (2 OF 2): LIVE CARD PREVIEW (Tap anything to customize, or hit Send!) */}
        {step === 1 && (
          <div className="pop-wizard-card" style={{ width: "100%" }} key="w-1">
            {/* Pinned Main Question Reminder */}
            <div className="pop-pinned-q">
              <span>📌 Main Q:</span> <strong>“{effectiveQ}”</strong>
            </div>

            <div className="pop-chips-row center">
              {[
                { id: "lime", label: "😎 LIME" },
                { id: "pink", label: "😍 PINK" },
                { id: "cyan", label: "🌍 BLUE" },
                { id: "gold", label: "👑 GOLD" }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={cardColor === t.id ? "pop-chip active" : "pop-chip"}
                  onClick={() => { fx("tap", 10); setCardColor(t.id); }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {mode === "invite" ? (
              /* LIVE PREVIEW FOR OD - TRAP */
              <div className="pop-live-preview-box">
                <span className="pop-mini-tag">TAP ANY BOX TO EDIT (OPTIONAL)</span>

                <div className="pop-grid-2">
                  <label className="pop-field">
                    <span>YES BUTTON</span>
                    <input
                      className="pop-dashed-input"
                      value={yesLabelInput}
                      onChange={e => setYesLabelInput(e.target.value)}
                      onFocus={focusScrollCenter}
                      placeholder={defaultYesBtn}
                      maxLength={28}
                    />
                  </label>
                  <label className="pop-field">
                    <span>NO BUTTON (RUNS!)</span>
                    <input
                      className="pop-dashed-input"
                      value={noLabelInput}
                      onChange={e => setNoLabelInput(e.target.value)}
                      onFocus={focusScrollCenter}
                      placeholder={defaultNoBtn}
                      maxLength={28}
                    />
                  </label>
                </div>

                <label className="pop-field">
                  <span>POP-UP MESSAGE AFTER THEY TAP YES</span>
                  <input
                    className="pop-dashed-input"
                    value={yesMsgInput}
                    onChange={e => setYesMsgInput(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={smartOut.yesMsg}
                    maxLength={240}
                  />
                </label>
              </div>
            ) : (
              /* LIVE PREVIEW FOR OD - TRICK (Visible & Editable Q1, Q2 + ALL 3 OPTIONS!) */
              <div className="pop-live-preview-box">
                <div className="pop-row-between">
                  <span className="pop-mini-tag">2 WARM-UPS + OPTIONS (EDITABLE)</span>
                  <button type="button" className="pop-btn white sm" onClick={shuffleWarmups} disabled={aiLoading}>
                    {aiLoading ? "..." : "✨ Shuffle"}
                  </button>
                </div>

                <div className="pop-inner-box">
                  <input
                    className="pop-dashed-input"
                    value={q1}
                    onChange={e => setQ1(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={autoWarmups?.[0]?.q || "Warm-up Question 1"}
                    maxLength={140}
                  />
                  <div className="pop-grid-3">
                    {q1Opts.map((opt, i) => (
                      <input
                        key={i}
                        className="pop-opt-input"
                        value={opt}
                        onChange={e => {
                          const c = [...q1Opts]; c[i] = e.target.value; setQ1Opts(c);
                        }}
                        onFocus={focusScrollCenter}
                        placeholder={autoWarmups?.[0]?.options?.[i] || `Opt ${i + 1}`}
                        maxLength={50}
                      />
                    ))}
                  </div>
                </div>

                <div className="pop-inner-box">
                  <input
                    className="pop-dashed-input"
                    value={q2}
                    onChange={e => setQ2(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={autoWarmups?.[1]?.q || "Warm-up Question 2"}
                    maxLength={140}
                  />
                  <div className="pop-grid-3">
                    {q2Opts.map((opt, i) => (
                      <input
                        key={i}
                        className="pop-opt-input"
                        value={opt}
                        onChange={e => {
                          const c = [...q2Opts]; c[i] = e.target.value; setQ2Opts(c);
                        }}
                        onFocus={focusScrollCenter}
                        placeholder={autoWarmups?.[1]?.options?.[i] || `Opt ${i + 1}`}
                        maxLength={50}
                      />
                    ))}
                  </div>
                </div>

                <label className="pop-field">
                  <span>IF THEY TAP YES</span>
                  <input
                    className="pop-dashed-input"
                    value={yesMsgInput}
                    onChange={e => setYesMsgInput(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={smartOut.yesMsg}
                    maxLength={220}
                  />
                </label>

                <label className="pop-field">
                  <span>IF THEY TAP NO (PRANK REVEAL 😂)</span>
                  <input
                    className="pop-dashed-input"
                    value={noTwistInput}
                    onChange={e => setNoTwistInput(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={smartOut.noTwist}
                    maxLength={220}
                  />
                </label>
              </div>
            )}

            <div className="pop-grid-2">
              <button type="button" className="pop-btn white" onClick={() => { fx("tap", 10); setStep(0); }}>
                <ArrowLeft size={16}/> Back
              </button>
              <button type="button" className="pop-btn lime" onClick={publishLink} disabled={busy}>
                {busy ? "Arming..." : "🚀 Arm & Share"}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: ARMED & READY + 📡 LIVE RADAR + 2-WAY SENDER REPLY */}
        {step === 2 && (
          <div className="pop-ready-card" style={{ width: "100%" }} key="w-2">
            <PopCharacterArt variant={cardColor} />
            <span className="pop-pill-black">ARMED & READY ⚡</span>
            <h2>Send to {recipientName || "your person"}!</h2>

            <div className="pop-link-box">
              <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
            </div>

            <UniversalShareBar
              url={shareUrl}
              shareText={`${senderName.trim() || "Someone"} sent you a Secret OD Card 👀⚡`}
              title="Secret OD Card"
            />

            <LiveRadarPanel
              code={liveCode}
              recipientName={recipientName || "Friend"}
              senderName={senderName.trim() || "Your friend"}
            />

            <button
              type="button"
              className="pop-btn white sm"
              onClick={() => {
                fx("tap", 10);
                setStep(0);
                setLiveCode("");
                setQuestionInput("");
                setYesLabelInput("");
                setNoLabelInput("");
                setYesMsgInput("");
                setNoTwistInput("");
                setQ1(""); setQ1Opts(["", "", ""]); setQ2(""); setQ2Opts(["", "", ""]);
              }}
            >
              ✏️ Create Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   9. FULL-SCREEN RECIPIENT TAKEOVER
   - "Are you sure?" gate on instant YES
   - Talking NO button (max 3–4 dodges) with ZERO overlap!
   - Pending card auto-save/clear
   - Live 2-Way Sender Reply Toast!
============================================================================ */
function FullScreenODRecipient({ code, onPendingUpdate, onExit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sealed, setSealed] = useState(true);
  const [dodges, setDodges] = useState(0);
  const [confirmSure, setConfirmSure] = useState(false); // "Are you sure?" gate on instant YES
  const [noPos, setNoPos] = useState(null);
  const [outcome, setOutcome] = useState("");
  const [propStep, setPropStep] = useState(0);
  const [reactionText, setReactionText] = useState("");
  const [reactionSent, setReactionSent] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [liveSenderMsg, setLiveSenderMsg] = useState("");
  const knownSenderCountRef = useRef(-1);

  useEffect(() => {
    let alive = true;
    get(ref(database, `creations/${code}`))
      .then(snap => {
        if (alive && snap.exists()) {
          const val = snap.val();
          setData(val);
          // Auto-save as Pending until completed!
          onPendingUpdate?.({
            code,
            from: val.creatorName || "A friend",
            title: val.type === "invite" ? val.payload?.title : val.payload?.finalQuestion
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  // Listen for 2-Way Live Replies from Sender!
  useEffect(() => {
    if (!code) return undefined;
    return onValue(
      ref(database, `senderReplies/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        if (knownSenderCountRef.current !== -1 && list.length > knownSenderCountRef.current && list.length > 0) {
          const latest = list[list.length - 1];
          fx("notify", [35, 50, 35]);
          setLiveSenderMsg(`⚡ ${latest.from || "Friend"}: “${latest.text}”`);
          setTimeout(() => setLiveSenderMsg(""), 6000);
        }
        knownSenderCountRef.current = list.length;
      },
      () => {}
    );
  }, [code]);

  function pushLiveEvent(msg) {
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `live/${code}`), { msg, ts: Date.now() }).catch(() => {});
    });
  }

  function breakSeal() {
    fx("seal", [20, 30, 20]);
    safeSetStorage("oddora_fs_pref", "1");
    requestAppFullscreen();
    setSealed(false);
    const who = data?.recipientName || "Your friend";
    pushLiveEvent(`👀 ${who} just broke the seal & opened your card!`);
  }

  if (loading) {
    return (
      <div className="pop-fs-stage">
        <span className="pop-pill-black">⚡ ODDORA</span>
        <h2>Unlocking secret card...</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pop-fs-stage">
        <div className="pop-seal-card" style={{ maxWidth: 380 }}>
          <span className="pop-pill-black">⚡ ODDORA</span>
          <h2>Card expired or not found 👀</h2>
          <button type="button" className="pop-btn yellow full" onClick={() => { onPendingUpdate?.(null); onExit(""); }}>
            Create Your Own OD
          </button>
        </div>
      </div>
    );
  }

  const cardTheme = data.theme || "lime";
  const maxDodges = Math.min(4, data?.payload?.maxDodges || 4); // Always max 3–4 dodges!
  const converted = dodges >= maxDodges;
  const who = data.recipientName || "Your friend";
  const talkingList = isTamilOrTanglish(data?.payload?.title) ? TALKING_NO_TA : TALKING_NO_EN;

  function handleFullScreenDodge(e) {
    if (e) e.preventDefault();
    setConfirmSure(false);
    if (converted) {
      confirmTrapYes(true);
      return;
    }
    const next = dodges + 1;
    setDodges(next);
    fx("dodge", 16);
    pushLiveEvent(`😂 ${who} is chasing NO... (Dodge #${next}!)`);

    if (next >= maxDodges) {
      setNoPos(null);
      return;
    }

    // ZERO OVERLAP JUMP: Only jump in safe top band (80px..22% height) OR bottom band (76%..88% height)
    const padX = 20;
    const btnW = 156;
    const btnH = 56;
    const maxL = Math.max(padX, window.innerWidth - btnW - padX);
    const left = Math.round(padX + Math.random() * (maxL - padX));

    const useTopBand = next % 2 === 1;
    const topBandMin = 78;
    const topBandMax = Math.max(topBandMin + 20, Math.round(window.innerHeight * 0.22));
    const botBandMin = Math.round(window.innerHeight * 0.76);
    const botBandMax = Math.max(botBandMin + 10, window.innerHeight - btnH - 28);

    const top = useTopBand
      ? Math.round(topBandMin + Math.random() * (topBandMax - topBandMin))
      : Math.round(botBandMin + Math.random() * (botBandMax - botBandMin));

    setNoPos({ left, top });
  }

  function handleYesTap() {
    // Playful "Are you sure?" gate if they click YES immediately without trying No!
    if (dodges === 0 && !confirmSure) {
      fx("tap", 14);
      setConfirmSure(true);
      pushLiveEvent(`👀 ${who} tapped YES right away — asking “Are you sure?”`);
      return;
    }
    confirmTrapYes(false);
  }

  function confirmTrapYes(forcedByDodge = false) {
    fx("win", [25, 40, 25]);
    setOutcome("yes");
    setNoPos(null);
    onPendingUpdate?.(null); // Clear pending reminder!
    const isInstant = dodges === 0 && !forcedByDodge;
    pushLiveEvent(
      isInstant
        ? `⚡ ${who} didn't even hesitate — INSTANT YES!`
        : `🎉 ${who} gave in after ${dodges} dodges & said YES!`
    );
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `replies/${code}`), {
        text: isInstant ? "INSTANT YES! ⚡" : `Said YES after ${dodges} dodges! 💜`,
        from: who,
        createdAt: Date.now()
      }).catch(() => {});
      runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
    });
  }

  function sendReactionNote(e) {
    e.preventDefault();
    const clean = reactionText.trim().slice(0, 120);
    if (!clean || reactionSent) return;
    fx("notify", [20, 30, 20]);
    setReactionSent(true);
    pushLiveEvent(`💬 ${who} replied: “${clean}”`);
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `replies/${code}`), {
        text: clean,
        from: who,
        createdAt: Date.now()
      }).catch(() => {});
    });
  }

  async function shareReceipt(badge, headline, subline, statPill, quote) {
    if (savingCard) return;
    setSavingCard(true);
    fx("tap", 14);
    pushLiveEvent(`📸 ${who} shared the collectible receipt card!`);
    try {
      const file = await createCollectibleReceipt({
        badge,
        headline,
        subline,
        statPill,
        quote,
        sender: data.creatorName,
        recipient: data.recipientName,
        cardColor: cardTheme,
        footerUrl: window.location.host
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = "oddora-card.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {} finally {
      setSavingCard(false);
    }
  }

  const noButtonText = converted
    ? data.payload.yesLabel
    : dodges > 0
      ? talkingList[Math.min(dodges - 1, talkingList.length - 1)]
      : data.payload.noLabel;

  return (
    <div className={`pop-fs-stage theme-${cardTheme}`}>
      {outcome === "yes" && <ConfettiRain />}

      {/* 2-Way Live Reply Toast from Sender! */}
      {liveSenderMsg && (
        <div className="pop-toast" onClick={() => setLiveSenderMsg("")}>
          {liveSenderMsg}
        </div>
      )}

      <div className="pop-fs-topbar">
        <span className="pop-pill-black">⚡ ODDORA · FROM {data.creatorName?.toUpperCase()}</span>
        <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); onExit(""); }}>
          ✕
        </button>
      </div>

      <div className="pop-fs-content">
        {sealed ? (
          <div className="pop-seal-card">
            <PopCharacterArt variant={cardTheme} />
            <span className="pop-pill-black">SECRET OD CARD FOR {who.toUpperCase()}</span>
            <h1 className="pop-fs-headline">
              {data.creatorName} sent you something 👀
            </h1>
            <p className="pop-fs-sub">Sound on for the full experience.</p>
            <button type="button" className="pop-btn yellow lg full pop-pulse-btn" onClick={breakSeal}>
              🔓 TAP TO OPEN
            </button>
          </div>
        ) : data.type === "invite" ? (
          outcome === "yes" ? (
            <div className="pop-outcome">
              <PopCharacterArt variant={cardTheme} />
              <div className="pop-outcome-meta">
                <span className="pop-pill-black">
                  {dodges === 0 ? "⚡ INSTANT YES" : `🎉 LOCKED IN · DODGED ${dodges}x`}
                </span>
              </div>
              <div className="pop-sender-hero-msg">
                “{data.payload.yesMessage}”
              </div>

              {!reactionSent ? (
                <form className="pop-react-form" onSubmit={sendReactionNote}>
                  <input value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Reply to ${data.creatorName}...`} maxLength={120} />
                  <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                </form>
              ) : (
                <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
              )}

              <button
                type="button"
                className="pop-btn yellow full"
                onClick={() =>
                  shareReceipt(
                    "OFFICIAL CARD",
                    dodges === 0 ? "ZERO HESITATION! ⚡" : "LOCKED IN! 🎉",
                    `${who} said YES to ${data.creatorName}`,
                    dodges === 0 ? "100% INSTANT YES" : `DODGED ${dodges}x · STILL YES`,
                    data.payload.title
                  )
                }
              >
                <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
              </button>
              <button type="button" className="pop-btn black full" onClick={() => { fx("tap", 12); onExit(data.creatorName); }}>
                ⚡ Trap {data.creatorName} Back
              </button>
            </div>
          ) : (
            <>
              <PopCharacterArt variant={cardTheme} />
              <span className="pop-pill-black">FOR {who.toUpperCase()}</span>
              <h1 className="pop-fs-headline">{data.payload.title}</h1>
              <p className="pop-fs-sub">
                {confirmSure
                  ? "Are you sure? 👀 Not even gonna try No?"
                  : dodges > 0
                    ? "Haha, can't catch it! 😂"
                    : "Bet you can't press No 👀"}
              </p>

              <div className="pop-fs-actions">
                <button
                  type="button"
                  className="pop-btn lime lg"
                  style={{ transform: `scale(${1 + Math.min(dodges, 4) * 0.06})` }}
                  onClick={handleYesTap}
                >
                  {confirmSure ? "Yes, 100% sure! ⚡" : data.payload.yesLabel}
                </button>
                <button
                  type="button"
                  className={converted ? "pop-btn lime lg" : `pop-btn pink lg ${noPos ? "pop-fs-free-no" : ""}`}
                  style={noPos && !converted ? { left: `${noPos.left}px`, top: `${noPos.top}px` } : {}}
                  onMouseEnter={() => { if (!converted && dodges < 1) handleFullScreenDodge(); }}
                  onClick={handleFullScreenDodge}
                >
                  {noButtonText}
                </button>
              </div>
            </>
          )
        ) : (
          /* OD - TRICK (3-STEP) */
          (() => {
            const p = data.payload;
            const qs = p.questions || [];
            if (propStep < qs.length) {
              return (
                <>
                  <PopCharacterArt variant={cardTheme} />
                  <span className="pop-pill-black">STEP {propStep + 1} OF {qs.length + 1}</span>
                  <h1 className="pop-fs-headline">{qs[propStep].q}</h1>
                  <div className="pop-q-list">
                    {qs[propStep].options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="pop-btn white full"
                        onClick={() => {
                          fx("tap", 12);
                          pushLiveEvent(`👉 ${who} answered Step ${propStep + 1}: “${opt}”`);
                          setPropStep(s => s + 1);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              );
            }
            if (propStep === qs.length) {
              return (
                <>
                  <PopCharacterArt variant={cardTheme} />
                  <span className="pop-pill-black">FINAL QUESTION</span>
                  <h1 className="pop-fs-headline">{p.finalQuestion}</h1>
                  {confirmSure && <p className="pop-fs-sub">Are you 100% sure? 👀</p>}
                  <div className="pop-fs-actions">
                    <button
                      type="button"
                      className="pop-btn lime lg"
                      onClick={() => {
                        if (!confirmSure) {
                          fx("tap", 14);
                          setConfirmSure(true);
                          return;
                        }
                        fx("win", [25, 40, 25]);
                        setOutcome("yes");
                        onPendingUpdate?.(null);
                        pushLiveEvent(`💞 ${who} ACCEPTED your OD - Trick!`);
                        signInPlayer().catch(() => null).finally(() => {
                          push(ref(database, `replies/${code}`), { text: "Accepted! 💞", from: who, createdAt: Date.now() }).catch(() => {});
                          runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
                        });
                        setPropStep(qs.length + 1);
                      }}
                    >
                      {confirmSure ? "Yes, 100% sure! 💖" : p.yesLabel}
                    </button>
                    <button
                      type="button"
                      className="pop-btn pink lg"
                      onClick={() => {
                        fx("prank", [30, 40, 30]);
                        setOutcome("pranked");
                        onPendingUpdate?.(null);
                        pushLiveEvent(`💀 ${who} clicked NO & got caught in the OD - Trick!`);
                        setPropStep(qs.length + 2);
                      }}
                    >
                      {p.noLabel}
                    </button>
                  </div>
                </>
              );
            }
            if (propStep === qs.length + 1) {
              return (
                <div className="pop-outcome">
                  <PopCharacterArt variant={cardTheme} />
                  <span className="pop-pill-black">💞 ACCEPTED</span>
                  <div className="pop-sender-hero-msg">
                    “{p.yesAckMessage}”
                  </div>
                  {!reactionSent ? (
                    <form className="pop-react-form" onSubmit={sendReactionNote}>
                      <input value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Reply to ${data.creatorName}...`} maxLength={120} />
                      <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                    </form>
                  ) : (
                    <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
                  )}
                  <button
                    type="button"
                    className="pop-btn yellow full"
                    onClick={() => shareReceipt("OFFICIAL RECEIPT", "I ACCEPTED! 💞", `${who} accepted ${data.creatorName}'s card`, "LOCKED IN 💞", p.finalQuestion)}
                  >
                    <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
                  </button>
                  <button type="button" className="pop-btn black full" onClick={() => { fx("tap", 12); onExit(data.creatorName); }}>
                    ⚡ Create Your Own OD
                  </button>
                </div>
              );
            }
            return (
              <div className="pop-outcome">
                <PopCharacterArt variant={cardTheme} />
                <span className="pop-pill-black">😂 PRANKED BY {data.creatorName?.toUpperCase()}</span>
                <div className="pop-sender-hero-msg">
                  “{p.noTwistMessage}”
                </div>
                {!reactionSent ? (
                  <form className="pop-react-form" onSubmit={sendReactionNote}>
                    <input value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Reply to ${data.creatorName}...`} maxLength={120} />
                    <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                  </form>
                ) : (
                  <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
                )}
                <button
                  type="button"
                  className="pop-btn yellow full"
                  onClick={() => shareReceipt("PRANK RECEIPT", "I GOT PRANKED! 😂", `I got pranked by ${data.creatorName} on ODDORA!`, `PRANKED BY ${data.creatorName?.toUpperCase()} 💀`, p.finalQuestion)}
                >
                  <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
                </button>
                <button type="button" className="pop-btn black full" onClick={() => { fx("tap", 12); onExit(data.creatorName); }}>
                  ⚡ Trick {data.creatorName} Back
                </button>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   10. OD DUELS HUB
============================================================================ */
function DuelsHub({ initialGame = "", initialCode = "", onClearRoute }) {
  const [game, setGame] = useState(initialGame || "xo");
  useEffect(() => { if (initialGame) setGame(initialGame); }, [initialGame]);

  return (
    <section className="pop-box">
      <div className="pop-sub-tabs three">
        <button type="button" className={game === "xo" ? "pop-sub-tab active" : "pop-sub-tab"} onClick={() => { fx("tap", 10); setGame("xo"); onClearRoute?.(); }}>❎ XO Series</button>
        <button type="button" className={game === "heart" ? "pop-sub-tab active" : "pop-sub-tab"} onClick={() => { fx("tap", 10); setGame("heart"); onClearRoute?.(); }}>💘 Heart Sync</button>
        <button type="button" className={game === "tap" ? "pop-sub-tab active" : "pop-sub-tab"} onClick={() => { fx("tap", 10); setGame("tap"); onClearRoute?.(); }}>⚡ Tap Trap 30s</button>
      </div>
      {game === "xo" && <XODuelArena initialCode={initialGame === "xo" ? initialCode : ""} />}
      {game === "heart" && <HeartSyncArena initialCode={initialGame === "heart" ? initialCode : ""} />}
      {game === "tap" && <TapTrapArena initialCode={initialGame === "tap" ? initialCode : ""} />}
    </section>
  );
}

function ModeSwitcher({ mode, setMode }) {
  return (
    <div className="pop-mode-switch">
      <button type="button" className={mode === "multi" ? "pop-mode-btn active" : "pop-mode-btn"} onClick={() => { fx("tap", 10); setMode("multi"); }}><Users size={15}/> 1v1 Friend</button>
      <button type="button" className={mode === "solo" ? "pop-mode-btn active" : "pop-mode-btn"} onClick={() => { fx("tap", 10); setMode("solo"); }}><Bot size={15}/> Solo vs AI</button>
    </div>
  );
}

function getSmartAIMove(board) {
  const empty = board.map((v, i) => (v === "" ? i : null)).filter(v => v !== null);
  if (empty.length === 0) return -1;
  for (const idx of empty) { const t = [...board]; t[idx] = "O"; if (XO_WIN_LINES.some(l => l.every(c => t[c] === "O"))) return idx; }
  for (const idx of empty) { const t = [...board]; t[idx] = "X"; if (XO_WIN_LINES.some(l => l.every(c => t[c] === "X"))) return idx; }
  if (board[4] === "" && Math.random() > 0.25) return 4;
  return empty[Math.floor(Math.random() * empty.length)];
}

function XODuelArena({ initialCode = "" }) {
  const [mode, setMode] = useState("multi");
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [soloBoard, setSoloBoard] = useState(Array(9).fill(""));
  const [soloWin, setSoloWin] = useState("");
  const [soloWait, setSoloWait] = useState(false);

  useEffect(() => {
    let alive = true;
    signInPlayer().then(cred => {
      if (!alive) return;
      const myUid = cred.user.uid;
      setUid(myUid);
      if (initialCode && initialCode.length === 6) {
        get(ref(database, `rooms/${initialCode}`)).then(snap => {
          if (!alive || !snap.exists()) return;
          const r = snap.val();
          if (r.players?.X === myUid || r.players?.O === myUid) { setRoomCode(initialCode); setRoom(r); }
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [initialCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    return onValue(ref(database, `rooms/${roomCode}`), snap => {
      if (snap.exists()) setRoom(snap.val());
      else { setRoom(null); setRoomCode(""); }
    });
  }, [roomCode]);

  const clean = v => v.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createRoom() {
    const n = clean(name);
    if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = ""; let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        exists = (await get(ref(database, `rooms/${code}`))).exists();
      }
      await set(ref(database, `rooms/${code}`), {
        gameType: "xo", board: Array(9).fill(""), turn: "X",
        players: { X: uid, O: "" }, playerNames: { X: n, O: "" },
        seriesScore: { X: 0, O: 0 }, taunt: "", status: "waiting", winner: "", round: 1, createdAt: Date.now()
      });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("xo", code);
      window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const n = clean(name); const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !n || code.length !== 6) return;
    setBusy(true);
    try {
      const rRef = ref(database, `rooms/${code}`);
      const snap = await get(rRef);
      if (!snap.exists()) throw new Error("Room not found");
      const existing = snap.val();
      await runTransaction(rRef, cur => {
        const r = cur || existing;
        if (!r || !Array.isArray(r.board)) return;
        if (r.players?.X === uid) return r;
        if (r.players?.O === uid) return { ...r, playerNames: { ...(r.playerNames || {}), O: n } };
        if (r.players?.O) return;
        return { ...r, players: { ...r.players, O: uid }, playerNames: { ...(r.playerNames || {}), O: n }, status: "playing" };
      });
      setRoomCode(code);
    } catch (e) { setStatus(e.message || "Could not join"); } finally { setBusy(false); }
  }

  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";

  async function playMove(idx) {
    if (!roomCode || !mySide || room?.status !== "playing" || room?.turn !== mySide || room?.board?.[idx]) return;
    fx("tap", 12);
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur || cur.status !== "playing" || cur.turn !== mySide || cur.board?.[idx]) return;
      const b = [...cur.board]; b[idx] = mySide;
      const win = XO_WIN_LINES.some(l => l.every(c => b[c] === mySide));
      const draw = !win && b.every(Boolean);
      const scores = { X: cur.seriesScore?.X || 0, O: cur.seriesScore?.O || 0 };
      if (win) scores[mySide] += 1;
      return { ...cur, board: b, turn: mySide === "X" ? "O" : "X", seriesScore: scores, status: win || draw ? "finished" : "playing", winner: win ? mySide : draw ? "draw" : "" };
    });
  }

  async function nextRound() {
    if (!roomCode || !mySide) return;
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur) return;
      return { ...cur, board: Array(9).fill(""), turn: (cur.round || 1) % 2 === 1 ? "O" : "X", status: "playing", winner: "", round: (cur.round || 1) + 1 };
    });
  }

  function leaveRoom() {
    setRoomCode(""); setRoom(null); setJoinCode("");
    const u = new URL(window.location.href); u.searchParams.delete("xo");
    window.history.replaceState({}, "", u.toString());
  }

  function playSolo(idx) {
    if (soloBoard[idx] || soloWin || soloWait) return;
    fx("tap", 12);
    const b = [...soloBoard]; b[idx] = "X"; setSoloBoard(b);
    if (XO_WIN_LINES.some(l => l.every(c => b[c] === "X"))) { setSoloWin("X"); fx("win", 20); return; }
    if (b.every(Boolean)) { setSoloWin("draw"); return; }
    setSoloWait(true);
    setTimeout(() => {
      const ai = getSmartAIMove(b);
      if (ai >= 0) b[ai] = "O";
      setSoloBoard([...b]); setSoloWait(false);
      if (XO_WIN_LINES.some(l => l.every(c => b[c] === "O"))) setSoloWin("O");
      else if (b.every(Boolean)) setSoloWin("draw");
    }, 340);
  }

  const shareUrl = (() => { const u = new URL(window.location.href); u.search = ""; if (roomCode) u.searchParams.set("xo", roomCode); return u.toString(); })();

  return (
    <div className="pop-stack">
      <ModeSwitcher mode={mode} setMode={setMode} />
      {mode === "solo" ? (
        <>
          <div className="pop-grid-board">{soloBoard.map((c, i) => <button key={i} type="button" className={`pop-cell ${c.toLowerCase()}`} onClick={() => playSolo(i)}>{c}</button>)}</div>
          {soloWin && <div className="pop-banner-row"><strong>{soloWin === "X" ? "You won! 🎉" : soloWin === "O" ? "Bot won 🤖" : "Draw 🤝"}</strong><button type="button" className="pop-btn yellow sm" onClick={() => { setSoloBoard(Array(9).fill("")); setSoloWin(""); }}>Again</button></div>}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field"><span>YOUR NAME</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/></label>
          {initialCode ? (
            <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={joinRoom}>{busy ? "Joining..." : "Join Partner's Game"}</button>
          ) : (
            <>
              <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={createRoom}>{busy ? "Creating..." : "⚡ Create 1v1 Room"}</button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline">
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-CHAR CODE" maxLength={6}/>
                <button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinRoom}>Join</button>
              </div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={room?.turn === "X" ? "pop-sb active" : "pop-sb"}><small>X · {room?.playerNames?.X || "Host"}</small><strong>{room?.seriesScore?.X || 0}</strong></div>
            <div className="pop-sb-mid"><span>R{room?.round || 1}</span><small>{roomCode}</small></div>
            <div className={room?.turn === "O" ? "pop-sb active" : "pop-sb"}><small>O · {room?.playerNames?.O || "Waiting..."}</small><strong>{room?.seriesScore?.O || 0}</strong></div>
          </div>
          {room?.taunt && <div className="pop-taunt-bar-live">{room.taunt}</div>}
          <div className="pop-status-pill">{room?.status === "waiting" ? "Waiting for friend to join..." : room?.status === "finished" ? (room.winner === "draw" ? "Draw! 🤝" : `${room?.playerNames?.[room.winner] || room.winner} wins! 🔥`) : room?.turn === mySide ? "Your turn ⚡" : `Waiting for ${room?.playerNames?.[room.turn] || "friend"}...`}</div>
          <div className="pop-grid-board">{(room?.board || Array(9).fill("")).map((c, i) => <button key={i} type="button" className={`pop-cell ${c.toLowerCase()}`} disabled={room?.status !== "playing" || room?.turn !== mySide || Boolean(c)} onClick={() => playMove(i)}>{c}</button>)}</div>
          <div className="pop-chips-row center">{DUEL_TAUNTS.map(t => <button key={t} type="button" className="pop-chip" onClick={() => { fx("tap", 10); set(ref(database, `rooms/${roomCode}/taunt`), `${room?.playerNames?.[mySide] || mySide}: ${t}`).catch(() => {}); }}>{t}</button>)}</div>
          {room?.status === "finished" && <button type="button" className="pop-btn yellow full" onClick={nextRound}>Next Round →</button>}
          {room?.status === "waiting" && <UniversalShareBar url={shareUrl} shareText={`${room?.playerNames?.X || name} challenged you to 1v1 XO on ODDORA! ❎⭕`} title="ODDORA XO Duel" />}
          <button type="button" className="pop-btn white full" onClick={leaveRoom}>Leave Room</button>
        </>
      )}
    </div>
  );
}

function HeartSyncArena({ initialCode = "" }) {
  const [mode, setMode] = useState("multi");
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pick, setPick] = useState(null);
  const [aiPick, setAiPick] = useState(null);
  const [tries, setTries] = useState(0);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    let alive = true;
    signInPlayer().then(cred => {
      if (!alive) return;
      const myUid = cred.user.uid; setUid(myUid);
      if (initialCode && initialCode.length === 6) {
        get(ref(database, `rooms/${initialCode}`)).then(snap => {
          if (!alive || !snap.exists()) return;
          const r = snap.val();
          if (r.gameType === "heart" && (r.players?.X === myUid || r.players?.O === myUid)) { setRoomCode(initialCode); setRoom(r); }
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [initialCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    return onValue(ref(database, `rooms/${roomCode}`), snap => {
      if (snap.exists()) setRoom(snap.val());
      else { setRoom(null); setRoomCode(""); }
    });
  }, [roomCode]);

  const clean = v => v.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createHeartRoom() {
    const n = clean(name); if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = ""; let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) { code = Math.random().toString(36).slice(2, 8).toUpperCase(); exists = (await get(ref(database, `rooms/${code}`))).exists(); }
      await set(ref(database, `rooms/${code}`), { gameType: "heart", players: { X: uid, O: "" }, playerNames: { X: n, O: "" }, choices: { X: -1, O: -1 }, attempts: 0, status: "waiting", round: 1, createdAt: Date.now() });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("heart", code); window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinHeartRoom() {
    const n = clean(name); const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !n || code.length !== 6) return;
    setBusy(true);
    try {
      const rRef = ref(database, `rooms/${code}`); const snap = await get(rRef);
      if (!snap.exists()) throw new Error("Room not found");
      const existing = snap.val(); if (existing.gameType !== "heart") throw new Error("Wrong game code");
      await runTransaction(rRef, cur => {
        const r = cur || existing; if (!r || r.gameType !== "heart") return;
        if (r.players?.X === uid) return r;
        if (r.players?.O === uid) return { ...r, playerNames: { ...(r.playerNames || {}), O: n } };
        if (r.players?.O) return;
        return { ...r, players: { ...r.players, O: uid }, playerNames: { ...(r.playerNames || {}), O: n }, choices: { X: -1, O: -1 }, attempts: 0, status: "playing" };
      });
      setRoomCode(code);
    } catch (e) { setStatus(e.message || "Could not join"); } finally { setBusy(false); }
  }

  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";

  async function pickMultiHeart(idx) {
    if (!roomCode || !mySide || room?.status !== "playing") return;
    fx("tap", 14);
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur || cur.status !== "playing") return;
      const choices = { ...(cur.choices || { X: -1, O: -1 }), [mySide]: idx };
      const attempts = Number(cur.attempts || 0) + 1;
      const isMatch = choices.X >= 0 && choices.O >= 0 && choices.X === choices.O;
      return { ...cur, choices, attempts, status: isMatch ? "finished" : "playing" };
    });
  }

  async function rematchHeart() {
    if (!roomCode || !mySide) return;
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur) return;
      return { ...cur, choices: { X: -1, O: -1 }, attempts: 0, status: "playing", round: (cur.round || 1) + 1 };
    });
  }

  function leaveHeartRoom() { setRoomCode(""); setRoom(null); setJoinCode(""); const u = new URL(window.location.href); u.searchParams.delete("heart"); window.history.replaceState({}, "", u.toString()); }

  function tapSoloHeart(i) {
    if (matched) return;
    fx("tap", 14);
    const bot = Math.floor(Math.random() * HEART_CHOICES.length);
    setPick(i); setAiPick(bot); setTries(t => t + 1);
    if (i === bot) { setMatched(true); fx("win", [25, 40, 25]); }
  }

  const shareUrl = (() => { const u = new URL(window.location.href); u.search = ""; if (roomCode) u.searchParams.set("heart", roomCode); return u.toString(); })();
  const myPick = mySide ? room?.choices?.[mySide] : -1;
  const syncScore = Math.max(20, 100 - Math.max(0, Number(room?.attempts || 2) - 2) * 6);

  return (
    <div className="pop-stack">
      <ModeSwitcher mode={mode} setMode={setMode} />
      {mode === "solo" ? (
        <>
          <div className="pop-status-pill">{matched ? `💞 SYNC SCORE: ${Math.max(15, 100 - Math.max(0, tries - 1) * 7)}%` : pick !== null ? `You: ${HEART_CHOICES[pick]} · AI: ${HEART_CHOICES[aiPick]}` : "Match the same heart as AI 💘"}</div>
          <div className="pop-grid-board">{HEART_CHOICES.map((h, i) => <button key={h} type="button" className={pick === i ? "pop-cell active" : "pop-cell"} onClick={() => tapSoloHeart(i)}>{h}</button>)}</div>
          {matched && <button type="button" className="pop-btn pink full" onClick={() => { setPick(null); setAiPick(null); setTries(0); setMatched(false); }}><RotateCcw size={15}/> Again</button>}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field"><span>YOUR NAME</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/></label>
          {initialCode ? <button type="button" className="pop-btn pink full" disabled={!uid || busy || !clean(name)} onClick={joinHeartRoom}>{busy ? "Joining..." : "Join Partner's Heart Sync"}</button> : (
            <>
              <button type="button" className="pop-btn pink full" disabled={!uid || busy || !clean(name)} onClick={createHeartRoom}>{busy ? "Creating..." : "💘 Start 1v1 Heart Sync"}</button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline"><input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-CHAR CODE" maxLength={6}/><button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinHeartRoom}>Join</button></div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={mySide === "X" ? "pop-sb active" : "pop-sb"}><small>{room?.playerNames?.X || "Player 1"}</small><strong>{room?.choices?.X >= 0 ? "💗" : "⏳"}</strong></div>
            <div className="pop-sb-mid"><span>R{room?.round || 1}</span><small>{roomCode}</small></div>
            <div className={mySide === "O" ? "pop-sb active" : "pop-sb"}><small>{room?.playerNames?.O || "Waiting..."}</small><strong>{room?.choices?.O >= 0 ? "💗" : "⏳"}</strong></div>
          </div>
          {room?.status === "waiting" ? (
            <><div className="pop-status-pill">Waiting for friend to join... 💌</div><UniversalShareBar url={shareUrl} shareText={`${room?.playerNames?.X || name} sent you a 1v1 Heart Sync challenge on ODDORA! 💘`} title="ODDORA Heart Sync" /></>
          ) : room?.status === "finished" ? (
            <div className="pop-ready-card"><div className="pop-big-emoji">💞</div><h2>{syncScore}% IN SYNC!</h2><p className="pop-muted">Matched on {HEART_CHOICES[room?.choices?.X || 0]} in {room?.attempts} picks!</p><button type="button" className="pop-btn pink full" onClick={rematchHeart}>↻ Play Another Round</button></div>
          ) : (
            <><div className="pop-status-pill">Pick the exact same heart as {room?.playerNames?.[mySide === "X" ? "O" : "X"] || "partner"}!</div><div className="pop-grid-board">{HEART_CHOICES.map((h, i) => <button key={h} type="button" className={myPick === i ? "pop-cell active" : "pop-cell"} onClick={() => pickMultiHeart(i)}>{h}</button>)}</div></>
          )}
          <button type="button" className="pop-btn white full" onClick={leaveHeartRoom}>Leave Room</button>
        </>
      )}
    </div>
  );
}

function TapTrapArena({ initialCode = "" }) {
  const [mode, setMode] = useState("multi");
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mpScore, setMpScore] = useState(0);
  const [mpTime, setMpTime] = useState(30);
  const [mpCells, setMpCells] = useState(Array(9).fill(null));
  const mpScoreRef = useRef(0);
  const [active, setActive] = useState(false);
  const [over, setOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [cells, setCells] = useState(Array(9).fill(null));

  useEffect(() => {
    let alive = true;
    signInPlayer().then(cred => {
      if (!alive) return;
      const myUid = cred.user.uid; setUid(myUid);
      if (initialCode && initialCode.length === 6) {
        get(ref(database, `rooms/${initialCode}`)).then(snap => {
          if (!alive || !snap.exists()) return;
          const r = snap.val();
          if (r.gameType === "tap" && (r.players?.X === myUid || r.players?.O === myUid)) { setRoomCode(initialCode); setRoom(r); }
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [initialCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    return onValue(ref(database, `rooms/${roomCode}`), snap => {
      if (snap.exists()) setRoom(snap.val());
      else { setRoom(null); setRoomCode(""); }
    });
  }, [roomCode]);

  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";

  useEffect(() => {
    if (!roomCode || room?.status !== "playing" || !room?.endsAt) return undefined;
    const spawn = () => {
      const next = Array(9).fill(null); const t = Math.floor(Math.random() * 9); let b = Math.floor(Math.random() * 9);
      while (b === t) b = Math.floor(Math.random() * 9);
      next[t] = Math.random() < 0.2 ? "bonus" : "target"; next[b] = Math.random() < 0.38 ? "trap" : "target";
      setMpCells(next);
    };
    spawn();
    const sp = setInterval(spawn, 650);
    const ck = setInterval(() => {
      const rem = Math.max(0, Math.ceil((Number(room.endsAt) - Date.now()) / 1000)); setMpTime(rem);
      if (rem === 0) {
        runTransaction(ref(database, `rooms/${roomCode}`), cur => {
          if (!cur || cur.status !== "playing") return;
          const sc = { ...(cur.scores || { X: 0, O: 0 }) };
          if (mySide) sc[mySide] = Math.max(Number(sc[mySide] || 0), mpScoreRef.current);
          return { ...cur, scores: sc, status: "finished" };
        }).catch(() => {});
      }
    }, 250);
    return () => { clearInterval(sp); clearInterval(ck); };
  }, [roomCode, room?.status, room?.endsAt, mySide]);

  const clean = v => v.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createTapRoom() {
    const n = clean(name); if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = ""; let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) { code = Math.random().toString(36).slice(2, 8).toUpperCase(); exists = (await get(ref(database, `rooms/${code}`))).exists(); }
      mpScoreRef.current = 0; setMpScore(0);
      await set(ref(database, `rooms/${code}`), { gameType: "tap", players: { X: uid, O: "" }, playerNames: { X: n, O: "" }, scores: { X: 0, O: 0 }, status: "waiting", round: 1, createdAt: Date.now() });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("tap", code); window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinTapRoom() {
    const n = clean(name); const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !n || code.length !== 6) return;
    setBusy(true);
    try {
      const rRef = ref(database, `rooms/${code}`); const snap = await get(rRef);
      if (!snap.exists()) throw new Error("Room not found");
      const existing = snap.val(); if (existing.gameType !== "tap") throw new Error("Wrong game code");
      await runTransaction(rRef, cur => {
        const r = cur || existing; if (!r || r.gameType !== "tap") return;
        if (r.players?.X === uid) return r;
        if (r.players?.O === uid) return { ...r, playerNames: { ...(r.playerNames || {}), O: n } };
        if (r.players?.O) return;
        return { ...r, players: { ...r.players, O: uid }, playerNames: { ...(r.playerNames || {}), O: n }, scores: { X: 0, O: 0 }, endsAt: Date.now() + 30000, status: "playing" };
      });
      mpScoreRef.current = 0; setMpScore(0); setRoomCode(code);
    } catch (e) { setStatus(e.message || "Could not join"); } finally { setBusy(false); }
  }

  function tapMpCell(i) {
    if (!roomCode || !mySide || room?.status !== "playing") return;
    const type = mpCells[i]; if (!type) return;
    const copy = [...mpCells]; copy[i] = null; setMpCells(copy);
    const delta = type === "trap" ? -15 : type === "bonus" ? 25 : 10;
    const next = Math.max(0, mpScoreRef.current + delta); mpScoreRef.current = next; setMpScore(next);
    fx(type === "trap" ? "prank" : "tap", type === "trap" ? [30, 30] : 10);
    set(ref(database, `rooms/${roomCode}/scores/${mySide}`), next).catch(() => {});
  }

  async function rematchTap() {
    if (!roomCode || !mySide) return;
    mpScoreRef.current = 0; setMpScore(0);
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => { if (!cur) return; return { ...cur, scores: { X: 0, O: 0 }, endsAt: Date.now() + 30000, status: "playing", round: (cur.round || 1) + 1 }; });
  }

  function leaveTapRoom() { setRoomCode(""); setRoom(null); setJoinCode(""); const u = new URL(window.location.href); u.searchParams.delete("tap"); window.history.replaceState({}, "", u.toString()); }

  useEffect(() => {
    if (mode !== "solo" || !active || over) return undefined;
    const spawn = () => {
      const next = Array(9).fill(null); const t = Math.floor(Math.random() * 9); let b = Math.floor(Math.random() * 9);
      while (b === t) b = Math.floor(Math.random() * 9);
      next[t] = Math.random() < 0.2 ? "bonus" : "target"; next[b] = Math.random() < 0.35 ? "trap" : "target"; setCells(next);
    };
    spawn(); const sp = setInterval(spawn, 650);
    const ck = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { clearInterval(sp); clearInterval(ck); setActive(false); setOver(true); return 0; } return prev - 1; }); }, 1000);
    return () => { clearInterval(sp); clearInterval(ck); };
  }, [mode, active, over]);

  function startSolo() { fx("tap", 14); setLives(3); setScore(0); setTimeLeft(30); setOver(false); setActive(true); }
  function tapSoloCell(i) {
    if (!active || over) return; const type = cells[i]; if (!type) return;
    const copy = [...cells]; copy[i] = null; setCells(copy);
    if (type === "trap") { fx("prank", [30, 40, 30]); setLives(l => { if (l - 1 <= 0) { setActive(false); setOver(true); return 0; } return l - 1; }); }
    else { fx("tap", 10); setScore(s => s + (type === "bonus" ? 25 : 10)); }
  }

  const shareUrl = (() => { const u = new URL(window.location.href); u.search = ""; if (roomCode) u.searchParams.set("tap", roomCode); return u.toString(); })();
  const sX = mySide === "X" ? mpScore : Number(room?.scores?.X || 0);
  const sO = mySide === "O" ? mpScore : Number(room?.scores?.O || 0);

  return (
    <div className="pop-stack">
      <ModeSwitcher mode={mode} setMode={setMode} />
      {mode === "solo" ? (
        <>
          <div className="pop-scoreboard">
            <div className="pop-sb"><small>LIVES</small><strong>{"❤️".repeat(lives) || "💀"}</strong></div>
            <div className="pop-sb-mid"><span>SCORE</span><strong>{score}</strong></div>
            <div className="pop-sb"><small>CLOCK</small><strong>00:{String(timeLeft).padStart(2, "0")}</strong></div>
          </div>
          {!active && !over ? <button type="button" className="pop-btn yellow full" onClick={startSolo}><Zap size={16}/> Start Solo Sprint</button> : over ? <div className="pop-ready-card"><h3>Score: {score} PTS ⚡</h3><button type="button" className="pop-btn yellow" onClick={startSolo}>Again</button></div> : <div className="pop-grid-board">{cells.map((c, i) => <button key={i} type="button" className={`pop-cell ${c ? `is-${c}` : ""}`} onClick={() => tapSoloCell(i)}>{c === "target" ? "⚡" : c === "bonus" ? "💎" : c === "trap" ? "💣" : ""}</button>)}</div>}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field"><span>YOUR NAME</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/></label>
          {initialCode ? <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={joinTapRoom}>{busy ? "Joining..." : "Join 30s Battle"}</button> : (
            <>
              <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={createTapRoom}>{busy ? "Creating..." : "⚡ Start 1v1 Tap Battle"}</button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline"><input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-CHAR CODE" maxLength={6}/><button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinTapRoom}>Join</button></div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={mySide === "X" ? "pop-sb active" : "pop-sb"}><small>{room?.playerNames?.X || "Player 1"}</small><strong>{sX}</strong></div>
            <div className="pop-sb-mid"><span>{room?.status === "playing" ? `00:${String(mpTime).padStart(2, "0")}` : `R${room?.round || 1}`}</span><small>{roomCode}</small></div>
            <div className={mySide === "O" ? "pop-sb active" : "pop-sb"}><small>{room?.playerNames?.O || "Waiting..."}</small><strong>{sO}</strong></div>
          </div>
          {room?.status === "waiting" ? <><div className="pop-status-pill">Waiting for friend to join... ⚡</div><UniversalShareBar url={shareUrl} shareText={`${room?.playerNames?.X || name} challenged you to a 30s Tap Trap battle on ODDORA! ⚡`} title="ODDORA Tap Trap" /></> : room?.status === "finished" ? <div className="pop-ready-card"><div className="pop-big-emoji">🏆</div><h2>{sX === sO ? "TIE!" : sX > sO ? `${room?.playerNames?.X || "P1"} WINS!` : `${room?.playerNames?.O || "P2"} WINS!`}</h2><button type="button" className="pop-btn yellow full" onClick={rematchTap}>↻ Rematch (30s)</button></div> : <div className="pop-grid-board">{mpCells.map((c, i) => <button key={i} type="button" className={`pop-cell ${c ? `is-${c}` : ""}`} onClick={() => tapMpCell(i)}>{c === "target" ? "⚡" : c === "bonus" ? "💎" : c === "trap" ? "💣" : ""}</button>)}</div>}
          <button type="button" className="pop-btn white full" onClick={leaveTapRoom}>Leave Room</button>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   11. COMMUNITY FLEX WALL
============================================================================ */
function FlexWall({ topCreators }) {
  const [posts, setPosts] = useState([
    { id: "p1", name: "Kavya", mood: "💀", text: "Sent the OD - Trap to my bestie and watched her chase No 4 times live 😂" },
    { id: "p2", name: "Siddharth", mood: "🌍", text: "Me and my girlfriend in London play XO Best-of-5 every night!" },
    { id: "p3", name: "Neha", mood: "💘", text: "Dropped an OD - Trick link and he posted the receipt on his story!" }
  ]);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("🔥");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return onValue(ref(database, "vibes"), snap => {
      if (!snap.exists()) return;
      const list = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v })).filter(v => v && v.text && v.name).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
      if (list.length > 0) setPosts(list);
    }, () => {});
  }, []);

  async function postFlex(e) {
    e.preventDefault();
    const cleanText = text.trim().slice(0, 140); const cleanName = (name.trim() || "Anonymous").slice(0, 20);
    if (!cleanText || sending) return;
    setSending(true); fx("tap", 12);
    const item = { name: cleanName, mood, text: cleanText, createdAt: Date.now() };
    try { await signInPlayer().catch(() => null); await push(ref(database, "vibes"), item); setText(""); }
    catch { setPosts(prev => [{ id: `l-${Date.now()}`, ...item }, ...prev]); setText(""); }
    finally { setSending(false); }
  }

  return (
    <section className="pop-box">
      <div className="pop-box-head"><span>🔥 LIVE FLEX WALL</span><span className="pop-pill-black">{topCreators.reduce((a, b) => a + b.count, 0)}+ CARDS</span></div>
      <form className="pop-stack" onSubmit={postFlex}>
        <div className="pop-chips-row">{["🔥", "💀", "💘", "🌍", "😂"].map(m => <button key={m} type="button" className={mood === m ? "pop-chip active" : "pop-chip"} onClick={() => { fx("tap", 8); setMood(m); }}>{m}</button>)}</div>
        <div className="pop-grid-2">
          <input value={name} onChange={e => setName(e.target.value)} onFocus={focusScrollCenter} placeholder="Your name" maxLength={20}/>
          <input value={text} onChange={e => setText(e.target.value)} onFocus={focusScrollCenter} placeholder="Drop your reaction..." maxLength={140}/>
        </div>
        <button type="submit" className="pop-btn yellow full" disabled={!text.trim() || sending}><Send size={15}/> {sending ? "Posting..." : "Post Flex"}</button>
      </form>
      <div className="pop-stack">
        {posts.map(p => <div className="pop-wall-card" key={p.id}><div className="pop-row-between"><span>{p.mood || "⚡"} <strong>{p.name}</strong></span><span className="pop-pill-black">DO OD</span></div><p>“{p.text}”</p></div>)}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <SafeBoundary>
      <MainApp />
    </SafeBoundary>
  );
}
