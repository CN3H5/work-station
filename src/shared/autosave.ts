// A generation belongs to the draft, a mutation ID belongs to one immutable request.
export class Autosave<T> {
  state: 'saved'|'saving'|'failed'|'conflict'|'recovery' = 'saved';
  private generation=0; private saved=0; private timer: ReturnType<typeof setTimeout>|undefined;
  private pending: Promise<void>|undefined; private draft:T;
  private request: {value:T;revision:number;id:string;generation:number}|undefined;
  constructor(initial:T, private revision:number, private send:(value:T,revision:number,id:string)=>Promise<{ok:boolean;revision?:number;code?:string}>, private update:()=>void, private id:()=>string=()=>crypto.randomUUID()) {this.draft=initial;}
  edit(value:T):void {this.draft=value;this.generation++;this.state='saving';clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush();},500);this.update();}
  async flush():Promise<void> {
    clearTimeout(this.timer); if(this.pending){await this.pending; if(this.saved<this.generation && this.state==='saving')await this.flush();return;}
    if(this.saved===this.generation)return;
    this.request??={value:structuredClone(this.draft),revision:this.revision,id:this.id(),generation:this.generation};
    const req=this.request; this.state='saving';this.update();
    this.pending=(async()=>{try {const result=await this.send(req.value,req.revision,req.id);if(result.ok){this.revision=result.revision!;this.saved=req.generation;this.request=undefined;this.state=this.saved===this.generation?'saved':'saving';}else this.state=result.code==='CONFLICT'?'conflict':result.code==='RECOVERY_REQUIRED'?'recovery':'failed';}catch{this.state='failed';}finally{this.update();}})();
    await this.pending;this.pending=undefined;if(this.state==='saving'&&this.saved<this.generation)await this.flush();
  }
}
