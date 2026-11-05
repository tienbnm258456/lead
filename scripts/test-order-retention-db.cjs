const fs=require('node:fs');const ts=require('typescript');const assert=require('node:assert/strict');require('@next/env').loadEnvConfig(process.cwd(),true);
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname))throw Error('Local DB only');
const {PrismaClient,Prisma}=require('@prisma/client');const db=new PrismaClient();
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports;}
const policy=load('src/lib/order-retention.ts');const rollback=Error('rollback');
(async()=>{try{await db.$transaction(async tx=>{
 const now=new Date(),old=new Date(now-100*86400000),cutoff=new Date(now-60*86400000);const tag='retention_test_'+Date.now();
 for(const value of [0,-1,1,31,'abc','',true])assert.throws(()=>policy.retentionDays(value));assert.equal(policy.retentionDays(undefined),60);assert.equal(policy.retentionDays('30'),30);
 const make=(name,data={})=>tx.order.create({data:{external_id:tag+'_'+name,customer_name:'Test',customer_phone:'000',delivery_address:'Test',items_json:'[]',total_price:1,crm_status:'payoff',crm_status_updated_at:old,created_at:old,exported_at:old,...data}});
 const eligible=[];for(const status of policy.TERMINAL_CRM_STATUSES)eligible.push(await make(status,{crm_status:status}));
 const sheets=await make('sheets',{exported_at:null,sheets_exported_at:old});eligible.push(sheets);
 await make('not_exported',{exported_at:null});await make('recent',{crm_status_updated_at:now});await make('no_status',{crm_status:null});await make('unknown',{crm_status:'future'});await make('no_date',{crm_status_updated_at:null});
 for(const status of ['complete','payoff-partly','dostavlen-predvaritelno','refund-req','plan-vozvrat','delivering','approve-cod'])await make('protected_'+status,{crm_status:status});
 const event=async(order,name,data={})=>tx.retailCrmEvent.create({data:{event_id:tag+'_'+name,order_id:'1',external_id:order.external_id,status:'payoff',status_updated_at:old,received_at:old,processed_at:old,...data}});
 const recentEvent=await make('recent_event');await event(recentEvent,'recent_event',{received_at:now});
 const pending=await make('pending');await event(pending,'pending',{processed_at:null});
 const failed=await make('failed');await event(failed,'failed',{processed_at:null,attempts:12,error:'CRM unavailable'});
 const onlyEvent=await make('event_date',{crm_status_updated_at:null});await event(onlyEvent,'event_date');eligible.push(onlyEvent);
 const checked=await make('checked',{crm_status_checked_at:now,updated_at:now});eligible.push(checked);
 await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
 await tx.$executeRaw`LOCK TABLE orders, retailcrm_events IN SHARE ROW EXCLUSIVE MODE`;
 const find=()=>tx.$queryRaw(Prisma.sql`SELECT o.id FROM orders o WHERE o.external_id LIKE ${tag+'%'} AND ${policy.purgeEligibility(cutoff)}`);
 assert.deepEqual((await find()).map(x=>x.id).sort((a,b)=>a-b),eligible.map(x=>x.id).sort((a,b)=>a-b));
 // The same predicate is evaluated again at deletion, after a fresh webhook arrives.
 await event(sheets,'arrived_after_preview',{received_at:now,processed_at:null});
 const removed=await tx.$queryRaw(Prisma.sql`DELETE FROM orders o WHERE o.external_id LIKE ${tag+'%'} AND ${policy.purgeEligibility(cutoff)} RETURNING o.id`);
 assert.equal(removed.some(x=>x.id===sheets.id),false);assert.equal(removed.length,eligible.length-1);assert.ok(await tx.order.findUnique({where:{id:sheets.id}}));
 // Test endpoint authorization, validation, transaction locking and result reporting with mocked DB writes.
 let locked=false,deleted=false;const fakeTx={$executeRaw:async sql=>{if((Array.isArray(sql)?sql.join(''):sql.text).includes('LOCK TABLE'))locked=true;},$queryRaw:async()=>{assert.equal(locked,true);deleted=true;return [{id:1}];},activityLog:{deleteMany:async()=>({count:0}),create:async()=>({})},orderSyncLog:{deleteMany:async()=>({count:0})}};
 const api=load('src/app/api/storage/route.ts',{'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'@/lib/prisma':{prisma:{$transaction:async cb=>cb(fakeTx)}},'@/lib/order-retention':policy,'@/lib/require-auth':{requireAdmin:async()=>({user:{role:'ADMIN'}})},'@/lib/settings-cache':{getSettings:async()=>({sync_log_cleanup_value:30,activity_log_cleanup_value:90}),toMs:x=>x*86400000}});
 assert.equal((await api.DELETE({json:async()=>({confirmText:'DELETE',retentionDays:1})})).status,400);assert.equal(deleted,false);
 assert.equal((await api.DELETE({json:async()=>({confirmText:'wrong',retentionDays:60})})).status,400);assert.equal(deleted,false);
 assert.equal((await api.DELETE({json:async()=>({confirmText:'DELETE',retentionDays:60})})).body.deletedCount,1);
 throw rollback;
 },{timeout:30000});}catch(e){if(e!==rollback)throw e;}finally{await db.$disconnect();}console.log('PASS: all final statuses, expiry/export requirements, pending/error/recent webhook protection, recheck on delete, API locking; DB fixtures rolled back');})().catch(e=>{console.error(e);process.exitCode=1;});
