// Device-local viewing preferences only. Shared DB records are never stored here.
export const MEMBER_COLUMNS = [
 {id:'name',label:'ゲーム内名前 / Discord'},
 {id:'role',label:'一門役職'},
 {id:'presence',label:'在籍状態'},
 {id:'team',label:'現在の隊 / 隊役職'},
 {id:'group',label:'グループ'},
 {id:'meritWeek',label:'今週戦功'},
 {id:'meritTotal',label:'総戦功'},
 {id:'meritPrevious',label:'前週戦功'},
 {id:'delta',label:'前週差'},
 {id:'activityWeek',label:'今週活躍度'},
 {id:'region',label:'所属地方'}
];
export const columnIds = MEMBER_COLUMNS.map(x=>x.id);
export const checkColumnId = id => 'check:'+id;
export const columnCheckId = col => col.startsWith('check:')?col.slice(6):null;
export const rosterColumns = defs => [...MEMBER_COLUMNS,...defs.map(d=>({id:checkColumnId(d.id),label:d.name,isCheck:true}))];
export const defaultColumns = mobile => mobile?['name','role','team']:['name','role','presence','team','group'];
export function normalizeColumns(xs,mobile=false,defs=[]){
 if(!Array.isArray(xs))return defaultColumns(mobile);
 const allowed=rosterColumns(defs);
 const unique=new Set(xs.filter(x=>allowed.some(col=>col.id===x)));
 // v0.3.3 used one summary column for all checks; migrate it to the separate real columns.
 if(xs.includes('checks'))defs.forEach(d=>unique.add(checkColumnId(d.id)));
 unique.add('name');
 return allowed.filter(c=>unique.has(c.id)).map(c=>c.id);
}
export function filtersForColumns(cols,filters){
 const next={...filters};
 if(!cols.includes('role'))next.roleFilter='all';
 if(!cols.includes('team'))next.teamFilter='';
 if(!cols.includes('presence'))next.presenceFilter='';
 if(!cols.includes('group'))next.groupFilter='';
 next.checkFilters=Object.fromEntries(Object.entries(filters.checkFilters||{}).filter(([id,value])=>cols.includes(checkColumnId(id))&&value&&value!=='all'));
 return next;
}
export const sortKeysForColumns=(cols,defs=[])=>[
 ['name','名前順'],
 ...(cols.includes('role')?[['rankName','役職順・名前順']]:[]),
 ...(cols.includes('team')?[['team','隊名順']]:[]),
 ...(cols.includes('group')?[['group','グループ名順']]:[]),
 ...(cols.includes('presence')?[['presence','在籍状態順']]:[]),
 ...(cols.includes('meritWeek')?[['meritWeek','今週戦功順']]:[]),
 ...(cols.includes('meritTotal')?[['meritTotal','総戦功順']]:[]),
 ...(cols.includes('meritPrevious')?[['meritPrevious','前週戦功順']]:[]),
 ...(cols.includes('delta')?[['delta','前週差順']]:[]),
 ...(cols.includes('activityWeek')?[['activityWeek','今週活躍度順']]:[]),
 ...(cols.includes('region')?[['region','所属地方順']]:[]),
 ...defs.filter(d=>cols.includes(checkColumnId(d.id))).map(d=>[checkColumnId(d.id),d.name+'順'])
];
export function checkFilterMatches(value,status,completed){
 if(!status||status==='all')return true;
 if(status==='complete')return completed;
 if(status==='excluded')return value==='対象外';
 if(status==='none')return value===undefined||value===null||value==='';
 if(status==='incomplete')return !completed&&value!=='対象外';
 return true;
}
