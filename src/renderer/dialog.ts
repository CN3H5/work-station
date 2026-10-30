export function message(title:string,body:string):Promise<void>{
  const previous=document.activeElement as HTMLElement|null;
  const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),b=document.createElement('button');
  h.textContent=title;p.textContent=body;b.textContent='关闭';d.append(h,p,b);document.body.append(d);
  return new Promise(resolve=>{d.addEventListener('close',()=>{d.remove();previous?.focus();resolve();},{once:true});b.onclick=()=>d.close();d.showModal();b.focus();});
}
export function confirmAction(title:string,body:string,accept='确认'):Promise<boolean>{
  const previous=document.activeElement as HTMLElement|null;
  const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p');
  const yes=document.createElement('button'),no=document.createElement('button');h.textContent=title;p.textContent=body;yes.textContent=accept;no.textContent='取消';d.append(h,p,no,yes);document.body.append(d);
  return new Promise(resolve=>{d.addEventListener('close',()=>{const ok=d.returnValue==='yes';d.remove();previous?.focus();resolve(ok);},{once:true});yes.onclick=()=>d.close('yes');no.onclick=()=>d.close('no');d.showModal();no.focus();});
}
