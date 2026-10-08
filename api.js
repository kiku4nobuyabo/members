import PUBLIC_CONFIG from './config.js';
const AUTH_KEY='clan-ledger-session-v2',OPERATOR_KEY='clan-ledger-operator';
const messages={
 INVALID_PASSPHRASE:'合言葉が違います。入力を確認してください。',
 INVALID_OPERATOR:'操作者名を1～80文字で入力してください。',
 PASSPHRASE_NOT_CONFIGURED:'合言葉が未設定です。セットアップ担当者が02-set-passphrase.sqlを実行してください。',
 LOGIN_RATE_LIMIT:'ログイン試行が集中しています。1分ほど待ってからもう一度お試しください。',
 OPERATOR_CHANGED:'操作者名が変更されています。上部の操作者名から改めて設定して、保存し直してください。'
};
export class SharedStore {
 constructor(config=PUBLIC_CONFIG){
  this.config={};this.auth=null;this.configError='';
  // v0.1.0のAuthトークンと端末別接続設定を引き継がない。
  sessionStorage.removeItem('clan-ledger-auth-v1');localStorage.removeItem('clan-ledger-connection-v1');
  try{if(config.url||config.key)this.configure(config.url,config.key);this.auth=JSON.parse(sessionStorage.getItem(AUTH_KEY)||'null');}catch(e){this.configError=e.message;this.clearAuth();}
  if(this.auth&&(this.auth.url!==this.config.url||!this.hasSession()))this.clearAuth();
  if(this.auth)sessionStorage.setItem(OPERATOR_KEY,this.auth.operator);else sessionStorage.removeItem(OPERATOR_KEY);
 }
 configure(url,key){url=String(url||'').trim().replace(/\/$/,'');key=String(key||'').trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('config.jsのProject URLを確認してください（https://….supabase.co）');
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new Error('config.jsにはsb_publishable_で始まる公開用キーを設定してください。秘密キーは使用できません。');
  if(this.auth&&this.config.url!==url)this.clearAuth();this.config={url,key};this.configError='';
 }
 hasSession(){return !!(this.auth&&/^[0-9a-f]{64}$/.test(this.auth.token)&&Date.parse(this.auth.expiresAt)>Date.now());}
 saveAuth(auth){this.auth={url:this.config.url,token:auth.token,expiresAt:auth.expiresAt,operator:auth.operator};if(!this.hasSession())throw new Error('利用セッションの応答が不正です');sessionStorage.setItem(AUTH_KEY,JSON.stringify(this.auth));sessionStorage.setItem(OPERATOR_KEY,this.auth.operator);}
 clearAuth(){this.auth=null;sessionStorage.removeItem(AUTH_KEY);}
 sessionError(){this.clearAuth();return Object.assign(new Error('利用セッションの期限が切れたか、合言葉が変更されました。上部の「再ログイン」から接続し直してください。未保存の入力は画面に残っています。'),{authExpired:true});}
 async login(passphrase,operator){operator=String(operator||'').trim();if(!operator||operator.length>80)throw new Error(messages.INVALID_OPERATOR);if(!passphrase)throw new Error('合言葉を入力してください');
  const res=await this.request('clan_session_open',{p_passphrase:passphrase,p_operator:operator});
  if(res?.ok!==true)throw new Error(messages[res?.error]||'ログインできませんでした');this.saveAuth(res);return res;
 }
 async changeOperator(name){const res=await this.rpc('operator',{operator:String(name||'').trim()});this.saveAuth({...this.auth,operator:res.operator});return res.operator;}
 async logout(){let failed=false;try{if(this.hasSession())await this.rpc('logout');}catch(e){failed=!e.authExpired;}finally{this.clearAuth();sessionStorage.removeItem(OPERATOR_KEY);}return {serverRevoked:!failed};}
 async request(name,body){if(!this.config.url||!this.config.key)throw new Error(this.configError||'公開前にconfig.jsの接続先を設定してください（README参照）');
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),30000);let r;
  try{r=await fetch(this.config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:this.config.key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});}
  catch(e){throw new Error(e.name==='AbortError'?'接続がタイムアウトしました。保存結果が不明な場合は「再読込」で確認してください。':'接続できません。通信状態を確認してください。保存完了にはなっていません。');}finally{clearTimeout(timeout);}
  const data=await r.json().catch(()=>null);if(!r.ok){const message=data?.message||('通信エラー '+r.status);
   if(message.includes('REVISION_CONFLICT'))throw Object.assign(new Error('他の運営者が先に保存しました。入力内容を控えてから再読込し、最新データへ反映してください。今回の変更は保存していません。'),{conflict:true});
   if(/SESSION_REQUIRED|SESSION_EXPIRED/.test(message))throw this.sessionError();
   for(const [code,text] of Object.entries(messages))if(message.includes(code))throw new Error(text);
   if(data?.code==='PGRST202')throw new Error('認証用SQLが見つかりません。移行SQL（または新規用01）を実行したProjectか確認してください。');
   throw new Error(message);
  }return data;
 }
 async rpc(action,args={}){if(!this.hasSession())throw this.sessionError();return this.request('clan_session_call',{p_token:this.auth.token,p_action:action,p_args:args});}
 async load(){return this.rpc('read');}
 async head(){return this.rpc('revision');}
 async save(next,revision,operator,kind,summary,audit=[],requestId=crypto.randomUUID()){return this.rpc('commit',{p_state:next,p_revision:revision,p_operator:operator,p_kind:kind,p_summary:summary,p_imported_audit:audit,p_request_id:requestId});}
 async audit(limit=200,before=null){return this.rpc('audit',{p_limit:limit,p_before:before});}
 async backup(){return this.rpc('backup');}
}
