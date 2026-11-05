const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file){const m={exports:{}};const mocks={'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'@/lib/permissions':{},'@/lib/prisma':{prisma:new Proxy({},{get(){throw Error('Invalid promotion must be rejected before database access');}})},'@/lib/require-auth':{requireAuth:async()=>({user:{role:'ADMIN'}})}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports;}
for(const [file,method] of [['src/app/api/landing-pages/route.ts','POST'],['src/app/api/landing-pages/[id]/route.ts','PUT']])test(method+' rejects missing, null, blank, non-string and oversized promotions per package',async()=>{
 const route=load(file);for(const promotion of [undefined,null,'','   ',12,'x'.repeat(101)]){
 const result=await route[method]({json:async()=>({name:'Test',xml_id:'PARTNER_CODE',variants:[{label:'Valid',price:100,promotion:'1+1'},{label:'Invalid',price:200,promotion}]})},{params:Promise.resolve({id:'1'})});
 assert.equal(result.status,400);assert.match(result.body.error,/Gói 2/);assert.match(result.body.error,/khuyến mại/);
 }
});
