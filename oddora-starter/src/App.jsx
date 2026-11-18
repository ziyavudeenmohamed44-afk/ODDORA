import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Sparkles, Zap, WandSparkles, Dice5, Menu,
  X, Search, Share2, ChevronRight, RotateCcw, Sun, Moon, Bot, Users, Send
} from "lucide-react";
import { database, signInPlayer } from "./firebase";
import { get, onValue, push, ref, runTransaction, set } from "firebase/database";

const experiences = [
  { id:"hacker", title:"Cyber Terminal", category:"OD CHAOS", icon:"🖥️", tag:"Live root scan", description:"An intense live terminal breach simulation with an unexpected twist.", color:"purple", type:"sim" },
  { id:"update", title:"System OS Update", category:"OD CHAOS", icon:"📲", tag:"99% suspense", description:"A critical system firmware installation that takes a dramatic turn.", color:"blue", type:"sim" },
  { id:"virus", title:"Device Habit Scanner", category:"OD CHAOS", icon:"🦠", tag:"Deep diagnostic", description:"Scan your digital activity and uncover your real screen-time diagnosis.", color:"green", type:"sim" },
  { id:"button", title:"Don't Touch the Button", category:"OD CHAOS", icon:"🔴", tag:"Tap at your own risk", description:"Every tap triggers a new escalating system reaction.", color:"pink", type:"sim" },
  { id:"iq", title:"Brain Reflex IQ Test", category:"OD CHAOS", icon:"🧠", tag:"3-question benchmark", description:"Answer three rapid-fire logic riddles and get your official brain score.", color:"gold", type:"sim" },
  { id:"mind", title:"Mind Reader", category:"OD MIND", icon:"🔮", tag:"A little magic", description:"Think of a number. Follow the steps. Prepare to be amazed.", color:"orange", type:"game" },
  { id:"xo", title:"XO Multiplayer & AI", category:"OD GAMES", icon:"❎", tag:"Solo AI or Friend", description:"Challenge the witty ODDORA Bot solo or invite a friend live.", color:"blue", type:"game" },
  { id:"catch-heart", title:"Catch My Heart", category:"OD GAMES", icon:"💘", tag:"Solo AI or Friend", description:"Match hearts against ODDORA AI or play live with a friend.", color:"pink", type:"game" },
  { id:"tap-trap", title:"Tap Trap", category:"OD GAMES", icon:"⚡", tag:"60s Reflex Duel", description:"Hit glowing targets, dodge decoy traps, and outscore your rival.", color:"purple", type:"game" },
  { id:"od-invite", title:"OD Invite", category:"OD CREATE", icon:"💌", tag:"Runaway No link", description:"Create a custom Yes/No invite where the No button dodges 8 times.", color:"pink", type:"create" },
  { id:"od-propose", title:"OD Propose", category:"OD CREATE", icon:"💍", tag:"3-step interactive flow", description:"Build a 3-step crush, bestie, or funny proposal with custom outcomes.", color:"purple", type:"create" },
  { id:"personality", title:"Your Secret Superpower", category:"OD MIND", icon:"🦸", tag:"Quick personality quiz", description:"Discover the completely unofficial power you possess.", color:"green", type:"game" },
  { id:"od-fun-coming", title:"OD Fun Area", category:"OD FUN", icon:"🎁", tag:"Coming Soon", description:"We are working to treat you with best fun activities. Drop how do you want to have fun! ✨", color:"purple", type:"fun" },
  { id:"surprise", title:"Surprise Me", category:"OD FUN", icon:"🎲", tag:"Random experience", description:"No plan. No warning. Just a little chaos.", color:"purple", type:"random" }
];

const categories = ["All", "OD GAMES", "OD CREATE", "OD CHAOS", "OD MIND", "OD FUN"];

const randomResults = [
  "You have been promoted to Chief Nap Officer. Your first assignment: do absolutely nothing.",
  "Breaking news: Local human successfully opened 14 browser tabs and forgot why.",
  "Your hidden talent is making plans and then enthusiastically cancelling them.",
  "A committee of penguins has reviewed your vibe. They have concerns. And respect.",
  "Achievement unlocked: Professional Overthinker — 12,000 imaginary scenarios completed."
];

const mindPuzzles = [
  {
    id: "red-hammer", title: "The 98% Brain Lock", icon: "🧠",
    intro: "Don't calculate—just react on pure instinct in under 2 seconds per prompt!",
    instructions: [
      "Picture a bright yellow banana in your mind. Got it? Tap Next.",
      "Now picture a blue ocean wave crashing. Tap Next immediately.",
      "Quick! Without thinking, name ANY CARPENTER TOOL and ANY COLOR in your head right now!"
    ],
    answer: "RED HAMMER 🔨",
    reveal: "You thought of a RED HAMMER (or a hammer in red/blue)!",
    explanation: "Cognitive priming bypasses your analytical prefrontal cortex. When forced to answer fast after primary color cues, 98% of human brains default to the strongest semantic pair: Hammer + Red.",
    type: "steps"
  },
  {
    id: "card-vanish", title: "The Vanishing Card", icon: "🃏",
    intro: "Stare at ONE card below and lock it into your memory. Do NOT tap it!",
    answer: "Your chosen card vanished!",
    reveal: "Look closely at the remaining 5 cards—your exact secret card is GONE.",
    explanation: "Classic psychological misdirection: your brain focuses so intensely on tracking your chosen card that it fails to notice the entire 6-card set was swapped for a completely different 5-card set!",
    type: "cardvanish"
  },
  {
    id: "binary-matrix", title: "Zero-Math Telepathy", icon: "👁️",
    intro: "Think of ANY secret number between 1 and 31. No math—just tell ODDORA if you see it.",
    answer: "Your secret number",
    reveal: "ODDORA read your micro-hesitations across the 5 grids!",
    explanation: "Each mystical grid represents a binary bit (1, 2, 4, 8, 16). Simply answering Yes or No lets ODDORA reconstruct any number from 1 to 31 instantly.",
    type: "binarymatrix"
  },
  {
    id: "sealed-prediction", title: "The Sealed Envelope", icon: "✉️",
    intro: "ODDORA has already locked a prediction inside a sealed digital envelope.",
    answer: "EMERALD DRAGON 🐉",
    reveal: "You eliminated every other option on your own—leaving only ODDORA's sealed prediction!",
    explanation: "This is the Magician's Force: regardless of which items you tap to eliminate, ODDORA dynamically reframes your taps as 'keep' or 'discard' so the final survivor always matches the sealed envelope.",
    type: "sealedforce"
  },
  {
    id: "weekday", title: "Birthday Weekday Oracle", icon: "📅",
    intro: "Discover the exact day of the week you entered the world.",
    answer: "Your birthday weekday",
    explanation: "ODDORA calculates the exact Gregorian calendar weekday from your birth date.",
    type: "weekday"
  }
];

const defaultVibes = [
  { id: "seed-1", name: "Aarav", mood: "😂", text: "Sent the Cyber Terminal link to my roommate and watched him unplug the Wi-Fi router!", createdAt: Date.now() - 3600000 },
  { id: "seed-2", name: "Maya", mood: "🔮", text: "The 1089 Mind Reader genuinely broke my brain at 1 AM.", createdAt: Date.now() - 7200000 },
  { id: "seed-3", name: "Dev", mood: "💘", text: "Beat the ODDORA AI in Catch My Heart in 3 picks. Certified telepathy.", createdAt: Date.now() - 10800000 }
];

function enterDeviceFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (!document.webkitFullscreenElement && el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch {}
}

function exitDeviceFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {}
}

function triggerHaptic(pattern = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

async function shareODDORAResultCard({ game, headline, subtitle, detail, quote, url }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  // Ultra-attractive cyberpunk / fintech gradient background
  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#1f143d");
  bg.addColorStop(0.5, "#0e0c1f");
  bg.addColorStop(1, "#05040b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  // Neon glowing orb accents
  const glow1 = ctx.createRadialGradient(200, 200, 20, 200, 200, 500);
  glow1.addColorStop(0, "rgba(154, 112, 255, .35)");
  glow1.addColorStop(1, "rgba(154, 112, 255, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 1080, 700);

  const glow2 = ctx.createRadialGradient(880, 1100, 30, 880, 1100, 500);
  glow2.addColorStop(0, "rgba(68, 214, 233, .3)");
  glow2.addColorStop(1, "rgba(68, 214, 233, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(200, 800, 880, 550);

  // Frosted glass card border container
  ctx.strokeStyle = "rgba(190, 145, 255, .6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(48, 48, 984, 1254, 40);
  ctx.stroke();

  // Top Badge Stamp
  ctx.fillStyle = "rgba(154, 112, 255, .18)";
  ctx.strokeStyle = "rgba(154, 112, 255, .5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(330, 100, 420, 56, 28);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#e0d4ff";
  ctx.font = "700 22px 'Space Grotesk', Arial";
  ctx.fillText(`⚡ ODDORA · ${game.toUpperCase()}`, 540, 137);

  // Main Headline (Click-bait styling)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 64px 'Space Grotesk', Arial";
  const headlineWords = String(headline || "").split(" ");
  let lines = [""];
  for (const word of headlineWords) {
    const candidate = `${lines[lines.length - 1]} ${word}`.trim();
    if (ctx.measureText(candidate).width > 860) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  let y = 330 - (lines.length - 1) * 40;
  for (const line of lines) {
    ctx.fillText(line, 540, y);
    y += 82;
  }

  // Subtitle
  ctx.fillStyle = "#c8bfdc";
  ctx.font = "500 32px 'Space Grotesk', Arial";
  const drawWrapped = (text, startY, maxWidth, lineHeight, font) => {
    ctx.font = font;
    const words = String(text || "").split(" ");
    let line = "";
    let yy = startY;
    for (const word of words) {
      const test = `${line} ${word}`.trim();
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 540, yy);
        line = word;
        yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, 540, yy);
    return yy;
  };
  let textY = drawWrapped(subtitle, y + 25, 860, 48, "500 32px 'Space Grotesk', Arial");

  // Highlight Detail Box (Financial / Status Flex)
  if (detail) {
    const cardY = Math.max(textY + 70, 680);
    const cardGrad = ctx.createLinearGradient(120, cardY, 960, cardY + 210);
    cardGrad.addColorStop(0, "rgba(154, 112, 255, .32)");
    cardGrad.addColorStop(1, "rgba(68, 214, 233, .2)");
    ctx.fillStyle = cardGrad;
    ctx.strokeStyle = "rgba(190, 145, 255, .6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(100, cardY, 880, 200, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px 'Space Grotesk', Arial";
    ctx.fillText(detail, 540, cardY + 115);
    textY = cardY + 200;
  }

  // Quote or Tagline
  if (quote) {
    ctx.fillStyle = "#f5f3ff";
    drawWrapped(`“${quote}”`, Math.max(textY + 95, 1000), 820, 46, "600 28px 'Space Grotesk', Arial");
  }

  // Footer Branding
  ctx.fillStyle = "#a78bfa";
  ctx.font = "700 22px 'DM Mono', Arial";
  ctx.fillText("PLAY · CREATE · DISCOVER · VIRAL", 540, 1190);

  ctx.fillStyle = "#77728e";
  ctx.font = "500 20px 'Space Grotesk', Arial";
  ctx.fillText("Experience it live at:", 540, 1235);

  ctx.fillStyle = "#c4b5fd";
  ctx.font = "700 24px 'Space Grotesk', Arial";
  ctx.fillText(new URL(url).host, 540, 1270);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the result image");
  return new File([blob], "oddora-viral-card.png", { type: "image/png" });
}

function App() {
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#9a70ff";
    ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 16); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px 'Space Grotesk', Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("O", 32, 34);
    link.href = canvas.toDataURL("image/png");
  }, []);

  const [logoSpinning, setLogoSpinning] = useState(false);
  const [active, setActive] = useState("All");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("oddora-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [copied, setCopied] = useState(false);
  const [sharedSim, setSharedSim] = useState(null);
  const [xoInviteCode, setXoInviteCode] = useState("");
  const [heartInviteCode, setHeartInviteCode] = useState("");
  const [tapInviteCode, setTapInviteCode] = useState("");
  const [odcCode, setOdcCode] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("oddora-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const simId = params.get("sim") || params.get("prank");
    const xoCode = (params.get("xo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const heartCode = (params.get("heart") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const tapCode = (params.get("tap") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const createCode = (params.get("odc") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (createCode.length === 6) {
      setOdcCode(createCode);
    } else if (tapCode.length === 6) {
      const tapGame = experiences.find(item => item.id === "tap-trap");
      if (tapGame) {
        setSelected(tapGame);
        setTapInviteCode(tapCode);
      }
    } else if (xoCode.length === 6) {
      const xoGame = experiences.find(item => item.id === "xo");
      if (xoGame) {
        setSelected(xoGame);
        setXoInviteCode(xoCode);
        if (params.has("heart")) {
          params.delete("heart");
          const cleanUrl = new URL(window.location.href);
          cleanUrl.search = params.toString();
          window.history.replaceState({}, "", cleanUrl.toString());
        }
      }
    } else if (heartCode.length === 6) {
      const heartGame = experiences.find(item => item.id === "catch-heart");
      if (heartGame) {
        setSelected(heartGame);
        setHeartInviteCode(heartCode);
      }
    }

    const mode = params.get("mode");
    const sender = params.get("from");
    if (mode !== "friend" || !simId) return;

    const simItem = experiences.find(
      item => item.id === simId && item.category === "OD CHAOS"
    );
    if (!simItem) return;

    setSelected(simItem);
    setSharedSim({
      mode: "friend",
      sender: (sender || "Your friend").slice(0, 30),
      gatePending: true
    });
  }, []);

  const filtered = useMemo(() => experiences.filter(item =>
    (active === "All" || item.category === active) &&
    (item.title + item.description + item.category).toLowerCase().includes(search.toLowerCase())
  ), [active, search]);

  function openExperience(item) {
    triggerHaptic(12);
    setSelected(item);
    setSharedSim(null);
    setCopied(false);
  }

  function surpriseMe() {
    const item = experiences[Math.floor(Math.random() * experiences.length)];
    openExperience(item);
  }

  function goToCategory(category) {
    setActive(category);
    setSearch("");
    setMenuOpen(false);
    setSelected(null);
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  }

  async function shareResult(text) {
    const shareText = `${text}\nTry ODDORA — Your Playground. Your Challenges!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "ODDORA",
          text: shareText,
          url: window.location.href
        });
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setSelected(null)} aria-label="ODDORA home">
          <span className="brand-mark">O</span>
          <span>ODDORA<span className="brand-dot">.</span></span>
        </a>

        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <a href="#home" onClick={() => { setMenuOpen(false); setActive("All"); setSelected(null); }}>Home</a>
          <button type="button" onClick={() => goToCategory("OD GAMES")}>OD Games</button>
          <button type="button" onClick={() => goToCategory("OD CREATE")}>OD Create</button>
          <button type="button" onClick={() => goToCategory("OD CHAOS")}>OD Chaos</button>
          <button type="button" onClick={() => goToCategory("OD MIND")}>OD Mind</button>
          <button type="button" onClick={() => goToCategory("OD FUN")}>OD Fun</button>
        </nav>

        <div className="top-actions">
          <button
            className="language-btn"
            onClick={() => {
              triggerHaptic(10);
              setTheme(prev => (prev === "dark" ? "light" : "dark"));
            }}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}
            <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
          </button>
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X/> : <Menu/>}
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><span className="pulse"></span> PLAY. CREATE. DISCOVER.</div>
            <h1>The internet's<br/><span className="gradient-text">playground.</span></h1>
            <p className="hero-copy">
              Play games. Create challenges. Discover harmless chaos.<br className="desktop-break"/>
              Your playground. Your challenges.
            </p>

            <div className="hero-actions">
              <a className="primary-btn" href="#explore">Explore the weird <ArrowUpRight size={18}/></a>
              <button className="secondary-btn" onClick={surpriseMe}><Dice5 size={17}/> Surprise me</button>
            </div>

            <div className="hero-note"><Sparkles size={14}/> Free to explore · Solo or with friends · No sign-up</div>
          </div>

          <div className="hero-art" aria-label="Abstract glowing ODDORA portal illustration">
            <div className="orbit orbit-a"></div>
            <div className="orbit orbit-b"></div>
            <div
              className={logoSpinning ? "portal is-spinning" : "portal"}
              onMouseEnter={() => {
                setLogoSpinning(false);
                requestAnimationFrame(() => setLogoSpinning(true));
              }}
              onClick={() => {
                triggerHaptic(14);
                setLogoSpinning(false);
                requestAnimationFrame(() => setLogoSpinning(true));
              }}
              onAnimationEnd={() => setLogoSpinning(false)}
              style={{ cursor: "pointer" }}
            >
              <div className="portal-inner"><span>O</span></div>
            </div>
            <div className="float-card card-top"><span>✨</span> Reality optional</div>
            <div className="float-card card-bottom"><span>🎲</span> Expect the unexpected</div>
            <div className="spark spark-a">✦</div>
            <div className="spark spark-b">✧</div>
          </div>
        </section>

        <section className="ticker" aria-label="ODDORA highlights">
          <div className="ticker-track" aria-hidden="true">
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
            <span>NO BORING MOMENTS <b>✳</b> IMPOSSIBLE IS A STARTING POINT <b>✳</b> PLAY NICE, PLAY WEIRD <b>✳</b> </span>
          </div>
        </section>

        <section className="section zones-section" id="zones">
          <div className="section-heading">
            <div>
              <div className="eyebrow muted">PICK YOUR KIND OF CHAOS</div>
              <h2>Enter a <span className="gradient-text">play zone.</span></h2>
            </div>
            <p>Different doors. Different kinds of fun.<br/>Which one are you opening?</p>
          </div>

          <div className="zone-grid">
            <button className="zone-card zone-blue" onClick={() => goToCategory("OD GAMES")}>
              <span className="zone-icon">🎮</span>
              <span className="zone-number">01 / PLAY</span>
              <strong>OD GAMES</strong>
              <span className="zone-desc">Play solo against AI or challenge friends live.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-purple" onClick={() => goToCategory("OD CREATE")}>
              <span className="zone-icon">✨</span>
              <span className="zone-number">02 / CREATE</span>
              <strong>OD CREATE</strong>
              <span className="zone-desc">Build your own invites, proposals and challenges.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-pink" onClick={() => goToCategory("OD CHAOS")}>
              <span className="zone-icon">⚡</span>
              <span className="zone-number">03 / SURPRISE</span>
              <strong>OD CHAOS</strong>
              <span className="zone-desc">Interactive simulations & unexpected reveals.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-orange" onClick={() => goToCategory("OD MIND")}>
              <span className="zone-icon">🧠</span>
              <span className="zone-number">04 / THINK</span>
              <strong>OD MIND</strong>
              <span className="zone-desc">Mind tricks, puzzles and brain teasers.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
            <button className="zone-card zone-purple" onClick={() => goToCategory("OD FUN")}>
              <span className="zone-icon">🎲</span>
              <span className="zone-number">05 / EXPLORE</span>
              <strong>OD FUN</strong>
              <span className="zone-desc">What ifs, random chaos and silly surprises.</span>
              <ArrowUpRight className="zone-arrow"/>
            </button>
          </div>
        </section>

        <section className="section explore-section" id="explore">
          <div className="section-heading explore-heading">
            <div>
              <div className="eyebrow muted">THE FUN STARTS HERE</div>
              <h2>Find your <span className="gradient-text">next obsession.</span></h2>
            </div>
            <div className="search-wrap">
              <Search size={17}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search experiences..." aria-label="Search experiences"/>
            </div>
          </div>

          <div className="filter-row">
            {categories.map(category => (
              <button key={category} className={active === category ? "filter-chip active" : "filter-chip"} onClick={() => setActive(category)}>
                {category}
              </button>
            ))}
          </div>

          <div className="experience-grid">
            {filtered.map((item, index) => (
              <ExperienceCard key={item.id} item={item} index={index} onClick={() => openExperience(item)}/>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                No weirdness found. Try another search. 👀
              </div>
            )}
          </div>
        </section>

        <VibeWall />

        <section className="surprise-banner">
          <div className="banner-orb">?</div>
          <div>
            <div className="eyebrow">CAN'T DECIDE?</div>
            <h2>Let chaos <span className="gradient-text">choose.</span></h2>
            <p>One click. One random experience. Zero expectations.</p>
          </div>
          <button className="primary-btn" onClick={surpriseMe}>Surprise me <Dice5 size={18}/></button>
        </section>

        <section className="section about-section" id="about">
          <div className="about-icon"><WandSparkles size={26}/></div>
          <div>
            <div className="eyebrow muted">A LITTLE DIFFERENT BY DESIGN</div>
            <h2>Ordinary is <span className="gradient-text">overrated.</span></h2>
            <p>ODDORA is a playful corner of the internet for interactive simulations, curious minds and impossible ideas. No pressure. No sign-up. Just explore.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#"><span className="brand-mark">O</span><span>ODDORA<span className="brand-dot">.</span></span></a>
        <span>Enter ordinary. Leave extraordinary.</span>
        <span>© {new Date().getFullYear()} ODDORA · Made for fun.</span>
      </footer>

      {odcCode && (
        <ODCreatePlayer
          code={odcCode}
          onClose={() => {
            setOdcCode("");
            const url = new URL(window.location.href);
            url.searchParams.delete("odc");
            window.history.replaceState({}, "", url.toString());
          }}
          onCreateReply={() => {
            setOdcCode("");
            const url = new URL(window.location.href);
            url.searchParams.delete("odc");
            window.history.replaceState({}, "", url.toString());
            const inviteCard = experiences.find(e => e.id === "od-invite");
            if (inviteCard) openExperience(inviteCard);
          }}
        />
      )}

      {selected && (
        <ExperienceModal
          item={selected}
          onClose={() => {
            setSelected(null);
            setSharedSim(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            setTapInviteCode("");
            window.history.replaceState({}, "", window.location.pathname);
          }}
          onShare={shareResult}
          copied={copied}
          sharedSim={sharedSim}
          xoInviteCode={xoInviteCode}
          heartInviteCode={heartInviteCode}
          tapInviteCode={tapInviteCode}
          onExplore={() => {
            setSelected(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            setSharedSim(null);
            setActive("All");
            window.history.replaceState({}, "", window.location.pathname);
            window.setTimeout(() => {
              document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 180);
          }}
          onCreateChallenge={() => {
            setSelected(null);
            setXoInviteCode("");
            setHeartInviteCode("");
            setSharedSim(null);
            setActive("OD CREATE");
            window.history.replaceState({}, "", window.location.pathname);
            window.setTimeout(() => {
              document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 180);
          }}
          onBackToGames={() => {
            setSelected(null);
            setActive("OD GAMES");
            setTimeout(() => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" }), 80);
          }}
        />
      )}
    </div>
  );
}

function VibeWall() {
  const [vibes, setVibes] = useState(defaultVibes);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("😂");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const vibesRef = ref(database, "vibes");
    const unsubscribe = onValue(
      vibesRef,
      snapshot => {
        if (!snapshot.exists()) return;
        const raw = snapshot.val();
        const list = Object.entries(raw)
          .map(([id, item]) => ({ id, ...item }))
          .filter(item => item && item.text && item.name)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 6);
        if (list.length > 0) setVibes(list);
      },
      () => {}
    );
    return () => unsubscribe();
  }, []);

  async function submitVibe(e) {
    e.preventDefault();
    const cleanText = text.trim().replace(/\s+/g, " ").slice(0, 140);
    const cleanName = (name.trim().replace(/\s+/g, " ") || "Anonymous Explorer").slice(0, 20);
    if (!cleanText || sending) return;

    setSending(true);
    setStatusMsg("");
    triggerHaptic(15);

    const entry = {
      name: cleanName,
      mood,
      text: cleanText,
      createdAt: Date.now()
    };

    try {
      await signInPlayer();
      await push(ref(database, "vibes"), entry);
      setText("");
      setStatusMsg("Vibe posted to the wall! ✨");
    } catch {
      setVibes(prev => [{ id: `local-${Date.now()}`, ...entry }, ...prev].slice(0, 6));
      setText("");
      setStatusMsg("Added to your session wall! ✨");
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(""), 2500);
    }
  }

  return (
    <section className="section vibe-section" id="vibes">
      <div className="section-heading">
        <div>
          <div className="eyebrow muted">LIVE CHAOS WALL</div>
          <h2>Visitor <span className="gradient-text">vibe check.</span></h2>
        </div>
        <p>Drop a quick reaction after surprising a friend<br/>or beating the ODDORA AI.</p>
      </div>

      <form className="vibe-form" onSubmit={submitVibe}>
        <div className="vibe-moods" role="group" aria-label="Choose mood">
          {["😂", "🤯", "💘", "😈", "🔥"].map(m => (
            <button
              type="button"
              key={m}
              className={mood === m ? "vibe-mood active" : "vibe-mood"}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          className="vibe-name-input"
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder="Your name (optional)"
          maxLength={20}
        />
        <input
          className="vibe-text-input"
          value={text}
          onChange={e => setText(e.target.value.slice(0, 140))}
          placeholder="How did your challenge or game go? (140 chars)"
          maxLength={140}
        />
        <button className="primary-btn" type="submit" disabled={!text.trim() || sending}>
          <Send size={15}/> {sending ? "Posting..." : "Post vibe"}
        </button>
      </form>
      {statusMsg && <p className="vibe-status">{statusMsg}</p>}

      <div className="vibe-grid">
        {vibes.map(item => (
          <div className="vibe-card" key={item.id}>
            <div className="vibe-card-top">
              <span className="vibe-emoji">{item.mood || "✨"}</span>
              <strong>{item.name}</strong>
              <span className="vibe-badge">VERIFIED CHAOS</span>
            </div>
            <p>“{item.text}”</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExperienceCard({ item, index, onClick }) {
  return (
    <button className={`experience-card ${item.color}`} onClick={onClick} style={{"--delay": `${index * 55}ms`}}>
      <div className="experience-card-top">
        <span className="experience-emoji">{item.icon}</span>
        <span className="card-open"><ArrowUpRight size={17}/></span>
      </div>
      <span className="card-category">{item.category}</span>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
      <span className="card-tag"><span></span>{item.tag}</span>
    </button>
  );
}

function ExperienceModal({ item, onClose, onShare, copied, sharedSim, xoInviteCode, heartInviteCode, tapInviteCode, onExplore, onCreateChallenge, onBackToGames }) {
  const [step, setStep] = useState(item.id === "xo" && xoInviteCode ? 13 : item.id === "catch-heart" && heartInviteCode ? 14 : item.id === "tap-trap" && tapInviteCode ? 16 : 0);
  const [simMode, setSimMode] = useState(sharedSim?.mode === "friend" ? "friend" : "self");
  const [senderName, setSenderName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [choice, setChoice] = useState("");
  const [mindPuzzleIndex, setMindPuzzleIndex] = useState(0);
  const [mindInstructionIndex, setMindInstructionIndex] = useState(0);
  const [result, setResult] = useState("");
  const [showMagicPopup, setShowMagicPopup] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [vanishPhase, setVanishPhase] = useState("pick");
  const [matrixStep, setMatrixStep] = useState(0);
  const [matrixSum, setMatrixSum] = useState(0);
  const [forceItems, setForceItems] = useState(["PHOENIX 🔥", "CYBER WOLF 🐺", "EMERALD DRAGON 🐉", "SHADOW FALCON 🦅"]);
  const [forcePrompt, setForcePrompt] = useState("Tap any TWO icons to eliminate them:");
  const [buttonClicks, setButtonClicks] = useState(0);
  const [iqQuestion, setIqQuestion] = useState(0);
  const [iqAnswers, setIqAnswers] = useState([]);
  const [hackerElapsed, setHackerElapsed] = useState(0);
  const [hackerRunId, setHackerRunId] = useState(0);
  const [updateElapsed, setUpdateElapsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const lastHackerToneRef = useRef(-1);
  const autoStartedRef = useRef(false);



  async function playSound(kind = "tap") {
    if (!soundEnabledRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const patterns = {
        tap: [
          { f: 680, d: 0.06, v: 0.09, w: "triangle" },
          { f: 1020, d: 0.05, v: 0.05, w: "sine", delay: 0.02 }
        ],
        step: [
          { f: 440, d: 0.11, v: 0.11, w: "triangle" },
          { f: 659, d: 0.14, v: 0.10, w: "sine", delay: 0.08 }
        ],
        magic: [
          { f: 523.25, d: 0.18, v: 0.12, w: "sine" },
          { f: 659.25, d: 0.18, v: 0.11, w: "triangle", delay: 0.11 },
          { f: 783.99, d: 0.24, v: 0.12, w: "sine", delay: 0.22 },
          { f: 1046.5, d: 0.34, v: 0.10, w: "sine", delay: 0.33 }
        ],
        reveal: [
          { f: 261.63, d: 0.38, v: 0.12, w: "triangle" },
          { f: 523.25, d: 0.22, v: 0.15, w: "triangle" },
          { f: 659.25, d: 0.24, v: 0.15, w: "triangle", delay: 0.13 },
          { f: 783.99, d: 0.45, v: 0.18, w: "sine", delay: 0.26, slideTo: 1046.5 }
        ],
        wrong: [
          { f: 185, d: 0.24, v: 0.16, w: "sawtooth", slideTo: 130 },
          { f: 146.83, d: 0.32, v: 0.15, w: "sawtooth", delay: 0.18, slideTo: 98 }
        ],
        boot: [
          { f: 65.41, d: 0.85, v: 0.24, w: "sawtooth", slideTo: 130.81 },
          { f: 130.81, d: 0.75, v: 0.18, w: "triangle", delay: 0.15, slideTo: 261.63 },
          { f: 523.25, d: 0.35, v: 0.12, w: "sine", delay: 0.55 }
        ],
        key: [
          { f: 920, d: 0.04, v: 0.07, w: "square" },
          { f: 1380, d: 0.03, v: 0.05, w: "triangle", delay: 0.02 }
        ],
        alert: [
          { f: 440, d: 0.22, v: 0.20, w: "sawtooth", slideTo: 220 },
          { f: 440, d: 0.24, v: 0.20, w: "sawtooth", delay: 0.24, slideTo: 195 },
          { f: 110, d: 0.45, v: 0.18, w: "square", delay: 0.1 }
        ],
        suspense: [
          { f: 98, d: 0.75, v: 0.16, w: "sawtooth" },
          { f: 103.83, d: 0.75, v: 0.14, w: "sine", delay: 0.25 },
          { f: 196, d: 0.55, v: 0.10, w: "triangle", delay: 0.5 }
        ],
      };
      const notes = patterns[kind] || patterns.tap;
      const startAt = ctx.currentTime + 0.015;

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = startAt + (note.delay || 0);
        osc.type = note.w;
        osc.frequency.setValueAtTime(note.f, at);
        if (note.slideTo) {
          osc.frequency.exponentialRampToValueAtTime(note.slideTo, at + note.d);
        }
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(note.v, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + note.d + 0.03);
      });
    } catch {}
  }

  function toggleSound() {
    if (item.category === "OD CHAOS") {
      enterDeviceFullscreen();
    }
    setSoundEnabled(current => {
      const next = !current;
      soundEnabledRef.current = next;
      if (next) {
        if (item.id === "hacker" && step === 1) playSound("boot");
        else if (item.id === "update" && step === 9) playSound("suspense");
        else if (item.id === "virus" && step === 10) playSound("alert");
        else playSound("reveal");
      }
      return next;
    });
  }

  useEffect(() => () => {
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);


  // Continuous atmospheric audio throughout active simulations
  useEffect(() => {
    if (!soundEnabled) return undefined;
    if (item.id === "hacker" && step === 1) {
      const pulse = window.setInterval(() => {
        playSound(hackerElapsed > 13 ? "alert" : "key");
      }, 650);
      return () => window.clearInterval(pulse);
    }
    if (item.id === "update" && step === 9) {
      const tick = window.setInterval(() => {
        playSound("suspense");
      }, 1800);
      return () => window.clearInterval(tick);
    }
    if (item.id === "virus" && step === 10) {
      const scanBeep = window.setInterval(() => {
        playSound("step");
      }, 1100);
      return () => window.clearInterval(scanBeep);
    }
    return undefined;
  }, [item.id, step, soundEnabled, hackerElapsed > 13]);

  useEffect(() => {
    if (item.id !== "hacker" || step !== 1) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.min((Date.now() - startedAt) / 1000, 18);
      setHackerElapsed(seconds);

      const wholeSecond = Math.floor(seconds);
      if ([3, 5, 7, 9, 11, 13, 15].includes(wholeSecond) &&
          lastHackerToneRef.current !== wholeSecond) {
        lastHackerToneRef.current = wholeSecond;
        playSound(wholeSecond === 9 || wholeSecond === 13 ? "alert" : "key");
      }

      if (seconds >= 18) {
        clearInterval(timer);
        setResult("SYSTEM BREACHED! 😂 Just kidding. Your biggest vulnerability is opening one more tab when you already have 47 tabs open.");
        setStep(2);
        playSound("reveal");
        triggerHaptic([30, 40, 30]);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [item.id, step, hackerRunId]);

  useEffect(() => {
    if (item.id !== "update" || step !== 9) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setUpdateElapsed(elapsed);

      if (elapsed >= 23) {
        clearInterval(timer);
        setResult("Update complete! 😂 Relax—your device wasn't touched. That was an ODDORA interactive simulation!");
        setStep(2);
        playSound("reveal");
        triggerHaptic([25, 35, 25]);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [item.id, step]);

  const currentPuzzle = mindPuzzles[mindPuzzleIndex];
  const prediction = currentPuzzle.type === "steps" ? currentPuzzle.answer : result;

  function resetMind() {
    setMindInstructionIndex(0);
    setBirthDate("");
    setResult("");
    setShowMagicPopup(false);
    setVanishPhase("pick");
    setMatrixStep(0);
    setMatrixSum(0);
    setForceItems(["PHOENIX 🔥", "CYBER WOLF 🐺", "EMERALD DRAGON 🐉", "SHADOW FALCON 🦅"]);
    setForcePrompt("Tap any TWO icons to eliminate them:");
  }

  function choosePuzzle(index) {
    playSound("magic");
    triggerHaptic(12);
    setMindPuzzleIndex(index);
    resetMind();
    setStep(5);
  }

  function chooseRandomPuzzle() {
    let index = Math.floor(Math.random() * mindPuzzles.length);
    if (mindPuzzles.length > 1 && index === mindPuzzleIndex) {
      index = (index + 1) % mindPuzzles.length;
    }
    choosePuzzle(index);
  }

  function runHacker() {
    setHackerElapsed(0);
    lastHackerToneRef.current = -1;
    setResult("");
    setHackerRunId(r => r + 1);
    setStep(1);
    playSound("boot");
    triggerHaptic([20, 30, 40]);
  }

  function getRandomAward() {
    const awards = [
      "World's Most Talented Tab Opener 🏅",
      "Supreme Commander of Snooze Buttons 🏆",
      "International Procrastination Champion 🥇",
      "Certified Professional Daydreamer 🌟",
      "CEO of 'I'll Do It Tomorrow' 👑"
    ];
    playSound("reveal");
    triggerHaptic(20);
    setResult(awards[Math.floor(Math.random() * awards.length)]);
    setStep(2);
  }

  async function createFriendLink() {
    const cleanName = senderName.trim().slice(0, 30);

    if (!cleanName) {
      setLinkError("Enter your name first so your friend sees who sent this.");
      triggerHaptic([20, 30, 20]);
      return;
    }
    setLinkError("");

    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("sim", item.id);
    url.searchParams.set("mode", "friend");
    url.searchParams.set("from", cleanName);

    const shareUrl = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${cleanName} sent you something`,
          text: `${cleanName} wants you to see this 👀\n${shareUrl}`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(`${cleanName} wants you to see this 👀\n${shareUrl}`);
        setLinkCopied(true);
        playSound("reveal");
        setTimeout(() => setLinkCopied(false), 2500);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2500);
        } catch {
          setLinkError("Unable to copy automatically. Please copy the link manually.");
        }
      }
    }
  }

  function startExperience() {
    triggerHaptic(15);
    if (item.category === "OD CHAOS") {
      enterDeviceFullscreen();
    }
    if (item.id === "hacker") return runHacker();
    if (item.id === "update") {
      setUpdateElapsed(0);
      playSound("suspense");
      setStep(9);
      return;
    }
    if (item.id === "virus") {
      playSound("alert");
      return setStep(10);
    }
    if (item.id === "button") {
      setButtonClicks(0);
      playSound("tap");
      return setStep(11);
    }
    if (item.id === "iq") {
      setIqQuestion(0);
      setIqAnswers([]);
      playSound("step");
      return setStep(12);
    }
    if (item.id === "mind") return setStep(0);
    if (item.id === "xo") return setStep(13);
    if (item.id === "catch-heart") return setStep(14);
    if (item.id === "tap-trap") return setStep(16);
    if (item.id === "vip-call") return setStep(17);
    if (item.id === "billionaire-alert") return setStep(18);
    if (item.id === "buy-universe") return setStep(19);
    if (item.id === "award") return getRandomAward();
    

    if (item.id === "surprise") {
      playSound("reveal");
      setResult(randomResults[Math.floor(Math.random() * randomResults.length)]);
      return setStep(2);
    }

    if (item.id === "personality") {
      playSound("step");
      return setStep(4);
    }
  }




  useEffect(() => {
    if (item.category !== "OD CHAOS" || step === 0 || step === 2) return undefined;
    let audioUnlocked = false;
    const unlockImmersive = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        enterDeviceFullscreen();
      }
      if (!audioUnlocked && soundEnabledRef.current) {
        audioUnlocked = true;
        const triggerActiveAudio = () => {
          if (item.id === "hacker" && step === 1) playSound("boot");
          else if (item.id === "update" && step === 9) playSound("suspense");
          else if (item.id === "virus" && step === 10) playSound("alert");
          else if (item.id === "button" && step === 11) playSound("tap");
          else if (item.id === "iq" && step === 12) playSound("step");
        };
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().then(triggerActiveAudio).catch(() => { audioUnlocked = false; });
        } else {
          triggerActiveAudio();
        }
      }
    };
    window.addEventListener("click", unlockImmersive, true);
    window.addEventListener("touchend", unlockImmersive, true);
    window.addEventListener("keydown", unlockImmersive, true);
    return () => {
      window.removeEventListener("click", unlockImmersive, true);
      window.removeEventListener("touchend", unlockImmersive, true);
      window.removeEventListener("keydown", unlockImmersive, true);
    };
  }, [item.category, item.id, step]);

  function revealWeekday() {
    if (!birthDate) return;
    const [year, month, day] = birthDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return;

    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    setResult(`You were born on a ${weekday}!`);
    playSound("reveal");
    setStep(6);
  }

  function revealMagic() {
    setShowMagicPopup(false);
    playSound("magic");
    setStep(7);
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    marginTop: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(190,160,255,.25)",
    background: "var(--input-bg, #100d1b)",
    color: "inherit",
    font: "inherit"
  };

  function sharePrediction() {
    onShare(`${currentPuzzle.title}: ${prediction}\nTry ODDORA!`);
  }

  if (item.id === "hacker" && step >= 1) {
    const phase = hackerElapsed < 3
      ? "boot"
      : hackerElapsed < 8
        ? "connect"
        : hackerElapsed < 13
          ? "intrusion"
          : hackerElapsed < 18
            ? "final"
            : "reveal";

    const terminalMessages = [
      { time: 3, text: "INITIALIZING VIRTUAL ENVIRONMENT...", type: "normal" },
      { time: 4, text: "Establishing encrypted tunnel [SIMULATED]", type: "normal" },
      { time: 5, text: "Connecting to ODDORA mainframe...", type: "normal" },
      { time: 6, text: "Handshake protocol: VERIFIED", type: "success" },
      { time: 7, text: "Loading virtual access modules...", type: "normal" },
      { time: 8, text: "UNUSUAL ACTIVITY DETECTED", type: "warning" },
      { time: 9, text: "Running fictional security diagnostics...", type: "normal" },
      { time: 10, text: "Decrypting imaginary data blocks...", type: "normal" },
      { time: 11, text: "ACCESS LEVEL: MAXIMUM (SIMULATION)", type: "success" },
      { time: 12, text: "Preparing final system report...", type: "normal" }
    ];

    const visibleMessages = terminalMessages.filter(message => hackerElapsed >= message.time);
    const progress = hackerElapsed < 13 ? 0 : Math.min(99, Math.round(((hackerElapsed - 13) / 5) * 99));

    return (
      <div className="hacker-fullscreen">
        <div className="hacker-topbar">
          <div className="hacker-brand"><span>◈</span> ODDORA <small>CYBER LAB</small></div>
          <div className="hacker-top-actions">
            <button onClick={toggleSound}>{soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF"}</button>
            <button onClick={() => { exitDeviceFullscreen(); onClose(); }}>EXIT ✕</button>
          </div>
        </div>

        {step === 2 ? (
          <div className="hacker-main">
            <div className="hacker-reveal-screen">
              <div className="hacker-reveal-icon">😂</div>
              <div className="hacker-kicker">SYSTEM REPORT · ODDORA CLASSIFIED</div>
              {sharedSim?.mode === "friend" && (
                <p className="hacker-reveal-message">
                  Relax! <strong>{sharedSim.sender}</strong> sent you this interactive simulation! 😂
                </p>
              )}
              <h1>SIMULATION <span>COMPLETE.</span></h1>
              <p className="hacker-reveal-message">{result}</p>
              <div className="hacker-stamp">100% HARMLESS SIMULATION</div>
              <div className="hacker-reveal-actions">
                <button className="hacker-launch-again" onClick={runHacker}>↻ RUN IT AGAIN</button>
                <button className="hacker-exit" onClick={() => { exitDeviceFullscreen(); onClose(); }}>BACK TO ODDORA</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hacker-status-row">
              <span><i className="hacker-live-dot"></i> LIVE SIMULATION</span>
              <span>SESSION: OD-{Math.floor(Date.now() / 1000).toString().slice(-6)}</span>
              <span>SECURE MODE: ON</span>
            </div>

            <div className="hacker-main">
              {phase === "boot" && (
                <div className="hacker-boot">
                  <div className="hacker-emblem">◈</div>
                  <div className="hacker-kicker">ODDORA CYBER SYSTEMS</div>
                  <h1>INITIALIZING<span className="hacker-cursor">_</span></h1>
                  <p>Preparing secure virtual environment</p>
                  <div className="hacker-boot-line"><span /></div>
                </div>
              )}

              {(phase === "connect" || phase === "intrusion") && (
                <div className="hacker-console-layout">
                  <div className="hacker-console-main">
                    <div className="hacker-panel-heading">
                      <span>TERMINAL / ROOT SESSION</span>
                      <span className="hacker-live-label">● ACTIVE</span>
                    </div>
                    <div className="hacker-terminal-body">
                      <div className="hacker-terminal-intro">ODDORA VIRTUAL TERMINAL v4.09</div>
                      <div className="hacker-terminal-intro">Copyright © ODDORA Cyber Lab</div>
                      <div className="hacker-terminal-gap" />
                      {visibleMessages.map(message => (
                        <div className={`hacker-line ${message.type}`} key={message.time}>
                          <span className="hacker-prompt">root@oddora:~$</span> {message.text}
                        </div>
                      ))}
                      <div className="hacker-typing-line"><span>root@oddora:~$</span> <i /></div>
                    </div>
                  </div>

                  <div className="hacker-side-panels">
                    <div className="hacker-info-panel">
                      <span>NETWORK STATUS</span><strong className="green-text">● ENCRYPTED</strong>
                      <small>Virtual connection only</small>
                    </div>
                    <div className="hacker-info-panel">
                      <span>FIREWALL</span><strong className="green-text">ACTIVE</strong>
                      <small>Simulation shield enabled</small>
                    </div>
                    <div className="hacker-info-panel">
                      <span>ACCESS ATTEMPTS</span><strong>{Math.min(12, visibleMessages.length + 2).toString().padStart(2, "0")}</strong>
                      <small>Fictional operations</small>
                    </div>
                    <div className="hacker-radar"><div className="hacker-radar-sweep" /><span>SCANNING</span></div>
                  </div>
                </div>
              )}

              {phase === "final" && (
                <div className="hacker-final-loading">
                  <div className="hacker-warning-symbol">!</div>
                  <div className="hacker-kicker">FINAL OPERATION</div>
                  <h1>FINALIZING <span>ACCESS</span></h1>
                  <p>Do not interrupt the simulation...</p>
                  <div className="hacker-big-progress">
                    <div style={{ width: `${progress}%` }} />
                  </div>
                  <div className="hacker-progress-meta">
                    <strong>{progress}%</strong><span>VIRTUAL ACCESS VERIFICATION</span>
                  </div>
                  <div className="hacker-glitch-note">PLEASE WAIT — SYSTEM RESPONSE PENDING</div>
                </div>
              )}
            </div>

            <div className="hacker-bottom-note">
              ODDORA SIMULATION ENVIRONMENT · NO REAL DEVICE OR ACCOUNT ACCESS
            </div>
          </>
        )}
      </div>
    );
  }

  if (sharedSim?.mode === "friend" && item.category === "OD CHAOS" && step === 0) {
    const alertCopy = {
      hacker: {
        title: "System Security Alert",
        body: `Unusual remote session activity detected via shared link from ${sharedSim.sender}. Tap OK to run immediate diagnostic.`
      },
      update: {
        title: "Critical System Update",
        body: "Important display & security firmware patch is ready to install. Do not close this window."
      },
      virus: {
        title: "Device Protection Warning",
        body: "Potential background anomaly flagged in browser memory. Tap OK to scan immediately."
      },
      button: {
        title: "Restricted System Control",
        body: `${sharedSim.sender} shared a restricted system trigger. Tap OK to inspect.`
      },
      iq: {
        title: "Cognitive Calibration Check",
        body: `${sharedSim.sender} challenged your device reflex benchmark. Tap OK to begin.`
      }
    }[item.id] || {
      title: "System Alert",
      body: "Unusual activity detected. Tap OK to continue."
    };

    return (
      <div className="sys-alert-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="sys-alert-title">
        <div className="sys-alert-box">
          <div className="sys-alert-head">
            <span className="sys-alert-warn">⚠️</span>
            <strong id="sys-alert-title">{alertCopy.title}</strong>
          </div>
          <p className="sys-alert-body">{alertCopy.body}</p>
          <div className="sys-alert-actions">
            <button
              type="button"
              className="sys-alert-ok"
              onClick={() => {
                startExperience();
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="experience-modal" role="dialog" aria-modal="true"
        aria-labelledby="modal-title" style={{ position: "relative" }}>
        <button className="modal-close" onClick={() => { exitDeviceFullscreen(); onClose(); }} aria-label="Close">
          <X size={20}/>
        </button>

        <div className="modal-topline">
          <span className="modal-icon">{item.icon}</span>
          <span className="card-category">{item.category}</span>
          <button className="modal-sound-toggle" onClick={toggleSound} type="button">
            {soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF"}
          </button>
        </div>

        <h2 id="modal-title">{item.id === "mind" ? "Mind Lab" : item.title}</h2>
        <p className="modal-description">
          {item.id === "mind" ? "Choose a mystery, or let ODDORA surprise you." : item.description}
        </p>

        {/* MIND LAB SELECTION */}
        {step === 0 && item.id === "mind" && (
          <div className="result-stage" style={{ gap: 14 }}>
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }}
              onClick={chooseRandomPuzzle}>
              🎲 Surprise me with a random puzzle
            </button>
            <div className="eyebrow muted" style={{ marginTop: 8 }}>OR PICK YOUR MYSTERY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, width: "100%" }}>
              {mindPuzzles.map((puzzle, index) => (
                <button key={puzzle.id} className="choice" onClick={() => choosePuzzle(index)}
                  style={{
                    minHeight: 88, padding: 12, display: "flex", flexDirection: "column",
                    alignItems: "flex-start", justifyContent: "center", gap: 7,
                    textAlign: "left"
                  }}>
                  <span style={{ fontSize: 22 }}>{puzzle.icon}</span>
                  <strong style={{ fontSize: 13 }}>{puzzle.title}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OD CREATE STUDIO INSIDE STANDARD MODAL */}
        {step === 0 && (item.id === "od-invite" || item.id === "od-propose") && (
          <ODCreateStudio initialTab={item.id === "od-propose" ? "propose" : "invite"} />
        )}

        {/* INTRO FOR OTHER EXPERIENCES */}
        {step === 0 && item.id !== "mind" && item.id !== "od-invite" && item.id !== "od-propose" && (
          <div className="modal-stage intro-stage">
            <div className="stage-orb">{item.icon}</div>

            {item.category === "OD CHAOS" ? (
              <>
                {sharedSim?.mode === "friend" ? null : (
                  <>
                    <p>How do you want to run this experience?</p>

                    <div className="prank-mode-options">
                      <button
                        type="button"
                        className={simMode === "self" ? "prank-mode-card active" : "prank-mode-card"}
                        onClick={() => { setSimMode("self"); setLinkError(""); }}
                      >
                        <span>⚡</span>
                        <strong>Try Myself</strong>
                        <small>Launch interactive mode now</small>
                      </button>

                      <button
                        type="button"
                        className={simMode === "friend" ? "prank-mode-card active" : "prank-mode-card"}
                        onClick={() => { setSimMode("friend"); setLinkError(""); }}
                      >
                        <span>🫣</span>
                        <strong>Send to a Friend</strong>
                        <small>Generate a direct surprise link</small>
                      </button>
                    </div>

                    {simMode === "self" ? (
                      <button className="primary-btn" onClick={startExperience}>
                        Let's do this <Zap size={17}/>
                      </button>
                    ) : (
                      <div className="friend-link-form">
                        <input
                          type="text"
                          maxLength={30}
                          value={senderName}
                          onChange={e => { setSenderName(e.target.value); setLinkError(""); }}
                          placeholder="Enter your name"
                          aria-label="Your name"
                        />
                        {linkError && <small style={{ color: "#ff8585" }}>{linkError}</small>}
                        <button
                          className="primary-btn"
                          onClick={createFriendLink}
                          disabled={!senderName.trim()}
                        >
                          <Share2 size={17}/>
                          {linkCopied ? "Link copied!" : "Create share link"}
                        </button>
                        <small>Share this link with your friend. The experience launches when they open it.</small>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <p>{item.id === "hacker"
                  ? "A suspicious terminal is waiting. Ready to see what it finds?"
                  : "Ready? This is a harmless visual experience."}</p>
                <button className="primary-btn" onClick={startExperience}>
                  Let's do this <Zap size={17}/>
                </button>
              </>
            )}
          </div>
        )}

        {/* OS SYSTEM UPDATE */}
        {step === 9 && item.id === "update" && (() => {
          const progress = updateElapsed < 4
            ? 12
            : updateElapsed < 9
              ? 38
              : updateElapsed < 15
                ? 67
                : updateElapsed < 20
                  ? 99
                  : 100;

          const restarting = updateElapsed >= 20;

          return (
            <div className="software-update-screen" onClick={() => enterDeviceFullscreen()}>
              {!restarting ? (
                <>
                  <div className="windows-update-logo">◈</div>
                  <h2>Working on updates</h2>
                  <p className="update-subtitle">Your device is installing important updates</p>
                  <div className="software-update-percent">{progress}%</div>
                  <div className="software-update-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="software-update-message">
                    {progress === 99
                      ? "Almost there. Please don't turn off your device."
                      : "Please keep your device turned on."}
                  </p>
                  <p className="software-update-warning">Do not turn off your device</p>
                </>
              ) : (
                <div className="sim-restart">
                  <div className="restart-spinner"></div>
                  <h2>Restarting...</h2>
                  <p>Preparing your device</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* HARMLESS VIRUS SCANNER */}
        {step === 10 && item.id === "virus" && (
          <div className="prank-stage scanner-stage prank-fullscreen-takeover">
            <div className="scanner-orb"><span>⌁</span></div>
            <div className="eyebrow muted">ODDORA SECURITY SIMULATOR</div>
            <h3>Scanning your digital habits...</h3>
            <div className="scan-lines"><span /></div>
            <div className="scan-checks">
              <span>✓ Checking scroll history</span>
              <span>✓ Analysing snack searches</span>
              <span>✓ Detecting procrastination</span>
            </div>
            <button className="primary-btn" onClick={() => {
              setResult("THREAT DETECTED: Excessive scrolling. Recommended action: touch grass for 5 minutes. 🌱");
              playSound("alert");
              triggerHaptic([20, 40, 20]);
              setStep(2);
            }}>Reveal scan result</button>
            <p className="prank-disclaimer">This is a fictional scan. It does not access your phone or files.</p>
          </div>
        )}

        {/* DON'T TOUCH THE BUTTON */}
        {step === 11 && item.id === "button" && (
          <div className="prank-stage forbidden-stage prank-fullscreen-takeover">
            <div className="eyebrow muted">THE FORBIDDEN BUTTON</div>
            <h3>{buttonClicks === 0 ? "Whatever you do..." : "You really did it?!"}</h3>
            <p className="result-text">{buttonClicks === 0 ? "Don't press the button. Seriously." : [
              "The button has noticed you.",
              "A tiny committee is discussing your decision.",
              "Button status: emotionally unavailable.",
              "Achievement unlocked: Professional button presser.",
              "The button requests a day off."
            ][(buttonClicks - 1) % 5]}</p>
            <button className="forbidden-button" onClick={() => {
              playSound("tap");
              triggerHaptic(18);
              setButtonClicks(c => c + 1);
            }}>
              {buttonClicks === 0 ? "DO NOT PRESS" : "PRESS AGAIN"}
            </button>
            <span className="tap-counter">Button presses: {buttonClicks}</span>
            <button className="secondary-btn dark" onClick={() => {
              playSound("reveal");
              setResult(`You pressed the forbidden button ${buttonClicks} times. The button will remember. 🔴`);
              setStep(2);
            }}>I'm done causing trouble</button>
          </div>
        )}

        {/* BRAIN REFLEX TEST */}
        {step === 12 && item.id === "iq" && (
          <div className={item.id === "iq" ? "prank-stage iq-stage prank-fullscreen-takeover" : "prank-stage iq-stage"}>
            <div className="eyebrow muted">TOTALLY UNOFFICIAL IQ TEST</div>
            <div className="iq-count">QUESTION {Math.min(iqQuestion + 1, 3)} / 3</div>
            <>
              <h3>{[
                "What has many keys but can't open a door?",
                "What gets wetter the more it dries?",
                "Which month has 28 days?"
              ][iqQuestion]}</h3>
              <div className="iq-options">
                {[
                  ["A piano","A secret agent","Your keyboard"],
                  ["A towel","A cloud","Your phone"],
                  ["February","All of them","None"]
                ][iqQuestion].map((answer, index) => (
                  <button key={answer} className="choice" onClick={() => {
                    playSound("tap");
                    triggerHaptic(12);
                    const nextAnswers = [...iqAnswers, index];
                    setIqAnswers(nextAnswers);
                    if (iqQuestion === 2) {
                      const score = nextAnswers.reduce((total, value, qIndex) =>
                        total + (value === [0, 0, 1][qIndex] ? 1 : 0), 0);
                      playSound("reveal");
                      setResult(`Your completely unofficial ODDORA IQ score: ${82 + score * 17}. ${score === 3 ? "Genius energy detected!" : "The test is confused. You are probably too powerful."} 😂`);
                      setStep(2);
                    } else {
                      setIqQuestion(q => q + 1);
                    }
                  }}>{answer}</button>
                ))}
              </div>
            </>
            <p className="prank-disclaimer">Just a silly quiz, not a real IQ assessment.</p>
          </div>
        )}



        {/* XO MULTIPLAYER + SOLO AI */}
        {step === 13 && item.id === "xo" && (
          <XOMultiplayer
            onBack={onBackToGames}
            onExplore={onExplore}
            onCreateChallenge={onCreateChallenge}
            initialRoomCode={xoInviteCode}
            playSound={playSound}
          />
        )}

        {/* CATCH MY HEART MULTIPLAYER + SOLO AI */}
        {step === 14 && item.id === "catch-heart" && (
          <CatchMyHeart
            onBack={onBackToGames}
            onExplore={onExplore}
            onCreateChallenge={onCreateChallenge}
            initialRoomCode={heartInviteCode}
            playSound={playSound}
          />
        )}

        {/* TAP TRAP SOLO & 60S MULTIPLAYER */}
        {step === 16 && item.id === "tap-trap" && (
          <TapTrapGame
            onBack={onBackToGames}
            onExplore={onExplore}
            onCreateChallenge={onCreateChallenge}
            initialRoomCode={tapInviteCode}
            playSound={playSound}
          />
        )}

        {/* OD FUN COMING SOON MESSAGE */}
        {step === 0 && item.id === "od-fun-coming" && (
          <div className="result-stage">
            <div className="result-spark">🎁</div>
            <div className="eyebrow muted">OD FUN · COMING SOON</div>
            <h3>We are working to treat you with best fun activities!</h3>
            <p className="result-text">Drop how do you want to have fun? Exciting interactive experiences and challenges are loading soon.</p>
            <button type="button" className="primary-btn" onClick={onClose}>Explore OD Games & Create</button>
          </div>
        )}



        {/* GENERAL RESULT */}
        {step === 2 && (
          <div className="result-stage">
            <div className="result-spark">✨</div>
            <div className="eyebrow muted">YOUR OFFICIAL RESULT</div>
            {item.category === "OD CHAOS" && (() => {
              const verdicts = {
                update: { badge: "HEART RATE: +140 BPM 💓", title: "100% SCREEN ILLUSION", sub: "Zero files touched. Your phone didn't even blink." },
                virus: { badge: "DIAGNOSIS: CHRONIC SCROLLING 📱", title: "QUARANTINE COMPLETE", sub: "No actual viruses found—just unmatched screen time." },
                button: { badge: "WILLPOWER SCORE: 0 / 100 🔴", title: "CURIOSITY WINS AGAIN", sub: "We literally told you not to press it." },
                iq: { badge: "CERTIFIED MENSA-ISH 🎓", title: "OFFICIAL CHAOS GENIUS", sub: "Science cannot explain how your brain works." }
              };
              const v = verdicts[item.id] || { badge: "SIMULATION COMPLETE ⚡", title: "GOTCHA!", sub: "Completely harmless visual chaos." };
              return (
                <div className="prank-final-reveal">
                  <span>{sharedSim?.mode === "friend" ? "🎯" : "⚡"}</span>
                  <div className="eyebrow muted" style={{ justifyContent: "center", marginTop: 6 }}>{v.badge}</div>
                  <h3>{sharedSim?.mode === "friend" ? `${sharedSim.sender.toUpperCase()} GOT YOU!` : v.title}</h3>
                  <p>{sharedSim?.mode === "friend" ? `${sharedSim.sender} sent you this trap. ${v.sub}` : v.sub}</p>
                </div>
              );
            })()}
            <p className="result-text">{result}</p>
            <div className="result-actions">
              <button className="primary-btn" onClick={() => { playSound("tap"); onShare(result); }}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share result"}
              </button>
              <button className="secondary-btn dark" onClick={() => { playSound("tap"); setStep(0); setResult(""); }}>
                <RotateCcw size={16}/> Play again
              </button>
            </div>
          </div>
        )}

        {/* PERSONALITY QUIZ */}
        {step === 4 && (
          <div className="result-stage">
            <div className="eyebrow muted">CHOOSE YOUR VIBE</div>
            <div className="choice-grid">
              {["Curious 🧐", "Fearless 🦁", "Creative 🎨", "Chill 😎"].map(v => (
                <button className={choice === v ? "choice active" : "choice"} key={v}
                  onClick={() => { playSound("tap"); setChoice(v); }}>{v}</button>
              ))}
            </div>
            <button className="primary-btn" disabled={!choice} onClick={() => {
              setResult(`Your secret superpower is ${choice.split(" ")[0]} energy. Use it wisely. Or don't. 😄`);
              playSound("reveal");
              setStep(2);
            }}>Reveal my power</button>
          </div>
        )}

        {/* STEP-BY-STEP PSYCHOLOGICAL PRIMING */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "steps" && (
          <div className="result-stage">
            <div className="eyebrow muted">
              PHASE {String(mindInstructionIndex + 1).padStart(2, "0")} / {String(currentPuzzle.instructions.length + 1).padStart(2, "0")}
            </div>
            <div className="result-spark">{currentPuzzle.icon}</div>
            <h3>{currentPuzzle.title}</h3>
            <p className="result-text">
              {mindInstructionIndex === 0
                ? currentPuzzle.intro
                : currentPuzzle.instructions[mindInstructionIndex - 1]}
            </p>
            <div className="result-actions">
              {mindInstructionIndex > 0 && (
                <button className="secondary-btn dark" onClick={() => { playSound("step"); setMindInstructionIndex(i => i - 1); }}>Back</button>
              )}
              <button className="primary-btn" onClick={() => {
                playSound(mindInstructionIndex < currentPuzzle.instructions.length ? "step" : "reveal");
                if (mindInstructionIndex < currentPuzzle.instructions.length) {
                  setMindInstructionIndex(i => i + 1);
                } else {
                  setStep(6);
                }
              }}>
                {mindInstructionIndex < currentPuzzle.instructions.length ? "Got it →" : "Read My Mind 🔮"}
              </button>
            </div>
          </div>
        )}

        {/* THE VANISHING CARD ILLUSION */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "cardvanish" && (
          <div className="result-stage">
            <div className="eyebrow muted">{vanishPhase === "pick" ? "STEP 1: FOCUS ON ONE CARD" : "STEP 2: LOOK AT THE MATRIX"}</div>
            <h3>{vanishPhase === "pick" ? "Lock ONE card in your mind (don't tap it)" : "Your secret card has vanished!"}</h3>
            <div className="choice-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {(vanishPhase === "pick"
                ? ["K♠", "Q♥", "J♦", "A♣", "10♥", "K♦"]
                : ["Q♠", "J♥", "10♦", "K♣", "A♦"]
              ).map(card => (
                <div key={card} className="choice" style={{ fontSize: 22, fontWeight: 700, padding: "18px 8px", textAlign: "center" }}>
                  {card}
                </div>
              ))}
            </div>
            {vanishPhase === "pick" ? (
              <button className="primary-btn" onClick={() => { playSound("magic"); setVanishPhase("vanished"); }}>
                I've locked my card 🔒
              </button>
            ) : (
              <div className="result-actions">
                <button className="primary-btn" onClick={() => { playSound("reveal"); setResult("Your secret card vanished into thin air! 🃏"); setStep(6); }}>
                  Whoa, how?! 💡
                </button>
                <button className="secondary-btn dark" onClick={() => setVanishPhase("pick")}>
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ZERO-MATH BINARY TELEPATHY MATRIX */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "binarymatrix" && (() => {
          const bit = 1 << matrixStep;
          const gridNums = Array.from({ length: 31 }, (_, i) => i + 1).filter(n => (n & bit) !== 0);
          const answerNo = () => {
            playSound("tap");
            if (matrixStep < 4) setMatrixStep(s => s + 1);
            else {
              playSound("reveal");
              setResult(`Your secret number is ${matrixSum || 31}!`);
              setStep(6);
            }
          };
          const answerYes = () => {
            playSound("step");
            const nextSum = matrixSum + bit;
            setMatrixSum(nextSum);
            if (matrixStep < 4) setMatrixStep(s => s + 1);
            else {
              playSound("reveal");
              setResult(`Your secret number is ${nextSum}!`);
              setStep(6);
            }
          };
          return (
            <div className="result-stage">
              <div className="eyebrow muted">SCAN {matrixStep + 1} OF 5 · NO MATH NEEDED</div>
              <h3>Is your secret number inside this grid?</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%" }}>
                {gridNums.map(n => (
                  <div key={n} className="choice" style={{ padding: "10px 4px", fontWeight: 700, fontSize: 15 }}>
                    {n}
                  </div>
                ))}
              </div>
              <div className="result-actions" style={{ width: "100%" }}>
                <button className="primary-btn" style={{ flex: 1 }} onClick={answerYes}>YES, I see it 👁️</button>
                <button className="secondary-btn dark" style={{ flex: 1 }} onClick={answerNo}>NO, not here</button>
              </div>
            </div>
          );
        })()}

        {/* SEALED ENVELOPE MAGICIAN'S FORCE */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "sealedforce" && (
          <div className="result-stage">
            <div className="eyebrow muted">✉️ SEALED PREDICTION LOCKED</div>
            <h3>{forcePrompt}</h3>
            <div className="choice-grid">
              {forceItems.map(itemLabel => (
                <button
                  key={itemLabel}
                  className="choice"
                  style={{ fontWeight: 600, fontSize: 13 }}
                  onClick={() => {
                    playSound("tap");
                    const target = "EMERALD DRAGON 🐉";
                    if (forceItems.length === 4) {
                      const remaining = forceItems.filter(x => x !== itemLabel);
                      if (!remaining.includes(target)) {
                        setForceItems([itemLabel, target]);
                        setForcePrompt("Interesting! Those two survive. Now tap ONE to eliminate:");
                      } else {
                        setForceItems(remaining.slice(0, 3));
                        setForcePrompt("Good. Now tap ONE MORE to eliminate:");
                      }
                    } else if (forceItems.length === 3) {
                      const remaining = forceItems.filter(x => x !== itemLabel);
                      if (!remaining.includes(target)) {
                        setForceItems([itemLabel, target]);
                      } else {
                        setForceItems(remaining);
                      }
                      setForcePrompt("Final showdown! Tap ONE icon to decide:");
                    } else {
                      playSound("reveal");
                      setResult(target);
                      setStep(6);
                    }
                  }}
                >
                  {itemLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BIRTHDAY WEEKDAY FINDER */}
        {step === 5 && item.id === "mind" && currentPuzzle.type === "weekday" && (
          <div className="result-stage" style={{ textAlign: "left" }}>
            <div className="result-spark" style={{ textAlign: "center" }}>📅</div>
            <h3 style={{ textAlign: "center" }}>When were you born?</h3>
            <label style={{ display: "block", marginTop: 14, width: "100%" }}>
              Your date of birth
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={fieldStyle}/>
            </label>
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              disabled={!birthDate} onClick={revealWeekday}>Find my birthday weekday ✨</button>
            <p className="modal-description" style={{ textAlign: "center", marginTop: 10 }}>
              Your date is processed in this browser and is not saved.
            </p>
          </div>
        )}



        {/* PREDICTION RESULT */}
        {step === 6 && item.id === "mind" && (
          <div className="result-stage">
            <div className="result-spark">🔮</div>
            <div className="eyebrow muted">ODDORA'S PREDICTION</div>
            <h3>I've got your answer...</h3>
            <h2 className="gradient-text" style={{ fontSize: "clamp(30px, 8vw, 48px)", margin: "12px 0" }}>
              {prediction}
            </h2>
            <p className="result-text">
              {currentPuzzle.type === "steps" ? currentPuzzle.reveal : "That's what the mystery reveals. Did ODDORA get it right?"}
            </p>
            <div className="result-actions" style={{ flexWrap: "wrap" }}>
              <button className="primary-btn" onClick={sharePrediction}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share my result"}
              </button>
              <button className="secondary-btn dark" onClick={() => setShowMagicPopup(true)}>
                💡 How did I know?
              </button>
            </div>
            <p className="modal-description" style={{ marginTop: 14 }}>
              Share your prediction first. The secret is waiting if you're curious.
            </p>
          </div>
        )}

        {/* SECRET EXPLANATION */}
        {step === 7 && item.id === "mind" && (
          <div className="result-stage">
            <div className="result-spark">✨</div>
            <div className="eyebrow muted">THE MAGIC EXPLAINED</div>
            <h2 className="gradient-text">{prediction}</h2>
            <p className="result-text">
              {currentPuzzle.type === "steps" ? currentPuzzle.reveal : result}
            </p>
            <div className="mind-explain-box">
              <div className="eyebrow muted">WHY IT WORKS</div>
              <p className="modal-description" style={{ marginTop: 8 }}>{currentPuzzle.explanation}</p>
            </div>
            <div className="result-actions" style={{ flexWrap: "wrap" }}>
              <button className="primary-btn" onClick={sharePrediction}>
                <Share2 size={17}/>{copied ? "Copied!" : "Share result"}
              </button>
              <button className="secondary-btn dark" onClick={() => { resetMind(); setStep(0); }}>
                <RotateCcw size={16}/> Back to Mind Lab
              </button>
            </div>
          </div>
        )}

        {/* MAGIC REVEAL POPUP */}
        {showMagicPopup && step === 6 && (
          <div onMouseDown={e => {
            if (e.target === e.currentTarget) setShowMagicPopup(false);
          }} style={{
            position: "absolute", inset: 0, zIndex: 20, display: "grid",
            placeItems: "center", padding: 20, borderRadius: "inherit",
            background: "rgba(5,3,14,.88)", backdropFilter: "blur(9px)"
          }}>
            <div style={{
              width: "100%", maxWidth: 340, padding: 24, borderRadius: 20,
              textAlign: "center", background: "#191528", color: "#fff",
              border: "1px solid rgba(190,160,255,.3)",
              boxShadow: "0 20px 70px rgba(0,0,0,.5)"
            }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>💡</div>
              <div className="eyebrow muted">THE MAGIC BEHIND THE MYSTERY</div>
              <h3>Want to know the magic trick?</h3>
              <p className="result-text">
                Your prediction is ready. Want ODDORA to show you exactly how it works?
              </p>
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }}
                onClick={revealMagic}>Show me the magic ✨</button>
              <button className="secondary-btn dark" style={{ marginTop: 10 }}
                onClick={() => setShowMagicPopup(false)}>Not yet</button>
            </div>
          </div>
        )}

        <div className="modal-foot">
          <span><Sparkles size={13}/> Harmless fun. Nothing is really hacked.</span>
          <span>ODDORA</span>
        </div>
      </div>
    </div>
  );
}

const XO_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function getSmartAIMove(board) {
  const empty = board.map((v, i) => (v === "" ? i : null)).filter(v => v !== null);
  if (empty.length === 0) return -1;

  for (const idx of empty) {
    const test = [...board];
    test[idx] = "O";
    if (XO_WIN_LINES.some(line => line.every(c => test[c] === "O"))) return idx;
  }
  for (const idx of empty) {
    const test = [...board];
    test[idx] = "X";
    if (XO_WIN_LINES.some(line => line.every(c => test[c] === "X"))) return idx;
  }
  if (board[4] === "" && Math.random() > 0.25) return 4;
  return empty[Math.floor(Math.random() * empty.length)];
}

function XOMultiplayer({ onBack, onExplore, onCreateChallenge, initialRoomCode = "", playSound }) {
  const [mode, setMode] = useState(initialRoomCode ? "multi" : "select");
  const [soloBoard, setSoloBoard] = useState(["", "", "", "", "", "", "", "", ""]);
  const [soloWinner, setSoloWinner] = useState("");
  const [soloThinking, setSoloThinking] = useState(false);
  const [botBanter, setBotBanter] = useState("Your move, human. Don't overthink it.");

  const [uid, setUid] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Enter your display name to create or join a game.");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setMode("multi");
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (mode !== "multi") return undefined;
    let alive = true;
    signInPlayer()
      .then(credential => {
        if (!alive) return;
        setUid(credential.user.uid);
        setNotice("You're connected. Choose your name and start playing.");
      })
      .catch(() => {
        if (alive) setNotice("Could not connect to Firebase. Check your internet or play Solo AI mode.");
      });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (!roomCode || mode !== "multi") return undefined;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val.status === "finished" && room?.status === "playing") {
          playSound?.("reveal");
        }
        setRoom(val);
      } else {
        setRoom(null);
        setNotice("This room no longer exists.");
      }
    }, () => {
      setNotice("Unable to read this room. Check your Realtime Database rules.");
    });
    return () => unsubscribe();
  }, [roomCode, mode]);

  function handleSoloCell(index) {
    if (soloBoard[index] || soloWinner || soloThinking) return;
    playSound?.("tap");
    triggerHaptic(12);

    const nextBoard = [...soloBoard];
    nextBoard[index] = "X";
    setSoloBoard(nextBoard);

    const playerWon = XO_WIN_LINES.some(line => line.every(c => nextBoard[c] === "X"));
    if (playerWon) {
      setSoloWinner("X");
      setBotBanter("Okay fine, you got lucky. Rematch? 🙄");
      playSound?.("reveal");
      triggerHaptic([20, 30, 20]);
      return;
    }
    if (nextBoard.every(Boolean)) {
      setSoloWinner("draw");
      setBotBanter("A tie! Great minds think alike.");
      playSound?.("step");
      return;
    }

    setSoloThinking(true);
    setBotBanter("Calculating 14,000,605 outcomes...");
    window.setTimeout(() => {
      const aiIdx = getSmartAIMove(nextBoard);
      if (aiIdx >= 0) nextBoard[aiIdx] = "O";
      setSoloBoard([...nextBoard]);
      setSoloThinking(false);
      playSound?.("step");

      const aiWon = XO_WIN_LINES.some(line => line.every(c => nextBoard[c] === "O"));
      if (aiWon) {
        setSoloWinner("O");
        setBotBanter("Too easy! Want another shot? 😎");
        playSound?.("wrong");
      } else if (nextBoard.every(Boolean)) {
        setSoloWinner("draw");
        setBotBanter("Stalemate! Nobody wins.");
      } else {
        const quips = ["Interesting choice...", "Are you sure about that?", "Your turn!", "I saw that coming."];
        setBotBanter(quips[Math.floor(Math.random() * quips.length)]);
      }
    }, 450);
  }

  function resetSolo() {
    playSound?.("tap");
    setSoloBoard(["", "", "", "", "", "", "", "", ""]);
    setSoloWinner("");
    setSoloThinking(false);
    setBotBanter("Fresh board. Your move!");
  }

  const cleanName = value => value.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createRoom() {
    const name = cleanName(playerName);
    if (!uid || busy || !name) { setNotice("Enter your name first."); return; }
    setBusy(true); setNotice("Creating your challenge...");
    try {
      let code = "";
      let exists = true;
      for (let attempt = 0; attempt < 8 && exists; attempt += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snapshot = await get(ref(database, `rooms/${code}`));
        exists = snapshot.exists();
      }
      if (exists) throw new Error("Could not generate a room code. Please try again.");
      const newRoom = {
        board: ["", "", "", "", "", "", "", "", ""],
        turn: "X", players: { X: uid, O: "" },
        playerNames: { X: name, O: "" },
        status: "waiting", winner: "", gamesPlayed: 0,
        createdAt: Date.now()
      };
      await set(ref(database, `rooms/${code}`), newRoom);
      setRoomCode(code);
      playSound?.("magic");
      setNotice("Challenge created! Share the invitation link with your friend.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("xo", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not create the room.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    const name = cleanName(playerName);

    if (!uid || busy) return;
    if (!name) { setNotice("Enter your display name before joining."); return; }
    if (code.length !== 6) { setNotice("Enter a valid 6-character room code."); return; }

    setBusy(true);
    setNotice("Joining your friend's challenge...");

    try {
      const roomRef = ref(database, `rooms/${code}`);
      const existingSnapshot = await get(roomRef);

      if (!existingSnapshot.exists()) {
        throw new Error("Room not found. Ask your friend to create a new challenge.");
      }

      const existingRoom = existingSnapshot.val();
      if (!Array.isArray(existingRoom.board) || existingRoom.gameType === "catch-heart") {
        throw new Error("That code belongs to a different game. Use an XO invitation link.");
      }

      if (existingRoom.players?.X === uid) {
        setRoomCode(code);
        setNotice("Welcome back! You're Player X.");
        return;
      }

      if (existingRoom.players?.O && existingRoom.players.O !== uid) {
        throw new Error("This room is already full.");
      }

      let usedPreflightFallback = false;
      const result = await runTransaction(roomRef, current => {
        if (!current) {
          if (usedPreflightFallback) return;
          usedPreflightFallback = true;
          current = existingRoom;
        }
        if (!Array.isArray(current.board) || current.gameType === "catch-heart") return;
        if (current.players?.X === uid) return current;
        if (current.players?.O === uid) {
          return { ...current, playerNames: { ...(current.playerNames || {}), O: name } };
        }
        if (current.status !== "waiting" || current.players?.O) return;

        return {
          ...current,
          players: { ...current.players, O: uid },
          playerNames: { ...(current.playerNames || {}), O: name },
          status: "playing"
        };
      });

      if (!result.committed || !result.snapshot.exists()) {
        throw new Error("Could not join this room. It may have just been filled.");
      }

      setRoomCode(code);
      playSound?.("magic");
      setNotice("Joined! You're Player O. Your friend starts as X.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("xo", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not join the room.");
    } finally {
      setBusy(false);
    }
  }

  function mySymbol() {
    if (room?.players?.X === uid) return "X";
    if (room?.players?.O === uid) return "O";
    return "";
  }

  async function playCell(index) {
    const symbol = mySymbol();
    if (!roomCode || !uid || !room || !symbol || room.status !== "playing" || room.turn !== symbol || room.board?.[index]) return;
    playSound?.("tap");
    triggerHaptic(12);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.status !== "playing" || current.turn !== symbol || current.board?.[index]) return;
        const board = [...current.board];
        board[index] = symbol;
        const winningLine = XO_WIN_LINES.find(line => line.every(cell => board[cell] === symbol));
        const draw = !winningLine && board.every(Boolean);
        return {
          ...current,
          board,
          turn: symbol === "X" ? "O" : "X",
          status: winningLine || draw ? "finished" : "playing",
          winner: winningLine ? symbol : draw ? "draw" : ""
        };
      });
    } catch {
      setNotice("Move could not be saved. Check your connection.");
    }
  }

  async function restartGame(swapSides = false) {
    if (!roomCode || !room || room.status !== "finished" || !mySymbol()) return;
    setBusy(true);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.status !== "finished" || !current.players?.X || !current.players?.O) return;
        const players = swapSides ? { X: current.players.O, O: current.players.X } : current.players;
        const playerNames = swapSides
          ? { X: current.playerNames?.O || "Player O", O: current.playerNames?.X || "Player X" }
          : (current.playerNames || {});
        return {
          ...current,
          players,
          playerNames,
          board: ["", "", "", "", "", "", "", "", ""],
          turn: "X",
          status: "playing",
          winner: "",
          gamesPlayed: (current.gamesPlayed || 0) + 1
        };
      });
    } finally { setBusy(false); }
  }

  async function shareInvitation() {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("xo", roomCode);
    const shareUrl = url.toString();
    const text = `${room?.playerNames?.X || playerName || "Your friend"} challenged you to XO on ODDORA! Join the game:`;
    try {
      if (navigator.share) await navigator.share({ title: "XO Challenge – ODDORA", text, url: shareUrl });
      else { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }

  async function shareXOResult() {
    if (!room || room.status !== "finished") return;
    const winnerName = room.winner === "draw"
      ? "It's a draw"
      : room.playerNames?.[room.winner] || (room.winner === "X" ? "Player X" : "Player O");
    const loserName = room.playerNames?.[room.winner === "X" ? "O" : "X"] || "their friend";
    const resultText = `❎⭕ ODDORA XO: ${winnerName === "It's a draw" ? winnerName : `${winnerName} won against ${loserName}`}! Play your own game:`;
    const playUrl = `${window.location.origin}/`;
    try {
      const file = await shareODDORAResultCard({
        game: "XO Multiplayer",
        headline: winnerName === "It's a draw" ? "IT'S A DRAW!" : `${winnerName.toUpperCase()} WINS!`,
        subtitle: winnerName === "It's a draw" ? "A close match. Time for a rematch." : `${winnerName} won the game against ${loserName}.`,
        detail: "XO · ODDORA",
        quote: "One game down. The fun isn't.",
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "ODDORA XO Result", text: resultText, url: playUrl, files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-xo-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        await navigator.clipboard?.writeText(`${resultText}\n${playUrl}`);
        setNotice("Result image downloaded and game link copied.");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (mode === "select") {
    return (
      <div className="xo-game-wrap">
        <div className="xo-welcome">
          <div className="xo-mark">❎⭕</div>
          <h3>Choose how you want to play</h3>
          <p className="modal-description">Play solo right now against ODDORA AI or invite a friend.</p>
        </div>
        <div className="prank-mode-options">
          <button type="button" className="prank-mode-card active" onClick={() => { playSound?.("tap"); setMode("solo"); }}>
            <span><Bot size={28}/></span>
            <strong>Solo vs ODDORA AI</strong>
            <small>Instant match · Zero wait</small>
          </button>
          <button type="button" className="prank-mode-card" onClick={() => { playSound?.("tap"); setMode("multi"); }}>
            <span><Users size={28}/></span>
            <strong>Challenge a Friend</strong>
            <small>Live room · Share link</small>
          </button>
        </div>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  if (mode === "solo") {
    return (
      <div className="xo-game-wrap">
        <div className="xo-players">
          <div className={!soloThinking && !soloWinner ? "xo-player active" : "xo-player"}>
            <b className="xo-player-symbol">X</b><span>You</span>
          </div>
          <div className={soloThinking ? "xo-player active" : "xo-player"}>
            <b className="xo-player-symbol xo-o">O</b><span>ODDORA AI</span>
          </div>
        </div>
        <div className="xo-status">
          <span className="eyebrow muted">SOLO ARENA</span>
          <strong>{soloWinner === "X" ? "You beat ODDORA AI! 🎉" : soloWinner === "O" ? "ODDORA AI wins! 🤖" : soloWinner === "draw" ? "It's a draw! 🤝" : botBanter}</strong>
        </div>
        <div className="xo-board">
          {soloBoard.map((cell, index) => (
            <button
              key={index}
              className={`xo-cell ${cell ? `played ${cell.toLowerCase()}` : ""}`}
              onClick={() => handleSoloCell(index)}
              disabled={Boolean(cell) || Boolean(soloWinner) || soloThinking}
            >
              {cell}
            </button>
          ))}
        </div>
        {soloWinner && (
          <button className="primary-btn xo-wide" onClick={resetSolo}>
            <RotateCcw size={16}/> Play again vs AI
          </button>
        )}
        <button className="secondary-btn dark xo-wide" onClick={() => setMode("multi")}>
          <Users size={15}/> Switch to Friend Multiplayer
        </button>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  const symbol = mySymbol();
  const myName = symbol ? (room?.playerNames?.[symbol] || (symbol === "X" ? "Player X" : "Player O")) : "";
  const opponentSymbol = symbol === "X" ? "O" : "X";
  const opponentName = room?.playerNames?.[opponentSymbol] || (opponentSymbol === "X" ? "Player X" : "Player O");
  const statusText = !room
    ? "Create a challenge or join your friend's invitation."
    : room.status === "waiting"
      ? "Waiting for your friend to join..."
      : room.status === "finished"
        ? (room.winner === "draw" ? "It's a draw! Great game." : room.winner === symbol ? `${myName} wins! 🎉` : `${opponentName} wins this round!`)
        : room.turn === symbol
          ? `${myName}, it's your turn!`
          : `Waiting for ${opponentName}...`;

  return (
    <div className="xo-game-wrap">
      {!roomCode ? (
        <>
          <div className="xo-welcome"><div className="xo-mark">❎⭕</div><h3>Play Tic-Tac-Toe live</h3><p className="modal-description">Challenge a friend to a live XO match.</p></div>
          <label className="xo-label" htmlFor="xo-player-name">YOUR DISPLAY NAME</label>
          <input id="xo-player-name" className="xo-input" value={playerName} onChange={e => setPlayerName(e.target.value.slice(0, 18))} placeholder="Enter the name you like" maxLength={18} />
          {initialRoomCode ? (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's game"}
              </button>
              <p className="xo-invite-note">Your friend invited you! Enter your name and join the game.</p>
            </>
          ) : (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={createRoom}>{busy ? "Please wait..." : "＋ Create challenge as X"}</button>
              <div className="xo-or"><span/> OR JOIN A FRIEND <span/></div>
              <input className="xo-input xo-code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-character invite code" maxLength={6} />
              <button className="secondary-btn dark xo-wide" disabled={!uid || busy || joinCode.length !== 6 || !cleanName(playerName)} onClick={joinRoom}>{busy ? "Joining..." : "Join friend's challenge"}</button>
              <button className="secondary-btn dark xo-wide" onClick={() => setMode("solo")}><Bot size={15}/> Play Solo vs ODDORA AI instead</button>
            </>
          )}
        </>
      ) : (
        <>
          <div className="xo-room-head">
            <div>
              <div className="eyebrow muted">ROOM CODE · {room?.gamesPlayed ? `GAME ${room.gamesPlayed + 1}` : "GAME 1"}</div>
              <strong className="xo-room-code">{roomCode}</strong>
            </div>
          </div>
          <div className="xo-players">
            <div className={symbol === "X" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol">X</b><span>{room?.playerNames?.X || "Waiting..."}</span></div>
            <div className={symbol === "O" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol xo-o">O</b><span>{room?.playerNames?.O || "Waiting for friend"}</span></div>
          </div>
          <div className="xo-status"><span className="eyebrow muted">YOU ARE {symbol || "CONNECTING"}</span><strong>{statusText}</strong></div>
          <div className="xo-board">
            {(room?.board || ["", "", "", "", "", "", "", "", ""]).map((cell, index) => (
              <button
                key={index}
                className={`xo-cell ${cell ? `played ${cell.toLowerCase()}` : ""}`}
                onClick={() => playCell(index)}
                disabled={!symbol || room?.status !== "playing" || room?.turn !== symbol || Boolean(cell)}
              >
                {cell}
              </button>
            ))}
          </div>
          {room?.status === "finished" && (
            <div role="dialog" aria-modal="true" aria-labelledby="xo-result-title" style={{
              position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center",
              padding: "22px", background: "rgba(5, 4, 12, .86)", backdropFilter: "blur(12px)"
            }}>
              <div style={{ width: "100%", maxWidth: 390, padding: "28px 22px", borderRadius: 24,
                textAlign: "center", color: "#fff", background: "linear-gradient(145deg, #211936, #12101f)",
                border: "1px solid rgba(177, 139, 255, .38)", boxShadow: "0 24px 90px rgba(0,0,0,.6)" }}>
                <div style={{ fontSize: 48, lineHeight: 1.2, marginBottom: 10 }}>
                  {room.winner === "draw" ? "🤝" : room.winner === symbol ? "🏆" : "😅"}
                </div>
                <div className="eyebrow muted" style={{ marginBottom: 8 }}>ODDORA · XO MULTIPLAYER</div>
                <h2 id="xo-result-title" style={{ fontSize: 29, lineHeight: 1.15, margin: "0 0 10px", color: "#fff" }}>
                  {room.winner === "draw" ? "IT'S A DRAW!" : room.winner === symbol ? "YOU WIN!" : "YOU LOST!"}
                </h2>
                <p style={{ color: "#c8bfdc", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
                  {room.winner === "draw" ? "Perfectly matched. Nobody is leaving without a rematch!" : room.winner === symbol ? "You conquered the board! Enjoy your victory." : "Revenge starts in the next round!"}
                </p>
                <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                  <button className="primary-btn xo-wide" disabled={busy} onClick={() => restartGame(false)}>↻ Rematch – Same sides</button>
                  <button className="secondary-btn dark xo-wide" disabled={busy} onClick={() => restartGame(true)}>⇄ Rematch – Swap sides</button>
                  <button className="secondary-btn dark xo-wide" onClick={shareXOResult}>
                    <Share2 size={15}/> {copied ? "Result copied" : "Share your result"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 18, marginTop: 4 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#b9a0ff", fontWeight: 800, marginBottom: 7 }}>GAME OVER. THE FUN ISN'T.</div>
                  <button className="secondary-btn dark xo-wide" onClick={onCreateChallenge}>✨ Create Your Own Challenge</button>
                  <button className="secondary-btn dark xo-wide" style={{ marginTop: 9 }} onClick={onExplore}>🎮 Explore ODDORA</button>
                </div>
              </div>
            </div>
          )}
          {room?.status === "waiting" && <button className="secondary-btn dark xo-wide" onClick={shareInvitation}><Share2 size={15}/> {copied ? "Link copied" : "Share invitation link"}</button>}
          <button className="secondary-btn dark xo-wide" onClick={() => { setRoomCode(""); setRoom(null); setJoinCode(""); const url = new URL(window.location.href); url.searchParams.delete("xo"); window.history.replaceState({}, "", url.toString()); }}>Leave room</button>
        </>
      )}
      <p className="modal-description xo-notice">{notice}</p>
      <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
    </div>
  );
}

const HEART_CHOICES = ["❤️", "💖", "💜", "💙", "💚", "💛", "🧡", "🩷", "🤍"];

function heartAttemptScore(attempts) {
  const extraPicks = Math.max(0, Number(attempts || 2) - 2);
  return Math.max(10, 100 - extraPicks * 5);
}

function CatchMyHeart({ onBack, onExplore, onCreateChallenge, initialRoomCode = "", playSound }) {
  const [mode, setMode] = useState(initialRoomCode ? "multi" : "select");
  const [soloPick, setSoloPick] = useState(null);
  const [aiPick, setAiPick] = useState(null);
  const [soloAttempts, setSoloAttempts] = useState(0);
  const [soloMatched, setSoloMatched] = useState(false);

  const [uid, setUid] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Enter your name to create a heart challenge or join a friend.");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setMode("multi");
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (mode !== "multi") return undefined;
    let alive = true;
    signInPlayer().then(credential => {
      if (!alive) return;
      setUid(credential.user.uid);
      setNotice("You're connected. Create a heart challenge or join your friend's link.");
    }).catch(() => {
      if (alive) setNotice("Could not connect. Check your internet or play Solo AI mode.");
    });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (!roomCode || mode !== "multi") return undefined;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val.status === "finished" && room?.status === "playing") {
          playSound?.("reveal");
        }
        setRoom(val);
      } else {
        setRoom(null);
        setNotice("This heart room no longer exists.");
      }
    }, () => {
      setNotice("Unable to read this room. Check your Realtime Database rules.");
    });
    return () => unsubscribe();
  }, [roomCode, mode]);

  useEffect(() => {
    if (!roomCode || room?.status !== "playing" || !room?.endsAt || mode !== "multi") return undefined;

    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((Number(room.endsAt) - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        runTransaction(ref(database, `rooms/${roomCode}`), current => {
          if (!current || current.gameType !== "catch-heart" || current.status !== "playing") return;
          if (Number(current.endsAt || 0) > Date.now()) return;
          return { ...current, status: "finished", finishReason: "timeout" };
        }).catch(() => {});
      }
    };

    updateClock();
    const timerId = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timerId);
  }, [roomCode, room?.status, room?.endsAt, mode]);

  function handleSoloHeart(index) {
    if (soloMatched) return;
    playSound?.("tap");
    triggerHaptic(14);
    const botIndex = Math.floor(Math.random() * HEART_CHOICES.length);
    const attempts = soloAttempts + 1;
    setSoloPick(index);
    setAiPick(botIndex);
    setSoloAttempts(attempts);

    if (index === botIndex) {
      setSoloMatched(true);
      playSound?.("reveal");
      triggerHaptic([25, 40, 25]);
    }
  }

  function resetSoloHeart() {
    playSound?.("tap");
    setSoloPick(null);
    setAiPick(null);
    setSoloAttempts(0);
    setSoloMatched(false);
  }

  const cleanName = value => value.trim().replace(/\s+/g, " ").slice(0, 18);
  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";
  const myChoice = mySide ? room?.choices?.[mySide] : "";
  const hasHeartChoice = value => value !== "" && value !== null && value !== undefined;
  const bothPicked = hasHeartChoice(room?.choices?.X) && hasHeartChoice(room?.choices?.O);

  async function createRoom() {
    const name = cleanName(playerName);
    if (!uid || busy || !name) { setNotice("Enter your name first."); return; }
    setBusy(true); setNotice("Creating your heart challenge...");
    try {
      let code = ""; let exists = true;
      for (let attempt = 0; attempt < 8 && exists; attempt += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snapshot = await get(ref(database, `rooms/${code}`));
        exists = snapshot.exists();
      }
      if (exists) throw new Error("Could not generate a room code. Please try again.");
      const newRoom = {
        gameType: "catch-heart", players: { X: uid, O: "" },
        playerNames: { X: name, O: "" }, choices: { X: null, O: null },
        attempts: 0, status: "waiting", round: 1, createdAt: Date.now()
      };
      await set(ref(database, `rooms/${code}`), newRoom);
      setRoomCode(code);
      playSound?.("magic");
      setNotice("Your heart challenge is ready. Invite your friend!");
      const url = new URL(window.location.href); url.search = ""; url.searchParams.set("heart", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not create the challenge.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const name = cleanName(playerName);
    const code = joinCode.trim().toUpperCase();

    if (!uid || busy || !name || code.length !== 6) {
      setNotice("Enter your name and the 6-character invite code.");
      return;
    }

    setBusy(true);
    setNotice("Joining your friend's heart challenge...");

    try {
      const roomRef = ref(database, `rooms/${code}`);
      const existingSnapshot = await get(roomRef);

      if (!existingSnapshot.exists()) {
        throw new Error("This heart room does not exist. Check the invite code.");
      }

      const existingRoom = existingSnapshot.val();
      if (existingRoom.gameType !== "catch-heart") {
        throw new Error("That code belongs to a different game.");
      }

      if (existingRoom.players?.X === uid) {
        throw new Error("You created this room. Open the invitation on another browser to join as Player 2.");
      }

      let usedPreflightFallback = false;
      const result = await runTransaction(roomRef, current => {
        if (!current) {
          if (usedPreflightFallback) return;
          usedPreflightFallback = true;
          current = existingRoom;
        }
        if (current.gameType !== "catch-heart") return;
        if (current.players?.X === uid) return current;
        if (current.players?.O === uid) {
          return { ...current, playerNames: { ...(current.playerNames || {}), O: name } };
        }
        if (current.status !== "waiting" || current.players?.O) return;

        return {
          ...current,
          players: { ...current.players, O: uid },
          playerNames: { ...(current.playerNames || {}), O: name },
          choices: { X: null, O: null },
          attempts: 0,
          startedAt: Date.now(),
          endsAt: Date.now() + 60000,
          status: "playing"
        };
      });

      if (!result.committed || !result.snapshot.exists()) {
        throw new Error("Could not join. The room may already be full.");
      }

      setRoomCode(code);
      playSound?.("magic");
      setNotice("You're in! Choose a heart when you're ready.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("heart", code);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      setNotice(error.message || "Could not join this room.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseHeart(index) {
    if (!roomCode || !mySide || room?.status !== "playing" || busy) return;
    playSound?.("tap");
    triggerHaptic(12);
    setBusy(true);

    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.gameType !== "catch-heart" || current.status !== "playing") return;
        if (Number(current.endsAt || 0) <= Date.now()) {
          return { ...current, status: "finished", finishReason: "timeout" };
        }

        const previousChoice = current.choices?.[mySide];
        if (previousChoice === index) return current;

        const choices = { ...(current.choices || {}), [mySide]: index };
        const attempts = Number(current.attempts || 0) + 1;
        const matched = choices.X !== null && choices.X !== undefined &&
          choices.O !== null && choices.O !== undefined &&
          choices.X === choices.O;

        return {
          ...current,
          choices,
          attempts,
          status: matched ? "finished" : "playing",
          finishReason: matched ? "match" : null
        };
      });
    } finally {
      setBusy(false);
    }
  }

  async function playAgain(swapSides = false) {
    if (!roomCode || !room || room.status !== "finished" || !mySide || busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.gameType !== "catch-heart" || current.status !== "finished" || !current.players?.X || !current.players?.O) return;
        const players = swapSides ? { X: current.players.O, O: current.players.X } : current.players;
        const playerNames = swapSides
          ? { X: current.playerNames?.O || "Player 2", O: current.playerNames?.X || "Player 1" }
          : (current.playerNames || {});
        return {
          ...current, players, playerNames,
          choices: { X: null, O: null }, attempts: 0, status: "playing",
          revealed: false, finishReason: null, startedAt: Date.now(),
          endsAt: Date.now() + 60000, round: (current.round || 1) + 1
        };
      });
    } finally { setBusy(false); }
  }

  async function shareInvitation() {
    if (!roomCode) return;
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set("heart", roomCode);
    const shareUrl = url.toString();
    const shareText = `${room?.playerNames?.X || playerName || "Your friend"} sent you a Catch My Heart challenge on ODDORA!`;
    try {
      if (navigator.share) await navigator.share({ title: "Catch My Heart · ODDORA", text: shareText, url: shareUrl });
      else { await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }

  async function shareHeartResult() {
    const attempts = Number(room?.attempts || 0);
    const score = heartAttemptScore(attempts);
    const quote = sameHeart
      ? "Some hearts just know where to meet."
      : "Different choices, same lovely chaos.";
    const resultText = sameHeart
      ? `💘 ${room?.playerNames?.X || "Player 1"} & ${room?.playerNames?.O || "Player 2"} found their match in ${attempts} picks! ODDORA match score: ${score}%.`
      : `⏰ Our Catch My Heart round ran out of time. Play another round on ODDORA!`;
    const playUrl = `${window.location.origin}/`;
    try {
      const file = await shareODDORAResultCard({
        game: "Catch My Heart",
        headline: sameHeart ? "HEARTS IN SYNC!" : "TIME'S UP!",
        subtitle: sameHeart
          ? `${room?.playerNames?.X || "Player 1"} & ${room?.playerNames?.O || "Player 2"} found their match.`
          : "The clock ran out. Ready for another round?",
        detail: sameHeart ? `${score}% ODDORA MATCH SCORE · ${attempts} PICKS` : "TRY AGAIN TOGETHER",
        quote,
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "Catch My Heart · ODDORA", text: resultText, url: playUrl, files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-catch-my-heart-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        await navigator.clipboard?.writeText(`${resultText}\n${playUrl}`);
        setNotice("Result image downloaded and game link copied.");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (mode === "select") {
    return (
      <div className="heart-game-wrap">
        <div className="heart-welcome">
          <div className="heart-welcome-icon">💘</div>
          <h3>Choose your heart mode</h3>
          <p className="modal-description">Test your intuition against ODDORA AI solo or sync up with a friend.</p>
        </div>
        <div className="prank-mode-options">
          <button type="button" className="prank-mode-card active" onClick={() => { playSound?.("tap"); setMode("solo"); }}>
            <span><Bot size={28}/></span>
            <strong>Solo vs ODDORA AI</strong>
            <small>Mind-sync intuition test</small>
          </button>
          <button type="button" className="prank-mode-card" onClick={() => { playSound?.("tap"); setMode("multi"); }}>
            <span><Users size={28}/></span>
            <strong>Play with a Friend</strong>
            <small>60s live heart sync</small>
          </button>
        </div>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  if (mode === "solo") {
    const score = heartAttemptScore(soloAttempts + 1);
    return (
      <div className="heart-game-wrap">
        <div className="heart-pick-status">
          <strong>{soloMatched ? "💞 HEARTS IN SYNC!" : "Pick the same heart as ODDORA AI 💗"}</strong>
          <span>
            {soloPick !== null
              ? `You picked ${HEART_CHOICES[soloPick]} · AI picked ${HEART_CHOICES[aiPick]} (Picks: ${soloAttempts})`
              : "Tap any heart below to test your intuition"}
          </span>
        </div>

        {soloMatched ? (
          <div className="heart-result">
            <div className="heart-burst">💞</div>
            <h3>MATCHED IN {soloAttempts} {soloAttempts === 1 ? "PICK" : "PICKS"}!</h3>
            <div className="heart-score-card">
              <strong>{score}%</strong>
              <span>INTUITION SYNC SCORE</span>
              <small>You and ODDORA AI chose {HEART_CHOICES[soloPick]}</small>
            </div>
            <button className="primary-btn xo-wide" onClick={resetSoloHeart}>
              <RotateCcw size={16}/> Play again vs AI
            </button>
          </div>
        ) : (
          <div className="heart-grid">
            {HEART_CHOICES.map((heart, index) => (
              <button
                key={heart}
                type="button"
                className={`heart-choice ${soloPick === index ? "selected" : ""}`}
                onClick={() => handleSoloHeart(index)}
              >
                {heart}
              </button>
            ))}
          </div>
        )}

        <button className="secondary-btn dark xo-wide" onClick={() => setMode("multi")}>
          <Users size={15}/> Challenge a Friend Live
        </button>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  const sameHeart = bothPicked && room.choices.X === room.choices.O;
  const totalAttempts = Number(room?.attempts || 0);
  const matchScore = heartAttemptScore(totalAttempts);

  return (
    <div className="heart-game-wrap">
      {!roomCode ? (
        <>
          <div className="heart-welcome"><div className="heart-welcome-icon">💘</div><h3>Catch My Heart</h3><p className="modal-description">Two players. One secret heart each. Let's see if your choices match.</p></div>
          <label className="xo-label" htmlFor="heart-player-name">YOUR DISPLAY NAME</label>
          <input id="heart-player-name" className="xo-input" value={playerName} onChange={e => setPlayerName(e.target.value.slice(0, 18))} placeholder="Enter your name" maxLength={18} />
          {initialRoomCode ? (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's game"}
              </button>
              <p className="xo-invite-note">Your friend invited you! Enter your name and join the heart game.</p>
            </>
          ) : (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={createRoom}>
                {busy ? "Please wait..." : "💘 Create heart challenge"}
              </button>
              <div className="xo-or"><span/> OR JOIN A FRIEND <span/></div>
              <input className="xo-input xo-code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-character invite code" maxLength={6} />
              <button className="secondary-btn dark xo-wide" disabled={!uid || busy || joinCode.length !== 6 || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join friend's challenge"}
              </button>
              <button className="secondary-btn dark xo-wide" onClick={() => setMode("solo")}><Bot size={15}/> Play Solo vs ODDORA AI instead</button>
            </>
          )}
        </>
      ) : !room ? (
        <div className="heart-waiting"><div className="heart-welcome-icon">💗</div><h3>Loading your heart room...</h3></div>
      ) : (
        <>
          <div className="xo-room-head"><div><div className="eyebrow muted">HEART ROOM · ROUND {room.round || 1}</div><strong className="xo-room-code">{roomCode}</strong></div></div>
          <div className="xo-players">
            <div className={mySide === "X" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol">♥</b><span>{room.playerNames?.X || "Player 1"}</span></div>
            <div className={mySide === "O" ? "xo-player active" : "xo-player"}><b className="xo-player-symbol xo-o">♥</b><span>{room.playerNames?.O || "Waiting for friend"}</span></div>
          </div>
          {room.status === "waiting" ? (
            <div className="heart-waiting"><div className="heart-welcome-icon">💌</div><h3>Waiting for your person...</h3><p>Share the invite link. Your friend joins as Player 2.</p></div>
          ) : room.status === "finished" ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="heart-result-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                display: "grid",
                placeItems: "center",
                padding: "22px",
                background: "rgba(5, 4, 12, .86)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                overflowY: "auto"
              }}
            >
              <div
                className="heart-result"
                role="status"
                aria-live="polite"
                style={{
                  width: "100%",
                  maxWidth: 390,
                  maxHeight: "min(88vh, 820px)",
                  overflowY: "auto",
                  padding: "28px 22px",
                  borderRadius: 24,
                  textAlign: "center",
                  color: "#fff",
                  background: "linear-gradient(145deg, #211936, #12101f)",
                  border: "1px solid rgba(231, 117, 207, .38)",
                  boxShadow: "0 24px 90px rgba(0,0,0,.6)"
                }}
              >
                <div className="heart-burst">{sameHeart ? "💞" : "⏰"}</div>
                <div className="eyebrow muted">ODDORA · CATCH MY HEART</div>
                <h3 id="heart-result-title">{sameHeart ? "HEARTS IN SYNC!" : "TIME'S UP!"}</h3>
                <p className="heart-result-copy">
                  {sameHeart
                    ? "You both found the same heart. Now that's a lovely coincidence!"
                    : "The clock ran out! Different picks, same team — try another round."}
                </p>
                {sameHeart && (
                  <div className="heart-score-card">
                    <strong>{matchScore}%</strong>
                    <span>ODDORA MATCH SCORE</span>
                    <small>Matched in {totalAttempts} heart {totalAttempts === 1 ? "pick" : "picks"}</small>
                  </div>
                )}
                <p className="heart-result-quote">
                  {sameHeart
                    ? "“Some hearts just know where to meet.” 💗"
                    : "“Different choices, same lovely chaos.” 💞"}
                </p>
                <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
                  <button className="primary-btn xo-wide" disabled={busy} onClick={() => playAgain(false)}>↻ Rematch – Same sides</button>
                  <button className="secondary-btn dark xo-wide" disabled={busy} onClick={() => playAgain(true)}>⇄ Rematch – Swap sides</button>
                  <button className="secondary-btn dark xo-wide" onClick={shareHeartResult}>
                    <Share2 size={15}/> {copied ? "Result copied" : "Share your result"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 18, marginTop: 4 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#b9a0ff", fontWeight: 800, marginBottom: 7 }}>GAME OVER. THE FUN ISN'T.</div>
                  <button className="secondary-btn dark xo-wide" onClick={onCreateChallenge}>✨ Create Your Own Challenge</button>
                  <button className="secondary-btn dark xo-wide" style={{ marginTop: 9 }} onClick={onExplore}>🎮 Explore ODDORA</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="heart-pick-status">
                <strong>Tap hearts until you both find the same one 💗</strong>
                <span>
                  Your pick: {myChoice !== null && myChoice !== undefined ? HEART_CHOICES[myChoice] : "Not picked yet"}
                </span>
                <strong className="heart-timer">⏱ 00:{String(secondsLeft).padStart(2, "0")}</strong>
              </div>
              <div className="heart-grid" aria-label="Choose a heart">
                {HEART_CHOICES.map((heart, index) => (
                  <button
                    key={heart}
                    type="button"
                    className={`heart-choice ${myChoice === index ? "selected" : ""}`}
                    onClick={() => chooseHeart(index)}
                    disabled={busy || room.status !== "playing"}
                    aria-label={`Choose heart ${index + 1}`}
                    aria-pressed={myChoice === index}
                  >
                    {heart}
                  </button>
                ))}
              </div>
              <p className="heart-private-note">Keep changing your pick. Match the same heart before the 60-second timer ends!</p>
            </>
          )}
          {room.status === "waiting" && <button className="secondary-btn dark xo-wide" onClick={shareInvitation}><Share2 size={15}/> {copied ? "Link copied" : "Share invitation link"}</button>}
          <button className="secondary-btn dark xo-wide" style={{ marginTop: 10 }} onClick={() => { setRoomCode(""); setRoom(null); setJoinCode(""); const url = new URL(window.location.href); url.searchParams.delete("heart"); window.history.replaceState({}, "", url.toString()); }}>Leave room</button>
        </>
      )}
      <p className="modal-description xo-notice">{notice}</p>
      <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
    </div>
  );
}


const TAP_DIFFICULTIES = {
  easy:   { label: "Easy",   interval: 950,  trapChance: 0.20, bonusChance: 0.14, desc: "Relaxed pace · Fewer decoy traps" },
  medium: { label: "Medium", interval: 720,  trapChance: 0.30, bonusChance: 0.16, desc: "Balanced speed · Decoy traps" },
  hard:   { label: "Hard",   interval: 540,  trapChance: 0.38, bonusChance: 0.18, desc: "Fast spawns · High trap density" },
  chaos:  { label: "Chaos",  interval: 400,  trapChance: 0.45, bonusChance: 0.22, desc: "Hyper-speed · Rapid trap shifts" }
};

function TapTrapGame({ onBack, onExplore, onCreateChallenge, initialRoomCode = "", playSound }) {
  const [mode, setMode] = useState(initialRoomCode ? "multi" : "select");
  const [difficulty, setDifficulty] = useState("medium");

  // Solo state (60s Timer + 3 Lives + Personal Best High Score — No AI)
  const [soloActive, setSoloActive] = useState(false);
  const [soloOver, setSoloOver] = useState(false);
  const [soloEndReason, setSoloEndReason] = useState("time");
  const [soloTimeLeft, setSoloTimeLeft] = useState(60);
  const [lives, setLives] = useState(3);
  const [soloScore, setSoloScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      return Number(localStorage.getItem("oddora-taptrap-best") || 0);
    } catch {
      return 0;
    }
  });
  const [combo, setCombo] = useState(0);
  const [soloCells, setSoloCells] = useState(Array(9).fill(null));
  const [soloBanner, setSoloBanner] = useState("60 seconds · 3 lives. Hit ⚡ & 💎, dodge 💣!");

  // Multiplayer state
  const [uid, setUid] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Enter your display name to create or join a 60s Tap Trap duel.");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [mpScore, setMpScore] = useState(0);
  const [mpCells, setMpCells] = useState(Array(9).fill(null));
  const [mpFlash, setMpFlash] = useState("Tap ⚡ +10 · 💎 +25 · Avoid 💣 -15");

  const mpScoreRef = useRef(0);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setMode("multi");
    }
  }, [initialRoomCode]);

  // Solo spawn & 60-second countdown timer
  useEffect(() => {
    if (mode !== "solo" || !soloActive || soloOver) return undefined;
    const cfg = TAP_DIFFICULTIES[difficulty] || TAP_DIFFICULTIES.medium;

    const spawnGrid = () => {
      const next = Array(9).fill(null);
      const count = difficulty === "chaos" ? 3 : 2;
      const used = new Set();
      for (let i = 0; i < count; i += 1) {
        let idx = Math.floor(Math.random() * 9);
        while (used.has(idx)) idx = Math.floor(Math.random() * 9);
        used.add(idx);

        const roll = Math.random();
        if (i === 0) {
          next[idx] = roll < cfg.bonusChance ? "bonus" : "target";
        } else {
          next[idx] = roll < cfg.trapChance ? "trap" : roll < cfg.trapChance + cfg.bonusChance ? "bonus" : "target";
        }
      }
      setSoloCells(next);
    };

    spawnGrid();
    const spawnTimer = window.setInterval(spawnGrid, cfg.interval);
    const clockTimer = window.setInterval(() => {
      setSoloTimeLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(spawnTimer);
          window.clearInterval(clockTimer);
          setSoloActive(false);
          setSoloOver(true);
          setSoloEndReason("time");
          setSoloBanner("Time's up! 60 seconds survived.");
          playSound?.("reveal");
          triggerHaptic([25, 35, 25]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(spawnTimer);
      window.clearInterval(clockTimer);
    };
  }, [mode, soloActive, soloOver, difficulty]);

  function startSoloGame() {
    playSound?.("magic");
    triggerHaptic(15);
    setLives(3);
    setSoloScore(0);
    setSoloTimeLeft(60);
    setSoloEndReason("time");
    setCombo(0);
    setSoloOver(false);
    setSoloActive(true);
    setSoloBanner("Go! Score as high as you can in 60s!");
  }

  function handleSoloTap(index) {
    if (!soloActive || soloOver) return;
    const cell = soloCells[index];
    if (!cell) return;

    const updated = [...soloCells];
    updated[index] = null;
    setSoloCells(updated);

    if (cell === "trap") {
      playSound?.("wrong");
      triggerHaptic([35, 45, 35]);
      setCombo(0);
      setLives(prev => {
        const nextLives = prev - 1;
        if (nextLives <= 0) {
          setSoloActive(false);
          setSoloOver(true);
          setSoloEndReason("lives");
          setSoloBanner("Out of lives! Trap triggered.");
        } else {
          setSoloBanner(`💥 Trap hit! ${nextLives} ${nextLives === 1 ? "life" : "lives"} remaining.`);
        }
        return Math.max(0, nextLives);
      });
      return;
    }

    const nextCombo = combo + 1;
    const bonusPts = cell === "bonus" ? 25 : 10;
    const comboExtra = nextCombo >= 5 ? 5 : 0;
    const earned = bonusPts + comboExtra;
    setCombo(nextCombo);
    setSoloScore(prevScore => {
      const updatedScore = prevScore + earned;
      if (updatedScore > bestScore) {
        setBestScore(updatedScore);
        try {
          localStorage.setItem("oddora-taptrap-best", String(updatedScore));
        } catch {}
      }
      return updatedScore;
    });
    playSound?.(cell === "bonus" ? "magic" : "tap");
    triggerHaptic(12);
    setSoloBanner(cell === "bonus" ? `💎 Bonus Gem! +${earned}` : nextCombo >= 5 ? `🔥 ${nextCombo}x Streak! +${earned}` : `⚡ Nice hit! +${earned}`);
  }

  // Firebase Auth for Multiplayer
  useEffect(() => {
    if (mode !== "multi") return undefined;
    let alive = true;
    signInPlayer()
      .then(cred => {
        if (!alive) return;
        setUid(cred.user.uid);
        setNotice("Connected! Create a 60s Tap Trap room or enter an invite code.");
      })
      .catch(() => {
        if (alive) setNotice("Could not connect to Firebase. Check your internet or play Solo mode.");
      });
    return () => { alive = false; };
  }, [mode]);

  // Listen to Multiplayer Room
  useEffect(() => {
    if (!roomCode || mode !== "multi") return undefined;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        if (val.status === "finished" && room?.status === "playing") {
          playSound?.("reveal");
        }
        setRoom(val);
      } else {
        setRoom(null);
        setNotice("This Tap Trap room no longer exists.");
      }
    }, () => {
      setNotice("Unable to read room. Check Firebase Realtime Database rules.");
    });
    return () => unsub();
  }, [roomCode, mode]);

  const mySide = room?.players?.X === uid ? "X" : room?.players?.O === uid ? "O" : "";

  // Multiplayer 60s clock & target spawner
  useEffect(() => {
    if (!roomCode || room?.status !== "playing" || !room?.endsAt || mode !== "multi") return undefined;

    const spawnMp = () => {
      const next = Array(9).fill(null);
      const t1 = Math.floor(Math.random() * 9);
      let t2 = Math.floor(Math.random() * 9);
      while (t2 === t1) t2 = Math.floor(Math.random() * 9);
      next[t1] = Math.random() < 0.2 ? "bonus" : "target";
      next[t2] = Math.random() < 0.42 ? "trap" : "target";
      setMpCells(next);
    };

    spawnMp();
    const spawner = window.setInterval(spawnMp, 650);

    const clock = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((Number(room.endsAt) - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem === 0) {
        runTransaction(ref(database, `rooms/${roomCode}`), current => {
          if (!current || current.gameType !== "tap-trap" || current.status !== "playing") return;
          if (Number(current.endsAt || 0) > Date.now()) return;
          const scores = { ...(current.scores || { X: 0, O: 0 }) };
          if (mySide) scores[mySide] = Math.max(Number(scores[mySide] || 0), mpScoreRef.current);
          return { ...current, scores, status: "finished" };
        }).catch(() => {});
      }
    }, 250);

    return () => {
      window.clearInterval(spawner);
      window.clearInterval(clock);
    };
  }, [roomCode, room?.status, room?.endsAt, mode, mySide]);

  function handleMpTap(index) {
    if (!roomCode || !mySide || room?.status !== "playing") return;
    const cell = mpCells[index];
    if (!cell) return;

    const updated = [...mpCells];
    updated[index] = null;
    setMpCells(updated);

    const delta = cell === "trap" ? -15 : cell === "bonus" ? 25 : 10;
    const nextScore = Math.max(0, mpScoreRef.current + delta);
    mpScoreRef.current = nextScore;
    setMpScore(nextScore);

    if (cell === "trap") {
      playSound?.("wrong");
      triggerHaptic([30, 40, 30]);
      setMpFlash("💣 Decoy Trap! -15 pts");
    } else {
      playSound?.(cell === "bonus" ? "magic" : "tap");
      triggerHaptic(12);
      setMpFlash(cell === "bonus" ? "💎 Bonus Gem! +25 pts" : "⚡ Hit! +10 pts");
    }

    set(ref(database, `rooms/${roomCode}/scores/${mySide}`), nextScore).catch(() => {});
  }

  const cleanName = val => val.trim().replace(/\s+/g, " ").slice(0, 18);

  async function createRoom() {
    const name = cleanName(playerName);
    if (!uid || busy || !name) { setNotice("Enter your display name first."); return; }
    setBusy(true);
    setNotice("Creating Tap Trap arena...");
    try {
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snap = await get(ref(database, `rooms/${code}`));
        exists = snap.exists();
      }
      if (exists) throw new Error("Could not generate room code. Try again.");

      mpScoreRef.current = 0;
      setMpScore(0);

      await set(ref(database, `rooms/${code}`), {
        gameType: "tap-trap",
        players: { X: uid, O: "" },
        playerNames: { X: name, O: "" },
        scores: { X: 0, O: 0 },
        status: "waiting",
        round: 1,
        createdAt: Date.now()
      });

      setRoomCode(code);
      playSound?.("magic");
      setNotice("Room ready! Share the invite link with your friend.");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("tap", code);
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      setNotice(err.message || "Could not create room.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    const name = cleanName(playerName);
    const code = joinCode.trim().toUpperCase();
    if (!uid || busy || !name || code.length !== 6) {
      setNotice("Enter your name and a 6-character room code.");
      return;
    }
    setBusy(true);
    setNotice("Joining Tap Trap duel...");
    try {
      const roomRef = ref(database, `rooms/${code}`);
      const snap = await get(roomRef);
      if (!snap.exists()) throw new Error("Room not found. Ask your friend for a fresh link.");
      const existing = snap.val();
      if (existing.gameType !== "tap-trap") throw new Error("That code belongs to a different ODDORA game.");
      if (existing.players?.X === uid) throw new Error("You created this room. Open the link on another device to join as Player 2.");

      let fallbackUsed = false;
      const res = await runTransaction(roomRef, current => {
        if (!current) {
          if (fallbackUsed) return;
          fallbackUsed = true;
          current = existing;
        }
        if (current.gameType !== "tap-trap") return;
        if (current.players?.X === uid) return current;
        if (current.players?.O === uid) {
          return { ...current, playerNames: { ...(current.playerNames || {}), O: name } };
        }
        if (current.status !== "waiting" || current.players?.O) return;

        return {
          ...current,
          players: { ...current.players, O: uid },
          playerNames: { ...(current.playerNames || {}), O: name },
          scores: { X: 0, O: 0 },
          startedAt: Date.now(),
          endsAt: Date.now() + 60000,
          status: "playing"
        };
      });

      if (!res.committed || !res.snapshot.exists()) {
        throw new Error("Could not join room. It may already be full.");
      }

      mpScoreRef.current = 0;
      setMpScore(0);
      setRoomCode(code);
      playSound?.("magic");
      setNotice("Match live! Outscore your friend in 60 seconds!");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("tap", code);
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      setNotice(err.message || "Could not join room.");
    } finally {
      setBusy(false);
    }
  }

  async function restartMatch() {
    if (!roomCode || !room || room.status !== "finished" || !mySide || busy) return;
    setBusy(true);
    try {
      await runTransaction(ref(database, `rooms/${roomCode}`), current => {
        if (!current || current.gameType !== "tap-trap" || current.status !== "finished") return;
        return {
          ...current,
          scores: { X: 0, O: 0 },
          status: "playing",
          startedAt: Date.now(),
          endsAt: Date.now() + 60000,
          round: (current.round || 1) + 1
        };
      });
      mpScoreRef.current = 0;
      setMpScore(0);
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("tap", roomCode);
    const shareUrl = url.toString();
    const text = `${room?.playerNames?.X || playerName || "Your friend"} challenged you to a 60s TAP TRAP reflex duel on ODDORA! ⚡`;
    try {
      if (navigator.share) await navigator.share({ title: "Tap Trap · ODDORA", text, url: shareUrl });
      else {
        await navigator.clipboard.writeText(`${text}
${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  async function shareTapResult(p1Name, p1Score, p2Name, p2Score, winnerHeadline) {
    const playUrl = `${window.location.origin}/`;
    const resultText = `⚡ TAP TRAP · ODDORA: ${winnerHeadline} (${p1Name}: ${p1Score} vs ${p2Name}: ${p2Score})`;
    try {
      const file = await shareODDORAResultCard({
        game: "Tap Trap",
        headline: winnerHeadline,
        subtitle: `${p1Name} (${p1Score} pts) vs ${p2Name} (${p2Score} pts)`,
        detail: `${Math.max(p1Score, p2Score)} HIGHEST SCORE`,
        quote: "Fast fingers survive. Trap clickers perish.",
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "Tap Trap · ODDORA", text: resultText, url: playUrl, files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-tap-trap-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        await navigator.clipboard?.writeText(`${resultText}
${playUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (mode === "select") {
    return (
      <div className="tap-game-wrap">
        <div className="xo-welcome">
          <div className="xo-mark">⚡💣</div>
          <h3>Choose your Tap Trap arena</h3>
          <p className="modal-description">Survive with 3 lives against AI or battle a friend in a 60-second reflex duel.</p>
        </div>
        <div className="prank-mode-options">
          <button type="button" className="prank-mode-card active" onClick={() => { playSound?.("tap"); setMode("solo"); }}>
            <span><Bot size={28}/></span>
            <strong>Solo Mode (60s · 3 Lives)</strong>
            <small>Beat the clock · Set high score</small>
          </button>
          <button type="button" className="prank-mode-card" onClick={() => { playSound?.("tap"); setMode("multi"); }}>
            <span><Users size={28}/></span>
            <strong>Online Multiplayer</strong>
            <small>60s Live Score Battle</small>
          </button>
        </div>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  if (mode === "solo") {
    const survivedFull = soloEndReason === "time" && lives > 0;
    const isNewBest = soloScore > 0 && soloScore >= bestScore;
    return (
      <div className="tap-game-wrap">
        <div className="tap-diff-row" role="group" aria-label="Speed Difficulty">
          {Object.entries(TAP_DIFFICULTIES).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              className={difficulty === key ? "tap-diff-chip active" : "tap-diff-chip"}
              onClick={() => {
                playSound?.("tap");
                setDifficulty(key);
                if (soloActive) startSoloGame();
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="tap-hud">
          <div className="tap-stat">
            <span>LIVES</span>
            <strong>{"❤️".repeat(lives) || "💀"}</strong>
          </div>
          <div className="tap-stat">
            <span>SCORE</span>
            <strong className="tap-score-you">{soloScore}</strong>
          </div>
          <div className="tap-stat">
            <span>TIME LEFT</span>
            <strong className="tap-score-ai">00:{String(soloTimeLeft).padStart(2, "0")}</strong>
          </div>
        </div>

        <div className="xo-status">
          <span className="eyebrow muted">{TAP_DIFFICULTIES[difficulty].desc} · BEST: {bestScore} PTS</span>
          <strong>{soloBanner}</strong>
        </div>

        {!soloActive && !soloOver ? (
          <button className="primary-btn xo-wide" onClick={startSoloGame}>
            <Zap size={17}/> Start 60s Solo Run
          </button>
        ) : soloOver ? (
          <div className="tap-result-card">
            <div className="heart-burst">{survivedFull ? "⏱️" : "💥"}</div>
            <div className="eyebrow muted">
              {isNewBest ? "NEW PERSONAL BEST! 🏆" : survivedFull ? "60 SECONDS COMPLETED" : "ALL 3 LIVES LOST"}
            </div>
            <h3>{survivedFull ? "TIME'S UP! GREAT RUN!" : "TRAPPED BY THE SYSTEM!"}</h3>
            <p className="modal-description">
              Final Score: <strong>{soloScore} pts</strong> · Personal Best: <strong>{bestScore} pts</strong>
            </p>
            <div className="result-actions" style={{ marginTop: 12 }}>
              <button className="primary-btn" onClick={startSoloGame}>
                <RotateCcw size={16}/> Play Again
              </button>
              <button
                className="secondary-btn dark"
                onClick={() => shareTapResult("Solo Run", soloScore, "Personal Best", bestScore, survivedFull ? `${soloScore} PTS IN 60S!` : `SCORED ${soloScore} PTS!`)}
              >
                <Share2 size={16}/> {copied ? "Copied!" : "Share Score"}
              </button>
            </div>
          </div>
        ) : (
          <div className="tap-grid" aria-label="Tap Trap Grid">
            {soloCells.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                className={`tap-cell ${cell ? `is-${cell}` : ""}`}
                onClick={() => handleSoloTap(idx)}
              >
                {cell === "target" ? "⚡" : cell === "bonus" ? "💎" : cell === "trap" ? "💣" : ""}
              </button>
            ))}
          </div>
        )}

        <button className="secondary-btn dark xo-wide" onClick={() => { setSoloActive(false); setMode("multi"); }}>
          <Users size={15}/> Switch to 60s Friend Multiplayer
        </button>
        <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
      </div>
    );
  }

  // MULTIPLAYER MODE
  const scoreX = mySide === "X" ? mpScore : Number(room?.scores?.X || 0);
  const scoreO = mySide === "O" ? mpScore : Number(room?.scores?.O || 0);
  const nameX = room?.playerNames?.X || "Player 1";
  const nameO = room?.playerNames?.O || "Waiting for friend";

  const winnerTitle = scoreX === scoreO
    ? "IT'S A TIE!"
    : scoreX > scoreO
      ? `${nameX.toUpperCase()} WINS!`
      : `${nameO.toUpperCase()} WINS!`;

  return (
    <div className="tap-game-wrap">
      {!roomCode ? (
        <>
          <div className="xo-welcome">
            <div className="xo-mark">⚡💣</div>
            <h3>60-Second Tap Trap Duel</h3>
            <p className="modal-description">Compete live for 60 seconds. Highest score wins!</p>
          </div>
          <label className="xo-label" htmlFor="tap-player-name">YOUR DISPLAY NAME</label>
          <input
            id="tap-player-name"
            className="xo-input"
            value={playerName}
            onChange={e => setPlayerName(e.target.value.slice(0, 18))}
            placeholder="Enter your name"
            maxLength={18}
          />
          {initialRoomCode ? (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={joinRoom}>
                {busy ? "Joining..." : "Join 60s Duel"}
              </button>
              <p className="xo-invite-note">Your friend invited you! Enter your name to start the 60s battle.</p>
            </>
          ) : (
            <>
              <button className="primary-btn xo-wide" disabled={!uid || busy || !cleanName(playerName)} onClick={createRoom}>
                {busy ? "Creating..." : "⚡ Create 60s Challenge"}
              </button>
              <div className="xo-or"><span/> OR JOIN A FRIEND <span/></div>
              <input
                className="xo-input xo-code-input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="6-character invite code"
                maxLength={6}
              />
              <button
                className="secondary-btn dark xo-wide"
                disabled={!uid || busy || joinCode.length !== 6 || !cleanName(playerName)}
                onClick={joinRoom}
              >
                {busy ? "Joining..." : "Join Friend's Duel"}
              </button>
              <button className="secondary-btn dark xo-wide" onClick={() => setMode("solo")}>
                <Bot size={15}/> Play Solo Mode (3 Lives) instead
              </button>
            </>
          )}
        </>
      ) : !room ? (
        <div className="heart-waiting"><div className="heart-welcome-icon">⚡</div><h3>Loading Tap Trap arena...</h3></div>
      ) : (
        <>
          <div className="xo-room-head">
            <div>
              <div className="eyebrow muted">TAP TRAP · ROUND {room.round || 1}</div>
              <strong className="xo-room-code">{roomCode}</strong>
            </div>
            {room.status === "playing" && (
              <strong className="heart-timer">⏱ 00:{String(secondsLeft).padStart(2, "0")}</strong>
            )}
          </div>

          <div className="xo-players">
            <div className={mySide === "X" ? "xo-player active" : "xo-player"}>
              <b className="xo-player-symbol">⚡</b>
              <span>{nameX}: {scoreX}</span>
            </div>
            <div className={mySide === "O" ? "xo-player active" : "xo-player"}>
              <b className="xo-player-symbol xo-o">⚡</b>
              <span>{nameO}: {scoreO}</span>
            </div>
          </div>

          {room.status === "waiting" ? (
            <div className="heart-waiting">
              <div className="heart-welcome-icon">⚡</div>
              <h3>Waiting for your opponent...</h3>
              <p>Share the invite link. The 60-second clock starts as soon as your friend joins!</p>
              <button className="primary-btn xo-wide" style={{ marginTop: 12 }} onClick={shareInvite}>
                <Share2 size={15}/> {copied ? "Invite Link Copied!" : "Share Invite Link"}
              </button>
            </div>
          ) : room.status === "finished" ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tap-result-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                display: "grid",
                placeItems: "center",
                padding: "22px",
                background: "rgba(5, 4, 12, .88)",
                backdropFilter: "blur(12px)"
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 390,
                  padding: "28px 22px",
                  borderRadius: 24,
                  textAlign: "center",
                  color: "#fff",
                  background: "linear-gradient(145deg, #211936, #12101f)",
                  border: "1px solid rgba(177, 139, 255, .38)",
                  boxShadow: "0 24px 90px rgba(0,0,0,.6)"
                }}
              >
                <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
                <div className="eyebrow muted" style={{ justifyContent: "center", marginBottom: 8 }}>ODDORA · TAP TRAP 60S DUEL</div>
                <h2 id="tap-result-title" style={{ fontSize: 30, margin: "0 0 10px", color: "#fff" }}>{winnerTitle}</h2>
                <div className="heart-score-card">
                  <strong>{Math.max(scoreX, scoreO)} PTS</strong>
                  <span>FINAL SCOREBOARD</span>
                  <small>{nameX}: {scoreX} pts · {nameO}: {scoreO} pts</small>
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  <button className="primary-btn xo-wide" disabled={busy} onClick={restartMatch}>
                    ↻ Rematch (60s)
                  </button>
                  <button
                    className="secondary-btn dark xo-wide"
                    onClick={() => shareTapResult(nameX, scoreX, nameO, scoreO, winnerTitle)}
                  >
                    <Share2 size={15}/> {copied ? "Result Copied!" : "Share Winner Card"}
                  </button>
                  <button className="secondary-btn dark xo-wide" onClick={onCreateChallenge}>
                    ✨ Create Your Own Challenge
                  </button>
                  <button className="secondary-btn dark xo-wide" onClick={onExplore}>
                    🎮 Explore ODDORA
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="xo-status">
                <strong>{mpFlash}</strong>
              </div>
              <div className="tap-grid" aria-label="Multiplayer Tap Trap Grid">
                {mpCells.map((cell, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`tap-cell ${cell ? `is-${cell}` : ""}`}
                    onClick={() => handleMpTap(idx)}
                  >
                    {cell === "target" ? "⚡" : cell === "bonus" ? "💎" : cell === "trap" ? "💣" : ""}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            className="secondary-btn dark xo-wide"
            onClick={() => {
              setRoomCode("");
              setRoom(null);
              setJoinCode("");
              const url = new URL(window.location.href);
              url.searchParams.delete("tap");
              window.history.replaceState({}, "", url.toString());
            }}
          >
            Leave room
          </button>
        </>
      )}

      <p className="modal-description xo-notice">{notice}</p>
      <button className="secondary-btn dark xo-wide" onClick={onBack}>Back to OD Games</button>
    </div>
  );
}


const INVITE_TEMPLATES = [
  {
    id: "movie",
    badge: "🎬 MOVIE NIGHT",
    title: "Movie night tonight? 🍿",
    question: "Are we going to the movies tonight? Tickets and popcorn are on me!",
    yesLabel: "Confirm Date 🍿",
    noLabel: "No",
    yesMessage: "Date confirmed! Meet you at the theatre—don't be late 😎🎬"
  },
  {
    id: "office",
    badge: "💼 OFFICE CHECK",
    title: "Are you coming to office?",
    question: "Be honest... are you coming to the office today or working from bed?",
    yesLabel: "Yes, on my way 🏃‍♂️",
    noLabel: "No (WFH)",
    yesMessage: "Confirmed! Coffee break at 4 PM sharp ☕✨"
  },
  {
    id: "side",
    badge: "💫 REAL ONE CHECK",
    title: "Are you still by my side?",
    question: "Through all the chaos, overthinking, and spontaneous plans—are you still by my side?",
    yesLabel: "Always & Forever 💜",
    noLabel: "No",
    yesMessage: "Locked in! Best duo certified 🔒💜"
  },
  {
    id: "coffee",
    badge: "☕ COFFEE RUN",
    title: "Coffee & late-night drive?",
    question: "No overthinking. Iced coffee, good playlist, and zero stress tonight?",
    yesLabel: "Let's go 🚀",
    noLabel: "Pass",
    yesMessage: "It's a plan! Send me your location 📍✨"
  }
];

const PROPOSE_THEMES = [
  { id: "romantic", label: "💘 Crush / Romantic", defaultQ: "Will you go on a date with me? 💘" },
  { id: "friendship", label: "🤝 Bestie / Ride-or-Die", defaultQ: "Best friends for life—no take-backs? 🤝" },
  { id: "funny", label: "😂 Chaotic / Funny", defaultQ: "Will you officially fund my midnight snack addiction? 🍕" },
  { id: "gold", label: "🔥 Bold / Dare", defaultQ: "Do you accept this mystery dare without asking questions? ⚡" }
];

const DODGE_TAUNTS = [
  "Are you sure? 👀",
  "Nice try, too slow! ⚡",
  "Button malfunction... try Yes? 😏",
  "System says: INVALID CHOICE 🚫",
  "Why are you chasing No?! 😂",
  "Almost caught it! 🏃‍♂️💨",
  "Resistance is futile 💜",
  "Okay fine... converted to YES! ✨"
];

function generateWarmupQuestions(mainQuestion, themeId) {
  const lower = mainQuestion.toLowerCase();
  if (lower.includes("valentine")) {
    return [
      {
        q: "1. Quick check — do you know what day Feb 14 is?",
        options: ["Valentine's Day 💘", "Just another Thursday", "National Chocolate Day 🍫"]
      },
      {
        q: "2. Honestly, what would people do without love?",
        options: ["Overthink at 2 AM 🌙", "Listen to sad playlists 🎧", "Survive on iced coffee ☕"]
      }
    ];
  }
  if (themeId === "friendship") {
    return [
      {
        q: "1. Who carries this entire friendship's chaotic energy?",
        options: ["Definitely You 😎", "100% Me 👑", "50-50 Partners in Crime 🤝"]
      },
      {
        q: "2. If we get stuck in traffic for 2 hours, what happens?",
        options: ["Full carpool concert 🎤", "Non-stop gossip & snacks 🍟", "Deep 2 AM life talks 🌌"]
      }
    ];
  }
  if (themeId === "funny") {
    return [
      {
        q: "1. Be honest: how many unread messages are on your phone?",
        options: ["0 (I'm innocent) 😇", "50+ (Don't judge) 👀", "999+ (Chaos mode) 🔥"]
      },
      {
        q: "2. Scientific question: are you ready for a plot twist?",
        options: ["Born ready ⚡", "Wait, what is this?! 😳", "Only if there's food 🍕"]
      }
    ];
  }
  if (themeId === "gold") {
    return [
      {
        q: "1. On a scale of 1 to 10, how fearless are you right now?",
        options: ["10/10 Unstoppable 🔥", "7/10 Cautiously brave 😅", "Depends on the dare 👀"]
      },
      {
        q: "2. Rule #1: Once you tap Yes, there is no backing out. Deal?",
        options: ["Deal, bring it on ⚡", "Let me see the dare first 😏", "Born for chaos 🎲"]
      }
    ];
  }
  return [
    {
      q: "1. Quick vibe check — what makes a moment unforgettable?",
      options: ["The right person ✨", "Late-night talks 🌙", "Spontaneous plans 🚀"]
    },
    {
      q: "2. Do you believe some connections happen for a reason?",
      options: ["100% Yes 💫", "Maybe, prove it 😏", "Destiny knows 👀"]
    }
  ];
}

function ODCreateStudio({ initialTab = "invite" }) {
  const [studioTab, setStudioTab] = useState(initialTab);
  const [stepMode, setStepMode] = useState("edit"); // "edit" | "preview" | "published"
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Common fields
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [cardTheme, setCardTheme] = useState("purple");

  // OD INVITE state (100% English defaults, fully editable)
  const [inviteTitle, setInviteTitle] = useState(INVITE_TEMPLATES[0].title);
  const [inviteQuestion, setInviteQuestion] = useState(INVITE_TEMPLATES[0].question);
  const [yesLabel, setYesLabel] = useState(INVITE_TEMPLATES[0].yesLabel);
  const [noLabel, setNoLabel] = useState(INVITE_TEMPLATES[0].noLabel);
  const [yesMessage, setYesMessage] = useState(INVITE_TEMPLATES[0].yesMessage);

  // OD PROPOSE state (4 distinct vibes, fully editable)
  const [proposeTheme, setProposeTheme] = useState("romantic");
  const [proposeIntro, setProposeIntro] = useState("Before you answer the final question, clear these 2 quick vibe checks...");
  const [q1, setQ1] = useState("1. Quick vibe check — what makes a moment unforgettable?");
  const [q1Opts, setQ1Opts] = useState(["The right person ✨", "Late-night talks 🌙", "Spontaneous plans 🚀"]);
  const [q2, setQ2] = useState("2. Do you believe some connections happen for a reason?");
  const [q2Opts, setQ2Opts] = useState(["100% Yes 💫", "Maybe, prove it 😏", "Destiny knows 👀"]);
  const [finalProposal, setFinalProposal] = useState("Will you go on a date with me? 💘");
  const [propYesLabel, setPropYesLabel] = useState("YES, 100% 💖");
  const [propNoLabel, setPropNoLabel] = useState("No 🙈");
  const [dressCode, setDressCode] = useState("Black / Pastel Aesthetic ✨");
  const [datePlace, setDatePlace] = useState("Sunset Coffee & Long Drive ☕");
  const [yesAckMessage, setYesAckMessage] = useState("It's official! Tap Share Result Card below and send it to me 💌");
  const [noTwistMessage, setNoTwistMessage] = useState("😂 PLOT TWIST! Relax, this was an ODDORA interactive social experiment! Nice reflexes though 💀");

  function applyInviteTemplate(tpl) {
    setInviteTitle(tpl.title);
    setInviteQuestion(tpl.question);
    setYesLabel(tpl.yesLabel);
    setNoLabel(tpl.noLabel);
    setYesMessage(tpl.yesMessage);
    setStepMode("edit");
  }

  function handleSelectProposeTheme(pt) {
    setProposeTheme(pt.id);
    setFinalProposal(pt.defaultQ);
    const generated = generateWarmupQuestions(pt.defaultQ, pt.id);
    setQ1(generated[0].q);
    setQ1Opts(generated[0].options);
    setQ2(generated[1].q);
    setQ2Opts(generated[1].options);
  }

  function handleAutoBuildFlow() {
    const generated = generateWarmupQuestions(finalProposal, proposeTheme);
    setQ1(generated[0].q);
    setQ1Opts(generated[0].options);
    setQ2(generated[1].q);
    setQ2Opts(generated[1].options);
  }

  function buildPayload() {
    const cleanSender = (senderName.trim() || "Someone special").slice(0, 24);
    const cleanRecipient = (recipientName.trim() || "You").slice(0, 24);

    if (studioTab === "invite") {
      return {
        type: "invite",
        theme: cardTheme,
        creatorName: cleanSender,
        recipientName: cleanRecipient,
        createdAt: Date.now(),
        payload: {
          title: (inviteTitle.trim() || "Quick Question 👀").slice(0, 80),
          question: (inviteQuestion.trim() || "Are we doing this?").slice(0, 240),
          yesLabel: (yesLabel.trim() || "Yes 💜").slice(0, 28),
          noLabel: (noLabel.trim() || "No").slice(0, 28),
          yesMessage: (yesMessage.trim() || "Confirmed! See you soon 🎉").slice(0, 240),
          maxDodges: 8
        }
      };
    }

    return {
      type: "propose",
      theme: proposeTheme,
      creatorName: cleanSender,
      recipientName: cleanRecipient,
      createdAt: Date.now(),
      payload: {
        intro: (proposeIntro.trim() || "Answer 2 quick questions first...").slice(0, 200),
        questions: [
          { q: q1.trim().slice(0, 140), options: q1Opts.map(o => o.trim().slice(0, 50)).filter(Boolean) },
          { q: q2.trim().slice(0, 140), options: q2Opts.map(o => o.trim().slice(0, 50)).filter(Boolean) }
        ],
        finalQuestion: (finalProposal.trim() || "Do you love me? 💘").slice(0, 160),
        yesLabel: (propYesLabel.trim() || "YES 💖").slice(0, 28),
        noLabel: (propNoLabel.trim() || "No").slice(0, 28),
        dressCode: (dressCode.trim() || "Your best vibe ✨").slice(0, 80),
        datePlace: (datePlace.trim() || "Surprise spot 📍").slice(0, 80),
        yesAckMessage: (yesAckMessage.trim() || "Confirmed! Share the result card back 💌").slice(0, 220),
        noTwistMessage: (noTwistMessage.trim() || "😂 PLOT TWIST! Just a harmless ODDORA interactive test!").slice(0, 220)
      }
    };
  }

  async function publishCreation() {
    if (publishing) return;
    setPublishing(true);
    try {
      const cred = await signInPlayer();
      let code = "";
      let exists = true;
      for (let i = 0; i < 8 && exists; i += 1) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const snap = await get(ref(database, `creations/${code}`));
        exists = snap.exists();
      }
      if (exists) throw new Error("Could not generate unique code");

      const data = {
        id: code,
        creatorUid: cred.user.uid,
        ...buildPayload()
      };
      await set(ref(database, `creations/${code}`), data);

      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("odc", code);
      setPublishedUrl(url.toString());
      setStepMode("published");
      triggerHaptic([20, 30, 20]);
    } catch {
      alert("Could not publish right now. Please check your internet or Firebase rules for /creations.");
    } finally {
      setPublishing(false);
    }
  }

  function shareWhatsApp() {
    const who = senderName.trim() || "Your friend";
    const text = studioTab === "invite"
      ? `${who} sent you a personal invite on ODDORA 👀✨
Open here: ${publishedUrl}`
      : `${who} made something special for you 💌✨
Open here: ${publishedUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  }

  return (
    <div className="odc-modal-studio">
      <div className="odc-mode-pills">
        <button
          type="button"
          className={studioTab === "invite" ? "odc-pill active" : "odc-pill"}
          onClick={() => { setStudioTab("invite"); setStepMode("edit"); }}
        >
          💌 OD Invite
        </button>
        <button
          type="button"
          className={studioTab === "propose" ? "odc-pill active" : "odc-pill"}
          onClick={() => { setStudioTab("propose"); setStepMode("edit"); }}
        >
          💍 OD Propose
        </button>
      </div>

      {stepMode === "preview" ? (
        <div className="odc-preview-shell">
          <div className="odc-preview-bar">
            <span>👁️ RECIPIENT PREVIEW</span>
            <button type="button" className="secondary-btn" onClick={() => setStepMode("edit")}>
              ← Edit
            </button>
          </div>
          <InteractiveCreationView
            data={buildPayload()}
            isPreview={true}
            onReplyCreate={() => setStepMode("edit")}
          />
          <div className="odc-action-row">
            <button type="button" className="primary-btn xo-wide" onClick={publishCreation} disabled={publishing}>
              {publishing ? "Publishing..." : "🚀 Publish & Get Shareable Link"}
            </button>
          </div>
        </div>
      ) : stepMode === "published" ? (
        <div className="result-stage">
          <div className="result-spark">🎉</div>
          <div className="eyebrow muted">LINK LIVE & READY</div>
          <h3>Your {studioTab === "invite" ? "OD Invite" : "OD Propose"} is ready!</h3>
          <p className="modal-description">Send this link to <strong>{recipientName || "your person"}</strong>. Read-only recipient mode is locked.</p>
          <div className="odc-link-box">
            <input readOnly value={publishedUrl} onFocus={e => e.target.select()} />
            <button type="button" className="secondary-btn" onClick={copyShareLink}>
              {copiedLink ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="result-actions">
            <button type="button" className="primary-btn" onClick={shareWhatsApp}>
              📲 Share on WhatsApp
            </button>
            <button type="button" className="secondary-btn dark" onClick={() => setStepMode("preview")}>
              👁️ Preview
            </button>
            <button type="button" className="secondary-btn dark" onClick={() => setStepMode("edit")}>
              ✏️ Create Another
            </button>
          </div>
        </div>
      ) : studioTab === "invite" ? (
        <div className="odc-builder-card">
          <div className="odc-templates">
            <span className="xo-label">STARTER TEMPLATES (OR TYPE ANYTHING):</span>
            <div className="odc-template-row">
              {INVITE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  className="odc-tpl-chip"
                  onClick={() => applyInviteTemplate(tpl)}
                >
                  {tpl.badge}
                </button>
              ))}
            </div>
          </div>

          <div className="odc-grid-2">
            <label className="odc-field">
              <span>YOUR NAME</span>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Type your name" maxLength={24}/>
            </label>
            <label className="odc-field">
              <span>RECIPIENT NAME</span>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Friend or crush name" maxLength={24}/>
            </label>
          </div>

          <label className="odc-field">
            <span>INVITE HEADLINE</span>
            <input value={inviteTitle} onChange={e => setInviteTitle(e.target.value)} placeholder="Type whatever headline you want..." maxLength={80}/>
          </label>

          <label className="odc-field">
            <span>YOUR QUESTION / MESSAGE</span>
            <textarea rows={2} value={inviteQuestion} onChange={e => setInviteQuestion(e.target.value)} placeholder="Type whatever message you want..." maxLength={240}/>
          </label>

          <div className="odc-grid-2">
            <label className="odc-field">
              <span>YES BUTTON TEXT</span>
              <input value={yesLabel} onChange={e => setYesLabel(e.target.value)} maxLength={28}/>
            </label>
            <label className="odc-field">
              <span>NO BUTTON (Dodges 8x → Yes)</span>
              <input value={noLabel} onChange={e => setNoLabel(e.target.value)} maxLength={28}/>
            </label>
          </div>

          <label className="odc-field">
            <span>MESSAGE WHEN THEY CLICK YES</span>
            <input value={yesMessage} onChange={e => setYesMessage(e.target.value)} placeholder="Type confirmation message..." maxLength={240}/>
          </label>

          <div className="odc-theme-row">
            <span className="xo-label">CARD THEME:</span>
            {["purple", "romantic", "cyan", "gold"].map(t => (
              <button
                key={t}
                type="button"
                className={cardTheme === t ? "odc-swatch active" : "odc-swatch"}
                onClick={() => setCardTheme(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="odc-action-row">
            <button type="button" className="secondary-btn" onClick={() => setStepMode("preview")}>
              👁️ Preview
            </button>
            <button type="button" className="primary-btn" onClick={publishCreation} disabled={publishing}>
              {publishing ? "Publishing..." : "🚀 Publish Invite"}
            </button>
          </div>
        </div>
      ) : (
        <div className="odc-builder-card">
          <div className="odc-theme-row">
            <span className="xo-label">PROPOSAL VIBE:</span>
            {PROPOSE_THEMES.map(pt => (
              <button
                key={pt.id}
                type="button"
                className={proposeTheme === pt.id ? "odc-pill active" : "odc-pill"}
                onClick={() => handleSelectProposeTheme(pt)}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="odc-grid-2">
            <label className="odc-field">
              <span>YOUR NAME</span>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Your name" maxLength={24}/>
            </label>
            <label className="odc-field">
              <span>THEIR NAME</span>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Crush / partner / friend" maxLength={24}/>
            </label>
          </div>

          <label className="odc-field">
            <span>STEP 3: YOUR MAIN PROPOSAL QUESTION</span>
            <div className="odc-inline-ai">
              <input value={finalProposal} onChange={e => setFinalProposal(e.target.value)} placeholder="Type whatever question you want..." maxLength={160}/>
              <button type="button" className="secondary-btn" onClick={handleAutoBuildFlow}>
                ✨ Auto-Build Q1 & Q2
              </button>
            </div>
          </label>

          <div className="odc-q-box">
            <span className="xo-label">WARM-UP QUESTION 1</span>
            <input value={q1} onChange={e => setQ1(e.target.value)} maxLength={140}/>
            <div className="odc-opts-grid">
              {q1Opts.map((opt, idx) => (
                <input
                  key={idx}
                  value={opt}
                  onChange={e => {
                    const copy = [...q1Opts];
                    copy[idx] = e.target.value;
                    setQ1Opts(copy);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={50}
                />
              ))}
            </div>
          </div>

          <div className="odc-q-box">
            <span className="xo-label">WARM-UP QUESTION 2</span>
            <input value={q2} onChange={e => setQ2(e.target.value)} maxLength={140}/>
            <div className="odc-opts-grid">
              {q2Opts.map((opt, idx) => (
                <input
                  key={idx}
                  value={opt}
                  onChange={e => {
                    const copy = [...q2Opts];
                    copy[idx] = e.target.value;
                    setQ2Opts(copy);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={50}
                />
              ))}
            </div>
          </div>

          <div className="odc-grid-2">
            <label className="odc-field">
              <span>YES BUTTON TEXT</span>
              <input value={propYesLabel} onChange={e => setPropYesLabel(e.target.value)} maxLength={28}/>
            </label>
            <label className="odc-field">
              <span>NO BUTTON (Plot-Twist Escape)</span>
              <input value={propNoLabel} onChange={e => setPropNoLabel(e.target.value)} maxLength={28}/>
            </label>
          </div>

          <div className="odc-grid-2">
            <label className="odc-field">
              <span>IF YES → DRESS CODE / VIBE</span>
              <input value={dressCode} onChange={e => setDressCode(e.target.value)} maxLength={80}/>
            </label>
            <label className="odc-field">
              <span>IF YES → PLACE / PLAN</span>
              <input value={datePlace} onChange={e => setDatePlace(e.target.value)} maxLength={80}/>
            </label>
          </div>

          <label className="odc-field">
            <span>IF YES → ACKNOWLEDGE CONFIRMATION MESSAGE</span>
            <input value={yesAckMessage} onChange={e => setYesAckMessage(e.target.value)} maxLength={220}/>
          </label>

          <label className="odc-field">
            <span>IF NO → PLAYFUL TWIST REVEAL MESSAGE</span>
            <input value={noTwistMessage} onChange={e => setNoTwistMessage(e.target.value)} maxLength={220}/>
          </label>

          <div className="odc-action-row">
            <button type="button" className="secondary-btn" onClick={() => setStepMode("preview")}>
              👁️ Preview
            </button>
            <button type="button" className="primary-btn" onClick={publishCreation} disabled={publishing}>
              {publishing ? "Publishing..." : "💘 Publish Proposal"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InteractiveCreationView({ data, isPreview = false, onReplyCreate }) {
  const [dodgeCount, setDodgeCount] = useState(0);
  const [noOffset, setNoOffset] = useState({ x: 0, y: 0 });
  const [inviteOutcome, setInviteOutcome] = useState(""); // "" | "yes"
  const [propStage, setPropStage] = useState(0); // 0=Q1, 1=Q2, 2=Final, 3=YesResult, 4=NoTwistResult
  const [acknowledged, setAcknowledged] = useState(false);
  const [cardShared, setCardShared] = useState(false);

  const maxDodges = data?.payload?.maxDodges || 8;
  const convertedToYes = dodgeCount >= maxDodges;

  async function handleShareOutcomeCard(gameTitle, headline, subtitle, detail, quote) {
    const playUrl = `${window.location.origin}/`;
    try {
      const file = await shareODDORAResultCard({
        game: gameTitle,
        headline,
        subtitle,
        detail,
        quote,
        url: playUrl
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: `${gameTitle} · ODDORA`,
          text: `${headline} — ${subtitle}`,
          files: [file]
        });
      } else {
        const imageUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "oddora-invite-result.png";
        a.click();
        URL.revokeObjectURL(imageUrl);
        setCardShared(true);
        setTimeout(() => setCardShared(false), 2200);
      }
    } catch {}
  }

  function handleNoDodge() {
    if (convertedToYes) {
      setInviteOutcome("yes");
      triggerHaptic([20, 30, 20]);
      return;
    }
    const next = dodgeCount + 1;
    setDodgeCount(next);
    triggerHaptic(15);
    if (next >= maxDodges) {
      setNoOffset({ x: 0, y: 0 });
    } else {
      const rx = Math.round((Math.random() - 0.5) * 160);
      const ry = Math.round((Math.random() - 0.5) * 90);
      setNoOffset({ x: rx, y: ry });
    }
  }

  if (data.type === "invite") {
    const p = data.payload;
    return (
      <div className={`odc-player-card theme-${data.theme || "purple"}`}>
        <div className="eyebrow">PERSONAL INVITE FOR {data.recipientName?.toUpperCase()}</div>
        {inviteOutcome === "yes" ? (
          <div className="odc-outcome-box">
            <div className="heart-burst">🎉</div>
            <h3>CONFIRMED! 💜</h3>
            <p className="result-text">{p.yesMessage}</p>
            <small className="muted">Sent by {data.creatorName} via ODDORA</small>
            <div className="result-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => handleShareOutcomeCard(
                  "OD Invite",
                  "INVITE CONFIRMED! 💜",
                  `${data.recipientName} said YES to ${data.creatorName}!`,
                  p.title,
                  p.yesMessage
                )}
              >
                <Share2 size={16}/> {cardShared ? "Card Saved ✓" : "Share Result Card"}
              </button>
            </div>
            <div className="odc-reply-cta">
              <p>If you still want No, create your reply invite 👇</p>
              <button type="button" className="secondary-btn" onClick={onReplyCreate}>
                ↩️ Create Your Reply Invite
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2>{p.title}</h2>
            <p className="odc-msg">{p.question}</p>
            {dodgeCount > 0 && (
              <div className="odc-taunt">
                {DODGE_TAUNTS[Math.min(dodgeCount - 1, DODGE_TAUNTS.length - 1)]} ({dodgeCount}/{maxDodges})
              </div>
            )}
            <div className="odc-btn-arena">
              <button
                type="button"
                className="primary-btn odc-yes-btn"
                style={{ transform: `scale(${1 + Math.min(dodgeCount, 7) * 0.05})` }}
                onClick={() => {
                  triggerHaptic([20, 35, 20]);
                  setInviteOutcome("yes");
                }}
              >
                {p.yesLabel}
              </button>
              <button
                type="button"
                className={convertedToYes ? "primary-btn" : "secondary-btn odc-no-btn"}
                style={convertedToYes ? {} : { transform: `translate(${noOffset.x}px, ${noOffset.y}px)` }}
                onMouseEnter={() => { if (!convertedToYes && dodgeCount < 4) handleNoDodge(); }}
                onClick={handleNoDodge}
              >
                {convertedToYes ? `Okay ${p.yesLabel}` : p.noLabel}
              </button>
            </div>
            <small className="muted">From {data.creatorName} · {isPreview ? "Preview Mode" : "ODDORA Invite"}</small>
          </>
        )}
      </div>
    );
  }

  // OD PROPOSE 3-STEP FLOW
  const p = data.payload;
  const questions = p.questions || [];

  return (
    <div className={`odc-player-card theme-${data.theme || "romantic"}`}>
      <div className="eyebrow">FOR {data.recipientName?.toUpperCase()} · FROM {data.creatorName?.toUpperCase()}</div>

      {propStage < questions.length ? (
        <>
          <div className="iq-count">STEP {propStage + 1} OF {questions.length + 1}</div>
          {propStage === 0 && <p className="muted" style={{ fontSize: 12 }}>{p.intro}</p>}
          <h3>{questions[propStage].q}</h3>
          <div className="iq-options">
            {questions[propStage].options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className="choice"
                onClick={() => {
                  triggerHaptic(12);
                  setPropStage(s => s + 1);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : propStage === questions.length ? (
        <>
          <div className="heart-burst">💘</div>
          <div className="iq-count">FINAL QUESTION</div>
          <h2>{p.finalQuestion}</h2>
          <div className="odc-btn-arena">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                triggerHaptic([25, 40, 25]);
                setPropStage(questions.length + 1);
              }}
            >
              {p.yesLabel}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                triggerHaptic([30, 40, 30]);
                setPropStage(questions.length + 2);
              }}
            >
              {p.noLabel}
            </button>
          </div>
        </>
      ) : propStage === questions.length + 1 ? (
        <div className="odc-outcome-box">
          <div className="heart-burst">💞</div>
          <h3>DATE LOCKED IN! ✨</h3>
          <div className="odc-plan-details">
            <div><span>👗 DRESS CODE:</span> <strong>{p.dressCode}</strong></div>
            <div><span>📍 PLACE / PLAN:</span> <strong>{p.datePlace}</strong></div>
          </div>
          <p className="result-text">{p.yesAckMessage}</p>
          <div className="result-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                triggerHaptic(20);
                setAcknowledged(true);
              }}
            >
              {acknowledged ? "Acknowledged & Confirmed ✓💌" : "Confirm & Acknowledge 💌"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => handleShareOutcomeCard(
                "OD Propose",
                "DATE LOCKED IN! 💞",
                `${data.recipientName} & ${data.creatorName} are officially locked in!`,
                `${p.datePlace} · ${p.dressCode}`,
                p.finalQuestion
              )}
            >
              <Share2 size={16}/> {cardShared ? "Card Saved ✓" : "Share Result Card"}
            </button>
          </div>
        </div>
      ) : (
        <div className="odc-outcome-box">
          <div className="heart-burst">😂</div>
          <h3>PLOT TWIST! 😂</h3>
          <p className="result-text">{p.noTwistMessage}</p>
          <div className="result-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => handleShareOutcomeCard(
                "OD Propose",
                "PLOT TWIST! 😂",
                `${data.creatorName} caught ${data.recipientName} in an ODDORA trap!`,
                "100% HARMLESS EXPERIMENT",
                p.noTwistMessage
              )}
            >
              <Share2 size={16}/> {cardShared ? "Card Saved ✓" : "Share Result Card"}
            </button>
            <button type="button" className="secondary-btn" onClick={onReplyCreate}>
              ✨ Create Your Own Trap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ODCreatePlayer({ code, onClose, onCreateReply }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    get(ref(database, `creations/${code}`))
      .then(snap => {
        if (!alive) return;
        if (snap.exists()) setData(snap.val());
        else setNotFound(true);
      })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="experience-modal" style={{ position: "relative" }}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button>
        {loading ? (
          <div className="result-stage"><p>Loading your special invite...</p></div>
        ) : notFound || !data ? (
          <div className="result-stage">
            <h3>Invite link not found 👀</h3>
            <p className="muted">This link may have expired or been mistyped.</p>
            <button type="button" className="primary-btn" onClick={onClose}>Explore ODDORA</button>
          </div>
        ) : (
          <InteractiveCreationView data={data} isPreview={false} onReplyCreate={onCreateReply} />
        )}
      </div>
    </div>
  );
}



export default App;
