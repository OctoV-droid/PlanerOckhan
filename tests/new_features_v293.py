"""v2.9.3: Chromium browser checks with inlined app shell and mock storage."""
import json,threading,datetime,functools
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
TODAY=datetime.date.today().isoformat()
TEST_DAY='2026-10-15'
projects=[dict(id=f'p{i}',name=('Проект с достаточно длинным названием №'+str(i)),color=['#b8a2d1','#d5bd88','#91b9b0','#96accb'][i%4]) for i in range(8)]
subjects=[dict(id=f's{i}',title=f'Предмет {i} — ЖБК и фундаменты',teacher='Преподаватель',sessionId='',due='',debt=(i==0),notes='') for i in range(3)]
works=[dict(id=f'w{i}',title=f'Работа №{i} — Курсовой расчёт',subjectId='s0' if i<3 else 's1',subject='ЖБК',status='debt' if i==2 else 'progress',type='course',due='',priority='normal',subtasks=[dict(id=f'step{i}-{j}',title=f'Этап выполнения {j}',done=j==0) for j in range(4)]) for i in range(5)]
tasks=[]
for i in range(22):tasks.append(dict(id=f't{i}',title=f'Задача {i}',projectId=f'p{i%8}',status='done' if i%3==0 else 'doing',due=TEST_DAY if i%5==0 else '',subtasks=[]))
seed=dict(version=9,projects=projects,universitySubjects=subjects,academic=works,tasks=tasks,posts=[dict(id='post1',title='Публикация',channel='Telegram',date=TEST_DAY)],activityLog=[dict(id='a1',date=TEST_DAY,delta=1,kind='task',title='Завершение задачи',projectId='p1'),dict(id='a2',date=TEST_DAY,delta=1,kind='academic',title='Лабораторная'),dict(id='a3',date=TEST_DAY,delta=-1,kind='task',title='Вернул в работу')],workSessions=[dict(id='ws1',date=TEST_DAY,minutes=85,area='3D / Арт',projectId='p1',note='Тестовая работа')])
html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="style.css?v=293">',f'<style>{(ROOT/"style.css").read_text()}</style>')
for filename in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):
 html=html.replace(f'<script src="{filename}?v=293" defer></script>','')
html=html.replace('</body>','\n'.join(f'<script>{(ROOT/filename).read_text()}</script>' for filename in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
failures=[];checks=0
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def make(width):
  ctx=browser.new_context(viewport=dict(width=width,height=860),device_scale_factor=1)
  pg=ctx.new_page();pg.on('pageerror',lambda e:failures.append(str(e)))
  source={'atelier_planner_v1':json.dumps(seed,ensure_ascii=False)}
  pg.evaluate("window.__store="+json.dumps(source,ensure_ascii=False)+";Object.defineProperty(window,'localStorage',{value:{getItem(k){return window.__store[k]??null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]}} ,configurable:true});window.confirm=()=>true;")
  pg.set_content(html,wait_until='domcontentloaded')
  return ctx,pg
 def check(v,msg):
  global checks
  assert v,msg
  checks+=1
 def stored(pg):return json.loads(pg.evaluate("localStorage.getItem('atelier_planner_v1')"))
 ctx,pg=make(1280)
 try:
  pg.locator('[data-nav="university"]').first.click()
  work_titles=pg.locator('[data-uni-subject-id="s0"] .uni-work-title').all_inner_texts()
  check(len(work_titles)==3,'Work cards not shown')
  pg.locator('[data-action="move-uni-work"][data-id="w1"][data-direction="-1"]').click()
  check(pg.locator('[data-uni-subject-id="s0"] .uni-work').first.get_attribute('data-uni-work-id')=='w1','Work arrow up failed')
  check([x['id'] for x in stored(pg)['academic'][:3]]==['w1','w0','w2'],'Work order did not save')
  pg.locator('[data-action="move-uni-subject"][data-id="s1"][data-direction="-1"]').click()
  check(pg.locator('.uni-subject').first.get_attribute('data-uni-subject-id')=='s1','Subject arrow up failed')
  check([x['id'] for x in stored(pg)['universitySubjects']][:2]==['s1','s0'],'Subject order did not persist')
  # Native DnD using the handle, with explicit source and destination
  pg.locator('[data-uni-work-drag="w2"]').drag_to(pg.locator('[data-uni-work-id="w0"]'))
  check(stored(pg)['academic'].index(next(x for x in stored(pg)['academic'] if x['id']=='w2')) < stored(pg)['academic'].index(next(x for x in stored(pg)['academic'] if x['id']=='w0')),'Work drag and drop failed')
  pg.set_content(html,wait_until='domcontentloaded')
  check(pg.locator('[data-nav="university"]').count()>0,'Reload lost app')
  pg.locator('[data-nav="projects"]').first.click()
  check(pg.locator('.project-tile').count()==8,'Project tiles count')
  pg.locator('#project-sort').select_option('done')
  check(stored(pg)['projectSort']=='done','Project sort not saved')
  check(pg.locator('.project-tiles').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')>=3,'Desktop tiles not grid')
  pg.locator('[data-nav="calendar"]').first.click()
  check(pg.locator('.calendar-grid .calendar-day').count()==42,'Calendar missing 42 cells')
  pg.locator(f'[data-action="calendar-select-day"][data-day="{TEST_DAY}"]').click()
  check('Публикация' in pg.locator('.calendar-day-detail').inner_text(),'Calendar day detail empty')
  pg.locator('[data-nav="activity"]').first.click()
  pg.locator('#activity-day-picker').fill(TEST_DAY)
  check('Завершение задачи' in pg.locator('.activity-day-panel').inner_text(),'Activity details lack action')
  check('1 ч 25 мин' in pg.locator('.activity-day-panel').inner_text(),'Activity details lack recorded time')
  check(pg.locator('.activity-chart-scroll').count()==2,'Chart scroll wrappers missing')
  check(pg.locator('.activity-svg .activity-chart-bar').count()>=30,'Chart bar click targets missing')
  pg.locator('[data-action="activity-prev-day"]').click()
  check(pg.locator('#activity-day-picker').input_value()=='2026-10-14','Day navigation failed')
  pg.locator('[data-action="activity-next-day"]').click()
  check(pg.locator('#activity-day-picker').input_value()==TEST_DAY,'Day navigation forward failed')
  pg.locator('[data-action="activity-select-day"][data-day="2026-10-16"]').first.click()
  check(pg.locator('#activity-day-picker').input_value()=='2026-10-16','Clicking chart bar did not select day')
 finally:ctx.close()
 for width in (320,345,360,375,390,430,600,720,768,1024,1280,1440):
  ctx,pg=make(width)
  try:
   for nav in ('university','calendar','activity','projects'):
    pg.locator(f'[data-nav="{nav}"]').first.click()
    check(pg.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),f'{nav}: horizontal page overflow at {width}')
    if nav=='university':
     check(pg.locator('.uni-work-title').first.evaluate('(x)=>x.getBoundingClientRect().width')>90,f'university title squeezed at {width}')
     check(pg.locator('.uni-order-controls').first.is_visible(),f'uni arrows invisible {width}')
    if nav=='calendar':
     check(pg.locator('.calendar-day').count()==42,f'calendar not grid at {width}')
     check(pg.locator('.calendar-grid').evaluate('(x)=>getComputedStyle(x).gridTemplateColumns.split(" ").length')==7,f'calendar not seven columns at {width}')
     pg.locator('[data-action="calendar-select-day"][data-day="2026-10-15"]').click()
     check(pg.locator('.calendar-day-detail .agenda-row').count()>=1,f'calendar date not expandable {width}')
    if nav=='activity':
     check(pg.locator('.activity-day-stats').is_visible(),f'no day info {width}')
     check(pg.locator('.activity-svg').first.evaluate('(x)=>x.getBoundingClientRect().height')>90,f'chart invisible {width}')
    if nav=='projects':
     cols=pg.locator('.project-tiles').evaluate('(x)=>getComputedStyle(x).gridTemplateColumns.split(" ").length')
     if width>=360:check(cols>=2,f'projects should have multiple columns at {width}')
   if width==390:
    for nav in ('university','calendar','activity','projects'):
     pg.locator(f'[data-nav="{nav}"]').first.click()
     pg.screenshot(path=str(ROOT/'tests'/f'preview_{nav}_390.png'),full_page=True)
   print(f'PASS {width}px mobile/desktop: all four sections responsive')
  finally:ctx.close()
 check(not failures,f'JavaScript errors: {failures}')
 browser.close()

print('PASS',checks,'checks, isolated Chromium, no errors')
