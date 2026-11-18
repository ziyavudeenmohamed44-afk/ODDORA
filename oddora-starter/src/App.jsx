import React, { Component, useEffect, useRef, useState } from "react";
import {
  Share2, RotateCcw, Bot, Users, Send,
  Zap, Check, Copy, Trophy, X, Inbox
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, onValue, push, ref, runTransaction, set } from "firebase/database";

/* ============================================================================
   0. SAFE STORAGE, CANVAS POLYFILL & CATCHY POP ARCADE SOUND ENGINE
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
      tap: [
        { f: 580, d: 0.055, v: 0.11, w: "triangle", slide: 840 }
      ],
      dodge: [
        { f: 320, d: 0.08, v: 0.12, w: "sine", slide: 690 },
        { f: 740, d: 0.07, v: 0.08, w: "triangle", delay: 0.05, slide: 520 }
      ],
      win: [
        { f: 523.25, d: 0.12, v: 0.13, w: "triangle" },
        { f: 659.25, d: 0.12, v: 0.13, w: "triangle", delay: 0.09 },
        { f: 783.99, d: 0.14, v: 0.14, w: "triangle", delay: 0.18 },
        { f: 1046.5, d: 0.28, v: 0.15, w: "sine", delay: 0.27 }
      ],
      prank: [
        { f: 440, d: 0.14, v: 0.13, w: "sawtooth", slide: 390 },
        { f: 370, d: 0.16, v: 0.13, w: "sawtooth", delay: 0.14, slide: 260 }
      ],
      notify: [
        { f: 880, d: 0.11, v: 0.14, w: "sine" },
        { f: 1174.66, d: 0.22, v: 0.15, w: "triangle", delay: 0.1 }
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
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

function fx(soundKind = "tap", hapticPattern = 14) {
  playPopSound(soundKind);
  triggerHaptic(hapticPattern);
}

/* ============================================================================
   1. ERROR BOUNDARY (Prevents iOS Safari White-Screen Crashes)
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
   2. ILLUSTRATED CHARACTER STICKERS
============================================================================ */
function PopCharacterArt({ variant = "treat" }) {
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

/* ============================================================================
   3. UNIVERSAL 3-WAY SHARE BAR (Copy + Share + WhatsApp)
============================================================================ */
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
        {copied ? <><Check size={15}/> Copied</> : <><Copy size={15}/> Copy Link</>}
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
   4. PRESETS & CONTEXT-AWARE QUESTION BANK (Supports Fight/Funny/Tamil/Custom!)
============================================================================ */
const INVITE_PRESETS = [
  {
    id: "treat",
    tag: "🍕 Treat Trap",
    cardColor: "lime",
    title: "You owe me food today 🍕",
    question: "Tap your answer before the button runs away!",
    yesLabel: "Fine, I'll pay 💸",
    noLabel: "No",
    yesMessage: "Screenshot locked! See you at the food spot 🍕🔥"
  },
  {
    id: "crush",
    tag: "💘 Coffee Date",
    cardColor: "pink",
    title: "Coffee & late drive tonight? ☕",
    question: "No excuses. Iced coffee & good music?",
    yesLabel: "Lock it in 💘",
    noLabel: "No",
    yesMessage: "It's a date! Send your location ✨🚗"
  },
  {
    id: "ldr",
    tag: "🌍 Miss Me?",
    cardColor: "cyan",
    title: "Admit you miss me right now 👀",
    question: "Miles apart, same braincell. Be honest!",
    yesLabel: "100% Yes 🥺",
    noLabel: "No",
    yesMessage: "Caught in 4K! FaceTime tonight 🌍💞"
  },
  {
    id: "bestie",
    tag: "👑 Bestie Vow",
    cardColor: "gold",
    title: "Ride-or-die for life? 🔒",
    question: "Through chaotic plans & 2 AM rants—still #1?",
    yesLabel: "Always 👑",
    noLabel: "Nah",
    yesMessage: "Best duo certified 🔒👑"
  }
];

const PROPOSE_VIBES = [
  { id: "pink", label: "💘 Crush", defaultQ: "Will you go on a date with me? 💘" },
  { id: "cyan", label: "🌍 Long Distance", defaultQ: "Next time we meet, whole day is mine? 🌍" },
  { id: "gold", label: "👑 Bestie", defaultQ: "Best friends for life—no take-backs? 👑" },
  { id: "lime", label: "⚡ Funny / Dare", defaultQ: "Sandaiku va, sandaiku va da 🔥" }
];

const DODGE_TAUNTS = [
  "Too slow 👀",
  "Nice try 😏",
  "Button glitched ⚡",
  "Why chasing No?! 😂",
  "Almost caught it 🏃‍♂️💨",
  "Can't touch this 🔥"
];

const DUEL_TAUNTS = ["Too slow 💀", "Sweating? 😅", "Calculated 🧠", "Rematch rn 🔥"];

const XO_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const HEART_CHOICES = ["❤️", "💖", "💜", "💙", "💚", "💛", "🧡", "🩷", "🤍"];

function generateWarmupQuestions(mainQuestion, themeId, variantIndex = 0) {
  const q = String(mainQuestion || "").toLowerCase();

  const pools = {
    fight: [
      [
        { q: "1. Pick your weapon for this showdown:", options: ["Sarcasm & Roasts 💀", "Running away fast 🏃‍♂️", "Buying me biryani 🍗"] },
        { q: "2. Honestly, who wins 99% of our fights?", options: ["Obviously Me 👑", "You (by cheating) 🙄", "50-50 Chaos 🤝"] }
      ],
      [
        { q: "1. Ground & time for the battle?", options: ["Right now in DMs ⚡", "After snacks 🍕", "I surrender already 🏳️"] },
        { q: "2. Loser has to treat the winner. Deal?", options: ["Deal, bring it 🔥", "Wait no 💀", "Easy win for me 😎"] }
      ]
    ],
    marry: [
      [
        { q: "1. What's our #1 superpower as a duo?", options: ["Non-stop laughs 😂", "Surviving any chaos 🔥", "Reading each other's mind 🧠"] },
        { q: "2. Ready for lifetime unlimited food dates?", options: ["Born ready 🍕", "Only if you pay 💸", "100% Yes 💍"] }
      ],
      [
        { q: "1. Pick our dream honeymoon vibe:", options: ["Beach sunset 🏝️", "Mountain roadtrip 🏔️", "World food tour 🍜"] },
        { q: "2. Who wins every argument in this house?", options: ["Obviously Me 👑", "50-50 Peace Treaty 🤝", "Whoever buys snacks 🍫"] }
      ]
    ],
    date: [
      [
        { q: "1. Ideal vibe for hanging out tonight?", options: ["Iced coffee + long drive ☕", "Street food hopping 🌮", "Late-night playlist & chill 🎧"] },
        { q: "2. Be honest—how fast do you get ready?", options: ["10 mins flat ⚡", "Fashionably late 😎", "Depends on the person 👀"] }
      ],
      [
        { q: "1. What makes a hangout unforgettable?", options: ["The right company ✨", "Zero awkward silence 💬", "Spontaneous plans 🚀"] },
        { q: "2. Do some connections happen for a reason?", options: ["100% Yes 💫", "Prove it 😏", "Destiny knows 👀"] }
      ]
    ],
    ldr: [
      [
        { q: "1. Hardest part about being miles apart?", options: ["Missing you 🌙", "Can't steal your food 🍟", "Counting days till we meet ✈️"] },
        { q: "2. First thing when we finally link up?", options: ["Long drive 🚗", "Non-stop food tour 🍕", "Hours of talking 💜"] }
      ],
      [
        { q: "1. Our late-night calls usually end with:", options: ["Falling asleep on call 😴", "2 AM overthinking 🌌", "Planning our next trip 🗺️"] },
        { q: "2. Distance test: how much do you miss me?", options: ["1000/10 🥺", "More than sleep 💤", "Too much to admit 👀"] }
      ]
    ],
    bestie: [
      [
        { q: "1. Who brings 90% of the chaotic energy?", options: ["Definitely You 😎", "100% Me 👑", "50-50 Partners in Crime 🤝"] },
        { q: "2. Stuck in traffic for 2 hours—what happens?", options: ["Full carpool concert 🎤", "Non-stop gossip & snacks 🍟", "2 AM life talks 🌌"] }
      ],
      [
        { q: "1. If we start a business together, it's:", options: ["Midnight snack delivery 🍕", "Chaos consulting ⚡", "World travel vlog ✈️"] },
        { q: "2. Rule #1 of this friendship:", options: ["Never snitch 🔒", "Always share food 🍟", "Roast each other daily 💀"] }
      ]
    ]
  };

  let bucket = "date";
  if (/(sandai|fight|clash|va da|vaada|beat|roast|challenge|dare|risk|bet)/i.test(q) || themeId === "lime") bucket = "fight";
  else if (/(marry|wedding|kalyanam|shaadi|wife|husband|forever)/i.test(q)) bucket = "marry";
  else if (themeId === "cyan" || /(miss|distance|meet|flight|london|usa|uk)/i.test(q)) bucket = "ldr";
  else if (themeId === "gold" || /(bestie|friend|bro|machan|machi|nanba|duo)/i.test(q)) bucket = "bestie";

  const list = pools[bucket];
  return list[variantIndex % list.length];
}

function generateSmartOutcomes(questionText, senderName) {
  const q = String(questionText || "").toLowerCase();
  const from = (senderName || "your friend").trim();

  if (/(sandai|fight|clash|va da|vaada|beat|roast)/i.test(q)) {
    return {
      yesMsg: `Challenge accepted! ${from} is officially ready for the showdown 🔥🥊`,
      noTwist: `😂 CHICKENED OUT! ${from} caught you backing down from the fight—screenshot saved 💀🐔`
    };
  }
  if (/(marry|wedding|kalyanam|shaadi)/i.test(q)) {
    return {
      yesMsg: `I said YES to ${from}! Wedding bells & lifetime food dates locked in 💍✨`,
      noTwist: `😂 PLOT TWIST! Relax—you just got pranked by ${from}! That was an ODDORA trap—screenshot saved 💀💍`
    };
  }
  if (/(food|treat|pizza|biryani|shawarma|pay|gpay|money|saapadu|bill)/i.test(q)) {
    return {
      yesMsg: `Deal locked! Screenshot saved—${from} is officially waiting for that treat 🍕💸`,
      noTwist: `😂 PLOT TWIST! Relax—this was a prank by ${from}! You dodged the bill, not the screenshot 💀`
    };
  }
  if (/(miss|distance|meet|call|video|london|usa|uk|chennai|flight)/i.test(q)) {
    return {
      yesMsg: `Accepted! Distance means nothing—video call & meetup officially locked in with ${from} 🌍💞`,
      noTwist: `😂 GOTCHA! Pranked by ${from}! Nice try pressing No—you still miss me though 👀🌍`
    };
  }
  if (/(bestie|friend|bro|machan|machi|nanba|ride|duo|dost)/i.test(q)) {
    return {
      yesMsg: `Accepted! Officially locked in as ${from}'s #1 ride-or-die—no take-backs 👑🔥`,
      noTwist: `😂 PLOT TWIST! You just got pranked by ${from}! Fake friendship test—still stuck with me forever 👑💀`
    };
  }
  return {
    yesMsg: `I have accepted ${from}'s link! Officially locked in—no take-backs 💘✨`,
    noTwist: `😂 PLOT TWIST! Relax, you just got pranked by ${from}! Caught in an ODDORA trap 💀`
  };
}

/* ============================================================================
   5. DENSE, FILLED COLLECTIBLE POP-ART CARD GENERATOR (Zero Empty Space!)
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

  // Vibrant Pop Background + Halftone Dots
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

  // Hard Offset Shadow + Main Card Frame
  ctx.fillStyle = "#14141A";
  drawRoundRect(ctx, 78, 84, 944, 1200, 42);
  ctx.fill();

  ctx.fillStyle = pal.card;
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 8;
  drawRoundRect(ctx, 58, 64, 944, 1200, 42);
  ctx.fill();
  ctx.stroke();

  // Top Header Strip Inside Card (Fills top space cleanly)
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

  // Comic Starburst Rays Behind Character Circle (Fills center-top area!)
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

  // Bold Tilted Headline Banner
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

  // Subline
  ctx.textAlign = "center";
  ctx.fillStyle = "#14141A";
  ctx.font = "800 34px 'Space Grotesk', sans-serif";
  ctx.fillText(String(subline || "").slice(0, 44), 530, 642);

  // Framed Question / Quote Box (Fills middle section with rich comic card look!)
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

  // Tilted Rubber Stamp Stat Pill
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

  // Ticket Perforation Line + Built-in Viral CTA Footer Bar
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
   6. MAIN APP SHELL (With Live Reply Notification Toast + Sound + Haptics!)
============================================================================ */
function MainApp() {
  const [tab, setTab] = useState("links");
  const [logoSpin, setLogoSpin] = useState(false);
  const [odcCode, setOdcCode] = useState("");
  const [duelRoute, setDuelRoute] = useState({ game: "", code: "" });
  const [inboxOpen, setInboxOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const knownReplyCountRef = useRef(-1);

  const [myLinks, setMyLinks] = useState(() => {
    try {
      return JSON.parse(safeGetStorage("oddora_my_links", "[]"));
    } catch {
      return [];
    }
  });
  const [repliesMap, setRepliesMap] = useState({});

  const [topCreators, setTopCreators] = useState([
    { id: "t1", name: "Aarav", label: "Treat Trap 🍕", count: 42 },
    { id: "t2", name: "Maya", label: "Miss Me? 🌍", count: 31 },
    { id: "t3", name: "Rohan", label: "Coffee Date 💘", count: 27 }
  ]);

  // Parse URL params ONLY (Never auto-load old XO games from storage!)
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

  // Listen to live replies & trigger sound + haptic + notification banner when a new reply arrives!
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
              setToastMsg(`📬 ${latest.from || "Friend"} replied: “${latest.text}”`);
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
            label: item.type === "propose" ? "Propose 💘" : "Invite 💌",
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

  const totalReplies = Object.values(repliesMap).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="pop-shell">
      {toastMsg && (
        <div
          className="pop-toast"
          onClick={() => {
            fx("tap", 12);
            setToastMsg("");
            setInboxOpen(true);
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* TOP BAR */}
      <header className="pop-header">
        <a
          href="#top"
          className="pop-brand"
          onClick={e => {
            e.preventDefault();
            fx("tap", 12);
            setLogoSpin(false);
            requestAnimationFrame(() => setLogoSpin(true));
            setOdcCode("");
            setTab("links");
          }}
        >
          <span
            className={logoSpin ? "pop-coin spin" : "pop-coin"}
            onAnimationEnd={() => setLogoSpin(false)}
          >
            O
          </span>
          <span className="pop-brand-title">ODDORA</span>
          <span className="pop-pill-black">DO OD</span>
        </a>

        <div className="pop-header-actions">
          <button
            type="button"
            className="pop-btn white sm"
            onClick={() => {
              fx("tap", 12);
              setInboxOpen(true);
            }}
          >
            <Inbox size={15}/> Replies {totalReplies > 0 && <span className="pop-inbox-badge">{totalReplies}</span>}
          </button>
          <button
            type="button"
            className="pop-btn yellow sm"
            onClick={() => {
              fx("tap", 12);
              setTab("links");
              document.getElementById("play-deck")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            + Link
          </button>
        </div>
      </header>

      <main className="pop-main" id="top">
        {/* PLAYFUL POP HERO */}
        <section className="pop-hero">
          <div className="pop-hero-top">
            <div className="pop-sticker-row">
              <span className="pop-tag pink">TAP</span>
              <span className="pop-tag blue">TRAP</span>
              <span className="pop-tag lime">SHARE</span>
            </div>

            <div className="pop-banner-title">
              <h1>LINKS THEY CAN'T SAY NO TO!</h1>
            </div>

            <p className="pop-hero-tagline">
              Drop a runaway “No” card or 1v1 duel in WhatsApp & Insta DMs.
            </p>
          </div>

          <div className="pop-cards-fan">
            <div
              className="pop-trade-card coral tilt-left"
              onClick={() => {
                fx("tap", 12);
                setTab("links");
                document.getElementById("play-deck")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="pop-card-num">01</span>
              <PopCharacterArt variant="treat" />
              <div className="pop-card-label">RUNAWAY “NO”</div>
            </div>

            <HeroLiveCard
              logoSpin={logoSpin}
              onSpinLogo={() => {
                fx("tap", 14);
                setLogoSpin(false);
                requestAnimationFrame(() => setLogoSpin(true));
              }}
            />

            <div
              className="pop-trade-card blue tilt-right"
              onClick={() => {
                fx("tap", 12);
                setTab("duels");
                document.getElementById("play-deck")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="pop-card-num">03</span>
              <PopCharacterArt variant="ldr" />
              <div className="pop-card-label">1v1 DUELS</div>
            </div>
          </div>
        </section>

        {/* CHUNKY SEGMENTED TABS */}
        <div id="play-deck" className="pop-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "links"}
            className={tab === "links" ? "pop-tab active yellow" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("links"); }}
          >
            💌 Make Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "duels"}
            className={tab === "duels" ? "pop-tab active blue" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("duels"); }}
          >
            🎮 1v1 Duels
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

        {tab === "links" && <ODLinkStudio onLinkCreated={handleSavedLink} />}

        {tab === "duels" && (
          <DuelsHub
            initialGame={duelRoute.game}
            initialCode={duelRoute.code}
            onClearRoute={() => setDuelRoute({ game: "", code: "" })}
          />
        )}

        {tab === "wall" && <FlexWall topCreators={topCreators} />}

        {/* LEADERBOARD */}
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

      {/* CREATOR INBOX MODAL */}
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
                <p className="pop-muted">Create and share an OD link first—replies from your friends will pop up right here!</p>
              ) : (
                <div className="pop-stack" style={{ width: "100%" }}>
                  {myLinks.map(item => {
                    const list = repliesMap[item.code] || [];
                    return (
                      <div className="pop-inbox-item" key={item.code}>
                        <div className="pop-row-between">
                          <strong>To: {item.to}</strong>
                          <span className="pop-pill-black">CODE: {item.code}</span>
                        </div>
                        <small className="pop-muted">{item.title}</small>
                        {list.length === 0 ? (
                          <small className="pop-muted">Waiting for reply...</small>
                        ) : (
                          list.map((r, idx) => (
                            <div className="pop-inbox-reply" key={idx}>
                              💬 <strong>{r.from}:</strong> “{r.text}” {r.outcome ? `(${r.outcome})` : ""}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {odcCode && (
        <ODRecipientModal
          code={odcCode}
          onClose={() => {
            setOdcCode("");
            const u = new URL(window.location.href);
            u.searchParams.delete("odc");
            window.history.replaceState({}, "", u.toString());
          }}
          onSendBack={creatorName => {
            setOdcCode("");
            const u = new URL(window.location.href);
            u.searchParams.delete("odc");
            window.history.replaceState({}, "", u.toString());
            setTab("links");
            try { window.sessionStorage.setItem("oddora_reply_to", creatorName || ""); } catch {}
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   7. HERO CENTER INTERACTIVE CARD
============================================================================ */
function HeroLiveCard({ logoSpin, onSpinLogo }) {
  const [dodges, setDodges] = useState(0);
  const [limit] = useState(() => 4 + Math.floor(Math.random() * 3));
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
    const rx = Math.round((Math.random() - 0.5) * 60);
    const ry = dodges % 2 === 0 ? -30 : 30;
    setOffset({ x: rx, y: ry });
  }

  return (
    <div className="pop-trade-card cream center-card">
      <div className="pop-card-top-row">
        <span className="pop-card-num">02 · LIVE</span>
        <button
          type="button"
          className={logoSpin ? "pop-mini-coin spin" : "pop-mini-coin"}
          onClick={onSpinLogo}
          title="Flip coin"
        >
          O
        </button>
      </div>

      {accepted ? (
        <div className="pop-demo-done">
          <div className="pop-big-emoji">🎉</div>
          <strong>LOCKED IN!</strong>
          <small>{dodges > 0 ? `Dodged ${dodges}x — still YES 💀` : "Instant YES!"}</small>
          <button
            type="button"
            className="pop-btn white sm"
            onClick={() => { fx("tap", 10); setAccepted(false); setDodges(0); setOffset({ x: 0, y: 0 }); }}
          >
            Reset
          </button>
        </div>
      ) : (
        <>
          <h3>“You're buying coffee today? ☕”</h3>
          <div className="pop-demo-btns">
            <button
              type="button"
              className="pop-btn lime sm"
              onClick={() => { fx("win", [20, 30, 20]); setAccepted(true); }}
            >
              Yes 💸
            </button>
            <button
              type="button"
              className="pop-btn pink sm pop-dodge-btn"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
              onMouseEnter={() => { if (dodges < 2) dodgeNo(); }}
              onClick={dodgeNo}
            >
              No
            </button>
          </div>
          <small className="pop-hint">
            {dodges > 0 ? DODGE_TAUNTS[Math.min(dodges - 1, DODGE_TAUNTS.length - 1)] : "Try tapping No 👆"}
          </small>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   8. OD LINK STUDIO (With Custom Question Option + Smart Auto-Fill!)
============================================================================ */
function ODLinkStudio({ onLinkCreated }) {
  const [mode, setMode] = useState("invite");
  const [view, setView] = useState("build");
  const [busy, setBusy] = useState(false);
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
  const [cardColor, setCardColor] = useState("lime");

  const [title, setTitle] = useState(INVITE_PRESETS[0].title);
  const [question, setQuestion] = useState(INVITE_PRESETS[0].question);
  const [yesLabel, setYesLabel] = useState(INVITE_PRESETS[0].yesLabel);
  const [noLabel, setNoLabel] = useState(INVITE_PRESETS[0].noLabel);
  const [yesMessage, setYesMessage] = useState(INVITE_PRESETS[0].yesMessage);

  const [vibe, setVibe] = useState("pink");
  const [q1, setQ1] = useState("1. Ideal vibe for hanging out tonight?");
  const [q1Opts, setQ1Opts] = useState(["Iced coffee + long drive ☕", "Street food hopping 🌮", "Late-night playlist & chill 🎧"]);
  const [q2, setQ2] = useState("2. Be honest—how fast do you get ready?");
  const [q2Opts, setQ2Opts] = useState(["10 mins flat ⚡", "Fashionably late 😎", "Depends on the person 👀"]);
  const [finalQ, setFinalQ] = useState("Will you go on a date with me? 💘");
  const [propYes, setPropYes] = useState("YES, 100% 💖");
  const [propNo, setPropNo] = useState("No 🙈");
  const [dressCode, setDressCode] = useState("Black / Pastel ✨");
  const [datePlace, setDatePlace] = useState("Sunset Coffee & Drive ☕");
  const [yesAck, setYesAck] = useState("I have accepted! Date is officially locked in 💘✨");
  const [noTwist, setNoTwist] = useState("😂 PLOT TWIST! Relax, you just got pranked! This was an ODDORA trap 💀");

  function pickPreset(p) {
    fx("tap", 10);
    setCardColor(p.cardColor);
    setTitle(p.title);
    setQuestion(p.question);
    setYesLabel(p.yesLabel);
    setNoLabel(p.noLabel);
    setYesMessage(p.yesMessage);
  }

  function pickVibe(v) {
    fx("tap", 10);
    setVibe(v.id);
    setFinalQ(v.defaultQ);
    const nextVar = autoVariant + 1;
    setAutoVariant(nextVar);
    const gen = generateWarmupQuestions(v.defaultQ, v.id, nextVar);
    setQ1(gen[0].q);
    setQ1Opts(gen[0].options);
    setQ2(gen[1].q);
    setQ2Opts(gen[1].options);
    const smart = generateSmartOutcomes(v.defaultQ, senderName || "your friend");
    setYesAck(smart.yesMsg);
    setNoTwist(smart.noTwist);
  }

  function clearForCustom() {
    fx("tap", 10);
    setQ1("1. ");
    setQ1Opts(["", "", ""]);
    setQ2("2. ");
    setQ2Opts(["", "", ""]);
  }

  function buildData() {
    const from = (senderName.trim() || "Someone special").slice(0, 24);
    const to = (recipientName.trim() || "You").slice(0, 24);
    const secretLimit = 5 + Math.floor(Math.random() * 3);

    if (mode === "invite") {
      return {
        type: "invite",
        theme: cardColor,
        creatorName: from,
        recipientName: to,
        yesCount: 0,
        createdAt: Date.now(),
        payload: {
          title: (title.trim() || "Quick Question 👀").slice(0, 80),
          question: (question.trim() || "Are we doing this?").slice(0, 240),
          yesLabel: (yesLabel.trim() || "Yes ⚡").slice(0, 28),
          noLabel: (noLabel.trim() || "No").slice(0, 28),
          yesMessage: (yesMessage.trim() || "Confirmed! See you soon 🎉").slice(0, 240),
          maxDodges: secretLimit
        }
      };
    }

    const cleanQ1Opts = q1Opts.map(o => o.trim().slice(0, 50)).filter(Boolean);
    const cleanQ2Opts = q2Opts.map(o => o.trim().slice(0, 50)).filter(Boolean);
    const questions = [];
    if (q1.trim() && q1.trim() !== "1." && cleanQ1Opts.length > 0) {
      questions.push({ q: q1.trim().slice(0, 140), options: cleanQ1Opts });
    }
    if (q2.trim() && q2.trim() !== "2." && cleanQ2Opts.length > 0) {
      questions.push({ q: q2.trim().slice(0, 140), options: cleanQ2Opts });
    }

    return {
      type: "propose",
      theme: vibe,
      creatorName: from,
      recipientName: to,
      yesCount: 0,
      createdAt: Date.now(),
      payload: {
        questions,
        finalQuestion: (finalQ.trim() || "Will you go on a date with me? 💘").slice(0, 160),
        yesLabel: (propYes.trim() || "YES 💖").slice(0, 28),
        noLabel: (propNo.trim() || "No").slice(0, 28),
        dressCode: (dressCode.trim() || "Your best vibe ✨").slice(0, 80),
        datePlace: (datePlace.trim() || "Surprise spot 📍").slice(0, 80),
        yesAckMessage: (yesAck.trim() || "Confirmed! Share the receipt back 💌").slice(0, 220),
        noTwistMessage: (noTwist.trim() || "😂 PLOT TWIST! You got OD'd!").slice(0, 220)
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
      await set(ref(database, `creations/${code}`), {
        id: code,
        ...dataObj
      });

      onLinkCreated?.({
        code,
        to: dataObj.recipientName,
        title: mode === "invite" ? dataObj.payload.title : dataObj.payload.finalQuestion,
        createdAt: Date.now()
      });

      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("odc", code);
      setShareUrl(u.toString());
      setView("ready");
      fx("win", [20, 35, 20]);
    } catch {
      alert("Network issue. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pop-box">
      <div className="pop-sub-tabs">
        <button
          type="button"
          className={mode === "invite" ? "pop-sub-tab active" : "pop-sub-tab"}
          onClick={() => { fx("tap", 10); setMode("invite"); setView("build"); }}
        >
          💌 Runaway “No” Card
        </button>
        <button
          type="button"
          className={mode === "propose" ? "pop-sub-tab active" : "pop-sub-tab"}
          onClick={() => { fx("tap", 10); setMode("propose"); setView("build"); }}
        >
          💍 3-Step Proposal
        </button>
      </div>

      {view === "preview" ? (
        <div className="pop-stack">
          <div className="pop-row-between">
            <span className="pop-pill-black">👁️ LIVE PREVIEW</span>
            <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); setView("build"); }}>
              ← Edit
            </button>
          </div>
          <InteractiveODExperience data={buildData()} isPreview={true} onSendBack={() => setView("build")} />
          <button type="button" className="pop-btn yellow full" onClick={publishLink} disabled={busy}>
            {busy ? "Creating..." : "🚀 Lock & Get Share Link"}
          </button>
        </div>
      ) : view === "ready" ? (
        <div className="pop-ready-card">
          <PopCharacterArt variant={mode === "invite" ? cardColor : vibe} />
          <span className="pop-pill-black">LINK READY ⚡</span>
          <h2>Send to {recipientName || "your person"}!</h2>

          <div className="pop-link-box">
            <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
          </div>

          <UniversalShareBar
            url={shareUrl}
            shareText={`${senderName.trim() || "Someone"} sent you an OD link 👀⚡`}
            title="ODDORA Link"
          />

          <div className="pop-row-center">
            <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); setView("preview"); }}>
              👁️ Test Card
            </button>
            <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); setView("build"); }}>
              ✏️ Make Another
            </button>
          </div>
        </div>
      ) : mode === "invite" ? (
        <div className="pop-stack">
          <div className="pop-chips-row">
            {INVITE_PRESETS.map(p => (
              <button key={p.id} type="button" className="pop-chip" onClick={() => pickPreset(p)}>
                {p.tag}
              </button>
            ))}
          </div>

          <div className="pop-grid-2">
            <label className="pop-field">
              <span>YOUR NAME</span>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Karthik" maxLength={24}/>
            </label>
            <label className="pop-field">
              <span>THEIR NAME</span>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="e.g. Ananya" maxLength={24}/>
            </label>
          </div>

          <label className="pop-field">
            <span>CARD HEADLINE</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}/>
          </label>

          <label className="pop-field">
            <span>MESSAGE</span>
            <textarea rows={2} value={question} onChange={e => setQuestion(e.target.value)} maxLength={240}/>
          </label>

          <div className="pop-grid-2">
            <label className="pop-field">
              <span>YES BUTTON</span>
              <input value={yesLabel} onChange={e => setYesLabel(e.target.value)} maxLength={28}/>
            </label>
            <label className="pop-field">
              <span>NO BUTTON (Escapes)</span>
              <input value={noLabel} onChange={e => setNoLabel(e.target.value)} maxLength={28}/>
            </label>
          </div>

          <label className="pop-field">
            <span>MESSAGE ON YES</span>
            <input value={yesMessage} onChange={e => setYesMessage(e.target.value)} maxLength={240}/>
          </label>

          <div className="pop-color-picker">
            <span>CHARACTER & CARD COLOR:</span>
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

          <div className="pop-grid-2">
            <button type="button" className="pop-btn white" onClick={() => { fx("tap", 10); setView("preview"); }}>
              👁️ Preview Card
            </button>
            <button type="button" className="pop-btn yellow" onClick={publishLink} disabled={busy}>
              {busy ? "Creating..." : "🚀 Create Link"}
            </button>
          </div>
        </div>
      ) : (
        <div className="pop-stack">
          <div className="pop-chips-row">
            {PROPOSE_VIBES.map(v => (
              <button
                key={v.id}
                type="button"
                className={vibe === v.id ? "pop-chip active" : "pop-chip"}
                onClick={() => pickVibe(v)}
              >
                {v.label}
              </button>
            ))}
            <button type="button" className="pop-chip" onClick={clearForCustom}>
              ✏️ Custom Q1 & Q2
            </button>
          </div>

          <div className="pop-grid-2">
            <label className="pop-field">
              <span>YOUR NAME</span>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Your name" maxLength={24}/>
            </label>
            <label className="pop-field">
              <span>THEIR NAME</span>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Their name" maxLength={24}/>
            </label>
          </div>

          <label className="pop-field">
            <span>FINAL QUESTION (STEP 3)</span>
            <div className="pop-inline">
              <input value={finalQ} onChange={e => setFinalQ(e.target.value)} maxLength={160}/>
              <button
                type="button"
                className="pop-btn white sm"
                onClick={() => {
                  const nextVar = autoVariant + 1;
                  setAutoVariant(nextVar);
                  const gen = generateWarmupQuestions(finalQ, vibe, nextVar);
                  setQ1(gen[0].q);
                  setQ1Opts(gen[0].options);
                  setQ2(gen[1].q);
                  setQ2Opts(gen[1].options);
                  const smart = generateSmartOutcomes(finalQ, senderName || "your friend");
                  setYesAck(smart.yesMsg);
                  setNoTwist(smart.noTwist);
                  fx("tap", 12);
                }}
              >
                ✨ Auto Q1 & Q2
              </button>
            </div>
          </label>

          <div className="pop-inner-box">
            <span className="pop-mini-tag">WARM-UP 1 (EDIT OR CLEAR)</span>
            <input value={q1} onChange={e => setQ1(e.target.value)} placeholder="Type custom Question 1..." maxLength={140}/>
            <div className="pop-grid-3">
              {q1Opts.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={e => {
                    const copy = [...q1Opts];
                    copy[i] = e.target.value;
                    setQ1Opts(copy);
                  }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={50}
                />
              ))}
            </div>
          </div>

          <div className="pop-inner-box">
            <span className="pop-mini-tag">WARM-UP 2 (EDIT OR CLEAR)</span>
            <input value={q2} onChange={e => setQ2(e.target.value)} placeholder="Type custom Question 2..." maxLength={140}/>
            <div className="pop-grid-3">
              {q2Opts.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={e => {
                    const copy = [...q2Opts];
                    copy[i] = e.target.value;
                    setQ2Opts(copy);
                  }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={50}
                />
              ))}
            </div>
          </div>

          <div className="pop-grid-2">
            <label className="pop-field">
              <span>VIBE (IF YES)</span>
              <input value={dressCode} onChange={e => setDressCode(e.target.value)} maxLength={80}/>
            </label>
            <label className="pop-field">
              <span>PLAN (IF YES)</span>
              <input value={datePlace} onChange={e => setDatePlace(e.target.value)} maxLength={80}/>
            </label>
          </div>

          <label className="pop-field">
            <span>IF THEY CLICK YES</span>
            <input value={yesAck} onChange={e => setYesAck(e.target.value)} maxLength={220}/>
          </label>

          <label className="pop-field">
            <span>IF THEY CLICK NO → PLOT TWIST REVEAL</span>
            <input value={noTwist} onChange={e => setNoTwist(e.target.value)} maxLength={220}/>
          </label>

          <div className="pop-grid-2">
            <button type="button" className="pop-btn white" onClick={() => { fx("tap", 10); setView("preview"); }}>
              👁️ Preview
            </button>
            <button type="button" className="pop-btn pink" onClick={publishLink} disabled={busy}>
              {busy ? "Creating..." : "💘 Publish Proposal"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================================
   9. COLLECTIBLE RECIPIENT EXPERIENCE CARD
============================================================================ */
function InteractiveODExperience({ data, code = "", isPreview = false, onSendBack }) {
  const [dodges, setDodges] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [outcome, setOutcome] = useState("");
  const [propStep, setPropStep] = useState(0);
  const [reactionText, setReactionText] = useState("");
  const [reactionSent, setReactionSent] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const arenaRef = useRef(null);
  const maxDodges = data?.payload?.maxDodges || 6;
  const converted = dodges >= maxDodges;
  const cardTheme = data.theme || "lime";

  function handleDodge(e) {
    if (e) e.preventDefault();
    if (converted) { confirmYes(); return; }
    const next = dodges + 1;
    setDodges(next);
    fx("dodge", 16);

    if (next >= maxDodges) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const rx = Math.round((Math.random() - 0.5) * 90);
    const ry = next % 2 === 0 ? -36 : 36;
    setOffset({ x: rx, y: ry });
  }

  function confirmYes() {
    fx("win", [20, 40, 20]);
    setOutcome("yes");
    if (code && !isPreview) {
      signInPlayer().catch(() => null).finally(() => {
        push(ref(database, `replies/${code}`), {
          text: "Said YES! 💜",
          from: data.recipientName || "Friend",
          outcome: "YES",
          createdAt: Date.now()
        }).catch(() => {});
        runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
      });
    }
  }

  function sendReactionNote(e, outcomeLabel = "YES") {
    e.preventDefault();
    const clean = reactionText.trim().slice(0, 120);
    if (!clean || reactionSent) return;
    fx("notify", [20, 30, 20]);
    setReactionSent(true);
    if (code && !isPreview) {
      signInPlayer().catch(() => null).finally(() => {
        push(ref(database, `replies/${code}`), {
          text: clean,
          from: data.recipientName || "Friend",
          outcome: outcomeLabel,
          createdAt: Date.now()
        }).catch(() => {});
      });
    }
  }

  async function shareCollectibleCard(badge, headline, subline, statPill, quote) {
    if (savingCard) return;
    setSavingCard(true);
    fx("tap", 14);
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
        a.download = "oddora-collectible-card.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {} finally {
      setSavingCard(false);
    }
  }

  if (data.type === "invite") {
    const p = data.payload;
    return (
      <div className={`pop-collectible-card ${cardTheme}`}>
        <div className="pop-card-header-bar">
          <span>⚡ ODDORA</span>
          <span>FROM {data.creatorName?.toUpperCase()}</span>
        </div>

        <PopCharacterArt variant={cardTheme} />

        {outcome === "yes" ? (
          <div className="pop-outcome">
            <div className="pop-comic-banner">LOCKED IN! 🎉</div>
            <p className="pop-card-desc">{p.yesMessage}</p>
            <div className="pop-stamp-badge">
              {dodges > 0 ? `DODGED ${dodges}x · STILL YES` : "100% INSTANT YES"}
            </div>

            {!reactionSent ? (
              <form className="pop-react-form" onSubmit={e => sendReactionNote(e, "YES")}>
                <input
                  value={reactionText}
                  onChange={e => setReactionText(e.target.value)}
                  placeholder={`Reply to ${data.creatorName}...`}
                  maxLength={120}
                />
                <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}>
                  <Send size={14}/>
                </button>
              </form>
            ) : (
              <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
            )}

            <button
              type="button"
              className="pop-btn yellow full"
              onClick={() =>
                shareCollectibleCard(
                  "OFFICIAL CARD",
                  "LOCKED IN! 🎉",
                  `${data.recipientName} said YES to ${data.creatorName}`,
                  dodges > 0 ? `DODGED ${dodges}x · STILL YES` : "INSTANT YES",
                  p.title
                )
              }
            >
              <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
            </button>
            <button type="button" className="pop-btn white full" onClick={() => onSendBack?.(data.creatorName)}>
              ↩️ Uno Reverse — Send Back
            </button>
          </div>
        ) : (
          <>
            <span className="pop-pill-black">FOR {data.recipientName?.toUpperCase()}</span>
            <h2 className="pop-card-title">{p.title}</h2>
            <p className="pop-card-desc">{p.question}</p>

            {dodges > 0 && (
              <div className="pop-stamp-badge">
                {DODGE_TAUNTS[Math.min(dodges - 1, DODGE_TAUNTS.length - 1)]}
              </div>
            )}

            <div className="pop-dodge-zone" ref={arenaRef}>
              <button
                type="button"
                className="pop-btn lime"
                style={{ transform: `scale(${1 + Math.min(dodges, 5) * 0.05})` }}
                onClick={confirmYes}
              >
                {p.yesLabel}
              </button>
              <button
                type="button"
                className={converted ? "pop-btn lime" : "pop-btn pink pop-dodge-btn"}
                style={converted ? {} : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
                onMouseEnter={() => { if (!converted && dodges < 3) handleDodge(); }}
                onClick={handleDodge}
              >
                {converted ? p.yesLabel : p.noLabel}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const p = data.payload;
  const qs = p.questions || [];

  return (
    <div className={`pop-collectible-card ${cardTheme}`}>
      <div className="pop-card-header-bar">
        <span>⚡ ODDORA</span>
        <span>{data.creatorName?.toUpperCase()} → {data.recipientName?.toUpperCase()}</span>
      </div>

      <PopCharacterArt variant={cardTheme} />

      {propStep < qs.length ? (
        <>
          <span className="pop-pill-black">STEP {propStep + 1} OF {qs.length + 1}</span>
          <h2 className="pop-card-title">{qs[propStep].q}</h2>
          <div className="pop-q-list">
            {qs[propStep].options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className="pop-btn white full"
                onClick={() => { fx("tap", 12); setPropStep(s => s + 1); }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : propStep === qs.length ? (
        <>
          <span className="pop-pill-black">FINAL QUESTION</span>
          <h2 className="pop-card-title">{p.finalQuestion}</h2>
          <div className="pop-dodge-zone" ref={arenaRef}>
            <button
              type="button"
              className="pop-btn lime"
              onClick={() => {
                fx("win", [25, 40, 25]);
                if (code && !isPreview) {
                  signInPlayer().catch(() => null).finally(() => {
                    push(ref(database, `replies/${code}`), {
                      text: "Accepted! 💞",
                      from: data.recipientName || "Friend",
                      outcome: "ACCEPTED",
                      createdAt: Date.now()
                    }).catch(() => {});
                    runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
                  });
                }
                setPropStep(qs.length + 1);
              }}
            >
              {p.yesLabel}
            </button>
            <button
              type="button"
              className="pop-btn pink"
              onClick={() => { fx("prank", [30, 40, 30]); setPropStep(qs.length + 2); }}
            >
              {p.noLabel}
            </button>
          </div>
        </>
      ) : propStep === qs.length + 1 ? (
        <div className="pop-outcome">
          <div className="pop-comic-banner">I ACCEPTED! 💞</div>
          <div className="pop-plan-box">
            <div><strong>VIBE:</strong> {p.dressCode}</div>
            <div><strong>PLAN:</strong> {p.datePlace}</div>
          </div>
          <p className="pop-card-desc">
            {p.yesAckMessage || `I have accepted ${data.creatorName}'s link! 💘`}
          </p>

          {!reactionSent ? (
            <form className="pop-react-form" onSubmit={e => sendReactionNote(e, "ACCEPTED")}>
              <input
                value={reactionText}
                onChange={e => setReactionText(e.target.value)}
                placeholder={`Reply to ${data.creatorName}...`}
                maxLength={120}
              />
              <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}>
                <Send size={14}/>
              </button>
            </form>
          ) : (
            <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
          )}

          <button
            type="button"
            className="pop-btn yellow full"
            onClick={() =>
              shareCollectibleCard(
                "OFFICIAL RECEIPT",
                "I ACCEPTED! 💞",
                `${data.recipientName} accepted ${data.creatorName}'s challenge`,
                p.datePlace || "LOCKED IN",
                p.finalQuestion
              )
            }
          >
            <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
          </button>
          <button type="button" className="pop-btn white full" onClick={() => onSendBack?.(data.creatorName)}>
            ↩️ Send an OD Back
          </button>
        </div>
      ) : (
        <div className="pop-outcome">
          <div className="pop-comic-banner">GOT PRANKED! 😂</div>
          <div className="pop-stamp-badge">PRANKED BY {data.creatorName?.toUpperCase()} 💀</div>
          <p className="pop-card-desc">
            {p.noTwistMessage && !p.noTwistMessage.includes("Nice reflexes—you got OD'd")
              ? p.noTwistMessage
              : `😂 PLOT TWIST! Relax—you just got pranked by ${data.creatorName}! This whole question was an ODDORA trap 💀`}
          </p>

          {!reactionSent ? (
            <form className="pop-react-form" onSubmit={e => sendReactionNote(e, "PRANKED")}>
              <input
                value={reactionText}
                onChange={e => setReactionText(e.target.value)}
                placeholder={`Reply to ${data.creatorName}...`}
                maxLength={120}
              />
              <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}>
                <Send size={14}/>
              </button>
            </form>
          ) : (
            <div className="pop-sent-note">Sent to {data.creatorName}: “{reactionText}” ✓</div>
          )}

          <button
            type="button"
            className="pop-btn yellow full"
            onClick={() =>
              shareCollectibleCard(
                "PRANK RECEIPT",
                "I GOT PRANKED! 😂",
                `I got pranked by ${data.creatorName} on ODDORA!`,
                `PRANKED BY ${data.creatorName?.toUpperCase()} 💀`,
                p.finalQuestion
              )
            }
          >
            <Share2 size={16}/> {savingCard ? "Creating Card..." : "Share Collectible Card"}
          </button>
          <button type="button" className="pop-btn white full" onClick={() => onSendBack?.(data.creatorName)}>
            ⚡ Prank {data.creatorName} Back
          </button>
        </div>
      )}
    </div>
  );
}

function ODRecipientModal({ code, onClose, onSendBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    get(ref(database, `creations/${code}`))
      .then(snap => {
        if (!alive) return;
        if (snap.exists()) setData(snap.val());
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  return (
    <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pop-modal-box">
        <button type="button" className="pop-modal-close" onClick={onClose} aria-label="Close">
          <X size={18}/>
        </button>
        {loading ? (
          <div className="pop-ready-card"><p>Opening card...</p></div>
        ) : !data ? (
          <div className="pop-ready-card">
            <h3>Card not found 👀</h3>
            <button type="button" className="pop-btn yellow" onClick={onClose}>Make Your Own</button>
          </div>
        ) : (
          <InteractiveODExperience data={data} code={code} isPreview={false} onSendBack={onSendBack} />
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   10. 1v1 DUELS HUB (Always Opens Fresh Unless Invited via ?xo=/?heart=/?tap=)
============================================================================ */
function DuelsHub({ initialGame = "", initialCode = "", onClearRoute }) {
  const [game, setGame] = useState(initialGame || "xo");

  useEffect(() => {
    if (initialGame) setGame(initialGame);
  }, [initialGame]);

  return (
    <section className="pop-box">
      <div className="pop-sub-tabs three">
        <button
          type="button"
          className={game === "xo" ? "pop-sub-tab active" : "pop-sub-tab"}
          onClick={() => { fx("tap", 10); setGame("xo"); onClearRoute?.(); }}
        >
          ❎ XO Series
        </button>
        <button
          type="button"
          className={game === "heart" ? "pop-sub-tab active" : "pop-sub-tab"}
          onClick={() => { fx("tap", 10); setGame("heart"); onClearRoute?.(); }}
        >
          💘 Heart Sync
        </button>
        <button
          type="button"
          className={game === "tap" ? "pop-sub-tab active" : "pop-sub-tab"}
          onClick={() => { fx("tap", 10); setGame("tap"); onClearRoute?.(); }}
        >
          ⚡ Tap Trap 30s
        </button>
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
      <button
        type="button"
        className={mode === "multi" ? "pop-mode-btn active" : "pop-mode-btn"}
        onClick={() => { fx("tap", 10); setMode("multi"); }}
      >
        <Users size={15}/> 1v1 Friend
      </button>
      <button
        type="button"
        className={mode === "solo" ? "pop-mode-btn active" : "pop-mode-btn"}
        onClick={() => { fx("tap", 10); setMode("solo"); }}
      >
        <Bot size={15}/> Solo vs AI
      </button>
    </div>
  );
}

/* --- GAME 1: XO SERIES --- */
function getSmartAIMove(board) {
  const empty = board.map((v, i) => (v === "" ? i : null)).filter(v => v !== null);
  if (empty.length === 0) return -1;
  for (const idx of empty) {
    const t = [...board]; t[idx] = "O";
    if (XO_WIN_LINES.some(l => l.every(c => t[c] === "O"))) return idx;
  }
  for (const idx of empty) {
    const t = [...board]; t[idx] = "X";
    if (XO_WIN_LINES.some(l => l.every(c => t[c] === "X"))) return idx;
  }
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
          if (r.players?.X === myUid || r.players?.O === myUid) {
            setRoomCode(initialCode);
            setRoom(r);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [initialCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    return onValue(ref(database, `rooms/${roomCode}`), snap => {
      if (snap.exists()) setRoom(snap.val());
      else {
        setRoom(null);
        setRoomCode("");
      }
    });
  }, [roomCode]);

  const clean = v => v.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createRoom() {
    const n = clean(name);
    if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        exists = (await get(ref(database, `rooms/${code}`))).exists();
      }
      await set(ref(database, `rooms/${code}`), {
        gameType: "xo",
        board: Array(9).fill(""),
        turn: "X",
        players: { X: uid, O: "" },
        playerNames: { X: n, O: "" },
        seriesScore: { X: 0, O: 0 },
        taunt: "",
        status: "waiting",
        winner: "",
        round: 1,
        createdAt: Date.now()
      });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("xo", code);
      window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const n = clean(name);
    const code = joinCode.trim().toUpperCase();
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
      return {
        ...cur, board: b, turn: mySide === "X" ? "O" : "X", seriesScore: scores,
        status: win || draw ? "finished" : "playing", winner: win ? mySide : draw ? "draw" : ""
      };
    });
  }

  async function nextRound() {
    if (!roomCode || !mySide) return;
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur) return;
      return {
        ...cur, board: Array(9).fill(""), turn: (cur.round || 1) % 2 === 1 ? "O" : "X",
        status: "playing", winner: "", round: (cur.round || 1) + 1
      };
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

  const shareUrl = (() => {
    const u = new URL(window.location.href); u.search = "";
    if (roomCode) u.searchParams.set("xo", roomCode);
    return u.toString();
  })();

  return (
    <div className="pop-stack">
      <ModeSwitcher mode={mode} setMode={setMode} />

      {mode === "solo" ? (
        <>
          <div className="pop-grid-board">
            {soloBoard.map((c, i) => (
              <button key={i} type="button" className={`pop-cell ${c.toLowerCase()}`} onClick={() => playSolo(i)}>{c}</button>
            ))}
          </div>
          {soloWin && (
            <div className="pop-banner-row">
              <strong>{soloWin === "X" ? "You won! 🎉" : soloWin === "O" ? "Bot won 🤖" : "Draw 🤝"}</strong>
              <button type="button" className="pop-btn yellow sm" onClick={() => { setSoloBoard(Array(9).fill("")); setSoloWin(""); }}>
                Again
              </button>
            </div>
          )}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field">
            <span>YOUR NAME</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/>
          </label>
          {initialCode ? (
            <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={joinRoom}>
              {busy ? "Joining..." : "Join Partner's Game"}
            </button>
          ) : (
            <>
              <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={createRoom}>
                {busy ? "Creating..." : "⚡ Create 1v1 Room"}
              </button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="6-CHAR CODE"
                  maxLength={6}
                />
                <button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinRoom}>
                  Join
                </button>
              </div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={room?.turn === "X" ? "pop-sb active" : "pop-sb"}>
              <small>X · {room?.playerNames?.X || "Host"}</small>
              <strong>{room?.seriesScore?.X || 0}</strong>
            </div>
            <div className="pop-sb-mid">
              <span>R{room?.round || 1}</span>
              <small>{roomCode}</small>
            </div>
            <div className={room?.turn === "O" ? "pop-sb active" : "pop-sb"}>
              <small>O · {room?.playerNames?.O || "Waiting..."}</small>
              <strong>{room?.seriesScore?.O || 0}</strong>
            </div>
          </div>

          {room?.taunt && <div className="pop-taunt-bar-live">{room.taunt}</div>}

          <div className="pop-status-pill">
            {room?.status === "waiting"
              ? "Waiting for friend to join..."
              : room?.status === "finished"
                ? (room.winner === "draw" ? "Draw! 🤝" : `${room?.playerNames?.[room.winner] || room.winner} wins! 🔥`)
                : room?.turn === mySide ? "Your turn ⚡" : `Waiting for ${room?.playerNames?.[room.turn] || "friend"}...`}
          </div>

          <div className="pop-grid-board">
            {(room?.board || Array(9).fill("")).map((c, i) => (
              <button
                key={i}
                type="button"
                className={`pop-cell ${c.toLowerCase()}`}
                disabled={room?.status !== "playing" || room?.turn !== mySide || Boolean(c)}
                onClick={() => playMove(i)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="pop-chips-row center">
            {DUEL_TAUNTS.map(t => (
              <button
                key={t}
                type="button"
                className="pop-chip"
                onClick={() => { fx("tap", 10); set(ref(database, `rooms/${roomCode}/taunt`), `${room?.playerNames?.[mySide] || mySide}: ${t}`).catch(() => {}); }}
              >
                {t}
              </button>
            ))}
          </div>

          {room?.status === "finished" && (
            <button type="button" className="pop-btn yellow full" onClick={nextRound}>
              Next Round →
            </button>
          )}
          {room?.status === "waiting" && (
            <UniversalShareBar
              url={shareUrl}
              shareText={`${room?.playerNames?.X || name} challenged you to 1v1 XO on ODDORA! ❎⭕`}
              title="ODDORA XO Duel"
            />
          )}
          <button type="button" className="pop-btn white full" onClick={leaveRoom}>
            Leave Room
          </button>
        </>
      )}
    </div>
  );
}

/* --- GAME 2: HEART SYNC --- */
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
      const myUid = cred.user.uid;
      setUid(myUid);
      if (initialCode && initialCode.length === 6) {
        get(ref(database, `rooms/${initialCode}`)).then(snap => {
          if (!alive || !snap.exists()) return;
          const r = snap.val();
          if (r.gameType === "heart" && (r.players?.X === myUid || r.players?.O === myUid)) {
            setRoomCode(initialCode);
            setRoom(r);
          }
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
    const n = clean(name);
    if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        exists = (await get(ref(database, `rooms/${code}`))).exists();
      }
      await set(ref(database, `rooms/${code}`), {
        gameType: "heart",
        players: { X: uid, O: "" },
        playerNames: { X: n, O: "" },
        choices: { X: -1, O: -1 },
        attempts: 0,
        status: "waiting",
        round: 1,
        createdAt: Date.now()
      });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("heart", code);
      window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinHeartRoom() {
    const n = clean(name);
    const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !n || code.length !== 6) return;
    setBusy(true);
    try {
      const rRef = ref(database, `rooms/${code}`);
      const snap = await get(rRef);
      if (!snap.exists()) throw new Error("Room not found");
      const existing = snap.val();
      if (existing.gameType !== "heart") throw new Error("Wrong game code");
      await runTransaction(rRef, cur => {
        const r = cur || existing;
        if (!r || r.gameType !== "heart") return;
        if (r.players?.X === uid) return r;
        if (r.players?.O === uid) return { ...r, playerNames: { ...(r.playerNames || {}), O: n } };
        if (r.players?.O) return;
        return {
          ...r,
          players: { ...r.players, O: uid },
          playerNames: { ...(r.playerNames || {}), O: n },
          choices: { X: -1, O: -1 },
          attempts: 0,
          status: "playing"
        };
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

  function leaveHeartRoom() {
    setRoomCode(""); setRoom(null); setJoinCode("");
    const u = new URL(window.location.href); u.searchParams.delete("heart");
    window.history.replaceState({}, "", u.toString());
  }

  function tapSoloHeart(i) {
    if (matched) return;
    fx("tap", 14);
    const bot = Math.floor(Math.random() * HEART_CHOICES.length);
    const nextTries = tries + 1;
    setPick(i); setAiPick(bot); setTries(nextTries);
    if (i === bot) { setMatched(true); fx("win", [25, 40, 25]); }
  }

  const shareUrl = (() => {
    const u = new URL(window.location.href); u.search = "";
    if (roomCode) u.searchParams.set("heart", roomCode);
    return u.toString();
  })();

  const myPick = mySide ? room?.choices?.[mySide] : -1;
  const syncScore = Math.max(20, 100 - Math.max(0, Number(room?.attempts || 2) - 2) * 6);

  return (
    <div className="pop-stack">
      <ModeSwitcher mode={mode} setMode={setMode} />

      {mode === "solo" ? (
        <>
          <div className="pop-status-pill">
            {matched
              ? `💞 SYNC SCORE: ${Math.max(15, 100 - Math.max(0, tries - 1) * 7)}%`
              : pick !== null
                ? `You: ${HEART_CHOICES[pick]} · AI: ${HEART_CHOICES[aiPick]}`
                : "Match the same heart as AI 💘"}
          </div>
          <div className="pop-grid-board">
            {HEART_CHOICES.map((h, i) => (
              <button key={h} type="button" className={pick === i ? "pop-cell active" : "pop-cell"} onClick={() => tapSoloHeart(i)}>
                {h}
              </button>
            ))}
          </div>
          {matched && (
            <button type="button" className="pop-btn pink full" onClick={() => { setPick(null); setAiPick(null); setTries(0); setMatched(false); }}>
              <RotateCcw size={15}/> Again
            </button>
          )}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field">
            <span>YOUR NAME</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/>
          </label>
          {initialCode ? (
            <button type="button" className="pop-btn pink full" disabled={!uid || busy || !clean(name)} onClick={joinHeartRoom}>
              {busy ? "Joining..." : "Join Partner's Heart Sync"}
            </button>
          ) : (
            <>
              <button type="button" className="pop-btn pink full" disabled={!uid || busy || !clean(name)} onClick={createHeartRoom}>
                {busy ? "Creating..." : "💘 Start 1v1 Heart Sync"}
              </button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="6-CHAR CODE"
                  maxLength={6}
                />
                <button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinHeartRoom}>
                  Join
                </button>
              </div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={mySide === "X" ? "pop-sb active" : "pop-sb"}>
              <small>{room?.playerNames?.X || "Player 1"}</small>
              <strong>{room?.choices?.X >= 0 ? "💗" : "⏳"}</strong>
            </div>
            <div className="pop-sb-mid">
              <span>R{room?.round || 1}</span>
              <small>{roomCode}</small>
            </div>
            <div className={mySide === "O" ? "pop-sb active" : "pop-sb"}>
              <small>{room?.playerNames?.O || "Waiting..."}</small>
              <strong>{room?.choices?.O >= 0 ? "💗" : "⏳"}</strong>
            </div>
          </div>

          {room?.status === "waiting" ? (
            <>
              <div className="pop-status-pill">Waiting for friend to join... 💌</div>
              <UniversalShareBar
                url={shareUrl}
                shareText={`${room?.playerNames?.X || name} sent you a 1v1 Heart Sync challenge on ODDORA! 💘`}
                title="ODDORA Heart Sync"
              />
            </>
          ) : room?.status === "finished" ? (
            <div className="pop-ready-card">
              <div className="pop-big-emoji">💞</div>
              <h2>{syncScore}% IN SYNC!</h2>
              <p className="pop-muted">Matched on {HEART_CHOICES[room?.choices?.X || 0]} in {room?.attempts} picks!</p>
              <button type="button" className="pop-btn pink full" onClick={rematchHeart}>
                ↻ Play Another Round
              </button>
            </div>
          ) : (
            <>
              <div className="pop-status-pill">
                Pick the exact same heart as {room?.playerNames?.[mySide === "X" ? "O" : "X"] || "partner"}!
              </div>
              <div className="pop-grid-board">
                {HEART_CHOICES.map((h, i) => (
                  <button
                    key={h}
                    type="button"
                    className={myPick === i ? "pop-cell active" : "pop-cell"}
                    onClick={() => pickMultiHeart(i)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </>
          )}

          <button type="button" className="pop-btn white full" onClick={leaveHeartRoom}>
            Leave Room
          </button>
        </>
      )}
    </div>
  );
}

/* --- GAME 3: TAP TRAP 30s --- */
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
      const myUid = cred.user.uid;
      setUid(myUid);
      if (initialCode && initialCode.length === 6) {
        get(ref(database, `rooms/${initialCode}`)).then(snap => {
          if (!alive || !snap.exists()) return;
          const r = snap.val();
          if (r.gameType === "tap" && (r.players?.X === myUid || r.players?.O === myUid)) {
            setRoomCode(initialCode);
            setRoom(r);
          }
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
      const next = Array(9).fill(null);
      const t = Math.floor(Math.random() * 9);
      let b = Math.floor(Math.random() * 9);
      while (b === t) b = Math.floor(Math.random() * 9);
      next[t] = Math.random() < 0.2 ? "bonus" : "target";
      next[b] = Math.random() < 0.38 ? "trap" : "target";
      setMpCells(next);
    };
    spawn();
    const sp = setInterval(spawn, 650);
    const ck = setInterval(() => {
      const rem = Math.max(0, Math.ceil((Number(room.endsAt) - Date.now()) / 1000));
      setMpTime(rem);
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
    const n = clean(name);
    if (!uid || busy || !n) return;
    setBusy(true);
    try {
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        exists = (await get(ref(database, `rooms/${code}`))).exists();
      }
      mpScoreRef.current = 0;
      setMpScore(0);
      await set(ref(database, `rooms/${code}`), {
        gameType: "tap",
        players: { X: uid, O: "" },
        playerNames: { X: n, O: "" },
        scores: { X: 0, O: 0 },
        status: "waiting",
        round: 1,
        createdAt: Date.now()
      });
      setRoomCode(code);
      const u = new URL(window.location.href); u.search = ""; u.searchParams.set("tap", code);
      window.history.replaceState({}, "", u.toString());
    } finally { setBusy(false); }
  }

  async function joinTapRoom() {
    const n = clean(name);
    const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !n || code.length !== 6) return;
    setBusy(true);
    try {
      const rRef = ref(database, `rooms/${code}`);
      const snap = await get(rRef);
      if (!snap.exists()) throw new Error("Room not found");
      const existing = snap.val();
      if (existing.gameType !== "tap") throw new Error("Wrong game code");
      await runTransaction(rRef, cur => {
        const r = cur || existing;
        if (!r || r.gameType !== "tap") return;
        if (r.players?.X === uid) return r;
        if (r.players?.O === uid) return { ...r, playerNames: { ...(r.playerNames || {}), O: n } };
        if (r.players?.O) return;
        return {
          ...r,
          players: { ...r.players, O: uid },
          playerNames: { ...(r.playerNames || {}), O: n },
          scores: { X: 0, O: 0 },
          endsAt: Date.now() + 30000,
          status: "playing"
        };
      });
      mpScoreRef.current = 0;
      setMpScore(0);
      setRoomCode(code);
    } catch (e) { setStatus(e.message || "Could not join"); } finally { setBusy(false); }
  }

  function tapMpCell(i) {
    if (!roomCode || !mySide || room?.status !== "playing") return;
    const type = mpCells[i];
    if (!type) return;
    const copy = [...mpCells]; copy[i] = null; setMpCells(copy);
    const delta = type === "trap" ? -15 : type === "bonus" ? 25 : 10;
    const next = Math.max(0, mpScoreRef.current + delta);
    mpScoreRef.current = next;
    setMpScore(next);
    fx(type === "trap" ? "prank" : "tap", type === "trap" ? [30, 30] : 10);
    set(ref(database, `rooms/${roomCode}/scores/${mySide}`), next).catch(() => {});
  }

  async function rematchTap() {
    if (!roomCode || !mySide) return;
    mpScoreRef.current = 0;
    setMpScore(0);
    await runTransaction(ref(database, `rooms/${roomCode}`), cur => {
      if (!cur) return;
      return { ...cur, scores: { X: 0, O: 0 }, endsAt: Date.now() + 30000, status: "playing", round: (cur.round || 1) + 1 };
    });
  }

  function leaveTapRoom() {
    setRoomCode(""); setRoom(null); setJoinCode("");
    const u = new URL(window.location.href); u.searchParams.delete("tap");
    window.history.replaceState({}, "", u.toString());
  }

  useEffect(() => {
    if (mode !== "solo" || !active || over) return undefined;
    const spawn = () => {
      const next = Array(9).fill(null);
      const t = Math.floor(Math.random() * 9);
      let b = Math.floor(Math.random() * 9);
      while (b === t) b = Math.floor(Math.random() * 9);
      next[t] = Math.random() < 0.2 ? "bonus" : "target";
      next[b] = Math.random() < 0.35 ? "trap" : "target";
      setCells(next);
    };
    spawn();
    const sp = setInterval(spawn, 650);
    const ck = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(sp); clearInterval(ck); setActive(false); setOver(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { clearInterval(sp); clearInterval(ck); };
  }, [mode, active, over]);

  function startSolo() {
    fx("tap", 14);
    setLives(3); setScore(0); setTimeLeft(30); setOver(false); setActive(true);
  }

  function tapSoloCell(i) {
    if (!active || over) return;
    const type = cells[i];
    if (!type) return;
    const copy = [...cells]; copy[i] = null; setCells(copy);
    if (type === "trap") {
      fx("prank", [30, 40, 30]);
      setLives(l => { if (l - 1 <= 0) { setActive(false); setOver(true); return 0; } return l - 1; });
    } else {
      fx("tap", 10);
      setScore(s => s + (type === "bonus" ? 25 : 10));
    }
  }

  const shareUrl = (() => {
    const u = new URL(window.location.href); u.search = "";
    if (roomCode) u.searchParams.set("tap", roomCode);
    return u.toString();
  })();

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
          {!active && !over ? (
            <button type="button" className="pop-btn yellow full" onClick={startSolo}>
              <Zap size={16}/> Start Solo Sprint
            </button>
          ) : over ? (
            <div className="pop-ready-card">
              <h3>Score: {score} PTS ⚡</h3>
              <button type="button" className="pop-btn yellow" onClick={startSolo}>Again</button>
            </div>
          ) : (
            <div className="pop-grid-board">
              {cells.map((c, i) => (
                <button key={i} type="button" className={`pop-cell ${c ? `is-${c}` : ""}`} onClick={() => tapSoloCell(i)}>
                  {c === "target" ? "⚡" : c === "bonus" ? "💎" : c === "trap" ? "💣" : ""}
                </button>
              ))}
            </div>
          )}
        </>
      ) : !roomCode ? (
        <>
          <label className="pop-field">
            <span>YOUR NAME</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={18}/>
          </label>
          {initialCode ? (
            <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={joinTapRoom}>
              {busy ? "Joining..." : "Join 30s Battle"}
            </button>
          ) : (
            <>
              <button type="button" className="pop-btn yellow full" disabled={!uid || busy || !clean(name)} onClick={createTapRoom}>
                {busy ? "Creating..." : "⚡ Start 1v1 Tap Battle"}
              </button>
              <div className="pop-divider"><span>OR ENTER CODE</span></div>
              <div className="pop-inline">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="6-CHAR CODE"
                  maxLength={6}
                />
                <button type="button" className="pop-btn white sm" disabled={!uid || busy || joinCode.length !== 6 || !clean(name)} onClick={joinTapRoom}>
                  Join
                </button>
              </div>
            </>
          )}
          {status && <small className="pop-muted">{status}</small>}
        </>
      ) : (
        <>
          <div className="pop-scoreboard">
            <div className={mySide === "X" ? "pop-sb active" : "pop-sb"}>
              <small>{room?.playerNames?.X || "Player 1"}</small>
              <strong>{sX}</strong>
            </div>
            <div className="pop-sb-mid">
              <span>{room?.status === "playing" ? `00:${String(mpTime).padStart(2, "0")}` : `R${room?.round || 1}`}</span>
              <small>{roomCode}</small>
            </div>
            <div className={mySide === "O" ? "pop-sb active" : "pop-sb"}>
              <small>{room?.playerNames?.O || "Waiting..."}</small>
              <strong>{sO}</strong>
            </div>
          </div>

          {room?.status === "waiting" ? (
            <>
              <div className="pop-status-pill">Waiting for friend to join... ⚡</div>
              <UniversalShareBar
                url={shareUrl}
                shareText={`${room?.playerNames?.X || name} challenged you to a 30s Tap Trap battle on ODDORA! ⚡`}
                title="ODDORA Tap Trap"
              />
            </>
          ) : room?.status === "finished" ? (
            <div className="pop-ready-card">
              <div className="pop-big-emoji">🏆</div>
              <h2>{sX === sO ? "TIE!" : sX > sO ? `${room?.playerNames?.X || "P1"} WINS!` : `${room?.playerNames?.O || "P2"} WINS!`}</h2>
              <button type="button" className="pop-btn yellow full" onClick={rematchTap}>
                ↻ Rematch (30s)
              </button>
            </div>
          ) : (
            <div className="pop-grid-board">
              {mpCells.map((c, i) => (
                <button key={i} type="button" className={`pop-cell ${c ? `is-${c}` : ""}`} onClick={() => tapMpCell(i)}>
                  {c === "target" ? "⚡" : c === "bonus" ? "💎" : c === "trap" ? "💣" : ""}
                </button>
              ))}
            </div>
          )}

          <button type="button" className="pop-btn white full" onClick={leaveTapRoom}>
            Leave Room
          </button>
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
    { id: "p1", name: "Kavya", mood: "💀", text: "Sent the Treat Trap to my bestie and she couldn't escape 😂" },
    { id: "p2", name: "Siddharth", mood: "🌍", text: "Me and my girlfriend in London play XO Best-of-5 every night!" },
    { id: "p3", name: "Neha", mood: "💘", text: "Sent the 3-step proposal link and he put the card on his story!" }
  ]);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("🔥");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return onValue(
      ref(database, "vibes"),
      snap => {
        if (!snap.exists()) return;
        const list = Object.entries(snap.val())
          .map(([id, v]) => ({ id, ...v }))
          .filter(v => v && v.text && v.name)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 6);
        if (list.length > 0) setPosts(list);
      },
      () => {}
    );
  }, []);

  async function postFlex(e) {
    e.preventDefault();
    const cleanText = text.trim().slice(0, 140);
    const cleanName = (name.trim() || "Anonymous").slice(0, 20);
    if (!cleanText || sending) return;
    setSending(true);
    fx("tap", 12);
    const item = { name: cleanName, mood, text: cleanText, createdAt: Date.now() };
    try {
      await signInPlayer().catch(() => null);
      await push(ref(database, "vibes"), item);
      setText("");
    } catch {
      setPosts(prev => [{ id: `l-${Date.now()}`, ...item }, ...prev]);
      setText("");
    } finally { setSending(false); }
  }

  return (
    <section className="pop-box">
      <div className="pop-box-head">
        <span>🔥 LIVE FLEX WALL</span>
        <span className="pop-pill-black">{topCreators.reduce((a, b) => a + b.count, 0)}+ CARDS</span>
      </div>

      <form className="pop-stack" onSubmit={postFlex}>
        <div className="pop-chips-row">
          {["🔥", "💀", "💘", "🌍", "😂"].map(m => (
            <button key={m} type="button" className={mood === m ? "pop-chip active" : "pop-chip"} onClick={() => { fx("tap", 8); setMood(m); }}>
              {m}
            </button>
          ))}
        </div>
        <div className="pop-grid-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={20}/>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Drop your reaction..." maxLength={140}/>
        </div>
        <button type="submit" className="pop-btn yellow full" disabled={!text.trim() || sending}>
          <Send size={15}/> {sending ? "Posting..." : "Post Flex"}
        </button>
      </form>

      <div className="pop-stack">
        {posts.map(p => (
          <div className="pop-wall-card" key={p.id}>
            <div className="pop-row-between">
              <span>{p.mood || "⚡"} <strong>{p.name}</strong></span>
              <span className="pop-pill-black">DO OD</span>
            </div>
            <p>“{p.text}”</p>
          </div>
        ))}
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