// builds a plausible 12-week history
module.exports = function seed(){
  const out = [];
  const day = d => { const x=new Date(); x.setDate(x.getDate()-d);
    return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };
  const set = (w,r,extra) => Object.assign({weight:String(w), reps:String(r), done:true}, extra||{});
  for(let wk=11; wk>=0; wk--){
    const b = 80 + (11-wk)*2.5, sq = 100 + (11-wk)*5, rw = 60 + (11-wk)*2;
    out.push({ date:day(wk*7+5), loggedAt:new Date().toISOString(), items:[
      { id:"push-0", n:"Barbell Bench Press", cat:"push", eq:"Barbell", sets:4,
        setLog:[set(40,8,{k:"w"}), set(b,5), set(b,5), set(b,5,{e:"1"})] },
      { id:"push-1", n:"Incline Barbell Bench Press", cat:"push", eq:"Barbell", sets:3, setLog:[set(b-20,8),set(b-20,8),set(b-20,8)] }]});
    out.push({ date:day(wk*7+3), loggedAt:new Date().toISOString(), items:[
      { id:"legs-51", n:"Barbell Back Squat", cat:"legs", eq:"Barbell", sets:3, setLog:[set(sq,5),set(sq,5),set(sq,5)] }]});
    if(wk % 2 === 0) out.push({ date:day(wk*7+1), loggedAt:new Date().toISOString(), items:[
      { id:"pull-28", n:"Barbell Bent-Over Row", cat:"pull", eq:"Barbell", sets:3, setLog:[set(rw,8),set(rw,8),set(rw,8)] }]});
  }
  return JSON.stringify(out.sort((a,b)=> a.date < b.date ? 1 : -1));
};
