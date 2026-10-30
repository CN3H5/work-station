import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {UIState} from '../../main/ui-state';
import {isolatedRoot} from '../helpers';
test('local UI markers are atomic, restart persistent, bounded and independent of business',()=>{
 const t=isolatedRoot();try{
  const runtime=path.join(t.root,'runtime');fs.mkdirSync(runtime);const business=path.join(t.root,'fictional-business');fs.writeFileSync(business,'untouched');
  const s=new UIState(runtime);assert.deepEqual(s.read(),{version:1,guideSeen:false,closeSeen:false});s.seen('guideSeen');assert.equal(new UIState(runtime).read().guideSeen,true);
  fs.mkdirSync(path.join(runtime,'ui-state.json.tmp'));assert.throws(()=>s.seen('closeSeen'));assert.equal(s.read().closeSeen,false);assert.equal(new UIState(runtime).read().closeSeen,false);fs.rmdirSync(path.join(runtime,'ui-state.json.tmp'));
  for(const text of ['broken','{"version":2,"guideSeen":true,"closeSeen":true}','{"version":1,"guideSeen":"yes","closeSeen":true}','{"version":1,"guideSeen":true,"closeSeen":true,"path":"x"}','x'.repeat(2048)]){
   fs.writeFileSync(path.join(runtime,'ui-state.json'),text);const reset=new UIState(runtime);assert.deepEqual(reset.read(),{version:1,guideSeen:false,closeSeen:false});assert.equal(fs.readFileSync(business,'utf8'),'untouched');reset.seen('closeSeen');assert.equal(new UIState(runtime).read().closeSeen,true);
  }
 }finally{t.cleanup();}
});
