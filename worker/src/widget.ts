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

/** what the card shows; kept in the chat_data of the message */
export interface WidgetState {
  /** started, ends (ms); paused at (ms) when on pause */
  s: number; e: number; pz?: number;
  st: 'run' | 'ready' | 'pause' | 'strained' | 'done' | 'stop';
  /** title, recipe line, bean */
  t: string; r: string; b: string;
  /** the green-monitor style */
  p?: 1;
}

/** the state as the 1 KB string Telegram keeps: long texts are cut, never the times */
export function widgetData(w: WidgetState): string {
  const cut = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);
  return JSON.stringify({ ...w, t: cut(w.t, 40), r: cut(w.r, 60), b: cut(w.b, 60) });
}

/* The card itself. Plain JS for Telegram's sandbox (no network, no inputs), both looks in one file:
   the body gets class "p" for «Фосфор». Times are written in the viewer's own time zone. */
export const WIDGET_HTML = `<style>
body{margin:0;font:14px/1.4 -apple-system,system-ui,Roboto,sans-serif;color:var(--tg-theme-text-color,#1b211d)}
.w{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.h{display:flex;gap:12px;align-items:center}
.e{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--tg-theme-hint-color,#646e67)}
.t{font-size:30px;font-weight:300;font-variant-numeric:tabular-nums;line-height:1.15}
.s,.r,.m{font-size:13px;color:var(--tg-theme-hint-color,#646e67)}
.bar{height:6px;border-radius:9px;background:var(--tg-theme-secondary-bg-color,#e3e8e0);overflow:hidden}
.bar i{display:block;height:100%;background:var(--tg-theme-button-color,#2c6a4c)}
.row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--tg-theme-hint-color,#646e67)}
.b{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:inherit}
.p{background:#050806;color:#8be39b;font-family:ui-monospace,Menlo,Consolas,monospace;text-shadow:0 0 6px rgba(139,227,155,.45)}
.p .e,.p .s,.p .r,.p .m,.p .row{color:#64a872}
.p .t{font-weight:700;color:#c9ffd3;font-size:26px}
.p .bar{background:#163020;border-radius:0}.p .bar i{background:#8be39b}
.p button{background:#050806;color:#8be39b;border:1px dashed #2f5a38;border-radius:0;padding:8px 0;font-weight:700;text-transform:uppercase}
</style>
<div class="w">
<div class="h"><svg width="40" height="50" viewBox="0 0 48 60" aria-hidden="true"><rect x="10" y="2" width="28" height="6" rx="2" fill="currentColor"/><path d="M8 10h32v42a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z" fill="none" stroke="currentColor" stroke-width="2"/><rect id="lv" x="10" y="24" width="28" height="33" rx="4" fill="#7a4a26"/></svg>
<div><div class="e" id="e"></div><div class="t" id="t"></div><div class="s" id="s"></div></div></div>
<div class="bar"><i id="f"></i></div>
<div class="row"><span id="a"></span><span id="z"></span></div>
<div class="r" id="r"></div>
<div class="b" id="bb"><button id="bh">+1 час</button><button id="bd"></button></div>
<div class="m" id="m"></div>
</div>
<script>
var T=window.TelegramWidget,d={},$=function(i){return document.getElementById(i)};
function rd(){try{d=JSON.parse(T&&T.chatData||'{}')||{}}catch(x){d={}}document.body.className=d.p?'p':''}
function z(n){return(n<10?'0':'')+n}
function day(ms){var x=new Date(ms),n=new Date(),t=new Date(+n+864e5);return x.toDateString()==n.toDateString()?'':x.toDateString()==t.toDateString()?'завтра ':z(x.getDate())+'.'+z(x.getMonth()+1)+' '}
function hm(ms){var x=new Date(ms);return day(ms)+z(x.getHours())+':'+z(x.getMinutes())}
function dur(s,sec){return Math.floor(s/3600)+':'+z(Math.floor(s/60)%60)+(sec?':'+z(s%60):'')}
function draw(){
var now=Date.now(),st=d.st||'run',at=st=='pause'&&d.pz?d.pz:now,tot=Math.max(1,d.e-d.s),k=Math.min(1,Math.max(0,(at-d.s)/tot)),left=Math.max(0,Math.round((d.e-now)/1000));
if(st=='run'&&left<=0)st='ready';
if(st!='run'&&st!='pause')k=1;
var E={run:'НАСТАИВАЕТСЯ',ready:'ГОТОВО',pause:'НА ПАУЗЕ',strained:'ПРОЦЕЖЕНО',done:'ЗАПИСАНО',stop:'ОСТАНОВЛЕН'};
$('e').textContent=(d.t||'Колд брю').toUpperCase()+' · '+E[st];
$('t').textContent=st=='run'?dur(left,1):st=='ready'?'Пора процедить':st=='pause'?'Таймер на паузе':st=='strained'?'Процежено ✓':st=='done'?'В дневнике ✓':'Таймер сброшен';
var late=Math.round((now-d.e)/1000);
$('s').textContent=st=='run'?'осталось':st=='ready'?'настоялся '+Math.round(tot/36e5)+' ч'+(late>60?' · ждёт '+dur(late):''):'';
$('f').style.width=Math.round(k*100)+'%';
$('lv').setAttribute('y',String(57-Math.round(33*Math.max(.15,k))));$('lv').setAttribute('height',String(Math.round(33*Math.max(.15,k))));
$('lv').setAttribute('fill',k>=1?'#4a2c17':'#8b5a33');
$('a').textContent='залито в '+hm(d.s);$('z').textContent=st=='run'||st=='pause'?'готово '+hm(d.e):'';
$('r').textContent=[d.r,d.b].filter(Boolean).join(' · ');
$('bb').style.display=st=='run'||st=='ready'?'':'none';
$('bd').textContent=st=='ready'?'Процедил ✓':'Процедить сейчас';
}
function ask(c){if(!T||!T.request)return;$('m').textContent='';T.request(c).then(function(){},function(x){$('m').textContent=x&&x.code=='RATE_LIMITED'?'Слишком часто — подождите немного':'Не дошло до бота — попробуйте ещё раз'})}
$('bh').onclick=function(){ask('h')};$('bd').onclick=function(){ask('d')};
rd();draw();setInterval(draw,1000);
if(T&&T.onEvent)T.onEvent('chatDataChanged',function(){rd();draw()});
</script>`;

const api = (token: string, method: string, body: unknown) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json() as Promise<TgAnswer>).catch((e): TgAnswer => ({ ok: false, description: String(e) }));
type TgAnswer = { ok: boolean; result?: { message_id?: number }; description?: string };

/** the card as a new message; its message id, or null (Telegram refused, or the client is too old for it) */
export async function sendWidget(token: string, chat: string, w: WidgetState, link: string): Promise<number | null> {
  const r = await api(token, 'sendWidget', {
    chat_id: Number(chat), html: WIDGET_HTML, chat_data: widgetData(w), allow_queries: true,
    caption: `${w.t} настаивается — бот напишет, когда будет готов.`,
    reply_markup: { inline_keyboard: [[{ text: 'Открыть в Brewbook', url: link }]] },
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
