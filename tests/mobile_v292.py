"""Regression for smartphone rendering of University works, version 2.9.1.
Run: python tests/mobile_v291.py (Chromium + Playwright required).
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
h=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="style.css?v=293">',f'<style>{(ROOT/"style.css").read_text()}</style>')
for fn in ('storage.js','analytics.js','habits.js','university.js','app.js','pwa.js'):
    h=h.replace(f'<script src="{fn}?v=293" defer></script>','')
h=h.replace('</body>','\n'.join(f'<script>{(ROOT/fn).read_text()}</script>' for fn in ('storage.js','analytics.js','habits.js','university.js','app.js'))+'</body>')
data={
    'version':9,
    'universitySessions':[{'id':'session','title':'Зимняя 26/27','start':'2026-12-01','end':'2027-01-31'}],
    'universitySubjects':[{'id':'subject','title':'Фундаменты и основания зданий','teacher':'Линовский','sessionId':'session','due':'2027-01-20','debt':False,'notes':''}],
    'academic':[{'id':'kr','subjectId':'subject','subject':'Фундаменты и основания зданий','teacher':'Линовский','sessionId':'session','title':'Курсовая работа №1 с длинным названием','type':'course','status':'progress','priority':'normal','due':'2027-01-15','subtasks':[{'id':str(i),'title':title,'done':False} for i,title in enumerate(('Расчёт конструкций для курсовой работы','Чертёж №1 Фундаменты','Чертёж №2 Общий план','Пояснительная записка к курсовой работе'))]}]
}
store={'atelier_planner_v1':json.dumps(data,ensure_ascii=False)}
mock='''window.__store=REPLACE;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.hasOwn(window.__store,k)?window.__store[k]:null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]},clear(){window.__store={}},get length(){return Object.keys(window.__store).length}}});window.confirm=()=>true;window.alert=()=>{};'''.replace('REPLACE',json.dumps(store,ensure_ascii=False))
checks=0
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (320,360,375,390,430,600,720,768,1024):
        ctx=browser.new_context(viewport={'width':width,'height':850},is_mobile=width<=720,has_touch=width<=720)
        page=ctx.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.evaluate(mock)
        page.set_content(h,wait_until='domcontentloaded')
        page.locator('[data-nav="university"]').first.click()
        assert page.locator('.uni-subject').count()==1 and page.locator('.uni-work').count()==1,(width,'work missing')
        assert not page.locator('.uni-work-extra').is_visible(),(width,'should start collapsed')
        assert page.locator('.uni-work-title').is_visible(),(width,'work title not visible in collapsed state')
        page.locator('[data-action="toggle-uni-work"]').first.click()
        m=page.evaluate('''() => {
          let rect=s=>{let r=document.querySelector(s).getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,right:r.right}};
          return { viewport:innerWidth, pageWidth:document.documentElement.scrollWidth,
            title:rect('.uni-work-title'), body:rect('.uni-work-body'),
            step:rect('.uni-step-label'), edit:rect('.uni-work-extra-controls'),
            editStep:rect('.uni-step>.study-buttons') };
        }''')
        assert m['pageWidth']<=width+2,(width,'horizontal scroll',m)
        assert m['body']['w']>145 and m['title']['w']>145,(width,'text squeezed',m)
        assert m['step']['w']>90,(width,'step squeezed',m)
        assert m['title']['h']<135 and m['step']['h']<135,(width,'letter by letter wrapping',m)
        assert m['edit']['right']<=width+1 and m['editStep']['right']<=width+1,(width,'controls offscreen',m)
        page.locator('.uni-step-label input[type=checkbox]').first.check()
        d=json.loads(page.evaluate('localStorage.getItem("atelier_planner_v1")'))
        assert d['academic'][0]['subtasks'][0]['done'],(width,'step did not save')
        page.locator('.uni-quick-form input[name=step]').fill('Сборка чертежей')
        page.locator('.uni-quick-form button').click()
        d=json.loads(page.evaluate('localStorage.getItem("atelier_planner_v1")'))
        assert len(d['academic'][0]['subtasks'])==5,(width,'new step did not save')
        page.locator('[data-action="edit-academic"]').first.click()
        assert page.locator('dialog[open]').count()==1,(width,'editor did not open')
        page.locator('[data-action="close-dialog"]').last.click()
        page.locator('[data-action="uni-tab"][data-tab="sessions"]').click()
        assert page.locator('.session-card').count()==1,(width,'sessions missing')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),(width,'sessions overflow')
        page.locator('[data-action="uni-tab"][data-tab="attendance"]').click()
        assert page.locator('.university-tabs').count()==1,(width,'attendance missing')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),(width,'attendance overflow')
        checks+=1
        print(f'PASS phone/tablet {width}px: readable text, no overflow, edit/check/add step, sessions, attendance')
        ctx.close()
    assert not errors,f'Uncaught JS errors: {errors}'
    browser.close()
print(f'PASS {checks} widths, 9 assertions groups each; no JavaScript errors')
