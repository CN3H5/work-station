import fs from 'node:fs';
import path from 'node:path';
import {keys, parseStrict} from './ordinary-model';
import {rejectLinks} from './data-root';
export interface UIFlags {version:1;guideSeen:boolean;closeSeen:boolean}
export class UIState {
  private flags:UIFlags={version:1,guideSeen:false,closeSeen:false};
  private readonly file:string;
  constructor(runtime:string){
    this.file=path.join(runtime,'ui-state.json');rejectLinks(this.file);
    try{
      if(fs.statSync(this.file).size>1024)throw Error('UI_STATE_TOO_LARGE');
      const v=parseStrict(fs.readFileSync(this.file,'utf8'));keys(v,['version','guideSeen','closeSeen']);
      if(v.version!==1||typeof v.guideSeen!=='boolean'||typeof v.closeSeen!=='boolean')throw Error('INVALID_UI_STATE');
      this.flags={version:1,guideSeen:v.guideSeen,closeSeen:v.closeSeen};
    }catch{/* Only local prompt markers reset. Business data is never touched. */}
  }
  read():UIFlags{return {...this.flags};}
  seen(key:'guideSeen'|'closeSeen'):void{
    const next={...this.flags,[key]:true};const temp=this.file+'.tmp';rejectLinks(this.file);rejectLinks(temp);
    const fd=fs.openSync(temp,'w');try{fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,this.file);this.flags=next;
  }
}
