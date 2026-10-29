"""MASTERSKAYA v3.0 regression: archive, restore, migration, UI and responsiveness."""
import json, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
TODAY=datetime.date.today().isoformat()
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="style.css?v=300">','<style>'+ (ROOT/'style.css').read_text()+'</style>')
for name in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):
 HTML=HTML.replace(f'<script src="{name}?v=300" defer></script>','')
HTML=HTML.replace('</body>', '\n'.join(f'<script>{(ROOT/name).read_text()}</script>' for name in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
seed={
 'version':10,'projects':[{'id':'tif','name':'TIF — тестовый проект','color':'#91b9b0'}, {'id':'second','name':'Проект 2','color':'#b8a2d1'}],
 'tasks':[{'id':f't{i}','title':f'Тестовая задача {i} — длинное название','projectId':'tif' if i<35 else 'second','status':'done' if i%3!=0 else 'doing','priority':'high' if i==0 else 'normal','due':TODAY if i==0 else '', 'subtasks':[{'id':f's{i}','title':'Один очень важный шаг','done':i%3!=0}]} for i in range(110)],
 'activityLog':[{'id':'a1','date':TODAY,'delta':1,'kind':'task','projectId':'tif','title':'Завершение большой задачи'}, {'id':'a2','date':TODAY,'delta':1,'kind':'academic','title':'Лабораторная'}, {'id':'a3','date':TODAY,'delta':-1,'kind':'subtask','title':'ВУЗ · Переработать чертёж'}],
 'academic':[{'id':'w1','title':'Курсовая работа по ЖБК','status':'debt','subject':'ЖБК','subjectId':'u1','due':TODAY,'type':'course','subtasks':[{'id':'st1','title':'Подготовить расчёт','done':False}]}],
 'universitySubjects':[{'id':'u1','title':'ЖБК','teacher':'Линовский','sessionId':'','debt':True}],
 'workSessions':[{'id':'ws1','date':TODAY,'minutes':75,'projectId':'tif','area':'Разработка игр','note':'Моделирование'}]
}
results=[]
def test(name,fn):
 try:fn();results.append('PASS '+name)
 except Exception as exc:results.append('FAIL '+name+' '+str(exc));raise

def check(condition,msg):
 assert condition,msg

def browser_data(page):return json.loads(page.evaluate("localStorage.getItem('atelier_planner_v1')"))

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 errors=[]
 def page_new(width=1280,data=seed):
  ctx=browser.new_context(viewport={'width':width,'height':850},device_scale_factor=1)
  page=ctx.new_page()
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.evaluate("window.__store={atelier_planner_v1:"+json.dumps(json.dumps(data,ensure_ascii=False))+"};Object.defineProperty(window,'localStorage',{value:{getItem(k){return window.__store[k]??null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]},clear(){window.__store={}}},configurable:true});window.confirm=()=>true;")
  page.set_content(HTML,wait_until='domcontentloaded')
  return ctx,page
 ctx,p=page_new()
 p.locator('[data-nav="projects"]').first.click()
 p.locator('[data-action="open-project"][data-id="tif"]').click()
 progress_pre=p.locator('.project-progress-panel .social-meta span').inner_text()
 project_done=browser_data(p)['tasks']
 done_count=len([t for t in project_done if t['status']=='done' and t['projectId']=='tif'])
 test('Project progress computed before archive',lambda:check(f'{done_count} / 35' in progress_pre,'bad initial project progress'))
 test('Project sections start collapsed',lambda:check(p.locator('.project-task-sections details').count()==4 and p.locator('.project-task-sections details[open]').count()==0,'open rows on initial render'))
 p.locator('.project-task-sections details').nth(2).locator('summary').click()
 test('Finished rows expand deliberately',lambda:check(p.locator('.project-task-sections details[open]').count()==1,'finished section did not expand'))
 p.locator('[data-nav="tasks"]').first.click()
 p.locator('#task-filter').select_option('done')
 test('Only 8 finished tasks shown by default',lambda:check(p.locator('.task-list .task-card').count()==8 and p.locator('[data-action="toggle-all-finished"]').count()==1,'not compact finished list'))
 target=p.locator('.task-list .task-card').first.get_attribute('data-task-id')
 p.locator(f'[data-action="archive-task"][data-id="{target}"]').click()
 after=browser_data(p)
 test('Archive sets date without deleting data',lambda:check(len(after['tasks'])==110 and next(t for t in after['tasks'] if t['id']==target)['archivedAt']==TODAY,'task deleted or archive flag missing'))
 test('Log unaffected by archiving',lambda:check(len(after['activityLog'])==3,'archive created fake activity'))
 test('Finished visible count falls',lambda:check(p.locator('#task-filter option[value="done"]').inner_text().endswith(f'({len([t for t in after["tasks"] if t["status"]=="done" and not t["archivedAt"]])})'),'done count incorrect'))
 p.locator('#task-filter').select_option('archive')
 test('Archive contains item and can show its subtask',lambda:check(p.locator(f'.archive-entry[data-task-id="{target}"]').count()==1,'archive record not visible'))
 p.locator(f'.archive-entry[data-task-id="{target}"] [data-action="toggle-archive-preview"]').click()
 test('Archived subtask is intact',lambda:check(p.locator(f'.archive-entry[data-task-id="{target}"] .archive-entry-detail').is_visible(),'archive detail missing'))
 p.locator('[data-nav="projects"]').first.click()
 p.locator('[data-action="open-project"][data-id="tif"]').click()
 test('Project progress unchanged after archive',lambda:check(p.locator('.project-progress-panel .social-meta span').inner_text()==progress_pre,'project completion went backward'))
 test('Project archive count increases',lambda:check(p.locator('.project-detail-summary .stat-value').last.inner_text()=='1','project archive counter missing'))
 p.locator('.project-task-sections details').last.locator('summary').click()
 p.locator(f'[data-action="restore-task"][data-id="{target}"]').click()
 test('Restore clears flag but keeps task completed',lambda:check(next(t for t in browser_data(p)['tasks'] if t['id']==target)['archivedAt']=='' and next(t for t in browser_data(p)['tasks'] if t['id']==target)['status']=='done','restore lost state'))
 test('Project progress unchanged after restore',lambda:check(p.locator('.project-progress-panel .social-meta span').inner_text()==progress_pre,'restore changed progress'))
 p.locator('[data-nav="tasks"]').first.click();p.locator('#task-filter').select_option('done')
 p.locator('[data-action="archive-all-completed"]').first.click()
 b=browser_data(p)
 count=sum(1 for t in b['tasks'] if t['status']=='done')
 test('Bulk archive preserves all 110 tasks',lambda:check(len(b['tasks'])==110 and sum(bool(t['archivedAt']) for t in b['tasks'])==count,'bulk archive mismatch'))
 test('Archive keeps all history records',lambda:check(len(b['activityLog'])==3,'history changed after bulk archive'))
 p.locator('#task-filter').select_option('archive')
 p.locator('#task-search').fill('Тестовая задача 5')
 test('Archive search filters',lambda:check(0<p.locator('.archive-entry').count()<count,'archive search failed'))
 saved=browser_data(p);ctx.close();ctx,p=page_new(data=saved)
 p.locator('[data-nav="tasks"]').first.click();p.locator('#task-filter').select_option('archive')
 test('Archive persists after reload',lambda:check(p.locator('.archive-entry').count()==count,'archive lost after reload'))
 p.locator('[data-nav="activity"]').first.click()
 p.locator('.activity-day-panel').wait_for()
 test('Activity grouped and initially collapsed',lambda:check(p.locator('.activity-day-panel .activity-group').count()>=2 and p.locator('.activity-day-panel .activity-group[open]').count()==0,'day group not folded'))
 p.locator('.activity-day-panel .activity-group summary').first.click()
 test('Activity group expands to old recorded task',lambda:check('Завершение большой задачи' in p.locator('.activity-day-panel').inner_text() or 'Лабораторная' in p.locator('.activity-day-panel').inner_text(),'event missing'))
 p.locator('[data-nav="overview"]').first.click()
 test('Overview prioritizes due university task',lambda:check('Курсовая работа по ЖБК' in p.locator('.attention-panel').inner_text(),'attention not showing'))
 test('No JavaScript errors',lambda:check(not errors,'; '.join(errors)))
 ctx.close()
 # Failure injection: a quota error must not silently archive a task.
 failctx,failpage=page_new(data=seed)
 failpage.locator('[data-nav="tasks"]').first.click()
 failpage.locator('#task-filter').select_option('done')
 failid=failpage.locator('.task-card').first.get_attribute('data-task-id')
 failpage.evaluate("(() => { localStorage.setItem = () => { throw new Error('QuotaExceededError') }; return true; })()")
 failpage.locator(f'[data-action="archive-task"][data-id="{failid}"]').click()
 test('Storage failure shows visible warning',lambda:check(failpage.locator('#storage-warning').is_visible(),'quota error not displayed'))
 test('Storage failure rolls archive change back in memory',lambda:check(not next(t for t in browser_data(failpage)['tasks'] if t['id']==failid).get('archivedAt'),'quota action unexpectedly saved'))
 failctx.close()
 for width in [320,360,375,390,430,720,768,1024,1440]:
  c,pg=page_new(width)
  for section in ['overview','tasks','projects','activity','university']:
   pg.locator(f'[data-nav="{section}"]').first.click()
   if section=='projects':pg.locator('[data-action="open-project"][data-id="tif"]').click()
   if section=='tasks':pg.locator('#task-filter').select_option('done')
   dims=pg.evaluate('({page:document.documentElement.scrollWidth, viewport:innerWidth})')
   test(f'Mobile/desktop {width}px {section} no overflow',lambda d=dims:check(d['page']<=d['viewport']+2,str(d)))
  c.close()
 browser.close()
for result in results:print(result)
print(f'RESULT {len(results)}/{len(results)}; JS errors {len(errors)}')
