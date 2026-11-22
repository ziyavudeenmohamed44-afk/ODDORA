import React, { Component, useEffect, useRef, useState } from "react";
import {
  Share2, Send, Zap, Check, Copy, Trophy, X, Inbox,
  ArrowRight, ArrowLeft, Maximize2, Radio, Lock, Unlock,
  Download, Image as ImageIcon, Bookmark, Trash2, Camera, Eye, MessageCircle
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, onValue, push, ref, remove, runTransaction, set } from "firebase/database";

/* ============================================================================
   0. SAFE STORAGE, IMAGE COMPRESSOR, TYPEWRITER HOOK, FULLSCREEN & SOUND FX
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

// Live grey letter-by-letter typewriter hook for active input placeholders!
function useTypewriter(text, active) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!active) {
      setTyped(text);
      return undefined;
    }
    let idx = 0;
    let pauseTicks = 0;
    setTyped("");
    const timer = setInterval(() => {
      if (idx < text.length) {
        idx += 1;
        setTyped(text.slice(0, idx));
      } else {
        pauseTicks += 1;
        if (pauseTicks > 14) {
          idx = 0;
          pauseTicks = 0;
          setTyped("");
        }
      }
    }, 115);
    return () => clearInterval(timer);
  }, [text, active]);
  return typed;
}

// Compress uploaded selfie/photo client-side so it's ₹0 & fast in Firebase RTDB
function compressImageFile(file, maxDim = 680, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
      pop: [
        { f: 420, d: 0.06, v: 0.14, w: "sine", slide: 980 },
        { f: 980, d: 0.08, v: 0.11, w: "triangle", delay: 0.04, slide: 1320 }
      ],
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
   2. ₹0 HUMAN-STYLE ILLUSTRATED POP-ART AVATARS (SVG + CANVAS RENDERER!)
============================================================================ */
const AVATARS = [
  { id: "shades", label: "Ace", bg: "#A3E635", skin: "#F1C27D", hair: "#18181B", shirt: "#14141A", style: "shades" },
  { id: "cap", label: "Kidd", bg: "#3B82F6", skin: "#E0AC69", hair: "#1F2937", shirt: "#FF5A5F", style: "cap" },
  { id: "bob", label: "Riya", bg: "#FF7AB8", skin: "#F5CBA7", hair: "#2C1810", shirt: "#FFD166", style: "bob" },
  { id: "curls", label: "Zara", bg: "#FFD166", skin: "#C68642", hair: "#1C1917", shirt: "#3B82F6", style: "curls" },
  { id: "beanie", label: "Leo", bg: "#FF5A5F", skin: "#FFDBAC", hair: "#3F2A1D", shirt: "#A3E635", style: "beanie" },
  { id: "glasses", label: "Maya", bg: "#A78BFA", skin: "#E0AC69", hair: "#18181B", shirt: "#FFFFFF", style: "glasses" },
  { id: "spiky", label: "Dev", bg: "#38BDF8", skin: "#D2996C", hair: "#14141A", shirt: "#FFD166", style: "spiky" },
  { id: "bun", label: "Neha", bg: "#FB923C", skin: "#F1C27D", hair: "#1F1A17", shirt: "#14141A", style: "bun" }
];

function getAvatarObj(id) {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

function HumanAvatarSVG({ avatarId = "shades", size = 48 }) {
  const a = getAvatarObj(avatarId);
  return (
    <span
      className="pop-avatar-badge"
      style={{ width: size, height: size, background: a.bg }}
      aria-label={a.label}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block", borderRadius: "50%" }}>
        <circle cx="50" cy="50" r="50" fill={a.bg} />
        {/* Shoulders / Hoodie */}
        <path d="M16 102 C18 76 34 70 50 70 C66 70 82 76 84 102 Z" fill={a.shirt} stroke="#14141A" strokeWidth="3.5" />
        {/* Back hair for long/curly/bun styles */}
        {a.style === "bob" && <path d="M24 44 C22 72 30 78 36 74 L64 74 C70 78 78 72 76 44 Z" fill={a.hair} stroke="#14141A" strokeWidth="3" />}
        {a.style === "curls" && (
          <g fill={a.hair} stroke="#14141A" strokeWidth="2.5">
            <circle cx="24" cy="46" r="11" /><circle cx="76" cy="46" r="11" />
            <circle cx="28" cy="30" r="11" /><circle cx="72" cy="30" r="11" />
            <circle cx="50" cy="22" r="13" />
          </g>
        )}
        {a.style === "bun" && <circle cx="50" cy="18" r="12" fill={a.hair} stroke="#14141A" strokeWidth="3" />}
        {/* Neck & Head */}
        <rect x="43" y="62" width="14" height="12" rx="5" fill={a.skin} stroke="#14141A" strokeWidth="2.5" />
        <circle cx="50" cy="46" r="21" fill={a.skin} stroke="#14141A" strokeWidth="3.2" />
        {/* Hair / Hats */}
        {a.style === "shades" && <path d="M28 42 C30 22 70 22 72 42 C64 32 36 32 28 42 Z" fill={a.hair} stroke="#14141A" strokeWidth="2.5" />}
        {a.style === "spiky" && <path d="M28 42 L34 22 L44 30 L52 18 L60 29 L70 23 L72 42 C62 34 38 34 28 42 Z" fill={a.hair} stroke="#14141A" strokeWidth="2.5" strokeLinejoin="round" />}
        {a.style === "bob" && <path d="M28 42 C30 22 70 22 72 42 C60 33 42 33 28 42 Z" fill={a.hair} stroke="#14141A" strokeWidth="2.5" />}
        {a.style === "bun" && <path d="M29 42 C31 24 69 24 71 42 C60 34 40 34 29 42 Z" fill={a.hair} stroke="#14141A" strokeWidth="2.5" />}
        {a.style === "glasses" && <path d="M28 43 C29 22 71 22 72 43 C62 33 38 33 28 43 Z" fill={a.hair} stroke="#14141A" strokeWidth="2.5" />}
        {a.style === "cap" && (
          <g>
            <path d="M27 38 C29 20 71 20 73 38 Z" fill="#FFD166" stroke="#14141A" strokeWidth="3" />
            <path d="M24 38 L80 38 C80 43 72 44 64 43 L27 42 Z" fill="#14141A" />
          </g>
        )}
        {a.style === "beanie" && (
          <g>
            <path d="M28 39 C30 18 70 18 72 39 Z" fill="#14141A" stroke="#14141A" strokeWidth="3" />
            <rect x="26" y="34" width="48" height="8" rx="4" fill="#FFD166" stroke="#14141A" strokeWidth="2.5" />
          </g>
        )}
        {/* Eyes / Shades / Glasses */}
        {a.style === "shades" ? (
          <g>
            <rect x="33" y="42" width="14" height="9" rx="3" fill="#14141A" />
            <rect x="53" y="42" width="14" height="9" rx="3" fill="#14141A" />
            <line x1="47" y1="45" x2="53" y2="45" stroke="#14141A" strokeWidth="3" />
          </g>
        ) : a.style === "glasses" ? (
          <g>
            <circle cx="41" cy="46" r="6" fill="#FFFFFF" fillOpacity="0.6" stroke="#14141A" strokeWidth="2.5" />
            <circle cx="59" cy="46" r="6" fill="#FFFFFF" fillOpacity="0.6" stroke="#14141A" strokeWidth="2.5" />
            <line x1="47" y1="46" x2="53" y2="46" stroke="#14141A" strokeWidth="2.5" />
            <circle cx="41" cy="46" r="2.2" fill="#14141A" />
            <circle cx="59" cy="46" r="2.2" fill="#14141A" />
          </g>
        ) : (
          <g>
            <circle cx="41" cy="46" r="2.8" fill="#14141A" />
            <circle cx="59" cy="46" r="2.8" fill="#14141A" />
          </g>
        )}
        {/* Warm Smile */}
        <path d="M42 56 Q50 63 58 56" fill="none" stroke="#14141A" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// Draw crisp Human-Style Avatar directly onto 9:16 Share Canvas!
function drawHumanAvatarCanvas(ctx, avatarId, cx, cy, r) {
  const a = getAvatarObj(avatarId);
  const s = r / 50;
  ctx.save();
  ctx.translate(cx, cy);

  // Outer drop shadow
  ctx.fillStyle = "#14141A";
  ctx.beginPath();
  ctx.arc(8, 8, r, 0, Math.PI * 2);
  ctx.fill();

  // Clip circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = a.bg;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Shoulders
  ctx.fillStyle = a.shirt;
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 3.5 * s;
  ctx.beginPath();
  ctx.ellipse(0, 48 * s, 36 * s, 26 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Back hair
  if (a.style === "curls") {
    ctx.fillStyle = a.hair;
    [[-26, -4], [26, -4], [-22, -20], [22, -20], [0, -28]].forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx * s, hy * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (a.style === "bun") {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(0, -32 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Head
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.arc(0, -4 * s, 21 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Top Hair / Cap / Beanie
  if (a.style === "cap") {
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 22 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#14141A";
    ctx.fillRect(-24 * s, -12 * s, 54 * s, 6 * s);
  } else if (a.style === "beanie") {
    ctx.fillStyle = "#14141A";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 22 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD166";
    ctx.fillRect(-23 * s, -16 * s, 46 * s, 8 * s);
    ctx.strokeRect(-23 * s, -16 * s, 46 * s, 8 * s);
  } else {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(0, -10 * s, 22 * s, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // Eyes / Shades
  ctx.fillStyle = "#14141A";
  if (a.style === "shades") {
    ctx.fillRect(-17 * s, -8 * s, 14 * s, 9 * s);
    ctx.fillRect(3 * s, -8 * s, 14 * s, 9 * s);
    ctx.fillRect(-4 * s, -6 * s, 8 * s, 3 * s);
  } else {
    ctx.beginPath();
    ctx.arc(-9 * s, -4 * s, 3 * s, 0, Math.PI * 2);
    ctx.arc(9 * s, -4 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    if (a.style === "glasses") {
      ctx.strokeStyle = "#14141A";
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(-9 * s, -4 * s, 6.5 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9 * s, -4 * s, 6.5 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Smile
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 3 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 3 * s, 8 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();

  // Crisp Circle Border
  ctx.strokeStyle = "#14141A";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Bubble Burst Particle Overlay on intro & card transitions!
function BubbleBurst({ triggerKey }) {
  if (!triggerKey) return null;
  const colors = ["#FFD166", "#FF5A5F", "#A3E635", "#3B82F6", "#FF7AB8", "#FFFFFF"];
  const bubbles = Array.from({ length: 16 }).map((_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const dist = 75 + (i % 3) * 42;
    const tx = Math.round(Math.cos(angle) * dist);
    const ty = Math.round(Math.sin(angle) * dist);
    const sz = 12 + (i % 4) * 6;
    return { tx, ty, sz, color: colors[i % colors.length], delay: (i % 3) * 0.025 };
  });

  return (
    <div className="pop-bubble-burst-layer" key={triggerKey} aria-hidden="true">
      {bubbles.map((b, idx) => (
        <span
          key={idx}
          className="pop-bubble-dot"
          style={{
            width: b.sz,
            height: b.sz,
            backgroundColor: b.color,
            "--tx": `${b.tx}px`,
            "--ty": `${b.ty}px`,
            animationDelay: `${b.delay}s`
          }}
        />
      ))}
    </div>
  );
}

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
  if (variant === "vault" || variant === "gold") {
    return (
      <svg viewBox="0 0 160 120" className="pop-char-svg" aria-hidden="true">
        <rect x="42" y="48" width="76" height="54" rx="14" fill="#FFD166" stroke="#14141A" strokeWidth="3.5" />
        <path d="M58 48 V34 C58 20 102 20 102 34 V48" fill="none" stroke="#14141A" strokeWidth="5" strokeLinecap="round" />
        <circle cx="80" cy="72" r="9" fill="#14141A" />
        <rect x="77" y="76" width="6" height="12" rx="3" fill="#14141A" />
        <text x="16" y="42" fontSize="20">✨</text>
        <text x="124" y="42" fontSize="20">🔐</text>
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
   3. SPARKS, PUZZLES & HELPERS
============================================================================ */
const TRAP_SPARKS = [
  { id: "treat", tag: "🍕 Treat Trap", cardColor: "lime", title: "You owe me food today 🍕", yesLabel: "Fine, I'll pay 💸", noLabel: "No", yesMessage: "Screenshot locked! See you at the food spot 🍕🔥" },
  { id: "crush", tag: "💘 Coffee Date", cardColor: "pink", title: "Coffee & late drive tonight? ☕", yesLabel: "Lock it in 💘", noLabel: "No", yesMessage: "It's a date! Send your location ✨🚗" },
  { id: "fight", tag: "🥊 Dare", cardColor: "gold", title: "Loser buys biryani tonight 🔥", yesLabel: "Deal! 🍗", noLabel: "No", yesMessage: "Challenge locked! No backing out now 🔥" },
  { id: "ldr", tag: "🌍 Miss Me?", cardColor: "cyan", title: "Admit you miss me right now 👀", yesLabel: "100% Yes 🥺", noLabel: "No", yesMessage: "Caught in 4K! FaceTime tonight 🌍💞" }
];

const ODD_PUZZLES = [
  { normal: "😎", odd: "🥸", hint: "Spot the undercover emoji!" },
  { normal: "🍕", odd: "🍔", hint: "Find the impostor snack!" },
  { normal: "🔒", odd: "🔓", hint: "Tap the unlocked padlock!" },
  { normal: "💘", odd: "💔", hint: "Spot the odd heart!" },
  { normal: "👻", odd: "👽", hint: "Find the alien hiding here!" }
];

const TALKING_NO_EN = ["Catch me 👀", "Too slow 😜", "Almost! 🏃‍♂️", "Okay fine..."];
const TALKING_NO_TA = ["Vandhu thodu 👀", "Mudinja va 🔥", "Ayyo miss! 😂", "Seri okay..."];
const SENDER_QUICK_REPLIES = ["Caught in 4K 📸", "Treat locked 🍕", "Haha gotcha 😂", "No take-backs! ⚡"];

function isTamilOrTanglish(text = "") {
  const s = String(text || "");
  if (/[\u0B80-\u0BFF]/.test(s)) return true;
  if (/\b(da|di|va|vaa|vaada|venam|vendam|mudiyadhu|mudinja|pudichiruka|pudikuma|saapda|sapda|saapadu|sapadu|polama|pogalama|povoma|sandai|machan|machi|mapla|nanba|thala|unga|ungaluku|enna|ena|illa|aama|seri|vaangi|tharen|panra|idhu|nalla|iruku|sollu)\b/i.test(s)) {
    return true;
  }
  return /(lama|viya|riya|veenga|duven|poren|varen)\b/i.test(s);
}

function generateSmartTrapOutcome(questionText, senderName) {
  const q = String(questionText || "").toLowerCase();
  const from = (senderName || "your friend").trim();
  if (/(food|treat|pizza|biryani|shawarma|pay|gpay|saapda|coffee)/i.test(q)) {
    return `Deal locked! ${from} is officially waiting for that treat 🍕💸`;
  }
  if (/(miss|distance|meet|call|video|flight)/i.test(q)) {
    return `Accepted! Call & meetup locked in with ${from} 🌍💞`;
  }
  return `Locked in with ${from}! Screenshot saved — no take-backs ⚡✨`;
}

/* ============================================================================
   4. MODERN 9:16 FULL-BLEED STORY POSTER (1080 x 1920 — NO NOTICE PAPER!)
   + Auto-attaches clickable website link & caption when sharing!
============================================================================ */
async function createPoster916({ kicker, bigTitle, subText, statPill, actorName, avatarId = "shades", cardColor = "lime", footerUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const palettes = {
    lime: { bg1: "#0B1310", bg2: "#163020", accent: "#A3E635", pill: "#FF5A5F" },
    pink: { bg1: "#180A14", bg2: "#3B0D27", accent: "#FF7AB8", pill: "#FFD166" },
    cyan: { bg1: "#081226", bg2: "#142D5C", accent: "#38BDF8", pill: "#FFD166" },
    gold: { bg1: "#1A1205", bg2: "#3D2607", accent: "#FFD166", pill: "#FF5A5F" }
  };
  const pal = palettes[cardColor] || palettes.lime;

  // Full-bleed sleek dark gradient poster
  const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Big atmospheric radial glow behind Avatar & Headline
  const glow1 = ctx.createRadialGradient(540, 620, 40, 540, 620, 560);
  glow1.addColorStop(0, `${pal.accent}50`);
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle decorative rings
  ctx.strokeStyle = `${pal.accent}22`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(540, 560, 290, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(540, 560, 410, 0, Math.PI * 2); ctx.stroke();

  // Top ODDORA Brand Pill
  ctx.fillStyle = pal.accent;
  drawRoundRect(ctx, 270, 145, 540, 74, 37);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#14141A";
  ctx.font = "800 30px 'DM Mono', monospace";
  ctx.fillText(`⚡ ODDORA · ${kicker.toUpperCase()}`, 540, 193);

  // Big Human-Style Illustrated Avatar (Personification!)
  drawHumanAvatarCanvas(ctx, avatarId, 540, 515, 165);

  // Person Name Tag under Avatar
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 42px 'Space Grotesk', sans-serif";
  ctx.fillText(String(actorName || "ODDORA PLAYER").toUpperCase(), 540, 760);

  // Huge Direct-on-Poster Hero Typography (NO boxy white paper!)
  const drawHeroLines = (text, centerY, maxW, lh, font) => {
    ctx.font = font;
    ctx.fillStyle = "#FFFFFF";
    const words = String(text || "").split(" ");
    let line = "";
    const lines = [];
    for (const w of words) {
      const test = `${line} ${w}`.trim();
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    const totalH = lines.length * lh;
    let yy = centerY - totalH / 2 + lh * 0.72;
    lines.slice(0, 4).forEach(l => {
      ctx.fillText(l, 540, yy);
      yy += lh;
    });
  };
  drawHeroLines(`“${bigTitle}”`, 1030, 880, 92, "800 72px 'Space Grotesk', sans-serif");

  // Sub-caption
  if (subText) {
    ctx.fillStyle = pal.accent;
    ctx.font = "700 38px 'Space Grotesk', sans-serif";
    ctx.fillText(String(subText).slice(0, 46), 540, 1295);
  }

  // Tilted Vibrant Stat Sticker
  if (statPill) {
    ctx.save();
    ctx.translate(540, 1435);
    ctx.rotate(-0.025);
    ctx.fillStyle = "#14141A";
    drawRoundRect(ctx, -360, -48, 732, 102, 51);
    ctx.fill();

    ctx.fillStyle = pal.pill;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    drawRoundRect(ctx, -368, -56, 732, 102, 51);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.pill === "#FFD166" ? "#14141A" : "#FFFFFF";
    ctx.font = "800 38px 'Space Grotesk', sans-serif";
    ctx.fillText(statPill, 0, 10);
    ctx.restore();
  }

  // Bottom Link Pill (9:16 Safe Zone)
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  drawRoundRect(ctx, 140, 1625, 800, 150, 34);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 34px 'Space Grotesk', sans-serif";
  ctx.fillText("TRY IT YOURSELF ON ODDORA ⚡", 540, 1690);

  ctx.fillStyle = pal.accent;
  ctx.font = "700 30px 'DM Mono', monospace";
  ctx.fillText(footerUrl, 540, 1742);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Blob failed");
  return new File([blob], "oddora-proof.png", { type: "image/png" });
}

async function sharePosterWithLink({ posterArgs, caption, onStatus }) {
  const siteUrl = window.location.origin;
  const fullShareText = `${caption}\nTry it here 👉 ${siteUrl}`;
  try {
    await navigator.clipboard?.writeText(fullShareText).catch(() => {});
    const file = await createPoster916({ ...posterArgs, footerUrl: window.location.host });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "ODDORA ⚡",
        text: fullShareText,
        url: siteUrl,
        files: [file]
      });
      onStatus?.("Shared! Link also copied to clipboard 🔗");
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oddora-proof.png";
      a.click();
      URL.revokeObjectURL(url);
      onStatus?.("Poster saved + link copied! Paste in WhatsApp/Insta 🔗");
    }
  } catch {
    onStatus?.("Link copied! Paste in WhatsApp/Insta 🔗");
  }
}


/* ============================================================================
   5B. PERSISTENT 2-WAY LIVE CHAT HISTORY (Survives Close, Reload & Late Replies!)
============================================================================ */
function useTwoWayChat(code) {
  const [rxMsgs, setRxMsgs] = useState([]);
  const [txMsgs, setTxMsgs] = useState([]);

  useEffect(() => {
    if (!code) return undefined;
    const u1 = onValue(
      ref(database, `replies/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        setRxMsgs(list.map(m => ({
          side: "receiver",
          from: m.from || "Friend",
          text: m.text || "",
          ts: Number(m.createdAt || m.ts || 0)
        })));
      },
      () => {}
    );
    const u2 = onValue(
      ref(database, `senderReplies/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        setTxMsgs(list.map(m => ({
          side: "sender",
          from: m.from || "Sender",
          text: m.text || "",
          ts: Number(m.ts || m.createdAt || 0)
        })));
      },
      () => {}
    );
    return () => { u1(); u2(); };
  }, [code]);

  return [...rxMsgs, ...txMsgs]
    .filter(m => m.text)
    .sort((a, b) => a.ts - b.ts);
}

function ChatHistoryBox({ messages, viewerSide = "receiver" }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  if (!messages.length) return null;
  return (
    <div className="pop-chat-history">
      {messages.map((m, idx) => {
        const isMe = m.side === viewerSide;
        return (
          <div key={idx} className={`pop-chat-bubble ${isMe ? "me" : "them"}`}>
            <small>{isMe ? "You" : m.from}</small>
            <span>{m.text}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

/* ============================================================================
   5. REUSABLE 📡 LIVE RADAR + 2-WAY SENDER REPLY + SENDER FLEX SHARE!
============================================================================ */
function LiveRadarPanel({ code, recipientName, senderName, avatarId = "shades", cardColor = "lime", isVault = false }) {
  const [events, setEvents] = useState([]);
  const chatHistory = useTwoWayChat(code);
  const [replyText, setReplyText] = useState("");
  const [sentFlash, setSentFlash] = useState("");
  const [liveToast, setLiveToast] = useState("");
  const [sharingFlex, setSharingFlex] = useState(false);

  useEffect(() => {
    if (!code) return undefined;
    let initialCount = -1;
    return onValue(
      ref(database, `live/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        if (initialCount !== -1 && list.length > initialCount) {
          const newest = list[list.length - 1];
          fx("notify", [35, 50, 35]);
          if (newest?.msg && !String(newest.msg).startsWith("📤")) {
            setLiveToast(newest.msg);
            setTimeout(() => setLiveToast(""), 5500);
          }
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

  async function handleSenderFlexShare() {
    if (sharingFlex) return;
    setSharingFlex(true);
    fx("tap", 14);
    const rec = recipientName || "my friend";
    const me = senderName || "Me";
    await sharePosterWithLink({
      posterArgs: {
        kicker: isVault ? "SECRET VAULT" : "CAUGHT IN 4K",
        bigTitle: isVault
          ? `I locked a secret for ${rec} 🔐`
          : `I trapped ${rec} using OD - Trap! 😂`,
        subText: isVault ? "Made them solve 2 puzzles to see it" : "They couldn't even press No ⚡",
        statPill: isVault ? "🔐 VAULT MASTER" : "⚡ MISSION SUCCESS",
        actorName: me,
        avatarId,
        cardColor
      },
      caption: isVault
        ? `I locked a secret for ${rec} on ODDORA 🔐`
        : `I just trapped ${rec} using OD - Trap 😂⚡`,
      onStatus: msg => {
        setSentFlash(msg);
        setTimeout(() => setSentFlash(""), 3500);
      }
    });
    setSharingFlex(false);
  }

  return (
    <>
      {liveToast && (
        <div className="pop-toast" onClick={() => setLiveToast("")}>
          {liveToast}
        </div>
      )}
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

      {/* Sender Perspective Flex Share! */}
      <button
        type="button"
        className="pop-btn lime sm full"
        onClick={handleSenderFlexShare}
        disabled={sharingFlex}
      >
        <Share2 size={14}/>{" "}
        {sharingFlex
          ? "Creating Flex..."
          : isVault
            ? `🔐 Flex: I Locked a Secret for ${recipientName || "Friend"}!`
            : `😂 Flex: I Trapped ${recipientName || "Friend"}!`}
      </button>

      <div className="pop-radar-reply-wrap">
        <ChatHistoryBox messages={chatHistory} viewerSide="sender" />
        <div className="pop-chips-row">
          {SENDER_QUICK_REPLIES.map(chip => (
            <button key={chip} type="button" className="pop-chip dark-chip" onClick={() => sendLiveReply(chip)}>
              {chip}
            </button>
          ))}
        </div>
        <form className="pop-react-form" onSubmit={e => { e.preventDefault(); sendLiveReply(replyText); }}>
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onFocus={focusScrollCenter}
            placeholder={`Send live reply / PIN to ${recipientName || "them"}...`}
            maxLength={120}
          />
          <button type="submit" className="pop-btn yellow sm" disabled={!replyText.trim()}>
            <Send size={14}/>
          </button>
        </form>
        {sentFlash && <small style={{ color: "#A3E635", fontWeight: 700 }}>{sentFlash}</small>}
      </div>
    </div>
    </>
  );
}

/* ============================================================================
   6. MAIN APP SHELL (Top ODDORA Logo Always Goes Home + Shelf Full-Screen View)
============================================================================ */
function MainApp() {
  const [tab, setTab] = useState("create"); // "create" | "shelf" | "wall"
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [activeStudioMode, setActiveStudioMode] = useState(""); // "" | "trap" | "vault"
  const [watchLiveItem, setWatchLiveItem] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_active_radar", "null")); } catch { return null; }
  });
  useEffect(() => {
    if (watchLiveItem) safeSetStorage("oddora_active_radar", JSON.stringify(watchLiveItem));
    else safeRemoveStorage("oddora_active_radar");
  }, [watchLiveItem]);
  const [viewingShelfItem, setViewingShelfItem] = useState(null);
  const [logoSpin, setLogoSpin] = useState(false);
  const [odcCode, setOdcCode] = useState("");
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

  const [savedShelf, setSavedShelf] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_treasure_shelf", "[]")); } catch { return []; }
  });

  const [repliesMap, setRepliesMap] = useState({});

  const [topCreators, setTopCreators] = useState([
    { id: "t1", name: "Aarav", label: "OD Trap ⚡", count: 42 },
    { id: "t2", name: "Maya", label: "OD Vault 🔐", count: 31 },
    { id: "t3", name: "Rohan", label: "OD Trap ⚡", count: 27 }
  ]);

  function goHome() {
    fx("tap", 12);
    setLogoSpin(false);
    requestAnimationFrame(() => setLogoSpin(true));
    setPickerModalOpen(false);
    setInboxOpen(false);
    setViewingShelfItem(null);
    setWatchLiveItem(null);
    setActiveStudioMode("");
    setOdcCode("");
    setTab("create");
    const u = new URL(window.location.href);
    u.searchParams.delete("odc");
    window.history.replaceState({}, "", u.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const markReenter = () => {
      if (safeGetStorage("oddora_fs_pref") === "1" && !document.fullscreenElement) {
        needsFsReenterRef.current = true;
      }
    };
    const onVisChange = () => {
      if (document.visibilityState === "visible") markReenter();
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) markReenter();
    };
    const onFirstTap = () => {
      if (needsFsReenterRef.current && safeGetStorage("oddora_fs_pref") === "1") {
        needsFsReenterRef.current = false;
        requestAppFullscreen();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("click", onFirstTap, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("click", onFirstTap);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const createCode = (params.get("odc") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (createCode.length === 6) setOdcCode(createCode);
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
            label: item.type === "vault" ? "OD Vault 🔐" : "OD Trap ⚡",
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

  function handleSaveToShelf(memoryItem) {
    setSavedShelf(prev => {
      const updated = [memoryItem, ...prev.filter(x => x.id !== memoryItem.id)].slice(0, 20);
      safeSetStorage("oddora_treasure_shelf", JSON.stringify(updated));
      return updated;
    });
  }

  function removeFromShelf(id) {
    fx("tap", 10);
    setSavedShelf(prev => {
      const updated = prev.filter(x => x.id !== id);
      safeSetStorage("oddora_treasure_shelf", JSON.stringify(updated));
      return updated;
    });
    if (viewingShelfItem?.id === id) setViewingShelfItem(null);
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
        onSaveToShelf={handleSaveToShelf}
        onPendingUpdate={cardObj => {
          setPendingCard(cardObj);
          if (cardObj) safeSetStorage("oddora_pending_card", JSON.stringify(cardObj));
          else safeRemoveStorage("oddora_pending_card");
        }}
        onGoHome={goHome}
        onExit={creatorName => {
          setOdcCode("");
          const u = new URL(window.location.href);
          u.searchParams.delete("odc");
          window.history.replaceState({}, "", u.toString());
          if (creatorName) {
            try { window.sessionStorage.setItem("oddora_reply_to", creatorName); } catch {}
            setPickerModalOpen(true);
          } else {
            setTab("create");
          }
        }}
      />
    );
  }

  // 2. FULL-SCREEN WATCH LIVE RECONNECT
  if (watchLiveItem) {
    const shareUrl = (() => {
      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("odc", watchLiveItem.code);
      return u.toString();
    })();
    return (
      <div className={`pop-fs-stage theme-${watchLiveItem.theme || (String(watchLiveItem.title || "").toLowerCase().includes("vault") ? "gold" : "lime")}`}>
        <div className="pop-fs-topbar">
          <button type="button" className="pop-pill-black pop-pill-btn" onClick={goHome}>
            ⚡ ODDORA · HOME
          </button>
          <button type="button" className="pop-btn pink sm" onClick={() => { fx("tap", 10); setWatchLiveItem(null); }}>
            ✕ Back
          </button>
        </div>
        <div className="pop-fs-content">
          <div className="pop-ready-card pop-zoom-in" style={{ width: "100%" }}>
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
              avatarId={watchLiveItem.avatarId || "shades"}
              cardColor={watchLiveItem.theme || (String(watchLiveItem.title || "").toLowerCase().includes("vault") ? "gold" : "lime")}
              isVault={Boolean(watchLiveItem.isVault || String(watchLiveItem.title || "").toLowerCase().includes("vault"))}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. FULL-SCREEN CREATOR WIZARD
  if (activeStudioMode) {
    return (
      <FullScreenCreatorWizard
        initialMode={activeStudioMode}
        onLinkCreated={handleSavedLink}
        onClose={goHome}
      />
    );
  }

  const totalReplies = Object.values(repliesMap).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="pop-shell">
      {toastMsg && (
        <div className="pop-toast" onClick={() => { fx("tap", 12); setToastMsg(""); setInboxOpen(true); }}>
          {toastMsg}
        </div>
      )}

      {/* FIXED TOP HEADER — ODDORA logo ALWAYS goes Home! */}
      <header className="pop-header">
        <button type="button" className="pop-brand pop-brand-btn" onClick={goHome}>
          <span className={logoSpin ? "pop-coin spin" : "pop-coin"} onAnimationEnd={() => setLogoSpin(false)}>O</span>
          <span className="pop-brand-title">ODDORA</span>
          <span className="pop-pill-black">DO OD</span>
        </button>

        <div className="pop-header-actions">
          <button type="button" className="pop-btn white sm pop-inbox-btn" onClick={() => { fx("tap", 12); setInboxOpen(true); }}>
            <Inbox size={15}/> Inbox
            {totalReplies > 0 && <span className="pop-inbox-badge">{totalReplies}</span>}
          </button>
          <button type="button" className="pop-btn yellow sm" onClick={() => { fx("tap", 12); setPickerModalOpen(true); }}>
            ⚡ Create
          </button>
        </div>
      </header>

      <main className="pop-main" id="top">
        {pendingCard && pendingCard.code && (
          <div className="pop-pending-banner">
            <div className="pop-pending-text">
              <strong>⚡ {pendingCard.from || "A friend"} sent you a secret card!</strong>
              <small>Tap to unlock without going back to WhatsApp.</small>
            </div>
            <div className="pop-pending-actions">
              <button type="button" className="pop-btn yellow sm" onClick={() => { fx("seal", 14); setOdcCode(pendingCard.code); }}>
                🔓 Open
              </button>
              <button type="button" className="pop-btn white sm" onClick={dismissPendingCard} aria-label="Dismiss">✕</button>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section className="pop-hero">
          <div className="pop-hero-top">
            <div className="pop-sticker-row">
              <span className="pop-tag lime">TRAP</span>
              <span className="pop-tag gold">VAULT</span>
              <span className="pop-tag pink">WATCH LIVE</span>
            </div>
            <div className="pop-banner-title">
              <h1>LINKS THEY CAN'T RESIST!</h1>
            </div>
            <p className="pop-hero-tagline">
              Drop a runaway OD - Trap or a locked Secret Vault in WhatsApp & Insta DMs.
            </p>
          </div>

          <div className="pop-cards-fan">
            <div className="pop-trade-card lime-hero tilt-left" onClick={() => launchWizard("trap")}>
              <span className="pop-card-num">01</span>
              <PopCharacterArt variant="lime" />
              <div className="pop-card-label">OD - TRAP ⚡</div>
            </div>

            <HeroLiveCard
              logoSpin={logoSpin}
              onSpinLogo={() => { fx("tap", 14); setLogoSpin(false); requestAnimationFrame(() => setLogoSpin(true)); }}
            />

            <div className="pop-trade-card gold-hero tilt-right" onClick={() => launchWizard("vault")}>
              <span className="pop-card-num">03</span>
              <PopCharacterArt variant="vault" />
              <div className="pop-card-label">OD - VAULT 🔐</div>
            </div>
          </div>
        </section>

        {/* CLEAN 3 TABS */}
        <div id="play-deck" className="pop-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "create"}
            className={tab === "create" ? "pop-tab active yellow" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("create"); }}
          >
            ⚡ Create
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "shelf"}
            className={tab === "shelf" ? "pop-tab active blue" : "pop-tab"}
            onClick={() => { fx("tap", 10); setTab("shelf"); }}
          >
            🔐 My Shelf {savedShelf.length > 0 ? `(${savedShelf.length})` : ""}
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

        {/* TAB 1: CHOOSE YOUR MOVE */}
        {tab === "create" && (
          <section className="pop-box">
            <div className="pop-box-head">
              <span>⚡ CHOOSE YOUR MOVE</span>
              <span className="pop-pill-black">10s SETUP</span>
            </div>

            <div className="pop-subcat-grid">
              <button type="button" className="pop-subcat-card lime" onClick={() => launchWizard("trap")}>
                <div className="pop-subcat-top">
                  <span className="pop-pill-black">RUNAWAY NO</span>
                  <ArrowRight size={18}/>
                </div>
                <PopCharacterArt variant="lime" />
                <h3>⚡ OD - Trap</h3>
                <p>The “No” button talks & runs away until they give in!</p>
              </button>

              <button type="button" className="pop-subcat-card gold-card" onClick={() => launchWizard("vault")}>
                <div className="pop-subcat-top">
                  <span className="pop-pill-black">2-PUZZLE LOCK</span>
                  <ArrowRight size={18}/>
                </div>
                <PopCharacterArt variant="vault" />
                <h3>🔐 OD - Vault</h3>
                <p>Lock a secret text or selfie behind 2 fun puzzles + keep memories private!</p>
              </button>
            </div>
          </section>
        )}

        {/* TAB 2: LOCAL TREASURE SHELF (Tap any memory to open Full-Screen Viewer!) */}
        {tab === "shelf" && (
          <section className="pop-box">
            <div className="pop-box-head">
              <span>🔐 MY TREASURE SHELF</span>
              <span className="pop-pill-black">PRIVATE · ON-DEVICE</span>
            </div>
            {savedShelf.length === 0 ? (
              <p className="pop-muted" style={{ textAlign: "center", padding: "12px 0" }}>
                Unlocked secrets you save will stay here privately on your phone! 🔐
              </p>
            ) : (
              <div className="pop-stack">
                {savedShelf.map(mem => (
                  <div
                    className="pop-shelf-card"
                    key={mem.id}
                    onClick={() => { fx("tap", 12); setViewingShelfItem(mem); }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="pop-row-between">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <HumanAvatarSVG avatarId={mem.avatarId} size={34} />
                        <strong>From {mem.from}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="pop-btn yellow sm"
                          onClick={e => { e.stopPropagation(); fx("tap", 12); setViewingShelfItem(mem); }}
                        >
                          <Eye size={13}/> View
                        </button>
                        <button
                          type="button"
                          className="pop-btn white sm"
                          onClick={e => { e.stopPropagation(); removeFromShelf(mem.id); }}
                        >
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                    {mem.image && <img src={mem.image} alt="Secret memory" className="pop-shelf-img" />}
                    {mem.text && <p className="pop-shelf-text">“{mem.text}”</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
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
                <span className="pop-lb-badge">{c.count} ⚡</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="pop-footer">
        <strong>⚡ ODDORA · DO OD</strong>
        <span>Built for DMs, Stories & Secret Memories.</span>
      </footer>

      {/* FULL-SCREEN SHELF MEMORY VIEWER MODAL */}
      {viewingShelfItem && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setViewingShelfItem(null); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setViewingShelfItem(null)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card pop-zoom-in">
              <HumanAvatarSVG avatarId={viewingShelfItem.avatarId} size={60} />
              <span className="pop-pill-black">🔐 MEMORY FROM {String(viewingShelfItem.from || "FRIEND").toUpperCase()}</span>
              {viewingShelfItem.image && (
                <div className="pop-vault-photo-frame">
                  <img src={viewingShelfItem.image} alt="Memory" className="pop-vault-clear-img" style={{ maxHeight: 380 }} />
                </div>
              )}
              {viewingShelfItem.text && (
                <div className="pop-sender-hero-msg" style={{ fontSize: 20 }}>“{viewingShelfItem.text}”</div>
              )}
              <div className="pop-grid-2">
                {viewingShelfItem.image && (
                  <button
                    type="button"
                    className="pop-btn blue sm"
                    onClick={() => {
                      fx("tap", 14);
                      const a = document.createElement("a");
                      a.href = viewingShelfItem.image;
                      a.download = `oddora-memory-${viewingShelfItem.id}.jpg`;
                      a.click();
                    }}
                  >
                    <Download size={14}/> Save to Gallery
                  </button>
                )}
                <button type="button" className="pop-btn pink sm" onClick={() => removeFromShelf(viewingShelfItem.id)}>
                  <Trash2 size={14}/> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLEAN MODE PICKER MODAL */}
      {pickerModalOpen && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPickerModalOpen(false); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setPickerModalOpen(false)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card pop-zoom-in">
              <span className="pop-pill-black">⚡ ODDORA</span>
              <h2>Pick your move ⚡</h2>
              <div className="pop-stack" style={{ width: "100%" }}>
                <button type="button" className="pop-btn lime lg full" onClick={() => launchWizard("trap")}>
                  ⚡ OD - Trap (Runaway “No”)
                </button>
                <button type="button" className="pop-btn yellow lg full" onClick={() => launchWizard("vault")}>
                  🔐 OD - Vault (Secret Lock)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLIES INBOX MODAL */}
      {inboxOpen && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setInboxOpen(false); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setInboxOpen(false)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card pop-zoom-in">
              <span className="pop-pill-black">📬 YOUR INBOX</span>
              <h2>Inbox</h2>
              {myLinks.length === 0 ? (
                <p className="pop-muted">Create & share a link—friend reactions will pop up here live!</p>
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
                          <button type="button" className="pop-btn blue sm" onClick={() => { fx("tap", 12); setInboxOpen(false); setWatchLiveItem(item); }}>
                            <Radio size={13}/> Live
                          </button>
                          <button type="button" className="pop-btn yellow sm" onClick={() => sendAnotherTo(item.to)}>
                            ⚡ New
                          </button>
                          <button type="button" className="pop-btn white sm" onClick={() => deleteInboxItem(item.code)}>
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
   7. HERO CENTER INTERACTIVE CARD (Zero Overlap Between Text, Yes & No!)
============================================================================ */
function HeroLiveCard({ logoSpin, onSpinLogo }) {
  const [dodges, setDodges] = useState(0);
  const [limit] = useState(() => 3);
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
    // Strictly tiny safe hops inside bottom zone — NEVER overlaps title or Yes button!
    const hops = [
      { x: 6, y: 12 },
      { x: -4, y: 14 }
    ];
    setOffset(hops[(next - 1) % hops.length]);
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
          <h3>“Buying coffee today? ☕”</h3>
          <div className="pop-demo-btns">
            <button type="button" className="pop-btn lime sm" onClick={() => { fx("win", [20, 30, 20]); setAccepted(true); }}>
              Yes 💸
            </button>
            <button
              type="button"
              className="pop-btn pink sm pop-dodge-btn"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
              onClick={dodgeNo}
            >
              {dodges > 0 ? ["Nope!", "Miss!"][Math.min(dodges - 1, 1)] : "No"}
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
   8. 2-SCREEN CREATOR WIZARD
   - Intro Bubble Burst + Pop-Up Card
   - Guided Flow: Avatar -> Your Name ("Sam" typewriter) -> Their Name ("Alex") -> Question ("Coffee tonight?")
   - Selfie Camera (capture="user") + Gallery Upload
   - PIN Clue / Hint for Vault
============================================================================ */
function FullScreenCreatorWizard({ initialMode = "trap", onLinkCreated, onClose }) {
  const [mode] = useState(initialMode); // "trap" | "vault"
  const [step, setStep] = useState(0); // 0 -> 1 -> 2
  const [burstKey, setBurstKey] = useState(1); // Intro bubble burst right on open!
  const [busy, setBusy] = useState(false);
  const [liveCode, setLiveCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const [avatarPicked, setAvatarPicked] = useState(false);
  const [avatarId, setAvatarId] = useState("shades");
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState(() => {
    try {
      const r = window.sessionStorage.getItem("oddora_reply_to") || "";
      if (r) window.sessionStorage.removeItem("oddora_reply_to");
      return r;
    } catch { return ""; }
  });
  const [cardColor, setCardColor] = useState(initialMode === "vault" ? "gold" : "lime");

  // OD - Trap fields
  const [questionInput, setQuestionInput] = useState("");
  const [yesLabelInput, setYesLabelInput] = useState("");
  const [noLabelInput, setNoLabelInput] = useState("");
  const [yesMsgInput, setYesMsgInput] = useState("");

  // OD - Vault fields
  const [secretText, setSecretText] = useState("");
  const [secretImage, setSecretImage] = useState("");
  const [vaultPin, setVaultPin] = useState("");
  const [vaultPinHint, setVaultPinHint] = useState("");
  const [autoDelete, setAutoDelete] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Play intro pop sound once on open
  useEffect(() => {
    fx("pop", 14);
  }, []);

  const defaultQ = TRAP_SPARKS[0].title;
  const effectiveQ = questionInput.trim() || defaultQ;
  const smartTrapOut = generateSmartTrapOutcome(effectiveQ, senderName.trim() || "your friend");

  // Auto-cycle avatar preview like a live demo until user picks one or starts typing!
  useEffect(() => {
    if (step !== 0 || avatarPicked || senderName.trim()) return undefined;
    let idx = 0;
    const t = setInterval(() => {
      idx = (idx + 1) % AVATARS.length;
      setAvatarId(AVATARS[idx].id);
    }, 1150);
    return () => clearInterval(t);
  }, [step, avatarPicked, senderName]);

  // Strict step-by-step guided spotlight on Screen 1: Avatar -> Your Name -> Their Name -> Main -> Next!
  const activeStep0 = !avatarPicked && !senderName.trim()
    ? "avatar"
    : !senderName.trim()
      ? "sender"
      : !recipientName.trim()
        ? "recipient"
        : (mode === "trap" && !questionInput.trim()) || (mode === "vault" && !secretText.trim() && !secretImage)
          ? "main"
          : "ready";

  // Step-by-step spotlight on Screen 2 (Trap): Yes Button -> No Button -> Reveal Message -> Ready
  const activeStep1 = !yesLabelInput.trim()
    ? "yesBtn"
    : !noLabelInput.trim()
      ? "noBtn"
      : !yesMsgInput.trim()
        ? "yesMsg"
        : "ready";

  // Live grey letter-by-letter typewriter samples on BOTH Screen 1 & Screen 2!
  const senderPlaceholder = useTypewriter("Sam", step === 0 && activeStep0 === "sender");
  const recipientPlaceholder = useTypewriter("Alex", step === 0 && activeStep0 === "recipient");
  const mainPlaceholder = useTypewriter(
    mode === "trap" ? "Coffee tonight?" : "Don't tell anyone...",
    step === 0 && activeStep0 === "main"
  );
  const yesBtnPlaceholder = useTypewriter("Yes, locked in ⚡", step === 1 && mode === "trap" && activeStep1 === "yesBtn");
  const noBtnPlaceholder = useTypewriter("No way", step === 1 && mode === "trap" && activeStep1 === "noBtn");
  const yesMsgPlaceholder = useTypewriter(smartTrapOut, step === 1 && mode === "trap" && activeStep1 === "yesMsg");

  function triggerStepChange(nextStep) {
    fx("pop", 14);
    setBurstKey(k => k + 1);
    setStep(nextStep);
    setTimeout(() => { document.querySelector(".pop-fs-stage")?.scrollTo({ top: 0, behavior: "smooth" }); }, 50);
  }

  function pickTrapSpark(p) {
    fx("tap", 10);
    setCardColor(p.cardColor);
    setQuestionInput(p.title);
    setYesLabelInput(p.yesLabel);
    setNoLabelInput(p.noLabel);
    setYesMsgInput(p.yesMessage);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const compressed = await compressImageFile(file, 680, 0.72);
      setSecretImage(compressed);
      fx("pop", 14);
    } catch {
      alert("Could not read image. Try another photo.");
    } finally {
      setUploadingImg(false);
    }
  }

  async function publishLink() {
    if (busy) return;
    setBusy(true);
    fx("tap", 16);
    try {
      const cred = await signInPlayer().catch(() => null);
      const senderUid = cred?.user?.uid || "";

      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snap = await get(ref(database, `creations/${code}`));
        exists = snap.exists();
      }
      if (exists) throw new Error("Could not generate code");

      const from = (senderName.trim() || "Someone special").slice(0, 24);
      const to = (recipientName.trim() || "You").slice(0, 24);

      let dataObj;
      if (mode === "trap") {
        dataObj = {
          type: "invite",
          theme: cardColor,
          avatarId,
          creatorName: from,
          recipientName: to,
          senderUid,
          yesCount: 0,
          createdAt: Date.now(),
          payload: {
            title: effectiveQ.slice(0, 80),
            yesLabel: (yesLabelInput.trim() || "Yes, locked in ⚡").slice(0, 28),
            noLabel: (noLabelInput.trim() || "No").slice(0, 28),
            yesMessage: (yesMsgInput.trim() || smartTrapOut).slice(0, 240),
            maxDodges: 3 + Math.floor(Math.random() * 2)
          }
        };
      } else {
        const puzzleIdx = Math.floor(Math.random() * ODD_PUZZLES.length);
        dataObj = {
          type: "vault",
          theme: cardColor,
          avatarId,
          creatorName: from,
          recipientName: to,
          senderUid,
          receiverUid: "",
          yesCount: 0,
          createdAt: Date.now(),
          payload: {
            secretText: (secretText.trim() || "You unlocked my secret! 🔐✨").slice(0, 320),
            secretImage: secretImage || "",
            pin: vaultPin.replace(/\D/g, "").slice(0, 4),
            pinHint: vaultPinHint.trim().slice(0, 80),
            autoDelete: Boolean(autoDelete),
            puzzleIdx
          }
        };
      }

      await set(ref(database, `creations/${code}`), { id: code, ...dataObj });

      onLinkCreated?.({
        code,
        from,
        to,
        avatarId,
        theme: cardColor,
        isVault: mode === "vault",
        title: mode === "trap" ? dataObj.payload.title : "🔐 Secret Vault",
        createdAt: Date.now()
      });

      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("odc", code);
      setShareUrl(u.toString());
      setLiveCode(code);
      triggerStepChange(2);
      fx("win", [20, 35, 20]);
    } catch {
      alert("Network issue. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`pop-fs-stage theme-${cardColor}`}>
      <BubbleBurst triggerKey={burstKey} />

      <div className="pop-fs-topbar">
        <button type="button" className="pop-pill-black pop-pill-btn" onClick={onClose}>
          {mode === "trap" ? "⚡ ODDORA · TRAP" : "🔐 ODDORA · VAULT"}
        </button>
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

        {/* SCREEN 1 (1 OF 2): AVATAR FIRST -> TYPEWRITER NAMES -> MAIN */}
        {step === 0 && (
          <div className="pop-wizard-card pop-zoom-in" style={{ width: "100%" }} key="w-0">
            <span className="pop-pill-black">STEP 1 OF 2 · {mode === "trap" ? "THE HOOK" : "THE SECRET"}</span>

            {/* 1. Human-Style Avatar Picker (Auto-Cycling Demo + Bold Spotlight!) */}
            <div className={`pop-avatar-section ${activeStep0 === "avatar" ? "pop-avatar-spotlight" : ""}`}>
              <div className="pop-row-between" style={{ justifyContent: "center", gap: 8 }}>
                <span className="pop-mini-tag">1. PICK YOUR AVATAR</span>
                {activeStep0 === "avatar" && <span className="pop-type-hint">👆 Tap one!</span>}
              </div>
              <div className="pop-avatar-picker">
                {AVATARS.map(av => (
                  <button
                    key={av.id}
                    type="button"
                    className={avatarId === av.id ? "pop-av-btn active" : "pop-av-btn"}
                    onClick={() => {
                      fx("pop", 12);
                      setAvatarId(av.id);
                      setAvatarPicked(true);
                    }}
                    title={av.label}
                  >
                    <HumanAvatarSVG avatarId={av.id} size={42} />
                  </button>
                ))}
              </div>
            </div>

            <div className="pop-grid-2">
              <label className={`pop-field ${activeStep0 === "sender" ? "pop-highlight-field" : ""}`}>
                <span>YOUR NAME</span>
                <input
                  value={senderName}
                  onChange={e => { setAvatarPicked(true); setSenderName(e.target.value); }}
                  onFocus={focusScrollCenter}
                  placeholder={senderPlaceholder}
                  maxLength={24}
                />
              </label>
              <label className={`pop-field ${activeStep0 === "recipient" ? "pop-highlight-field" : ""}`}>
                <span>THEIR NAME</span>
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  onFocus={focusScrollCenter}
                  placeholder={recipientPlaceholder}
                  maxLength={24}
                />
              </label>
            </div>

            {mode === "trap" ? (
              <>
                <div className="pop-chips-row center">
                  {TRAP_SPARKS.map(p => (
                    <button key={p.id} type="button" className="pop-chip" onClick={() => pickTrapSpark(p)}>
                      {p.tag}
                    </button>
                  ))}
                </div>
                <label className={`pop-field ${activeStep0 === "main" ? "pop-highlight-field" : ""}`}>
                  <span>YOUR QUESTION</span>
                  <input
                    value={questionInput}
                    onChange={e => setQuestionInput(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={mainPlaceholder}
                    maxLength={120}
                  />
                </label>
              </>
            ) : (
              <>
                <label className={`pop-field ${activeStep0 === "main" ? "pop-highlight-field" : ""}`}>
                  <span>SECRET MESSAGE (TEXT)</span>
                  <textarea
                    rows={2}
                    value={secretText}
                    onChange={e => setSecretText(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={mainPlaceholder}
                    maxLength={320}
                  />
                </label>

                {/* Separate Direct Selfie Camera + Gallery Buttons! */}
                <div className="pop-upload-row">
                  <div className="pop-grid-2">
                    <label className="pop-btn yellow sm full" style={{ cursor: "pointer" }}>
                      <Camera size={15}/> {uploadingImg ? "..." : "🤳 Take Selfie"}
                      <input type="file" accept="image/*" capture="user" onChange={handlePhotoUpload} style={{ display: "none" }} />
                    </label>
                    <label className="pop-btn white sm full" style={{ cursor: "pointer" }}>
                      <ImageIcon size={15}/> {uploadingImg ? "..." : "🖼️ Gallery"}
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                  {secretImage && (
                    <div className="pop-img-preview-wrap">
                      <img src={secretImage} alt="Preview" className="pop-img-thumb" />
                      <button type="button" className="pop-btn pink sm" onClick={() => setSecretImage("")}>Remove</button>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              className={`pop-btn yellow full ${activeStep0 === "ready" ? "pop-next-glow" : ""}`}
              onClick={() => triggerStepChange(1)}
            >
              Next: Customize & Lock <ArrowRight size={16}/>
            </button>
          </div>
        )}

        {/* SCREEN 2 (2 OF 2): CUSTOMIZE & PRIVACY */}
        {step === 1 && (
          <div className="pop-wizard-card pop-zoom-in" style={{ width: "100%" }} key="w-1">
            <div className="pop-pinned-q" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HumanAvatarSVG avatarId={avatarId} size={30} />
              <span>{mode === "trap" ? `“${effectiveQ}”` : secretImage ? "📸 Photo + Secret Note locked" : `“${secretText.trim() || "Secret Vault"}”`}</span>
            </div>

            <div className="pop-chips-row center">
              {[
                { id: "lime", label: "😎 LIME" },
                { id: "pink", label: "😍 PINK" },
                { id: "cyan", label: "🌍 BLUE" },
                { id: "gold", label: "🔐 GOLD" }
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

            {mode === "trap" ? (
              <div className="pop-live-preview-box">
                <div className="pop-grid-2">
                  <label className={`pop-field ${activeStep1 === "yesBtn" ? "pop-highlight-field" : ""}`}>
                    <span>YES BUTTON TEXT</span>
                    <input className="pop-dashed-input" value={yesLabelInput} onChange={e => setYesLabelInput(e.target.value)} onFocus={focusScrollCenter} placeholder={yesBtnPlaceholder} maxLength={28} />
                  </label>
                  <label className={`pop-field ${activeStep1 === "noBtn" ? "pop-highlight-field" : ""}`}>
                    <span>NO BUTTON TEXT</span>
                    <input className="pop-dashed-input" value={noLabelInput} onChange={e => setNoLabelInput(e.target.value)} onFocus={focusScrollCenter} placeholder={noBtnPlaceholder} maxLength={28} />
                  </label>
                </div>
                <label className={`pop-field ${activeStep1 === "yesMsg" ? "pop-highlight-field" : ""}`}>
                  <span>REVEAL MESSAGE AFTER YES</span>
                  <input className="pop-dashed-input" value={yesMsgInput} onChange={e => setYesMsgInput(e.target.value)} onFocus={focusScrollCenter} placeholder={yesMsgPlaceholder} maxLength={240} />
                </label>
              </div>
            ) : (
              <div className="pop-live-preview-box">
                <div className="pop-inner-box" style={{ textAlign: "left" }}>
                  <span className="pop-mini-tag">🔒 PRIVACY & ACCESS</span>
                  <small className="pop-muted">
                    Locked to you & {recipientName.trim() || "your friend"} automatically (Silent Device Lock).
                  </small>

                  <label className="pop-field">
                    <span>OPTIONAL 4-DIGIT SECRET PIN</span>
                    <input
                      className="pop-dashed-input"
                      inputMode="numeric"
                      value={vaultPin}
                      onChange={e => setVaultPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      onFocus={focusScrollCenter}
                      placeholder="e.g. 2026 (Leave blank for no PIN)"
                      maxLength={4}
                    />
                  </label>

                  {vaultPin.length > 0 && (
                    <label className="pop-field pop-soft-highlight">
                      <span>PIN CLUE / PUZZLE HINT FOR {String(recipientName || "THEM").toUpperCase()}</span>
                      <input
                        className="pop-dashed-input"
                        value={vaultPinHint}
                        onChange={e => setVaultPinHint(e.target.value)}
                        onFocus={focusScrollCenter}
                        placeholder="e.g. My birth year / Our first meet month"
                        maxLength={80}
                      />
                    </label>
                  )}

                  <div className="pop-mode-switch">
                    <button type="button" className={!autoDelete ? "pop-mode-btn active" : "pop-mode-btn"} onClick={() => { fx("tap", 10); setAutoDelete(false); }}>
                      🔐 Keep Private
                    </button>
                    <button type="button" className={autoDelete ? "pop-mode-btn active" : "pop-mode-btn"} onClick={() => { fx("tap", 10); setAutoDelete(true); }}>
                      🔥 Burn After Read
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pop-grid-2">
              <button type="button" className="pop-btn white" onClick={() => triggerStepChange(0)}>
                <ArrowLeft size={16}/> Back
              </button>
              <button type="button" className="pop-btn lime" onClick={publishLink} disabled={busy}>
                {busy ? "Locking..." : mode === "trap" ? "🚀 Arm & Share" : "🔐 Lock & Share"}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: ARMED & READY + LIVE RADAR + SENDER FLEX SHARE */}
        {step === 2 && (
          <div className="pop-ready-card pop-zoom-in" style={{ width: "100%" }} key="w-2">
            <HumanAvatarSVG avatarId={avatarId} size={68} />
            <span className="pop-pill-black">{mode === "trap" ? "ARMED & READY ⚡" : "VAULT LOCKED 🔐"}</span>
            <h2>Send to {recipientName || "your person"}!</h2>

            <div className="pop-link-box">
              <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
            </div>

            <UniversalShareBar
              url={shareUrl}
              shareText={
                mode === "vault"
                  ? `${senderName.trim() || "Someone"} locked a Secret Vault for you 🔐 Solve 2 quick puzzles to open it!`
                  : `${senderName.trim() || "Someone"} sent you a Secret OD Card 👀⚡`
              }
              title="Secret OD Card"
            />

            <LiveRadarPanel
              code={liveCode}
              recipientName={recipientName || "Friend"}
              senderName={senderName.trim() || "Your friend"}
              avatarId={avatarId}
              cardColor={cardColor}
              isVault={mode === "vault"}
            />

            <button
              type="button"
              className="pop-btn white sm"
              onClick={() => {
                triggerStepChange(0);
                setLiveCode("");
                setQuestionInput("");
                setSecretText("");
                setSecretImage("");
                setVaultPin("");
                setVaultPinHint("");
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
   - Strict Zero-Overlap & Never-Disappearing NO Button
   - PIN Screen Live Chat ("Ask [Sender] for PIN") + PIN Clue
   - Perspective-Based Proof Sharing (With Clickable Link!)
============================================================================ */
function FullScreenODRecipient({ code, onSaveToShelf, onPendingUpdate, onGoHome, onExit }) {
  const [data, setData] = useState(null);
  const [myUid, setMyUid] = useState("");
  const savedRx = (() => {
    try { return JSON.parse(safeGetStorage(`oddora_rx_${code}`, "null")) || {}; } catch { return {}; }
  })();

  const [loading, setLoading] = useState(true);
  const [sealed, setSealed] = useState(savedRx.sealed !== undefined ? Boolean(savedRx.sealed) : true);
  const [burstKey, setBurstKey] = useState(1);

  // Trap state (resumes on reopen!)
  const [dodges, setDodges] = useState(Number(savedRx.dodges || 0));
  const [confirmSure, setConfirmSure] = useState(false);
  const [noPos, setNoPos] = useState(null);
  const [outcome, setOutcome] = useState(savedRx.outcome || "");
  const trapCardRef = useRef(null);
  const sealOpenedAtRef = useRef(0);

  // Vault state (resumes right at Lock2 / PIN / Unlocked on reopen!)
  const [vaultStage, setVaultStage] = useState(Number(savedRx.vaultStage || 0)); // 0=Lock1, 1=Lock2, 2=PIN, 3=Unlocked
  const [oddIdx] = useState(() => Math.floor(Math.random() * 9));
  const [crackTaps, setCrackTaps] = useState(Number(savedRx.crackTaps || 0));

  // Persistent 2-way chat history (Receiver sees late sender replies even after closing & reopening!)
  const chatHistory = useTwoWayChat(code);

  useEffect(() => {
    if (!code) return;
    safeSetStorage(`oddora_rx_${code}`, JSON.stringify({
      sealed,
      dodges,
      outcome,
      vaultStage,
      crackTaps
    }));
  }, [code, sealed, dodges, outcome, vaultStage, crackTaps]);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinAskText, setPinAskText] = useState("");
  const [pinAskSent, setPinAskSent] = useState("");
  const [savedToShelf, setSavedToShelf] = useState(false);

  // Common state
  const [reactionText, setReactionText] = useState("");
  const [lastSentReply, setLastSentReply] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [liveSenderMsg, setLiveSenderMsg] = useState("");
  const knownSenderCountRef = useRef(-1);

  // Re-clamp NO button if user switches tabs/windows or resizes so it NEVER disappears!
  useEffect(() => {
    const keepVisible = () => {
      setNoPos(prev => {
        if (!prev) return prev;
        const maxL = Math.max(16, window.innerWidth - 160);
        const maxT = Math.max(80, window.innerHeight - 76);
        return {
          left: Math.min(Math.max(16, prev.left), maxL),
          top: Math.min(Math.max(80, prev.top), maxT)
        };
      });
    };
    window.addEventListener("resize", keepVisible);
    document.addEventListener("visibilitychange", keepVisible);
    return () => {
      window.removeEventListener("resize", keepVisible);
      document.removeEventListener("visibilitychange", keepVisible);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      signInPlayer().catch(() => null),
      get(ref(database, `creations/${code}`)).catch(() => null)
    ]).then(([cred, snap]) => {
      if (!alive) return;
      if (cred?.user?.uid) setMyUid(cred.user.uid);
      if (snap?.exists()) {
        const val = snap.val();
        setData(val);
        onPendingUpdate?.({
          code,
          from: val.creatorName || "A friend",
          title: val.type === "vault" ? "🔐 Secret Vault" : val.payload?.title
        });
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [code]);

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
          setTimeout(() => setLiveSenderMsg(""), 8000);
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

  function triggerBurst() {
    fx("pop", 16);
    setBurstKey(k => k + 1);
  }

  function breakSeal() {
    fx("seal", [20, 30, 20]);
    safeSetStorage("oddora_fs_pref", "1");
    requestAppFullscreen();
    sealOpenedAtRef.current = Date.now();
    setSealed(false);
    triggerBurst();
    const who = data?.recipientName || "Your friend";
    pushLiveEvent(
      data?.type === "vault"
        ? `🔐 ${who} opened your vault & is cracking Lock 1!`
        : `👀 ${who} broke the seal & opened your card!`
    );
  }

  if (loading) {
    return (
      <div className="pop-fs-stage">
        <span className="pop-pill-black">⚡ ODDORA</span>
        <h2>Unlocking...</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pop-fs-stage">
        <div className="pop-seal-card pop-zoom-in" style={{ maxWidth: 380 }}>
          <span className="pop-pill-black">⚡ ODDORA</span>
          <h2>Card expired or burned 🔥</h2>
          <button type="button" className="pop-btn yellow full" onClick={() => { onPendingUpdate?.(null); onExit(""); }}>
            Create Your Own OD
          </button>
        </div>
      </div>
    );
  }

  const cardTheme = data.theme || "lime";
  const who = data.recipientName || "Your friend";
  const isVault = data.type === "vault";

  const isLockedToOther =
    isVault &&
    !data.payload?.pin &&
    data.receiverUid &&
    myUid &&
    data.receiverUid !== myUid &&
    data.senderUid !== myUid;

  if (isLockedToOther) {
    return (
      <div className={`pop-fs-stage theme-${cardTheme}`}>
        <div className="pop-seal-card pop-zoom-in" style={{ maxWidth: 380 }}>
          <span className="pop-pill-black">🔒 PRIVATE VAULT</span>
          <h2>Already Claimed!</h2>
          <p className="pop-fs-sub">This private memory is locked to {data.creatorName} & {who}.</p>
          <button type="button" className="pop-btn yellow full" onClick={() => onExit("")}>
            Create Your Own Vault 🔐
          </button>
        </div>
      </div>
    );
  }

  /* ---- TRAP HANDLERS (Strict Safe-Zone Jump — Zero Overlap & Never Disappears!) ---- */
  const maxDodges = Math.min(4, data?.payload?.maxDodges || 4);
  const converted = dodges >= maxDodges;
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
    pushLiveEvent(`😂 ${who} is chasing NO... (Dodge #${next}!)`);

    // On final dodge, NO button vanishes in a Bubble Burst — leaving only ONE big YES button!
    if (next >= maxDodges) {
      triggerBurst();
      setNoPos(null);
      return;
    }

    fx("dodge", 16);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnW = 160;
    const btnH = 58;
    const padX = 20;
    const maxL = Math.max(padX, vw - btnW - padX);
    const left = Math.round(padX + Math.random() * (maxL - padX));

    // Measure actual center card bounds so NO button NEVER overlaps headline or YES button,
    // and ALWAYS stays strictly inside the visible screen (zero scrolling needed!)
    const rect = trapCardRef.current?.getBoundingClientRect();
    const topBandMin = 78;
    const topBandMax = rect ? Math.min(165, Math.max(topBandMin, rect.top - btnH - 20)) : 140;
    const botBandMin = rect ? Math.max(vh - 150, rect.bottom + 22) : vh - 140;
    const botBandMax = Math.max(botBandMin, vh - btnH - 26);

    const canUseTop = rect ? rect.top > topBandMin + btnH + 14 : true;
    const canUseBot = rect ? rect.bottom + btnH + 26 < vh : true;

    let top;
    if (next % 2 === 1 && canUseTop) {
      top = Math.round(topBandMin + Math.random() * Math.max(0, topBandMax - topBandMin));
    } else if (canUseBot) {
      top = Math.round(botBandMin + Math.random() * Math.max(0, botBandMax - botBandMin));
    } else {
      top = topBandMin;
    }

    setNoPos({
      left: Math.min(Math.max(padX, left), maxL),
      top: Math.min(Math.max(topBandMin, top), vh - btnH - 22)
    });
  }

  function handleYesTap() {
    if (dodges === 0 && !confirmSure) {
      fx("tap", 14);
      setConfirmSure(true);
      pushLiveEvent(`👀 ${who} tapped YES right away — asking “Are you sure?”`);
      return;
    }
    confirmTrapYes(false);
  }

  function confirmTrapYes(forcedByDodge = false) {
    triggerBurst();
    fx("win", [25, 40, 25]);
    setOutcome("yes");
    setNoPos(null);
    onPendingUpdate?.(null);
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

  /* ---- VAULT HANDLERS ---- */
  function completeVaultUnlock() {
    triggerBurst();
    fx("win", [25, 40, 25]);
    setVaultStage(3);
    setOutcome("yes");
    onPendingUpdate?.(null);
    pushLiveEvent(`🔓 ${who} unlocked your Secret Vault!`);
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `replies/${code}`), {
        text: "Unlocked your Secret Vault! 🔐✨",
        from: who,
        createdAt: Date.now()
      }).catch(() => {});
      runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
      if (myUid && !data.receiverUid && myUid !== data.senderUid) {
        set(ref(database, `creations/${code}/receiverUid`), myUid).catch(() => {});
      }
      if (data.payload?.autoDelete) {
        setTimeout(() => { remove(ref(database, `creations/${code}`)).catch(() => {}); }, 4000);
      }
    });
  }

  function handleOddEmojiTap(idx) {
    if (Date.now() - sealOpenedAtRef.current < 420) return;
    if (idx === oddIdx) {
      triggerBurst();
      setVaultStage(1);
      pushLiveEvent(`🔥 ${who} cracked Lock 1! Now unblurring Lock 2...`);
    } else {
      fx("dodge", 14);
    }
  }

  function handleCrackTap() {
    const next = crackTaps + 1;
    setCrackTaps(next);
    fx("tap", 14);
    if (next >= 4) {
      if (data.payload?.pin) {
        triggerBurst();
        setVaultStage(2);
        pushLiveEvent(`🔑 ${who} reached the PIN lock!`);
      } else {
        completeVaultUnlock();
      }
    }
  }

  function verifyVaultPin(e) {
    e.preventDefault();
    if (pinEntry.trim() === String(data.payload?.pin || "")) {
      setPinError("");
      completeVaultUnlock();
    } else {
      fx("dodge", [20, 30]);
      setPinError("Wrong PIN! Ask them live below 🔒");
    }
  }

  function askSenderForPin(customMsg) {
    const msg = String(customMsg || pinAskText || "Hey, what's the PIN? 🔐").trim().slice(0, 120);
    if (!msg) return;
    fx("notify", 16);
    setPinAskText("");
    setPinAskSent(`Asked ${data.creatorName}: “${msg}” — watch top of screen for reply!`);
    pushLiveEvent(`🔑 ${who} asks: “${msg}”`);
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `replies/${code}`), { text: `🔑 ${msg}`, from: who, createdAt: Date.now() }).catch(() => {});
    });
  }

  function downloadVaultPhoto() {
    if (!data.payload?.secretImage) return;
    fx("tap", 14);
    const a = document.createElement("a");
    a.href = data.payload.secretImage;
    a.download = `oddora-memory-${code}.jpg`;
    a.click();
  }

  function saveMemoryToShelf() {
    if (savedToShelf) return;
    fx("win", 18);
    setSavedToShelf(true);
    onSaveToShelf?.({
      id: code,
      from: data.creatorName,
      avatarId: data.avatarId || "shades",
      text: data.payload?.secretText || "",
      image: data.payload?.secretImage || "",
      savedAt: Date.now()
    });
  }

  /* ---- SHARED REPLY & PERSPECTIVE-BASED POSTER SHARE ---- */
  function sendReactionNote(e) {
    e.preventDefault();
    const clean = reactionText.trim().slice(0, 120);
    if (!clean) return;
    fx("notify", [20, 30, 20]);
    setReactionText("");
    setLastSentReply(clean);
    pushLiveEvent(`💬 ${who} replied: “${clean}”`);
    signInPlayer().catch(() => null).finally(() => {
      push(ref(database, `replies/${code}`), {
        text: clean,
        from: who,
        createdAt: Date.now()
      }).catch(() => {});
    });
  }

  async function handleReceiverProofShare(isVaultTeaser = false) {
    if (savingCard) return;
    setSavingCard(true);
    fx("tap", 14);
    pushLiveEvent(`📸 ${who} shared the proof card!`);
    await sharePosterWithLink({
      posterArgs: isVaultTeaser
        ? {
            kicker: "SECRET CRACKED",
            bigTitle: `I unlocked ${data.creatorName}'s secret vault! 🔐`,
            subText: "Can't show the secret — it's private 👀",
            statPill: "🔓 VAULT CRACKED",
            actorName: `${data.creatorName} → ${who}`,
            avatarId: data.avatarId || "shades",
            cardColor: cardTheme
          }
        : {
            kicker: "OFFICIAL PROOF",
            bigTitle: data.payload.yesMessage,
            subText: `${who} said YES to ${data.creatorName}`,
            statPill: dodges === 0 ? "⚡ ZERO HESITATION" : `DODGED ${dodges}x · STILL YES`,
            actorName: `${data.creatorName} → ${who}`,
            avatarId: data.avatarId || "shades",
            cardColor: cardTheme
          },
      caption: isVaultTeaser
        ? `I just cracked ${data.creatorName}'s Secret Vault on ODDORA 🔐👀`
        : `${data.creatorName} got me with an OD - Trap 😂⚡`,
      onStatus: msg => {
        setShareStatus(msg);
        setTimeout(() => setShareStatus(""), 3500);
      }
    });
    setSavingCard(false);
  }

  const noButtonText = converted
    ? data.payload.yesLabel
    : dodges > 0
      ? talkingList[Math.min(dodges - 1, talkingList.length - 1)]
      : data.payload.noLabel;

  const puzzleObj = ODD_PUZZLES[(data.payload?.puzzleIdx || 0) % ODD_PUZZLES.length];

  return (
    <div className={`pop-fs-stage theme-${cardTheme}`}>
      <BubbleBurst triggerKey={burstKey} />
      {outcome === "yes" && <ConfettiRain />}

      {/* Live 2-Way Reply Toast from Sender (Works even on PIN screen!) */}
      {liveSenderMsg && (
        <div className="pop-toast" onClick={() => setLiveSenderMsg("")}>
          {liveSenderMsg}
        </div>
      )}

      {/* Floating Runaway NO Button — direct child of stage so position:fixed NEVER traps inside animated card! */}
      {!sealed && !isVault && !outcome && !converted && noPos && (
        <button
          type="button"
          className="pop-btn pink lg pop-fs-free-no"
          style={{ left: `${noPos.left}px`, top: `${noPos.top}px` }}
          onClick={handleFullScreenDodge}
        >
          {noButtonText}
        </button>
      )}

      <div className="pop-fs-topbar">
        <button type="button" className="pop-pill-black pop-pill-btn" onClick={onGoHome}>
          ⚡ ODDORA · FROM {data.creatorName?.toUpperCase()}
        </button>
        <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); onExit(""); }}>✕</button>
      </div>

      <div className="pop-fs-content">
        {sealed ? (
          <div className="pop-seal-card pop-zoom-in">
            <HumanAvatarSVG avatarId={data.avatarId} size={78} />
            <span className="pop-pill-black">
              {isVault ? `🔐 SECRET VAULT FOR ${who.toUpperCase()}` : `⚡ SECRET CARD FOR ${who.toUpperCase()}`}
            </span>
            <h1 className="pop-fs-headline">
              {data.creatorName} {isVault ? "locked a secret for you 🔐" : "sent you something 👀"}
            </h1>
            <p className="pop-fs-sub">
              {isVault ? "Crack 2 quick puzzles to reveal it." : "Sound on for the full experience."}
            </p>
            <button type="button" className="pop-btn yellow lg full pop-pulse-btn" onClick={breakSeal}>
              🔓 TAP TO OPEN
            </button>
          </div>
        ) : !isVault ? (
          /* ---- OD - TRAP FLOW ---- */
          outcome === "yes" ? (
            <div className="pop-outcome pop-zoom-in" key="trap-win">
              <HumanAvatarSVG avatarId={data.avatarId} size={72} />
              <span className="pop-pill-black">
                {dodges === 0 ? "⚡ INSTANT YES" : `🎉 LOCKED IN · DODGED ${dodges}x`}
              </span>
              <div className="pop-sender-hero-msg">“{data.payload.yesMessage}”</div>

              <div className="pop-live-chat-wrap">
                <ChatHistoryBox messages={chatHistory} viewerSide="receiver" />
                <form className="pop-react-form" onSubmit={sendReactionNote}>
                  <input value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Chat live with ${data.creatorName}...`} maxLength={120} />
                  <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                </form>
              </div>

              <button
                type="button"
                className="pop-btn yellow full"
                onClick={() => handleReceiverProofShare(false)}
                disabled={savingCard}
              >
                <Share2 size={16}/> {savingCard ? "Creating Proof..." : `⚡ Confirm ${data.creatorName} · Share Proof`}
              </button>
              {shareStatus && <small className="pop-sent-note">{shareStatus}</small>}

              <button type="button" className="pop-btn black full" onClick={() => { fx("tap", 12); onExit(data.creatorName); }}>
                ⚡ Trap {data.creatorName} Back
              </button>
            </div>
          ) : (
            <div ref={trapCardRef} className="pop-outcome pop-zoom-in" key="trap-play">
              <HumanAvatarSVG avatarId={data.avatarId} size={68} />
              <span className="pop-pill-black">FOR {who.toUpperCase()}</span>
              <h1 className="pop-fs-headline">{data.payload.title}</h1>
              <p className="pop-fs-sub">
                {converted
                  ? "Plot twist: BOTH buttons are YES now! 😂⚡"
                  : confirmSure
                    ? "Are you sure? 👀 Not even gonna try No?"
                    : dodges > 0
                      ? "Haha, can't catch it! 😂"
                      : "Bet you can't press No 👀"}
              </p>

              <div className="pop-fs-actions">
                <button
                  type="button"
                  className={`pop-btn lime lg ${converted ? "pop-pulse-btn" : ""}`}
                  style={!converted ? { transform: `scale(${1 + Math.min(dodges, 4) * 0.04})` } : undefined}
                  onClick={handleYesTap}
                >
                  {confirmSure ? "Yes, 100% sure! ⚡" : data.payload.yesLabel}
                </button>
                {converted ? (
                  <button
                    type="button"
                    className="pop-btn lime lg pop-pulse-btn"
                    onClick={() => confirmTrapYes(true)}
                  >
                    {data.payload.yesLabel}
                  </button>
                ) : !noPos && (
                  <button
                    type="button"
                    className="pop-btn pink lg"
                    onClick={handleFullScreenDodge}
                  >
                    {noButtonText}
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          /* ---- OD - VAULT 2-PUZZLE + LIVE PIN ASK FLOW ---- */
          vaultStage === 0 ? (
            <div className="pop-seal-card pop-zoom-in" key="v-lock1">
              <span className="pop-pill-black">LOCK 1 OF 2 · SPOT THE ODD ONE</span>
              <h2 className="pop-wizard-prompt">{puzzleObj.hint}</h2>
              <div className="pop-puzzle-grid">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <button key={idx} type="button" className="pop-puzzle-cell" onClick={() => handleOddEmojiTap(idx)}>
                    {idx === oddIdx ? puzzleObj.odd : puzzleObj.normal}
                  </button>
                ))}
              </div>
            </div>
          ) : vaultStage === 1 ? (
            <div className="pop-seal-card pop-zoom-in" key="v-lock2">
              <span className="pop-pill-black">LOCK 2 OF 2 · PASSCODE BREAKDOWN</span>
              <h2 className="pop-wizard-prompt">Decrypt the passcode 🔐</h2>

              <div className="pop-blur-vault-box" onClick={handleCrackTap} style={{ cursor: "pointer" }}>
                {data.payload?.secretImage ? (
                  <img
                    src={data.payload.secretImage}
                    alt="Blurred secret"
                    className="pop-vault-blur-img"
                    style={{ filter: `blur(${Math.max(4, 24 - crackTaps * 5)}px)` }}
                  />
                ) : (
                  <div className="pop-vault-blur-text" style={{ filter: `blur(${Math.max(3, 14 - crackTaps * 3)}px)` }}>
                    {data.payload?.secretText || "Secret Message"}
                  </div>
                )}
                <span className="pop-crack-badge">
                  <Lock size={14}/> {crackTaps === 0 ? "ENCRYPTED" : `DECRYPTING ${Math.min(100, crackTaps * 25)}%`}
                </span>
              </div>

              {/* Passcode Breakdown Slots: _ _ _ _ turning into * * * * */}
              <div className="pop-passcode-strip" aria-label="Passcode decryption progress">
                {[0, 1, 2, 3].map(slot => {
                  const cracked = slot < crackTaps;
                  return (
                    <span key={slot} className={`pop-code-slot ${cracked ? "cracked" : ""}`}>
                      {cracked ? "*" : "_"}
                    </span>
                  );
                })}
              </div>

              <button type="button" className="pop-btn yellow lg full pop-pulse-btn" onClick={handleCrackTap}>
                ⚡ TAP HERE TO DECRYPT
              </button>
            </div>
          ) : vaultStage === 2 ? (
            <div className="pop-seal-card pop-zoom-in" key="v-pin">
              <HumanAvatarSVG avatarId={data.avatarId} size={58} />
              <span className="pop-pill-black">FINAL KEY · 4-DIGIT PIN</span>
              <h2 className="pop-wizard-prompt">Enter Secret PIN 🔐</h2>
              {data.payload?.pinHint && (
                <div className="pop-pinned-q">
                  <span>💡 Clue:</span> <strong>{data.payload.pinHint}</strong>
                </div>
              )}
              <form className="pop-stack" style={{ width: "100%" }} onSubmit={verifyVaultPin}>
                <input
                  inputMode="numeric"
                  value={pinEntry}
                  onChange={e => setPinEntry(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="• • • •"
                  style={{ textAlign: "center", fontSize: 26, letterSpacing: 10 }}
                  maxLength={4}
                />
                {pinError && <small style={{ color: "#FF5A5F", fontWeight: 800 }}>{pinError}</small>}
                <button type="submit" className="pop-btn lime full" disabled={pinEntry.length < 4}>
                  <Unlock size={16}/> Unlock Secret
                </button>
              </form>

              {/* Live Chat to ask Sender for PIN right here (Persists across close/reopen!) */}
              <div className="pop-inner-box" style={{ marginTop: 4 }}>
                <span className="pop-mini-tag"><MessageCircle size={11}/> LIVE CHAT WITH {String(data.creatorName || "SENDER").toUpperCase()}</span>
                <ChatHistoryBox messages={chatHistory} viewerSide="receiver" />
                <button
                  type="button"
                  className="pop-btn yellow sm full"
                  onClick={() => askSenderForPin("Hey, what's the PIN? 🔐")}
                >
                  🔔 Ping {data.creatorName} for PIN
                </button>
                <form className="pop-react-form" onSubmit={e => { e.preventDefault(); askSenderForPin(pinAskText); }}>
                  <input
                    value={pinAskText}
                    onChange={e => setPinAskText(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={`Message ${data.creatorName} live...`}
                    maxLength={100}
                  />
                  <button type="submit" className="pop-btn white sm" disabled={!pinAskText.trim()}><Send size={14}/></button>
                </form>
                {pinAskSent && <small className="pop-sent-note">{pinAskSent}</small>}
              </div>
            </div>
          ) : (
            <div className="pop-outcome pop-zoom-in" key="v-open">
              <HumanAvatarSVG avatarId={data.avatarId} size={68} />
              <span className="pop-pill-black">
                🔓 UNLOCKED · FROM {data.creatorName?.toUpperCase()}
              </span>

              {data.payload?.secretImage && (
                <div className="pop-vault-photo-frame">
                  <img src={data.payload.secretImage} alt="Secret" className="pop-vault-clear-img" />
                </div>
              )}

              {data.payload?.secretText && (
                <div className="pop-sender-hero-msg">“{data.payload.secretText}”</div>
              )}

              <small className="pop-muted">
                🔒 Private memory — download to gallery to keep forever.
              </small>

              <div className="pop-grid-2">
                <button type="button" className="pop-btn white sm" onClick={saveMemoryToShelf}>
                  <Bookmark size={14}/> {savedToShelf ? "Saved to Shelf ✓" : "Save to Shelf"}
                </button>
                {data.payload?.secretImage && (
                  <button type="button" className="pop-btn blue sm" onClick={downloadVaultPhoto}>
                    <Download size={14}/> Save to Gallery
                  </button>
                )}
              </div>

              {/* Privacy-Safe Vault Flex Share (Never leaks the secret photo/text!) */}
              <button
                type="button"
                className="pop-btn yellow full"
                onClick={() => handleReceiverProofShare(true)}
                disabled={savingCard}
              >
                <Share2 size={16}/> {savingCard ? "Creating Flex..." : `🔐 Flex: I Cracked ${data.creatorName}'s Vault!`}
              </button>
              {shareStatus && <small className="pop-sent-note">{shareStatus}</small>}

              <div className="pop-live-chat-wrap">
                <ChatHistoryBox messages={chatHistory} viewerSide="receiver" />
                <form className="pop-react-form" onSubmit={sendReactionNote}>
                  <input value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Chat live with ${data.creatorName}...`} maxLength={120} />
                  <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                </form>
              </div>

              <button type="button" className="pop-btn black full" onClick={() => { fx("tap", 12); onExit(data.creatorName); }}>
                🔐 Send a Secret Back to {data.creatorName}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   10. COMMUNITY FLEX WALL
============================================================================ */
function FlexWall({ topCreators }) {
  const [posts, setPosts] = useState([
    { id: "p1", name: "Kavya", mood: "💀", text: "Sent an OD - Trap to my bestie and watched her chase No 4 times live 😂" },
    { id: "p2", name: "Siddharth", mood: "🔐", text: "Locked a funny selfie in OD - Vault — best reaction ever!" },
    { id: "p3", name: "Neha", mood: "💘", text: "Shared the proof poster on Insta and 8 friends asked for the link!" }
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
        <div className="pop-chips-row">{["🔥", "💀", "💘", "🔐", "😂"].map(m => <button key={m} type="button" className={mood === m ? "pop-chip active" : "pop-chip"} onClick={() => { fx("tap", 8); setMood(m); }}>{m}</button>)}</div>
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
