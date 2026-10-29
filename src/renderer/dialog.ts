export function message(title:string,body:string):Promise<void>{
  const previous=document.activeElement as HTMLElement|null;
  const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),b=document.createElement('button');
  h.textContent=title;p.textContent=body;b.textContent='关闭';d.append(h,p,b);document.body.append(d);
  return new Promise(resolve=>{d.addEventListener('close',()=>{d.remove();previous?.focus();resolve();},{once:true});b.onclick=()=>d.close();d.showModal();b.focus();});
}
