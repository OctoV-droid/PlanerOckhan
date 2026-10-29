from pathlib import Path
import json,datetime
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="style.css?v=300">','<style>'+(root/'style.css').read_text()+'</style>')
for name in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):html=html.replace(f'<script src="{name}?v=300" defer></script>','')
html=html.replace('</body>','\n'.join('<script>'+(root/n).read_text()+'</script>' for n in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
date=datetime.date.today().isoformat()
data={'projects':[{'id':'p','name':'TIF: Новониколаевск','color':'#a3b8cf'}], 'tasks':[{'id':str(i),'title':('Продумать персонажей и проработать геометрию локации' if i%2 else 'Закончить моделирование окружения'), 'projectId':'p','status':'done' if i%3 else 'doing','subtasks':[{'id':'sub'+str(i),'title':'Важный подготовительный этап','done':i%3!=0}]} for i in range(42)],'academic':[{'id':'a','title':'Курсовая работа ЖБК','subjectId':'s','subject':'ЖБК','due':date,'status':'debt','subtasks':[{'id':'k','title':'Чертёж №1','done':False}]}], 'universitySubjects':[{'id':'s','title':'ЖБК','teacher':'Линовский','debt':True}],'activityLog':[{'id':'ac','date':date,'kind':'academic','delta':1,'title':'Рассчитал балку'}]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (390,1280):
  ctx=b.new_context(viewport={'width':width,'height':820},device_scale_factor=1)
  p=ctx.new_page();p.evaluate("window.__store={atelier_planner_v1:"+json.dumps(json.dumps(data,ensure_ascii=False))+"};Object.defineProperty(window,'localStorage',{value:{getItem(k){return window.__store[k]??null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]}}});window.confirm=()=>true")
  p.set_content(html,wait_until='domcontentloaded')
  for section in ('overview','tasks','projects','activity'):
   p.locator(f'[data-nav="{section}"]').first.click()
   if section=='tasks':p.locator('#task-filter').select_option('done')
   if section=='projects':p.locator('[data-action="open-project"]').first.click()
   p.screenshot(path=str(root/'tests'/f'v300_{section}_{width}.png'),full_page=True)
  ctx.close()
 b.close()
