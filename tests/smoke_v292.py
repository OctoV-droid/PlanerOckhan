"""МАСТЕРСКАЯ v2.9: тестирование интерфейса в изолированном Chromium."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css?v=300">',f'<style>{(ROOT/"style.css").read_text()}</style>')
for file in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):
 html=html.replace(f'<script src="{file}?v=300" defer></script>','')
html=html.replace('</body>','\n'.join(f'<script>{(ROOT/file).read_text()}</script>' for file in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
MOCK="""window.__store=REPLACE;window.__fail=false;Object.defineProperty(window,'localStorage',{value:{getItem(k){return Object.hasOwn(window.__store,k)?window.__store[k]:null},setItem(k,v){if(window.__fail)throw new Error('QuotaExceededError');window.__store[k]=String(v)},removeItem(k){delete window.__store[k]},clear(){window.__store={}},get length(){return Object.keys(window.__store).length}},configurable:true});window.confirm=()=>true;window.alert=m=>{window._alerts=(window._alerts||[]).concat(m)};"""
results=[]
def test(name,fn):
 try:fn();results.append('PASS '+name)
 except Exception as e:results.append('FAIL '+name+': '+str(e));raise

def check(condition,message):
 assert condition,message
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 contexts=[]
 errors=[]
 def newpage(data=None,width=1280):
  ctx=browser.new_context(viewport={'width':width,'height':850},accept_downloads=True);contexts.append(ctx)
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  src={'atelier_planner_v1':json.dumps(data,ensure_ascii=False)} if data is not None else {}
  page.evaluate(MOCK.replace('REPLACE',json.dumps(src,ensure_ascii=False)))
  page.set_content(html,wait_until='domcontentloaded',timeout=8000);return page
 def store(pg):return json.loads(pg.evaluate("localStorage.getItem('atelier_planner_v1')"))
 def nav(pg,name):pg.locator(f'[data-nav="{name}"]').first.click()
 def form(pg,click,values):
  pg.locator(click).first.click();check(pg.locator('dialog[open]').count()==1,'modal not opened '+click)
  for key,val in values.items():
   el=pg.locator('#fld-'+key)
   if isinstance(val,bool):el.set_checked(val)
   elif el.evaluate('(e)=>e.tagName')=='SELECT':el.select_option(val)
   else:el.fill(str(val))
  pg.locator('#editor-form button[type="submit"]').click()
  check(pg.locator('dialog[open]').count()==0,'modal not closed '+click)
 try:
  pg=newpage()
  test('v2.9.2 application loads',lambda:check('ВУЗ' in pg.locator('body').inner_text(),'no university nav'))
  nav(pg,'university')
  test('university starts with subjects',lambda:check(pg.locator('[data-action="add-uni-subject"]').count()>0,'missing subject actions'))
  pg.locator('[data-action="uni-tab"][data-tab="sessions"]').click()
  form(pg,'[data-action="add-session"]',{'title':'Зимняя 26/27','start':'2026-12-01','end':'2027-01-30'})
  sid=store(pg)['universitySessions'][0]['id']
  pg.locator('[data-action="uni-tab"][data-tab="works"]').click()
  form(pg,'[data-action="add-uni-subject"]',{'title':'Фундаменты','teacher':'Линовский','sessionId':sid,'due':'2027-01-25'})
  subid=store(pg)['universitySubjects'][0]['id']
  test('create a subject linked to session and teacher',lambda:check(store(pg)['universitySubjects'][0]['teacher']=='Линовский' and store(pg)['universitySubjects'][0]['sessionId']==sid,'subject fields missing'))
  pg.locator('#academic-session-filter').select_option(sid)
  test('filter subjects by session',lambda:check(pg.locator('.uni-subject').count()==1,'session filtering hides linked subject'))
  pg.locator('#academic-session-filter').select_option('none')
  test('no-session filter',lambda:check(pg.locator('.uni-subject').count()==0,'showed linked subject with no-session filter'))
  pg.locator('#academic-session-filter').select_option('all')

  form(pg,f'[data-action="add-academic"][data-subject="{subid}"]',{'title':'ЛР №1','type':'lab','status':'progress','due':'2026-12-20'})
  form(pg,f'[data-action="add-academic"][data-subject="{subid}"]',{'title':'КР','type':'course','status':'planned'})
  workid=next(x['id'] for x in store(pg)['academic'] if x['title']=='КР')
  test('two works nested under foundations',lambda:check(pg.locator(f'[data-uni-subject-id="{subid}"] .uni-work').count()==2,'not nested'))
  # По умолчанию свёрнуты шаги, но карточки работ видны даже у свёрнутого предмета.
  test('collapsed subject shows works',lambda:check(pg.locator('.uni-subject .uni-work').count()==2 and not pg.locator('.uni-subject-detail').is_visible(),'subject collapsed incorrectly'))
  pg.locator('[data-action="toggle-uni-subject"]').first.click()
  test('subject details expand without hiding works',lambda:check(pg.locator('.uni-subject-detail').is_visible() and pg.locator('.uni-work').count()==2,'subject details missing'))
  pg.locator('[data-action="toggle-uni-subject"]').first.click()
  test('subject collapse keeps work titles',lambda:check(pg.locator('.uni-work').count()==2 and not pg.locator('.uni-subject-detail').is_visible(),'collapsed subject lost works'))
  pg.locator(f'[data-uni-work-id="{workid}"] [data-action="toggle-uni-work"]').click()
  test('nested steps expand on demand',lambda:check(pg.locator(f'[data-uni-work-id="{workid}"] .uni-work-extra').is_visible(),'work did not expand'))
  pg.locator('[data-action="edit-uni-subject"]').first.click()
  pg.locator('input[name=debt]').check()
  pg.locator('#editor-form button[type="submit"]').click()
  test('explicit subject debt',lambda:check('Долг' in pg.locator('.uni-subject-tags').first.inner_text(),'missing debt status'))
  pg.locator('[data-action="edit-uni-subject"]').first.click()
  pg.locator('input[name=debt]').uncheck()
  pg.locator('#editor-form button[type="submit"]').click()
  test('clear debt without losing works',lambda:check(len(store(pg)['academic'])==2 and store(pg)['universitySubjects'][0]['debt']==False,'cannot clear debt'))

  pg.locator(f'[data-uni-quick="{workid}"] input[name="step"]').fill('Расчёт КР')
  pg.locator(f'[data-uni-quick="{workid}"] button').click()
  pg.locator(f'[data-uni-quick="{workid}"] input[name="step"]').fill('Чертёж №1')
  pg.locator(f'[data-uni-quick="{workid}"] button').click()
  pg.locator(f'[data-uni-quick="{workid}"] input[name="step"]').fill('Чертёж №2')
  pg.locator(f'[data-uni-quick="{workid}"] button').click()
  test('instant creation of 3 nested steps',lambda:check(len(next(x for x in store(pg)['academic'] if x['id']==workid)['subtasks'])==3,'subtasks not saved'))
  pg.locator(f'[data-uni-work-id="{workid}"] [data-uni-step]').first.check()
  test('checking a step saves activity',lambda:check(any(x['kind']=='subtask' and 'Расчёт КР' in x['title'] for x in store(pg)['activityLog']),'no activity log'))
  firstid=next(x for x in store(pg)['academic'] if x['id']==workid)['subtasks'][0]['id']
  form(pg,f'[data-action="edit-uni-step"][data-id="{firstid}"]',{'title':'Расчёт КР исправленный'})
  test('rename step preserves completed status',lambda:check(next(x for x in store(pg)['academic'] if x['id']==workid)['subtasks'][0]['done'],'step completion lost'))
  pg.locator(f'[data-uni-work-id="{workid}"] [data-uni-step]').first.uncheck()
  test('uncheck adds reversal to activity',lambda:check(any(x['delta']==-1 and x['kind']=='subtask' for x in store(pg)['activityLog']),'reversal missing'))
  pg.locator(f'[data-uni-work-id="{workid}"] [data-uni-work-check]').check()
  test('complete work independently of steps',lambda:check(next(x for x in store(pg)['academic'] if x['id']==workid)['status']=='passed','work not passed'))
  pg.locator('#academic-filter').select_option('planned')
  test('university planned filter separate',lambda:check(pg.locator('.uni-work').count()==0,'planned mix'))
  pg.locator('#academic-filter').select_option('all')
  pg.locator('[data-action="edit-uni-subject"]').first.click()
  pg.locator('#fld-title').fill('Фундаменты и основания')
  pg.locator('#editor-form button[type="submit"]').click()
  test('renaming subject updates old work labels',lambda:check(all(w['subject']=='Фундаменты и основания' for w in store(pg)['academic']),'old subject name'))
  # Import/export and repeat reload on real origin.
  before=store(pg)
  pg=newpage(before);nav(pg,'university')
  test('persistence after browser reload',lambda:check(len(store(pg)['academic'])==2 and len(store(pg)['universitySubjects'])==1,'not persisted'))
  nav(pg,'settings')
  pg.evaluate("window.__exports=[];window.HTMLAnchorElement.prototype.click=function(){window.__exports.push(this.download)}")
  pg.locator('#app [data-action="export"]').first.click()
  test('JSON export works',lambda:check(any(isinstance(x,str) and x.endswith('.json') for x in pg.evaluate('window.__exports')),'not json'))
  pg.locator('[data-action="delete-uni-subject"]').count() # no-op
  pg.locator('[data-nav="university"]').first.click()
  pg.locator('[data-action="delete-uni-subject"]').first.click()
  test('deleting subject does not delete works',lambda:check(len(store(pg)['academic'])==2 and store(pg)['universitySubjects'][0]['title']=='Без предмета','works removed'))
  legacy={ 'version':8,'projects':[], 'academic':[{'id':'w1','title':'ЛР №1','subject':'Механика','teacher':'Иванов','sessionId':'win','status':'progress','type':'lab','due':'2026-12-01'},{'id':'w2','title':'КР','subject':'Механика','teacher':'Иванов','sessionId':'win','status':'planned','type':'course'}], 'universitySessions':[{'id':'win','title':'Зимняя 26/27','start':'','end':''}]}
  old=newpage(legacy)
  nav(old,'university')
  migrated=old.evaluate('JSON.parse(localStorage.getItem("atelier_planner_v1"))')
  # migration only in memory until first save
  test('v2.8 data visible as one subject',lambda:check(old.locator('.uni-subject').count()==1 and old.locator('.uni-work').count()==2,'migration failed'))
  old.locator('[data-action="edit-uni-subject"]').click();old.locator('#fld-notes').fill('Перенесено из старой версии');old.locator('#editor-form button[type="submit"]').click()
  saved=store(old)
  test('v2.8 migration persisted without losing works',lambda:check(len(saved['academic'])==2 and len(saved['universitySubjects'])==1 and saved['academic'][0]['subjectId']==saved['academic'][1]['subjectId'],'migration lost link'))
  for width in (320,375,768,1280):
   old.set_viewport_size({'width':width,'height':850});old.wait_for_timeout(100)
   check(old.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),f'horizontal scroll at {width}')
  results.append('PASS responsive layout 320/375/768/1280')
  test('no JS errors',lambda:check(not errors,str(errors)))
 except Exception as e:
  print('ERROR:',repr(e))
 finally:
  for item in results:print(item)
  print(f'RESULT {sum(x.startswith("PASS") for x in results)}/{len(results)}')
  browser.close()

if any(x.startswith('FAIL') for x in results):raise SystemExit(1)
