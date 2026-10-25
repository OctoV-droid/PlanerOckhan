/* МАСТЕРСКАЯ v2.1 — университет, задачи и публикации.
   Данные хранятся ТОЛЬКО в localStorage этого браузера.
   Ни токенов GitHub, ни секретов, ни запросов к внешним сервисам. */
(() => {
  'use strict';
  const STORAGE_KEY = 'atelier_planner_v1';
  const CHANNELS = ['Telegram', 'Instagram', 'YouTube Shorts', 'ВКонтакте', 'ArtStation'];
  const CHANNEL_SHORT = {'Telegram':'TG','Instagram':'IG','YouTube Shorts':'YT','ВКонтакте':'VK','ArtStation':'ART'};
  const FORMATS = ['Пост', 'Reels / Short', 'Карусель', 'История', 'Видео', 'Кейс'];
  const STAGES = {idea:'Идея', draft:'В работе', ready:'Готово к публикации', published:'Опубликовано'};
  const TASK_STATES = {todo:'Запланировано',doing:'В работе',done:'Выполнено'};
  const STUDY_STATES = {planned:'В планах',learning:'Изучаю',practice:'Практикую',done:'Освоено'};
  const STUDY_AREAS = ['3D и материалы','Unity и GameDev','Digital Art','Веб-дизайн','ПГС и чертежи','Другое'];
  const PRIORITIES = {low:'Не спешит',normal:'Обычная',high:'Важная'};
  const ACADEMIC_TYPES = {lab:'Лабораторная',practice:'Практическая',course:'Курсовая',control:'Контрольная',report:'Отчёт по практике',credit:'Зачёт',dcredit:'Дифференцированный зачёт',exam:'Экзамен',other:'Другое'};
  const ACADEMIC_STATUSES = {planned:'Не начато',progress:'В работе',ready:'Готово к сдаче',submitted:'Сдано / ожидаю оценки',passed:'Зачтено / закрыто',debt:'Долг'};
  const ACADEMIC_DONE = new Set(['passed']);
  const ACADEMIC_EXAMS = new Set(['credit','dcredit','exam']);
  const COLORS = ['#b8a2d1','#d5bd88','#91b9b0','#96accb','#ce998c','#c0c5a1'];
  const defaultData = () => ({
    version:3,
    projects:[
      {id:'tif',name:'TIF / Новониколаевск',color:'#a5a5b8'},
      {id:'engine',name:'Вечный двигатель',color:'#c9a681'},
      {id:'portfolio',name:'Портфолио и развитие',color:'#92baa8'},
      {id:'personal',name:'Личное творчество',color:'#b59acc'}
    ],
    tasks:[], posts:[], study:[], academic:[], universitySessions:[],
    goals:{'Telegram':4,'Instagram':3,'YouTube Shorts':2,'ВКонтакте':1,'ArtStation':1}
  });
  const app = document.querySelector('#app');
  const editor = document.querySelector('#editor');
  const form = document.querySelector('#editor-form');
  const toastEl = document.querySelector('#toast');
  const data = loadData();
  let page = 'overview';
  let taskFilter = 'active';
  let academicFilter = 'active';
  let academicSubjectFilter = 'all';
  let query = '';
  let selectedMonth = new Date(); selectedMonth.setDate(1);
  let editMode = {type:'task',id:null};
  let toastTimer;

  function clone(x){return JSON.parse(JSON.stringify(x));}
  function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function safeId(){return typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function today(){return iso(new Date());}
  function shiftDate(d,days){let x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+days);return x;}
  function prettyDate(s,withYear=false){if(!s)return 'Без даты';let d=new Date(`${s}T12:00:00`);if(Number.isNaN(d.getTime()))return s;return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',...(withYear?{year:'numeric'}:{})});}
  function hasDate(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());}
  function monthOf(s){return hasDate(s)?s.slice(0,7):'';}
  function n(v){return Number.isFinite(+v)?+v:0;}
  function validUrl(s){try {const u=new URL(s);return ['https:','http:'].includes(u.protocol);} catch{return false;}}
  function project(id){return data.projects.find(x=>x.id===id);}
  function projectLabel(id){return project(id)?.name ?? 'Без проекта';}
  function projectTag(id){const p=project(id);return p?`<span class="tag"><span class="project-color" style="width:7px;height:7px;background:${p.color}"></span>${escapeHtml(p.name)}</span>`:'';}
  function toast(text){toastEl.textContent=text;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3000);}
  function loadData(){
    try{const str=localStorage.getItem(STORAGE_KEY);if(!str)return defaultData();return normalize(JSON.parse(str));}
    catch(e){console.warn('Не удалось прочитать данные:',e);return defaultData();}
  }
  function normalize(raw){
    const d=defaultData(); if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('Некорректный файл');
    if(Array.isArray(raw.projects))d.projects=raw.projects.slice(0,200).filter(p=>p && typeof p.name==='string').map(p=>({id:String(p.id||safeId()).slice(0,90),name:p.name.slice(0,90),color:COLORS.includes(p.color)||/^#[0-9a-fA-F]{6}$/.test(p.color||'')?p.color:'#b8a2d1'}));
    if(Array.isArray(raw.tasks))d.tasks=raw.tasks.slice(0,5000).filter(t=>t&&typeof t.title==='string').map(t=>({id:String(t.id||safeId()).slice(0,90),title:t.title.slice(0,300),projectId:String(t.projectId||''),due:hasDate(t.due)?t.due:'',priority:PRIORITIES[t.priority]?t.priority:'normal',status:TASK_STATES[t.status]?t.status:'todo',notes:String(t.notes||'').slice(0,10000)}));
    if(Array.isArray(raw.posts))d.posts=raw.posts.slice(0,5000).filter(p=>p&&typeof p.title==='string').map(p=>({id:String(p.id||safeId()).slice(0,90),title:p.title.slice(0,300),channel:CHANNELS.includes(p.channel)?p.channel:'Telegram',format:FORMATS.includes(p.format)?p.format:'Пост',projectId:String(p.projectId||''),date:hasDate(p.date)?p.date:'',status:STAGES[p.status]?p.status:'idea',notes:String(p.notes||'').slice(0,10000),link:validUrl(p.link)?p.link:''}));
    if(Array.isArray(raw.study))d.study=raw.study.slice(0,1000).filter(x=>x&&typeof x.title==='string').map(x=>({
      id:String(x.id||safeId()).slice(0,90),title:x.title.slice(0,300),area:STUDY_AREAS.includes(x.area)?x.area:'Другое',
      projectId:String(x.projectId||''),status:STUDY_STATES[x.status]?x.status:'planned',progress:Math.max(0,Math.min(100,Math.floor(n(x.progress)))),
      due:hasDate(x.due)?x.due:'',nextStep:String(x.nextStep||'').slice(0,500),notes:String(x.notes||'').slice(0,10000),
      sessions:Array.isArray(x.sessions)?x.sessions.slice(0,2000).filter(v=>v&&typeof v==='object').map(v=>({
        id:String(v.id||safeId()).slice(0,90),date:hasDate(v.date)?v.date:today(),minutes:Math.max(1,Math.min(1440,Math.floor(n(v.minutes)||1))),note:String(v.note||'').slice(0,1000)
      })):[]
    }));
    // Сохраняем архив самообучения v2 отдельно, не превращая темы Blender в дисциплины университета.
    if(Array.isArray(raw.universitySessions))d.universitySessions=raw.universitySessions.slice(0,200).filter(x=>x&&typeof x.title==='string').map(x=>({
      id:String(x.id||safeId()).slice(0,90),title:x.title.slice(0,120),start:hasDate(x.start)?x.start:'',end:hasDate(x.end)?x.end:'',notes:String(x.notes||'').slice(0,10000)
    }));
    if(Array.isArray(raw.academic))d.academic=raw.academic.slice(0,5000).filter(x=>x&&typeof x.title==='string').map(x=>({
      id:String(x.id||safeId()).slice(0,90),title:x.title.slice(0,300),subject:String(x.subject||'').slice(0,160),
      type:ACADEMIC_TYPES[x.type]?x.type:'other',status:ACADEMIC_STATUSES[x.status]?x.status:'planned',
      due:hasDate(x.due)?x.due:'',priority:PRIORITIES[x.priority]?x.priority:'normal',sessionId:String(x.sessionId||'').slice(0,90),
      teacher:String(x.teacher||'').slice(0,160),nextStep:String(x.nextStep||'').slice(0,500),notes:String(x.notes||'').slice(0,10000)
    }));
    if(raw.goals&&typeof raw.goals==='object')CHANNELS.forEach(c=>d.goals[c]=Math.max(0,Math.min(100,Math.floor(n(raw.goals[c]??d.goals[c])))));
    return d;
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){console.error(e);alert('Не удалось сохранить данные. Возможно, в браузере переполнено хранилище. Сделай резервную копию.');}}
  function stat(){const m=today().slice(0,7);return {open:data.tasks.filter(x=>x.status!=='done').length,done:data.tasks.filter(x=>x.status==='done').length,planned:data.posts.filter(x=>x.status!=='published'&&x.date&&x.date>=today()&&x.date<=iso(shiftDate(new Date(),7))).length,published:data.posts.filter(x=>x.status==='published'&&monthOf(x.date)===m).length,academicDue:data.academic.filter(x=>!ACADEMIC_DONE.has(x.status)&&(x.status==='debt'||(x.due&&x.due<today()))).length};}
  function shellTitle(){return {overview:'Обзор',tasks:'Задачи',content:'Публикации',university:'ВУЗ',calendar:'Календарь',projects:'Проекты',settings:'Настройки'}[page];}
  function render(){document.querySelector('#crumb-title').textContent=shellTitle();document.querySelector('#today-label').textContent=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});document.querySelector('#footer-year').textContent=new Date().getFullYear();document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));app.innerHTML=({overview:renderOverview,tasks:renderTasks,content:renderContent,university:renderUniversity,calendar:renderCalendar,projects:renderProjects,settings:renderSettings}[page])();}
  function heading(label,title,subtitle,actions=''){return `<div class="section-heading"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${subtitle}</p></div>${actions?`<div class="actions-inline">${actions}</div>`:''}</div>`;}
  function taskRow(t,compact=false){const overdue=t.status!=='done'&&t.due&&t.due<today();const due=t.due?`<span class="${overdue?'pill overdue':''}">${overdue?'Просрочено · ':''}${prettyDate(t.due)}</span>`:'Без срока';
    return compact?`<div class="list-row"><input type="checkbox" class="check" aria-label="Выполнено: ${escapeHtml(t.title)}" data-check-task="${escapeHtml(t.id)}" ${t.status==='done'?'checked':''}><div class="row-main"><div class="row-title" style="${t.status==='done'?'text-decoration:line-through;opacity:.65':''}">${escapeHtml(t.title)}</div><div class="row-sub">${escapeHtml(projectLabel(t.projectId))} · ${due}</div></div><button class="icon-btn" data-action="edit-task" data-id="${escapeHtml(t.id)}" title="Редактировать">✎</button></div>`:
    `<div class="task-card ${t.status==='done'?'done':''}"><input type="checkbox" class="check" aria-label="Выполнено: ${escapeHtml(t.title)}" data-check-task="${escapeHtml(t.id)}" ${t.status==='done'?'checked':''}><div class="task-wrap"><div class="row-main"><div class="row-title">${escapeHtml(t.title)}</div><div class="meta-stack">${projectTag(t.projectId)}<span class="tag ${t.priority==='high'?'important':''}">${PRIORITIES[t.priority]}</span><span class="tag">${TASK_STATES[t.status]}</span><span class="${overdue?'pill overdue':'row-sub'}">${due}</span></div>${t.notes?`<div class="row-sub">${escapeHtml(t.notes).slice(0,210)}</div>`:''}</div><div class="task-actions"><button class="icon-btn" data-action="edit-task" data-id="${escapeHtml(t.id)}" title="Редактировать">✎</button><button class="icon-btn" data-action="delete-task" data-id="${escapeHtml(t.id)}" title="Удалить">✕</button></div></div></div>`;
  }
  function socialGoals(){const m=today().slice(0,7);return CHANNELS.map(ch=>{const done=data.posts.filter(p=>p.channel===ch&&p.status==='published'&&monthOf(p.date)===m).length,goal=data.goals[ch]||0;return `<div class="social-row"><div class="social-meta"><strong>${escapeHtml(ch)}</strong><span>${done} / ${goal||'без цели'}</span></div><div class="progress"><span style="width:${goal?Math.min(100,Math.round(done/goal*100)):0}%"></span></div></div>`;}).join('');}
  function renderOverview(){const s=stat();const openTasks=data.tasks.filter(x=>x.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,5);const upcoming=data.posts.filter(x=>x.status!=='published').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice(0,5);
    return `<div class="hero"><div><div class="eyebrow">ТВОЯ ТВОРЧЕСКАЯ МАСТЕРСКАЯ</div><h1>Идеи, проекты и публикации.<br>Без лишнего шума.</h1><p>Планируй работу, сохраняй идеи и отмечай результат. Не нужно делать всё сразу: достаточно понимать следующий шаг.</p><button class="btn btn-accent" data-action="add-post">+ Запланировать публикацию</button></div><div class="hero-stat"><strong>${s.open}</strong><span>открытых задач</span></div></div>
    <div class="stats-grid"><div class="stat-card"><div class="stat-icon">☑</div><div class="stat-value">${s.open}</div><div class="stat-label">Дел в работе и планах</div></div><div class="stat-card"><div class="stat-icon">▤</div><div class="stat-value">${s.planned}</div><div class="stat-label">Постов в ближайшие 7 дней</div></div><div class="stat-card"><div class="stat-icon">↗</div><div class="stat-value">${s.published}</div><div class="stat-label">Опубликовано за месяц</div></div><div class="stat-card"><div class="stat-icon">▥</div><div class="stat-value">${s.academicDue}</div><div class="stat-label">Долгов и просроченных сдач</div></div></div>
    <div class="main-grid"><div><div class="panel"><div class="panel-title"><h2>Ближайшие задачи</h2><button class="text-button" data-nav="tasks">Все задачи ↗</button></div>${openTasks.length?openTasks.map(t=>taskRow(t,true)).join(''):'<div class="empty"><span class="empty-icon">✳</span>Задач пока нет. Добавь первый шаг по проекту.</div>'}</div>
    <div class="panel"><div class="panel-title"><h2>В очереди на публикацию</h2><button class="text-button" data-nav="content">Контент-план ↗</button></div>${upcoming.length?upcoming.map(p=>`<div class="list-row"><div class="row-main"><div class="row-title">${escapeHtml(p.title)}</div><div class="row-sub">${escapeHtml(p.channel)} · ${STAGES[p.status]} · ${prettyDate(p.date)}</div></div><button class="icon-btn" data-action="edit-post" data-id="${escapeHtml(p.id)}" title="Редактировать">✎</button></div>`).join(''):'<div class="empty"><span class="empty-icon">▦</span>Идей для публикаций ещё нет.</div>'}</div></div>
    <div><div class="panel"><div class="panel-title"><h2>Публикации в этом месяце</h2><button class="text-button" data-nav="settings">Изменить цели ↗</button></div>${socialGoals()}<div class="subnote">Считаются посты со статусом «Опубликовано» и датой этого месяца.</div></div><div class="panel"><div class="panel-title"><h2>ВУЗ · ближайшие сдачи</h2><button class="text-button" data-nav="university">Все работы ↗</button></div>${[...data.academic].filter(x=>x.status!=='passed').sort((a,b)=>Number(b.status==='debt')-Number(a.status==='debt')||(a.due||'9999').localeCompare(b.due||'9999')).slice(0,4).map(x=>`<div class="list-row"><div class="row-main"><div class="row-title">${escapeHtml(x.title)}</div><div class="row-sub">${escapeHtml(x.subject||'Без дисциплины')} · ${ACADEMIC_STATUSES[x.status]} · ${prettyDate(x.due)}</div></div><button class="icon-btn" data-action="edit-academic" data-id="${escapeHtml(x.id)}" title="Редактировать">✎</button></div>`).join('')||'<div class="empty">Зачёты, курсовые и долги пока не добавлены.</div>'}<button class="text-button" data-action="add-academic" style="margin-top:10px">+ Добавить работу</button></div><div class="panel"><div class="panel-title"><h2>Небольшое напоминание</h2></div><p style="color:var(--muted);font-size:13px">Можно использовать один рабочий материал для разных площадок: короткое видео в Instagram и Shorts, подробный рассказ в Telegram, законченный кейс на ArtStation.</p><button class="text-button" data-action="add-post" style="margin-top:15px">Записать идею ↗</button></div></div></div>`;
  }
  function renderTasks(){let list=data.tasks.filter(t=>taskFilter==='all'||(taskFilter==='active'?t.status!=='done':t.status==='done'));if(query)list=list.filter(t=>[t.title,t.notes,projectLabel(t.projectId)].join(' ').toLowerCase().includes(query.toLowerCase()));list.sort((a,b)=>{if(a.status==='done'&&b.status!=='done')return 1;if(b.status==='done'&&a.status!=='done')return -1;return(a.due||'9999').localeCompare(b.due||'9999')});
    return `${heading('ПРОЕКТЫ И ПОВСЕДНЕВНОСТЬ','Задачи','Делай задачи достаточно маленькими, чтобы было понятно, с чего начать.','<button class="btn btn-accent" data-action="add-task">+ Добавить задачу</button>')}<div class="toolbar"><select id="task-filter" aria-label="Фильтр задач"><option value="active" ${taskFilter==='active'?'selected':''}>Активные</option><option value="all" ${taskFilter==='all'?'selected':''}>Все задачи</option><option value="done" ${taskFilter==='done'?'selected':''}>Выполненные</option></select><input class="grow" id="task-search" placeholder="Поиск по задачам" value="${escapeHtml(query)}" aria-label="Поиск по задачам"><span style="color:var(--muted);font-size:12px">Найдено: ${list.length}</span></div>${list.length?list.map(t=>taskRow(t)).join(''):'<div class="empty">В этом списке пока ничего нет. Начать можно с одной небольшой задачи.</div>'}`;}
  function renderContent(){return `${heading('КОНТЕНТ-КАЛЕНДАРЬ','Публикации','Перетаскивать карточки не требуется: меняй стадию внизу каждого поста. Сюда можно складывать даже сырые идеи.','<button class="btn btn-accent" data-action="add-post">+ Новая публикация</button>')}<div class="kanban">${Object.entries(STAGES).map(([stage,label])=>{const list=data.posts.filter(p=>p.status===stage).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));return `<section class="lane"><div class="lane-header"><h3>${label}</h3><span>${list.length}</span></div>${list.map(p=>`<article class="post-card"><div class="post-channel">${escapeHtml(p.channel)} · ${escapeHtml(p.format)}</div><div class="post-title">${escapeHtml(p.title)}</div><div class="post-sub">${prettyDate(p.date)} · ${escapeHtml(projectLabel(p.projectId))}</div>${p.notes?`<div class="post-note">${escapeHtml(p.notes)}</div>`:''}${p.link?`<div style="margin-top:7px"><a href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer" style="font-size:11px">Открыть публикацию ↗</a></div>`:''}<div class="post-controls"><select data-post-stage="${escapeHtml(p.id)}" aria-label="Статус поста ${escapeHtml(p.title)}">${Object.entries(STAGES).map(([v,l])=>`<option value="${v}" ${stage===v?'selected':''}>${l}</option>`).join('')}</select><button class="icon-btn" data-action="edit-post" data-id="${escapeHtml(p.id)}" title="Изменить">✎</button><button class="icon-btn" data-action="copy-post" data-id="${escapeHtml(p.id)}" title="Создать копию">⧉</button><button class="icon-btn" data-action="delete-post" data-id="${escapeHtml(p.id)}" title="Удалить">✕</button></div></article>`).join('')||'<div style="font-size:12px;color:#758293;text-align:center;padding:18px 5px">Пока пусто</div>'}</section>`;}).join('')}</div>`;}
  function studyMinutes(x){return (x.sessions||[]).reduce((sum,y)=>sum+n(y.minutes),0);}
  function lessonsWord(v){const a=v%100,b=v%10;return a>=11&&a<=14?'занятий':b===1?'занятие':b>=2&&b<=4?'занятия':'занятий';}
  function formatMinutes(v){const h=Math.floor(v/60),m=v%60;return [h?`${h} ч`:'',m?`${m} мин`:''].filter(Boolean).join(' ')||'0 мин';}
  function universitySessionLabel(id){return data.universitySessions.find(x=>x.id===id)?.title||'Без сессии';}
  function academicOverdue(x){return x.status!=='passed'&&Boolean(x.due)&&x.due<today();}
  function academicCard(x){
    const overdue=academicOverdue(x),isDebt=x.status==='debt';
    const related=x.sessionId?` · ${escapeHtml(universitySessionLabel(x.sessionId))}`:'';
    return `<article class="academic-card ${isDebt?'academic-debt':''}">
      <div class="academic-card-head"><span class="tag">${ACADEMIC_TYPES[x.type]}</span><span class="pill ${x.status==='passed'?'done':isDebt||overdue?'overdue':''}">${ACADEMIC_STATUSES[x.status]}</span></div>
      <h2 class="academic-title">${escapeHtml(x.title)}</h2>
      <p class="academic-sub">${escapeHtml(x.subject||'Дисциплина не указана')}${related}</p>
      <div class="academic-meta"><span>${x.due?`<b class="${overdue?'urgent':''}">${overdue?'Просрочено: ':'Сдать до: '}${prettyDate(x.due,true)}</b>`:'Без дедлайна'}</span><span>${PRIORITIES[x.priority]}</span>${x.teacher?`<span>Преподаватель: ${escapeHtml(x.teacher)}</span>`:''}</div>
      ${x.nextStep?`<div class="study-next"><b>Следующий шаг:</b> ${escapeHtml(x.nextStep)}</div>`:''}
      ${x.notes?`<div class="academic-notes">${escapeHtml(x.notes)}</div>`:''}
      <div class="academic-bottom"><select data-academic-status="${escapeHtml(x.id)}" aria-label="Статус: ${escapeHtml(x.title)}">${optionList(ACADEMIC_STATUSES,x.status)}</select><div class="study-buttons"><button class="icon-btn" data-action="edit-academic" data-id="${escapeHtml(x.id)}" aria-label="Редактировать работу">✎</button><button class="icon-btn" data-action="delete-academic" data-id="${escapeHtml(x.id)}" aria-label="Удалить работу">✕</button></div></div>
    </article>`;
  }
  function renderUniversity(){
    const total=data.academic.length;
    const debts=data.academic.filter(x=>x.status==='debt').length;
    const overdue=data.academic.filter(x=>academicOverdue(x)&&x.status!=='debt').length;
    const upcoming=data.academic.filter(x=>x.status!=='passed'&&x.due&&x.due>=today()&&x.due<=iso(shiftDate(new Date(),14))).length;
    const passed=data.academic.filter(x=>x.status==='passed').length;
    const filtered=[...data.academic].filter(x=>(academicSubjectFilter==='all'||x.subject===academicSubjectFilter)&&(academicFilter==='all'||(academicFilter==='active'?x.status!=='passed':academicFilter==='passed'?x.status==='passed':academicFilter==='debt'?x.status==='debt'||academicOverdue(x):ACADEMIC_EXAMS.has(x.type))));
    filtered.sort((a,b)=>Number(b.status==='debt')-Number(a.status==='debt')||Number(academicOverdue(b))-Number(academicOverdue(a))||(a.due||'9999').localeCompare(b.due||'9999'));
    const sessions=[...data.universitySessions].sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999'));
    const subjects=[...new Set(data.academic.map(x=>x.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    return `${heading('УНИВЕРСИТЕТ И СЕССИИ','ВУЗ','Учебные дисциплины, долги, курсовые, зачёты, экзамены и сроки сдачи.','<button class="btn btn-accent" data-action="add-academic">+ Добавить работу</button><button class="btn" data-action="add-session">+ Сессия</button>')}
      <div class="study-summary"><div class="stat-card"><div class="stat-icon">!</div><div class="stat-value">${debts}</div><div class="stat-label">Учебных долгов</div></div><div class="stat-card"><div class="stat-icon">◷</div><div class="stat-value">${overdue}</div><div class="stat-label">Просрочено без статуса «Долг»</div></div><div class="stat-card"><div class="stat-icon">▤</div><div class="stat-value">${upcoming}</div><div class="stat-label">Сдач в ближайшие 14 дней</div></div><div class="stat-card"><div class="stat-icon">✓</div><div class="stat-value">${passed} / ${total}</div><div class="stat-label">Закрыто работ</div></div></div>
      <div class="panel"><div class="panel-title"><h2>Сессии и экзаменационные периоды</h2><button class="text-button" data-action="add-session">+ Добавить период</button></div>
      <div class="session-grid">${sessions.map(x=>`<div class="session-card"><div><h3>${escapeHtml(x.title)}</h3><p>${x.start?prettyDate(x.start,true):'Дата начала не задана'}${x.end?' — '+prettyDate(x.end,true):''}</p><span>${data.academic.filter(a=>a.sessionId===x.id).length} работ привязано</span>${x.notes?`<p>${escapeHtml(x.notes)}</p>`:''}</div><div class="study-buttons"><button class="icon-btn" data-action="edit-session" data-id="${escapeHtml(x.id)}" aria-label="Редактировать сессию">✎</button><button class="icon-btn" data-action="delete-session" data-id="${escapeHtml(x.id)}" aria-label="Удалить сессию">✕</button></div></div>`).join('')||'<div class="row-sub">Добавь, например, зимнюю сессию и диапазон дат. Сдачи и экзамены появятся ниже отдельными карточками.</div>'}</div></div>
      <div class="panel-title academic-list-header"><h2>Работы и аттестации</h2><span>${filtered.length} записей</span></div>
      <div class="toolbar"><select id="academic-filter" aria-label="Фильтр учебных работ"><option value="active" ${academicFilter==='active'?'selected':''}>Незакрытые</option><option value="debt" ${academicFilter==='debt'?'selected':''}>Долги и просроченное</option><option value="exams" ${academicFilter==='exams'?'selected':''}>Зачёты и экзамены</option><option value="passed" ${academicFilter==='passed'?'selected':''}>Закрытые</option><option value="all" ${academicFilter==='all'?'selected':''}>Все</option></select><select id="academic-subject-filter" aria-label="Фильтр по дисциплинам"><option value="all">Все дисциплины</option>${subjects.map(subject=>`<option value="${escapeHtml(subject)}" ${academicSubjectFilter===subject?'selected':''}>${escapeHtml(subject)}</option>`).join('')}</select><button class="btn btn-small" data-action="add-academic">+ Новая работа</button></div>
      <div class="study-grid">${filtered.map(academicCard).join('')||'<div class="empty">В этом списке пока нет записей. Добавь первую дисциплину и работу со сроком.</div>'}</div>
      <div class="panel study-hint"><div class="panel-title"><h2>Как вести университетские дела</h2></div><p>Один зачёт, экзамен, курсовая или лабораторная = одна карточка. Дисциплина может повторяться в нескольких карточках. Когда работу приняли, поставь «Зачтено / закрыто». Долги помечай отдельным статусом, даже если срок уже прошёл.</p></div>`;
  }
  function renderCalendar(){
    const first=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth(),1),start=shiftDate(first,-(first.getDay()+6)%7),ym=iso(first).slice(0,7);
    const monthName=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
    const markers=[];
    for(const x of data.posts)if(x.date)markers.push({date:x.date,text:`Публикация · ${x.channel} · ${x.title}`,short:`${CHANNEL_SHORT[x.channel]} · ${x.title}`,type:'post',done:x.status==='published'});
    for(const x of data.tasks)if(x.due)markers.push({date:x.due,text:`Задача · ${x.title}`,short:`✓ ${x.title}`,type:'task',done:x.status==='done'});
    for(const x of data.academic)if(x.due)markers.push({date:x.due,text:`ВУЗ · ${x.subject?x.subject+' · ':''}${x.title}`,short:`▥ ${x.title}`,type:'academic',done:x.status==='passed'});
    for(const x of data.universitySessions){if(x.start)markers.push({date:x.start,text:`Начало сессии · ${x.title}`,short:`▥ ${x.title}`,type:'session',done:false});if(x.end)markers.push({date:x.end,text:`Конец сессии · ${x.title}`,short:`▥ ${x.title}`,type:'session',done:false});}
    let days='';
    for(let i=0;i<42;i++){const d=shiftDate(start,i),ds=iso(d),month=d.getMonth()===first.getMonth();const items=markers.filter(x=>x.date===ds);days+=`<div class="calendar-day ${month?'':'muted'} ${ds===today()?'today':''}"><div class="calendar-date">${d.getDate()}</div>${items.slice(0,5).map(x=>`<span class="calendar-item ${x.type} ${x.done?'done':''}" title="${escapeHtml(x.text)}">${escapeHtml(x.short)}</span>`).join('')}${items.length>5?`<small style="color:#9ca6b7">ещё ${items.length-5}</small>`:''}</div>`;}
    const agenda=markers.filter(x=>monthOf(x.date)===ym).sort((a,b)=>a.date.localeCompare(b.date));
    return `${heading('РАСПИСАНИЕ','Календарь','Публикации, задачи, дедлайны по вузу и границы сессий в одном месте.','<button class="btn btn-accent" data-action="add-academic">+ Сдача в вузе</button>')}<div class="panel"><div class="calendar-top"><h2>${escapeHtml(monthName)}</h2><div class="calendar-controls"><button class="btn btn-small" data-action="prev-month" aria-label="Предыдущий месяц">←</button><button class="btn btn-small" data-action="current-month">Сегодня</button><button class="btn btn-small" data-action="next-month" aria-label="Следующий месяц">→</button></div></div><div class="calendar-desktop"><div class="calendar-head">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${days}</div></div><div class="calendar-mobile">${agenda.map(x=>`<div class="agenda-row"><span class="agenda-date">${prettyDate(x.date)}</span><span class="agenda-type ${x.type}">${x.type==='post'?'▤':x.type==='academic'||x.type==='session'?'▥':'☑'}</span><span class="agenda-text">${escapeHtml(x.text)}</span></div>`).join('')||'<div class="empty">На этот месяц ничего не запланировано.</div>'}</div><div class="subnote" style="margin-top:15px">Горчичный = публикации · Голубой = задачи · Фиолетовый = вуз и сессии. На телефоне отображается список событий.</div></div>`;
  }
  function renderProjects(){return `${heading('КАРТА ТВОРЧЕСТВА','Проекты','Здесь собраны направления работы. У каждой задачи и публикации может быть свой проект.','<button class="btn btn-accent" data-action="add-project">+ Новый проект</button>')}<div class="project-grid">${data.projects.map(p=>{const tasks=data.tasks.filter(t=>t.projectId===p.id),posts=data.posts.filter(t=>t.projectId===p.id);return `<div class="project-card"><div class="project-heading"><h2><span class="project-color" style="background:${p.color}"></span>${escapeHtml(p.name)}</h2><button class="icon-btn" data-action="edit-project" data-id="${escapeHtml(p.id)}" title="Переименовать">✎</button></div><p style="font-size:12px;color:var(--muted)">Задачи, материалы и публикации этого направления.</p><div class="project-counts"><span>${tasks.filter(t=>t.status!=='done').length} активных задач</span><span>${posts.length} публикаций</span></div><div class="actions-inline" style="margin-top:15px"><button class="btn btn-small" data-action="add-task" data-project="${escapeHtml(p.id)}">+ Задача</button><button class="btn btn-small" data-action="add-post" data-project="${escapeHtml(p.id)}">+ Пост</button><button class="btn btn-small btn-danger" data-action="delete-project" data-id="${escapeHtml(p.id)}">Удалить</button></div></div>`;}).join('')}</div>`;}
  function renderSettings(){return `${heading('ЛИЧНЫЕ НАСТРОЙКИ','Цели и резервная копия','Цели нужны как ориентир, а не как повод ругать себя за пропущенную неделю.')}<div class="settings-grid"><div class="panel"><div class="panel-title"><h2>Месячные цели по публикациям</h2></div><form id="goals-form">${CHANNELS.map(c=>`<label class="field-row"><span>${escapeHtml(c)}</span><input type="number" name="${escapeHtml(c)}" min="0" max="100" step="1" value="${n(data.goals[c])}" aria-label="Цель для ${escapeHtml(c)}"></label>`).join('')}<button type="submit" class="btn btn-accent" style="margin-top:19px">Сохранить цели</button></form></div><div class="panel"><div class="panel-title"><h2>Данные и перенос</h2></div><p style="color:var(--muted);font-size:13px">Все задачи, публикации и записи об учёбе сохраняются в браузере этого устройства. На другой компьютер они сами не переносятся.</p><div class="warning"><b>Обязательно сделай резервную копию.</b><br>Очистка данных браузера или работа в другом профиле может удалить записи.</div><div class="actions-inline" style="margin-top:18px"><button class="btn btn-accent" data-action="export">↓ Скачать JSON-копию</button><button class="btn" data-action="import">↑ Восстановить из JSON</button></div><p class="subnote">Импорт заменяет текущие записи, поэтому перед ним полезно экспортировать копию. Секреты и пароли в планере хранить не нужно.</p></div></div>${data.study.length?`<div class="panel"><div class="panel-title"><h2>Архив самообучения из v2.0</h2></div><p class="subnote">Сохранено ${data.study.length} старых тем. Они остались в резервной копии JSON и не смешиваются с учебными дисциплинами университета.</p>${data.study.slice(0,30).map(x=>`<div class="list-row"><div class="row-title">${escapeHtml(x.title)}</div></div>`).join('')}</div>`:''}<div class="install-card"><h2>Установка на iPhone и iPad</h2><p>Открой сайт в <strong>Safari</strong>. Нажми <strong>«Поделиться»</strong> (квадрат со стрелкой вверх), затем <strong>«На экран Домой»</strong> и <strong>«Добавить»</strong>. Если пункт не виден, прокрути меню «Поделиться» ниже.</p><ol><li>Запускай приложение с появившейся иконки «МАСТЕРСКАЯ».</li><li>После первого открытия с интернетом интерфейс сможет загружаться без сети. Данные сохраняются локально.</li><li>Если используешь планер на компьютере, перенеси задачи через «Скачать JSON-копию» и «Восстановить из JSON».</li></ol><p class="subnote">Важно: данные Safari и версии с экрана «Домой» могут храниться раздельно. Экспортируй копию до перехода. iOS может удалять локальные данные при очистке хранилища; автоматической синхронизации и уведомлений пока нет.</p></div><div class="panel"><div class="panel-title"><h2>Как опубликовать этот сайт на GitHub Pages</h2></div><p style="color:var(--muted);font-size:13px">Загрузи index.html, style.css и app.js в публичный репозиторий, затем открой Settings → Pages и выбери Deploy from a branch → main → / (root). GitHub опубликует сайт по адресу вида username.github.io/repository. Публикуется только код сайта, не твои личные записи из браузера.</p></div>`;}
  function optionList(obj,value){return Object.entries(obj).map(([k,v])=>`<option value="${escapeHtml(k)}" ${value===k?'selected':''}>${escapeHtml(v)}</option>`).join('');}
  function projectOptions(value){return `<option value="">Без проекта</option>`+data.projects.map(p=>`<option value="${escapeHtml(p.id)}" ${value===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');}
  function sessionOptions(value){return `<option value="">Без привязки к сессии</option>`+data.universitySessions.map(x=>`<option value="${escapeHtml(x.id)}" ${value===x.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('');}
  function field(label,name,inner){return `<div class="form-group"><label for="fld-${name}">${label}</label>${inner}</div>`;}
  function input(name,value,attrs=''){return `<input id="fld-${name}" name="${name}" value="${escapeHtml(value)}" ${attrs}>`;}
  function select(name,options){return `<select id="fld-${name}" name="${name}">${options}</select>`;}
  function openEditor(type,id=null,prefProject=''){
    editMode={type,id};let item;
    if(type==='task')item=id?data.tasks.find(t=>t.id===id):{title:'',projectId:prefProject,due:'',priority:'normal',status:'todo',notes:''};
    if(type==='post')item=id?data.posts.find(p=>p.id===id):{title:'',projectId:prefProject,date:'',channel:'Telegram',format:'Пост',status:'idea',notes:'',link:''};
    if(type==='project')item=id?data.projects.find(p=>p.id===id):{name:'',color:COLORS[data.projects.length%COLORS.length]};
    if(type==='study')item=id?data.study.find(x=>x.id===id):{title:'',area:'3D и материалы',projectId:prefProject,status:'planned',progress:0,due:'',nextStep:'',notes:'',sessions:[]};
    if(type==='study-log')item=data.study.find(x=>x.id===id);
    if(type==='academic')item=id?data.academic.find(x=>x.id===id):{title:'',subject:'',type:'lab',status:'planned',due:'',priority:'normal',sessionId:'',teacher:'',nextStep:'',notes:''};
    if(type==='session')item=id?data.universitySessions.find(x=>x.id===id):{title:'',start:'',end:'',notes:''};
    if(!item)return;
    document.querySelector('#editor-title').textContent=(type==='study-log'?'Записать ':id?'Редактировать ':'Добавить ')+(type==='task'?'задачу':type==='post'?'публикацию':type==='study'?'тему обучения':type==='study-log'?'занятие':type==='academic'?'работу по вузу':type==='session'?'сессию':'проект');
    const f=document.querySelector('#editor-fields');
    if(type==='task')f.innerHTML=field('Задача *','title',input('title',item.title,'required maxlength="300" placeholder="Например: подобрать материалы для стены"'))+field('Проект','projectId',select('projectId',projectOptions(item.projectId)))+`<div class="form-cols">${field('Срок','due',input('due',item.due,'type="date"'))}${field('Приоритет','priority',select('priority',optionList(PRIORITIES,item.priority)))}</div>`+field('Состояние','status',select('status',optionList(TASK_STATES,item.status)))+field('Заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Коротко о следующем шаге">${escapeHtml(item.notes)}</textarea>`);
    if(type==='post')f.innerHTML=field('Тема публикации *','title',input('title',item.title,'required maxlength="300" placeholder="Например: как я исправил Weight Paint"'))+`<div class="form-cols">${field('Площадка','channel',select('channel',CHANNELS.map(c=>`<option ${item.channel===c?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')))}${field('Формат','format',select('format',FORMATS.map(c=>`<option ${item.format===c?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')))}</div>`+field('Проект','projectId',select('projectId',projectOptions(item.projectId)))+`<div class="form-cols">${field('Дата','date',input('date',item.date,'type="date"'))}${field('Стадия','status',select('status',optionList(STAGES,item.status)))}</div>`+field('Идея / текст / что подготовить','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Кадры, тезисы, ссылка на исходные материалы…">${escapeHtml(item.notes)}</textarea>`)+field('Ссылка на опубликованный пост','link',input('link',item.link,'type="url" maxlength="2000" placeholder="https://…"'));
    if(type==='study')f.innerHTML=field('Чему хочешь научиться *','title',input('title',item.title,'required maxlength="300" placeholder="Например: Hand-painted материалы"'))+`<div class="form-cols">${field('Направление','area',select('area',STUDY_AREAS.map(a=>`<option value="${escapeHtml(a)}" ${item.area===a?'selected':''}>${escapeHtml(a)}</option>`).join('')))}${field('Состояние','status',select('status',optionList(STUDY_STATES,item.status)))}</div>`+`<div class="form-cols">${field('Прогресс, %','progress',input('progress',item.progress,'type="number" min="0" max="100" step="5"'))}${field('Желаемая дата','due',input('due',item.due,'type="date"'))}</div>`+field('Связанный проект','projectId',select('projectId',projectOptions(item.projectId)))+field('Следующий маленький шаг','nextStep',input('nextStep',item.nextStep,'maxlength="500" placeholder="Протестировать текстуру на модели"'))+field('Материалы и заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Ссылки, важные понятия, заметки…">${escapeHtml(item.notes)}</textarea>`);
    if(type==='study-log')f.innerHTML=`<p class="dialog-context">Тема: ${escapeHtml(item.title)}</p><div class="form-cols">${field('Дата занятия','date',input('date',today(),'type="date" required'))}${field('Продолжительность, мин','minutes',input('minutes',30,'type="number" min="1" max="1440" required'))}</div>`+field('Что получилось / что изучил','note',`<textarea id="fld-note" name="note" maxlength="1000" placeholder="Например: исправил веса на рукавах и проверил деформации"></textarea>`);
    if(type==='academic')f.innerHTML=field('Название работы / аттестации *','title',input('title',item.title,'required maxlength="300" placeholder="Например: Лабораторная № 2"'))+field('Дисциплина','subject',input('subject',item.subject,'maxlength="160" placeholder="Например: Деревянные конструкции"'))+`<div class="form-cols">${field('Тип','type',select('type',optionList(ACADEMIC_TYPES,item.type)))}${field('Статус','status',select('status',optionList(ACADEMIC_STATUSES,item.status)))}</div>`+`<div class="form-cols">${field('Дедлайн / дата экзамена','due',input('due',item.due,'type="date"'))}${field('Приоритет','priority',select('priority',optionList(PRIORITIES,item.priority)))}</div>`+field('Сессия','sessionId',select('sessionId',sessionOptions(item.sessionId)))+field('Преподаватель (необязательно)','teacher',input('teacher',item.teacher,'maxlength="160" placeholder="Фамилия или контакт"'))+field('Следующее действие','nextStep',input('nextStep',item.nextStep,'maxlength="500" placeholder="Закончить расчёт и сдать отчёт"'))+field('Примечания','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Что требуется, где материалы, условия сдачи…">${escapeHtml(item.notes)}</textarea>`);
    if(type==='session')f.innerHTML=field('Название сессии *','title',input('title',item.title,'required maxlength="120" placeholder="Например: Зимняя сессия 2026/27"'))+`<div class="form-cols">${field('Начало','start',input('start',item.start,'type="date"'))}${field('Конец','end',input('end',item.end,'type="date"'))}</div>`+field('Примечания','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Допуски, расписание, важные особенности">${escapeHtml(item.notes)}</textarea>`);
    if(type==='project')f.innerHTML=field('Название проекта *','name',input('name',item.name,'required maxlength="90" placeholder="Новый проект"'))+field('Цвет метки','color',`<select id="fld-color" name="color">${COLORS.map(c=>`<option value="${c}" ${item.color===c?'selected':''}>${c}</option>`).join('')}</select>`);
    editor.showModal();setTimeout(()=>f.querySelector('input')?.focus(),50);
  }
  function saveEntry(){const fd=new FormData(form);const id=editMode.id??safeId();const txt=k=>String(fd.get(k)||'').trim();const type=editMode.type;
    if(type==='task'){const title=txt('title');if(!title)return;const entry={id,title:title.slice(0,300),projectId:txt('projectId'),due:hasDate(txt('due'))?txt('due'):'',priority:PRIORITIES[txt('priority')]?txt('priority'):'normal',status:TASK_STATES[txt('status')]?txt('status'):'todo',notes:txt('notes').slice(0,10000)};upsert(data.tasks,entry);}
    if(type==='post'){const title=txt('title');if(!title)return;const link=txt('link');if(link&&!validUrl(link)){alert('Ссылка должна начинаться с http:// или https://');return;}const entry={id,title:title.slice(0,300),channel:CHANNELS.includes(txt('channel'))?txt('channel'):'Telegram',format:FORMATS.includes(txt('format'))?txt('format'):'Пост',projectId:txt('projectId'),date:hasDate(txt('date'))?txt('date'):'',status:STAGES[txt('status')]?txt('status'):'idea',notes:txt('notes').slice(0,10000),link};upsert(data.posts,entry);}
    if(type==='study'){const title=txt('title');if(!title)return;const previous=data.study.find(x=>x.id===id);const entry={id,title:title.slice(0,300),area:STUDY_AREAS.includes(txt('area'))?txt('area'):'Другое',projectId:txt('projectId'),status:STUDY_STATES[txt('status')]?txt('status'):'planned',progress:Math.max(0,Math.min(100,Math.floor(n(txt('progress'))))),due:hasDate(txt('due'))?txt('due'):'',nextStep:txt('nextStep').slice(0,500),notes:txt('notes').slice(0,10000),sessions:previous?.sessions||[]};upsert(data.study,entry);}
    if(type==='study-log'){const topic=data.study.find(x=>x.id===id);if(!topic)return;topic.sessions.push({id:safeId(),date:hasDate(txt('date'))?txt('date'):today(),minutes:Math.max(1,Math.min(1440,Math.floor(n(txt('minutes'))||1))),note:txt('note').slice(0,1000)});if(topic.status==='planned')topic.status='learning';}
    if(type==='academic'){const title=txt('title');if(!title)return;const entry={id,title:title.slice(0,300),subject:txt('subject').slice(0,160),type:ACADEMIC_TYPES[txt('type')]?txt('type'):'other',status:ACADEMIC_STATUSES[txt('status')]?txt('status'):'planned',due:hasDate(txt('due'))?txt('due'):'',priority:PRIORITIES[txt('priority')]?txt('priority'):'normal',sessionId:txt('sessionId'),teacher:txt('teacher').slice(0,160),nextStep:txt('nextStep').slice(0,500),notes:txt('notes').slice(0,10000)};upsert(data.academic,entry);}
    if(type==='session'){const title=txt('title');if(!title)return;const start=hasDate(txt('start'))?txt('start'):'';const end=hasDate(txt('end'))?txt('end'):'';if(start&&end&&start>end){alert('Конец сессии должен быть не раньше её начала.');return;}upsert(data.universitySessions,{id,title:title.slice(0,120),start,end,notes:txt('notes').slice(0,10000)});}
    if(type==='project'){const name=txt('name');if(!name)return;const entry={id,name:name.slice(0,90),color:COLORS.includes(txt('color'))?txt('color'):COLORS[0]};upsert(data.projects,entry);}
    save();editor.close();render();toast('Сохранено');
  }
  function upsert(list,entry){const i=list.findIndex(x=>x.id===entry.id);if(i<0)list.push(entry);else list[i]=entry;}
  function remove(type,id){const list=data[type];const i=list.findIndex(x=>x.id===id);if(i<0)return;const target=list[i];const extra=type==='projects'?' Задачи, посты и темы обучения останутся без привязки.':'';if(!confirm(`Удалить «${target.title||target.name}»?${extra}`))return;list.splice(i,1);if(type==='universitySessions'){data.academic.forEach(x=>{if(x.sessionId===id)x.sessionId='';});}if(type==='projects'){data.tasks.forEach(x=>{if(x.projectId===id)x.projectId='';});data.posts.forEach(x=>{if(x.projectId===id)x.projectId='';});data.study.forEach(x=>{if(x.projectId===id)x.projectId='';});}save();render();toast('Удалено');}
  async function exportData(){
    const text=JSON.stringify(data,null,2);
    const filename=`masterskaya_backup_${today()}.json`;
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    // На iPhone/iPad меню «Поделиться» позволяет сохранить JSON в «Файлы».
    // В остальных случаях сохраняем стандартной ссылкой на скачивание.
    if(window.matchMedia?.('(pointer:coarse)').matches && navigator.share && navigator.canShare && typeof File !== 'undefined'){
      const file=new File([blob],filename,{type:'application/json'});
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:'МАСТЕРСКАЯ — резервная копия'});
          toast('Копия передана через меню «Поделиться»');
          return;
        }
      }catch(error){
        if(error?.name==='AbortError')return; // Пользователь закрыл меню обмена.
        console.warn('Не удалось открыть меню «Поделиться»; скачиваем файл.',error);
      }
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    toast('Резервная копия скачана');
  }
  async function importData(file){if(!file)return;if(file.size>5*1024*1024){alert('Файл слишком большой для планера.');return;}
    let newData;try{newData=normalize(JSON.parse(await file.text()));}catch(e){alert('Не удалось прочитать файл. Нужна JSON-копия планера.');return;}
    if(!confirm('Импорт полностью заменит текущие задачи, публикации и университетские записи. Продолжить?'))return;
    Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,newData);save();render();toast('Данные восстановлены');
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){page=nav.dataset.nav;query='';window.scrollTo({top:0,behavior:'instant'});render();return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;const id=btn.dataset.id,p=btn.dataset.project||'';
    switch(btn.dataset.action){
      case 'add-academic':openEditor('academic');break;case 'edit-academic':openEditor('academic',id);break;case 'delete-academic':remove('academic',id);break;
      case 'add-session':openEditor('session');break;case 'edit-session':openEditor('session',id);break;case 'delete-session':remove('universitySessions',id);break;
      case 'add-study':openEditor('study',null,p);break;case 'edit-study':openEditor('study',id);break;case 'log-study':openEditor('study-log',id);break;case 'delete-study':remove('study',id);break;
      case 'add-task':openEditor('task',null,p);break;case 'add-post':openEditor('post',null,p);break;case 'add-project':openEditor('project');break;
      case 'edit-task':openEditor('task',id);break;case 'edit-post':openEditor('post',id);break;case 'edit-project':openEditor('project',id);break;
      case 'delete-task':remove('tasks',id);break;case 'delete-post':remove('posts',id);break;case 'delete-project':remove('projects',id);break;
      case 'copy-post':{const post=data.posts.find(p=>p.id===id);if(post){data.posts.push({...clone(post),id:safeId(),title:post.title+' (копия)',status:'idea',link:''});save();render();toast('Создана копия: можно выбрать другую площадку');}break;}
      case 'close-dialog':editor.close();break;
      case 'prev-month':selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()-1,1);render();break;
      case 'next-month':selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,1);render();break;
      case 'current-month':selectedMonth=new Date();selectedMonth.setDate(1);render();break;
      case 'export':exportData();break;case 'import':document.querySelector('#restore-file').click();break;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-check-task]')){const t=data.tasks.find(x=>x.id===e.target.dataset.checkTask);if(t){t.status=e.target.checked?'done':'todo';save();render();}}
    if(e.target.matches('[data-post-stage]')){const p=data.posts.find(x=>x.id===e.target.dataset.postStage);if(p&&STAGES[e.target.value]){p.status=e.target.value;save();render();toast('Этап обновлён');}}
    if(e.target.matches('#task-filter')){taskFilter=e.target.value;render();}
    if(e.target.matches('#academic-filter')){academicFilter=e.target.value;render();}
    if(e.target.matches('#academic-subject-filter')){academicSubjectFilter=e.target.value;render();}
    if(e.target.matches('[data-academic-status]')){const x=data.academic.find(a=>a.id===e.target.dataset.academicStatus);if(x&&ACADEMIC_STATUSES[e.target.value]){x.status=e.target.value;save();render();toast('Статус работы обновлён');}}
  });
  document.addEventListener('input',e=>{if(e.target.matches('#task-search')){query=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector('#task-search');input.focus();input.setSelectionRange(pos,pos);}});
  form.addEventListener('submit',e=>{e.preventDefault();saveEntry();});
  document.addEventListener('submit',e=>{if(e.target.id==='goals-form'){e.preventDefault();const fd=new FormData(e.target);CHANNELS.forEach(ch=>data.goals[ch]=Math.max(0,Math.min(100,Math.floor(n(fd.get(ch))))));save();render();toast('Цели сохранены');}});
  document.querySelector('#restore-file').addEventListener('change',async e=>{const file=e.target.files?.[0];await importData(file);e.target.value='';});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){try{const updated=loadData();Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,updated);render();}catch{}}});
  render();
})();
