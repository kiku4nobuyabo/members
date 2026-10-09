// Group import: first worksheet, two header columns, exact Discord ID matching.
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const local=(node,name)=>[...node.getElementsByTagNameNS(ns,name)];
// Excel stores optional readings as <rPh><t>...</t></rPh> in shared strings.
// Only direct <t> and rich-text <r><t> runs contain the user's cell value.
// Never treat phonetic markup as part of a group name or Discord ID.
export function readVisibleExcelText(node){
 return [...node.children].flatMap(child=>{
  if(child.namespaceURI!==ns)return [];
  if(child.localName==='t')return [child.textContent||''];
  if(child.localName==='r')return local(child,'t').map(t=>t.textContent||'');
  return []; // skip rPh (furigana), phoneticPr and formatting metadata
 }).join('');
}
function xml(src){const doc=new DOMParser().parseFromString(src,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('ExcelのXMLが読み取れません');return doc;}
function colIndex(ref){let n=0;for(const ch of (ref.match(/^[A-Z]+/i)||[''])[0].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1;}
export async function parseGroupWorkbook(buffer,JSZip){if(!JSZip)throw Error('Excel読込ライブラリがありません');const zip=await JSZip.loadAsync(buffer);const get=async p=>{const f=zip.file(p);if(!f)throw Error('Excelの必要なファイルがありません：'+p);return xml(await f.async('string'));};
 const wb=await get('xl/workbook.xml'),rels=await get('xl/_rels/workbook.xml.rels');const sheet=local(wb,'sheet')[0];if(!sheet)throw Error('Excelにシートがありません');const relationshipId=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const rel=[...rels.getElementsByTagName('*')].find(x=>x.localName==='Relationship'&&x.getAttribute('Id')===relationshipId);if(!rel)throw Error('シートが見つかりません');const target=rel.getAttribute('Target');const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');if(path.includes('..'))throw Error('不正なシート参照です');const doc=await get(path);let strings=[];if(zip.file('xl/sharedStrings.xml')){const shared=await get('xl/sharedStrings.xml');strings=local(shared,'si').map(readVisibleExcelText);}
 const rows=local(doc,'sheetData').flatMap(x=>local(x,'row')).map(r=>{const cells=[];for(const c of local(r,'c')){const i=colIndex(c.getAttribute('r')||'');if(i<0||i>150)continue;const t=c.getAttribute('t');let v=t==='inlineStr'?(local(c,'is')[0]?readVisibleExcelText(local(c,'is')[0]):''):local(c,'v')[0]?.textContent||'';if(t==='s')v=strings[Number(v)]||'';cells[i]=v;if(!r.unsafeColumns)r.unsafeColumns=[];if((t===null||t==='n')&&/^\d{15,}$/.test(v))r.unsafeColumns.push(i);}return {row:Number(r.getAttribute('r')),cells,unsafeColumns:r.unsafeColumns||[]};});return rows;}
// One Discord user may own several game accounts; update each account independently.
// Repeated Excel rows with the same group are harmless and processed once.
// Conflicting group assignments for the same Discord ID are never applied.
export function previewGroupImport(state,rows){
 const header=rows.find(r=>r.cells.some(x=>String(x||'').trim()));
 if(!header)throw Error('Excelにデータがありません');
 const norm=x=>String(x??'').trim().replace(/\s+/g,'').toLowerCase();
 const ix=header.cells.findIndex(x=>['discordid','discordユーザーid'].includes(norm(x)));
 const gx=header.cells.findIndex(x=>['グループ','グループ名'].includes(norm(x)));
 if(ix<0||gx<0||ix===gx)throw Error('見出しに「Discord ID」「グループ」の2列が必要です');
 const ids=new Map();
 for(const m of Object.values(state.members)){
  const id=String(m.discordId||'').trim();if(!id)continue;
  if(!ids.has(id))ids.set(id,[]);
  ids.get(id).push(m);
 }
 const inputs=rows.filter(r=>r.row>header.row).map(r=>({
  row:r.row,id:String(r.cells[ix]??'').trim(),group:String(r.cells[gx]??'').trim(),unsafe:r.unsafeColumns?.includes(ix)??false
 })).filter(r=>r.id||r.group);
 const groupChoices=new Map();
 for(const r of inputs){if(!r.id||!r.group)continue;
  if(!groupChoices.has(r.id))groupChoices.set(r.id,new Set());
  groupChoices.get(r.id).add(r.group);
 }
 const seen=new Set(),preview=[];
 const skip=(r,reason)=>({row:r.row,id:r.id,group:r.group,memberId:'',name:'',before:'',reason,status:'skip'});
 for(const r of inputs){
  if(!r.id){preview.push(skip(r,'Discord IDが空欄'));continue;}
  if(!r.group){preview.push(skip(r,'グループが空欄'));continue;}
  if(r.unsafe){preview.push(skip(r,'Discord IDが数値形式です。Excelで文字列にして再保存してください'));continue;}
  if(groupChoices.get(r.id)?.size>1){preview.push(skip(r,'Excel内で同じDiscord IDに異なるグループが指定されています'));continue;}
  if(seen.has(r.id)){preview.push(skip(r,'Excel内の同じ指定は先の行に統合済み'));continue;}
  seen.add(r.id);
  const matches=ids.get(r.id)||[];
  if(!matches.length){preview.push(skip(r,'Discord IDが一致しません'));continue;}
  for(const member of matches){const before=member.group||'';
   preview.push({row:r.row,id:r.id,group:r.group,memberId:member.id,name:member.name,before,
    reason:'',status:before===r.group?'same':'update'});
  }
 }
 return preview;
}
export function applyGroupImport(state,preview){
 const next=structuredClone(state),updated=new Set();
 for(const r of preview){
  if(r.status!=='update')continue;
  if(updated.has(r.memberId))throw Error('同じアカウントが複数回更新対象になっています。Excelを読み直してください');
  const m=next.members[r.memberId];
  if(!m||String(m.discordId||'').trim()!==r.id)throw Error('Discord IDが変更されました。読み直してください');
  m.group=r.group;updated.add(r.memberId);
 }
 // Once the corrected Excel is reimported, remove orphaned names that were
 // previously stored with phonetic readings. Keep all groups still assigned
 // to any member, including accounts absent from this spreadsheet.
 next.groupNames=[...new Set(Object.values(next.members).map(m=>m.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 return {next,count:updated.size};
}
