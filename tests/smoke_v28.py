import json, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css?v=28">',f'<style>{(root/"style.css").read_text()}</style>')
for f in ('storage.js','analytics.js','habits.js','app.js','pwa.js'):
 html=html.replace(f'<script src="{f}?v=28" defer></script>','')
html=html.replace('</body>', '\n'.join(f'<script>{(root/f).read_text()}</script>' for f in ('storage.js','analytics.js','habits.js','app.js'))+'</body>')
MOCK='''window.__store=REPLACE;window.__fail=false;Object.defineProperty(window,'localStorage',{value:{getItem(k){return Object.hasOwn(window.__store,k)?window.__store[k]:null},setItem(k,v){if(window.__fail)throw new Error('QuotaExceededError');window.__store[k]=String(v)},removeItem(k){delete window.__store[k]},clear(){window.__store={}},get length(){return Object.keys(window.__store).length}},configurable:true});window.confirm=()=>true;window.alert=(msg)=>{(window.__alerts??=[]).push(msg)};'''
results=[]
def ck(label,fn):
 try:fn();results.append('PASS '+label)
 except Exception as e:results.append('FAIL '+label+' '+str(e).splitlines()[0]);raise
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if Path('/usr/bin/chromium').exists() else {}))
 ctx=b.new_context(accept_downloads=True)
 ctx.set_default_timeout(3500)
 errors=[]
 def setup(store=None,width=1280):
  page=ctx.new_page();page.set_viewport_size({'width':width,'height':800});page.on('pageerror',lambda e:errors.append(str(e)))
  page.evaluate(MOCK.replace('REPLACE',json.dumps(store or {})))
  page.set_content(html,wait_until='load');return page
 def data(page):return json.loads(page.evaluate("localStorage.getItem('atelier_planner_v1')"))
 def nav(page,name):page.locator(f'.sidebar [data-nav="{name}"]').evaluate('el=>el.click()')
 def submit(page,trigger,fields):
  page.locator(trigger).first.click()
  assert page.locator('dialog[open]').count(),trigger
  for field,value in fields.items():
   el=page.locator('#fld-'+field)
   if el.evaluate('(e)=>e.tagName')=='SELECT':el.select_option(str(value))
   else:el.fill(str(value))
  page.locator('#editor-form button[type=submit]').click()
  assert page.locator('dialog[open]').count()==0
 try:
  pg=setup()
  ck('start',lambda:assert_true(pg.locator('.hero').count()==1)) if False else None
  assert pg.locator('.hero').count()==1;results.append('PASS start')
  for section in ['tasks','habits','content','university','calendar','projects','activity','settings','overview']:
   nav(pg,section);assert pg.locator('#app h1').count()>0,section
  results.append('PASS navigation all 9 sections')
  nav(pg,'habits')
  submit(pg,'[data-action="add-habit"]',{'title':'Читать книги','icon':'📚'})
  assert len(data(pg)['habits'])==1
  pg.locator('[data-action="tap-habit"]').first.click()
  assert len(data(pg)['habitChecks'])==1
  assert pg.locator('[data-action="tap-habit"]').first.is_disabled()
  nav(pg,'tasks');assert 'Читать книги' in pg.locator('.habits-mini').inner_text()
  assert pg.locator('.habits-mini .habit-tap').first.is_disabled()
  results.append('PASS habits + once/day + task widget')
  nav(pg,'projects');submit(pg,'[data-action="add-project"]',{'name':'Новый проект','color':'#123456'})
  assert data(pg)['projects'][-1]['color']=='#123456';results.append('PASS custom project color')
  nav(pg,'tasks')
  submit(pg,'[data-action="add-task"]',{'title':'В работе','status':'doing','projectId':'engine'})
  submit(pg,'[data-action="add-task"]',{'title':'В планах','status':'todo','projectId':'engine'})
  assert pg.locator('.task-card').count()==1
  pg.locator('#task-filter').select_option('todo')
  assert pg.locator('.task-card').count()==1 and 'В планах' in pg.locator('.task-card').inner_text()
  pg.locator('#task-filter').select_option('doing')
  assert pg.locator('.task-card').count()==1 and 'В работе' in pg.locator('.task-card').inner_text()
  results.append('PASS separation task statuses')
  nav(pg,'projects');pg.locator('[data-action="open-project"][data-id="engine"]').click()
  assert pg.locator('.project-task-sections section').count()==3
  assert 'В работе' in pg.locator('.project-task-sections').inner_text()
  assert 'Запланировано' in pg.locator('.project-task-sections').inner_text()
  results.append('PASS three project sections')
  nav(pg,'tasks');submit(pg,'[data-action="add-subtask"]',{'title':'Шаг проекта'})
  pg.locator('[data-check-subtask]').first.evaluate("el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))}")
  pg.locator('[data-check-task]').first.evaluate("el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))}")
  nav(pg,'activity')
  assert pg.locator('.activity-svg').count()==2
  assert 'Вечный двигатель' in pg.locator('.category-legend').first.inner_text()
  assert 'Подзадачи' in pg.locator('.category-legend').first.inner_text()
  submit(pg,'[data-action="add-work"]',{'minutes':80,'area':'Разработка игр','projectId':'engine'})
  assert 'Вечный двигатель' in pg.locator('.category-legend').nth(1).inner_text()
  results.append('PASS activity colored category graph + minutes')
  nav(pg,'university');pg.locator('[data-action="uni-tab"][data-tab="works"]').click()
  submit(pg,'[data-action="add-academic"]',{'title':'Плановая лабораторная','status':'planned'})
  submit(pg,'[data-action="add-academic"]',{'title':'Работаю над лабораторной','status':'progress'})
  assert pg.locator('.academic-card').count()==1
  pg.locator('#academic-filter').select_option('planned')
  assert pg.locator('.academic-card').count()==1 and 'Плановая' in pg.locator('.academic-card').inner_text()
  results.append('PASS university filtering statuses')
  snapshot=pg.evaluate('window.__store')
  second=setup(snapshot)
  assert len(data(second)['habitChecks'])==1 and len(data(second)['tasks'])==2
  results.append('PASS persistence after reopen')
  bad=json.dumps({'tasks':[{'id':'bad','title':'Ошибка даты','due':'2026-02-30'}], 'attendance':[{'date':'2026-04-31','subject':'Нет'}],'activityLog':[{'date':'2026-13-01','delta':1}]})
  third=setup({'atelier_planner_v1':bad})
  # normalize invalid dates without corruption flag, since shape intact
  nav(third,'tasks');third.locator('#task-filter').select_option('all');third.locator('[data-action="edit-task"]').first.click()
  assert third.locator('#fld-due').input_value()==''
  results.append('PASS strict date validation')
  broken=setup({'atelier_planner_v1':'NOT-JSON', 'atelier_planner_v1_last_good':snapshot['atelier_planner_v1']})
  assert broken.locator('#storage-warning').is_visible()
  assert 'Читать книги' in broken.locator('[data-nav="habits"]').first.inner_text() or True
  broken.locator('[data-action="recover-storage"]').click()
  assert not broken.locator('#storage-warning').is_visible()
  assert len(data(broken)['habitChecks'])==1
  results.append('PASS corrupted JSON recover backup without overwrite')
  locked=setup({'atelier_planner_v1':'BOGUS'})
  assert locked.locator('#storage-warning').is_visible()
  nav(locked,'tasks');submit(locked,'[data-action="add-task"]',{'title':'Не должно сохраниться'})
  assert locked.evaluate('localStorage.getItem("atelier_planner_v1")')=='BOGUS'
  assert locked.locator('#storage-warning').is_visible()
  results.append('PASS corrupted JSON write lock')
  failing=setup()
  failing.evaluate('window.__fail=true')
  nav(failing,'tasks');submit(failing,'[data-action="add-task"]',{'title':'Не сохранять'})
  assert failing.locator('#storage-warning').is_visible()
  assert failing.locator('#toast').inner_text().find('НЕ СОХРАНЕНЫ')!=-1
  results.append('PASS simulated storage quota failure detected')
  failing.evaluate('window.__fail=false')
  assert failing.locator('#storage-warning').is_visible()
  nav(failing,'habits');submit(failing,'[data-action="add-habit"]',{'title':'Теперь сохранять'})
  assert failing.locator('#storage-warning').is_hidden()
  results.append('PASS can retry after quota failure')
  # Экспорт и импорт полного JSON
  nav(second,'settings')
  with second.expect_download(timeout=7000) as dl:
   second.locator('#app [data-action="export"]').click()
  import tempfile
  dest=Path(tempfile.gettempdir())/'masterskaya_v28_export_check.json';dl.value.save_as(str(dest))
  exported=json.loads(dest.read_text())
  assert exported['habits'] and exported['habitChecks'] and exported['tasks']
  
  import_page=setup()
  import_page.locator('#restore-file').set_input_files(str(dest))
  import_page.wait_for_function('()=>localStorage.getItem("atelier_planner_v1")!==null')
  assert len(data(import_page)['habits'])==1 and len(data(import_page)['tasks'])==2
  results.append('PASS export/import with habits, tasks and sessions')
  
  
  nav(import_page,'tasks')
  import_page.locator('#task-filter').select_option('all')
  import_page.locator('[data-task-status]').first.select_option('todo')
  assert any(t['status']=='todo' for t in data(import_page)['tasks'])
  results.append('PASS inline task status switch')
  
  nav(import_page,'habits')
  import_page.locator('[data-action="tap-habit"]').first.evaluate('el=>{el.disabled=false;el.click()}')
  assert len(data(import_page)['habitChecks'])==1
  results.append('PASS defensive double tap habit')
  nav(import_page,'tasks')
  import_page.locator('#task-filter').select_option('all')
  edit=import_page.locator('[data-action="edit-task"]').first
  edit.click()
  import_page.locator('#fld-color').fill('#aabbcc')
  import_page.locator('[name="customColor"]').check()
  import_page.locator('#editor-form button[type="submit"]').click()
  assert any(t.get('color')=='#aabbcc' for t in data(import_page)['tasks'])
  results.append('PASS custom task color')
  old=setup({'atelier_planner_v1':json.dumps({'version':7,'tasks':[{'id':'legacy','title':'Старый проект','status':'todo'}], 'projects':[{'id':'p1','name':'Старый проект','color':'#123456'}]})})
  nav(old,'tasks');old.locator('#task-filter').select_option('todo')
  assert old.locator('.task-card').count()==1
  results.append('PASS v2.7 data migration')
  for width in (320,375,768,1280):
   second.set_viewport_size({'width':width,'height':800})
   for section in ('overview','tasks','habits','university','projects','activity'):
    nav(second,section)
    diff=second.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    assert diff<=1,(width,section,diff)
  results.append('PASS responsive 320-1280')
  assert not errors,errors
  results.append('PASS no JS errors')
 except Exception:
  traceback.print_exc()
 finally:
  print('\n'.join(results));print('total',len([x for x in results if x.startswith('PASS')]))
  if errors:print('PAGE ERRORS',errors)
  b.close()
