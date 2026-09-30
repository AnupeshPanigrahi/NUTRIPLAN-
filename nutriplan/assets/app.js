(function(){
"use strict";
var $ = function(id){return document.getElementById(id)};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmt(v,d){return Number(v).toFixed(d).replace(/\.0+$/,"")}
function inr(v){return "₹"+Math.round(v).toLocaleString("en-IN")}
function toast(msg){var t=$("toast");t.textContent=msg;t.classList.add("on");clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove("on")},2600)}

/* ---------- storage (falls back to memory if blocked) ---------- */
var mem = {};
var store = {
  get:function(k){try{return localStorage.getItem(k)}catch(e){return mem.hasOwnProperty(k)?mem[k]:null}},
  set:function(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}
};
function loadUsers(){try{return JSON.parse(store.get("bf_users")||"{}")}catch(e){return {}}}
function saveUsers(u){store.set("bf_users",JSON.stringify(u))}
function hashPw(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
var user=null, data=null, pantry=[];
function dataKey(){return "bf_data_"+user.email}
function loadData(){var d={};try{d=JSON.parse(store.get(dataKey())||"{}")}catch(e){}
  d.eco=d.eco||{meals:0,g:0,inr:0}; d.consults=d.consults||[]; d.profile=d.profile||null; return d}
function saveData(){store.set(dataKey(),JSON.stringify(data))}
function ageGroup(a){return a<13?"kid":(a<18?"teen":(a<60?"adult":"senior"))}

/* ---------- comfort settings ---------- */
var root=document.documentElement;
document.querySelectorAll("[data-size]").forEach(function(b){
  b.addEventListener("click",function(){
    root.style.fontSize=b.dataset.size+"%";
    document.querySelectorAll("[data-size]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});
  });
});
$("contrastBtn").addEventListener("click",function(){
  var on=root.getAttribute("data-contrast")==="high";
  if(on) root.removeAttribute("data-contrast"); else root.setAttribute("data-contrast","high");
  this.textContent=on?"Off":"On"; this.setAttribute("aria-pressed",on?"false":"true");
});
function isDark(){var t=root.getAttribute("data-theme");if(t)return t==="dark";return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}
function syncTheme(){var d=isDark();$("themeBtn").textContent=d?"On":"Off";$("themeBtn").setAttribute("aria-pressed",d?"true":"false")}
$("themeBtn").addEventListener("click",function(){root.setAttribute("data-theme",isDark()?"light":"dark");syncTheme()});
syncTheme();

/* ---------- read aloud ---------- */
function speak(text){
  if(!("speechSynthesis" in window)){toast("Read aloud is not supported on this device.");return}
  var s=window.speechSynthesis;
  if(s.speaking){s.cancel();return}
  var u=new SpeechSynthesisUtterance(text);u.lang="en-IN";u.rate=.95;s.speak(u);
}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-speak]");
  if(b){var el=$(b.dataset.speak);if(el)speak(el.innerText)}
});

/* ---------- navigation ---------- */
var VIEWS=["auth","home","food","fort","reuse","care","doc"];
function show(v){
  VIEWS.forEach(function(x){$("v-"+x).classList.toggle("on",x===v)});
  document.querySelectorAll("#mainnav button").forEach(function(b){
    if(b.dataset.v===v) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
  });
  if(v==="home") renderHome();
  if(v==="doc") renderDoc();
  if(v==="care") initCare();
  window.scrollTo(0,0);
  if(window.speechSynthesis) window.speechSynthesis.cancel();
}
document.querySelectorAll("#mainnav button").forEach(function(b){b.addEventListener("click",function(){show(b.dataset.v)})});

/* ---------- auth ---------- */
function setTab(reg){
  $("tabLogin").setAttribute("aria-selected",reg?"false":"true");
  $("tabReg").setAttribute("aria-selected",reg?"true":"false");
  $("loginForm").hidden=reg; $("regForm").hidden=!reg;
}
$("tabLogin").addEventListener("click",function(){setTab(false)});
$("tabReg").addEventListener("click",function(){setTab(true)});
$("lShow").addEventListener("change",function(){$("lPass").type=this.checked?"text":"password"});
$("rShow").addEventListener("change",function(){var t=this.checked?"text":"password";$("rPass").type=t;$("rPass2").type=t});
$("rAge").addEventListener("input",function(){var a=+this.value;$("guardRow").hidden=!(a>=5&&a<13)});

function enter(email){
  var users=loadUsers(); user={email:email,name:users[email].name,age:users[email].age};
  store.set("bf_session",email);
  data=loadData();
  $("logoutBtn").hidden=false; $("mainnav").classList.add("on");
  prefillProfile(); renderReuseChips(); syncCondChips(); showFab();
  show("home");
}
$("regForm").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("rName").value.trim(), email=$("rEmail").value.trim().toLowerCase(), age=+$("rAge").value, p=$("rPass").value, p2=$("rPass2").value;
  var err=$("rErr");
  if(!name){err.textContent="Please type your name.";return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent="Please type a valid email, like name@example.com.";return}
  if(!(age>=5&&age<=110)){err.textContent="Please type your age between 5 and 110.";return}
  if(age<13&&!$("rGuard").checked){err.textContent="Please ask a parent or guardian to help, then tick the box.";return}
  if(p.length<6){err.textContent="Password needs at least 6 characters.";return}
  if(p!==p2){err.textContent="The two passwords do not match.";return}
  var users=loadUsers();
  if(users[email]){err.textContent="This email is already registered. Please log in.";return}
  users[email]={name:name,age:age,pw:hashPw(email+":"+p)};
  saveUsers(users); err.textContent=""; enter(email); toast("Welcome, "+name+"!");
});
$("loginForm").addEventListener("submit",function(e){
  e.preventDefault();
  var email=$("lEmail").value.trim().toLowerCase(), p=$("lPass").value, err=$("lErr"), users=loadUsers();
  if(!email||!p){err.textContent="Please type your email and password.";return}
  if(!users[email]){err.textContent="No account found for this email. Please register first.";return}
  if(users[email].pw!==hashPw(email+":"+p)){err.textContent="Wrong password. Please try again.";return}
  err.textContent=""; enter(email);
});
$("demoBtn").addEventListener("click",function(){
  var users=loadUsers(), email="demo@example.com";
  if(!users[email]){users[email]={name:"Demo User",age:30,pw:hashPw(email+":demo123")};saveUsers(users)}
  enter(email);
});
$("logoutBtn").addEventListener("click",function(){
  store.set("bf_session","");
  resetAI(); user=null;data=null;
  $("logoutBtn").hidden=true;$("mainnav").classList.remove("on");
  $("planOut").innerHTML="";$("reuseOut").innerHTML="";$("fortOut").innerHTML="";
  document.querySelectorAll("#condChips .tchip").forEach(function(b){b.setAttribute("aria-pressed","false")});
  show("auth");
});

/* ---------- home ---------- */
var TIPS=[
  "Cooked rice left out for hours can make you ill. Cool leftovers quickly and keep them in the fridge.",
  "Plan a weekly menu. It is one of the easiest ways to cut food waste.",
  "Millets like ragi and bajra need less water than rice or wheat.",
  "Use vegetable peels and stems in soups or chutneys.",
  "Buy loose, local and seasonal food when you can. It usually travels less and costs less.",
  "Store bananas away from other fruit so they ripen slower."
];
function renderHome(){
  var g=ageGroup(user.age), msg={
    kid:"Ask a grown-up to help you. Try colourful food and drink water.",
    teen:"Your body is growing fast. Good food gives you energy for school and sport.",
    adult:"Plan smart meals, use leftovers, and keep an eye on your budget.",
    senior:"Simple, gentle nutrition. You can make the text bigger any time from Comfort."
  }[g];
  var e=data.eco, co2=e.g/1000*2.5;
  var tip=TIPS[Math.floor(Date.now()/86400000)%TIPS.length];
  $("v-home").innerHTML=
    '<div class="card welcome"><h1>Hello, '+esc(user.name)+'</h1><p style="margin:6px 0 0">'+msg+'</p></div>'+
    '<div class="mods">'+
    modCard("food","🥗","Food plan","Meals for your body and budget")+
    modCard("fort","🌾","Fortify","Scan food and make it healthier")+
    modCard("reuse","♻️","Reuse","Cook with leftovers, waste less")+
    modCard("care","💗","My care","Readings, medicines, health card")+
    modCard("doc","🩺","Doctor","Book a consultation")+
    modCard("ai","✨","AI helper","Ask about food and health")+
    '</div>'+
    medsHomeCard()+'<div class="card" style="margin-top:14px"><h2>🌍 Your green impact</h2><p class="muted small" style="margin:2px 0 0">From leftover meals you cooked with this app.</p>'+
    '<div class="eco"><div class="stat"><b>'+e.meals+'</b><span>meals rescued</span></div>'+
    '<div class="stat"><b>'+fmt(e.g/1000,2)+' kg</b><span>food not wasted</span></div>'+
    '<div class="stat"><b>'+fmt(co2,1)+' kg</b><span>CO2e avoided (rough)</span></div>'+
    '<div class="stat"><b>'+inr(e.inr)+'</b><span>money saved</span></div></div>'+
    '<div class="note">Estimate uses about 2.5 kg CO2e per kg of food wasted, a rough average.</div></div>'+
    '<div class="card"><h3>💡 Eco tip</h3><p style="margin:4px 0 0">'+esc(tip)+'</p></div>';
  document.querySelectorAll("#v-home [data-go]").forEach(function(b){b.addEventListener("click",function(){if(b.dataset.go==="ai")openAI();else show(b.dataset.go)})});
}
function modCard(k,e,t,d){return '<button type="button" class="mod '+k+'" data-go="'+k+'"><span class="e" aria-hidden="true">'+e+'</span><span><b>'+t+'</b><span class="d">'+d+'</span></span></button>'}

/* ---------- FOOD PLAN ---------- */
var PANTRY=[["rice","Rice"],["dal","Dal / lentils"],["wheat","Atta / roti"],["veg","Vegetables"],["eggs","Eggs"],["milk","Milk / curd"],["fruit","Fruit"],["millet","Ragi / millet"],["oats","Oats"],["bread","Bread"]];
(function(){
  var c=$("pantryChips");
  PANTRY.forEach(function(p){
    var b=document.createElement("button");b.type="button";b.className="tchip";b.textContent=p[1];b.setAttribute("aria-pressed","false");b.dataset.id=p[0];
    b.addEventListener("click",function(){
      var on=b.getAttribute("aria-pressed")==="true";b.setAttribute("aria-pressed",on?"false":"true");
      if(on) pantry=pantry.filter(function(x){return x!==p[0]}); else pantry.push(p[0]);
    });
    c.appendChild(b);
  });
  document.querySelectorAll("#condChips .tchip").forEach(function(b){b.addEventListener("click",function(){toggleCond(b.dataset.c)})});
})();
function prefillProfile(){
  var p=data.profile||{};
  $("pAge").value=p.age||user.age;
  if(p.sex) $("pSex").value=p.sex;
  if(p.h) $("pH").value=p.h; if(p.w) $("pW").value=p.w;
  if(p.act) $("pAct").value=p.act; if(p.diet!=null) $("pDiet").value=p.diet;
  if(p.bud) $("pBud").value=p.bud; if(p.spend!=null) $("pSpend").value=p.spend;
  syncGoalOptions();
}
function syncGoalOptions(){
  var a=+$("pAge").value, lose=$("loseOpt");
  lose.disabled=a<18; lose.hidden=a<18;
  if(a<18&&$("pGoal").value==="lose") $("pGoal").value="keep";
}
$("pAge").addEventListener("input",syncGoalOptions);

// meal, name, level(0 vegan..3 nonveg), kcal, protein, cost, tags, uses
var DISH=[
 ["b","Vegetable poha with peanuts",0,250,6,15,["iron","fibre"],["veg"]],
 ["b","Ragi porridge with banana",0,220,6,10,["iron","fibre","lowgi","lowsalt"],["millet","fruit"]],
 ["b","Vegetable upma",0,240,6,14,["fibre"],["veg"]],
 ["b","Idli (3) with sambar",0,260,10,18,["fibre"],["rice","dal"]],
 ["b","Moong dal chilla (2)",0,240,14,16,["lowgi","iron","fibre","protein"],["dal"]],
 ["b","Egg bhurji with 1 roti",2,280,16,22,["protein","lowgi"],["eggs","wheat"]],
 ["b","Oats with milk and fruit",1,260,10,20,["fibre","lowgi"],["oats","milk","fruit"]],
 ["b","Bread toast with peanut butter",0,260,9,14,["protein"],["bread"]],
 ["l","Dal, rice and mixed vegetables",0,480,16,35,["fibre"],["rice","dal","veg"]],
 ["l","2 rotis, palak dal and salad",0,430,17,32,["iron","fibre","lowgi"],["wheat","dal","veg"]],
 ["l","Rajma with a little rice",0,520,18,38,["iron","fibre"],["rice","dal"]],
 ["l","2 jowar/bajra rotis, vegetable curry, curd",1,420,14,30,["lowgi","iron","fibre"],["millet","veg","milk"]],
 ["l","Egg curry with 2 rotis",2,480,22,42,["protein"],["eggs","wheat"]],
 ["l","Chicken curry, 2 rotis and salad",3,540,32,70,["protein","iron"],["wheat"]],
 ["l","Curd rice with vegetables",1,400,11,28,[],["rice","milk","veg"]],
 ["l","Vegetable moong khichdi",0,420,15,28,["fibre","lowsalt"],["rice","dal","veg"]],
 ["s","Roasted chana (30 g)",0,110,6,6,["iron","fibre","lowgi","lowsalt"],["dal"]],
 ["s","Banana or guava",0,90,1,10,["fibre"],["fruit"]],
 ["s","Sprout salad",0,130,9,12,["iron","fibre","lowgi","lowsalt","protein"],["dal","veg"]],
 ["s","Peanut chikki",0,150,4,8,["highsugar"],[]],
 ["s","Buttermilk",1,40,2,8,["lowgi"],["milk"]],
 ["s","Boiled egg",2,78,6,7,["protein","lowgi","lowsalt"],["eggs"]],
 ["d","2 rotis, mixed vegetables and dal",0,420,15,30,["fibre","lowsalt"],["wheat","dal","veg"]],
 ["d","Paneer bhurji with 2 rotis",1,460,21,45,["protein","lowgi"],["wheat","milk"]],
 ["d","Ragi dosa (2) with chutney",0,300,8,20,["iron","fibre","lowgi"],["millet"]],
 ["d","Lentil soup with a millet roti",0,380,16,26,["iron","fibre","lowgi","lowsalt"],["dal","millet"]],
 ["d","Small fish curry with rice",3,480,28,65,["protein"],["rice"]],
 ["d","Egg and vegetable stir-fry, 1 roti",2,360,20,30,["protein","lowgi"],["eggs","veg","wheat"]],
 ["d","Vegetable pulao with raita",1,450,12,32,[],["rice","veg","milk"]]
];
var MEALS=[["b","Breakfast","🌅",.25],["l","Lunch","🍛",.33],["s","Snack","🍎",.12],["d","Dinner","🌙",.30]];
var TAGTXT={iron:"Iron-rich",fibre:"High fibre",lowgi:"Slow-release energy",lowsalt:"Low salt",protein:"Protein boost"};
var plan=null;

function portionWord(x){return {0.5:"half serving",0.75:"¾ serving",1:"1 serving",1.25:"1¼ servings",1.5:"1½ servings",1.75:"1¾ servings",2:"2 servings"}[x]}
function rankMeal(mk,share,p,target,dailyBudget){
  var mt=target*share, mb=dailyBudget*share, out=[];
  DISH.forEach(function(d){
    if(d[0]!==mk||d[2]>p.diet) return;
    if(p.conds.indexOf("diabetes")>=0&&d[6].indexOf("highsugar")>=0) return;
    var por=Math.min(2,Math.max(.5,Math.round(mt/d[3]*4)/4));
    var kcal=d[3]*por, uses=d[7].some(function(u){return p.pantry.indexOf(u)>=0});
    var cost=d[5]*por*(uses?.7:1);
    var score=-Math.abs(kcal-mt)/mt*10;
    if(p.conds.indexOf("diabetes")>=0&&d[6].indexOf("lowgi")>=0) score+=2;
    if(p.conds.indexOf("bp")>=0&&d[6].indexOf("lowsalt")>=0) score+=2;
    if(p.conds.indexOf("anaemia")>=0&&d[6].indexOf("iron")>=0) score+=2;
    if(uses) score+=1.5;
    score-=Math.max(0,cost-mb)/mb*6;
    out.push({name:d[1],por:por,kcal:kcal,prot:d[4]*por,cost:cost,tags:d[6],uses:uses,score:score});
  });
  out.sort(function(a,b){return b.score-a.score});
  return out;
}
$("planForm").addEventListener("submit",function(e){
  e.preventDefault();
  var err=$("pErr");
  var age=+$("pAge").value,h=+$("pH").value,w=+$("pW").value,bud=+$("pBud").value,spend=+$("pSpend").value||0;
  if(!(age>=5&&age<=110)){err.textContent="Please type an age between 5 and 110.";return}
  if(!(h>=90&&h<=230)){err.textContent="Please type your height in cm (90 to 230).";return}
  if(!(w>=15&&w<=250)){err.textContent="Please type your weight in kg (15 to 250).";return}
  if(!(bud>=300)){err.textContent="Please type a monthly food budget of at least ₹300.";return}
  err.textContent="";
  var p={age:age,sex:$("pSex").value,h:h,w:w,act:+$("pAct").value,diet:+$("pDiet").value,goal:$("pGoal").value,bud:bud,spend:spend,conds:getConds().slice(),pantry:pantry.slice()};
  var bmr=10*w+6.25*h-5*age+(p.sex==="m"?5:-161);
  var adj=0; if(age>=18){ if(p.goal==="lose")adj=-400; if(p.goal==="gain")adj=300; }
  var target=Math.round((bmr*p.act+adj)/10)*10;
  var floor=age>=18?(p.sex==="m"?1500:1200):1200;
  target=Math.min(3200,Math.max(floor,target));
  var protT=Math.round(w*(age>=60?1:(age<18?.95:.8)));
  var dailyBudget=bud/30, ranks={}, idx={};
  MEALS.forEach(function(m){ranks[m[0]]=rankMeal(m[0],m[3],p,target,dailyBudget);idx[m[0]]=0});
  plan={p:p,target:target,protT:protT,ranks:ranks,idx:idx};
  data.profile={age:age,sex:p.sex,h:h,w:w,act:p.act,diet:p.diet,bud:bud,spend:spend};
  saveData();
  renderPlan();
  $("planOut").scrollIntoView({behavior:"smooth",block:"start"});
});
function planTotals(){
  var t={kcal:0,prot:0,cost:0};
  MEALS.forEach(function(m){var d=plan.ranks[m[0]][plan.idx[m[0]]];t.kcal+=d.kcal;t.prot+=d.prot;t.cost+=d.cost});
  return t;
}
function renderPlan(){
  var t=planTotals(), p=plan.p, month=t.cost*30;
  var h='<div class="card"><h2>Your day plan</h2><p class="muted small" style="margin:2px 0 0">About '+plan.target+' kcal and '+plan.protT+' g protein a day suits you. Tap Swap to try another dish.</p>';
  h+='<div class="big"><div class="stat"><b>'+Math.round(t.kcal)+'</b><span>kcal in this plan</span></div>'+
     '<div class="stat"><b>'+Math.round(t.prot)+' g</b><span>protein</span></div>'+
     '<div class="stat"><b>'+inr(t.cost)+'</b><span>cost per day</span></div>'+
     '<div class="stat"><b>'+inr(month)+'</b><span>cost per month</span></div></div>';
  var money;
  if(month<=p.bud) money='This plan fits your budget of '+inr(p.bud)+' with about '+inr(p.bud-month)+' to spare.';
  else money='This plan costs about '+inr(month-p.bud)+' more than your budget of '+inr(p.bud)+'. Try swapping a meal, or tick more food you already have.';
  if(p.spend>0){
    var d=p.spend-month;
    money+=' Compared with your current spending of '+inr(p.spend)+', '+(d>=0?'you could save about '+inr(d)+' a month.':'it costs about '+inr(-d)+' more a month, usually because it is more balanced.');
  }
  h+='<p id="planMoney" style="margin:6px 0 0"><b>Money:</b> '+money+'</p>';
  h+='</div><div class="card" id="mealsCard"><h2>Meals</h2>';
  MEALS.forEach(function(m){
    var list=plan.ranks[m[0]], d=list[plan.idx[m[0]]];
    var tags=d.tags.filter(function(x){return TAGTXT[x]}).map(function(x){return '<span class="badge">'+TAGTXT[x]+'</span>'}).join("");
    if(d.uses) tags+='<span class="badge">Uses food you have</span>';
    h+='<div class="meal"><span class="me" aria-hidden="true">'+m[2]+'</span><h3>'+m[1]+': '+esc(d.name)+'</h3>'+
       '<div class="muted small">'+portionWord(d.por)+' | '+Math.round(d.kcal)+' kcal | '+fmt(d.prot,0)+' g protein | '+inr(d.cost)+'</div>'+
       '<div>'+tags+' <button type="button" class="btn alt sm" data-swap="'+m[0]+'" '+(list.length<2?"disabled":"")+'>Swap dish</button></div></div>';
  });
  h+='<button type="button" class="btn alt block" data-speak="mealsCard" style="margin-top:8px">🔊 Read my plan aloud</button></div>';
  var note='This is a general estimate, not medical advice.';
  if(p.age<18) note+=' Growing children and teens have different needs, so please check with a doctor or dietitian.';
  if(p.conds.length) note+=' Because you selected health needs, please ask a doctor before changing your diet.';
  h+='<div class="note">'+note+'</div>';
  h+='<button type="button" class="btn gold block" id="planAI" style="margin-top:12px">✨ AI: review my plan</button><div class="aiout" id="planAIout" hidden></div>';
  h+='<button type="button" class="btn alt block" id="planToDoc" style="margin-top:12px">Discuss this plan with a doctor</button>';
  $("planOut").innerHTML=h;
  $("planAI").addEventListener("click",function(){
    inlineAI(this,$("planAIout"),"Review my day meal plan. Say what is good, what to improve, and one cheap tip. Details: "+planSummary()+" Monthly food budget "+inr(p.bud)+"; plan costs about "+inr(month)+" a month. Food preference level (0 vegan, 1 vegetarian, 2 eggs ok, 3 non-veg): "+p.diet+".");
  });
  $("planOut").querySelectorAll("[data-swap]").forEach(function(b){
    b.addEventListener("click",function(){
      var k=b.dataset.swap; plan.idx[k]=(plan.idx[k]+1)%plan.ranks[k].length; renderPlan();
    });
  });
  $("planToDoc").addEventListener("click",function(){show("doc")});
}
function planSummary(){
  if(!plan) return "";
  var t=planTotals(), s="Age "+plan.p.age+", "+plan.p.w+" kg, "+plan.p.h+" cm. Target about "+plan.target+" kcal/day. ";
  if(plan.p.conds.length) s+="Health needs: "+plan.p.conds.join(", ")+". ";
  s+="Plan: ";
  s+=MEALS.map(function(m){return m[1]+" "+plan.ranks[m[0]][plan.idx[m[0]]].name}).join("; ");
  return s+". About "+Math.round(t.kcal)+" kcal and "+Math.round(t.prot)+" g protein.";
}

/* ---------- FORTIFY ---------- */
var DV={p:50,fi:25,fe:17,ca:1000,su:50,na:2000};
var BASE_COST=8;
var ING={
  millet:{name:"Ragi (finger millet) flour",kcal:336,p:7.3,c:72,f:1.3,fi:11.5,fe:3.9,ca:344,na:11,cost:14},
  pulse:{name:"Chickpea (besan) flour",kcal:387,p:22,c:58,f:6.7,fi:10.8,fe:4.9,ca:45,na:64,cost:18},
  sesame:{name:"Sesame seeds",kcal:573,p:18,c:23,f:50,fi:11.8,fe:14.6,ca:975,na:11,cost:30}
};
var FOODS=[
 {id:"rice",em:"🍘",name:"Rice snack",sub:"Packaged",conf:93,w:40,cost:10,ing:["Rice flour","Palm oil","Salt","Spices"],n:{kcal:200,p:3.2,c:30,f:8,fi:.8,su:1.5,na:380,fe:.9,ca:20},ocr:"Made Aug 2026. Best before 6 months. May contain peanut.",code:"8901234500011",sg:{millet:20,pulse:20,sesame:5,sugar:0,salt:0}},
 {id:"biscuit",em:"🍪",name:"Cream biscuit",sub:"Packaged",conf:96,w:50,cost:10,ing:["Wheat flour","Sugar","Palm oil","Cream filling","Milk solids"],n:{kcal:250,p:3,c:35,f:11,fi:.9,su:14,na:190,fe:.8,ca:30},ocr:"Made Sep 2026. Best before 9 months. Contains wheat (gluten) and milk.",code:"8901234500012",sg:{millet:25,pulse:15,sesame:5,sugar:30,salt:0}},
 {id:"sandwich",em:"🥪",name:"Vegetable sandwich",sub:"Fresh",conf:91,w:150,cost:25,ing:["White bread","Cucumber","Tomato","Onion","Green chutney","Cheese slice"],n:{kcal:280,p:8,c:38,f:10,fi:3,su:5,na:620,fe:1.8,ca:60},ocr:"",code:"",sg:{millet:15,pulse:10,sesame:3,sugar:0,salt:25}},
 {id:"noodles",em:"🍜",name:"Instant noodles",sub:"Packaged",conf:95,w:70,cost:14,ing:["Refined wheat flour","Palm oil","Salt","Flavour mix"],n:{kcal:310,p:7,c:44,f:12,fi:1.5,su:2,na:1050,fe:1.6,ca:40},ocr:"Made Jul 2026. Best before 9 months. Contains wheat (gluten) and soy.",code:"8901234500013",sg:{millet:25,pulse:15,sesame:3,sugar:0,salt:30}},
 {id:"idli",em:"🍚",name:"Idli (2 pieces)",sub:"Fresh",conf:94,w:120,cost:12,ing:["Rice","Urad dal","Salt"],n:{kcal:130,p:4,c:26,f:.6,fi:1.2,su:.5,na:250,fe:.9,ca:20},ocr:"",code:"",sg:{millet:25,pulse:15,sesame:4,sugar:0,salt:0}},
 {id:"poha",em:"🥣",name:"Poha",sub:"Fresh",conf:89,w:150,cost:15,ing:["Flattened rice","Onion","Peanuts","Curry leaves","Turmeric"],n:{kcal:250,p:4.5,c:44,f:6,fi:2,su:2,na:420,fe:2.5,ca:15},ocr:"",code:"",sg:{millet:15,pulse:15,sesame:5,sugar:0,salt:15}}
];
var METRICS=[
 {k:"p",name:"Protein",unit:"g",type:"good",low:8,goodFrom:15,dec:1},
 {k:"fi",name:"Fibre",unit:"g",type:"good",low:8,goodFrom:16,dec:1},
 {k:"su",name:"Sugar",unit:"g",type:"limit",midFrom:10,badFrom:20,dec:1},
 {k:"na",name:"Sodium",unit:"mg",type:"limit",midFrom:15,badFrom:30,dec:0}
];
var MICROS=[
 {k:"fe",name:"Iron",unit:"mg",type:"good",low:8,goodFrom:20,dec:1},
 {k:"ca",name:"Calcium",unit:"mg",type:"good",low:8,goodFrom:15,dec:0}
];
var ALLM=METRICS.concat(MICROS);
function pct(k,v){return v/DV[k]*100}
function rate(m,v){
  var p=pct(m.k,v);
  if(m.type==="good"){ if(p<m.low)return{lv:"bad",label:"Low"}; if(p>=m.goodFrom)return{lv:"good",label:"Good"}; return{lv:"mid",label:"Moderate"}; }
  if(p>m.badFrom)return{lv:"bad",label:"High"}; if(p>=m.midFrom)return{lv:"mid",label:"Moderate"}; return{lv:"good",label:"Low"};
}
function pill(r){var d=r.lv==="good"?"🟢":(r.lv==="mid"?"🟡":"🔴");return '<span class="pill '+r.lv+'">'+d+' '+r.label+'</span>'}
function nrow(m,v){
  var r=rate(m,v),p=pct(m.k,v);
  return '<div class="nrow"><span><b>'+m.name+'</b>'+pill(r)+'</span><span class="val">'+fmt(v,m.dec)+' '+m.unit+'</span>'+
    '<div class="track" role="img" aria-label="'+m.name+' is '+fmt(p,0)+' percent of daily need"><div class="fill '+r.lv+'" style="width:'+Math.min(100,p)+'%"></div></div>'+
    '<span class="dv">'+fmt(p,0)+'% of daily need</span></div>';
}
function compute(f,s){
  var W=f.w,n=f.n,fr={millet:s.millet/100,pulse:s.pulse/100,sesame:s.sesame/100};
  var sum=fr.millet+fr.pulse+fr.sesame,keep=1-sum,o={};
  ["kcal","p","c","f","fi","fe","ca"].forEach(function(k){
    var v=n[k]*keep; Object.keys(ING).forEach(function(i){v+=ING[i][k]*W*fr[i]/100}); o[k]=v;
  });
  o.na=n.na*keep*(1-s.salt/100); Object.keys(ING).forEach(function(i){o.na+=ING[i].na*W*fr[i]/100});
  var suK=n.su*keep,suN=suK*(1-s.sugar/100),rem=suK-suN;
  o.su=suN;o.c=Math.max(0,o.c-rem);o.kcal=Math.max(0,o.kcal-rem*4);
  var cost=f.cost; Object.keys(ING).forEach(function(i){cost+=(W*fr[i])*(ING[i].cost-BASE_COST)/100});
  o.cost=cost-rem*.045; o.sum=sum; return o;
}
var fort={food:null,s:{millet:0,pulse:0,sesame:0,sugar:0,salt:0},busy:false};
(function(){
  var c=$("fFoods");
  FOODS.forEach(function(f){
    var b=document.createElement("button");b.type="button";b.className="tchip";b.innerHTML='<span aria-hidden="true">'+f.em+'</span> '+esc(f.name);
    b.addEventListener("click",function(){scanFood(f,false)});c.appendChild(b);
  });
})();
$("fPhotoBtn").addEventListener("click",function(){$("fPhoto").click()});
$("fPhoto").addEventListener("change",function(e){
  var file=e.target.files&&e.target.files[0];if(!file)return;
  var r=new FileReader();r.onload=function(){$("fPreview").src=r.result;$("fPreviewWrap").hidden=false;$("fMsg").textContent="Photo added. In this demo, tap which food it is below."};
  r.readAsDataURL(file);
});
$("fCodeBtn").addEventListener("click",function(){
  var list=FOODS.filter(function(f){return f.code});
  var f=list[Math.floor(Math.random()*list.length)];
  $("fMsg").textContent="Barcode "+f.code+" found.";scanFood(f,true);
});
function scanFood(f,viaCode){
  if(fort.busy)return; fort.busy=true;
  $("fMsg").textContent=viaCode?"Reading barcode...":"Identifying food...";
  setTimeout(function(){
    fort.busy=false;fort.food=f;fort.s={millet:0,pulse:0,sesame:0,sugar:0,salt:0};
    $("fMsg").textContent="Demo library: tap a food to scan it.";
    renderFort();$("fortOut").scrollIntoView({behavior:"smooth",block:"start"});
  },900);
}
var SLIDERS=[
 {k:"millet",label:"Ragi (millet) flour",max:40,hint:"Adds fibre, iron and calcium"},
 {k:"pulse",label:"Chickpea flour",max:30,hint:"Adds protein and fibre"},
 {k:"sesame",label:"Sesame seeds",max:10,hint:"Adds iron and calcium"},
 {k:"sugar",label:"Less sugar",max:50,hint:"Cuts sugar in the recipe"},
 {k:"salt",label:"Less salt",max:40,hint:"Cuts sodium in the original recipe"}
];
var GAPTXT={p:"Low in protein. Protein helps growth and keeps you full.",fi:"Low in fibre. Fibre helps digestion and steady energy.",fe:"Low in iron. Iron helps prevent anaemia.",ca:"Low in calcium. Calcium builds bones and teeth.",su:"High in sugar. Best to limit added sugar.",na:"High in sodium. Too much salt is hard on blood pressure."};
function renderFort(){
  var f=fort.food,n=f.n,h='';
  h+='<div class="card" id="fAnalysis"><div style="display:flex;gap:12px;align-items:center"><span style="font-size:2.6rem" aria-hidden="true">'+f.em+'</span><div><h2>'+esc(f.name)+'</h2><span class="muted small">'+f.sub+' food | '+f.conf+'% match (demo)</span></div></div>'+
     '<div class="chips">'+f.ing.map(function(i){return '<span class="badge">'+esc(i)+'</span>'}).join("")+'</div>'+
     '<p style="margin:10px 0 0"><b style="font-size:1.6rem">'+n.kcal+'</b> kcal per serving of about '+f.w+' g. Carbs '+n.c+' g, fat '+n.f+' g.</p>'+
     METRICS.map(function(m){return nrow(m,n[m.k])}).join("")+
     MICROS.map(function(m){return nrow(m,n[m.k])}).join("");
  if(f.ocr) h+='<div class="note"><b>Label read (sample):</b> '+esc(f.ocr)+' A camera cannot tell if food is microbiologically safe. That needs testing.</div>';
  h+='<button type="button" class="btn alt block" data-speak="fAnalysis" style="margin-top:10px">🔊 Read aloud</button><button type="button" class="btn gold block" id="fAIbtn" style="margin-top:8px">✨ Explain in simple words</button><div class="aiout" id="fAIout" hidden></div></div>';
  var gaps=[];ALLM.forEach(function(m){var r=rate(m,n[m.k]);if(r.lv==="bad"||(r.lv==="mid"&&m.type==="limit"))gaps.push({m:m,r:r,v:n[m.k]})});
  h+='<div class="card"><h2>Gaps found</h2>';
  if(!gaps.length) h+='<p>No major gaps. Nice balance.</p>';
  gaps.forEach(function(g){
    h+='<div class="nrow"><span><b>'+g.m.name+'</b>'+pill(g.r)+'<br><span class="muted small">'+(g.r.lv==="mid"?g.m.name+" is moderately high.":GAPTXT[g.m.k])+'</span></span><span class="val">'+fmt(g.v,g.m.dec)+' '+g.m.unit+'</span></div>';
  });
  h+='</div>';
  h+='<div class="card"><h2>Improve my food</h2><p class="muted small" style="margin:2px 0 6px">Replace part of the recipe with low-cost fortifiers and watch the numbers change.</p>'+
     '<button type="button" class="btn gold block" id="fAi">✨ Improve my food</button><button type="button" class="btn alt block" id="fReset" style="margin-top:8px">Reset to original</button><div style="margin-top:8px">';
  SLIDERS.forEach(function(s){
    h+='<div class="slider"><label for="fs_'+s.k+'"><span>'+s.label+'</span><output id="fo_'+s.k+'">0%</output></label><input type="range" id="fs_'+s.k+'" min="0" max="'+s.max+'" step="1" value="0"><div class="hint">'+s.hint+'</div></div>';
  });
  h+='</div><p id="fRecipe" class="small" style="margin:8px 0 0"></p></div>';
  h+='<div class="card"><h2>Before and after</h2><div class="scroll" id="fCmp"></div><div class="note">Predicted from ingredient reference data, not lab-tested. Costs are rough retail estimates.</div></div>';
  $("fortOut").innerHTML=h;
  $("fAIbtn").addEventListener("click",function(){
    var lines=ALLM.map(function(m){return m.name+": "+fmt(n[m.k],m.dec)+" "+m.unit+" ("+rate(m,n[m.k]).label+")"}).join("; ");
    inlineAI(this,$("fAIout"),"Explain this food scan in simple words. Food: "+f.name+". Per serving: "+n.kcal+" kcal; "+lines+". Suggest one improvement using millet, chickpea flour or sesame, and one healthy habit.");
  });
  SLIDERS.forEach(function(s){$("fs_"+s.k).addEventListener("input",function(e){fort.s[s.k]=+e.target.value;updateFort()})});
  $("fAi").addEventListener("click",function(){SLIDERS.forEach(function(s){fort.s[s.k]=f.sg[s.k];$("fs_"+s.k).value=f.sg[s.k]});updateFort()});
  $("fReset").addEventListener("click",function(){SLIDERS.forEach(function(s){fort.s[s.k]=0;$("fs_"+s.k).value=0});updateFort()});
  updateFort();
}
function updateFort(){
  var f=fort.food,s=fort.s,a=compute(f,s),b=f.n;
  SLIDERS.forEach(function(x){$("fo_"+x.k).textContent=s[x.k]+"%"});
  var parts=[];
  if(a.sum>0)parts.push("<b>"+Math.round((1-a.sum)*100)+"%</b> original recipe");
  if(s.millet)parts.push("<b>"+s.millet+"%</b> ragi flour");if(s.pulse)parts.push("<b>"+s.pulse+"%</b> chickpea flour");if(s.sesame)parts.push("<b>"+s.sesame+"%</b> sesame");
  var ex=[];if(s.sugar)ex.push(s.sugar+"% less sugar");if(s.salt)ex.push(s.salt+"% less salt");
  $("fRecipe").innerHTML=(parts.length||ex.length)?"Suggested recipe: "+parts.join(" + ")+(ex.length?(parts.length?"; ":"")+ex.join(", "):"")+".":'Original recipe. Tap "Improve my food" or move a slider.';
  var t='<table class="cmp"><thead><tr><th>Nutrient</th><th>Before</th><th>After</th><th></th></tr></thead><tbody>';
  t+='<tr><td><b>Calories</b></td><td>'+fmt(b.kcal,0)+' kcal</td><td><b>'+fmt(a.kcal,0)+' kcal</b></td><td></td></tr>';
  ALLM.forEach(function(m){
    var bv=b[m.k],av=a[m.k],r=rate(m,av),d=av-bv,ar,cl;
    if(Math.abs(d)<Math.pow(10,-m.dec)/2){ar="–";cl="flat"}
    else if(d>0){ar="↑";cl=m.type==="good"?"up":"worse"} else {ar="↓";cl=m.type==="good"?"worse":"down"}
    t+='<tr><td><b>'+m.name+'</b></td><td>'+fmt(bv,m.dec)+' '+m.unit+'</td><td><b>'+fmt(av,m.dec)+' '+m.unit+'</b> <span class="'+cl+'">'+ar+'</span></td><td>'+pill(r)+'</td></tr>';
  });
  t+='</tbody></table><div class="costbar"><span>Estimated cost per serving</span><span><span class="flat">'+inr(f.cost)+'</span> → <b style="font-size:1.25rem">₹'+fmt(a.cost,1)+'</b></span></div>';
  $("fCmp").innerHTML=t;
}

/* ---------- REUSE ---------- */
var LEFT=[
 {id:"rice",em:"🍚",name:"Cooked rice",g:150,v:8},{id:"dal",em:"🥣",name:"Dal",g:100,v:6},
 {id:"roti",em:"🫓",name:"Roti / chapati",g:80,v:6},{id:"veg",em:"🥕",name:"Vegetable curry",g:120,v:10},
 {id:"bread",em:"🍞",name:"Bread slices",g:100,v:8},{id:"idli",em:"⚪",name:"Idli",g:150,v:9},
 {id:"potato",em:"🥔",name:"Boiled potato",g:150,v:6},{id:"curd",em:"🥛",name:"Curd",g:100,v:6},
 {id:"banana",em:"🍌",name:"Overripe banana",g:200,v:10}
];
// need: list of groups; each group = alternatives
var RECIPES=[
 {n:"Rice and vegetable tikki",need:[["rice"],["veg","potato"]],kcal:230,p:5,min:20,how:"Mash the rice with the vegetables or potato, add spices, shape into patties and shallow-cook until golden."},
 {n:"Khichdi from leftover dal and rice",need:[["rice"],["dal"]],kcal:380,p:13,min:15,how:"Simmer rice and dal with a little water, turmeric and cumin until soft and porridge-like."},
 {n:"Dal roti roll",need:[["roti"],["dal"]],kcal:320,p:12,min:10,how:"Thicken the dal by cooking it dry, spread on the roti with chopped onion and roll."},
 {n:"Masala roti upma",need:[["roti"],["veg","potato","curd"]],kcal:260,p:8,min:12,how:"Tear the roti into small pieces and toss in a pan with mustard seeds, onion and the vegetables."},
 {n:"Bread and vegetable toastie",need:[["bread"],["veg","potato"]],kcal:280,p:8,min:12,how:"Fill bread with the vegetables, toast on a pan until crisp."},
 {n:"Masala fried idli",need:[["idli"]],kcal:200,p:6,min:10,how:"Cut idli into cubes and stir-fry with mustard seeds, curry leaves and chilli powder."},
 {n:"Curd rice",need:[["rice"],["curd"]],kcal:300,p:9,min:5,how:"Mix rice with curd and a pinch of salt. Add a tempering of mustard seeds and curry leaves."},
 {n:"Banana curd smoothie",need:[["banana"],["curd"]],kcal:180,p:6,min:5,how:"Blend the ripe banana with curd and a little water. Serve cold."},
 {n:"Potato and bread cutlet",need:[["potato"],["bread"]],kcal:300,p:7,min:20,how:"Mash the potato, mix with crumbled bread and spices, shape and shallow-cook."}
];
var have=[];
function renderReuseChips(){
  var c=$("leftChips");if(c.childElementCount)return;
  LEFT.forEach(function(it){
    var b=document.createElement("button");b.type="button";b.className="tchip";b.setAttribute("aria-pressed","false");
    b.innerHTML='<span aria-hidden="true">'+it.em+'</span> '+esc(it.name);
    b.addEventListener("click",function(){
      var on=b.getAttribute("aria-pressed")==="true";b.setAttribute("aria-pressed",on?"false":"true");
      if(on)have=have.filter(function(x){return x!==it.id});else have.push(it.id);
    });
    c.appendChild(b);
  });
}
$("rPhotoBtn").addEventListener("click",function(){$("rPhoto").click()});
$("rPhoto").addEventListener("change",function(e){
  var file=e.target.files&&e.target.files[0];if(!file)return;
  var r=new FileReader();r.onload=function(){$("rPreview").src=r.result;$("rPreviewWrap").hidden=false;toast("Photo added. In this demo, tap the items you see.")};
  r.readAsDataURL(file);
});
var found=[];
$("findBtn").addEventListener("click",function(){
  var err=$("reErr");
  if(!have.length){err.textContent="Please tap at least one food you have.";return}
  err.textContent="";
  found=RECIPES.map(function(r){
    var matched=0,used=[];
    r.need.forEach(function(grp){
      var hit=grp.filter(function(x){return have.indexOf(x)>=0});
      if(hit.length){matched++;used=used.concat(hit)}
    });
    return {r:r,matched:matched,total:r.need.length,used:used,missing:r.need.filter(function(g){return !g.some(function(x){return have.indexOf(x)>=0})})};
  }).filter(function(x){return x.matched>0}).sort(function(a,b){return (b.matched/b.total)-(a.matched/a.total)||b.matched-a.matched}).slice(0,3);
  renderReuse();
  $("reuseOut").scrollIntoView({behavior:"smooth",block:"start"});
});
function nameOf(id){return LEFT.filter(function(x){return x.id===id})[0].name.toLowerCase()}
function renderReuse(){
  var h='';
  if(!found.length){$("reuseOut").innerHTML='<div class="card"><p>No ideas yet for these items. Try adding rice, dal, roti or vegetables.</p></div>';return}
  h+='<div class="card" id="reuseCard"><h2>Meal ideas</h2>';
  found.forEach(function(x,i){
    var g=0,v=0; x.used.forEach(function(id){var it=LEFT.filter(function(l){return l.id===id})[0];g+=it.g;v+=it.v});
    x.g=g;x.v=v;
    var full=x.matched===x.total;
    h+='<div class="recipe'+(i===0&&full?" best":"")+'"><h3>'+esc(x.r.n)+(full?' <span class="pill good">You have everything</span>':' <span class="pill mid">Almost</span>')+'</h3>'+
       '<div class="muted small">'+x.r.kcal+' kcal | '+x.r.p+' g protein | about '+x.r.min+' min</div>'+
       '<p style="margin:6px 0">'+esc(x.r.how)+'</p>'+
       (full?'':'<p class="small" style="margin:0 0 6px"><b>Still needed:</b> '+x.missing.map(function(gp){return gp.map(nameOf).join(" or ")}).join(", ")+'.</p>')+
       '<div class="chips" style="margin:0 0 8px"><span class="badge">Saves about '+inr(v)+'</span><span class="badge">'+g+' g not wasted</span><span class="badge">'+fmt(g/1000*2.5,2)+' kg CO2e avoided</span></div>'+
       '<button type="button" class="btn sm" data-cook="'+i+'">I cooked this</button></div>';
  });
  h+='<button type="button" class="btn gold block" id="reAI" style="margin-top:12px">✨ AI: make me a recipe</button><div class="aiout" id="reAIout" hidden></div>'+
     '<button type="button" class="btn alt block" data-speak="reuseCard" style="margin-top:12px">🔊 Read aloud</button>'+
     '<div class="note"><b>Food safety:</b> Refrigerate cooked food within 2 hours, eat leftovers within 1 to 2 days, and reheat until steaming hot. If it smells or looks off, do not eat it.</div></div>';
  $("reuseOut").innerHTML=h;
  $("reAI").addEventListener("click",function(){
    inlineAI(this,$("reAIout"),"Create one simple, low-cost family recipe using mainly these leftovers: "+have.map(nameOf).join(", ")+". Give a name, ingredients with rough amounts, 4 short steps and one food-safety reminder.");
  });
  $("reuseOut").querySelectorAll("[data-cook]").forEach(function(b){
    b.addEventListener("click",function(){
      var x=found[+b.dataset.cook];
      data.eco.meals+=1;data.eco.g+=x.g;data.eco.inr+=x.v;saveData();
      b.disabled=true;b.textContent="Added to your green impact";
      toast("Great! "+x.g+" g of food saved from waste.");
    });
  });
}

/* ---------- DOCTOR ---------- */
var DOCS=[
 {id:"d1",em:"🥗",name:"Dr. Meera Iyer",role:"Clinical dietitian",tags:["adult","teen","senior"],for:"Meal plans, weight, iron and general nutrition"},
 {id:"d2",em:"🩺",name:"Dr. Arjun Menon",role:"General physician",tags:["adult","senior","teen"],for:"General health questions and check-ups"},
 {id:"d3",em:"🧒",name:"Dr. Kavita Rao",role:"Paediatrician",tags:["kid","teen"],for:"Children and teenagers: growth and healthy eating"},
 {id:"d4",em:"👵",name:"Dr. Sameer Khan",role:"Geriatric medicine",tags:["senior"],for:"Older adults: appetite, bones and medicines"},
 {id:"d5",em:"🍬",name:"Dr. Neha Joshi",role:"Diabetes and endocrinology",tags:["adult","senior"],for:"Blood sugar, thyroid and diet planning"}
];
var booking={doc:null,mode:"Video",day:null,slot:null};
var SLOTS=["09:00","10:30","12:00","16:00","17:30","19:00"];
function dayList(){
  var out=[],d=new Date();
  for(var i=1;i<=5;i++){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i);out.push({key:x.toISOString().slice(0,10),label:x.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})})}
  return out;
}
function isBooked(doc,day,slot){return parseInt(hashPw(doc+day+slot).slice(-2),16)%4===0}
function renderDoc(){
  var g=ageGroup(user.age), diab=getConds().indexOf("diabetes")>=0;
  var sug=g==="kid"?"Suggested: Dr. Kavita Rao (paediatrician).":g==="senior"?"Suggested: Dr. Sameer Khan or Dr. Arjun Menon.":diab?"Suggested: Dr. Neha Joshi (diabetes) or Dr. Meera Iyer.":"Suggested: Dr. Meera Iyer (dietitian).";
  $("docSuggest").textContent=sug;
  var h='';
  DOCS.forEach(function(d){
    h+='<button type="button" class="doc" data-d="'+d.id+'" aria-pressed="'+(booking.doc===d.id)+'"><span class="av" aria-hidden="true">'+d.em+'</span><span><b>'+d.name+'</b><br><span class="muted small">'+d.role+'</span><br><span class="small">'+d.for+'</span><br><span class="badge">Sample profile</span></span></button>';
  });
  $("docList").innerHTML=h;
  $("docList").querySelectorAll(".doc").forEach(function(b){
    b.addEventListener("click",function(){booking.doc=b.dataset.d;booking.slot=null;renderDoc()});
  });
  var m='';["Video","Audio call","Chat"].forEach(function(x){m+='<button type="button" class="tchip" data-m="'+x+'" aria-pressed="'+(booking.mode===x)+'">'+x+'</button>'});
  $("modeChips").innerHTML=m;
  $("modeChips").querySelectorAll("[data-m]").forEach(function(b){b.addEventListener("click",function(){booking.mode=b.dataset.m;renderDoc()})});
  var days=dayList();if(!booking.day)booking.day=days[0].key;
  $("dayList").innerHTML=days.map(function(d){return '<button type="button" class="slot" data-day="'+d.key+'" aria-pressed="'+(booking.day===d.key)+'">'+d.label+'</button>'}).join("");
  $("dayList").querySelectorAll("[data-day]").forEach(function(b){b.addEventListener("click",function(){booking.day=b.dataset.day;booking.slot=null;renderDoc()})});
  $("slotList").innerHTML=booking.doc?SLOTS.map(function(s){
    var dis=isBooked(booking.doc,booking.day,s);
    return '<button type="button" class="slot" data-slot="'+s+'" '+(dis?"disabled":"")+' aria-pressed="'+(booking.slot===s)+'">'+s+(dis?" (full)":"")+'</button>';
  }).join(""):'<span class="muted small">Choose a doctor first to see times.</span>';
  $("slotList").querySelectorAll("[data-slot]").forEach(function(b){b.addEventListener("click",function(){booking.slot=b.dataset.slot;renderDoc()})});
  var sh=$("dShare");
  var hs=hasHealthData()?healthSummary():"";
  $("shareHint").textContent=hs?"Will share: "+hs.replace(/\n/g," ").slice(0,260)+(hs.length>260?"...":""):"Make a food plan or add health details first if you want to share them.";
  sh.disabled=!hs; if(!hs)sh.checked=false;
  renderBookings();
}
function renderBookings(){
  var list=data.consults;
  if(!list.length){$("myBookings").innerHTML='<p class="muted">No consultations yet.</p>';return}
  $("myBookings").innerHTML=list.map(function(b,i){
    return '<div class="booking"><b>'+esc(b.doc)+'</b> <span class="badge">'+esc(b.id)+'</span><br>'+esc(b.mode)+' on '+esc(b.dayLabel)+' at '+esc(b.slot)+
      (b.reason?'<br><span class="muted small">Reason: '+esc(b.reason)+'</span>':'')+(b.shared?'<br><span class="muted small">Summary shared</span>':'')+
      '<br><button type="button" class="btn alt sm" data-cancel="'+i+'" style="margin-top:6px">Cancel</button></div>';
  }).join("");
  $("myBookings").querySelectorAll("[data-cancel]").forEach(function(b){
    b.addEventListener("click",function(){data.consults.splice(+b.dataset.cancel,1);saveData();renderBookings();toast("Consultation cancelled.")});
  });
}
$("bookBtn").addEventListener("click",function(){
  var err=$("dErr");
  if(!booking.doc){err.textContent="Please choose a doctor.";return}
  if(!booking.slot){err.textContent="Please pick a time.";return}
  err.textContent="";
  var doc=DOCS.filter(function(d){return d.id===booking.doc})[0];
  var day=dayList().filter(function(d){return d.key===booking.day})[0];
  var id="NP-"+Math.random().toString(36).slice(2,8).toUpperCase();
  data.consults.unshift({id:id,doc:doc.name+" ("+doc.role+")",mode:booking.mode,dayLabel:day.label,slot:booking.slot,reason:$("dReason").value.trim().slice(0,300),shared:$("dShare").checked});
  saveData();
  booking.slot=null;$("dReason").value="";$("dShare").checked=false;
  renderDoc();
  toast("Booked! Your reference is "+id+" (demo).");
  $("myBookings").scrollIntoView({behavior:"smooth",block:"center"});
});

/* ---------- CARE HUB ---------- */
var CONDS=[["diabetes","Diabetes"],["bp","High blood pressure"],["anaemia","Low iron / anaemia"],["heart","Heart condition"],["kidney","Kidney condition"],["asthma","Asthma"],["thyroid","Thyroid"]];
function condName(k){return CONDS.filter(function(c){return c[0]===k})[0][1]}
function H(){
  if(!data.health) data.health={};
  var h=data.health;
  ["conds","vitals","meds","questions"].forEach(function(k){h[k]=h[k]||[]});
  h.taken=h.taken||{}; h.blood=h.blood||""; h.allergies=h.allergies||""; h.cName=h.cName||""; h.cPhone=h.cPhone||"";
  return h;
}
function getConds(){return user?H().conds:[]}
function toggleCond(k){var h=H(),i=h.conds.indexOf(k);if(i>=0)h.conds.splice(i,1);else h.conds.push(k);saveData();syncCondChips()}
function syncCondChips(){
  var c=getConds();
  document.querySelectorAll("#condChips .tchip, #careConds .tchip").forEach(function(b){b.setAttribute("aria-pressed",c.indexOf(b.dataset.c)>=0?"true":"false")});
}
function dateStr(t){return new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
function todayKey(){return new Date().toLocaleDateString("en-CA")}
var VNAME={bp:"blood pressure",sugar:"blood sugar",wt:"weight"};
var WHEN={fasting:"fasting",after:"2 hours after a meal",random:"any time"};
function bpStatus(s,d){
  if(s>=180||d>=120) return {lv:"bad",label:"Very high",urgent:true};
  if(s>=140||d>=90) return {lv:"bad",label:"High"};
  if(s>=130||d>=80) return {lv:"mid",label:"Raised"};
  if(s<90||d<60) return {lv:"mid",label:"Low"};
  return {lv:"good",label:"Normal"};
}
function sugarStatus(v,when){
  if(v<54) return {lv:"bad",label:"Very low",urgent:true,low:true};
  if(v>300) return {lv:"bad",label:"Very high",urgent:true};
  if(v<70) return {lv:"bad",label:"Low",low:true};
  if(when==="fasting"){ if(v<100)return{lv:"good",label:"Normal"}; if(v<126)return{lv:"mid",label:"Above normal"}; return{lv:"bad",label:"High"}; }
  if(v<140) return {lv:"good",label:"Normal"}; if(v<200) return {lv:"mid",label:"Above normal"}; return {lv:"bad",label:"High"};
}
function statusOf(e){
  if(e.type==="bp") return bpStatus(e.a,e.b);
  if(e.type==="sugar") return sugarStatus(e.a,e.when);
  return {lv:"good",label:""};
}
function describe(e){
  if(e.type==="bp") return e.a+"/"+e.b+" mmHg";
  if(e.type==="sugar") return e.a+" mg/dL ("+WHEN[e.when||"random"]+")";
  return e.a+" kg";
}
function renderVFields(){
  var t=$("vType").value, h="";
  if(t==="bp") h='<div class="row2"><div><label class="f" for="vA">Top number (systolic)</label><input id="vA" type="number" inputmode="numeric" min="60" max="260"></div><div><label class="f" for="vB">Bottom number (diastolic)</label><input id="vB" type="number" inputmode="numeric" min="30" max="160"></div></div>';
  else if(t==="sugar") h='<div class="row2"><div><label class="f" for="vA">Blood sugar (mg/dL)</label><input id="vA" type="number" inputmode="numeric" min="20" max="600"></div><div><label class="f" for="vW">When?</label><select id="vW"><option value="fasting">Fasting (before food)</option><option value="after">2 hours after a meal</option><option value="random">Any other time</option></select></div></div>';
  else h='<label class="f" for="vA">Weight (kg)</label><input id="vA" type="number" inputmode="decimal" step="0.1" min="15" max="250">';
  $("vFields").innerHTML=h; $("vErr").textContent="";
}
function chartSVG(list,type){
  var pts=list.slice(0,14).reverse();
  if(pts.length<2) return '<p class="muted small">Add at least 2 readings to see a trend.</p>';
  var vals=pts.map(function(e){return e.a}), mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
  if(mx===mn){mx+=1;mn-=1}
  var W=300,HH=110,px=30,py=16;
  var xy=pts.map(function(e,i){return [px+(W-px-8)*i/(pts.length-1), HH-py-(HH-2*py)*(e.a-mn)/(mx-mn)]});
  var line=xy.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" ");
  var dots=xy.map(function(p){return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.5" style="fill:var(--brand)"/>'}).join("");
  var lab='<text x="2" y="'+(py+3)+'" font-size="10" style="fill:var(--muted)">'+fmt(mx,type==="wt"?1:0)+'</text><text x="2" y="'+(HH-py+3)+'" font-size="10" style="fill:var(--muted)">'+fmt(mn,type==="wt"?1:0)+'</text>';
  return '<svg viewBox="0 0 300 110" width="100%" role="img" aria-label="Trend of your last '+pts.length+' '+VNAME[type]+' readings, from '+vals[0]+' to '+vals[vals.length-1]+'"><polyline points="'+line+'" fill="none" stroke-width="2.5" style="stroke:var(--brand)"/>'+dots+lab+'</svg><div class="hint">'+(type==="bp"?"Line shows the top number.":"Oldest on the left, newest on the right.")+'</div>';
}
function renderVitals(){
  var type=$("vType").value, h=H(), list=h.vitals.filter(function(e){return e.type===type});
  if(!list.length){ $("vList").innerHTML='<p class="muted">No readings saved yet.</p>'; $("vChart").innerHTML=""; return }
  $("vList").innerHTML=list.slice(0,6).map(function(e){
    var st=statusOf(e), d=new Date(e.t);
    return '<div class="vrow"><span><b>'+esc(describe(e))+'</b>'+(st.label?' <span class="pill '+st.lv+'">'+st.label+'</span>':'')+'<br><span class="muted small">'+dateStr(e.t)+', '+d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+'</span></span><button type="button" class="btn alt sm" data-vdel="'+e.t+'" aria-label="Delete this reading">Delete</button></div>';
  }).join("");
  var extra="";
  if(type==="wt"){
    var ht=data.profile&&data.profile.h, age=(data.profile&&data.profile.age)||user.age;
    if(ht&&age>=18){ var bmi=list[0].a/Math.pow(ht/100,2); extra='<p class="small" style="margin:8px 0 0"><b>BMI '+fmt(bmi,1)+'</b>: '+(bmi<18.5?"below the healthy range":bmi<23?"in the healthy range":bmi<25?"slightly above the healthy range":"above the healthy range")+' (general guide for Indian adults).</p>' }
    else if(age<18) extra='<p class="small muted" style="margin:8px 0 0">For children and teens, weight is judged on growth charts. Please ask a doctor.</p>';
  }
  $("vChart").innerHTML=chartSVG(list,type)+extra;
  $("vList").querySelectorAll("[data-vdel]").forEach(function(b){
    b.addEventListener("click",function(){var t=+b.dataset.vdel;h.vitals=h.vitals.filter(function(e){return e.t!==t});saveData();renderVitals()});
  });
}
function adherence(){
  var h=H(), day=h.taken[todayKey()]||{}, total=0, done=0;
  h.meds.forEach(function(m){total+=m.times.length;done+=(day[m.id]||[]).filter(function(t){return m.times.indexOf(t)>=0}).length});
  return {total:total,done:done};
}
var mTimes=[];
function renderMeds(){
  var h=H(), day=h.taken[todayKey()]||{}, a=adherence();
  if(!h.meds.length){ $("medToday").innerHTML='<p class="muted">No medicines added yet.</p>'; return }
  var s='<p style="margin:8px 0 4px"><b>Today: '+a.done+' of '+a.total+' doses taken</b></p><div class="track" role="img" aria-label="'+a.done+' of '+a.total+' doses taken today"><div class="fill good" style="width:'+(a.total?a.done/a.total*100:0)+'%"></div></div>';
  h.meds.forEach(function(m){
    var took=day[m.id]||[];
    s+='<div class="medrow"><b>'+esc(m.name)+'</b>'+(m.dose?' <span class="muted">'+esc(m.dose)+'</span>':'')+(m.food?' <span class="badge">'+esc(m.food)+'</span>':'')+'<div class="chips">'+
      m.times.map(function(t){var on=took.indexOf(t)>=0;return '<button type="button" class="tchip" data-take="'+m.id+'|'+t+'" aria-pressed="'+on+'">'+t+(on?' ✓ taken':'')+'</button>'}).join("")+
      '</div><button type="button" class="btn alt sm" data-mdel="'+m.id+'" style="margin-top:8px">Remove</button></div>';
  });
  $("medToday").innerHTML=s;
  $("medToday").querySelectorAll("[data-take]").forEach(function(b){
    b.addEventListener("click",function(){
      var p=b.dataset.take.split("|"), k=todayKey();
      h.taken[k]=h.taken[k]||{}; var arr=h.taken[k][p[0]]=h.taken[k][p[0]]||[];
      var i=arr.indexOf(p[1]); if(i>=0)arr.splice(i,1); else arr.push(p[1]);
      var keys=Object.keys(h.taken).sort(); while(keys.length>14){delete h.taken[keys.shift()]}
      saveData(); renderMeds();
    });
  });
  $("medToday").querySelectorAll("[data-mdel]").forEach(function(b){
    b.addEventListener("click",function(){h.meds=h.meds.filter(function(m){return m.id!==b.dataset.mdel});saveData();renderMeds();toast("Medicine removed.")});
  });
}
function renderQuestions(){
  var h=H();
  $("qList").innerHTML=h.questions.length?h.questions.map(function(q,i){return '<div class="qrow"><span>'+esc(q)+'</span><button type="button" class="btn alt sm" data-qdel="'+i+'" aria-label="Remove question">Remove</button></div>'}).join(""):'<p class="muted small">No questions yet.</p>';
  $("qList").querySelectorAll("[data-qdel]").forEach(function(b){b.addEventListener("click",function(){h.questions.splice(+b.dataset.qdel,1);saveData();renderQuestions()})});
}
function renderCall(){
  var h=H(), p=(h.cPhone||"").replace(/[^0-9+]/g,"");
  $("cCall").innerHTML=p?'<a class="btn alt sm" href="tel:'+esc(p)+'">📞 Call '+esc(h.cName||"emergency contact")+'</a>':"";
}
function healthSummary(){
  if(!user) return "";
  var h=H(), parts=[], age=(data.profile&&data.profile.age)||user.age;
  parts.push("Age: "+age+" years.");
  if(h.conds.length) parts.push("Health conditions: "+h.conds.map(condName).join(", ")+".");
  if(h.allergies) parts.push("Allergies: "+h.allergies+".");
  if(h.blood) parts.push("Blood group: "+h.blood+".");
  ["bp","sugar","wt"].forEach(function(t){
    var e=h.vitals.filter(function(x){return x.type===t})[0];
    if(e){var st=statusOf(e);parts.push("Latest "+VNAME[t]+": "+describe(e)+" on "+dateStr(e.t)+(st.label?" ("+st.label+")":"")+".")}
  });
  if(h.meds.length) parts.push("Medicines: "+h.meds.map(function(m){return m.name+(m.dose?" "+m.dose:"")+" ("+m.times.join("/").toLowerCase()+(m.food?", "+m.food.toLowerCase():"")+")"}).join("; ")+".");
  if(plan) parts.push("Food plan: "+planSummary());
  return parts.join("\n");
}
function hasHealthData(){var h=H();return !!(plan||h.conds.length||h.vitals.length||h.meds.length)}
function medsHomeCard(){
  var h=H(); if(!h.meds.length) return "";
  var a=adherence();
  return '<div class="card" style="margin-top:14px"><h2>💊 Medicines today</h2><p style="margin:4px 0 8px">'+a.done+' of '+a.total+' doses taken.</p><div class="track" role="img" aria-label="'+a.done+' of '+a.total+' doses taken"><div class="fill good" style="width:'+(a.total?a.done/a.total*100:0)+'%"></div></div><button type="button" class="btn alt sm" data-go="care" style="margin-top:10px">Open my care</button></div>';
}
var careBuilt=false, wipeArmed=false;
function initCare(){
  if(!careBuilt){
    careBuilt=true;
    CONDS.forEach(function(c){
      var b=document.createElement("button");b.type="button";b.className="tchip";b.textContent=c[1];b.dataset.c=c[0];b.setAttribute("aria-pressed","false");
      b.addEventListener("click",function(){toggleCond(c[0])});$("careConds").appendChild(b);
    });
    ["Morning","Afternoon","Night"].forEach(function(t){
      var b=document.createElement("button");b.type="button";b.className="tchip";b.textContent=t;b.setAttribute("aria-pressed","false");
      b.addEventListener("click",function(){
        var i=mTimes.indexOf(t);if(i>=0)mTimes.splice(i,1);else mTimes.push(t);b.setAttribute("aria-pressed",i>=0?"false":"true");
      });
      $("mTimeChips").appendChild(b);
    });
    $("vType").addEventListener("change",function(){renderVFields();renderVitals();$("vAlert").innerHTML=""});
    $("cSave").addEventListener("click",function(){
      var h=H();h.blood=$("cBlood").value;h.allergies=$("cAllergy").value.trim().slice(0,200);h.cName=$("cName").value.trim().slice(0,60);h.cPhone=$("cPhone").value.replace(/[^0-9+ ]/g,"").slice(0,20);
      saveData();renderCall();toast("Saved on this device.");
    });
    $("vAdd").addEventListener("click",function(){
      var t=$("vType").value, a=+$("vA").value, err=$("vErr"), e={t:Date.now(),type:t,a:a};
      if(t==="bp"){
        e.b=+$("vB").value;
        if(!(a>=60&&a<=260)||!(e.b>=30&&e.b<=160)){err.textContent="Please type both numbers. Top: 60 to 260. Bottom: 30 to 160.";return}
        if(e.b>=a){err.textContent="The top number should be higher than the bottom number.";return}
      } else if(t==="sugar"){
        if(!(a>=20&&a<=600)){err.textContent="Please type a blood sugar between 20 and 600 mg/dL.";return}
        e.when=$("vW").value;
      } else if(!(a>=15&&a<=250)){err.textContent="Please type a weight between 15 and 250 kg.";return}
      err.textContent="";
      var h=H();h.vitals.unshift(e);if(h.vitals.length>200)h.vitals.length=200;saveData();
      renderVFields();renderVitals();
      var st=statusOf(e), al="";
      if(st.urgent) al='<div class="emerg">This reading needs urgent attention. Call 112 or go to the nearest hospital now, especially if you feel unwell.'+(st.low?' If you are awake and can swallow safely, have a sugary drink or glucose while help is on the way.':'')+'</div>';
      else if(st.lv==="bad") al='<div class="note">This reading is above or below the usual range. Please tell your doctor soon.</div>';
      $("vAlert").innerHTML=al; toast("Reading saved.");
    });
    $("mAdd").addEventListener("click",function(){
      var name=$("mName").value.trim(), err=$("mErr");
      if(!name){err.textContent="Please type the medicine name.";return}
      if(!mTimes.length){err.textContent="Please pick at least one time of day.";return}
      err.textContent="";
      var h=H();h.meds.push({id:"m"+Date.now().toString(36),name:name.slice(0,60),dose:$("mDose").value.trim().slice(0,40),food:$("mFood").value,times:["Morning","Afternoon","Night"].filter(function(t){return mTimes.indexOf(t)>=0})});
      saveData();$("mName").value="";$("mDose").value="";mTimes=[];
      document.querySelectorAll("#mTimeChips .tchip").forEach(function(b){b.setAttribute("aria-pressed","false")});
      renderMeds();toast("Medicine added.");
    });
    function addQ(){var v=$("qIn").value.trim();if(!v)return;var h=H();if(h.questions.length>=20){toast("You can keep up to 20 questions.");return}h.questions.push(v.slice(0,200));saveData();$("qIn").value="";renderQuestions()}
    $("qAdd").addEventListener("click",addQ);
    $("qIn").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();addQ()}});
    $("toDocBtn").addEventListener("click",function(){show("doc")});
    $("wipeBtn").addEventListener("click",function(){
      var b=this;
      if(!wipeArmed){wipeArmed=true;b.textContent="Tap again to delete everything";setTimeout(function(){wipeArmed=false;b.textContent="Delete my health data"},4000);return}
      wipeArmed=false;b.textContent="Delete my health data";
      data.health=null;saveData();initCare();syncCondChips();toast("Health data deleted from this device.");
    });
    $("readAI").addEventListener("click",function(){
      var h=H(), lines=["bp","sugar","wt"].map(function(t){var e=h.vitals.filter(function(x){return x.type===t})[0];return e?("Latest "+VNAME[t]+": "+describe(e)+(statusOf(e).label?" ("+statusOf(e).label+")":"")):""}).filter(Boolean);
      if(!lines.length){$("readOut").hidden=false;$("readOut").textContent="Save at least one reading first.";return}
      inlineAI(this,$("readOut"),"Explain these health readings in simple words: what they generally mean, two everyday food or habit tips that may help, and when to see a doctor. Do not diagnose.\n"+lines.join("\n")+(h.conds.length?"\nKnown conditions: "+h.conds.map(condName).join(", "):""));
    });
    $("visitAI").addEventListener("click",function(){
      var h=H(), btn=this;
      var prompt="Write a short note the patient can show their doctor. Use these plain-text headings: Reason for visit (leave a blank line for the patient to fill), Health background, Recent readings, Medicines, Food plan, Questions for the doctor. Use only the information below. Do not invent values. If something is missing write 'not provided'.\n\nInformation:\n"+healthSummary()+"\nQuestions: "+(h.questions.length?h.questions.join(" | "):"none yet");
      inlineAI(btn,$("visitOut"),prompt,"default",function(text){$("visitCopy").hidden=!text});
    });
    $("visitCopy").addEventListener("click",function(){
      var txt=$("visitOut").textContent;
      try{ navigator.clipboard.writeText(txt).then(function(){toast("Note copied.")},function(){toast("Could not copy. Select the text and copy it.")}) }catch(e){toast("Could not copy. Select the text and copy it.")}
    });
  }
  var h=H();
  $("cBlood").value=h.blood;$("cAllergy").value=h.allergies;$("cName").value=h.cName;$("cPhone").value=h.cPhone;
  syncCondChips();renderVFields();renderVitals();renderMeds();renderQuestions();renderCall();
  $("vAlert").innerHTML="";$("readOut").hidden=true;$("visitOut").hidden=true;$("visitCopy").hidden=true;
}

/* ---------- AI HELPER ---------- */
var sampleFn=null, aiTurns=[], aiBusy=false, aiCtl=null, aiSt={lang:"English",personal:false};
/* Calls the serverless function at /api/chat (see api/chat.js). The API key stays on the server. */
function callAI(messages,opts){
  opts=opts||{};
  var a=(data&&data.profile&&data.profile.age)||(user&&user.age)||30;
  return fetch("/api/chat",{
    method:"POST",headers:{"Content-Type":"application/json"},signal:opts.signal,
    body:JSON.stringify({messages:messages,tier:opts.modelTier||"quick",lang:aiSt.lang,ageGroup:ageGroup(a)})
  }).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){
      if(!r.ok){var err=new Error(j.error||"error");err.code=r.status===429?"rate_limited":(r.status===503?"unavailable":"error");throw err}
      return {text:j.text||""};
    });
  }).catch(function(e){
    if(e&&e.name==="AbortError"){var c=new Error("cancelled");c.code="cancelled";c.text="";throw c}
    throw e;
  });
}
(function(){
  try{
    fetch("/api/chat").then(function(r){return r.json()}).then(function(j){sampleFn=(j&&j.configured)?callAI:null;updateAIStatus()}).catch(function(){sampleFn=null;updateAIStatus()});
  }catch(e){sampleFn=null}
})();
function updateAIStatus(){$("aiStatus").textContent=sampleFn?"AI is ready.":"AI is not set up on this server yet, so you will see built-in tips."}
function showFab(){$("aiFab").classList.add("on")}
function aiErr(e){
  var c=e&&e.code;
  if(c==="rate_limited") return "Too many questions at once. Please wait a moment and try again.";
  if(c==="unavailable") return "AI is not set up on this server yet. Ask the site owner to add the API key.";
  return "Sorry, I could not answer just now. Please try again.";
}
function inlineAI(btn,out,prompt,tier,done){
  out.hidden=false;
  if(!sampleFn){out.textContent=aiErr({code:"unavailable"});return}
  btn.disabled=true;out.textContent="Thinking...";
  sampleFn([{role:"user",content:prompt}],{modelTier:tier||"quick"})
    .then(function(r){out.textContent=r.text;if(done)done(r.text)})
    .catch(function(e){out.textContent=(e&&e.text)||aiErr(e)})
    .then(function(){btn.disabled=false});
}
function addMsg(cls,text){var d=document.createElement("div");d.className="msg "+cls;d.textContent=text;$("aiMsgs").appendChild(d);$("aiMsgs").scrollTop=$("aiMsgs").scrollHeight;return d}
function offlineAnswer(q){
  var s=q.toLowerCase();
  if(/doctor|question/.test(s)) return "Questions you could ask:\n- What are my target numbers for blood pressure or sugar?\n- Which foods should I eat more or less of?\n- Do my medicines need to be taken with food?\n- When should I come back for a check-up?";
  if(/plan|meal|swap|cheap/.test(s)) return plan?("Your plan: "+planSummary()+"\nTip: open Food plan and tap Swap dish to try cheaper or lighter dishes."):"Open Food plan and make your day plan first. Then I can help you improve it.";
  if(/bp|pressure|sugar|reading/.test(s)){var e=H().vitals[0];return e?("Your latest reading: "+describe(e)+(statusOf(e).label?" ("+statusOf(e).label+")":"")+".\nRanges are general guides. Please ask your doctor what is right for you."):"No readings saved yet. Add one in My care."}
  if(/leftover|recipe/.test(s)) return "Open Reuse, tap the food you have, and press Find meal ideas.";
  return "I can help with meals, leftovers, readings and questions for your doctor. Full AI is not available in this view, so these are built-in tips. In an emergency call 112.";
}
var QUICK=[
 ["Explain my food plan",function(){return plan?"My plan: "+planSummary()+" Monthly budget: "+inr(plan.p.bud)+".":""}],
 ["Cheaper healthy swap",function(){return plan?"My plan: "+planSummary()+" Monthly budget: "+inr(plan.p.bud)+".":""}],
 ["Ideas for my leftovers",function(){return have.length?"Leftovers I have: "+have.map(nameOf).join(", ")+".":""}],
 ["Questions for my doctor",function(){return healthSummary()}],
 ["Explain my last readings",function(){return healthSummary()}],
 ["Explain like I'm 8",function(){return ""}]
];
var QTEXT={"Explain like I'm 8":"Explain in very simple words, like I am 8 years old, why fibre, protein and iron in food matter."};
(function(){
  var q=$("aiQuick");
  QUICK.forEach(function(x){
    var b=document.createElement("button");b.type="button";b.textContent=x[0];
    b.addEventListener("click",function(){sendAI(QTEXT[x[0]]||x[0],x[1]())});
    q.appendChild(b);
  });
})();
function openAI(){
  $("aiSheet").classList.add("on");$("aiFab").classList.remove("on");
  if(!$("aiMsgs").childElementCount) addMsg("a","Hi "+user.name.split(" ")[0]+"! I can explain your food plan, suggest cheaper swaps, turn leftovers into meals, or help you get ready for a doctor visit. I am not a doctor. In an emergency call 112.");
  updateAIStatus();$("aiIn").focus();
}
function closeAI(){$("aiSheet").classList.remove("on");if(user)$("aiFab").classList.add("on");if(window.speechSynthesis)window.speechSynthesis.cancel()}
function resetAI(){
  if(aiCtl){try{aiCtl.abort()}catch(e){}}
  aiTurns=[];aiBusy=false;$("aiMsgs").innerHTML="";$("aiSheet").classList.remove("on");$("aiFab").classList.remove("on");$("aiSend").textContent="Send";
}
function sendAI(text,ctx){
  text=(text||"").trim();
  if(!text||aiBusy) return;
  addMsg("u",text);
  var bubble=addMsg("a","Thinking...");
  if(!sampleFn){bubble.textContent=offlineAnswer(text);$("aiIn").value="";return}
  var extra=[]; if(ctx) extra.push(ctx);
  if(aiSt.personal){var hs=healthSummary(); if(hs) extra.push("About the person (private):\n"+hs)}
  var last=extra.length?text+"\n\nContext:\n"+extra.join("\n"):text;
  var input=aiTurns.slice(-6).concat([{role:"user",content:last}]);
  aiBusy=true;aiCtl=new AbortController();$("aiSend").textContent="Stop";$("aiIn").value="";
  sampleFn(input,{modelTier:"quick",signal:aiCtl.signal})
    .then(function(r){bubble.textContent=r.text;aiTurns.push({role:"user",content:text},{role:"assistant",content:r.text})})
    .catch(function(e){ if(e&&e.code==="cancelled"){bubble.textContent=e.text||(bubble.textContent==="Thinking..."?"Stopped.":bubble.textContent)} else bubble.textContent=(e&&e.text)||aiErr(e) })
    .then(function(){aiBusy=false;$("aiSend").textContent="Send"});
}
$("aiFab").addEventListener("click",openAI);
$("aiClose").addEventListener("click",closeAI);
$("aiSend").addEventListener("click",function(){ if(aiBusy){if(aiCtl)aiCtl.abort()} else sendAI($("aiIn").value) });
$("aiIn").addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(!aiBusy)sendAI($("aiIn").value)} });
$("aiLang").addEventListener("change",function(){aiSt.lang=this.value});
$("aiPers").addEventListener("change",function(){aiSt.personal=this.checked;toast(this.checked?"AI will use your health details.":"AI will not use your health details.")});
$("aiSpeak").addEventListener("click",function(){var m=$("aiMsgs").querySelectorAll(".msg.a");if(m.length)speak(m[m.length-1].textContent)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&$("aiSheet").classList.contains("on"))closeAI()});

/* ---------- start ---------- */
(function(){
  var s=store.get("bf_session"), users=loadUsers();
  if(s&&users[s]) enter(s); else show("auth");
})();
})();
