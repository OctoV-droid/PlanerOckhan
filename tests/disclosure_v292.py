"""Визуальные и функциональные регрессии раскрывающихся карточек v2.9.2."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css?v=293">', '<style>'+ (ROOT/'style.css').read_text()+'</style>')
for filename in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):
    html=html.replace(f'<script src="{filename}?v=293" defer></script>','')
html=html.replace('</body>','\n'.join(f'<script>{(ROOT/name).read_text()}</script>' for name in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
seed={
    'version':9,
    'projects':[{'id':'p1','name':'Большой проект','color':'#abc789'}],
    'tasks':[
        {'id':f't{i}','title':f'Задача {i}: Длинное описание комплексной работы', 'projectId':'p1','status':'doing','priority':'normal',
         'subtasks':[{'id':f's{i}-{j}','title':f'Подзадача номер {j}: разработка чертежа в большой работе','done':False} for j in range(12)]}
        for i in range(3)
    ],
    'universitySubjects':[
        {'id':f'sub{i}','title': 'Железобетонные конструкции' if i==0 else 'Фундаменты и основания','teacher':'Преподаватель','due':'2027-01-01','notes':'Записи к предмету','sessionId':'','debt':False}
        for i in range(2)
    ],
    'academic':[
        {'id':f'w{i}-{j}','subjectId':f'sub{i}','subject':'Железобетонные конструкции' if i==0 else 'Фундаменты и основания',
         'title':f'Курсовая работа {j}', 'type':'course','status':'progress','priority':'normal',
         'subtasks':[{'id':f's{i}-{j}-{n}','title':f'Чертёж №{n}: подробное название шагов','done':False} for n in range(15)]}
        for i in range(2) for j in range(3)
    ]
}
mock='''window.__store=SEED;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.hasOwn(window.__store,k)?window.__store[k]:null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]},clear(){window.__store={}},get length(){return Object.keys(window.__store).length}}});window.alert=()=>{};window.confirm=()=>true;'''.replace('SEED',json.dumps({'atelier_planner_v1':json.dumps(seed,ensure_ascii=False)},ensure_ascii=False))

def height(page,selector):
    return page.locator(selector).first.evaluate('(e)=>e.getBoundingClientRect().height')

errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for w in (320,375,390,430,768,1280):
        ctx=browser.new_context(viewport={'width':w,'height':900},has_touch=w<=430,is_mobile=w<=430)
        pg=ctx.new_page()
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.evaluate(mock)
        pg.set_content(html,wait_until='domcontentloaded')
        pg.locator('[data-nav="tasks"]').first.click()
        assert pg.locator('.task-card').count()==3
        assert pg.locator('.subtasks-content:visible').count()==0, 'task steps initially open'
        assert pg.locator('[data-action="toggle-task-steps"]').count()==3
        closed=height(pg,'.task-card')
        assert closed<340, ('task not compact',w,closed)
        original=json.loads(pg.evaluate('localStorage.getItem("atelier_planner_v1")'))
        pg.locator('[data-action="toggle-task-steps"][data-id="t0"]').click()
        opened=height(pg,'[data-task-id="t0"]')
        assert opened>closed+160, ('expand did not increase height',w,closed,opened)
        assert pg.locator('[data-task-id="t1"] .subtasks-content').is_hidden()
        pg.locator('[data-task-id="t0"] [data-check-subtask]').first.check()
        assert pg.locator('[data-task-id="t0"] .subtasks-content').is_visible(),'step closed after checking'
        assert pg.locator('[data-task-id="t0"] [aria-expanded="true"]').count()==1
        assert json.loads(pg.evaluate('localStorage.getItem("atelier_planner_v1")'))['tasks'][0]['subtasks'][0]['done']
        pg.locator('[data-action="toggle-task-steps"][data-id="t0"]').click()
        assert pg.locator('[data-task-id="t0"] .subtasks-content').is_hidden()
        pg.locator('[data-nav="university"]').first.click()
        assert pg.locator('.uni-subject').count()==2 and pg.locator('.uni-work').count()==6
        assert pg.locator('.uni-work-extra:visible').count()==0
        assert pg.locator('.uni-subject-detail:visible').count()==0
        uni_compact=height(pg,'.uni-subject')
        assert uni_compact<950, ('subject too tall',w,uni_compact)
        pg.locator('[data-action="toggle-uni-subject"][data-id="sub0"]').click()
        assert pg.locator('[data-uni-subject-id="sub0"] .uni-subject-detail').is_visible()
        assert pg.locator('[data-uni-subject-id="sub0"] .uni-work').count()==3
        pg.locator('[data-action="toggle-uni-subject"][data-id="sub0"]').click()
        assert pg.locator('[data-uni-subject-id="sub0"] .uni-subject-detail').is_hidden()
        work='w0-1'
        pg.locator(f'[data-action="toggle-uni-work"][data-id="{work}"]').click()
        assert pg.locator(f'[data-uni-work-id="{work}"] .uni-step').count()==15
        assert pg.locator(f'[data-uni-work-id="{work}"] .uni-step').first.is_visible()
        assert pg.locator('[data-uni-work-id="w0-0"] .uni-work-extra').is_hidden()
        assert pg.locator('[data-uni-work-id="w1-0"] .uni-work-extra').is_hidden()
        pg.locator(f'[data-uni-work-id="{work}"] [data-uni-step]').first.check()
        assert pg.locator(f'[data-uni-work-id="{work}"] .uni-work-extra').is_visible(), 'university work closed after save'
        assert pg.locator('[data-uni-subject-id="sub0"] .uni-work').count()==3, 'lost works'
        assert pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),('horizontal scroll',w)
        assert not errors, errors
        print(f'PASS {w}px: task closed {closed:.0f}px -> {opened:.0f}px open; subject closed {uni_compact:.0f}px; independent toggles, persistence during update')
        if w==390:
            pg.locator(f'[data-action="toggle-uni-work"][data-id="{work}"]').click()
            pg.screenshot(path=str(ROOT/'tests/preview_mobile_v292.png'),full_page=False)
        ctx.close()
    browser.close()
print('PASS 6 responsive viewports and no JS errors')
