export const pages = {home:'今日首页',notes:'LaTeX 笔记',ddl:'DDL 提醒',memos:'随手记',vault:'密码簿',schedule:'课表',appearance:'外观设置',data:'数据管理',settings:'设置'} as const;
export type Page = keyof typeof pages;
export function locate(page:Page,recordId?:string):void {
  if(!Object.hasOwn(pages,page)||recordId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId))throw Error('无效内部定位');
  document.querySelectorAll<HTMLElement>('[data-page]').forEach(el=>el.hidden=el.dataset.page!==page);
  document.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(el=>el.setAttribute('aria-current',el.dataset.target===page?'page':'false'));
  document.querySelector('h1')!.textContent=pages[page];
}
