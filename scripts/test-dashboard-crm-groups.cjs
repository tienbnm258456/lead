const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports;}
const display=load('src/lib/crm-status-display.ts');const groups=load('src/lib/dashboard-crm-groups.ts',{'@/lib/crm-status-display':display});
test('45 partner statuses aggregate into exactly nine groups without losing orders',()=>{
 const rows=Object.keys(display.CRM_STATUS_MAPPING).map(crm_status=>({crm_status,_count:{id:2}}));const result=groups.groupDashboardCrmStatuses(rows);
 assert.equal(result.length,9);assert.equal(result.reduce((sum,r)=>sum+r.value,0),90);
 assert.equal(result.find(g=>g.key==='new').value,8);assert.equal(result.find(g=>g.key==='completed').value,8);assert.equal(result.find(g=>g.key==='delivery').value,18);
 assert.equal(groups.dashboardCrmGroup('otkaz-emu-predvaritelno').key,'delivery');assert.equal(groups.dashboardCrmGroup('complete').key,'completed');
});
test('missing and future CRM codes are separate buckets, not omitted or mixed with sync outcomes',()=>{
 const result=groups.groupDashboardCrmStatuses([{crm_status:null,_count:{id:3}},{crm_status:'',_count:{id:1}},{crm_status:'future-code',_count:{id:2}},{crm_status:'SUCCESS',_count:{id:1}}]);
 assert.equal(result.find(g=>g.key==='missing').value,4);assert.equal(result.find(g=>g.key==='unknown').value,3);assert.equal(result.reduce((s,g)=>s+g.value,0),7);
 assert.equal(groups.groupDashboardCrmStatuses([]).length,9);
});
test('dashboard queries and recent orders remain scoped to user group while using CRM statuses',async()=>{
 let actor={id:1,role:'USER',group_id:7};const queries=[];
 const prisma={order:{count:async({where})=>{queries.push(where);return 6;},aggregate:async()=>({_sum:{total_price:0}}),groupBy:async args=>{queries.push(args.where);return args.by[0]==='crm_status'?[{crm_status:'perezvon-1',_count:{id:2}},{crm_status:'payoff',_count:{id:3}},{crm_status:null,_count:{id:1}}]:[];},findMany:async({where})=>{queries.push(where);return [{id:1,external_id:'X',customer_name:'Test',customer_phone:'0',total_price:10,crm_status:'payoff',sync_status:'FAILED',created_at:new Date()}];}},product:{findMany:async()=>[]}};
 const page=load('src/app/admin/page.tsx',{'@/lib/dashboard-crm-groups':groups,'@/lib/require-auth':{requireAuth:async()=>({user:actor})},'@/lib/permissions':load('src/lib/permissions.ts'),'next/navigation':{redirect:()=>{throw Error('Unexpected redirect');}},'@/lib/prisma':{prisma},'@/components/dashboard-charts':()=>null});
 const view=await page.default();assert.equal(view.props.stats.processingCount,2);assert.equal(view.props.stats.completedCount,3);assert.equal(view.props.recentOrders[0].crm_status,'payoff');assert.equal('sync_status' in view.props.recentOrders[0],false);assert.ok(queries.every(where=>where.group_id===7));
 queries.length=0;actor={id:2,role:'ADMIN',group_id:null};await page.default();assert.ok(queries.every(where=>where.group_id===undefined));
});
