/* Browser tests. They live in the repo because the earlier suites lived only in
   a scratch directory and were lost when that machine was recycled.

   Run:   python3 -m http.server 8099      (from the repo root, in one terminal)
          node tests/app.test.js           (in another; needs `npm i playwright`)
   Pass a different address as the first argument if 8099 is taken.           */
const { chromium } = require("playwright");
const B = process.argv[2] || "http://127.0.0.1:8099/";
const PHONE = { viewport:{width:390,height:844}, isMobile:true, hasTouch:true,
  userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
const DESK = { viewport:{width:1280,height:950} };
const VIEWS = ["train","splits","cardio","calendar","records","account","settings"];
const day = d => { const x=new Date(); x.setDate(x.getDate()+d);
  return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };

function contrast(a, b){
  const px = s => s.match(/\d+(\.\d+)?/g).slice(0,3).map(Number);
  const lum = c => { const [r,g,bl] = px(c).map(v=>{ v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*bl; };
  const l1 = lum(a), l2 = lum(b);
  return Math.round(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))*100)/100;
}

(async()=>{
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
  const errors = []; let pass = 0, fail = 0;
  const ok = (name, cond, detail) => { if(cond) pass++; else { fail++; console.log("FAIL " + name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : "")); } };

  const open = async (opts, scheme, seed, extra) => {
    const ctx = await browser.newContext(Object.assign({ colorScheme:scheme || "light" }, opts, extra || {}));
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push("PAGEERROR " + e.message));
    p.on("console", m => { if(m.type()==="error" && !/ERR_|Failed to load|fonts\.g/.test(m.text())) errors.push(m.text()); });
    p.on("dialog", d => d.accept(""));
    await p.goto(B); await p.waitForTimeout(700);
    if(seed){
      await p.evaluate(d => { for(const k in d) localStorage.setItem(k, d[k]); }, seed);
      await p.reload(); await p.waitForTimeout(700);
    }
    return { ctx, p };
  };
  const add = async (p, name) => {
    await p.fill("#search", name); await p.waitForTimeout(380);
    await p.click("#groups .card .add-btn"); await p.waitForTimeout(220);
    await p.fill("#search", ""); await p.waitForTimeout(220);
  };
  const workout = async p => { await p.click('#modeSwitch button[data-mode="workout"]').catch(()=>{}); await p.waitForTimeout(350); };
  const tray = p => p.evaluate(() => JSON.parse(localStorage.getItem("ptp-tray") || "[]"));
  /* Sets are logged on each exercise's own page. */
  const focus = async (p, n) => { await p.locator(".tray-item .open-btn").nth(n || 0).click(); await p.waitForTimeout(380); };
  const F = "#focusPage ";

  /* ---------- 1. every view, both themes, both widths ---------- */
  for(const [label, opts] of [["phone",PHONE],["desk",DESK]]){
    for(const scheme of ["light","dark"]){
      const { ctx, p } = await open(opts, scheme);
      const bad = [];
      for(const v of VIEWS){
        await p.click(`.viewtab[data-view="${v}"]`).catch(async()=>{
          await p.click("#avatarBtn"); await p.waitForTimeout(200);
          await p.click(`#acctMenu [data-go="${v}"]`).catch(()=>{});
        });
        await p.waitForTimeout(330);
        const o = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        const painted = await p.evaluate(()=>{ const e=document.querySelector(".view.active"); return !!e && e.getBoundingClientRect().height>50; });
        if(o>0 || !painted) bad.push(v);
      }
      ok(`views render without overflow (${label}/${scheme})`, bad.length===0, bad);
      await ctx.close();
    }
  }

  /* The tab bar is a fixed child of the header. A filter or transform on the
     header silently re-anchors it there — this pins it to the screen. */
  {
    const { ctx, p } = await open(PHONE);
    const g = await p.evaluate(()=>{ const r=document.getElementById("viewtabs").getBoundingClientRect();
      return { bottom:Math.round(r.bottom), vh:window.innerHeight, top:Math.round(r.top) }; });
    ok("phone tab bar sits at the bottom of the screen", g.bottom===g.vh && g.top > g.vh/2, g);
    const hit = await p.evaluate(()=>{ const b=document.getElementById("avatarBtn").getBoundingClientRect();
      const e=document.elementFromPoint(b.left+b.width/2, b.top+b.height/2); return !!e && !!e.closest("#avatarBtn"); });
    ok("nothing covers the profile button", hit);
    await ctx.close();
  }

  /* ---------- 2. contrast and tap targets ---------- */
  for(const scheme of ["light","dark"]){
    const { ctx, p } = await open(PHONE, scheme);
    await add(p, "Barbell Bench Press"); await workout(p);
    const c = await p.evaluate(()=>{
      const col = sel => { const e=document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
      const bg = sel => { let e=document.querySelector(sel);
        while(e){ const b=getComputedStyle(e).backgroundColor;
          if(b && b!=="rgba(0, 0, 0, 0)" && b!=="transparent" && !/rgba\(.*, 0\.\d+\)/.test(b)) return b; e=e.parentElement; }
        return getComputedStyle(document.body).backgroundColor; };
      return { exName:[col(".ex-name"),bg(".ex-name")], badge:[col(".badge"),bg(".badge")],
               logBtn:[col(".tray-actions .log"),bg(".tray-actions .log")] };
    });
    for(const k in c) ok(`contrast ${k} >= 4.5 (${scheme})`, contrast(c[k][0], c[k][1]) >= 4.5, contrast(c[k][0], c[k][1]));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    const small1 = await p.$$eval("#groups .add-btn, #groups .ex-menu-btn",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v<40));
    ok("directory targets >= 40px", small1.length===0, small1.slice(0,3));
    await workout(p);
    const small2 = await p.$$eval(".tray-item .icon-btn, .tray-actions button",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v>0&&v<40));
    ok("workout targets >= 40px", small2.length===0, small2);
    await focus(p);
    const small3 = await p.$$eval("#focusPage button, #focusPage .check-wrap, #focusPage .set-input",
      els => els.map(e=>{ const r=e.getBoundingClientRect(); return Math.round(Math.min(r.width,r.height)); }).filter(v=>v>0&&v<44));
    ok("exercise page targets >= 44px", small3.length===0, small3);
    const ov = await p.evaluate(()=>{ const f=document.getElementById("focusPage"); return f.scrollWidth - f.clientWidth; });
    ok("exercise page does not scroll sideways", ov===0, ov);
    await ctx.close();
  }

  /* ---------- 3. the core loop ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await workout(p);
    await focus(p);
    await p.fill(F+".set-row .weight-input", "100"); await p.fill(F+".set-row .reps-input", "5");
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(350);
    await p.click("#focusBack"); await p.waitForTimeout(350);
    await p.click("#logBtn"); await p.waitForTimeout(500);
    const h = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-history")||"[]"));
    ok("a session logs", h.length===1 && h[0].items[0].setLog[0].weight==="100", h);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(450);
    ok("the calendar shows it", (await p.$$(".sess-ex")).length===1);
    const dot = await p.$$eval(".cal-cell .cal-dots span", els => els.length ? getComputedStyle(els[0]).backgroundColor : null);
    ok("category hue is still the validated push red", dot==="rgb(192, 69, 41)", dot);
    ok("catalogue is intact", await (async()=>{ await p.click('.viewtab[data-view="train"]'); await p.waitForTimeout(350);
      await p.click('#modeSwitch button[data-mode="browse"]').catch(()=>{}); await p.waitForTimeout(350);
      return (await p.$$("#groups .card")).length; })() === 417);
    await ctx.close();
  }

  /* ---------- 4. progression ---------- */
  const HIST = sets => JSON.stringify([{ date:day(-3), loggedAt:new Date().toISOString(), items:[
    { id:"push-0", n:"Barbell Bench Press", cat:"push", eq:"Barbell", sets:sets.length,
      setLog:sets.map(([w,r])=>({ weight:String(w), reps:String(r), done:true })) }]}]);
  let plainHeight = 0;
  {
    // no rule set: nothing new on screen
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("no rule, no pill", (await p.$$(".next-pill")).length===0);
    plainHeight = await p.$eval(".tray-item", e=>Math.round(e.getBoundingClientRect().height));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"linear" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    const pill = await p.$eval(".next-pill", e=>e.textContent.trim()).catch(()=>null);
    ok("linear: pill shows the next step", pill==="102.5 × 5", pill);
    const rowsBefore = await p.$eval(".tray-item", e=>e.getBoundingClientRect().height);
    ok("pill lives in the existing badge row", await p.$eval(".next-pill", e=>e.parentElement.classList.contains("head-meta")));
    const withRule = await p.$eval(".tray-item", e=>Math.round(e.getBoundingClientRect().height));
    ok("the suggestion costs no extra height on a phone", withRule <= plainHeight + 2, { plainHeight, withRule });
    const hit = await p.$eval(".next-pill", e=>{ const r=e.getBoundingClientRect(), a=getComputedStyle(e,"::after");
      const m=(a.inset||"").match(/-?\d+/g)||[0]; return Math.round(r.height + Math.abs(+m[0])*2); });
    ok("pill hit area >= 40px", hit >= 40, hit);
    await p.click(".next-pill"); await p.waitForTimeout(400);
    const t = await tray(p);
    ok("one tap fills every blank set", t[0].setLog.every(s=>s.weight==="102.5" && s.reps==="5"), t[0].setLog);
    ok("filling does not tick anything", t[0].setLog.every(s=>!s.done));
    ok("the pill opens the exercise page", await p.isVisible("#focusPage"));
    // a typed number is a decision the suggestion must not overrule
    await p.fill(F+".set-row .weight-input", "95"); await p.keyboard.press("Tab"); await p.waitForTimeout(250);
    await p.click(F+".next-pill"); await p.waitForTimeout(350);
    ok("a typed value survives a second tap", (await tray(p))[0].setLog[0].weight==="95");
    void rowsBefore;
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[40,12],[40,12],[40,12]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"double", progLo:"8", progHi:"12" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("double: top of range adds weight", (await p.$eval(".next-pill", e=>e.textContent.trim()))==="42.5 × 8");
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,10]]),
      "ptp-ex-prefs":JSON.stringify({ "push-0":{ prog:"gslp" } }) });
    await add(p, "Barbell Bench Press"); await workout(p);
    ok("greyskull: doubled last set earns a double jump", (await p.$eval(".next-pill", e=>e.textContent.trim()))==="105 × 5+");
    await focus(p);
    const ph = await p.$$eval(F+".set-row .reps-input", els=>els.map(e=>e.placeholder));
    ok("only the last set is open-ended", ph.join(",")==="5,5,5+", ph);
    await ctx.close();
  }
  {
    // choosing a rule from the item menu mid-workout
    const { ctx, p } = await open(PHONE, "light", { "ptp-history":HIST([[100,5],[100,5],[100,5]]) });
    await add(p, "Barbell Bench Press"); await workout(p);
    await p.click(".tray-item .ellipsis"); await p.waitForTimeout(350);
    await p.click('[data-prog="linear"]'); await p.waitForTimeout(400);
    ok("menu chip turns the rule on", (await p.$$(".next-pill")).length===1);
    const prefs = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-ex-prefs")));
    ok("the rule is stored per exercise", prefs["push-0"].prog==="linear", prefs);
    await p.click('[data-prog=""]'); await p.waitForTimeout(400);
    ok("Off removes it again", (await p.$$(".next-pill")).length===0);
    await ctx.close();
  }
  {
    // the exercise editor saves increment and a rep range
    const { ctx, p } = await open(DESK);
    await p.fill("#search", "Barbell Bench Press"); await p.waitForTimeout(400);
    await p.click("#groups .card .ex-menu-btn"); await p.waitForTimeout(400);
    await p.selectOption("#edProg", "double");
    await p.fill("#edProgInc", "1.25"); await p.fill("#edProgReps", "6-10");
    await p.click("#edSave"); await p.waitForTimeout(450);
    const pr = (await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-ex-prefs"))))["push-0"];
    ok("editor saves rule, increment and range", pr.prog==="double" && pr.progInc==="1.25" && pr.progLo==="6" && pr.progHi==="10", pr);
    await ctx.close();
  }

  /* ---------- 5. motion: only what changed moves ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    await add(p, "Barbell Bent-Over Row");
    await workout(p); await p.waitForTimeout(450);
    ok("an entrance class is removed once it has played", (await p.$$(".tray-item.enter")).length===0);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(300);
    await p.click('.viewtab[data-view="train"]'); await p.waitForTimeout(120);
    ok("leaving the tab and returning does not replay it", (await p.$$(".tray-item.enter")).length===0);
    await workout(p);
    await p.locator(".tray-item .open-btn").first().click(); await p.waitForTimeout(60);
    ok("opening the exercise page slides it in", (await p.$$("#focusPage.opening")).length===1);
    await p.waitForTimeout(400);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(80);
    ok("ticking pops exactly one tick", (await p.$$(".checkmark.pop")).length===1);
    ok("...and does not replay the page entrance", (await p.$$("#focusPage.opening, .focus-body.slide-l")).length===0);
    await p.waitForTimeout(350);
    await p.locator(F+".set-row .check-wrap").nth(1).click(); await p.waitForTimeout(80);
    ok("the earlier tick does not pop again", (await p.$$(".checkmark.pop")).length===1);
    await p.waitForTimeout(350);
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(60);
    ok("next exercise slides in from the right", (await p.$$(".focus-body.slide-l")).length===1);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK);
    await p.click(".split-btn"); await p.waitForTimeout(60);
    const delays = await p.$$eval(".tray-item.enter", els=>els.map(e=>e.style.animationDelay));
    ok("a loaded split staggers its rows in", delays.length===6 && delays[0]==="0ms" && delays[5]==="175ms", delays);
    await p.click('.viewtab[data-view="calendar"]'); await p.waitForTimeout(60);
    const an = await p.$eval(".view.active", e=>getComputedStyle(e).animationName);
    ok("switching view animates in", an==="viewIn", an);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE, "light", null, { reducedMotion:"reduce" });
    await add(p, "Barbell Bench Press"); await workout(p);
    await p.locator(".tray-item .open-btn").first().click(); await p.waitForTimeout(60);
    const d = await p.$eval("#focusPage", e=>getComputedStyle(e).animationDuration);
    ok("reduced motion turns it off", parseFloat(d) < 0.01, d);
    await ctx.close();
  }


  /* ---------- 6. the exercise page ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press");
    await add(p, "Barbell Bent-Over Row");
    await workout(p);
    ok("the workout list holds no set rows", (await p.$$(".tray-item .set-row")).length===0);
    await focus(p);
    ok("tapping an exercise opens its page", await p.isVisible("#focusPage"));
    ok("the page is only that exercise", (await p.textContent("#focusTitle")).trim()==="Barbell Bench Press");
    ok("it says where you are", (await p.textContent("#focusPos")).trim()==="1 of 2");
    const covered = await p.evaluate(()=>{ const t=document.getElementById("viewtabs").getBoundingClientRect();
      const e=document.elementFromPoint(t.left+t.width/2, t.top+t.height/2); return !!e && !!e.closest("#focusPage"); });
    ok("the page covers the tab bar", covered);
    await p.click(F+"[data-faddset]"); await p.waitForTimeout(250);
    ok("Add a set adds one", (await tray(p))[0].sets===4 && (await p.$$(F+".set-row")).length===4);
    await p.click(F+"[data-fdropset]"); await p.waitForTimeout(250);
    ok("Remove last set removes one", (await tray(p))[0].sets===3);
    for(let i=0;i<3;i++){ await p.locator(F+".set-row .check-wrap").nth(i).click(); await p.waitForTimeout(150); }
    ok("finishing every set says so", /All 3 sets done/.test(await p.textContent(F+".fx-progress")));
    ok("...and lights up the next exercise", (await p.$$(F+".fx-next.ready")).length===1);
    ok("a tick starts the rest countdown on the page", (await p.$$(F+".fx-rest.on [data-tleft]")).length===1);
    await p.click(F+"[data-fskip]"); await p.waitForTimeout(250);
    ok("Skip rest stops it", (await p.$$(F+".fx-rest.on")).length===0);
    await p.click(F+"[data-fnextex]"); await p.waitForTimeout(350);
    ok("Next walks to the next exercise", (await p.textContent("#focusTitle")).trim()==="Barbell Bent-Over Row"
      && (await p.textContent("#focusPos")).trim()==="2 of 2");
    ok("the last exercise offers the way back", (await p.$$(F+"[data-fdone]")).length===1);
    await p.click(F+"[data-fprev]"); await p.waitForTimeout(350);
    ok("Previous walks back", (await p.textContent("#focusTitle")).trim()==="Barbell Bench Press");
    await p.goBack(); await p.waitForTimeout(350);
    ok("the phone's back gesture closes the page", !(await p.isVisible("#focusPage")));
    ok("...and stays on the app", p.url().startsWith(B));
    ok("the list shows the progress", /All 3 sets done/.test(await p.textContent(".tray-item .row-progress")));
    await p.locator(".tray-item .head-left .ex-name").nth(1).click(); await p.waitForTimeout(350);
    ok("tapping the name opens it too", (await p.textContent("#focusTitle")).trim()==="Barbell Bent-Over Row");
    await p.click("#focusBack"); await p.waitForTimeout(350);
    ok("Back closes it", !(await p.isVisible("#focusPage")));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK, "dark");
    await add(p, "Barbell Bench Press");
    await focus(p);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("exercise page fits on desktop too", ov===0 && await p.isVisible("#focusPage"), ov);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    ok("Escape closes it", !(await p.isVisible("#focusPage")));
    await ctx.close();
  }

  /* ---------- 7. rest timers: music and refreshes ---------- */
  // Record what the page asks of the audio system: every play() and the iOS audio session type.
  const AUDIO_SPY = () => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(){ window.__plays.push({ loop:this.loop, at:Date.now() });
      try{ return orig.call(this).catch(()=>{}); }catch(e){ return Promise.resolve(); } };
    try{ Object.defineProperty(navigator, "audioSession", { value:{ type:"auto" }, configurable:true }); }catch(e){}
  };
  const shortRest = async (p, sec) => {
    await p.evaluate(s=>{ const t=JSON.parse(localStorage.getItem("ptp-tray")); t.forEach(i=>i.restSeconds=s);
      localStorage.setItem("ptp-tray", JSON.stringify(t)); }, sec);
    await p.reload(); await p.waitForTimeout(700);
  };
  {
    const { ctx, p } = await open(PHONE);
    await ctx.addInitScript(AUDIO_SPY);
    await add(p, "Barbell Bench Press"); await shortRest(p, 2); await workout(p);
    ok("the app starts with a session that mixes with music",
      await p.evaluate(()=>navigator.audioSession && navigator.audioSession.type)==="ambient");
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(400);
    ok("a rest does not hold the audio session (no looping track)",
      (await p.evaluate(()=>window.__plays.filter(x=>x.loop).length))===0, await p.evaluate(()=>window.__plays));
    await p.waitForTimeout(4200);
    ok("after the beep the session is handed back to the music",
      await p.evaluate(()=>navigator.audioSession.type)==="ambient", await p.evaluate(()=>navigator.audioSession.type));
    ok("the finished rest is cleared from storage",
      Object.keys(await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-timers")||"{}"))).length===0);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await shortRest(p, 90); await workout(p);
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(300);
    const saved = await p.evaluate(()=>JSON.parse(localStorage.getItem("ptp-timers")||"{}"));
    ok("a running rest is saved", Object.keys(saved).length===1, saved);
    await p.reload(); await p.waitForTimeout(900); await workout(p);
    const badge = await p.$eval(".tray-item .timer-badge.running .t", e=>e.textContent.trim()).catch(()=>null);
    ok("...and survives a refresh", !!badge && /^1:2\d$|^1:[01]\d$/.test(badge), badge);
    await ctx.close();
  }
  {
    // background mode is the one that is allowed to hold the session
    const { ctx, p } = await open(PHONE, "light", { "ptp-settings":JSON.stringify({ restAlert:"background" }) });
    await ctx.addInitScript(AUDIO_SPY);
    await add(p, "Barbell Bench Press"); await shortRest(p, 60); await workout(p);
    await focus(p);
    await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(400);
    ok("background mode keeps a silent track playing", (await p.evaluate(()=>window.__plays.filter(x=>x.loop).length))>=1);
    await p.click(F+"[data-fskip]"); await p.waitForTimeout(300);
    ok("...and lets go of it when the rest is skipped",
      await p.evaluate(()=>navigator.audioSession.type)==="ambient", await p.evaluate(()=>navigator.audioSession.type));
    await ctx.close();
  }

  /* ---------- 8. clearing a workout ---------- */
  {
    const { ctx, p } = await open(PHONE);
    await add(p, "Barbell Bench Press"); await add(p, "Barbell Bent-Over Row"); await workout(p);
    ok("nothing destructive sits at the foot of the workout", (await p.$$(".tray-actions button")).length===1
      && (await p.$$(".tray-actions #clearBtn")).length===0);
    const g = await p.evaluate(()=>{ const l=document.getElementById("logBtn").getBoundingClientRect(),
      m=document.getElementById("sessMore").getBoundingClientRect(); return Math.round(l.top - m.bottom); });
    ok("the clear menu is far from Log", g > 150, g);
    const ab = await p.$eval("#trayBack", e=>{ const r=e.getBoundingClientRect(); return { w:Math.round(r.width), h:Math.round(r.height), f:getComputedStyle(e).fontSize }; });
    ok("the Add button is thumb-sized", ab.h>=44 && ab.w>=90 && parseFloat(ab.f)>=15, ab);
    ok("Clear is hidden until the menu opens", !(await p.isVisible("#clearBtn")));
    await p.click("#sessMore"); await p.waitForTimeout(200);
    const small = await p.$$eval("#sessMenu button", els=>els.map(e=>Math.round(e.getBoundingClientRect().height)).filter(h=>h<44));
    ok("menu items >= 44px", small.length===0, small);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok("the menu stays on screen", ov===0, ov);
    await p.click("#clearBtn"); await p.waitForTimeout(300);
    ok("Clear workout empties it", (await tray(p)).length===0);
    ok("an Undo is offered", await p.isVisible("#toast .toast-act"));
    await p.click("#toast .toast-act"); await p.waitForTimeout(300);
    ok("Undo brings it all back", (await tray(p)).length===2 && (await p.$$(".tray-item")).length===2);
    // ticked sets still get a question first
    await focus(p); await p.click(F+".set-row .check-wrap"); await p.waitForTimeout(200);
    await p.click("#focusBack"); await p.waitForTimeout(300);
    let asked = null; p.removeAllListeners("dialog"); p.on("dialog", d=>{ asked=d.message(); d.dismiss(); });
    await p.click("#sessMore"); await p.waitForTimeout(150); await p.click("#clearBtn"); await p.waitForTimeout(250);
    ok("unlogged ticked sets ask before clearing", !!asked && /1 completed set/.test(asked), asked);
    ok("...and No keeps the workout", (await tray(p)).length===2);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(DESK);
    await add(p, "Barbell Bench Press");
    await p.click("#sessMore"); await p.waitForTimeout(200);
    ok("the menu works on desktop too", await p.isVisible("#clearBtn"));
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    ok("Escape closes it", !(await p.isVisible("#clearBtn")));
    await ctx.close();
  }

  ok("no console or page errors", errors.length===0, [...new Set(errors)].slice(0,4));
  console.log(`${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
