/**
 * The cold brew card in the chat with the bot (Telegram widgets, Bot API 10.4).
 *
 * Sent when a cold brew starts (if the person keeps «Карточка в чате с ботом» on). The card counts down by itself
 * from the times in its state, so it needs no network; its two buttons come back here as widget queries:
 * «+1 час» moves the end and the reminder, «Процедить» ends it. The bot rewrites the state when something changes
 * (pause, reset, the brew written down, the time up), and the card redraws.
 *
 * Telegram's limits: HTML up to 32 KB and 4 KB compressed, state up to 1 KB, only in the private chat with the bot.
 */
import { say, type Lang } from './lang.ts';

/** what the card shows; kept in the chat_data of the message */
export interface WidgetState {
  /** started, ends (ms); paused at (ms) when on pause */
  s: number; e: number; pz?: number;
  st: 'run' | 'ready' | 'pause' | 'strained' | 'done' | 'stop';
  /** title, recipe line, bean */
  t: string; r: string; b: string;
  /** the look chosen in the app: the green monitor, or a light/dark theme (neither — as the Telegram client) */
  p?: 1; th?: 'l' | 'd';
}

/** the app's look → the card's (see WidgetState) */
export type CardLook = 'auto' | 'light' | 'dark' | 'phosphor';
export function lookFields(look: CardLook): Pick<WidgetState, 'p' | 'th'> {
  return look === 'phosphor' ? { p: 1 } : look === 'light' ? { th: 'l' } : look === 'dark' ? { th: 'd' } : {};
}
export function withLook(w: WidgetState, look: CardLook): WidgetState {
  const { p: _p, th: _t, ...rest } = w;
  void _p; void _t;
  return { ...rest, ...lookFields(look) };
}

/** the state as the 1 KB string Telegram keeps: long texts are cut, never the times */
export function widgetData(w: WidgetState): string {
  const cut = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);
  return JSON.stringify({ ...w, t: cut(w.t, 40), r: cut(w.r, 60), b: cut(w.b, 60) });
}

/* The card itself. Plain JS for Telegram's sandbox (no network, no inputs). Two views in one file:
   the plain one (light, dark, or Telegram's own colors) and «Фосфор», drawn only in characters — block digits,
   a [====>...] bar, dot leaders, [ buttons ] and a jar of symbols that fills up and ripples.
   Times are written in the viewer's own time zone. */
export const WIDGET_HTML = `<style>
body{margin:0;--bg:transparent;--fg:var(--tg-theme-text-color,#1b211d);--hint:var(--tg-theme-hint-color,#646e67);--acc:var(--tg-theme-button-color,#2c6a4c);--soft:var(--tg-theme-secondary-bg-color,#e3e8e0);background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,system-ui,Roboto,sans-serif}
.l{--bg:#fff;--fg:#1b211d;--hint:#646e67;--acc:#2c6a4c;--soft:#e8eee6}
.d{--bg:#1a201c;--fg:#e6ebe7;--hint:#8a958d;--acc:#68c294;--soft:#2a322d}
.w{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.h{display:flex;gap:12px;align-items:center}
.e{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--hint)}
.t{font-size:30px;font-weight:300;font-variant-numeric:tabular-nums;line-height:1.15}
.s,.r,.m{font-size:13px;color:var(--hint)}
.bar{height:6px;border-radius:9px;background:var(--soft);overflow:hidden}
.bar i{display:block;height:100%;background:var(--acc)}
.row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--hint)}
.b{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:inherit}
.l button,.d button{border:0;border-radius:10px;padding:9px 4px;background:var(--soft);color:var(--acc);font-weight:600}
#q{display:none;margin:0;padding:12px 12px 10px;background:#050806;color:#8be39b;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;text-shadow:0 0 6px rgba(139,227,155,.45)}
.p #n{display:none}.p #q{display:block}.p{background:#050806}
#q .k{color:#64a872}#q .x{color:#c9ffd3;font-weight:700}#q .o{color:#2f5a38}
#q .ln{display:flex;white-space:pre}#q .f{flex:1;overflow:hidden;white-space:nowrap}
#q pre{margin:0;font:inherit;white-space:pre}#q #qt{font-size:14px;line-height:1;letter-spacing:-.04em}
#q .two{display:flex;gap:14px;align-items:center;margin:4px 0}
#q i{font-style:normal;text-shadow:0 0 6px rgba(255,170,80,.5)}#q .c1{color:#c97a2e}#q .c2{color:#e39a47}#q .c3{color:#ffbf6b}#q .c4{color:#fff0c8}
#q button{background:none;border:0;padding:6px 0;color:#8be39b;font:700 12px ui-monospace,Menlo,monospace;text-shadow:inherit;flex:1}
#q .bq{display:flex;gap:8px;margin-top:6px}
</style>
<div class="w" id="n">
<div class="h"><svg width="40" height="50" viewBox="0 0 48 60" aria-hidden="true"><rect x="10" y="2" width="28" height="6" rx="2" fill="currentColor"/><path d="M8 10h32v42a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z" fill="none" stroke="currentColor" stroke-width="2"/><rect id="lv" x="10" y="57" width="28" height="0" rx="4" fill="#8b5a33"/></svg>
<div><div class="e" id="e"></div><div class="t" id="t"></div><div class="s" id="s"></div></div></div>
<div class="bar"><i id="f"></i></div>
<div class="row"><span id="a"></span><span id="z"></span></div>
<div class="r" id="r"></div>
<div class="b" id="bb"><button id="bh">+1 час</button><button id="bd"></button></div>
<div class="m" id="m"></div>
</div>
<div id="q">
<div class="ln k"><span id="qp"></span><span id="qc">_</span></div>
<div class="ln k"><span id="qe"></span><span class="f">=================================================</span></div>
<div class="two"><pre id="qj" class="x"></pre><div><pre id="qt" class="x"></pre><div id="qs" class="k"></div></div></div>
<div class="ln">[<span id="qb"></span><span id="qn"></span></div>
<div id="ql"></div>
<div class="bq" id="qq"><button id="qh">[ +1 ЧАС ]</button><button id="qd"></button></div>
<div class="k" id="qm"></div>
</div>
<script>
var T=window.TelegramWidget,d={},lvl=0,tk=0,N=String.fromCharCode(10),$=function(i){return document.getElementById(i)};
var G={0:["###","# #","# #","# #","###"],1:[" # ","## "," # "," # ","###"],2:["###","  #","###","#  ","###"],3:["###","  #","###","  #","###"],4:["# #","# #","###","  #","  #"],5:["###","#  ","###","  #","###"],6:["###","#  ","###","# #","###"],7:["###","  #","  #","  #","  #"],8:["###","# #","###","# #","###"],9:["###","# #","###","  #","###"],":":["   "," # ","   "," # ","   "]};
function rd(){try{d=JSON.parse(T&&T.chatData||"{}")||{}}catch(x){d={}}document.body.className=d.p?"p":d.th||""}
function z(n){return(n<10?"0":"")+n}
function day(ms){var x=new Date(ms),n=new Date(),t=new Date(+n+864e5);return x.toDateString()==n.toDateString()?"":x.toDateString()==t.toDateString()?"завтра ":z(x.getDate())+"."+z(x.getMonth()+1)+" "}
function hm(ms){var x=new Date(ms);return day(ms)+z(x.getHours())+":"+z(x.getMinutes())}
function dur(s,sec){return Math.floor(s/3600)+":"+z(Math.floor(s/60)%60)+(sec?":"+z(s%60):"")}
function big(t){var o=[];for(var r=0;r<5;r++){var l=[];for(var i=0;i<t.length;i++)l.push((G[t[i]]||["   ","   ","   ","   ","   "])[r]);o.push(l.join(" "))}return o.join(N)}
function rep(c,n){return new Array(n+1).join(c)}
function jar(v,t){var H=6,n=Math.round(v*H),o=[" .-------."," |=======|"];
for(var i=0;i<H;i++){var b=H-1-i,row;
if(b>=n)row=rep(" ",7);
else if(b==n-1)row='<i class="c3">'+(t%2?"~-~-~-~":"-~-~-~-")+"</i>";
else{var c=b<n*.34?"#":b<n*.67?"%":":",r=rep(c,7);if((t+b*3)%5==0){var k=(t*3+b)%7;r=r.slice(0,k)+'<i class="c4">o</i>'+r.slice(k+1)}row='<i class="'+(c=="#"?"c1":c=="%"?"c2":"c3")+'">'+r+"</i>"}
o.push(" |"+row+"|")}o.push(" '-------'");return o.join(N)}
function lead(k,v){return '<div class="ln"><span class="k">'+k+' </span><span class="f o">'+rep(".",60)+'</span><span> '+v+'</span></div>'}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})}
function draw(){
var now=Date.now(),st=d.st||"run",at=st=="pause"&&d.pz?d.pz:now,tot=Math.max(1,d.e-d.s),k=Math.min(1,Math.max(0,(at-d.s)/tot)),left=Math.max(0,Math.round((d.e-now)/1000));
if(st=="run"&&left<=0)st="ready";
if(st!="run"&&st!="pause")k=1;
lvl+=(Math.max(.15,k)-lvl)*.3;if(Math.abs(Math.max(.15,k)-lvl)<.01)lvl=Math.max(.15,k);
var E={run:"НАСТАИВАЕТСЯ",ready:"ГОТОВО",pause:"НА ПАУЗЕ",strained:"ПРОЦЕЖЕНО",done:"ЗАПИСАНО",stop:"ОСТАНОВЛЕН"},nm=(d.t||"Колд брю").toUpperCase();
var big1=st=="run"?dur(left,1):st=="ready"?"Пора процедить":st=="pause"?"Таймер на паузе":st=="strained"?"Процежено ✓":st=="done"?"В дневнике ✓":"Таймер сброшен";
var late=Math.round((now-d.e)/1000),sub=st=="run"?"осталось":st=="ready"?"настоялся "+Math.round(tot/36e5)+" ч"+(late>60?" · ждёт "+dur(late):""):"";
var live=st=="run"||st=="ready",btn=st=="ready"?"Процедил ✓":"Процедить сейчас";
if(!d.p){
$("e").textContent=nm+" · "+E[st];$("t").textContent=big1;$("s").textContent=sub;
$("f").style.width=Math.round(k*100)+"%";
var h=Math.round(33*lvl);$("lv").setAttribute("y",String(57-h));$("lv").setAttribute("height",String(h));$("lv").setAttribute("fill",k>=1?"#4a2c17":"#8b5a33");
$("a").textContent="залито в "+hm(d.s);$("z").textContent=st=="run"||st=="pause"?"готово "+hm(d.e):"";
$("r").textContent=[d.r,d.b].filter(Boolean).join(" · ");
$("bb").style.display=live?"":"none";$("bd").textContent=btn;
}else{
$("qp").textContent="C:"+String.fromCharCode(92)+"BREWBOOK> COLDBREW.EXE";$("qc").style.visibility=(tk>>1)%2?"hidden":"";
$("qe").textContent="== "+nm+" - "+E[st]+" ";
$("qj").innerHTML=jar(lvl,tk>>1);
$("qt").textContent=st=="run"?big(dur(left)):big1.toUpperCase().replace(" ✓"," [OK]");
$("qs").textContent=sub.toUpperCase().replace(" · "," - ");
var W=26,c=Math.round(k*W);$("qb").innerHTML=(c>=W?rep("=",W):c?rep("=",c-1)+"&gt;":"")+'<span class="o">'+rep(".",W-c)+"</span>";$("qn").textContent="] "+Math.round(k*100)+"%";
$("ql").innerHTML=lead("ЗАЛИТО",esc(hm(d.s)))+(st=="run"||st=="pause"?lead("ГОТОВО",esc(hm(d.e).toUpperCase())):"")+(d.r?lead("РЕЦЕПТ",esc(d.r.replace("→","->"))):"")+(d.b?lead("ЗЕРНО",esc(d.b.toUpperCase())):"");
$("qq").style.display=live?"":"none";$("qd").textContent=st=="ready"?"[ ПРОЦЕДИЛ ]":"[ ПРОЦЕДИТЬ ]";
}}
function ask(c){if(!T||!T.request)return;$("m").textContent=$("qm").textContent="";T.request(c).then(function(){},function(x){$("m").textContent=$("qm").textContent=x&&x.code=="RATE_LIMITED"?"Слишком часто — подождите немного":"Не дошло до бота — попробуйте ещё раз"})}
$("bh").onclick=$("qh").onclick=function(){ask("h")};$("bd").onclick=$("qd").onclick=function(){ask("d")};
rd();draw();
setInterval(function(){tk++;draw()},250);
if(T&&T.onEvent)T.onEvent("chatDataChanged",function(){rd();draw()});
</script>`;

const api = (token: string, method: string, body: unknown) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json() as Promise<TgAnswer>).catch((e): TgAnswer => ({ ok: false, description: String(e) }));
type TgAnswer = { ok: boolean; result?: { message_id?: number }; description?: string };

/** The same card in English: its words swapped in, nothing else changes */
const EN_WORDS: [string, string][] = [
  ['[ +1 ЧАС ]', '[ +1 HOUR ]'], ['+1 час', '+1 hour'], ['"завтра "', '"tomorrow "'],
  ['НАСТАИВАЕТСЯ', 'STEEPING'], ['"ГОТОВО"', '"READY"'], ['НА ПАУЗЕ', 'PAUSED'], ['ПРОЦЕЖЕНО', 'STRAINED'], ['ЗАПИСАНО', 'SAVED'], ['ОСТАНОВЛЕН', 'STOPPED'],
  ['"Колд брю"', '"Cold brew"'], ['"Пора процедить"', '"Time to strain"'], ['"Таймер на паузе"', '"Timer paused"'], ['"Процежено ✓"', '"Strained ✓"'],
  ['"В дневнике ✓"', '"In the journal ✓"'], ['"Таймер сброшен"', '"Timer reset"'], ['"осталось"', '"left"'], ['"настоялся "', '"steeped "'], ['" ч"', '" h"'],
  ['" · ждёт "', '" · waiting "'], ['"Процедил ✓"', '"Strained ✓"'], ['"Процедить сейчас"', '"Strain now"'], ['"залито в "', '"poured at "'], ['"готово "', '"ready "'],
  ['"ЗАЛИТО"', '"POURED"'], ['"РЕЦЕПТ"', '"RECIPE"'], ['"ЗЕРНО"', '"BEANS"'], ['"[ ПРОЦЕДИЛ ]"', '"[ STRAINED ]"'], ['"[ ПРОЦЕДИТЬ ]"', '"[ STRAIN ]"'],
  ['"Слишком часто — подождите немного"', '"Too often — wait a little"'], ['"Не дошло до бота — попробуйте ещё раз"', '"Didn\'t reach the bot — try again"'],
];
export const WIDGET_HTML_EN = EN_WORDS.reduce((h, [ru, en]) => h.split(ru).join(en), WIDGET_HTML);

/** the card as a new message; its message id, or null (Telegram refused, or the client is too old for it) */
export async function sendWidget(token: string, chat: string, w: WidgetState, link: string, lang: Lang = 'ru'): Promise<number | null> {
  const r = await api(token, 'sendWidget', {
    chat_id: Number(chat), html: lang === 'en' ? WIDGET_HTML_EN : WIDGET_HTML, chat_data: widgetData(w), allow_queries: true,
    caption: say(lang, `${w.t} настаивается — бот напишет, когда будет готов.`, `${w.t} is steeping — the bot will write when it's ready.`),
    reply_markup: { inline_keyboard: [[{ text: say(lang, 'Открыть в Brewbook', 'Open in Brewbook'), url: link }]] },
  });
  if (!r.ok) console.log('sendWidget failed:', r.description);
  return r.ok ? r.result?.message_id ?? null : null;
}

export async function editWidget(token: string, chat: string, msg: number, w: WidgetState) {
  const r = await api(token, 'editMessageWidgetData', { chat_id: Number(chat), message_id: msg, chat_data: widgetData(w) });
  if (!r.ok) console.log('editMessageWidgetData failed:', r.description);
  return r.ok;
}

export const answerWidget = (token: string, id: string) => api(token, 'answerWidgetQuery', { widget_query_id: id });

export const deleteMessage = (token: string, chat: string, msg: number) => api(token, 'deleteMessage', { chat_id: Number(chat), message_id: msg });
