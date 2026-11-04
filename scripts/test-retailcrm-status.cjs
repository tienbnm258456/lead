const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const ts = require('typescript');
function load(file, mocks = {}, fetchMock) {
 const module = { exports: {} }; const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
 new Function('require','module','exports','fetch',code)(n => n in mocks ? mocks[n] : require(n), module,module.exports,fetchMock);return module.exports;
}
const response = { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } };
const event = { eventId:'123-confirmed-100', orderId:'123', externalId:'ORD-1', status:'confirmed', updatedAt:'2026-11-04T10:30:00+05:00' };
const helper = load('src/lib/retailcrm-status.ts');
test('trigger accepts string fields and unknown codes, rejects numbers and invalid dates',()=>{
 assert.equal(helper.parseStatusEvent({...event,status:'new-custom-code'}).status,'new-custom-code');
 for(const patch of [{orderId:123},{updatedAt:'bad'},{externalId:''},{status:[]},{updatedAt:'2026-11-04 10:30:00'}])assert.throws(()=>helper.parseStatusEvent({...event,...patch}));
});
test('GET reads RetailCRM order envelope and uses encoded externalId, site and API key',async()=>{
 process.env.RETAILCRM_API_KEY='test-key';process.env.RETAILCRM_SITE='test-site';process.env.RETAILCRM_BASE_URL='https://example.test/api/v5/';
 let url;const api=load('src/lib/retailcrm-status.ts',{},async(u,opts)=>{url=u;assert.equal(opts.cache,'no-store');return {ok:true,json:async()=>({success:true,order:{id:123,externalId:'ORD/1',status:'custom-new',statusUpdatedAt:event.updatedAt}})}});
 const result=await api.getRetailCrmStatus('ORD/1');assert.equal(url.pathname,'/api/v5/orders/ORD%2F1');assert.equal(url.searchParams.get('by'),'externalId');assert.equal(url.searchParams.get('site'),'test-site');assert.equal(url.searchParams.get('apiKey'),'test-key');assert.deepEqual(result,{orderId:'123',externalId:'ORD/1',status:'custom-new',updatedAt:event.updatedAt});assert.equal('eventId' in result,false);
});
test('CRM errors and incomplete/mismatched responses cannot become valid status',async()=>{
 for(const data of [{success:false},{success:true,order:{id:123,externalId:'OTHER',status:'confirmed'}},{success:true,order:{id:123,externalId:'ORD-1'}}]){
 const api=load('src/lib/retailcrm-status.ts',{},async()=>({ok:true,json:async()=>data}));await assert.rejects(()=>api.getRetailCrmStatus('ORD-1'));
 }
});
test('webhook validates secret, persists before 202, deduplicates, returns 503 on DB failure',async()=>{
 process.env.RETAILCRM_WEBHOOK_SECRET='x'.repeat(40);let saved;let failure;
 const route=load('src/app/api/webhook/retailcrm/[secret]/route.ts',{'next/server':response,'@/lib/prisma':{prisma:{retailCrmEvent:{create:async({data})=>{if(failure)throw failure;saved=data;}}}},'@/lib/retailcrm-status':helper});
 const call=(secret,body=event)=>route.POST({text:async()=>JSON.stringify(body)},{params:Promise.resolve({secret})});
 assert.equal((await call('wrong')).status,401);assert.equal(saved,undefined);
 assert.equal((await call(process.env.RETAILCRM_WEBHOOK_SECRET,{...event,orderId:123})).status,400);
 assert.equal((await call(process.env.RETAILCRM_WEBHOOK_SECRET)).status,202);assert.equal(saved.external_id,event.externalId);
 failure={code:'P2002'};assert.equal((await call(process.env.RETAILCRM_WEBHOOK_SECRET)).body.duplicate,true);
 failure=Error('DB unavailable');assert.equal((await call(process.env.RETAILCRM_WEBHOOK_SECRET)).status,503);
});
test('status GET checks group scope before calling CRM',async()=>{
 let scope;let calls=0;let order=null;
 const route=load('src/app/api/retailcrm/status/[externalId]/route.ts',{'next/server':response,'@/lib/prisma':{prisma:{order:{findFirst:async({where})=>{scope=where;return order;}}}},'@/lib/require-auth':{requireAuth:async()=>({user:{role:'USER',group_id:7}})},'@/lib/permissions':load('src/lib/permissions.ts'),'@/lib/retailcrm-status':{getRetailCrmStatus:async()=>{calls++;return {status:'confirmed'}}}});
 const call=()=>route.GET({},{params:Promise.resolve({externalId:'ORD-1'})});assert.equal((await call()).status,404);assert.equal(scope.group_id,7);assert.equal(calls,0);order={id:1};assert.equal((await call()).status,200);assert.equal(calls,1);
});
test('worker trusts current CRM state, keeps sync_status, retries failures and prevents time regression',async()=>{
 const queued={event_id:event.eventId,order_id:'123',external_id:'ORD-1',attempts:0};let order={id:1,retailcrm_id:123,crm_status_updated_at:null};let result={orderId:'123',status:'cancelled',updatedAt:'2026-11-04T11:00:00+05:00'};let saved;let task;let locked=true;
 const tx={$queryRaw:async()=>[{locked}],retailCrmEvent:{findFirst:async()=>queued,update:async({data})=>{task=data}},order:{findUnique:async()=>order,update:async({data})=>{saved=data}}};
 const worker=load('src/lib/retailcrm-status-worker.ts',{'@/lib/prisma':{prisma:{$transaction:async cb=>cb(tx)}},'@/lib/retailcrm-status':{getRetailCrmStatus:async()=>{if(result instanceof Error)throw result;return result}}});
 assert.equal((await worker.processRetailCrmEvents()).processed,1);assert.equal(saved.crm_status,'cancelled');assert.equal('sync_status' in saved,false);assert.ok(task.processed_at);
 saved=null;order.crm_status_updated_at=new Date('2026-11-05T00:00:00Z');await worker.processRetailCrmEvents();assert.equal(saved,null);
 result=Error('CRM HTTP 503');await worker.processRetailCrmEvents();assert.equal(task.error,'CRM HTTP 503');assert.ok(task.next_attempt_at);assert.equal(task.processed_at,undefined);
 order=null;await worker.processRetailCrmEvents();assert.match(task.error,/missing/);
 locked=false;assert.equal((await worker.processRetailCrmEvents()).busy,true);
});
