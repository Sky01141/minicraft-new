const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PUB=path.join(__dirname,'public'),DATA=process.env.DATA_DIR||path.join(__dirname,'data');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'};
const toSeed=v=>{v=String(v??'').trim();if(!v)return Math.floor(Math.random()*2147483647);if(/^-?\d+$/.test(v))return Math.abs(Number(v))%2147483647;let h=0;for(const c of v)h=Math.imul(31,h)+c.charCodeAt(0)|0;return Math.abs(h)};
const HEX=/^#[0-9a-f]{6}$/i,DEF={skin:'#e0b48c',hair:'#4a3020',shirt:'#3aa0d0',pants:'#3b4a9c',style:1};
const cleanLook=l=>{l=l||{};const o={};for(const k of['skin','hair','shirt','pants'])o[k]=HEX.test(l[k])?l[k]:DEF[k];o.style=[0,1,2].includes(l.style)?l.style:1;return o};
const isAdmin=k=>{const a=Buffer.from(String(k||'')),b=Buffer.from(process.env.ADMIN_KEY||'');return b.length>0&&a.length==b.length&&crypto.timingSafeEqual(a,b)};
// ---- ワールド(複数): 名前ごとにシード・建築を data/<名前>.json へ保存 ----
const worlds=new Map(),clean=n=>String(n||'').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g,'').slice(0,16);
try{for(const f of fs.readdirSync(DATA))if(f.endsWith('.json')){const w=JSON.parse(fs.readFileSync(path.join(DATA,f),'utf8')),n=f.slice(0,-5);worlds.set(n,{name:n,seed:w.seed,edits:new Map(w.edits),weather:'clear',players:new Set()})}}catch{}
const timers=new Map();
function save(w){clearTimeout(timers.get(w.name));timers.set(w.name,setTimeout(()=>{try{fs.mkdirSync(DATA,{recursive:true});fs.writeFileSync(path.join(DATA,w.name+'.json'),JSON.stringify({seed:w.seed,edits:[...w.edits]}))}catch(e){console.error(e.message)}},2000))}
function getWorld(name,seed){name=clean(name)||'world';let w=worlds.get(name);if(!w){w={name,seed:toSeed(seed||process.env.SEED),edits:new Map(),weather:'clear',players:new Set()};worlds.set(name,w);save(w)}return w}
const server=http.createServer((req,res)=>{
  if(req.url=='/healthz')return res.writeHead(200).end('ok');
  if(req.url=='/worlds'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify([...worlds.values()].map(w=>({name:w.name,seed:w.seed,players:w.players.size}))))}
  let p=decodeURIComponent(req.url.split('?')[0]);if(p=='/')p='/index.html';
  const f=path.normalize(path.join(PUB,p));if(!f.startsWith(PUB))return res.writeHead(403).end();
  fs.readFile(f,(e,d)=>{if(e)return res.writeHead(404).end('not found');res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d)});
});
const wss=new WebSocketServer({server,maxPayload:65536});
const send=(w,o)=>w.readyState===1&&w.send(JSON.stringify(o));
const bcast=(wd,o,ex)=>{for(const p of wd.players)if(p.ws!==ex)send(p.ws,o)};
const pub=p=>({id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,ry:p.ry,look:p.look});
let nextId=1;
wss.on('connection',ws=>{
  let me=null,wd=null;ws.alive=true;ws.on('pong',()=>ws.alive=true);
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t=='join'&&!me){
      wd=getWorld(m.world,m.seed);
      me={id:nextId++,ws,name:String(m.name||'Player').slice(0,12),x:8,y:60,z:8,ry:0,look:cleanLook(m.look),op:!process.env.ADMIN_KEY};
      send(ws,{t:'init',id:me.id,seed:wd.seed,world:wd.name,weather:wd.weather,edits:[...wd.edits].map(([k,b])=>[...k.split(',').map(Number),b]),players:[...wd.players].map(pub)});
      wd.players.add(me);bcast(wd,{t:'join',...pub(me)},ws);return}
    if(!me)return;
    if(m.t=='pos'){me.x=+m.x||0;me.y=+m.y||0;me.z=+m.z||0;me.ry=+m.ry||0;bcast(wd,{t:'pos',id:me.id,x:me.x,y:me.y,z:me.z,ry:me.ry},ws)}
    else if(m.t=='set'){const{x,y,z,b}=m;if([x,y,z,b].every(Number.isInteger)&&y>=0&&y<64&&b>=0&&b<=13&&Math.abs(x)<1e6&&Math.abs(z)<1e6){wd.edits.set(x+','+y+','+z,b);save(wd);bcast(wd,{t:'set',x,y,z,b},ws)}}
    else if(m.t=='look'){me.look=cleanLook(m.look);bcast(wd,{t:'look',id:me.id,look:me.look},ws)}
    else if(m.t=='chat'){bcast(wd,{t:'chat',name:me.name,text:String(m.text||'').slice(0,120)})}
    else if(m.t=='hit'){const o=[...wd.players].find(p=>p.id==m.id);if(o&&Math.hypot(o.x-me.x,o.y-me.y,o.z-me.z)<7)send(o.ws,{t:'dmg',n:4})}
    else if(m.t=='weather'&&['clear','rain'].includes(m.w)){wd.weather=m.w;bcast(wd,{t:'weather',w:m.w})}
    else if(m.t=='op'){me.op=isAdmin(m.key);send(ws,{t:'chat',name:'サーバー',text:me.op?'管理者権限を取得しました':'キーが違います'})}
    else if(m.t=='newseed'){if(me.op){wd.seed=toSeed(m.seed);wd.edits.clear();save(wd);bcast(wd,{t:'world',seed:wd.seed})}else send(ws,{t:'chat',name:'サーバー',text:'権限がありません(設定の管理者キーが必要)'})}
  });
  ws.on('close',()=>{if(wd&&me){wd.players.delete(me);bcast(wd,{t:'leave',id:me.id})}});
});
setInterval(()=>{for(const w of wss.clients){if(!w.alive){w.terminate();continue}w.alive=false;w.ping()}},30000);
server.listen(process.env.PORT||3000,()=>console.log('listening'));
