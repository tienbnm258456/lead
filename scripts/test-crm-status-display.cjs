const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/crm-status-display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports);
const {CRM_STATUS_MAPPING:catalog,CRM_STATUS_GROUPS:groups,getCrmStatusDisplay:display}=m.exports;
test('all 45 partner statuses are assigned to the nine PDF groups',()=>{
 assert.equal(Object.keys(catalog).length,45);assert.equal(Object.keys(groups).length,9);
 const counts={};for(const code of Object.keys(catalog)){const d=display(code);assert.equal(d.known,true);assert.equal(d.code,code);assert.ok(d.label);assert.ok(d.description);assert.match(d.color,/^#[0-9a-f]{6}$/i);counts[d.group]=(counts[d.group]||0)+1;}
 assert.deepEqual(counts,{new:4,processing:7,reconfirmation:7,confirmed:3,assembly:2,delivery:9,completed:4,cancelled:7,refund:2});
});
test('intermediate outcomes retain their business meaning instead of becoming final failures or paid orders',()=>{
 assert.equal(display('goriachii').label,'Đơn mới ưu tiên');assert.equal(display('approve-cod').group,'confirmed');
 assert.equal(display('otkaz-emu-predvaritelno').group,'delivery');assert.match(display('otkaz-emu-predvaritelno').description,/chưa hủy/);
 assert.equal(display('plan-vozvrat').group,'delivery');assert.equal(display('return').group,'cancelled');
 assert.equal(display('perepodtverdit-net-tovara').group,'reconfirmation');assert.equal(display('otmena-net-tovara').group,'cancelled');
 assert.equal(display('1d-nedozvon').group,'new');assert.equal(display('no-call').group,'cancelled');
 assert.match(display('uterian').description,/chưa khẳng định/);
 assert.equal(display('complete').label,'Đã giao hàng');assert.notEqual(display('complete').label,display('payoff').label);
 assert.notEqual(display('refund-req').label,display('refund-done').label);
});
test('missing status stays an honest display fallback and unknown codes are preserved',()=>{
 for(const code of [null,undefined,'']){const d=display(code);assert.equal(d.label,'Chờ xác nhận');assert.equal(d.code,null);assert.equal(d.group,null);}
 for(const code of ['new-future-code','confirmed','constructor','__proto__']){const d=display(code);assert.equal(d.label,code);assert.equal(d.known,false);assert.equal(d.group,null);}
});
