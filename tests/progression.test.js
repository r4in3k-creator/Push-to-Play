/* Unit tests for the progression rules.
   Run:  node tests/progression.test.js
   The engine lives inside index.html between the progression markers; this
   pulls that block out and runs it on its own, so the thing tested is the thing
   shipped rather than a copy. */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/\/\*<progression>\*\/([\s\S]*?)\/\*<\/progression>\*\//);
if(!m){ console.error("progression block not found"); process.exit(1); }
const { nextTarget, progRead } = new Function(m[1] + "; return { nextTarget, progRead };")();

let pass = 0, fail = 0;
function eq(name, got, want){
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if(g === w){ pass++; } else { fail++; console.log("FAIL " + name + "\n  got  " + g + "\n  want " + w); }
}
const S = (...sets)=> sets.map(([weight, reps])=>({ weight:String(weight), reps:String(reps) }));
const pick = t => t && { w:t.weight, r:t.reps, a:t.amrap, why:t.why };

/* ---- reading a session ---- */
eq("working weight is the heaviest; warm-ups ignored",
   progRead(S([40,10],[60,8],[100,5],[100,5])).W, 100);
eq("only sets at the working weight are judged",
   progRead(S([40,10],[100,5],[100,4])).work.length, 2);
eq("bodyweight has no working weight", progRead(S(["",12],["",10])).W, null);
eq("blank session reads as nothing", progRead(S(["",""])), null);

/* ---- linear ---- */
const LIN = { type:"linear", inc:2.5, lo:5 };
eq("linear: all sets hit -> up",
   pick(nextTarget(LIN, [S([100,5],[100,5],[100,5])])), { w:102.5, r:5, a:false, why:"up" });
eq("linear: over target still just one step",
   pick(nextTarget(LIN, [S([100,8],[100,7],[100,6])])), { w:102.5, r:5, a:false, why:"up" });
eq("linear: one miss -> same again",
   pick(nextTarget(LIN, [S([100,5],[100,5],[100,3])])), { w:100, r:5, a:false, why:"hold" });
eq("linear: two misses running -> still hold",
   pick(nextTarget(LIN, [S([100,5],[100,4]), S([100,5],[100,3])])), { w:100, r:5, a:false, why:"hold" });
eq("linear: three misses running at the same weight -> reset 10%",
   pick(nextTarget(LIN, [S([100,4]), S([100,4]), S([100,3])])), { w:90, r:5, a:false, why:"reset" });
eq("linear: misses at a different weight do not count toward the reset",
   pick(nextTarget(LIN, [S([100,4]), S([100,4]), S([97.5,3])])), { w:100, r:5, a:false, why:"hold" });
eq("linear: a hit in between breaks the streak",
   pick(nextTarget(LIN, [S([100,4]), S([100,5]), S([100,3]), S([100,3])])), { w:100, r:5, a:false, why:"hold" });
eq("linear: reset rounds to the increment",
   pick(nextTarget(LIN, [S([102.5,3]), S([102.5,3]), S([102.5,3])])), { w:92.5, r:5, a:false, why:"reset" });
eq("linear: warm-up sets below the top weight cannot fail it",
   pick(nextTarget(LIN, [S([60,3],[80,3],[100,5],[100,5])])), { w:102.5, r:5, a:false, why:"up" });
eq("linear: no load -> no suggestion", nextTarget(LIN, [S(["",12])]), null);
eq("linear: lb increment", pick(nextTarget({type:"linear",inc:5,lo:5}, [S([225,5],[225,5])])),
   { w:230, r:5, a:false, why:"up" });

/* ---- double progression ---- */
const DBL = { type:"double", inc:2.5, lo:8, hi:12 };
eq("double: below the top -> one more rep than the weakest set",
   pick(nextTarget(DBL, [S([40,10],[40,9],[40,8])])), { w:40, r:9, a:false, why:"reps" });
eq("double: every set at the top -> add weight, back to the bottom",
   pick(nextTarget(DBL, [S([40,12],[40,12],[40,12])])), { w:42.5, r:8, a:false, why:"up" });
eq("double: one set short of the top is not there yet",
   pick(nextTarget(DBL, [S([40,12],[40,12],[40,11])])), { w:40, r:12, a:false, why:"reps" });
eq("double: under the range aims for the bottom of it",
   pick(nextTarget(DBL, [S([40,5],[40,5])])), { w:40, r:8, a:false, why:"reps" });
eq("double: bodyweight chases a rep with no load",
   pick(nextTarget(DBL, [S(["",12],["",11])])), { w:null, r:12, a:false, why:"reps" });
eq("double: defaults to 8-12 when no range is set",
   pick(nextTarget({type:"double",inc:2.5}, [S([40,12],[40,12])])), { w:42.5, r:8, a:false, why:"up" });

/* ---- Greyskull LP ---- */
const GS = { type:"gslp", inc:2.5, lo:5 };
eq("gslp: hit, last set under double -> single jump, last set open-ended",
   pick(nextTarget(GS, [S([100,5],[100,5],[100,7])])), { w:102.5, r:5, a:true, why:"up" });
eq("gslp: last set doubles the target -> double jump",
   pick(nextTarget(GS, [S([100,5],[100,5],[100,10])])), { w:105, r:5, a:true, why:"up2" });
eq("gslp: any missed set -> reset 10% straight away",
   pick(nextTarget(GS, [S([100,5],[100,4],[100,6])])), { w:90, r:5, a:true, why:"reset" });
eq("gslp: only the LAST set can earn the double jump",
   pick(nextTarget(GS, [S([100,11],[100,5],[100,5])])), { w:102.5, r:5, a:true, why:"up" });

/* ---- edges ---- */
eq("no history -> nothing", nextTarget(LIN, []), null);
eq("unknown rule -> nothing", nextTarget({type:"nope"}, [S([100,5])]), null);
eq("no rule -> nothing", nextTarget(null, [S([100,5])]), null);
eq("decimals survive without float noise",
   pick(nextTarget({type:"linear",inc:1.25,lo:5}, [S([61.25,5])])), { w:62.5, r:5, a:false, why:"up" });
eq("a reset can never land at or above the old weight",
   nextTarget({type:"linear",inc:10,lo:5}, [S([10,1]),S([10,1]),S([10,1])]).weight < 10, true);
eq("comma-free strings and stray spaces parse",
   pick(nextTarget(LIN, [[{weight:" 100 ", reps:" 5 "}]])), { w:102.5, r:5, a:false, why:"up" });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
