// Device-local viewing preferences only. No member data is stored here.
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
 {id:'region',label:'所属地方'},
 {id:'checks',label:'シーズン進捗'}
];
export const columnIds = MEMBER_COLUMNS.map(x=>x.id);
export const defaultColumns = mobile => mobile?['name','role','team']:['name','role','presence','team','group'];
export function normalizeColumns(xs,mobile=false){
 if(!Array.isArray(xs))return defaultColumns(mobile);
 const unique = new Set(xs.filter(x=>columnIds.includes(x)));
 unique.add('name');
 return columnIds.filter(x=>unique.has(x));
}
export function filtersForColumns(cols,filters){
 const next={...filters};
 if(!cols.includes('role'))next.roleFilter='all';
 if(!cols.includes('team'))next.teamFilter='';
 if(!cols.includes('presence'))next.presenceFilter='';
 if(!cols.includes('group'))next.groupFilter='';
 if(!cols.includes('checks')){next.checkFilter='';next.checkStatus='incomplete';}
 return next;
}
export const sortKeysForColumns=cols=>[
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
 ...(cols.includes('checks')?[['checks','シーズン進捗順']]:[])
];
