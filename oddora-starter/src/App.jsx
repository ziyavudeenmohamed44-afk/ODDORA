import React, { Component, useEffect, useRef, useState } from "react";
import {
  Share2, Send, Zap, Check, Copy, Trophy, X, Inbox,
  ArrowRight, ArrowLeft, Maximize2, Radio, Lock, Unlock,
  Download, Image as ImageIcon, Bookmark, Trash2, Camera, Eye, MessageCircle, Flame
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, limitToLast, onValue, push, query, ref, remove, runTransaction, set } from "firebase/database";

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
  } catch {
    // If localStorage is full (e.g., from large shelf photos), trim oldest shelf item and retry
    try {
      const shelf = JSON.parse(window.localStorage.getItem("oddora_treasure_shelf") || "[]");
      if (Array.isArray(shelf) && shelf.length > 1) {
        shelf.pop();
        window.localStorage.setItem("oddora_treasure_shelf", JSON.stringify(shelf));
        window.localStorage.setItem(key, value);
      }
    } catch {}
  }
}

function safeRemoveStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function getDeviceId() {
  let id = safeGetStorage("oddora_device_id", "");
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    safeSetStorage("oddora_device_id", id);
  }
  return id;
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

// Live grey letter-by-letter typewriter hook (lively cursor when active, subtle idle hint when inactive!)
function useTypewriter(text, active, idleFallback = "") {
  const [typed, setTyped] = useState(active ? "" : idleFallback);
  useEffect(() => {
    if (!active) {
      setTyped(idleFallback);
      return undefined;
    }
    let idx = 0;
    let pauseTicks = 0;
    setTyped("|");
    const timer = setInterval(() => {
      if (idx < text.length) {
        idx += 1;
        setTyped(`${text.slice(0, idx)}|`);
      } else {
        pauseTicks += 1;
        setTyped(pauseTicks % 2 === 0 ? `${text}|` : text);
        if (pauseTicks > 12) {
          idx = 0;
          pauseTicks = 0;
          setTyped("|");
        }
      }
    }, 105);
    return () => clearInterval(timer);
  }, [text, active, idleFallback]);
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
      tap: [
        { f: 580, d: 0.045, v: 0.11, w: "sine", slide: 840 },
        { f: 1160, d: 0.03, v: 0.05, w: "triangle", delay: 0.01 }
      ],
      pop: [
        { f: 390, d: 0.065, v: 0.15, w: "sine", slide: 940 },
        { f: 960, d: 0.09, v: 0.12, w: "triangle", delay: 0.035, slide: 1420 }
      ],
      seal: [
        { f: 320, d: 0.09, v: 0.15, w: "sine", slide: 740 },
        { f: 659.25, d: 0.11, v: 0.14, w: "triangle", delay: 0.05 },
        { f: 1046.5, d: 0.18, v: 0.15, w: "sine", delay: 0.11 }
      ],
      dodge: [
        { f: 280, d: 0.07, v: 0.14, w: "sine", slide: 780 },
        { f: 820, d: 0.08, v: 0.11, w: "triangle", delay: 0.045, slide: 460 }
      ],
      win: [
        { f: 523.25, d: 0.11, v: 0.15, w: "triangle" },
        { f: 659.25, d: 0.11, v: 0.15, w: "triangle", delay: 0.075 },
        { f: 783.99, d: 0.13, v: 0.16, w: "triangle", delay: 0.15 },
        { f: 1046.5, d: 0.32, v: 0.17, w: "sine", delay: 0.22 },
        { f: 1567.98, d: 0.26, v: 0.08, w: "sine", delay: 0.24 }
      ],
      notify: [
        // Native mobile messenger ping (warm dual-tone harmonic chime!)
        { f: 783.99, d: 0.12, v: 0.17, w: "sine" },
        { f: 1567.98, d: 0.1, v: 0.07, w: "sine" },
        { f: 1046.5, d: 0.24, v: 0.18, w: "sine", delay: 0.085 },
        { f: 2093.0, d: 0.18, v: 0.06, w: "triangle", delay: 0.085 }
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
  const target = e?.target;
  if (!target) return;
  const scrollNow = () => {
    try {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
  };
  setTimeout(scrollNow, 180);
  setTimeout(scrollNow, 420);
  if (typeof window !== "undefined" && window.visualViewport) {
    const onResize = () => {
      if (document.activeElement === target) scrollNow();
    };
    window.visualViewport.addEventListener("resize", onResize, { once: true });
  }
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
          <h2>Oops, something broke 😵</h2>
          <p>{this.state.errMsg}</p>
          <button type="button" className="pop-btn yellow" onClick={() => window.location.reload()}>
            Tap to reload
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


function MobileNotificationBanner({ notif, onOpen, onDismiss }) {
  if (!notif) return null;
  const title = typeof notif === "string" ? "ODDORA Live" : (notif.title || "ODDORA Live");
  const body = typeof notif === "string" ? notif : (notif.body || "");
  const tag = typeof notif === "string" ? "LIVE" : (notif.tag || "MESSAGE");
  const avatarId = typeof notif === "object" ? notif.avatarId : null;

  return (
    <div
      className="pop-notif-banner"
      role="status"
      onClick={() => {
        fx("tap", [15, 25]);
        onOpen?.();
      }}
    >
      <div className="pop-notif-icon">
        {avatarId ? <HumanAvatarSVG avatarId={avatarId} size={38} /> : <span className="pop-notif-app-ico">⚡</span>}
      </div>
      <div className="pop-notif-body">
        <div className="pop-notif-meta">
          <strong>{title}</strong>
          <span>{tag} · now</span>
        </div>
        <div className="pop-notif-text">{body}</div>
      </div>
      <div className="pop-notif-cta">
        <span className="pop-notif-reply-pill">Chat ↓</span>
        <button
          type="button"
          className="pop-notif-x"
          aria-label="Dismiss notification"
          onClick={e => { e.stopPropagation(); onDismiss?.(); }}
        >
          ✕
        </button>
      </div>
    </div>
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
        await navigator.share({ title, text: shareText, url });
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
const SENDER_QUICK_REPLIES_TRAP = ["Caught in 4K 📸", "Treat locked 🍕", "Haha gotcha 😂", "No take-backs! ⚡"];
const SENDER_QUICK_REPLIES_VAULT = ["Check the clue 💡", "Haha gotcha 😂", "Secret safe? 🤫", "Tell me your reaction 👀"];

function isTamilOrTanglish(text = "") {
  const s = String(text || "").toLowerCase();
  if (/[\u0B80-\u0BFF]/.test(s)) return true;
  if (/\b(da|di|vaada|vaadi|vada|vadi|poda|podi|venam|vendam|venuma|venduma|mudiyadhu|mudinja|pudichiruka|pudikuma|pudikum|pidikum|saapda|sapda|saapadu|sapadu|saapdaya|polam|polama|pogalam|pogalama|povoma|sandai|machan|machi|macha|mapla|nanba|thala|unga|ungaluku|enna|ena|illa|illai|aama|seri|sari|vaangi|tharen|thara|thariya|panra|panna|panla|idhu|ithu|adhu|athu|nalla|iruka|iruku|irukudha|irukada|irukadi|sollu|solra|epdi|eppadi|enga|yaaru|yaru|enaku|enakku|unaku|unakku|namma|nama|nee|naan|innaiku|nalaiku|ippo|ipo|aprm|apram|paaru|paru|kudu|kudupa|kooda|kuda|semma|romba|konjam|dhaan|dhan|dhane|arivu|venna|mavale|bathirama|vachiko|kadaiku|padathuku|veetuku|ooruku|paakalam|pakkalam|theriyum|theriyadhu|kandipa|kandippa|vandha|varen|poren|vaanga|vanga|kelambu|varuviya|variya|poriya|pannuviya|sollriya|saaptiya|saptiya|pesalama)\b/i.test(s)) {
    return true;
  }
  if (/(iruka|iruku|irukada|irukadi|mavale|polama|pogalama|veenga|duven|poren|varen|thuku|daiku|tuku|kudha|solra|uviya|ariya|oriya)\b/i.test(s)) {
    return true;
  }
  return false;
}

function isLikelyEnglish(text = "") {
  const s = String(text || "").toLowerCase();
  return /\b(you|me|we|us|they|the|is|are|am|can|will|would|could|should|do|did|don't|dont|cant|can't|tonight|today|tomorrow|coffee|movie|food|treat|date|miss|love|buy|pay|owe|come|go|let's|lets|watch|pizza|biryani|drive|yes|no|sure|okay|ok|please|friend|bestie|party|dinner|lunch|hangout|meet|call|reply|free|want|like|think|ready|game|dare|challenge|admit|loser|fine|deal|lock|locked)\b/i.test(s);
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
function drawTornPaperPath(ctx, x, y, w, h, seed = 1, jag = 10) {
  const rand = n => {
    const v = Math.sin(seed * 9301 + n * 49297) * 233280;
    return v - Math.floor(v);
  };
  ctx.beginPath();
  const topSteps = 18;
  const sideSteps = 10;
  ctx.moveTo(x, y);
  for (let i = 1; i <= topSteps; i += 1) {
    const px = x + (w * i) / topSteps;
    const py = y + (rand(i) - 0.5) * jag * 1.4;
    ctx.lineTo(px, py);
  }
  for (let i = 1; i <= sideSteps; i += 1) {
    const px = x + w + (rand(100 + i) - 0.5) * jag * 1.5;
    const py = y + (h * i) / sideSteps;
    ctx.lineTo(px, py);
  }
  for (let i = topSteps - 1; i >= 0; i -= 1) {
    const px = x + (w * i) / topSteps;
    const py = y + h + (rand(200 + i) - 0.5) * jag * 1.5;
    ctx.lineTo(px, py);
  }
  for (let i = sideSteps - 1; i >= 1; i -= 1) {
    const px = x + (rand(300 + i) - 0.5) * jag * 1.5;
    const py = y + (h * i) / sideSteps;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHeroPosterAvatar(ctx, avatarId, cx, cy, r, accentColor = "#C6FF2E") {
  const a = getAvatarObj(avatarId);
  const s = r / 50;
  ctx.save();
  ctx.translate(cx, cy);

  // Bold neon-lime sticker cutout silhouette behind the character!
  ctx.save();
  ctx.translate(10, -4);
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(0, -4 * s, 26.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 44 * s, 44 * s, 32 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dark backdrop aura circle behind avatar bust
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 6 * s, 48 * s, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1D24";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = accentColor;
  ctx.stroke();
  ctx.clip();

  // Subtle halftone dots inside portrait backdrop
  ctx.fillStyle = `${accentColor}26`;
  for (let gx = -46 * s; gx <= 46 * s; gx += 16) {
    for (let gy = -46 * s; gy <= 52 * s; gy += 16) {
      ctx.beginPath();
      ctx.arc(gx, gy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Oversized Streetwear Hoodie / Shoulders
  ctx.fillStyle = a.shirt;
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 4.2 * s;
  ctx.beginPath();
  ctx.ellipse(0, 50 * s, 40 * s, 30 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hoodie collar highlight
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.arc(0, 25 * s, 14 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Back hair layers
  if (a.style === "bob") {
    ctx.fillStyle = a.hair;
    ctx.strokeStyle = "#111216";
    ctx.lineWidth = 3.2 * s;
    drawRoundRect(ctx, -27 * s, -8 * s, 54 * s, 36 * s, 14 * s);
    ctx.fill();
    ctx.stroke();
  } else if (a.style === "curls") {
    ctx.fillStyle = a.hair;
    ctx.strokeStyle = "#111216";
    ctx.lineWidth = 2.6 * s;
    [[-26, -2], [26, -2], [-23, -18], [23, -18], [0, -27]].forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx * s, hy * s, 12.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else if (a.style === "bun") {
    ctx.fillStyle = a.hair;
    ctx.strokeStyle = "#111216";
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.arc(0, -32 * s, 13 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Neck
  ctx.fillStyle = a.skin;
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 3 * s;
  drawRoundRect(ctx, -7 * s, 12 * s, 14 * s, 14 * s, 5 * s);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = a.skin;
  ctx.lineWidth = 3.8 * s;
  ctx.beginPath();
  ctx.arc(0, -4 * s, 22 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Streetwear shadow cheek contour
  ctx.fillStyle = "rgba(17, 18, 22, 0.14)";
  ctx.beginPath();
  ctx.arc(-5 * s, -4 * s, 21 * s, 0.65 * Math.PI, 1.35 * Math.PI);
  ctx.fill();

  // Hair / Cap / Beanie
  if (a.style === "cap") {
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 23 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111216";
    ctx.fillRect(-25 * s, -12 * s, 56 * s, 6.5 * s);
  } else if (a.style === "beanie") {
    ctx.fillStyle = "#111216";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 23 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD166";
    ctx.fillRect(-24 * s, -16 * s, 48 * s, 8.5 * s);
    ctx.strokeRect(-24 * s, -16 * s, 48 * s, 8.5 * s);
  } else if (a.style === "spiky") {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.moveTo(-22 * s, -8 * s);
    ctx.lineTo(-16 * s, -28 * s);
    ctx.lineTo(-6 * s, -20 * s);
    ctx.lineTo(2 * s, -32 * s);
    ctx.lineTo(10 * s, -21 * s);
    ctx.lineTo(20 * s, -27 * s);
    ctx.lineTo(22 * s, -8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(0, -10 * s, 23 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Signature Neon-Rimmed Streetwear Shades on EVERY hero card!
  ctx.fillStyle = "#111216";
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.4 * s;
  drawRoundRect(ctx, -19 * s, -10 * s, 16.5 * s, 11 * s, 3 * s);
  ctx.fill();
  ctx.stroke();
  drawRoundRect(ctx, 2.5 * s, -10 * s, 16.5 * s, 11 * s, 3 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accentColor;
  ctx.fillRect(-2.5 * s, -6.5 * s, 5 * s, 2.5 * s);
  // Crisp white lens glare
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(-15 * s, -7 * s);
  ctx.lineTo(-9 * s, -7 * s);
  ctx.moveTo(6.5 * s, -7 * s);
  ctx.lineTo(12.5 * s, -7 * s);
  ctx.stroke();

  // Confident Smirk
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 3.2 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(1 * s, 4 * s, 8.5 * s, 0.12 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  ctx.restore();

  // Floating Hand-Drawn Neon Crown above top-left of head!
  ctx.save();
  ctx.translate(-32 * s, -48 * s);
  ctx.rotate(-0.26);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 11;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-48, 22);
  ctx.lineTo(-56, -24);
  ctx.lineTo(-20, 2);
  ctx.lineTo(0, -34);
  ctx.lineTo(20, 2);
  ctx.lineTo(56, -24);
  ctx.lineTo(48, 22);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

async function createPoster916({
  kicker = "OFFICIAL RESULT",
  topLine = "YOU GOT",
  bigWord = "TRAPPED!",
  challengeLabel = "OD - TRAP CHALLENGE",
  noteLine1 = "You dodged the",
  noteLine2 = "NO button",
  bigStat = "4x",
  highlightPrefix = "...but still said",
  highlightWord = "YES!",
  roastLine1 = "CERTIFIED",
  roastLine2 = "EASY TARGET 😂",
  statLeft = "Skill: 0/100",
  statRight = "Chaos: 100%",
  ctaLine = "I DID IT. YOUR TURN! 👀",
  actorName = "",
  avatarId = "shades",
  cardColor = "lime",
  footerUrl = "oddora-kappa.vercel.app"
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const palettes = {
    lime: { accent: "#C6FF2E", hot: "#FF2D78", yellow: "#FFE066" },
    pink: { accent: "#FF7AB8", hot: "#FF2D78", yellow: "#FFE066" },
    cyan: { accent: "#38BDF8", hot: "#FF2D78", yellow: "#FFE066" },
    gold: { accent: "#FFD166", hot: "#FF5A5F", yellow: "#FFE066" }
  };
  const pal = palettes[cardColor] || palettes.lime;

  // 1. DEEP CHARCOAL STREETWEAR BACKDROP
  const bgGrad = ctx.createRadialGradient(540, 760, 120, 540, 960, 1180);
  bgGrad.addColorStop(0, "#1D2028");
  bgGrad.addColorStop(1, "#0B0C10");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle gritty comic halftone grid across full canvas
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  for (let x = 22; x < 1080; x += 28) {
    for (let y = 22; y < 1920; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hot-pink halftone accent cluster (top-right)
  for (let gx = 840; gx < 1080; gx += 24) {
    for (let gy = 140; gy < 460; gy += 24) {
      const dist = Math.hypot(gx - 1040, gy - 260);
      if (dist < 220) {
        const rad = Math.max(2, (1 - dist / 220) * 8.5);
        ctx.fillStyle = `${pal.hot}99`;
        ctx.beginPath();
        ctx.arc(gx, gy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Neon-lime halftone accent cluster (mid-right)
  for (let gx = 830; gx < 1080; gx += 24) {
    for (let gy = 1090; gy < 1500; gy += 24) {
      const dist = Math.hypot(gx - 1050, gy - 1290);
      if (dist < 240) {
        const rad = Math.max(2, (1 - dist / 240) * 9);
        ctx.fillStyle = `${pal.accent}B0`;
        ctx.beginPath();
        ctx.arc(gx, gy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 2. TOP HEADER BAR (9:16 Safe Zone)
  // Left [O] Badge + ODDORA + INTERNET PLAYGROUND
  ctx.fillStyle = "#111216";
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 8;
  drawRoundRect(ctx, 56, 86, 94, 94, 24);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = pal.accent;
  ctx.font = "900 56px 'Space Grotesk', sans-serif";
  ctx.fillText("O", 103, 152);

  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 54px 'Space Grotesk', sans-serif";
  ctx.fillText("ODDORA", 170, 142);

  ctx.fillStyle = pal.accent;
  ctx.font = "800 19px 'DM Mono', monospace";
  ctx.fillText("INTERNET PLAYGROUND", 172, 174);

  // Top-Right Tilted OFFICIAL RESULT Pill
  ctx.save();
  ctx.translate(855, 134);
  ctx.rotate(-0.045);
  ctx.fillStyle = "#111216";
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 6;
  drawRoundRect(ctx, -172, -36, 344, 72, 36);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = pal.accent;
  ctx.font = "800 24px 'DM Mono', monospace";
  ctx.fillText(String(kicker || "OFFICIAL RESULT").toUpperCase().slice(0, 16), -18, 9);

  // Checkmark circle inside pill
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(132, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(122, 0);
  ctx.lineTo(129, 8);
  ctx.lineTo(143, -8);
  ctx.stroke();
  ctx.restore();

  // 3. LEFT HERO CHARACTER BUST (Oversized Avatar + Neon Cutout + Crown)
  drawHeroPosterAvatar(ctx, avatarId, 208, 720, 178, pal.accent);

  // Subtle player matchup tag tucked below left character
  if (actorName) {
    ctx.save();
    ctx.translate(212, 972);
    ctx.rotate(-0.04);
    ctx.fillStyle = "#111216";
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    drawRoundRect(ctx, -148, -26, 296, 52, 26);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 22px 'DM Mono', monospace";
    ctx.fillText(String(actorName).toUpperCase().slice(0, 20), 0, 8);
    ctx.restore();
  }

  // 4. TOP-RIGHT TORN PAPER TITLE CUTOUT ("YOU GOT TRAPPED!")
  ctx.save();
  ctx.translate(715, 392);
  ctx.rotate(-0.095);

  // Paper shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
  drawTornPaperPath(ctx, -288, -132, 594, 282, 11, 12);
  ctx.fill();

  // Warm torn paper fill
  ctx.fillStyle = "#F7F2E8";
  drawTornPaperPath(ctx, -300, -144, 594, 282, 11, 12);
  ctx.fill();

  // Subtle vertical paper crease tint
  ctx.fillStyle = "rgba(20, 20, 26, 0.04)";
  ctx.fillRect(-120, -142, 46, 278);

  // Top black line ("YOU GOT")
  ctx.textAlign = "center";
  ctx.fillStyle = "#111216";
  ctx.font = "900 68px 'Space Grotesk', sans-serif";
  ctx.fillText(String(topLine || "YOU GOT").toUpperCase(), 0, -40);

  // Giant hot-pink display word ("TRAPPED!") auto-fitted inside torn paper
  const displayWord = String(bigWord || "TRAPPED!").toUpperCase();
  let bigFontSize = 104;
  ctx.font = `italic 900 ${bigFontSize}px 'Space Grotesk', sans-serif`;
  while (ctx.measureText(displayWord).width > 520 && bigFontSize > 56) {
    bigFontSize -= 4;
    ctx.font = `italic 900 ${bigFontSize}px 'Space Grotesk', sans-serif`;
  }
  ctx.fillStyle = pal.hot;
  ctx.fillText(displayWord, 0, 62);

  // Hand-drawn hot-pink brush underline swoosh
  ctx.strokeStyle = pal.hot;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-210, 88);
  ctx.quadraticCurveTo(0, 74, 215, 86);
  ctx.stroke();
  ctx.restore();

  // 5. MID-RIGHT CHALLENGE PILL (⚡ OD - TRAP CHALLENGE)
  ctx.save();
  ctx.translate(710, 608);
  ctx.rotate(-0.035);
  ctx.fillStyle = "#111216";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  drawRoundRect(ctx, -235, -34, 480, 68, 34);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 28px 'Space Grotesk', sans-serif";
  ctx.fillText(String(challengeLabel || "OD - TRAP CHALLENGE").toUpperCase(), 18, 10);

  // Bold yellow lightning bolt overlapping left side of pill
  ctx.fillStyle = pal.accent;
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-225, -48);
  ctx.lineTo(-262, 6);
  ctx.lineTo(-226, 6);
  ctx.lineTo(-244, 54);
  ctx.lineTo(-190, -10);
  ctx.lineTo(-226, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 6. MID-RIGHT TORN NOTEBOOK PAPER CARD ("You dodged the NO button 4x ...but still said YES!")
  ctx.save();
  ctx.translate(690, 892);
  ctx.rotate(-0.025);

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  drawTornPaperPath(ctx, -320, -172, 668, 368, 29, 13);
  ctx.fill();

  // Ruled notebook torn paper
  ctx.save();
  drawTornPaperPath(ctx, -332, -184, 668, 368, 29, 13);
  ctx.fillStyle = "#FAF6EC";
  ctx.fill();
  ctx.clip();

  // Horizontal notebook lines
  ctx.strokeStyle = "rgba(59, 130, 246, 0.14)";
  ctx.lineWidth = 2;
  for (let ly = -150; ly <= 170; ly += 36) {
    ctx.beginPath();
    ctx.moveTo(-340, ly);
    ctx.lineTo(350, ly);
    ctx.stroke();
  }
  ctx.restore();

  // Left text inside notebook
  ctx.textAlign = "left";
  ctx.fillStyle = "#111216";
  ctx.font = "800 41px 'Space Grotesk', sans-serif";
  ctx.fillText(String(noteLine1 || "You dodged the").slice(0, 18), -292, -74);
  ctx.fillText(String(noteLine2 || "NO button").slice(0, 18), -292, -20);

  // Right neon-lime circled big stat ("4x")
  ctx.save();
  ctx.translate(185, -52);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 92, -0.06, 0, Math.PI * 2);
  ctx.stroke();

  const statTxt = String(bigStat || "4x").slice(0, 5);
  const statFontSz = statTxt.length <= 2 ? 108 : statTxt.length === 3 ? 84 : 66;
  ctx.textAlign = "center";
  ctx.fillStyle = "#111216";
  ctx.font = `900 ${statFontSz}px 'Space Grotesk', sans-serif`;
  ctx.fillText(statTxt, 0, statFontSz * 0.34);
  ctx.restore();

  // 3 Yellow Comic Burst Rays at top-right of notebook
  ctx.strokeStyle = pal.yellow;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(278, -162); ctx.lineTo(302, -214);
  ctx.moveTo(310, -142); ctx.lineTo(352, -182);
  ctx.moveTo(324, -108); ctx.lineTo(372, -124);
  ctx.stroke();

  // Bottom inside notebook: "...but still said [YES!]"
  ctx.textAlign = "left";
  ctx.fillStyle = "#111216";
  ctx.font = "800 40px 'Space Grotesk', sans-serif";
  const prefStr = String(highlightPrefix || "...but still said").slice(0, 19);
  ctx.fillText(prefStr, -292, 104);

  const hlWord = String(highlightWord || "YES!").toUpperCase().slice(0, 11);
  ctx.font = "900 50px 'Space Grotesk', sans-serif";
  const hlW = Math.min(240, Math.max(152, ctx.measureText(hlWord).width + 44));
  const hlX = 300 - hlW;
  ctx.fillStyle = pal.accent;
  drawRoundRect(ctx, hlX, 50, hlW, 76, 12);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#111216";
  let hlFont = 50;
  ctx.font = `900 ${hlFont}px 'Space Grotesk', sans-serif`;
  while (ctx.measureText(hlWord).width > hlW - 22 && hlFont > 30) {
    hlFont -= 3;
    ctx.font = `900 ${hlFont}px 'Space Grotesk', sans-serif`;
  }
  ctx.fillText(hlWord, hlX + hlW / 2, 105);

  ctx.restore();

  // 7. HOT-PINK TROPHY ROAST BANNER ("🏆 CERTIFIED EASY TARGET 😂")
  ctx.save();
  ctx.translate(560, 1218);
  ctx.rotate(-0.032);

  // Drop shadow
  ctx.fillStyle = "#000000";
  drawRoundRect(ctx, -372, -70, 762, 152, 76);
  ctx.fill();

  // Pink pill with white outline
  ctx.fillStyle = pal.hot;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 7;
  drawRoundRect(ctx, -384, -80, 762, 152, 76);
  ctx.fill();
  ctx.stroke();

  // Drawn Golden Trophy Icon on left edge
  ctx.save();
  ctx.translate(-305, -2);
  ctx.fillStyle = "#FFD166";
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  // Handles
  ctx.beginPath();
  ctx.arc(-44, -14, 22, 0.4 * Math.PI, 1.6 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(44, -14, 22, -0.6 * Math.PI, 0.6 * Math.PI);
  ctx.stroke();
  // Cup body
  ctx.beginPath();
  ctx.moveTo(-42, -46);
  ctx.lineTo(42, -46);
  ctx.quadraticCurveTo(40, 14, 0, 22);
  ctx.quadraticCurveTo(-40, 14, -42, -46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Stem & Base
  ctx.fillRect(-10, 20, 20, 24);
  ctx.strokeRect(-10, 20, 20, 24);
  drawRoundRect(ctx, -36, 40, 72, 18, 6);
  ctx.fill();
  ctx.stroke();
  // Trophy shine
  ctx.fillStyle = "#FFF7CC";
  ctx.fillRect(-24, -34, 10, 28);
  ctx.restore();

  // 2-line bold white roast text
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 48px 'Space Grotesk', sans-serif";
  ctx.fillText(String(roastLine1 || "CERTIFIED").toUpperCase().slice(0, 18), 46, -12);
  ctx.font = "900 46px 'Space Grotesk', sans-serif";
  ctx.fillText(String(roastLine2 || "EASY TARGET 😂").toUpperCase().slice(0, 20), 46, 46);
  ctx.restore();

  // 8. TWO SIDE-BY-SIDE STAT PILLS ("Skill: 0/100" | "Chaos: 100%")
  const drawStatPill = (px, py, label, iconKind) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.02);

    ctx.fillStyle = "#FFFFFF";
    drawRoundRect(ctx, -206, -50, 424, 104, 52);
    ctx.fill();

    ctx.fillStyle = pal.yellow;
    ctx.strokeStyle = "#111216";
    ctx.lineWidth = 6;
    drawRoundRect(ctx, -212, -54, 424, 104, 52);
    ctx.fill();
    ctx.stroke();

    // Crisp vector icon on left
    ctx.save();
    ctx.translate(-154, -2);
    if (iconKind === "target") {
      ctx.strokeStyle = "#111216";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = pal.hot;
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(26, -26); ctx.stroke();
    } else {
      ctx.fillStyle = "#FF5A5F";
      ctx.strokeStyle = "#111216";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.quadraticCurveTo(22, -4, 16, 14);
      ctx.quadraticCurveTo(0, 28, -16, 14);
      ctx.quadraticCurveTo(-22, -4, 0, -26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#FFD166";
      ctx.beginPath();
      ctx.arc(0, 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = "#111216";
    ctx.font = "800 34px 'Space Grotesk', sans-serif";
    ctx.fillText(String(label || "").slice(0, 15), -114, 10);
    ctx.restore();
  };

  drawStatPill(302, 1418, statLeft, "target");
  drawStatPill(778, 1404, statRight, "flame");

  // 9. BOTTOM TORN NEON-LIME STREETWEAR CTA STRIP
  ctx.save();
  ctx.translate(540, 1705);
  ctx.rotate(-0.032);

  // Ripped neon-lime band
  ctx.fillStyle = pal.accent;
  drawTornPaperPath(ctx, -620, -172, 1240, 355, 77, 16);
  ctx.fill();

  // Checkered racing flag patch on bottom-left corner
  ctx.save();
  ctx.translate(-485, 65);
  ctx.rotate(0.28);
  const sq = 32;
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#111216" : "#FFFFFF";
      ctx.fillRect(c * sq - 48, r * sq - 80, sq, sq);
    }
  }
  ctx.restore();

  // Bold black CTA headline
  ctx.textAlign = "center";
  ctx.fillStyle = "#111216";
  ctx.font = "900 56px 'Space Grotesk', sans-serif";
  ctx.fillText(String(ctaLine || "I DID IT. YOUR TURN! 👀").toUpperCase().slice(0, 26), 16, -64);

  // White Clickable-Look URL Pill
  ctx.fillStyle = "#111216";
  drawRoundRect(ctx, -334, -8, 694, 106, 53);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 6;
  drawRoundRect(ctx, -344, -18, 694, 106, 53);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#111216";
  ctx.font = "800 36px 'Space Grotesk', sans-serif";
  ctx.fillText(`🔗  ${String(footerUrl || "oddora-kappa.vercel.app").slice(0, 28)}`, -8, 48);

  // Sharp Pointer Cursor Arrow + Click Burst on Right Edge of URL Pill!
  ctx.save();
  ctx.translate(316, 48);
  ctx.strokeStyle = "#111216";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-26, -16); ctx.lineTo(-42, -26);
  ctx.moveTo(-14, -30); ctx.lineTo(-18, -48);
  ctx.moveTo(4, -30);   ctx.lineTo(14, -46);
  ctx.stroke();

  ctx.fillStyle = "#111216";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(8, 72);
  ctx.lineTo(28, 54);
  ctx.lineTo(54, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Blob failed");
  return {
    file: new File([blob], "oddora-result.png", { type: "image/png" }),
    dataUrl
  };
}

function PosterPreviewModal({ poster, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!poster?.dataUrl) return null;

  async function copyCaption() {
    fx("tap", 12);
    try {
      await navigator.clipboard.writeText(poster.shareText || window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  }

  function downloadDirect() {
    fx("tap", 14);
    try {
      const a = document.createElement("a");
      a.href = poster.dataUrl;
      a.download = "oddora-result.png";
      a.click();
    } catch {}
  }

  function shareWhatsAppText() {
    fx("tap", 14);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(poster.shareText || window.location.origin)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="pop-modal-overlay" style={{ zIndex: 3100 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="pop-modal-box">
        <button type="button" className="pop-modal-close" onClick={onClose} aria-label="Close">
          <X size={18}/>
        </button>
        <div className="pop-ready-card pop-zoom-in pop-poster-modal">
          <span className="pop-pill-black">📸 YOUR CARD IS READY</span>
          <p className="pop-poster-save-tip">
            📱 <strong>Hold the card</strong> → <strong>Save to Photos</strong>
          </p>
          <div className="pop-poster-img-wrap">
            <img src={poster.dataUrl} alt="ODDORA Result Card" className="pop-poster-preview-img" />
          </div>
          <div className="pop-share-bar">
            <button type="button" className="pop-btn yellow sm" onClick={downloadDirect}>
              <Download size={14}/> Save
            </button>
            <button type="button" className="pop-btn white sm" onClick={copyCaption}>
              {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Link</>}
            </button>
            <button type="button" className="pop-btn green sm" onClick={shareWhatsAppText}>
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function sharePosterWithLink({ posterArgs, caption, onStatus, onPreview }) {
  const siteUrl = window.location.origin;
  const fullShareText = `${caption}\nTry it here 👉 ${siteUrl}`;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isIOS = /iP(hone|ad|od)/i.test(ua);
  const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat|Twitter|MicroMessenger|WebView/i.test(ua);

  let generated = null;
  try {
    await navigator.clipboard?.writeText(fullShareText).catch(() => {});
    generated = await createPoster916({ ...posterArgs, footerUrl: window.location.host });

    // Try native OS file share first when outside restrictive in-app browsers
    if (!isInApp && navigator.canShare?.({ files: [generated.file] }) && navigator.share) {
      await navigator.share({
        title: "ODDORA ⚡",
        text: fullShareText,
        files: [generated.file]
      });
      onStatus?.("Shared! Link copied 🔗");
      return;
    }

    // iOS / In-App browsers often silently block blob downloads — show press-and-hold save modal!
    if (onPreview && (isIOS || isInApp)) {
      onPreview({ dataUrl: generated.dataUrl, shareText: fullShareText });
      onStatus?.("Hold the card to save 📲");
      return;
    }

    // Desktop / standard Android fallback: trigger download AND open visual preview modal
    const url = URL.createObjectURL(generated.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oddora-result.png";
    a.click();
    URL.revokeObjectURL(url);
    onPreview?.({ dataUrl: generated.dataUrl, shareText: fullShareText });
    onStatus?.("Card ready! Link copied 🔗");
  } catch (err) {
    if (err?.name === "AbortError") return;
    if (generated?.dataUrl && onPreview) {
      onPreview({ dataUrl: generated.dataUrl, shareText: fullShareText });
      onStatus?.("Hold the card to save 📲");
    } else {
      onStatus?.("Link copied! Paste anywhere 🔗");
    }
  }
}


/* ============================================================================
   5B. PERSISTENT 2-WAY LIVE CHAT HISTORY (Survives Close, Reload & Late Replies!)
============================================================================ */
function isSystemChatMsg(text = "") {
  return /^(Unlocked your Secret Vault!|INSTANT YES!|Said YES after \d+ dodges!)/i.test(String(text || "").trim());
}

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
        })).filter(m => m.text && !isSystemChatMsg(m.text)));
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
        })).filter(m => m.text && !isSystemChatMsg(m.text)));
      },
      () => {}
    );
    return () => { u1(); u2(); };
  }, [code]);

  return [...rxMsgs, ...txMsgs]
    .filter(m => m.text && !isSystemChatMsg(m.text))
    .sort((a, b) => a.ts - b.ts);
}

function ChatHistoryBox({ messages, viewerSide = "receiver", boxRef }) {
  const innerRef = useRef(null);
  const resolvedRef = boxRef || innerRef;

  useEffect(() => {
    const el = resolvedRef.current;
    if (!el) return;
    const scrollEnd = () => {
      try { el.scrollTo({ top: el.scrollHeight + 120, behavior: "smooth" }); } catch {}
    };
    requestAnimationFrame(scrollEnd);
    const t = setTimeout(scrollEnd, 90);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (!messages.length) return null;
  return (
    <div className="pop-chat-history" ref={resolvedRef}>
      {messages.map((m, idx) => {
        const isMe = m.side === viewerSide;
        return (
          <div key={idx} className={`pop-chat-bubble ${isMe ? "me" : "them"}`}>
            <small>{isMe ? "You" : m.from}</small>
            <span>{m.text}</span>
          </div>
        );
      })}
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
  const [liveNotif, setLiveNotif] = useState(null);
  const [sharingFlex, setSharingFlex] = useState(false);
  const [previewPoster, setPreviewPoster] = useState(null);
  const feedRef = useRef(null);
  const replyInputRef = useRef(null);

  useEffect(() => {
    if (!code) return undefined;
    let initialCount = -1;
    return onValue(
      ref(database, `live/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        if (initialCount !== -1 && list.length > initialCount) {
          const newest = list[list.length - 1];
          if (newest?.msg && !String(newest.msg).startsWith("📤")) {
            // Soft chime + auto-scroll inside active chat (no intrusive top banner over active chat!)
            fx("notify", [18, 25]);
          }
        }
        initialCount = list.length;
        setEvents(list);
      },
      () => {}
    );
  }, [code]);

  // Merge Live Radar events + 2-way chat into ONE unified timeline!
  const unifiedFeed = [
    ...events
      .filter(ev => ev?.msg && !String(ev.msg).startsWith("📤") && !String(ev.msg).includes("replied:"))
      .map(ev => ({ kind: "event", text: ev.msg, ts: Number(ev.ts || 0) })),
    ...chatHistory.map(m => ({ kind: "chat", ...m }))
  ].sort((a, b) => a.ts - b.ts);

  // Auto-scroll unified feed to bottom whenever a message or live event arrives!
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const scrollBottom = () => {
      try { el.scrollTo({ top: el.scrollHeight + 140, behavior: "smooth" }); } catch {}
    };
    requestAnimationFrame(scrollBottom);
    const t = setTimeout(scrollBottom, 90);
    return () => clearTimeout(t);
  }, [unifiedFeed.length]);

  function jumpToChatbox() {
    setLiveNotif(null);
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setTimeout(() => {
      replyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      replyInputRef.current?.focus();
    }, 80);
  }

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
      posterArgs: isVault
        ? {
            kicker: "OFFICIAL RESULT",
            topLine: "SECRET",
            bigWord: "LOCKED!",
            challengeLabel: "OD - VAULT CHALLENGE",
            noteLine1: "Locked a vault",
            noteLine2: `for ${rec.slice(0, 12)}`,
            bigStat: "2x",
            highlightPrefix: "...puzzles to",
            highlightWord: "UNLOCK!",
            roastLine1: "CERTIFIED",
            roastLine2: "VAULT KEEPER 🔐",
            statLeft: "Secrecy: 100%",
            statRight: "Hype: 100%",
            ctaLine: "LOCK A SECRET! 👀",
            actorName: `${me} → ${rec}`,
            avatarId,
            cardColor
          }
        : {
            kicker: "OFFICIAL RESULT",
            topLine: "CAUGHT",
            bigWord: "IN 4K!",
            challengeLabel: "OD - TRAP CHALLENGE",
            noteLine1: `Trapped ${rec.slice(0, 10)}`,
            noteLine2: "with NO button",
            bigStat: "4K",
            highlightPrefix: "...they still said",
            highlightWord: "YES!",
            roastLine1: "CERTIFIED",
            roastLine2: "MASTER TRAPPER 😈",
            statLeft: "Trap IQ: 100%",
            statRight: "Chaos: 100%",
            ctaLine: "TRAP YOUR FRIENDS! 👀",
            actorName: `${me} → ${rec}`,
            avatarId,
            cardColor
          },
      caption: isVault
        ? `I locked a secret for ${rec} on ODDORA 🔐`
        : `Caught ${rec} in 4K with OD - Trap 😂⚡`,
      onPreview: p => setPreviewPoster(p),
      onStatus: msg => {
        setSentFlash(msg);
        setTimeout(() => setSentFlash(""), 3500);
      }
    });
    setSharingFlex(false);
  }

  const quickReplies = isVault ? SENDER_QUICK_REPLIES_VAULT : SENDER_QUICK_REPLIES_TRAP;

  return (
    <>
      <PosterPreviewModal poster={previewPoster} onClose={() => setPreviewPoster(null)} />
      <MobileNotificationBanner
        notif={liveNotif}
        onOpen={jumpToChatbox}
        onDismiss={() => setLiveNotif(null)}
      />
      <div className="pop-radar-box">
      <div className="pop-radar-head">
        <span className="pop-radar-dot" />
        📡 LIVE FEED & CHAT · {String(recipientName || "FRIEND").toUpperCase()}
      </div>

      <div className="pop-unified-feed" ref={feedRef}>
        {unifiedFeed.length === 0 ? (
          <div className="pop-feed-pill">Waiting for {recipientName || "them"} to bite… 🎣</div>
        ) : (
          unifiedFeed.map((item, idx) =>
            item.kind === "event" ? (
              <div className="pop-feed-pill" key={`e-${idx}`}>{item.text}</div>
            ) : (
              <div key={`c-${idx}`} className={`pop-chat-bubble ${item.side === "sender" ? "me" : "them"}`}>
                <small>{item.side === "sender" ? "You" : item.from}</small>
                <span>{item.text}</span>
              </div>
            )
          )
        )}
      </div>

      <div className="pop-radar-reply-wrap">
        <form className="pop-react-form" onSubmit={e => { e.preventDefault(); sendLiveReply(replyText); }}>
          <input
            ref={replyInputRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onFocus={focusScrollCenter}
            placeholder={`Reply live to ${recipientName || "them"}...`}
            maxLength={120}
          />
          <button type="submit" className="pop-btn yellow sm" disabled={!replyText.trim()}>
            <Send size={14}/>
          </button>
        </form>
        <div className="pop-chips-scroll">
          {quickReplies.map(chip => (
            <button key={chip} type="button" className="pop-chip dark-chip" onClick={() => sendLiveReply(chip)}>
              {chip}
            </button>
          ))}
        </div>
        {sentFlash && <small className="pop-sent-flash">{sentFlash}</small>}
      </div>

      {/* Sender Perspective Flex Share — cleanly below chat so it never blocks messages! */}
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
    </div>
    </>
  );
}

/* ============================================================================
   6. MAIN APP SHELL (Top ODDORA Logo Always Goes Home + Shelf Full-Screen View)
============================================================================ */

/* ============================================================================
   5C. INTERACTIVE PHOTO CROP / FOCUS ADJUSTER (Drag + Zoom + Fill/Full Toggle)
============================================================================ */
function TrapPhotoCropper({ src, posX, posY, zoom, fit, onChange, onRemove }) {
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  function handlePointerDown(e) {
    if (fit === "contain") return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posX,
      origY: posY
    };
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / Math.max(rect.width, 1)) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / Math.max(rect.height, 1)) * 100;
    const nextX = Math.round(Math.min(100, Math.max(0, dragRef.current.origX - dx * 1.15)));
    const nextY = Math.round(Math.min(100, Math.max(0, dragRef.current.origY - dy * 1.15)));
    onChange({ posX: nextX, posY: nextY });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="pop-cropper-card">
      <div className="pop-row-between">
        <span className="pop-mini-tag">✂️ ADJUST PHOTO CROP</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`pop-ptab ${fit === "cover" ? "active" : ""}`}
            onClick={() => { fx("tap", 10); onChange({ fit: "cover" }); }}
          >
            Fill
          </button>
          <button
            type="button"
            className={`pop-ptab ${fit === "contain" ? "active" : ""}`}
            onClick={() => { fx("tap", 10); onChange({ fit: "contain", zoom: 1 }); }}
          >
            Full Fit
          </button>
          <button type="button" className="pop-btn pink sm" style={{ padding: "3px 8px", fontSize: 11 }} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`pop-crop-stage ${fit === "cover" ? "draggable" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={src}
          alt="Crop preview"
          draggable={false}
          style={{
            objectFit: fit,
            objectPosition: `${posX}% ${posY}%`,
            transform: fit === "cover" ? `scale(${zoom})` : "none",
            transformOrigin: `${posX}% ${posY}%`
          }}
        />
        {fit === "cover" && (
          <span className="pop-crop-hint">✋ Drag photo to frame</span>
        )}
      </div>

      {fit === "cover" && (
        <div className="pop-crop-sliders">
          <label className="pop-slider-row">
            <span>↕ Up / Down</span>
            <input
              type="range"
              min={0}
              max={100}
              value={posY}
              onChange={e => onChange({ posY: Number(e.target.value) })}
            />
          </label>
          <label className="pop-slider-row">
            <span>🔍 Zoom ({zoom.toFixed(1)}x)</span>
            <input
              type="range"
              min={1}
              max={2.2}
              step={0.1}
              value={zoom}
              onChange={e => onChange({ zoom: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5D. WATCH LIVE SCREEN (Fetches & Displays Previous Vault/Trap Photo + Secret!)
============================================================================ */
function WatchLiveScreen({ item, fromInbox = false, onGoHome, onBack }) {
  const [creation, setCreation] = useState(null);
  const [showMedia, setShowMedia] = useState(true);

  useEffect(() => {
    if (!item?.code) return undefined;
    let alive = true;
    get(ref(database, `creations/${item.code}`))
      .then(snap => {
        if (alive && snap.exists()) setCreation(snap.val());
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [item?.code]);

  const isVault = Boolean(
    item.isVault ||
    creation?.type === "vault" ||
    String(item.title || "").toLowerCase().includes("vault")
  );
  const theme = creation?.theme || item.theme || (isVault ? "gold" : "lime");
  const avatarId = creation?.avatarId || item.avatarId || "shades";
  const shareUrl = (() => {
    const u = new URL(window.location.href);
    u.search = "";
    u.searchParams.set("odc", item.code);
    return u.toString();
  })();

  const photoSrc = isVault ? creation?.payload?.secretImage : creation?.payload?.bgImage;
  const noteText = isVault ? creation?.payload?.secretText : creation?.payload?.title;
  const bgPosX = creation?.payload?.bgPosX ?? 50;
  const bgPosY = creation?.payload?.bgPosY ?? 20;
  const bgZoom = creation?.payload?.bgZoom ?? 1;
  const bgFit = creation?.payload?.bgFit || "cover";

  return (
    <div className={`pop-fs-stage theme-${theme}`}>
      <div className="pop-fs-topbar">
        <button type="button" className="pop-pill-black pop-pill-btn" onClick={onGoHome}>
          ⚡ ODDORA · HOME
        </button>
        <button type="button" className="pop-btn pink sm" onClick={onBack}>
          {fromInbox ? "← Inbox" : "✕ Back"}
        </button>
      </div>
      <div className="pop-fs-content">
        <div className="pop-ready-card pop-zoom-in" style={{ width: "100%" }}>
          <HumanAvatarSVG avatarId={avatarId} size={54} />
          <span className="pop-pill-black">
            {isVault ? "🔐 SENT VAULT" : "⚡ SENT TRAP"} · TO {String(item.to || "FRIEND").toUpperCase()}
          </span>
          <h2>{item.title}</h2>

          {/* Show the Vault / Trap Photo & Secret Content right inside Watch Live! */}
          {(photoSrc || (isVault && noteText)) && (
            <div className="pop-sent-media-box">
              <div className="pop-row-between">
                <span className="pop-mini-tag">
                  {isVault ? "🔐 YOUR LOCKED VAULT CONTENT" : "📸 TRAP PHOTO PREVIEW"}
                </span>
                <button
                  type="button"
                  className="pop-ptab active"
                  onClick={() => { fx("tap", 10); setShowMedia(s => !s); }}
                >
                  {showMedia ? "Hide" : "Show"}
                </button>
              </div>
              {showMedia && (
                <>
                  {photoSrc && (
                    <div className={`pop-watch-photo-frame ${isVault ? "vault-fit" : ""}`}>
                      <img
                        src={photoSrc}
                        alt={isVault ? "Vault photo" : "Trap photo"}
                        style={
                          isVault
                            ? { objectFit: "cover", objectPosition: "50% 15%" }
                            : {
                                objectFit: bgFit,
                                objectPosition: `${bgPosX}% ${bgPosY}%`,
                                transform: bgFit === "cover" ? `scale(${bgZoom})` : "none",
                                transformOrigin: `${bgPosX}% ${bgPosY}%`
                              }
                        }
                      />
                    </div>
                  )}
                  {isVault && noteText && (
                    <div className="pop-watch-secret-note">“{noteText}”</div>
                  )}
                  {isVault && creation?.payload?.pin && (
                    <small className="pop-muted">🔑 Secret PIN: <strong>{creation.payload.pin}</strong></small>
                  )}
                </>
              )}
            </div>
          )}

          <UniversalShareBar
            url={shareUrl}
            shareText={
              isVault
                ? `${item.from || "Someone"} locked a Secret Vault for you 🔐 Solve 2 quick puzzles to open it!`
                : `${item.from || "Someone"} sent you a Secret OD Card 👀⚡`
            }
            title="Secret OD Card"
          />
          <LiveRadarPanel
            code={item.code}
            recipientName={item.to}
            senderName={item.from || "You"}
            avatarId={avatarId}
            cardColor={theme}
            isVault={isVault}
          />
        </div>
      </div>
    </div>
  );
}



/* ============================================================================
   5E-0. REUSABLE ANIMATED MODE PREVIEW CARDS (Used in Explainer + Top Create!)
============================================================================ */
function ModePreviewCards({ onSelectMode }) {
  return (
    <div className="pop-explainer-grid">
      <button
        type="button"
        className="pop-explainer-card lime"
        onClick={() => {
          fx("tap", 14);
          onSelectMode?.("trap");
        }}
      >
        <div className="pop-explainer-head">
          <strong>⚡ Trap a friend</strong>
          <span className="pop-pill-black">OD - TRAP</span>
        </div>

        {/* Live Animated Mini Preview: Runaway NO Button */}
        <div className="pop-mini-demo trap-demo" aria-hidden="true">
          <span className="pop-mini-demo-q">“Coffee today? ☕”</span>
          <div className="pop-mini-demo-btns">
            <span className="pop-mini-pill yes">Yes ⚡</span>
            <span className="pop-mini-pill no">No 😜</span>
          </div>
        </div>

        <p className="pop-explainer-lines">
          Runaway button they can’t catch. Watch them panic live 👀
        </p>
      </button>

      <button
        type="button"
        className="pop-explainer-card gold"
        onClick={() => {
          fx("tap", 14);
          onSelectMode?.("vault");
        }}
      >
        <div className="pop-explainer-head">
          <strong>🔐 Lock a Vault</strong>
          <span className="pop-pill-black">OD - VAULT</span>
        </div>

        {/* Live Animated Mini Preview: Blurred Secret + Passcode Decrypt */}
        <div className="pop-mini-demo vault-demo" aria-hidden="true">
          <div className="pop-mini-vault-blur">
            <span className="pop-mini-vault-secret">📸 Secret pic</span>
            <span className="pop-mini-vault-tap">⚡ TAP</span>
          </div>
          <div className="pop-mini-vault-codes">
            <span className="pop-mini-slot s1">*</span>
            <span className="pop-mini-slot s2">*</span>
            <span className="pop-mini-slot s3">*</span>
            <span className="pop-mini-slot s4">_</span>
          </div>
        </div>

        <p className="pop-explainer-lines">
          Hide a secret or selfie behind 2 quick locks &amp; a PIN 🤫
        </p>
      </button>
    </div>
  );
}

/* ============================================================================
   5E-1. ABOUT, PRIVACY, TERMS & CONTACT/FEEDBACK MODAL (V22.4)
============================================================================ */
function InfoLegalModal({ activeTab, defaultName = "", onSwitchTab, onClose }) {
  const [fbTag, setFbTag] = useState("💡 Idea");
  const [fbName, setFbName] = useState(defaultName);
  const [fbContact, setFbContact] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);

  useEffect(() => {
    if (activeTab) {
      setFbName(prev => prev || defaultName);
      setFbSent(false);
    }
  }, [activeTab, defaultName]);

  if (!activeTab) return null;

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const cleanMsg = fbMsg.trim().slice(0, 500);
    if (!cleanMsg || fbSending) return;
    setFbSending(true);
    fx("tap", 14);
    try {
      await signInPlayer().catch(() => null);
      await push(ref(database, "feedback"), {
        tag: fbTag,
        name: (fbName.trim() || "Anonymous").slice(0, 30),
        contact: fbContact.trim().slice(0, 60),
        message: cleanMsg,
        deviceId: getDeviceId(),
        createdAt: Date.now()
      });
      fx("win", [18, 28, 18]);
      setFbMsg("");
      setFbSent(true);
    } catch {
      alert("No signal 📡 Couldn't send. Try again.");
    } finally {
      setFbSending(false);
    }
  }

  return (
    <div
      className="pop-modal-overlay"
      style={{ zIndex: 2900 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="pop-modal-box">
        <button type="button" className="pop-modal-close" onClick={onClose} aria-label="Close">
          <X size={18}/>
        </button>

        <div className="pop-ready-card pop-zoom-in pop-legal-sheet">
          <span className="pop-pill-black">⚡ ODDORA · INFO</span>

          <div className="pop-legal-tabs">
            {[
              { id: "about", label: "About" },
              { id: "privacy", label: "Privacy" },
              { id: "terms", label: "Terms" },
              { id: "contact", label: "Feedback" }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? "pop-ltab active" : "pop-ltab"}
                onClick={() => { fx("tap", 10); onSwitchTab?.(t.id); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pop-legal-body">
            {activeTab === "about" && (
              <div className="pop-legal-section">
                <h3>About ODDORA ⚡</h3>
                <p>
                  ODDORA is a free, zero-login internet playground built for quick laughs, playful traps, and secret moments shared over WhatsApp &amp; Instagram DMs.
                </p>
                <ul className="pop-legal-list">
                  <li><strong>⚡ OD - Trap:</strong> Send a question with a runaway button that talks &amp; dodges until your friend gives in — watch every tap live and share a result card.</li>
                  <li><strong>🔐 OD - Vault:</strong> Lock a secret note or selfie behind 2 quick puzzles and an optional 4-digit PIN, with live chat and Burn After Read mode.</li>
                  <li><strong>📱 Zero Signup:</strong> No passwords, no email spam, no app download required. Just pick a face, drop a link, and play.</li>
                </ul>
                <button
                  type="button"
                  className="pop-btn yellow sm full"
                  onClick={() => { fx("tap", 10); onSwitchTab?.("contact"); }}
                >
                  💬 Got an idea or bug? Send Feedback
                </button>
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="pop-legal-section">
                <h3>Privacy Policy 🔒</h3>
                <p className="pop-legal-updated">Effective: November 2026</p>
                <ul className="pop-legal-list">
                  <li><strong>No Personal Accounts:</strong> ODDORA does not require your email, phone number, or password. Your chosen display name, avatar, Inbox list, and My Shelf memories are stored locally in your browser (<code>localStorage</code>).</li>
                  <li><strong>Temporary Cloud Sync:</strong> Cards, compressed photos, live tap events, and 2-way chat messages are stored in Firebase Realtime Database using an anonymous session ID solely to sync between sender and receiver.</li>
                  <li><strong>Vault Access &amp; Burn After Read:</strong> One-time Vaults lock to the first unlocker’s device so others cannot view the secret. When “Burn After Read” is enabled, the Vault is deleted from our database shortly after unlock.</li>
                  <li><strong>Your Control:</strong> You can delete Inbox threads, remove saved memories from My Shelf, or clear your browser’s site data at any time.</li>
                  <li><strong>No Data Selling:</strong> We do not sell your data or photos to third parties.</li>
                </ul>
              </div>
            )}

            {activeTab === "terms" && (
              <div className="pop-legal-section">
                <h3>Terms &amp; Conditions 📜</h3>
                <p className="pop-legal-updated">Effective: November 2026</p>
                <ul className="pop-legal-list">
                  <li><strong>For Fun &amp; Friends:</strong> ODDORA is designed for lighthearted pranks, dares, and personal notes among friends.</li>
                  <li><strong>Responsible Use:</strong> You agree not to upload or share illegal, abusive, harassing, explicit, harmful, or infringing content, or use ODDORA to spam or mislead strangers.</li>
                  <li><strong>No Permanent Storage Guarantee:</strong> ODDORA is a free, lightweight web app. Links, chats, or media may expire or be cleared during maintenance — always save important photos to your device gallery.</li>
                  <li><strong>As-Is Service:</strong> ODDORA is provided “as is” without warranties. We may update features, pause the service, or remove abusive links at any time.</li>
                </ul>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="pop-legal-section">
                <h3>Contact &amp; Feedback 💬</h3>
                <p>Bug? Idea? Weird link? Tell us 👇</p>

                {fbSent ? (
                  <div className="pop-fb-done">
                    <strong>🎉 Thanks for the feedback!</strong>
                    <small>Got it! We'll read it soon.</small>
                    <button
                      type="button"
                      className="pop-btn white sm"
                      onClick={() => { fx("tap", 10); setFbSent(false); }}
                    >
                      Send another note
                    </button>
                  </div>
                ) : (
                  <form className="pop-stack" onSubmit={handleFeedbackSubmit}>
                    <div className="pop-chips-row">
                      {["💡 Idea", "🐛 Bug", "❤️ Love it", "⚠️ Report"].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className={fbTag === tag ? "pop-chip active" : "pop-chip"}
                          onClick={() => { fx("tap", 8); setFbTag(tag); }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <div className="pop-grid-2">
                      <input
                        value={fbName}
                        onChange={e => setFbName(e.target.value)}
                        onFocus={focusScrollCenter}
                        placeholder="Your name"
                        maxLength={30}
                      />
                      <input
                        value={fbContact}
                        onChange={e => setFbContact(e.target.value)}
                        onFocus={focusScrollCenter}
                        placeholder="Insta / Email (optional)"
                        maxLength={60}
                      />
                    </div>

                    <textarea
                      rows={3}
                      value={fbMsg}
                      onChange={e => setFbMsg(e.target.value)}
                      onFocus={focusScrollCenter}
                      placeholder="Tell us what you liked, what broke, or what we should build next..."
                      maxLength={500}
                      style={{
                        width: "100%",
                        border: "2.5px solid var(--ink)",
                        background: "var(--cream)",
                        color: "var(--ink)",
                        borderRadius: 12,
                        padding: "11px 13px",
                        fontSize: 14,
                        fontWeight: 600,
                        outline: "none",
                        resize: "vertical"
                      }}
                    />

                    <button
                      type="submit"
                      className="pop-btn yellow full"
                      disabled={!fbMsg.trim() || fbSending}
                    >
                      <Send size={15}/> {fbSending ? "Sending..." : "Send Feedback 🚀"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   5E. FIRST-TIME PROFILE SETUP + 2-LINE EXPLAINER MODAL (V22.1)
============================================================================ */
function OnboardingProfileModal({
  open,
  mode = "onboard", // "onboard" | "edit" | "explainer"
  initialProfile,
  friendNamedContext, // { friendName, suggestedName, replyTo } | null
  targetLabel = "",
  skipExplainer = false,
  onSaveProfile,
  onSelectMode,
  onClose
}) {
  const [stage, setStage] = useState(mode === "explainer" ? "explainer" : "profile");
  const [avatarId, setAvatarId] = useState(initialProfile?.avatarId || "shades");
  const [avatarTapped, setAvatarTapped] = useState(Boolean(initialProfile?.avatarId));
  const [nameInput, setNameInput] = useState(
    initialProfile?.name || friendNamedContext?.suggestedName || ""
  );
  const nameInputRef = useRef(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setStage(mode === "explainer" ? "explainer" : "profile");
      setAvatarId(initialProfile?.avatarId || "shades");
      setAvatarTapped(Boolean(initialProfile?.avatarId));
      setNameInput(initialProfile?.name || friendNamedContext?.suggestedName || "");
    }
    prevOpenRef.current = open;
  }, [open, mode, initialProfile?.name, initialProfile?.avatarId, friendNamedContext?.suggestedName]);

  if (!open) return null;

  const isEdit = mode === "edit";
  const fromFriend = Boolean(!isEdit && friendNamedContext?.suggestedName);
  const cleanName = nameInput.trim().slice(0, 24);

  function handleProfileSubmit(e) {
    e.preventDefault();
    if (!cleanName) {
      nameInputRef.current?.focus();
      return;
    }
    fx("win", [18, 30, 18]);
    if (skipExplainer) {
    }
    onSaveProfile?.({ name: cleanName, avatarId });
    if (isEdit || skipExplainer) {
      onClose?.();
    } else {
      setStage("explainer");
    }
  }

  return (
    <div
      className="pop-modal-overlay"
      style={{ zIndex: 2800 }}
      onMouseDown={e => {
        if (e.target === e.currentTarget && (isEdit || stage === "explainer")) {
          onClose?.();
        }
      }}
    >
      <div className="pop-modal-box">
        {(isEdit || stage === "explainer") && (
          <button type="button" className="pop-modal-close" onClick={onClose} aria-label="Close">
            <X size={18}/>
          </button>
        )}

        {stage === "profile" ? (
          <div className="pop-ready-card pop-zoom-in pop-onboard-card">
            <span className="pop-pill-black">
              {isEdit
                ? "✏️ SWITCH YOUR LOOK"
                : fromFriend
                  ? `👋 ${String(friendNamedContext.friendName || "YOUR FRIEND").toUpperCase()} CALLED YOU`
                  : "⚡ NO LOGIN · 5 SEC"}
            </span>

            {fromFriend ? (
              <>
                <h2 className="pop-onboard-title">
                  Your friend named you “{friendNamedContext.suggestedName}”
                </h2>
                <p className="pop-onboard-sub">
                  Keep it or edit below, then tap a face.
                </p>
              </>
            ) : isEdit ? (
              <>
                <h2 className="pop-onboard-title">Switch your face or name</h2>
                <p className="pop-onboard-sub">
                  Saved on this phone. Change anytime.
                </p>
              </>
            ) : (
              <>
                <h2 className="pop-onboard-title">Who’s playing? 👀</h2>
                <p className="pop-onboard-sub">
                  No signup. Pick a face, drop a name.
                </p>
              </>
            )}

            {/* Live Preview Pill */}
            <div className="pop-profile-preview-pill">
              <HumanAvatarSVG avatarId={avatarId} size={52} />
              <div className="pop-profile-preview-text">
                <strong>{cleanName || "Your Name"}</strong>
                <small>{avatarTapped ? "Looking sharp ⚡" : "Tap a face below 👇"}</small>
              </div>
            </div>

            {/* Step 1: Prominent Avatar Picker */}
            <div className={`pop-avatar-section ${!avatarTapped ? "pop-avatar-spotlight" : "pop-avatar-ready"}`}>
              <div className="pop-row-between" style={{ justifyContent: "center", gap: 8 }}>
                <span className="pop-mini-tag">1. PICK A FACE</span>
                {!avatarTapped && <span className="pop-type-hint">👆 Tap one!</span>}
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
                      setAvatarTapped(true);
                    }}
                    title={av.label}
                  >
                    <HumanAvatarSVG avatarId={av.id} size={42} />
                    {!avatarTapped && avatarId === av.id && (
                      <span className="pop-avatar-pointer" aria-hidden="true">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#14141A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 13V4a1.5 1.5 0 0 1 3 0v5.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-2.5a6 6 0 0 1-4.8-2.4l-3.3-4.4a1.6 1.6 0 0 1 2.4-2.1L9 14.8Z"/><path d="M12 9.5v2M15 10.5v2M18 12v1.5"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Name Input */}
            <form className="pop-stack" style={{ width: "100%" }} onSubmit={handleProfileSubmit}>
              <label className={`pop-field ${avatarTapped && !cleanName ? "pop-highlight-field" : ""}`}>
                <div className="pop-field-head">
                  <span>2. YOUR NAME</span>
                  {fromFriend && (
                    <button
                      type="button"
                      className="pop-change-name-btn"
                      onClick={() => {
                        fx("tap", 10);
                        setNameInput("");
                        setTimeout(() => nameInputRef.current?.focus(), 40);
                      }}
                    >
                      ✏️ Change
                    </button>
                  )}
                </div>
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onFocus={focusScrollCenter}
                  placeholder="Enter your name..."
                  maxLength={24}
                />
              </label>

              <button
                type="submit"
                className={`pop-btn yellow lg full ${cleanName ? "pop-next-glow" : ""}`}
                disabled={!cleanName}
              >
                {isEdit ? "✓ Looks good" : "Let’s go ⚡"}
              </button>
            </form>
          </div>
        ) : (
          /* SCREEN 2: SHORT GEN-Z EXPLAINER — 1 SECOND SCAN, ZERO BORING PARAGRAPHS! */
          <div className="pop-ready-card pop-zoom-in pop-onboard-card">
            <div className="pop-profile-created-chip">
              <HumanAvatarSVG avatarId={avatarId} size={32} />
              <span>Yo <strong>{cleanName || initialProfile?.name || "Friend"}</strong> ⚡</span>
            </div>

            <h2 className="pop-onboard-title">
              {targetLabel ? `Send one to ${targetLabel}?` : "Pick your chaos 🔥"}
            </h2>

            <ModePreviewCards onSelectMode={onSelectMode} />

            <button type="button" className="pop-btn white sm full" onClick={onClose}>
              Just browse Home →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function MainApp() {
  const [tab, setTab] = useState("home"); // "home" | "inbox" | "shelf" | "wall"
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState(""); // "" | "about" | "privacy" | "terms" | "contact"
  const [activeStudioMode, setActiveStudioMode] = useState(""); // "" | "trap" | "vault"

  // Persistent User Profile ({ name, avatarId }) — never auto-changes once picked!
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const p = JSON.parse(safeGetStorage("oddora_profile", "null"));
      if (p && p.name) return { name: String(p.name), avatarId: p.avatarId || "shades" };
    } catch {}
    return null;
  });

  const [onboardState, setOnboardState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hasLink = (params.get("odc") || "").replace(/[^A-Z0-9]/gi, "").length === 6;
    let hasProf = false;
    try {
      const p = JSON.parse(safeGetStorage("oddora_profile", "null"));
      hasProf = Boolean(p && p.name);
    } catch {}
    return {
      open: !hasLink && !hasProf,
      mode: "onboard", // "onboard" | "edit" | "explainer"
      friendNamedContext: null, // { friendName, suggestedName, replyTo }
      pendingWizardMode: ""
    };
  });

  function saveUserProfile(nextProfile) {
    const clean = {
      name: String(nextProfile?.name || "").trim().slice(0, 24),
      avatarId: nextProfile?.avatarId || "shades"
    };
    if (!clean.name) return;
    setUserProfile(clean);
    safeSetStorage("oddora_profile", JSON.stringify(clean));
    if (onboardState.pendingWizardMode) {
      const nextMode = onboardState.pendingWizardMode;
      setOnboardState({ open: false, mode: "onboard", friendNamedContext: null, pendingWizardMode: "" });
      requestAppFullscreen();
      setActiveStudioMode(nextMode);
    }
  }

  function openEditProfile() {
    fx("tap", 12);
    setOnboardState({
      open: true,
      mode: "edit",
      friendNamedContext: null,
      pendingWizardMode: ""
    });
  }
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
  const [openedFromInbox, setOpenedFromInbox] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("all"); // "all" | "trap" | "vault"
  const [homeNotif, setHomeNotif] = useState(null);
  const lastNotifTsRef = useRef({});

  const [pendingCard, setPendingCard] = useState(() => {
    try {
      const p = JSON.parse(safeGetStorage("oddora_pending_card", "null"));
      if (p?.code) {
        const rx = JSON.parse(safeGetStorage(`oddora_rx_${p.code}`, "null")) || {};
        if (rx.outcome === "yes" || Number(rx.vaultStage || 0) >= 3) {
          safeRemoveStorage("oddora_pending_card");
          return null;
        }
      }
      return p;
    } catch { return null; }
  });

  const [myLinks, setMyLinks] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_my_links", "[]")); } catch { return []; }
  });

  const [savedShelf, setSavedShelf] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_treasure_shelf", "[]")); } catch { return []; }
  });

  // Combined 2-way chat messages map per link code + persistent last-read timestamps!
  const [rxMap, setRxMap] = useState({});
  const [txMap, setTxMap] = useState({});
  const [readMap, setReadMap] = useState(() => {
    try { return JSON.parse(safeGetStorage("oddora_read_ts", "{}")); } catch { return {}; }
  });

  const activeThreadCode = odcCode || watchLiveItem?.code || "";
  const activeThreadCodeRef = useRef(activeThreadCode);
  activeThreadCodeRef.current = activeThreadCode;
  const readMapRef = useRef(readMap);
  readMapRef.current = readMap;

  function markThreadRead(code, ts = Date.now()) {
    if (!code) return;
    setReadMap(prev => {
      const nextTs = Math.max(Number(prev[code] || 0), ts);
      if (Number(prev[code] || 0) === nextTs) return prev;
      const updated = { ...prev, [code]: nextTs };
      safeSetStorage("oddora_read_ts", JSON.stringify(updated));
      return updated;
    });
  }

  // Whenever user enters or views a thread (Trap/Vault/WatchLive), immediately mark it as read!
  useEffect(() => {
    if (activeThreadCode) markThreadRead(activeThreadCode, Date.now());
  }, [activeThreadCode]);

  // Sync myLinks & readMap across multiple browser tabs / reloads automatically!
  useEffect(() => {
    const onStorage = e => {
      if (e.key === "oddora_my_links") {
        try {
          const fresh = JSON.parse(safeGetStorage("oddora_my_links", "[]"));
          if (Array.isArray(fresh)) setMyLinks(fresh);
        } catch {}
      } else if (e.key === "oddora_read_ts") {
        try {
          const freshRead = JSON.parse(safeGetStorage("oddora_read_ts", "{}"));
          if (freshRead && typeof freshRead === "object") setReadMap(freshRead);
        } catch {}
      } else if (e.key === "oddora_profile") {
        try {
          const freshProf = JSON.parse(safeGetStorage("oddora_profile", "null"));
          if (freshProf && freshProf.name) setUserProfile(freshProf);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [topCreators, setTopCreators] = useState([
    { id: "t1", name: "Aarav", label: "OD Trap ⚡", count: 42 },
    { id: "t2", name: "Maya", label: "OD Vault 🔐", count: 31 },
    { id: "t3", name: "Rohan", label: "OD Trap ⚡", count: 27 }
  ]);

  function goHome() {
    if (activeThreadCodeRef.current) markThreadRead(activeThreadCodeRef.current, Date.now());
    fx("tap", 12);
    setLogoSpin(false);
    requestAnimationFrame(() => setLogoSpin(true));
    setPickerModalOpen(false);
    setLegalModalTab("");
    setOpenedFromInbox(false);
    setViewingShelfItem(null);
    setWatchLiveItem(null);
    setActiveStudioMode("");
    setOdcCode("");
    setTab("home");
    const u = new URL(window.location.href);
    u.searchParams.delete("odc");
    window.history.replaceState({}, "", u.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }



  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const createCode = (params.get("odc") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (createCode.length === 6) setOdcCode(createCode);
  }, []);

  // Listen to BOTH replies (receiver->sender) AND senderReplies (sender->receiver) for every Inbox thread!
  useEffect(() => {
    if (!myLinks.length) return undefined;
    const unsubs = [];

    myLinks.forEach(linkItem => {
      const code = linkItem.code;
      const isReceiverThread = linkItem.role === "receiver";
      const isV = Boolean(linkItem.isVault || String(linkItem.title || "").toLowerCase().includes("vault"));

      // 1. Receiver replies stream (`replies/${code}`)
      unsubs.push(
        onValue(
          ref(database, `replies/${code}`),
          snap => {
            const raw = snap.exists() ? Object.values(snap.val()) : [];
            const list = raw.map(m => ({
              side: "receiver",
              from: m.from || linkItem.to || "Friend",
              text: m.text || "",
              ts: Number(m.createdAt || m.ts || 0)
            })).filter(m => m.text && !isSystemChatMsg(m.text));

            setRxMap(prev => ({ ...prev, [code]: list }));

            // Notify if I am the SENDER of this link and a brand-new reply arrived while NOT already in that chat!
            if (!isReceiverThread && list.length > 0) {
              const latest = list[list.length - 1];
              const key = `rx_${code}`;
              const prevTs = lastNotifTsRef.current[key];
              if (activeThreadCodeRef.current === code) {
                markThreadRead(code, Math.max(Date.now(), latest.ts));
              } else if (prevTs !== undefined && latest.ts > prevTs && latest.ts > Number(readMapRef.current[code] || 0)) {
                fx("notify", [30, 45, 55]);
                setHomeNotif({
                  title: latest.from || linkItem.to || "Friend",
                  body: latest.text,
                  tag: isV ? "🔐 VAULT" : "⚡ TRAP",
                  avatarId: linkItem.avatarId || "shades",
                  linkItem
                });
                setTimeout(() => setHomeNotif(null), 6500);
              }
              lastNotifTsRef.current[key] = latest.ts;
            } else if (!isReceiverThread && lastNotifTsRef.current[`rx_${code}`] === undefined) {
              lastNotifTsRef.current[`rx_${code}`] = 0;
            }
          },
          () => {}
        )
      );

      // 2. Sender replies stream (`senderReplies/${code}`)
      unsubs.push(
        onValue(
          ref(database, `senderReplies/${code}`),
          snap => {
            const raw = snap.exists() ? Object.values(snap.val()) : [];
            const list = raw.map(m => ({
              side: "sender",
              from: m.from || linkItem.from || "Friend",
              text: m.text || "",
              ts: Number(m.ts || m.createdAt || 0)
            })).filter(m => m.text && !isSystemChatMsg(m.text));

            setTxMap(prev => ({ ...prev, [code]: list }));

            // Notify if I am the RECEIVER of this link (even after exiting Trap/Vault to Home!)
            if (isReceiverThread && list.length > 0) {
              const latest = list[list.length - 1];
              const key = `tx_${code}`;
              const prevTs = lastNotifTsRef.current[key];
              if (activeThreadCodeRef.current === code) {
                markThreadRead(code, Math.max(Date.now(), latest.ts));
              } else if (prevTs !== undefined && latest.ts > prevTs && latest.ts > Number(readMapRef.current[code] || 0)) {
                fx("notify", [30, 45, 55]);
                setHomeNotif({
                  title: latest.from || linkItem.from || "Friend",
                  body: latest.text,
                  tag: isV ? "🔐 VAULT" : "⚡ TRAP",
                  avatarId: linkItem.avatarId || "shades",
                  linkItem
                });
                setTimeout(() => setHomeNotif(null), 6500);
              }
              lastNotifTsRef.current[key] = latest.ts;
            } else if (isReceiverThread && lastNotifTsRef.current[`tx_${code}`] === undefined) {
              lastNotifTsRef.current[`tx_${code}`] = 0;
            }
          },
          () => {}
        )
      );
    });

    return () => unsubs.forEach(fn => fn());
  }, [myLinks]);

  // Scale-safe Top Creators read: fetches only tiny photo-free leaderboard summaries (saves 99%+ Firebase bandwidth!)
  useEffect(() => {
    let alive = true;
    get(query(ref(database, "rooms/lb"), limitToLast(30)))
      .then(snap => {
        if (!alive || !snap.exists()) return;
        const ranked = Object.values(snap.val())
          .filter(item => item && item.name && Number(item.count || 0) > 0)
          .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
          .slice(0, 3)
          .map((item, idx) => ({
            id: item.id || `c-${idx}`,
            name: item.name,
            label: item.type === "vault" ? "OD Vault 🔐" : "OD Trap ⚡",
            count: Number(item.count || 1)
          }));
        if (ranked.length > 0) setTopCreators(ranked);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function handleSavedLink(newItem) {
    setMyLinks(prev => {
      // Merge with latest localStorage in case another tab added a link!
      let base = prev;
      try {
        const stored = JSON.parse(safeGetStorage("oddora_my_links", "[]"));
        if (Array.isArray(stored) && stored.length > prev.length) base = stored;
      } catch {}
      const existing = base.find(x => x.code === newItem.code);
      // Never overwrite a sender's own thread role with receiver if testing in the same browser!
      const merged = existing
        ? { ...existing, ...newItem, role: existing.role === "sender" ? "sender" : (newItem.role || existing.role || "sender") }
        : { role: "sender", ...newItem };
      const updated = [merged, ...base.filter(x => x.code !== newItem.code)].slice(0, 20);
      safeSetStorage("oddora_my_links", JSON.stringify(updated));
      return updated;
    });
    if (newItem?.code && !readMapRef.current[newItem.code]) {
      markThreadRead(newItem.code, Date.now());
    }
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
    setRxMap(prev => { const c = { ...prev }; delete c[codeToRemove]; return c; });
    setTxMap(prev => { const c = { ...prev }; delete c[codeToRemove]; return c; });
    setReadMap(prev => {
      const c = { ...prev };
      delete c[codeToRemove];
      safeSetStorage("oddora_read_ts", JSON.stringify(c));
      return c;
    });
  }

  function openInboxThread(item, fromInboxTab = false) {
    fx("tap", 12);
    setOpenedFromInbox(Boolean(fromInboxTab));
    markThreadRead(item.code, Date.now());
    if (item.role === "receiver") {
      setOdcCode(item.code);
    } else {
      setWatchLiveItem(item);
    }
  }

  function sendAnotherTo(friendName) {
    fx("tap", 12);
    if (friendName) {
      try { window.sessionStorage.setItem("oddora_reply_to", friendName); } catch {}
    }
    setPickerModalOpen(true);
  }

  function launchWizard(modeKey) {
    fx("tap", 14);
    setPickerModalOpen(false);
    if (!userProfile?.name) {
      setOnboardState({
        open: true,
        mode: "onboard",
        friendNamedContext: null,
        pendingWizardMode: modeKey
      });
      return;
    }
    // 1-time fullscreen on active play/create entry (never auto re-enters on camera/WhatsApp return!)
    requestAppFullscreen();
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
        fromInbox={openedFromInbox}
        onRegisterReceived={handleSavedLink}
        onSaveToShelf={handleSaveToShelf}
        onPendingUpdate={cardObj => {
          setPendingCard(cardObj);
          if (cardObj) safeSetStorage("oddora_pending_card", JSON.stringify(cardObj));
          else safeRemoveStorage("oddora_pending_card");
        }}
        onGoHome={(meta) => {
          goHome();
          if (!userProfile?.name && meta?.recipientName && meta.recipientName !== "Your friend" && meta.recipientName !== "You") {
            setOnboardState({
              open: true,
              mode: "onboard",
              friendNamedContext: {
                friendName: meta.creatorName || "Your friend",
                suggestedName: meta.recipientName,
                replyTo: ""
              },
              pendingWizardMode: ""
            });
          } else if (!userProfile?.name) {
            setOnboardState({
              open: true,
              mode: "onboard",
              friendNamedContext: null,
              pendingWizardMode: ""
            });
          }
        }}
        onExit={(creatorName, recipientName, returnMode = "") => {
          const shouldReopenInbox = openedFromInbox && !creatorName && !returnMode;
          if (odcCode) markThreadRead(odcCode, Date.now());
          setOdcCode("");
          setOpenedFromInbox(false);
          const u = new URL(window.location.href);
          u.searchParams.delete("odc");
          window.history.replaceState({}, "", u.toString());

          if (shouldReopenInbox) {
            setTab("inbox");
            return;
          }

          if (creatorName) {
            try { window.sessionStorage.setItem("oddora_reply_to", creatorName); } catch {}
          }

          if (!userProfile?.name) {
            const validSuggested = recipientName && recipientName !== "Your friend" && recipientName !== "You" ? recipientName : "";
            setOnboardState({
              open: true,
              mode: "onboard",
              friendNamedContext: validSuggested
                ? { friendName: creatorName || "Your friend", suggestedName: validSuggested, replyTo: creatorName || "" }
                : null,
              pendingWizardMode: returnMode || ""
            });
            return;
          }

          if (returnMode) {
            requestAppFullscreen();
            setActiveStudioMode(returnMode);
          } else if (creatorName) {
            setPickerModalOpen(true);
          } else {
            setTab("home");
          }
        }}
      />
    );
  }

  // 2. FULL-SCREEN WATCH LIVE RECONNECT (Shows previous Vault/Trap photo & live chat!)
  if (watchLiveItem) {
    return (
      <WatchLiveScreen
        item={watchLiveItem}
        fromInbox={openedFromInbox}
        onGoHome={goHome}
        onBack={() => {
          const shouldReopenInbox = openedFromInbox;
          if (watchLiveItem?.code) markThreadRead(watchLiveItem.code, Date.now());
          fx("tap", 10);
          setWatchLiveItem(null);
          setOpenedFromInbox(false);
          if (shouldReopenInbox) setTab("inbox");
        }}
      />
    );
  }

  // 3. FULL-SCREEN CREATOR WIZARD
  if (activeStudioMode) {
    return (
      <>
        <FullScreenCreatorWizard
          initialMode={activeStudioMode}
          profile={userProfile}
          onEditProfile={openEditProfile}
          onLinkCreated={handleSavedLink}
          onClose={goHome}
        />
        <OnboardingProfileModal
          open={onboardState.open}
          mode={onboardState.mode}
          initialProfile={userProfile}
          friendNamedContext={onboardState.friendNamedContext}
          onSaveProfile={saveUserProfile}
          onSelectMode={m => {
            setOnboardState({ open: false, mode: "onboard", friendNamedContext: null, pendingWizardMode: "" });
            launchWizard(m);
          }}
          onClose={() => setOnboardState({ open: false, mode: "onboard", friendNamedContext: null, pendingWizardMode: "" })}
        />
      </>
    );
  }

  const getThreadMessages = code =>
    [...(rxMap[code] || []), ...(txMap[code] || [])].sort((a, b) => a.ts - b.ts);

  const getUnreadCount = item => {
    const lastRead = Number(readMap[item.code] || 0);
    const incoming = item.role === "receiver" ? (txMap[item.code] || []) : (rxMap[item.code] || []);
    return incoming.filter(m => m.ts > lastRead).length;
  };

  // Header badge shows ONLY the number of unread conversations (disappears cleanly once read!)
  const unreadConvoCount = myLinks.filter(it => getUnreadCount(it) > 0).length;

  return (
    <div className="pop-shell">
      <MobileNotificationBanner
        notif={homeNotif}
        onOpen={() => {
          const target = homeNotif?.linkItem;
          setHomeNotif(null);
          if (target) openInboxThread(target);
          else setTab("inbox");
        }}
        onDismiss={() => setHomeNotif(null)}
      />

      {/* FIXED TOP HEADER — Clean: Logo on Left, ⚡ Create + Circular Avatar on Right! */}
      <header className="pop-header">
        <button type="button" className="pop-brand pop-brand-btn" onClick={goHome}>
          <span className={logoSpin ? "pop-coin spin" : "pop-coin"} onAnimationEnd={() => setLogoSpin(false)}>O</span>
          <span className="pop-brand-title">ODDORA</span>
          <span className="pop-pill-black">DO OD</span>
        </button>

        <div className="pop-header-actions">
          <button
            type="button"
            className="pop-btn yellow sm"
            onClick={() => {
              fx("tap", 12);
              setPickerModalOpen(true);
            }}
          >
            <Zap size={14} strokeWidth={2.7} /> Create
          </button>
          {userProfile?.name && (
            <button
              type="button"
              className="pop-hdr-avatar-btn"
              onClick={openEditProfile}
              title={`${userProfile.name} · Tap to change face or name`}
              aria-label={`Change look for ${userProfile.name}`}
            >
              <HumanAvatarSVG avatarId={userProfile.avatarId} size={34} />
            </button>
          )}
        </div>
      </header>

      <main className="pop-main" id="top">
        {pendingCard && pendingCard.code && (
          <div className="pop-pending-banner">
            <div className="pop-pending-text">
              <strong>⚡ {pendingCard.from || "A friend"} sent you a secret card!</strong>
              <small>Tap to open. No app-hopping.</small>
            </div>
            <div className="pop-pending-actions">
              <button type="button" className="pop-btn yellow sm" onClick={() => { fx("seal", 14); setOdcCode(pendingCard.code); }}>
                🔓 Open
              </button>
              <button type="button" className="pop-btn white sm" onClick={dismissPendingCard} aria-label="Dismiss">✕</button>
            </div>
          </div>
        )}

        {/* TAB 1: HOME (Hero + 3-Card Fan + Choose Your Move + Scrollable Footer) */}
        {tab === "home" && (
          <>
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
                  Trap a friend. Lock a secret. Watch it live.
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
                  <p>The “No” button talks trash &amp; dodges until they give in.</p>
                </button>

                <button type="button" className="pop-subcat-card gold-card" onClick={() => launchWizard("vault")}>
                  <div className="pop-subcat-top">
                    <span className="pop-pill-black">2-LOCK SECRET</span>
                    <ArrowRight size={18}/>
                  </div>
                  <PopCharacterArt variant="vault" />
                  <h3>🔐 OD - Vault</h3>
                  <p>Hide a note or selfie behind 2 puzzles + PIN.</p>
                </button>
              </div>
            </section>
          </>
        )}

        {/* TAB 2: FULL-PAGE APP-STYLE INBOX */}
        {tab === "inbox" && (() => {
          const isItemVault = it => Boolean(it.isVault || String(it.title || "").toLowerCase().includes("vault"));
          const trapCount = myLinks.filter(it => !isItemVault(it)).length;
          const vaultCount = myLinks.filter(it => isItemVault(it)).length;
          const filteredLinks = myLinks.filter(it =>
            inboxFilter === "all" ? true : inboxFilter === "vault" ? isItemVault(it) : !isItemVault(it)
          );
          return (
            <section className="pop-box pop-inbox-page">
              <div className="pop-box-head">
                <span>📬 INBOX</span>
                <span className="pop-pill-black">LIVE CHATS</span>
              </div>

              <div className="pop-inbox-tabs">
                <button
                  type="button"
                  className={inboxFilter === "all" ? "pop-itab active" : "pop-itab"}
                  onClick={() => { fx("tap", 10); setInboxFilter("all"); }}
                >
                  All ({myLinks.length})
                </button>
                <button
                  type="button"
                  className={inboxFilter === "trap" ? "pop-itab active lime" : "pop-itab"}
                  onClick={() => { fx("tap", 10); setInboxFilter("trap"); }}
                >
                  ⚡ Traps ({trapCount})
                </button>
                <button
                  type="button"
                  className={inboxFilter === "vault" ? "pop-itab active gold" : "pop-itab"}
                  onClick={() => { fx("tap", 10); setInboxFilter("vault"); }}
                >
                  🔐 Vaults ({vaultCount})
                </button>
              </div>

              {filteredLinks.length === 0 ? (
                <div className="pop-empty-state">
                  <p className="pop-muted">
                    {myLinks.length === 0
                      ? "Send a link. Chats show up here 👀"
                      : `No ${inboxFilter === "vault" ? "Vault" : "Trap"} threads yet.`}
                  </p>
                  <button type="button" className="pop-btn yellow sm" onClick={() => { fx("tap", 12); setPickerModalOpen(true); }}>
                    <Zap size={14} strokeWidth={2.7} /> Create First Link
                  </button>
                </div>
              ) : (
                <div className="pop-inbox-list pop-inbox-list-full">
                  {filteredLinks.map(item => {
                    const list = getThreadMessages(item.code);
                    const unreadCount = getUnreadCount(item);
                    const latest = list.length > 0 ? list[list.length - 1] : null;
                    const isV = isItemVault(item);
                    const isRx = item.role === "receiver";
                    const partnerName = isRx ? (item.from || "Friend") : (item.to || "Friend");
                    const latestIsMe = latest && ((isRx && latest.side === "receiver") || (!isRx && latest.side === "sender"));
                    return (
                      <div
                        className={`pop-dm-row ${isV ? "vault-row" : "trap-row"} ${unreadCount > 0 ? "has-unread" : ""}`}
                        key={item.code}
                        onClick={() => openInboxThread(item, true)}
                      >
                        <div className="pop-dm-avatar-wrap">
                          <HumanAvatarSVG avatarId={item.avatarId || "shades"} size={42} />
                          <span className={`pop-dm-type-dot ${isV ? "vault" : "trap"}`}>
                            {isV ? "🔐" : "⚡"}
                          </span>
                        </div>

                        <div className="pop-dm-body">
                          <div className="pop-dm-top">
                            <strong>{partnerName}</strong>
                            <span className={`pop-dm-tag ${isV ? "vault" : "trap"}`}>
                              {isRx ? (isV ? "FROM · VAULT" : "FROM · TRAP") : (isV ? "VAULT" : "TRAP")}
                            </span>
                          </div>
                          <div className="pop-dm-subject">{item.title}</div>
                          <div className="pop-dm-preview">
                            {latest
                              ? (latestIsMe ? `You: ${latest.text}` : `💬 ${latest.text}`)
                              : (isRx ? "✨ Tap to view & chat" : "📡 Tap to open Live Feed")}
                          </div>
                        </div>

                        <div className="pop-dm-right" onClick={e => e.stopPropagation()}>
                          {unreadCount > 0 && <span className="pop-dm-count">{unreadCount}</span>}
                          <div className="pop-dm-mini-actions">
                            <button
                              type="button"
                              className="pop-dm-ico-btn yellow"
                              title={`Send new to ${partnerName}`}
                              onClick={() => sendAnotherTo(partnerName)}
                            >
                              <Zap size={12}/>
                            </button>
                            <button
                              type="button"
                              className="pop-dm-ico-btn"
                              title="Delete thread"
                              onClick={() => deleteInboxItem(item.code)}
                            >
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* TAB 3: LOCAL TREASURE SHELF (Tap any memory to open Full-Screen Viewer!) */}
        {tab === "shelf" && (
          <section className="pop-box">
            <div className="pop-box-head">
              <span>🔐 MY TREASURE SHELF</span>
              <span className="pop-pill-black">PRIVATE · ON-DEVICE</span>
            </div>
            {savedShelf.length === 0 ? (
              <div className="pop-empty-state">
                <p className="pop-muted">
                  Saved secrets live here. Only you can see 🔐
                </p>
                <button type="button" className="pop-btn yellow sm" onClick={() => launchWizard("vault")}>
                  🔐 Lock a Vault
                </button>
              </div>
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

        {/* TAB 4: LIVE FLEX WALL + TOP CREATORS TODAY */}
        {tab === "wall" && (
          <>
            <FlexWall topCreators={topCreators} />
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
          </>
        )}
      </main>

      {/* SCROLLABLE LEGAL & FEEDBACK FOOTER (Always sits cleanly above sticky bottom bar!) */}
      <footer className="pop-footer">
        <div className="pop-footer-top">
          <strong>⚡ ODDORA · DO OD</strong>
          <span>Made for DMs, dares &amp; secrets.</span>
        </div>
        <div className="pop-footer-links">
          <button type="button" className="pop-footer-link" onClick={() => { fx("tap", 10); setLegalModalTab("about"); }}>
            About
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" className="pop-footer-link" onClick={() => { fx("tap", 10); setLegalModalTab("privacy"); }}>
            Privacy
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" className="pop-footer-link" onClick={() => { fx("tap", 10); setLegalModalTab("terms"); }}>
            Terms
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" className="pop-footer-link highlight" onClick={() => { fx("tap", 10); setLegalModalTab("contact"); }}>
            💬 Feedback / Contact
          </button>
        </div>
      </footer>

      {/* FIXED 4-TAB STICKY BOTTOM BAR (Home · Inbox · Shelf · Flex) */}
      <nav className="pop-bottom-bar" aria-label="Bottom Navigation">
        <div className="pop-bottom-bar-inner">
          <button
            type="button"
            className={tab === "home" ? "pop-bbar-btn active" : "pop-bbar-btn"}
            onClick={() => { fx("tap", 10); setTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <Zap size={19} strokeWidth={2.5} />
            <span>Home</span>
          </button>

          <button
            type="button"
            className={tab === "inbox" ? "pop-bbar-btn active" : "pop-bbar-btn"}
            onClick={() => { fx("tap", 10); setTab("inbox"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <span className="pop-bbar-ico-wrap">
              <Inbox size={19} strokeWidth={2.5} />
              {unreadConvoCount > 0 && <span className="pop-bbar-badge">{unreadConvoCount}</span>}
            </span>
            <span>Inbox</span>
          </button>

          <button
            type="button"
            className={tab === "shelf" ? "pop-bbar-btn active" : "pop-bbar-btn"}
            onClick={() => { fx("tap", 10); setTab("shelf"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <Lock size={19} strokeWidth={2.5} />
            <span>Shelf</span>
          </button>

          <button
            type="button"
            className={tab === "wall" ? "pop-bbar-btn active" : "pop-bbar-btn"}
            onClick={() => { fx("tap", 10); setTab("wall"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <Flame size={19} strokeWidth={2.5} />
            <span>Flex</span>
          </button>
        </div>
      </nav>

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

      {/* ANIMATED MODE PICKER MODAL (Top ⚡ Create Button!) */}
      {pickerModalOpen && (
        <div className="pop-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPickerModalOpen(false); }}>
          <div className="pop-modal-box">
            <button type="button" className="pop-modal-close" onClick={() => setPickerModalOpen(false)} aria-label="Close">
              <X size={18}/>
            </button>
            <div className="pop-ready-card pop-zoom-in pop-onboard-card">
              <span className="pop-pill-black">⚡ ODDORA · CREATE</span>
              <h2 className="pop-onboard-title">Pick your chaos 🔥</h2>
              <ModePreviewCards onSelectMode={m => launchWizard(m)} />
            </div>
          </div>
        </div>
      )}

      {/* FIRST-TIME PROFILE SETUP + 2-LINE EXPLAINER MODAL */}
      <OnboardingProfileModal
        open={onboardState.open}
        mode={onboardState.mode}
        initialProfile={userProfile}
        friendNamedContext={onboardState.friendNamedContext}
        targetLabel={onboardState.friendNamedContext?.replyTo || ""}
        skipExplainer={Boolean(onboardState.pendingWizardMode)}
        onSaveProfile={saveUserProfile}
        onSelectMode={m => {
          const replyTarget = onboardState.friendNamedContext?.replyTo || "";
          if (replyTarget) {
            try { window.sessionStorage.setItem("oddora_reply_to", replyTarget); } catch {}
          }
          setOnboardState({ open: false, mode: "onboard", friendNamedContext: null, pendingWizardMode: "" });
          requestAppFullscreen();
          setActiveStudioMode(m);
        }}
        onClose={() => setOnboardState({ open: false, mode: "onboard", friendNamedContext: null, pendingWizardMode: "" })}
      />

      {/* ABOUT, PRIVACY, TERMS & FEEDBACK MODAL */}
      <InfoLegalModal
        activeTab={legalModalTab}
        defaultName={userProfile?.name || ""}
        onSwitchTab={setLegalModalTab}
        onClose={() => setLegalModalTab("")}
      />
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
function FullScreenCreatorWizard({ initialMode = "trap", profile, onEditProfile, onLinkCreated, onClose }) {
  const [mode] = useState(initialMode); // "trap" | "vault"
  const [step, setStep] = useState(0); // 0 -> 1 -> 2
  const [burstKey, setBurstKey] = useState(1); // Intro bubble burst right on open!
  const [busy, setBusy] = useState(false);
  const [liveCode, setLiveCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const avatarId = profile?.avatarId || "shades";
  const senderName = profile?.name || "";
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
  const [trapBgImage, setTrapBgImage] = useState("");
  const [trapCrop, setTrapCrop] = useState({ posX: 50, posY: 20, zoom: 1, fit: "cover" });
  const [previewTab, setPreviewTab] = useState("ask"); // "ask" | "reveal"

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

  // Guided spotlight on Screen 1: Target Friend's Name -> Question / Secret -> Next!
  const activeStep0 = !recipientName.trim()
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

  // Live grey letter-by-letter typewriter samples (idle fields show subtle prompts so they never look pre-filled!)
  const recipientPlaceholder = useTypewriter("Alex", step === 0 && activeStep0 === "recipient", "Friend's name...");
  const mainPlaceholder = useTypewriter(
    mode === "trap" ? "Coffee tonight?" : "Don't tell anyone...",
    step === 0 && activeStep0 === "main",
    mode === "trap" ? "Type your question..." : "Write your secret..."
  );
  const yesBtnPlaceholder = useTypewriter("Yes, locked in ⚡", step === 1 && mode === "trap" && activeStep1 === "yesBtn", "Edit YES text...");
  const noBtnPlaceholder = useTypewriter("No way", step === 1 && mode === "trap" && activeStep1 === "noBtn", "Edit NO text...");
  const yesMsgPlaceholder = useTypewriter(smartTrapOut, step === 1 && mode === "trap" && activeStep1 === "yesMsg", "Reveal message...");

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

  async function handlePhotoUpload(e, target = "vault") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const compressed = await compressImageFile(file, 680, 0.72);
      if (target === "trap") { setTrapBgImage(compressed); setTrapCrop({ posX: 50, posY: 20, zoom: 1, fit: "cover" }); }
      else setSecretImage(compressed);
      fx("pop", 14);
    } catch {
      alert("Can't read that pic 😅 Try another.");
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
            bgImage: trapBgImage || "",
            bgPosX: trapCrop.posX,
            bgPosY: trapCrop.posY,
            bgZoom: trapCrop.zoom,
            bgFit: trapCrop.fit,
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
        role: "sender",
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
      alert("No signal 📡 Check your internet.");
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

            {/* Locked-in User Profile Strip (never changes unless user clicks Change!) */}
            <div className="pop-locked-profile-bar">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <HumanAvatarSVG avatarId={avatarId} size={36} />
                <div style={{ textAlign: "left", display: "grid", gap: 1 }}>
                  <small className="pop-mini-tag">SENDING AS</small>
                  <strong style={{ fontSize: 14 }}>{senderName || "You"}</strong>
                </div>
              </div>
              <button type="button" className="pop-btn white sm" onClick={onEditProfile}>
                ✏️ Change
              </button>
            </div>

            {/* Primary Focus: Enter the friend's name to Trap / send Vault to */}
            <label className={`pop-field ${activeStep0 === "recipient" ? "pop-highlight-field" : ""}`}>
              <div className="pop-field-head">
                <span>{mode === "trap" ? "WHO DO YOU WANT TO TRAP?" : "WHO IS THIS VAULT FOR?"}</span>
                {activeStep0 === "recipient" && <span className="pop-step-tip">✏️ Enter friend's name</span>}
              </div>
              <input
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                onFocus={focusScrollCenter}
                placeholder={recipientPlaceholder}
                maxLength={24}
              />
            </label>

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
                  <div className="pop-field-head">
                    <span>YOUR QUESTION</span>
                    {activeStep0 === "main" && <span className="pop-step-tip">✏️ Ask your trap question</span>}
                  </div>
                  <input
                    value={questionInput}
                    onChange={e => setQuestionInput(e.target.value)}
                    onFocus={focusScrollCenter}
                    placeholder={mainPlaceholder}
                    maxLength={120}
                  />
                </label>

                <div className="pop-upload-row">
                  <div className="pop-grid-2">
                    <label className="pop-btn white sm full" style={{ cursor: "pointer" }}>
                      <Camera size={14}/> {uploadingImg ? "..." : "📸 Snap Photo"}
                      <input type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e, "trap")} style={{ display: "none" }} />
                    </label>
                    <label className="pop-btn white sm full" style={{ cursor: "pointer" }}>
                      <ImageIcon size={14}/> {uploadingImg ? "..." : "🖼️ Bg Photo"}
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, "trap")} style={{ display: "none" }} />
                    </label>
                  </div>
                  {trapBgImage && (
                    <TrapPhotoCropper
                      src={trapBgImage}
                      posX={trapCrop.posX}
                      posY={trapCrop.posY}
                      zoom={trapCrop.zoom}
                      fit={trapCrop.fit}
                      onChange={patch => setTrapCrop(prev => ({ ...prev, ...patch }))}
                      onRemove={() => setTrapBgImage("")}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <label className={`pop-field ${activeStep0 === "main" ? "pop-highlight-field" : ""}`}>
                  <div className="pop-field-head">
                    <span>SECRET MESSAGE (TEXT)</span>
                    {activeStep0 === "main" && <span className="pop-step-tip">✏️ Write your secret</span>}
                  </div>
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
              Next: Preview & Lock <ArrowRight size={16}/>
            </button>
          </div>
        )}

        {/* SCREEN 2 (2 OF 2): LIVE MINI PREVIEW CARD + CUSTOMIZE */}
        {step === 1 && (
          <div className="pop-wizard-card pop-zoom-in" style={{ width: "100%" }} key="w-1">
            {mode === "trap" ? (
              <div className="pop-mini-preview-wrap">
                <div className="pop-row-between">
                  <span className="pop-mini-tag">👀 LIVE RECEIVER PREVIEW</span>
                  <div className="pop-preview-tabs">
                    <button type="button" className={previewTab === "ask" ? "pop-ptab active" : "pop-ptab"} onClick={() => setPreviewTab("ask")}>
                      Question
                    </button>
                    <button type="button" className={previewTab === "reveal" ? "pop-ptab active" : "pop-ptab"} onClick={() => setPreviewTab("reveal")}>
                      After YES
                    </button>
                  </div>
                </div>

                <div
                  className={`pop-mini-preview-card theme-${cardColor} ${previewTab === "reveal" && trapBgImage ? "has-bg" : ""}`}
                  style={
                    previewTab === "reveal" && trapBgImage
                      ? {
                          backgroundImage: `linear-gradient(rgba(14,14,20,0.56), rgba(14,14,20,0.74)), url(${trapBgImage})`,
                          backgroundPosition: `${trapCrop.posX}% ${trapCrop.posY}%`
                        }
                      : undefined
                  }
                >
                  {previewTab === "ask" ? (
                    <>
                      {trapBgImage && (
                        <div className="pop-mini-photo-box">
                          <img
                            src={trapBgImage}
                            alt="Preview"
                            style={{
                              objectFit: trapCrop.fit,
                              objectPosition: `${trapCrop.posX}% ${trapCrop.posY}%`,
                              transform: trapCrop.fit === "cover" ? `scale(${trapCrop.zoom})` : "none",
                              transformOrigin: `${trapCrop.posX}% ${trapCrop.posY}%`
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <HumanAvatarSVG avatarId={avatarId} size={32} />
                        <span className="pop-pill-black">FOR {String(recipientName.trim() || "FRIEND").toUpperCase()}</span>
                      </div>
                      <div className="pop-mini-q">{effectiveQ}</div>
                      <div className="pop-mini-btns">
                        <span className={`pop-btn lime sm ${activeStep1 === "yesBtn" ? "pop-sync-pulse" : ""}`}>
                          {yesLabelInput.trim() || "Yes, locked in ⚡"}
                        </span>
                        <span className={`pop-btn pink sm ${activeStep1 === "noBtn" ? "pop-sync-pulse" : ""}`}>
                          {noLabelInput.trim() || "No"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <HumanAvatarSVG avatarId={avatarId} size={40} />
                      <span className="pop-pill-black">🎉 LOCKED IN</span>
                      <div className={`pop-mini-reveal ${activeStep1 === "yesMsg" ? "pop-sync-pulse" : ""}`}>
                        “{yesMsgInput.trim() || smartTrapOut}”
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="pop-pinned-q" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HumanAvatarSVG avatarId={avatarId} size={30} />
                <span>{secretImage ? "📸 Photo + Secret Note locked" : `“${secretText.trim() || "Secret Vault"}”`}</span>
              </div>
            )}

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
                    <div className="pop-field-head">
                      <span>YES BUTTON TEXT</span>
                      {activeStep1 === "yesBtn" && <span className="pop-step-tip">✏️ Green button text</span>}
                    </div>
                    <input className="pop-dashed-input" value={yesLabelInput} onChange={e => setYesLabelInput(e.target.value)} onFocus={e => { setPreviewTab("ask"); focusScrollCenter(e); }} placeholder={yesBtnPlaceholder} maxLength={28} />
                  </label>
                  <label className={`pop-field ${activeStep1 === "noBtn" ? "pop-highlight-field" : ""}`}>
                    <div className="pop-field-head">
                      <span>NO BUTTON TEXT</span>
                      {activeStep1 === "noBtn" && <span className="pop-step-tip">✏️ Runaway button text</span>}
                    </div>
                    <input className="pop-dashed-input" value={noLabelInput} onChange={e => setNoLabelInput(e.target.value)} onFocus={e => { setPreviewTab("ask"); focusScrollCenter(e); }} placeholder={noBtnPlaceholder} maxLength={28} />
                  </label>
                </div>
                <label className={`pop-field ${activeStep1 === "yesMsg" ? "pop-highlight-field" : ""}`}>
                  <div className="pop-field-head">
                    <span>REVEAL MESSAGE AFTER YES</span>
                    {activeStep1 === "yesMsg" && <span className="pop-step-tip">✏️ Shows after YES</span>}
                  </div>
                  <input className="pop-dashed-input" value={yesMsgInput} onChange={e => setYesMsgInput(e.target.value)} onFocus={e => { setPreviewTab("reveal"); focusScrollCenter(e); }} placeholder={yesMsgPlaceholder} maxLength={240} />
                </label>
              </div>
            ) : (
              <div className="pop-live-preview-box">
                <div className="pop-inner-box" style={{ textAlign: "left" }}>
                  <span className="pop-mini-tag">🔒 PRIVACY & ACCESS</span>
                  <small className="pop-muted">
                    Only you & {recipientName.trim() || "your friend"} can open this.
                  </small>

                  <label className="pop-field">
                    <span>OPTIONAL 4-DIGIT PIN</span>
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
              <button type="button" className={`pop-btn lime ${mode === "trap" && activeStep1 === "ready" ? "pop-next-glow" : ""}`} onClick={publishLink} disabled={busy}>
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
            <h2>Drop this link to {recipientName || "your friend"}!</h2>

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
                setTrapBgImage("");
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
function FullScreenODRecipient({ code, fromInbox = false, onRegisterReceived, onSaveToShelf, onPendingUpdate, onGoHome, onExit }) {
  const [data, setData] = useState(null);
  const [myUid, setMyUid] = useState("");
  const savedRx = (() => {
    try { return JSON.parse(safeGetStorage(`oddora_rx_${code}`, "null")) || {}; } catch { return {}; }
  })();

  const alreadyDone = Boolean(savedRx.outcome === "yes" || Number(savedRx.vaultStage || 0) >= 3);
  const [loading, setLoading] = useState(true);
  const [sealed, setSealed] = useState(savedRx.sealed !== undefined ? Boolean(savedRx.sealed) : true);
  const [burstKey, setBurstKey] = useState(alreadyDone ? 0 : 1);
  const [alreadyDecidedCloud, setAlreadyDecidedCloud] = useState(alreadyDone);
  const [previewPoster, setPreviewPoster] = useState(null);

  // Trap state (resumes on reopen — synced with Firebase for iOS in-app browsers!)
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
  const [decryptSpots] = useState(() => {
    const spots = [
      { left: "26%", top: "30%" },
      { left: "73%", top: "70%" },
      { left: "72%", top: "32%" },
      { left: "28%", top: "70%" }
    ];
    for (let i = spots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    return spots;
  });

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
  const [liveSenderNotif, setLiveSenderNotif] = useState(null);
  const knownSenderCountRef = useRef(-1);
  const rxChatInputRef = useRef(null);
  const pinChatInputRef = useRef(null);

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

  const deviceIdRef = useRef(getDeviceId());
  const registeredRef = useRef(false);
  const justUnlockedInSessionRef = useRef(false);
  const isViewingActiveChatRef = useRef(false);
  isViewingActiveChatRef.current = Boolean(outcome === "yes" || vaultStage >= 2);

  useEffect(() => {
    let alive = true;
    let resolvedUid = "";
    signInPlayer()
      .then(cred => {
        if (!alive) return;
        resolvedUid = cred?.user?.uid || "";
        if (resolvedUid) setMyUid(resolvedUid);
      })
      .catch(() => {});

    const unsub = onValue(
      ref(database, `creations/${code}`),
      snap => {
        if (!alive) return;
        if (!snap.exists()) {
          setData(null);
          setLoading(false);
          return;
        }
        const val = snap.val();
        setData(val);
        const isV = val.type === "vault";
        const uid = resolvedUid || myUid || "";
        const devId = deviceIdRef.current;

        // Trap single-open / iOS reopen check: if resolution OR yesCount > 0, it's ALREADY REVEALED!
        const cloudTrapDone = !isV && (val.resolution?.outcome === "yes" || Number(val.yesCount || 0) > 0);

        // Vault single-open check: only original unlocker (same device/uid) or sender can see unlocked vault!
        const vaultOpenedInCloud = isV && (Boolean(val.resolution?.unlocked) || Boolean(val.receiverUid) || Number(val.yesCount || 0) > 0);
        const isVaultOwnerOrUnlocker =
          Boolean(val.resolution?.unlockedByDevice && val.resolution.unlockedByDevice === devId) ||
          Number(savedRx.vaultStage || 0) >= 3 ||
          Boolean(uid && (val.receiverUid === uid || val.senderUid === uid));

        if (cloudTrapDone) {
          setSealed(false);
          setOutcome("yes");
          setDodges(Number(val.resolution?.dodges ?? savedRx.dodges ?? 0));
          if (!justUnlockedInSessionRef.current) {
            setBurstKey(0);
            setAlreadyDecidedCloud(true);
          }
          onPendingUpdate?.(null);
        } else if (vaultOpenedInCloud && isVaultOwnerOrUnlocker) {
          setSealed(false);
          setVaultStage(3);
          setOutcome("yes");
          if (!justUnlockedInSessionRef.current) {
            setBurstKey(0);
            setAlreadyDecidedCloud(true);
          }
          onPendingUpdate?.(null);
        } else if (vaultOpenedInCloud && !isVaultOwnerOrUnlocker) {
          onPendingUpdate?.(null);
        } else if (alreadyDone) {
          onPendingUpdate?.(null);
        } else {
          onPendingUpdate?.({
            code,
            from: val.creatorName || "A friend",
            title: isV ? "🔐 Secret Vault" : val.payload?.title
          });
        }

        // Register in Receiver's Inbox only if this viewer is allowed to access it (never register a locked-out vault!)
        if (!registeredRef.current && !(vaultOpenedInCloud && !isVaultOwnerOrUnlocker)) {
          registeredRef.current = true;
          onRegisterReceived?.({
            code,
            role: "receiver",
            from: val.creatorName || "Friend",
            to: val.recipientName || "You",
            avatarId: val.avatarId || "shades",
            theme: val.theme || (isV ? "gold" : "lime"),
            isVault: isV,
            title: isV ? "🔐 Secret Vault" : (val.payload?.title || "⚡ OD - Trap"),
            createdAt: val.createdAt || Date.now()
          });
        }
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [code]);

  useEffect(() => {
    if (!code) return undefined;
    return onValue(
      ref(database, `senderReplies/${code}`),
      snap => {
        const list = snap.exists() ? Object.values(snap.val()) : [];
        if (knownSenderCountRef.current !== -1 && list.length > knownSenderCountRef.current && list.length > 0) {
          const latest = list[list.length - 1];
          if (isViewingActiveChatRef.current) {
            // Already looking at live chat — play gentle chime & let ChatHistoryBox auto-scroll cleanly!
            fx("notify", [18, 25]);
          } else {
            fx("notify", [30, 45, 55]);
            setLiveSenderNotif({
              title: latest.from || "Friend",
              body: latest.text,
              tag: "LIVE CHAT",
              avatarId: data?.avatarId || "shades"
            });
            setTimeout(() => setLiveSenderNotif(null), 8000);
          }
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

  const vaultAlreadyOpenedCloud =
    isVault && (Boolean(data.resolution?.unlocked) || Boolean(data.receiverUid) || Number(data.yesCount || 0) > 0);

  const isAuthorizedVaultViewer =
    vaultStage >= 3 ||
    Number(savedRx.vaultStage || 0) >= 3 ||
    Boolean(data.resolution?.unlockedByDevice && data.resolution.unlockedByDevice === deviceIdRef.current) ||
    Boolean(myUid && (data.receiverUid === myUid || data.senderUid === myUid));

  const isLockedToOther = vaultAlreadyOpenedCloud && !isAuthorizedVaultViewer;

  if (isLockedToOther) {
    return (
      <div className={`pop-fs-stage theme-${cardTheme}`}>
        <div className="pop-seal-card pop-zoom-in" style={{ maxWidth: 380 }}>
          <HumanAvatarSVG avatarId={data.avatarId} size={70} />
          <span className="pop-pill-black">🔒 VAULT ALREADY OPENED</span>
          <h2>Already Opened! 🔐</h2>
          <p className="pop-fs-sub">
            Too late! Someone already cracked {data.creatorName}’s vault 🔒
          </p>
          <button
            type="button"
            className="pop-btn yellow full"
            onClick={() => {
              fx("tap", 14);
              onExit("", "", "vault");
            }}
          >
            🔐 Lock Your Own Vault
          </button>
        </div>
      </div>
    );
  }

  /* ---- TRAP HANDLERS (Strict Safe-Zone Jump — Zero Overlap & Never Disappears!) ---- */
  const maxDodges = Math.min(4, data?.payload?.maxDodges || 4);
  const converted = dodges >= maxDodges;
  const trapTitleText = String(data?.payload?.title || "");
  const trapNoText = String(data?.payload?.noLabel || "").trim();
  const titleIsTa = isTamilOrTanglish(trapTitleText);
  const titleIsEn = !titleIsTa && isLikelyEnglish(trapTitleText);
  const isTrapTa = !isVault && (titleIsTa || (!titleIsEn && isTamilOrTanglish(trapNoText)));
  const isTrapEn = !isVault && !isTrapTa && (titleIsEn || isLikelyEnglish(trapNoText) || /^(no|no way|nope|nah|never)$/i.test(trapNoText));
  const talkingList = isTrapTa
    ? TALKING_NO_TA
    : isTrapEn
      ? TALKING_NO_EN
      : [data?.payload?.noLabel || "No"];

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
    justUnlockedInSessionRef.current = true;
    setAlreadyDecidedCloud(false);
    triggerBurst();
    fx("win", [25, 40, 25]);
    setOutcome("yes");
    setNoPos(null);
    onPendingUpdate?.(null);
    const isInstant = dodges === 0 && !forcedByDodge;
    const finalDodges = dodges;
    const alreadyResolved = Boolean(data?.resolution?.outcome === "yes");
    pushLiveEvent(
      isInstant
        ? `⚡ ${who} didn't even hesitate — INSTANT YES!`
        : `🎉 ${who} gave in after ${finalDodges} dodges & said YES!`
    );
    const resolutionPayload = {
      outcome: "yes",
      dodges: finalDodges,
      instant: isInstant,
      byDevice: deviceIdRef.current,
      byUid: myUid || "",
      decidedAt: Date.now()
    };
    const commitTrap = uidVal => {
      set(ref(database, `creations/${code}/resolution`), {
        ...resolutionPayload,
        byUid: uidVal || myUid || ""
      }).catch(() => {});
      if (!alreadyResolved) {
        runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
        const lbKey = String(data?.creatorName || "Creator").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) || code;
        runTransaction(ref(database, `rooms/lb/${lbKey}`), cur => ({
          id: lbKey,
          name: data?.creatorName || "Creator",
          type: "invite",
          count: Number(cur?.count || 0) + 1,
          ts: Date.now()
        })).catch(() => {});
      }
    };
    if (myUid) commitTrap(myUid);
    else signInPlayer().then(c => commitTrap(c?.user?.uid || "")).catch(() => commitTrap(""));
  }

  /* ---- VAULT HANDLERS ---- */
  function completeVaultUnlock() {
    justUnlockedInSessionRef.current = true;
    setAlreadyDecidedCloud(false);
    triggerBurst();
    fx("win", [25, 40, 25]);
    setVaultStage(3);
    setOutcome("yes");
    onPendingUpdate?.(null);
    const alreadyUnlocked = Boolean(data?.resolution?.unlocked);
    pushLiveEvent(`🔓 ${who} unlocked your Secret Vault!`);
    const commitVault = uidVal => {
      const activeUid = uidVal || myUid || "";
      if (!alreadyUnlocked) {
        runTransaction(ref(database, `creations/${code}/yesCount`), c => (Number(c || 0) + 1)).catch(() => {});
        const lbKey = String(data?.creatorName || "Creator").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) || code;
        runTransaction(ref(database, `rooms/lb/${lbKey}`), cur => ({
          id: lbKey,
          name: data?.creatorName || "Creator",
          type: "vault",
          count: Number(cur?.count || 0) + 1,
          ts: Date.now()
        })).catch(() => {});
      }
      if (activeUid && !data.receiverUid && activeUid !== data.senderUid) {
        set(ref(database, `creations/${code}/receiverUid`), activeUid).catch(() => {});
      }
      if (data.payload?.autoDelete) {
        setTimeout(() => { remove(ref(database, `creations/${code}`)).catch(() => {}); }, 4000);
      } else {
        set(ref(database, `creations/${code}/resolution`), {
          unlocked: true,
          unlockedByDevice: deviceIdRef.current,
          unlockedByUid: activeUid,
          unlockedAt: Date.now()
        }).catch(() => {});
      }
    };
    if (myUid) commitVault(myUid);
    else signInPlayer().then(c => commitVault(c?.user?.uid || "")).catch(() => commitVault(""));
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
    pushLiveEvent(`📸 ${who} shared the status flex card!`);
    await sharePosterWithLink({
      posterArgs: isVaultTeaser
        ? {
            kicker: "OFFICIAL RESULT",
            topLine: "VAULT",
            bigWord: "CRACKED!",
            challengeLabel: "OD - VAULT CHALLENGE",
            noteLine1: `Broke ${String(data.creatorName || "a").slice(0, 10)}'s`,
            noteLine2: "secret vault",
            bigStat: "2/2",
            highlightPrefix: "...secret stays",
            highlightWord: "SAFE! 🤫",
            roastLine1: "CERTIFIED",
            roastLine2: "VAULT BREAKER 🔓",
            statLeft: "IQ: 200",
            statRight: "Stealth: 100%",
            ctaLine: "CAN YOU CRACK IT? 👀",
            actorName: `${data.creatorName} ⚡ ${who}`,
            avatarId: data.avatarId || "shades",
            cardColor: cardTheme
          }
        : dodges === 0
          ? {
              kicker: "OFFICIAL RESULT",
              topLine: "ZERO",
              bigWord: "HESITATION!",
              challengeLabel: "OD - TRAP CHALLENGE",
              noteLine1: "Didn't even touch",
              noteLine2: "the NO button",
              bigStat: "0x",
              highlightPrefix: "...straight up said",
              highlightWord: "YES!",
              roastLine1: "CERTIFIED",
              roastLine2: "FASTEST YES ⚡",
              statLeft: "Loyalty: 100%",
              statRight: "Speed: 0.2s",
              ctaLine: "I DID IT. YOUR TURN! 👀",
              actorName: `${data.creatorName} ⚡ ${who}`,
              avatarId: data.avatarId || "shades",
              cardColor: cardTheme
            }
          : {
              kicker: "OFFICIAL RESULT",
              topLine: "YOU GOT",
              bigWord: "TRAPPED!",
              challengeLabel: "OD - TRAP CHALLENGE",
              noteLine1: "You dodged the",
              noteLine2: "NO button",
              bigStat: `${dodges}x`,
              highlightPrefix: "...but still said",
              highlightWord: "YES!",
              roastLine1: "CERTIFIED",
              roastLine2: "EASY TARGET 😂",
              statLeft: "Skill: 0/100",
              statRight: "Chaos: 100%",
              ctaLine: "I DID IT. YOUR TURN! 👀",
              actorName: `${data.creatorName} ⚡ ${who}`,
              avatarId: data.avatarId || "shades",
              cardColor: cardTheme
            },
      caption: isVaultTeaser
        ? `I just cracked ${data.creatorName}'s Secret Vault on ODDORA 🔐👀`
        : `${data.creatorName} trapped me on ODDORA 😂⚡ Can you escape?`,
      onPreview: p => setPreviewPoster(p),
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


  // Photo stays in a crisp top card during Question & Runaway No, then moves to full-screen background on final YES reveal!
  const bgPosX = data.payload?.bgPosX ?? 50;
  const bgPosY = data.payload?.bgPosY ?? 20;
  const bgZoom = data.payload?.bgZoom ?? 1;
  const bgFit = data.payload?.bgFit || "cover";

  const trapBgStyle = !isVault && outcome === "yes" && data.payload?.bgImage
    ? {
        backgroundImage: `linear-gradient(rgba(14, 14, 20, 0.54), rgba(14, 14, 20, 0.76)), url(${data.payload.bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: `${bgPosX}% ${bgPosY}%`
      }
    : undefined;

  return (
    <div className={`pop-fs-stage theme-${cardTheme} ${trapBgStyle ? "has-photo-bg" : ""}`} style={trapBgStyle}>
      <PosterPreviewModal poster={previewPoster} onClose={() => setPreviewPoster(null)} />
      <BubbleBurst triggerKey={burstKey} />
      {outcome === "yes" && <ConfettiRain />}

      {/* Native Mobile Top Push Notification Banner from Sender (Tap -> Jumps to Chatbox!) */}
      <MobileNotificationBanner
        notif={liveSenderNotif}
        onOpen={() => {
          setLiveSenderNotif(null);
          const targetInput = rxChatInputRef.current || pinChatInputRef.current;
          if (targetInput) {
            targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => targetInput.focus(), 120);
          }
        }}
        onDismiss={() => setLiveSenderNotif(null)}
      />

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
        <button type="button" className="pop-pill-black pop-pill-btn" onClick={() => onGoHome?.({ creatorName: data.creatorName, recipientName: data.recipientName })}>
          ⚡ ODDORA · FROM {data.creatorName?.toUpperCase()}
        </button>
        <button type="button" className="pop-btn white sm" onClick={() => { fx("tap", 10); onExit("", data.recipientName); }}>
          {fromInbox ? "← Inbox" : "✕"}
        </button>
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
              {isVault ? "Crack 2 quick locks to see what’s inside." : "Turn sound on — tap to break the seal."}
            </p>
            <button type="button" className="pop-btn yellow lg full pop-pulse-btn" onClick={breakSeal}>
              🔓 BREAK THE SEAL
            </button>
          </div>
        ) : !isVault ? (
          /* ---- OD - TRAP FLOW ---- */
          outcome === "yes" ? (
            <div className="pop-outcome pop-zoom-in" key="trap-win">
              <HumanAvatarSVG avatarId={data.avatarId} size={72} />
              <span className="pop-pill-black">
                {alreadyDecidedCloud
                  ? (dodges === 0 ? "🔒 ALREADY REVEALED · LOCKED IN" : `🔒 ALREADY REVEALED · DODGED ${dodges}x`)
                  : (dodges === 0 ? "⚡ LOCKED IN · NO HESITATION" : `🎉 LOCKED IN · DODGED ${dodges}x`)}
              </span>
              {alreadyDecidedCloud && (
                <small className="pop-decided-pill">
                  {isTrapTa ? "Already reveal aayiduchu — one-time trap 🔒" : "Already revealed — one-time trap 🔒"}
                </small>
              )}
              <div className="pop-sender-hero-msg">“{data.payload.yesMessage}”</div>

              <div className="pop-live-chat-wrap">
                <ChatHistoryBox messages={chatHistory} viewerSide="receiver" />
                <form className="pop-react-form" onSubmit={sendReactionNote}>
                  <input ref={rxChatInputRef} value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Chat live with ${data.creatorName}...`} maxLength={120} />
                  <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                </form>
              </div>

              <button
                type="button"
                className="pop-btn yellow full"
                onClick={() => handleReceiverProofShare(false)}
                disabled={savingCard}
              >
                <Share2 size={16}/> {savingCard ? "Making it..." : "📸 Share My Result"}
              </button>
              {shareStatus && <small className="pop-sent-note">{shareStatus}</small>}

              <button
                type="button"
                className="pop-btn black full"
                onClick={() => {
                  fx("tap", 12);
                  onExit(data.creatorName, data.recipientName, "trap");
                }}
              >
                ⚡ Send a Trap Back to {data.creatorName}
              </button>
            </div>
          ) : (
            <div ref={trapCardRef} className="pop-outcome pop-zoom-in" key="trap-play">
              {data.payload?.bgImage ? (
                <div className="pop-vault-photo-frame pop-trap-photo-box">
                  <img
                    src={data.payload.bgImage}
                    alt="Trap visual"
                    className="pop-trap-cropped-img"
                    style={{
                      objectFit: bgFit,
                      objectPosition: `${bgPosX}% ${bgPosY}%`,
                      transform: bgFit === "cover" ? `scale(${bgZoom})` : "none",
                      transformOrigin: `${bgPosX}% ${bgPosY}%`
                    }}
                  />
                </div>
              ) : (
                <HumanAvatarSVG avatarId={data.avatarId} size={68} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {data.payload?.bgImage && <HumanAvatarSVG avatarId={data.avatarId} size={32} />}
                <span className="pop-pill-black">FOR {who.toUpperCase()}</span>
              </div>
              <h1 className="pop-fs-headline">{data.payload.title}</h1>

              {/* High-Contrast Bold Dare Hook Banner — option-agnostic for any custom button text! */}
              <div className={`pop-hook-banner ${converted ? "twist" : confirmSure ? "warn" : ""}`}>
                {converted
                  ? (isTrapTa ? "PLOT TWIST: Unakku ore option dhaan irukku! 😂⚡" : "PLOT TWIST: You only have one option now! 😂⚡")
                  : confirmSure
                    ? (isTrapTa ? `HOLD ON — “${data.payload.noLabel}” kooda try panna maatiya? 👀` : `WAIT — not even gonna try “${data.payload.noLabel}”? 👀`)
                    : dodges > 0
                      ? (isTrapTa ? "HAHA, PIDIKKA MUDIYALA LA! 😂" : "TOO SLOW! Catch it if you can 😂")
                      : (isTrapTa ? `👀 DARE: Mudinja “${data.payload.noLabel}” press pannu paakalam!` : `👀 DARE: Bet you can't press “${data.payload.noLabel}”!`)}
              </div>

              <div className="pop-fs-actions">
                <button
                  type="button"
                  className={`pop-btn lime lg ${converted ? "pop-pulse-btn" : ""}`}
                  style={!converted ? { transform: `scale(${1 + Math.min(dodges, 4) * 0.04})` } : undefined}
                  onClick={handleYesTap}
                >
                  {confirmSure ? (isTrapTa ? "Aama, 100% confirm! ⚡" : "100% locked in! ⚡") : data.payload.yesLabel}
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
                    className={`pop-btn pink lg ${dodges === 0 ? "pop-no-tease" : ""}`}
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
              <span className="pop-pill-black">LOCK 2 OF 2 · CRACK THE CODE</span>
              <h2 className="pop-wizard-prompt">Tap the moving spot to decrypt 🔐</h2>

              <div className="pop-blur-vault-box pop-decrypt-zone">
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

                <span className="pop-decrypt-status-chip">
                  <Lock size={11}/> {crackTaps === 0 ? "ENCRYPTED" : `DECRYPTING ${Math.min(100, crackTaps * 25)}%`}
                </span>

                {/* Moving TAP HERE spot inside the blurred zone! */}
                {crackTaps < 4 && (
                  <button
                    type="button"
                    key={`spot-${crackTaps}`}
                    className="pop-decrypt-spot"
                    style={{
                      left: decryptSpots[crackTaps % decryptSpots.length].left,
                      top: decryptSpots[crackTaps % decryptSpots.length].top
                    }}
                    onClick={handleCrackTap}
                  >
                    ⚡ TAP HERE
                  </button>
                )}
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

              <small className="pop-muted">
                Tap the glow to crack each digit · {Math.max(0, 4 - crackTaps)} left
              </small>
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
                    ref={pinChatInputRef}
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

              {/* Compact 1-row Action Strip so Live Chat & Input stay visible above keyboard! */}
              <div className="pop-rx-action-strip">
                <button type="button" className="pop-btn white sm" onClick={saveMemoryToShelf}>
                  <Bookmark size={14}/> {savedToShelf ? "Saved ✓" : "Shelf"}
                </button>
                {data.payload?.secretImage && (
                  <button type="button" className="pop-btn blue sm" onClick={downloadVaultPhoto}>
                    <Download size={14}/> Save Pic
                  </button>
                )}
                <button
                  type="button"
                  className="pop-btn yellow sm"
                  onClick={() => handleReceiverProofShare(true)}
                  disabled={savingCard}
                >
                  <Share2 size={14}/> {savingCard ? "Making it..." : "Share Card"}
                </button>
              </div>
              {shareStatus && <small className="pop-sent-note">{shareStatus}</small>}

              <div className="pop-live-chat-wrap">
                <ChatHistoryBox messages={chatHistory} viewerSide="receiver" />
                <form className="pop-react-form" onSubmit={sendReactionNote}>
                  <input ref={rxChatInputRef} value={reactionText} onChange={e => setReactionText(e.target.value)} onFocus={focusScrollCenter} placeholder={`Chat live with ${data.creatorName}...`} maxLength={120} />
                  <button type="submit" className="pop-btn yellow sm" disabled={!reactionText.trim()}><Send size={14}/></button>
                </form>
              </div>

              <button
                type="button"
                className="pop-btn black full"
                onClick={() => {
                  fx("tap", 12);
                  onExit(data.creatorName, data.recipientName, "vault");
                }}
              >
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
    { id: "p3", name: "Neha", mood: "💘", text: "Shared my result card on Insta and 8 friends asked for the link!" }
  ]);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("🔥");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return onValue(query(ref(database, "vibes"), limitToLast(12)), snap => {
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
