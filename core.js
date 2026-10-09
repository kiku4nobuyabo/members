export const VERSION='0.2.6';
export const uid=()=>crypto.randomUUID();
export const clone=x=>structuredClone(x);
export const norm=x=>String(x??'').trim();
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
export const emptyState=()=>({schemaVersion:1,meta:{clanName:'碧龍月梟',activeSeasonId:'s5'},seasons:{s5:{id:'s5',name:'PK2 / S5',start:'2026-10-10',end:''}},members:{},aliases:{},legacy:{},snapshots:{},formations:{},teamSettings:{},groupNames:[],checkDefinitions:{},issues:{},contributions:{},sources:{}});
export function assert(ok,msg){if(!ok)throw new Error(msg);}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function weekKey(date){assert(validDate(date),'日付が正しくありません');const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function membersIn(s,season){return Object.values(s.members).filter(m=>m.memberships.some(x=>x.seasonId===season));}
export function teamAt(m,season,date=today()) {return [...m.teamHistory].filter(t=>t.seasonId===season&&t.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.team||'';}
export function orderedSnapshots(s,season){return Object.values(s.snapshots).filter(x=>x.seasonId===season).sort((a,b)=>a.date.localeCompare(b.date));}
export function history(s,mid,season){return orderedSnapshots(s,season).map(x=>({snapshot:x,row:x.rows.find(r=>r.memberId===mid)}));}
export function metrics(s,mid,season){const xs=orderedSnapshots(s,season),last=xs.at(-1),cur=last?.rows.find(r=>r.memberId===mid);let prev;
 if(last){const p=new Date(weekKey(last.date)+'T00:00:00Z');p.setUTCDate(p.getUTCDate()-7);prev=xs.find(x=>weekKey(x.date)===p.toISOString().slice(0,10))?.rows.find(r=>r.memberId===mid);}
 return {current:cur,previous:prev,date:last?.date,delta:cur?.meritWeek!=null&&prev?.meritWeek!=null?cur.meritWeek-prev.meritWeek:null};}
export function matchName(s,name){const n=norm(name);return [...new Set([...Object.values(s.members).filter(m=>norm(m.name)===n).map(m=>m.id),...Object.values(s.aliases).filter(a=>norm(a.name)===n).map(a=>a.memberId)])].filter(id=>s.members[id]);}
export function parseCSV(text){text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
 else if(c==='"'){assert(!norm(field)&&!closed,'CSVの引用符が不正です');field='';quoted=true;}
 else if(c===','){row.push(field);field='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>norm(x)))rows.push(row);row=[];field='';closed=false;}
 else{assert(!closed||/\s/.test(c),'CSVの引用符の後に不正な文字があります');field+=c;}}
 assert(!quoted,'CSVの引用符が閉じていません');row.push(field);if(row.some(x=>norm(x)))rows.push(row);return rows;}
export const CSV_COLUMNS={'メンバー':'name','活躍度今週':'activityWeek','戦功今週':'meritWeek','活躍度総量':'activityTotal','戦功総量':'meritTotal','威信':'prestige','所属地方':'region','グループ':'gameGroup'};
export function parseGameCSV(text){const all=parseCSV(text);assert(all.length>1,'CSVにメンバーデータがありません');const headers=all[0].map(norm);assert(new Set(headers).size===headers.length,'CSVに重複する列名があります');
 for(const k of Object.keys(CSV_COLUMNS))assert(headers.includes(k),'必要な列がありません：'+k);
 const rows=all.slice(1).map((values,i)=>{assert(values.length===headers.length,`${i+2}行目の列数が違います`);const raw=Object.fromEntries(headers.map((h,j)=>[h,norm(values[j])]));const r={raw,line:i+2};
 for(const [col,key] of Object.entries(CSV_COLUMNS)){let v=raw[col];if(['activityWeek','meritWeek','activityTotal','meritTotal','prestige'].includes(key)){if(v==='')v=null;else{assert(/^(\d+|\d{1,3}(,\d{3})+)$/.test(v),`${i+2}行目 ${col} は0以上の整数で指定してください`);v=Number(v.replaceAll(',',''));assert(Number.isSafeInteger(v),`${i+2}行目の数値が大きすぎます`);}}r[key]=v;}
 assert(r.name,`${i+2}行目の名前が空です`);return r;});
 return {headers,rows,blankNumbers:rows.filter(r=>r.meritWeek==null||r.activityWeek==null).length};}
export function decodeCSV(buffer){for(const encoding of ['utf-8','shift_jis','utf-16le']){try{const text=new TextDecoder(encoding,{fatal:true}).decode(buffer);const parsed=parseGameCSV(text);return {...parsed,encoding,text};}catch(e){if(encoding==='utf-8'&&new TextDecoder().decode(buffer).includes('メンバー'))throw e;}}throw new Error('CSVを読み取れません。UTF-8／Shift_JISの一門集計CSVを選んでください');}
export async function fingerprint(rows){const canonical=rows.map(r=>r.raw).sort((a,b)=>a['メンバー'].localeCompare(b['メンバー'],'ja'));const buf=new TextEncoder().encode(JSON.stringify(canonical));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function previewImport(s,parsed){return parsed.rows.map(r=>{const ids=matchName(s,r.name);return {...r,memberId:ids.length===1?ids[0]:'',candidates:ids,create:false};});}
export function newMember(name,season,date,status='在籍'){const id=uid();return {id,name:norm(name),discordName:'',discordId:'',originContext:'',origin:'',joinHistory:'',note:'',role:'',leadership:'一般',group:'',teamPositions:{},checks:{},memberships:[{seasonId:season,status,since:date,note:''}],nameHistory:[{name:norm(name),date,source:'手入力'}],teamHistory:[],sourceRefs:[]};}
export function addAlias(s,mid,name,source){name=norm(name);assert(name,'名前を入力してください');const matches=matchName(s,name);assert(!matches.some(x=>x!==mid),'この名前は別のメンバーにも紐付いています。先に名簿を確認してください');
 if(!Object.values(s.aliases).some(a=>a.memberId===mid&&a.name===name)){const id=uid();s.aliases[id]={id,name,memberId:mid,source,seasonId:null};}}
export function importSnapshot(state,{seasonId,date,rows,fileName,hash,encoding,replace=false}){const s=clone(state);assert(s.seasons[seasonId],'シーズンを選んでください');assert(validDate(date),'取得日を指定してください');
 const season=s.seasons[seasonId];assert(!season.start||date>=season.start,'取得日がシーズン開始日より前です');assert(!season.end||date<=season.end,'取得日がシーズン終了日より後です');
 const existing=orderedSnapshots(s,seasonId).find(x=>weekKey(x.date)===weekKey(date));assert(!orderedSnapshots(s,seasonId).some(x=>x.hash===hash&&(x.id!==existing?.id||!replace)),'同一内容のCSVは登録済みです');assert(!existing||replace,'同じ週の登録があります。更新確認が必要です');
 const seen=new Set();const cleanRows=rows.map(r=>{let mid=r.memberId;if(r.create){assert(!matchName(s,r.name).length,'同名の登録があります。新規作成せず照合してください');const m=newMember(r.name,seasonId,date);s.members[m.id]=m;mid=m.id;}
 assert(mid&&s.members[mid],r.name+' が未紐付けです');assert(!seen.has(mid),'同一人物がCSV内に複数あります：'+r.name);seen.add(mid);
 // Explicit per-row selection may resolve an ambiguous name for this snapshot only.
 // Do not silently reassign another person's alias or learn an ambiguous alias.
 if(!matchName(s,r.name).some(id=>id!==mid))addAlias(s,mid,r.name,'CSV照合');
 if(!s.members[mid].memberships.some(x=>x.seasonId===seasonId))s.members[mid].memberships.push({seasonId,status:'在籍',since:date,note:'CSV取込で登録'});
 return Object.fromEntries(['name','activityWeek','meritWeek','activityTotal','meritTotal','prestige','region','gameGroup','raw'].map(k=>[k,r[k]]).concat([['memberId',mid]]));});
 assert(!(existing&&existing.hash===hash&&existing.date===date&&JSON.stringify(existing.rows)===JSON.stringify(cleanRows)),'同一内容・同じ紐付けで登録済みです');
 const id=existing?.id||uid();s.snapshots[id]={id,seasonId,date,week:weekKey(date),fileName,hash,encoding,rows:cleanRows,createdAt:new Date().toISOString(),versions:existing?[...(existing.versions||[]),{...existing,versions:undefined}]:[]};validateState(s);return s;}
export function editMember(state,id,patch,{seasonId,date=today(),team,formationId='',teamNote='',status}={}){const s=clone(state),m=s.members[id];assert(m,'メンバーが見つかりません');assert(validDate(date),'日付が正しくありません');
 for(const key of ['name','discordName','discordId','originContext','origin','joinHistory','note','role','leadership','group']){if(patch[key]!==undefined){const value=norm(patch[key]);assert(value.length<=20000,'入力が長すぎます');if(key==='name'&&value!==m.name){assert(value,'名前を入力してください');addAlias(s,id,value,'改名');addAlias(s,id,m.name,'旧名');m.nameHistory.push({name:value,previous:m.name,date,source:'改名'});}m[key]=value;}}
 if(patch.teamPosition!==undefined){m.teamPositions??={};m.teamPositions[seasonId]=norm(patch.teamPosition);}
 if(patch.checks){m.checks[seasonId]={...m.checks[seasonId],...patch.checks};}
 if(status){assert(s.seasons[seasonId],'シーズンがありません');const prev=m.memberships.filter(x=>x.seasonId===seasonId).at(-1);if(!prev||prev.status!==status)m.memberships.push({seasonId,status,since:date,note:'手動変更'});}
 if(team!==undefined&&teamAt(m,seasonId,date)!==team){assert(!m.teamHistory.some(t=>t.seasonId===seasonId&&t.date===date),'同じ日の隊履歴があります。隊履歴の訂正から変更してください');m.teamHistory.push({id:uid(),seasonId,date,team:norm(team),formationId,note:norm(teamNote)});}
 validateState(s);return s;}
export function linkLegacy(state,recordIds,mid,{createName,seasonId='s4',remember=false}={}){const s=clone(state);if(createName){const m=newMember(createName,seasonId,'','過去在籍');s.members[m.id]=m;mid=m.id;addAlias(s,mid,createName,'過去資料確認');}assert(s.members[mid],'人物を選んでください');
 for(const id of recordIds){const r=s.legacy[id];assert(r,'元資料がありません');r.memberId=mid;r.match='手動確認';if(remember)addAlias(s,mid,r.sourceName,'過去資料確認');const m=s.members[mid];if(r.sheet==='Sheet1'&&r.values['隊']!=null&&!m.teamHistory.some(t=>t.seasonId==='s5')){m.teamHistory.push({id:uid(),seasonId:'s5',date:'2026-10-05',team:'第'+r.values['隊']+'隊',formationId:Object.values(s.formations).find(f=>f.name==='添付Sheet1の初期編成')?.id||'',note:'原簿照合により追加。開始日未確認。'});}
 if(!m.memberships.some(x=>x.seasonId===r.seasonId))m.memberships.push({seasonId:r.seasonId,status:r.seasonId==='s5'?'在籍':'過去在籍',since:'',note:'元資料を手動照合'});}
 validateState(s);return s;}
export function validateState(s){assert(s&&s.schemaVersion===1,'対応していないデータ形式です');for(const key of ['meta','seasons','members','aliases','legacy','snapshots','formations','issues','contributions','sources'])assert(s[key]&&typeof s[key]==='object'&&!Array.isArray(s[key]),'データ構造が不正です：'+key);
 assert(!s.teamSettings||typeof s.teamSettings==='object'&&!Array.isArray(s.teamSettings),'隊設定が不正です');assert(!s.checkDefinitions||typeof s.checkDefinitions==='object'&&!Array.isArray(s.checkDefinitions),'チェック定義が不正です');assert(!s.groupNames||Array.isArray(s.groupNames),'グループ設定が不正です');
 assert(s.seasons[s.meta.activeSeasonId],'既定シーズンがありません');const keys=new Set();
 for(const [id,ss] of Object.entries(s.seasons)){assert(ss.id===id&&norm(ss.name),'シーズンが不正です');assert((!ss.start||validDate(ss.start))&&(!ss.end||validDate(ss.end))&&(!ss.start||!ss.end||ss.start<=ss.end),'シーズン期間が不正です');}
 for(const [id,m] of Object.entries(s.members)){assert(m.id===id&&norm(m.name),'人物データが不正です');for(const k of ['memberships','nameHistory','teamHistory','sourceRefs'])assert(Array.isArray(m[k]),'人物履歴が不正です');assert(m.checks&&typeof m.checks==='object','チェック項目が不正です');for(const x of m.memberships)assert(s.seasons[x.seasonId]&&(!x.since||validDate(x.since)),'所属シーズン・日付が不正です');for(const x of m.teamHistory){assert(s.seasons[x.seasonId]&&validDate(x.date),'隊履歴が不正です');const k=id+'|'+x.seasonId+'|'+x.date;assert(!keys.has(k),'同じ日の隊履歴が重複しています');keys.add(k);}}
 for(const a of Object.values(s.aliases))assert(s.members[a.memberId]&&norm(a.name),'別名の参照が不正です');
 for(const f of Object.values(s.formations))assert(s.seasons[f.seasonId]&&validDate(f.start)&&Array.isArray(f.teams),'隊編成が不正です');
 for(const c of Object.values(s.contributions))assert(s.members[c.memberId]&&s.seasons[c.seasonId]&&validDate(c.date),'貢献履歴が不正です');
 for(const r of Object.values(s.legacy))assert((!r.memberId||s.members[r.memberId])&&r.values&&s.seasons[r.seasonId],'過去実績の参照が不正です');
 const weeks=new Set();for(const x of Object.values(s.snapshots)){assert(s.seasons[x.seasonId]&&validDate(x.date)&&Array.isArray(x.rows)&&Array.isArray(x.versions),'週次データが不正です');const key=x.seasonId+'|'+weekKey(x.date);assert(!weeks.has(key),'週次データが重複しています');weeks.add(key);const ids=new Set();for(const r of x.rows){assert(s.members[r.memberId]&&!ids.has(r.memberId),'週次データの人物参照が不正です');ids.add(r.memberId);for(const k of ['activityWeek','meritWeek','activityTotal','meritTotal','prestige'])assert(r[k]===null||(Number.isSafeInteger(r[k])&&r[k]>=0),'週次数値が不正です');}}
 return s;}
export function validateBackup(b){assert(b?.format==='clan-ledger-backup'&&b.version===1&&Array.isArray(b.audit),'このアプリのバックアップを選んでください');validateState(b.state);return b;}
export function buildBackup(state,audit,revision){validateState(state);return {format:'clan-ledger-backup',version:1,exportedAt:new Date().toISOString(),revision,state:clone(state),audit:clone(audit)};}
export function diffState(old,next,path=[]){if(JSON.stringify(old)===JSON.stringify(next))return [];if(old&&next&&typeof old==='object'&&typeof next==='object'&&!Array.isArray(old)&&!Array.isArray(next)){return [...new Set([...Object.keys(old),...Object.keys(next)])].flatMap(k=>diffState(old[k],next[k],[...path,k]));}return [{path:path.join('.'),before:old??null,after:next??null}];}

export const DEFAULT_CHECKS=[{id:'discord',name:'Discord加入'},{id:'intro',name:'自己紹介'},{id:'roster',name:'部隊編成'},{id:'squad',name:'小隊加入'}];
export const DEFAULT_TEAMS=['第1隊','第2隊','第3隊','第4隊','第5隊'];
export function teamDefs(s,season){const saved=s.teamSettings?.[season];return (saved?.length?saved:DEFAULT_TEAMS.map((name,i)=>({id:'team'+(i+1),name})));}
export function teamLabel(s,season,value){return teamDefs(s,season).find((t,i)=>t.id===value||t.name===value||DEFAULT_TEAMS[i]===value)?.name||value||'未設定';}
export function teamId(s,season,value){return teamDefs(s,season).find((t,i)=>t.id===value||t.name===value||DEFAULT_TEAMS[i]===value)?.id||value;}
export function memberRank(m){return {'本部':0,'幹部':1,'一般':2}[m.leadership]??2;}
export function positionRank(m,season){return {'隊長':0,'副隊長':1,'一般':2}[m.teamPositions?.[season]]??2;}
// A selected team is a team roster: order by team post first.
// The unfiltered clan roster keeps leadership priority.
export function rosterRank(a,b,season,filteredTeam=false){return filteredTeam?(positionRank(a,season)-positionRank(b,season)||memberRank(a)-memberRank(b)):(memberRank(a)-memberRank(b));}
export function checksFor(s,season){return s.checkDefinitions?.[season]||DEFAULT_CHECKS;}
export function checkCompleted(value){return value===true||['○','〇','済','完了','はい','yes','true','1'].includes(String(value??'').trim().toLowerCase());}
