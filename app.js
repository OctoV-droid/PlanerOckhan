/* МАСТЕРСКАЯ v2.9.1 — проекты с задачами, ручной порядок, подзадачи и активность.
   Данные хранятся ТОЛЬКО в localStorage этого браузера.
   Ни токенов GitHub, ни секретов, ни запросов к внешним сервисам. */
(() => {
  'use strict';
  const STORAGE_KEY = 'atelier_planner_v1';
  const CHANNELS = ['Telegram', 'Instagram', 'YouTube Shorts', 'ВКонтакте', 'ArtStation'];
  const CHANNEL_SHORT = {'Telegram':'TG','Instagram':'IG','YouTube Shorts':'YT','ВКонтакте':'VK','ArtStation':'ART'};
  const FORMATS = ['Пост', 'Reels / Short', 'Карусель', 'История', 'Видео', 'Кейс'];
  const STAGES = {idea:'Идея', draft:'В работе', ready:'Готово к публикации', published:'Опубликовано'};
  const TASK_SORTS = {manual:'Мой порядок',priority:'По важности',due:'По сроку',project:'По проектам',status:'По состоянию'};
  const TASK_STATES = {todo:'Запланировано',doing:'В работе',done:'Выполнено'};
  const STUDY_STATES = {planned:'В планах',learning:'Изучаю',practice:'Практикую',done:'Освоено'};
  const STUDY_AREAS = ['3D и материалы','Unity и GameDev','Digital Art','Веб-дизайн','ПГС и чертежи','Другое'];
  const PRIORITIES = {low:'Не спешит',normal:'Обычная',high:'Важная'};
  const ACADEMIC_TYPES = {lab:'Лабораторная',practice:'Практическая',course:'Курсовая',control:'Контрольная',report:'Отчёт по практике',credit:'Зачёт',dcredit:'Дифференцированный зачёт',exam:'Экзамен',other:'Другое'};
  const ACADEMIC_STATUSES = {planned:'Не начато',progress:'В работе',ready:'Готово к сдаче',submitted:'Сдано / ожидаю оценки',passed:'Зачтено / закрыто',debt:'Долг'};
  const ACADEMIC_DONE = new Set(['passed']);
  const ACADEMIC_EXAMS = new Set(['credit','dcredit','exam']);
  const LESSON_TYPES = {lecture:'Лекция',practice:'Практика',lab:'Лабораторная',seminar:'Семинар',other:'Другое'};
  const WEEK_DAYS = {1:'Понедельник',2:'Вторник',3:'Среда',4:'Четверг',5:'Пятница',6:'Суббота',7:'Воскресенье'};
  const WEEK_PARITIES = {every:'Каждую неделю',odd:'Нечётная неделя',even:'Чётная неделя'};
  const ATTENDANCE_STATUSES = {attended:'Посетил',missed:'Пропустил',excused:'Уважительная причина',cancelled:'Отменена'};
  const COLORS = ['#b8a2d1','#d5bd88','#91b9b0','#96accb','#ce998c','#c0c5a1'];
  const defaultData = () => ({
    version:9,
    taskSort:'manual',
    projects:[
      {id:'tif',name:'TIF / Новониколаевск',color:'#a5a5b8'},
      {id:'engine',name:'Вечный двигатель',color:'#c9a681'},
      {id:'portfolio',name:'Портфолио и развитие',color:'#92baa8'},
      {id:'personal',name:'Личное творчество',color:'#b59acc'}
    ],
    tasks:[], habits:[], habitChecks:[], posts:[], study:[], academic:[], universitySubjects:[], universitySessions:[], timetable:[], attendance:[], universityWeekAnchor:'', workSessions:[], activityLog:[],
    goals:{'Telegram':4,'Instagram':3,'YouTube Shorts':2,'ВКонтакте':1,'ArtStation':1}
  });
  const app = document.querySelector('#app');
  const editor = document.querySelector('#editor');
  const form = document.querySelector('#editor-form');
  const toastEl = document.querySelector('#toast');
  const boot = window.MasterskayaStorage.read(defaultData,normalize);
  const data = boot.data;
  let storageReadOnly = boot.locked;
  let storageError = boot.reason;
  let lastSavedDay = today();
  let page = 'overview';
  let taskFilter = 'doing';
  let selectedProjectId = null;
  let draggedTaskId = null;
  let academicFilter = 'all';
  let academicSubjectFilter = 'all';
  let academicSessionFilter = 'all';
  let universityTab = 'works';
  let attendanceStart = iso(getMonday(new Date()));
  let overviewDate = today();
  let activityDays = 30;
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
  function dateObj(s){return new Date(`${s}T12:00:00`);}
  function getMonday(d){return shiftDate(d,-(d.getDay()+6)%7);}
  function hhmm(s){return typeof s==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);}
  function mondayIso(s){return iso(getMonday(dateObj(s)));}
  function weekNumberRelative(s,anchor){
    // UTC-календарные дни, а не миллисекунды локального времени: переходы на летнее/зимнее время не меняют чётность недель.
    const utc=day=>{const [y,m,d]=day.split('-').map(Number);return Date.UTC(y,m-1,d);};
    return Math.round((utc(mondayIso(s))-utc(mondayIso(anchor)))/(86400000*7))+1;
  }
  function prettyDate(s,withYear=false){if(!s)return 'Без даты';let d=new Date(`${s}T12:00:00`);if(Number.isNaN(d.getTime()))return s;return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',...(withYear?{year:'numeric'}:{})});}
  function hasDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T12:00:00`);return !Number.isNaN(d.getTime())&&iso(d)===s;}
  function monthOf(s){return hasDate(s)?s.slice(0,7):'';}
  function n(v){return Number.isFinite(+v)?+v:0;}
  function validUrl(s){try {const u=new URL(s);return ['https:','http:'].includes(u.protocol);} catch{return false;}}
  function project(id){return data.projects.find(x=>x.id===id);}
  function projectLabel(id){return project(id)?.name ?? 'Без проекта';}
  function taskSorter(a,b){
    if(data.taskSort==='priority'){const weights={high:0,normal:1,low:2};return weights[a.priority]-weights[b.priority]||(a.due||'9999').localeCompare(b.due||'9999');}
    if(data.taskSort==='due')return (a.due||'9999').localeCompare(b.due||'9999');
    if(data.taskSort==='project')return projectLabel(a.projectId).localeCompare(projectLabel(b.projectId),'ru');
    if(data.taskSort==='status')return Number(a.status==='done')-Number(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999');
    return 0; // При ручной сортировке порядок равен порядку в массиве tasks.
  }
  function orderedTasks(list){return data.taskSort==='manual'?[...list]:[...list].sort(taskSorter);}
  function visibleTasks(){let list=data.tasks.filter(t=>taskFilter==='all'||t.status===taskFilter);if(query)list=list.filter(t=>[t.title,t.notes,projectLabel(t.projectId)].join(' ').toLowerCase().includes(query.toLowerCase()));return orderedTasks(list);}
  function canReorder(){return page==='tasks'&&data.taskSort==='manual'&&!query;}
  function moveTaskBefore(sourceId,targetId,placeAfter=false){
    if(!canReorder()||sourceId===targetId)return false;
    const from=data.tasks.findIndex(t=>t.id===sourceId),to=data.tasks.findIndex(t=>t.id===targetId);
    if(from<0||to<0)return false;
    const [task]=data.tasks.splice(from,1);const index=data.tasks.findIndex(t=>t.id===targetId);
    data.tasks.splice(index+(placeAfter?1:0),0,task);save();render();return true;
  }
  function stepTask(id,direction){
    if(!canReorder())return;const shown=visibleTasks(),i=shown.findIndex(t=>t.id===id),other=shown[i+direction];if(i<0||!other)return;
    // Переставляем только видимые задачи; скрытые остаются на своих местах.
    const a=data.tasks.findIndex(t=>t.id===id),b=data.tasks.findIndex(t=>t.id===other.id);
    [data.tasks[a],data.tasks[b]]=[data.tasks[b],data.tasks[a]];save();render();
    const btn=app.querySelector(`[data-task-move="${id}"][data-direction="${direction}"]`);btn?.focus();
  }
  function goToTask(id){
    if(!data.tasks.some(t=>t.id===id))return;page='tasks';selectedProjectId=null;taskFilter='all';query='';render();
    const card=[...app.querySelectorAll('[data-task-id]')].find(el=>el.dataset.taskId===id);
    if(card){card.classList.add('task-focused');card.scrollIntoView({block:'center',behavior:'smooth'});}
  }
  function projectTag(id){const p=project(id);return p?`<span class="tag"><span class="project-color" style="width:7px;height:7px;background:${p.color}"></span>${escapeHtml(p.name)}</span>`:'';}
  function toast(text){toastEl.textContent=storageError?'⚠ '+storageError:text;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),storageError?6500:3000);}
  function storageBanner(){
    const el=document.querySelector('#storage-warning');if(!el)return;
    el.hidden=!storageError;
    document.querySelector('#storage-warning-text').textContent=storageError;
    document.querySelector('#recover-data').hidden=!storageReadOnly;
    document.querySelector('#export-corrupt').hidden=!storageReadOnly;
  }
  function warnSave(reason){storageError=reason;storageBanner();}
  function normalize(raw){
    const d=defaultData(); if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('Некорректный файл');
    if(Array.isArray(raw.projects))d.projects=raw.projects.slice(0,200).filter(p=>p && typeof p.name==='string').map(p=>({id:String(p.id||safeId()).slice(0,90),name:p.name.slice(0,90),color:COLORS.includes(p.color)||/^#[0-9a-fA-F]{6}$/.test(p.color||'')?p.color:'#b8a2d1'}));
    d.taskSort=TASK_SORTS[raw.taskSort]?raw.taskSort:'manual';
    if(Array.isArray(raw.tasks))d.tasks=raw.tasks.slice(0,5000).filter(t=>t&&typeof t.title==='string').map(t=>({id:String(t.id||safeId()).slice(0,90),title:t.title.slice(0,300),projectId:String(t.projectId||''),due:hasDate(t.due)?t.due:'',priority:PRIORITIES[t.priority]?t.priority:'normal',status:TASK_STATES[t.status]?t.status:'todo',lastOpenStatus:['todo','doing'].includes(t.lastOpenStatus)?t.lastOpenStatus:'doing',color:window.MasterskayaAnalytics.color(t.color,''),notes:String(t.notes||'').slice(0,10000),subtasks:Array.isArray(t.subtasks)?t.subtasks.slice(0,250).filter(st=>st&&typeof st.title==='string').map(st=>({id:String(st.id||safeId()).slice(0,90),title:st.title.slice(0,300),done:st.done===true})):[]}));
    if(Array.isArray(raw.habits))d.habits=raw.habits.slice(0,250).filter(h=>h&&typeof h.title==='string').map(h=>({
      id:String(h.id||safeId()).slice(0,90),title:h.title.slice(0,100),icon:String(h.icon||'✳').slice(0,10),color:window.MasterskayaAnalytics.color(h.color,'#91b9b0'),createdAt:hasDate(h.createdAt)?h.createdAt:today()
    }));
    if(Array.isArray(raw.habitChecks)){
      d.habitChecks=window.MasterskayaHabits.clean(raw.habitChecks,d.habits,hasDate);
    }
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
      teacher:String(x.teacher||'').slice(0,160),subjectId:String(x.subjectId||'').slice(0,90),nextStep:String(x.nextStep||'').slice(0,500),notes:String(x.notes||'').slice(0,10000),subtasks:window.MasterskayaUniversity.steps(x.subtasks,safeId)
    }));
    if(Array.isArray(raw.universitySubjects))d.universitySubjects=raw.universitySubjects.slice(0,1000).filter(x=>x&&typeof x.title==='string').map(x=>({
      id:String(x.id||safeId()).slice(0,90),title:x.title.slice(0,160),teacher:String(x.teacher||'').slice(0,160),
      sessionId:String(x.sessionId||'').slice(0,90),due:hasDate(x.due)?x.due:'',debt:x.debt===true,notes:String(x.notes||'').slice(0,10000)
    }));
    window.MasterskayaUniversity.migrate(d.universitySubjects,d.academic,safeId);
    d.universityWeekAnchor=hasDate(raw.universityWeekAnchor)?raw.universityWeekAnchor:'';
    if(Array.isArray(raw.timetable))d.timetable=raw.timetable.slice(0,500).filter(x=>x&&typeof x.subject==='string').map(x=>({
      id:String(x.id||safeId()).slice(0,90),subject:x.subject.slice(0,160),teacher:String(x.teacher||'').slice(0,160),
      weekday:WEEK_DAYS[x.weekday]?Number(x.weekday):1,start:hhmm(x.start)?x.start:'09:00',end:hhmm(x.end)?x.end:'10:30',
      kind:LESSON_TYPES[x.kind]?x.kind:'lecture',parity:WEEK_PARITIES[x.parity]?x.parity:'every',notes:String(x.notes||'').slice(0,1000)
    }));
    if(Array.isArray(raw.attendance))d.attendance=raw.attendance.slice(0,25000).filter(x=>x&&hasDate(x.date)&&typeof x.subject==='string'&&(x.status===''||x.status==null||ATTENDANCE_STATUSES[x.status])).map(x=>({
      id:String(x.id||safeId()).slice(0,90),scheduleId:String(x.scheduleId||'').slice(0,90),date:x.date,
      subject:x.subject.slice(0,160),teacher:String(x.teacher||'').slice(0,160),kind:LESSON_TYPES[x.kind]?x.kind:'other',
      start:hhmm(x.start)?x.start:'',end:hhmm(x.end)?x.end:'',status:ATTENDANCE_STATUSES[x.status]?x.status:'',notes:String(x.notes||'').slice(0,1500)
    }));
    if(Array.isArray(raw.workSessions))d.workSessions=raw.workSessions.slice(0,10000).filter(x=>x&&typeof x==='object').map(x=>({
      id:String(x.id||safeId()).slice(0,90),date:hasDate(x.date)?x.date:today(),minutes:Math.max(1,Math.min(1440,Math.floor(n(x.minutes)||1))),
      area:['3D / Арт','Разработка игр','Учёба в вузе','Соцсети / портфолио','Другое'].includes(x.area)?x.area:'Другое',
      projectId:String(x.projectId||''),note:String(x.note||'').slice(0,1000)
    }));
    if(Array.isArray(raw.activityLog))d.activityLog=raw.activityLog.slice(-20000).filter(x=>x&&typeof x==='object'&&hasDate(x.date)&&[-1,1].includes(x.delta)).map(x=>({
      id:String(x.id||safeId()).slice(0,90),date:x.date,delta:x.delta,
      kind:['task','subtask','post','academic','habit'].includes(x.kind)?x.kind:'task',title:String(x.title||'').slice(0,300),projectId:String(x.projectId||'').slice(0,90),color:window.MasterskayaAnalytics.color(x.color,'')
    }));
    if(raw.goals&&typeof raw.goals==='object')CHANNELS.forEach(c=>d.goals[c]=Math.max(0,Math.min(100,Math.floor(n(raw.goals[c]??d.goals[c])))));
    return d;
  }
  function save(){
    if(storageReadOnly){warnSave('Сохранение запрещено: сначала восстанови резервную копию или импортируй JSON. Экспорт текущих данных доступен.');return false;}
    const result=window.MasterskayaStorage.write(data,normalize);
    if(!result.ok){warnSave('Изменения НЕ СОХРАНЕНЫ в браузере. Скачай JSON-копию сейчас, затем проверь свободное место и разрешения браузера.');return false;}
    storageError='';storageBanner();return true;
  }
  const WORK_AREAS = ['3D / Арт','Разработка игр','Учёба в вузе','Соцсети / портфолио','Другое'];
  function recordChange(kind,title,delta,source=null){
    if(!delta)return;
    data.activityLog.push({id:safeId(),date:today(),kind,title:String(title).slice(0,300),delta:delta>0?1:-1,projectId:source?.projectId||'',color:source?.color||''});
    if(data.activityLog.length>20000)data.activityLog.splice(0,data.activityLog.length-20000);
  }
  function transition(kind,title,prev,next,source=null){if(Boolean(prev)!==Boolean(next))recordChange(kind,title,next?1:-1,source);}
  function subtaskStats(t){const total=t.subtasks?.length||0;const done=(t.subtasks||[]).filter(x=>x.done).length;return {done,total,pct:total?Math.round(done/total*100):0};}
  function activitySeries(days=activityDays,offset=0){
    const first=shiftDate(new Date(),-(days-1+offset)),series=[];
    for(let i=0;i<days;i++){
      const date=iso(shiftDate(first,i));const events=data.activityLog.filter(x=>x.date===date);
      const minutes=data.workSessions.filter(x=>x.date===date).reduce((a,x)=>a+x.minutes,0);
      series.push({date,plus:events.filter(x=>x.delta>0).length,minus:events.filter(x=>x.delta<0).length,minutes});
    }
    return series;
  }
  function periodStats(series){return {done:series.reduce((a,x)=>a+x.plus,0),reopened:series.reduce((a,x)=>a+x.minus,0),minutes:series.reduce((a,x)=>a+x.minutes,0),active:series.filter(x=>x.plus||x.minus||x.minutes).length};}
  function hoursString(min){return min>=60?`${Math.floor(min/60)} ч ${min%60?min%60+' мин':''}`.trim():`${min} мин`;}
  function categoryLegend(categories){return `<div class="category-legend">${categories.map(c=>`<span><i style="background:${escapeHtml(c.color)}"></i>${escapeHtml(c.label)}</span>`).join('')}</div>`;}
  function stackedPlot(grouped,kind){
    const w=960,h=245,pad=23,usable=w-pad*2,base=195,top=28,slot=usable/grouped.days.length;
    const max=Math.max(1,...grouped.days.map(d=>d.parts.reduce((sum,p)=>sum+p.value,0)));
    const bars=grouped.days.map((d,i)=>{
      const x=pad+i*slot+slot*.14,bw=Math.max(2,slot*.72);
      let cursor=base;
      const units=d.parts.reduce((sum,p)=>sum+p.value,0);
      const parts=d.parts.map(p=>{const height=p.value/max*(base-top);cursor-=height;
        return `<rect x="${x.toFixed(1)}" y="${cursor.toFixed(1)}" width="${bw.toFixed(1)}" height="${height.toFixed(1)}" fill="${escapeHtml(p.color)}"/>`;}).join('');
      return `<g><title>${escapeHtml(prettyDate(d.date,true))}: ${kind==='minutes'?hoursString(units):units+' действий'}${d.parts.map(p=>' · '+p.label+': '+p.value).join('')}</title>${parts}</g>`;
    }).join('');
    const ticks=grouped.days.map((d,i)=>(i===0||i===grouped.days.length-1||i%Math.ceil(grouped.days.length/6)===0)?`<text x="${(pad+i*slot+slot/2).toFixed(1)}" y="228" text-anchor="middle" fill="#a1abbb" font-size="12">${escapeHtml(prettyDate(d.date))}</text>`:'').join('');
    return `<svg class="activity-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${kind==='minutes'?'Время':'Выполненные действия'} по проектам и категориям"><line x1="${pad}" y1="${base}" x2="${w-pad}" y2="${base}" stroke="#566174"/>${bars}${ticks}</svg>`;
  }
  function categoryTotals(grouped,kind){
    const counts=new Map();for(const d of grouped.days)for(const part of d.parts)counts.set(part.key,(counts.get(part.key)||0)+part.value);
    return `<div class="category-totals">${grouped.categories.filter(c=>counts.get(c.key)).sort((a,b)=>counts.get(b.key)-counts.get(a.key)).map(c=>`<div class="category-total"><span><i class="color-dot" style="background:${escapeHtml(c.color)}"></i>${escapeHtml(c.label)}</span><b>${kind==='minutes'?hoursString(counts.get(c.key)):counts.get(c.key)+' действий'}</b></div>`).join('')||'<p class="subnote">За этот период записей пока нет.</p>'}</div>`;
  }
  function taskCategories(days){
    const dateList=days.map(x=>x.date);
    return window.MasterskayaAnalytics.actions(dateList,data.activityLog,data.projects);
  }
  function minuteCategories(days){
    const dateList=days.map(x=>x.date);
    return window.MasterskayaAnalytics.minutes(dateList,data.workSessions,data.projects);
  }
  function renderActivity(){
    const series=activitySeries(),cur=periodStats(series),prev=periodStats(activitySeries(activityDays,activityDays));
    const diff=cur.done-prev.done;const diffMinutes=cur.minutes-prev.minutes;
    const recent=[...data.workSessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
    const byTask=taskCategories(series),byMinute=minuteCategories(series);
    return `${heading('ЛИЧНАЯ АНАЛИТИКА','Активность','Следи за результатами и затраченным временем без штрафов за отдых. Дни без записей не считаются регрессом.','<button class="btn btn-accent" data-action="add-work">+ Записать рабочую сессию</button>')}
    <div class="activity-period" role="group" aria-label="Период графика">${[7,30,90].map(d=>`<button class="${activityDays===d?'selected':''}" data-action="activity-period" data-days="${d}" aria-pressed="${activityDays===d}">${d} дней</button>`).join('')}</div>
    <div class="activity-summary">
      <div class="stat-card"><div class="stat-icon">✓</div><div class="stat-value">${cur.done}</div><div class="stat-label">Завершённых действий · ${diff>0?'+':''}${diff} к прошлому периоду</div></div>
      <div class="stat-card"><div class="stat-icon">↶</div><div class="stat-value">${cur.reopened}</div><div class="stat-label">Повторно открыто (отдельный показатель)</div></div>
      <div class="stat-card"><div class="stat-icon">◷</div><div class="stat-value">${hoursString(cur.minutes)}</div><div class="stat-label">Записано времени · ${diffMinutes>0?'+':''}${diffMinutes} мин</div></div>
      <div class="stat-card"><div class="stat-icon">▦</div><div class="stat-value">${cur.active} / ${activityDays}</div><div class="stat-label">Дней с записями активности</div></div>
    </div>
    <section class="panel activity-panel"><div class="panel-title"><h2>Прогресс и возвращённые в работу действия</h2></div>
    ${categoryLegend(byTask.categories)}${stackedPlot(byTask,'actions')}${categoryTotals(byTask,'actions')}<p class="subnote">Столбцы показывают <b>число выполненных действий</b>: цвет проекта для основных задач, голубой для подзадач, фиолетовый для ВУЗа. Повторное открытие учитывается отдельно в показателе выше. События из старой версии без привязки к проекту относятся к «Другому».</p></section>
    <section class="panel activity-panel"><div class="panel-title"><h2>Время работы по направлениям</h2></div>${categoryLegend(byMinute.categories)}${stackedPlot(byMinute,'minutes')}${categoryTotals(byMinute,'minutes')}<p class="subnote">Минуты берутся <b>только из записанных рабочих сессий</b>; галочка задачи не означает автоматически затраченное время. Выбери проект при добавлении рабочей сессии, чтобы видеть его цвет на графике.</p></section>
    <section class="panel activity-panel"><div class="panel-title"><h2>Последние рабочие сессии</h2><button class="text-button" data-action="add-work">+ Добавить ↗</button></div>
    ${recent.length?recent.map(x=>`<div class="list-row"><div class="row-main"><div class="row-title">${escapeHtml(x.area)} · ${hoursString(x.minutes)}</div><div class="row-sub">${prettyDate(x.date,true)}${x.projectId?' · '+escapeHtml(projectLabel(x.projectId)):''}${x.note?' · '+escapeHtml(x.note):''}</div></div><button class="icon-btn" data-action="edit-work" data-id="${escapeHtml(x.id)}" title="Изменить сессию">✎</button><button class="icon-btn" data-action="delete-work" data-id="${escapeHtml(x.id)}" title="Удалить сессию">✕</button></div>`).join(''):'<div class="empty">Рабочих сессий пока нет. Можно записать хотя бы 20 минут работы над проектом.</div>'}</section>
    <p class="subnote">События выполнения фиксируются начиная с версии 2.4. Для старых задач без истории выполнения прошлые даты восстановить невозможно.</p>`;
  }
  function stat(){const m=today().slice(0,7);return {open:data.tasks.filter(x=>x.status!=='done').length,done:data.tasks.filter(x=>x.status==='done').length,planned:data.posts.filter(x=>x.status!=='published'&&x.date&&x.date>=today()&&x.date<=iso(shiftDate(new Date(),7))).length,published:data.posts.filter(x=>x.status==='published'&&monthOf(x.date)===m).length,academicDue:data.academic.filter(x=>!ACADEMIC_DONE.has(x.status)&&(x.status==='debt'||(x.due&&x.due<today()))).length};}
  function shellTitle(){if(page==='projects'&&selectedProjectId)return projectLabel(selectedProjectId);return {overview:'Обзор',tasks:'Задачи',habits:'Привычки',content:'Публикации',university:'ВУЗ',calendar:'Календарь',projects:'Проекты',activity:'Активность',settings:'Настройки'}[page];}
  function render(){storageBanner();document.querySelector('#crumb-title').textContent=shellTitle();document.querySelector('#today-label').textContent=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});document.querySelector('#footer-year').textContent=new Date().getFullYear();document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));app.innerHTML=({overview:renderOverview,tasks:renderTasks,habits:renderHabits,content:renderContent,university:renderUniversity,calendar:renderCalendar,projects:renderProjects,activity:renderActivity,settings:renderSettings}[page])();}
  function heading(label,title,subtitle,actions=''){return `<div class="section-heading"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${subtitle}</p></div>${actions?`<div class="actions-inline">${actions}</div>`:''}</div>`;}
  function taskRow(t,compact=false){
    const overdue=t.status!=='done'&&t.due&&t.due<today();const due=t.due?`<span class="${overdue?'pill overdue':''}">${overdue?'Просрочено · ':''}${prettyDate(t.due)}</span>`:'Без срока';
    const st=subtaskStats(t);const label=st.total?`${st.done}/${st.total} шагов`:'Без подзадач';
    if(compact)return `<div class="list-row"><input type="checkbox" class="check" aria-label="Выполнено: ${escapeHtml(t.title)}" data-check-task="${escapeHtml(t.id)}" ${t.status==='done'?'checked':''}><div class="row-main"><div class="row-title" style="${t.status==='done'?'text-decoration:line-through;opacity:.65':''}">${escapeHtml(t.title)}</div><div class="row-sub">${escapeHtml(projectLabel(t.projectId))} · ${due}${st.total?' · '+label:''}</div></div><button class="icon-btn" data-action="edit-task" data-id="${escapeHtml(t.id)}" title="Редактировать">✎</button></div>`;
    const steps=(t.subtasks||[]).map(sub=>`<div class="subtask-row"><input type="checkbox" class="check" data-check-subtask="${escapeHtml(sub.id)}" data-parent="${escapeHtml(t.id)}" aria-label="Выполнено: ${escapeHtml(sub.title)}" ${sub.done?'checked':''}><span class="subtask-name ${sub.done?'is-done':''}">${escapeHtml(sub.title)}</span><button class="icon-btn subtask-edit" data-action="edit-subtask" data-id="${escapeHtml(sub.id)}" data-project="${escapeHtml(t.id)}" title="Изменить шаг">✎</button><button class="icon-btn subtask-remove" data-action="delete-subtask" data-id="${escapeHtml(sub.id)}" data-project="${escapeHtml(t.id)}" title="Удалить шаг">×</button></div>`).join('');
    const reorder=page==='tasks'&&data.taskSort==='manual'&&!query;
    const moveControls=reorder?`<div class="task-move-controls"><button type="button" class="icon-btn task-drag-handle" draggable="true" data-task-drag="${escapeHtml(t.id)}" aria-label="Перетащить задачу" title="Перетащить на компьютере">⠿</button><button type="button" class="icon-btn" data-task-move="${escapeHtml(t.id)}" data-direction="-1" aria-label="Поднять задачу выше" title="Выше">↑</button><button type="button" class="icon-btn" data-task-move="${escapeHtml(t.id)}" data-direction="1" aria-label="Опустить задачу ниже" title="Ниже">↓</button></div>`:'';
    return `<div class="task-card ${t.status==='done'?'done':''}" data-task-id="${escapeHtml(t.id)}" style="border-left:3px solid ${escapeHtml(t.color||project(t.projectId)?.color||'#596479')}">${moveControls}<input type="checkbox" class="check" aria-label="Выполнено: ${escapeHtml(t.title)}" data-check-task="${escapeHtml(t.id)}" ${t.status==='done'?'checked':''}><div class="task-wrap"><div class="row-main"><div class="row-title">${escapeHtml(t.title)}</div><div class="meta-stack">${t.color?`<span class="tag"><i class="color-dot" style="background:${escapeHtml(t.color)}"></i>Цвет задачи</span>`:''}${projectTag(t.projectId)}<span class="tag ${t.priority==='high'?'important':''}">${PRIORITIES[t.priority]}</span><select class="task-status-control" data-task-status="${escapeHtml(t.id)}" aria-label="Статус задачи ${escapeHtml(t.title)}">${optionList(TASK_STATES,t.status)}</select><span class="${overdue?'pill overdue':'row-sub'}">${due}</span></div>${t.notes?`<div class="row-sub">${escapeHtml(t.notes).slice(0,210)}</div>`:''}
    <div class="subtasks-box"><div class="subtasks-head"><strong>Подзадачи</strong><span>${label}${st.total?' · '+st.pct+'%':''}</span></div>${st.total?`<div class="progress subtask-progress"><span style="width:${st.pct}%"></span></div>`:''}${steps}<button class="text-button subtask-add" data-action="add-subtask" data-project="${escapeHtml(t.id)}">+ Добавить шаг без срока</button></div>
    </div><div class="task-actions"><button class="icon-btn" data-action="edit-task" data-id="${escapeHtml(t.id)}" title="Редактировать">✎</button><button class="icon-btn" data-action="delete-task" data-id="${escapeHtml(t.id)}" title="Удалить">✕</button></div></div></div>`;
  }
  function socialGoals(){const m=today().slice(0,7);return CHANNELS.map(ch=>{const done=data.posts.filter(p=>p.channel===ch&&p.status==='published'&&monthOf(p.date)===m).length,goal=data.goals[ch]||0;return `<div class="social-row"><div class="social-meta"><strong>${escapeHtml(ch)}</strong><span>${done} / ${goal||'без цели'}</span></div><div class="progress"><span style="width:${goal?Math.min(100,Math.round(done/goal*100)):0}%"></span></div></div>`;}).join('');}
  function renderOverviewLessons(){
    const day=overviewDate, lessons=attendanceItems(day,day);
    const attended=lessons.filter(x=>x.record?.status==='attended').length;
    const dateLabel=dateObj(day).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
    const rows=lessons.map(x=>`<div class="overview-lesson-row"><div class="overview-lesson-main"><strong>${escapeHtml(x.start||'Без времени')} · ${escapeHtml(x.subject)}</strong><span>${escapeHtml(LESSON_TYPES[x.kind]||'Пара')} · ${escapeHtml(lessonStatusLabel(x.record,x.date,x.start))}</span></div>${lessonCheck(x)}</div>`).join('');
    return `<div class="overview-day-nav"><button class="icon-btn" data-action="overview-day-prev" aria-label="Предыдущий день" title="Предыдущий день">←</button><strong>${escapeHtml(dateLabel)}${day===today()?' · сегодня':''}</strong><button class="icon-btn" data-action="overview-day-next" aria-label="Следующий день" title="Следующий день">→</button>${day!==today()?`<button class="text-button" data-action="overview-day-today">Сегодня</button>`:''}</div>
      <div class="overview-attendance-count">Посещено ${attended} из ${lessons.length} пар</div>
      ${rows||'<div class="empty">На этот день пар нет. Добавь занятие через журнал ВУЗа.</div>'}`;
  }
  function renderOverview(){const s=stat();const openTasks=orderedTasks(data.tasks.filter(x=>x.status==='doing')).slice(0,5);const upcoming=data.posts.filter(x=>x.status!=='published').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice(0,5);
    return `<div class="hero"><div><div class="eyebrow">ТВОЯ ТВОРЧЕСКАЯ МАСТЕРСКАЯ</div><h1>Идеи, проекты и публикации.<br>Без лишнего шума.</h1><p>Планируй работу, сохраняй идеи и отмечай результат. Не нужно делать всё сразу: достаточно понимать следующий шаг.</p><button class="btn btn-accent" data-action="add-post">+ Запланировать публикацию</button></div><div class="hero-stat"><strong>${s.open}</strong><span>открытых задач</span></div></div>
    <div class="stats-grid"><div class="stat-card"><div class="stat-icon">☑</div><div class="stat-value">${s.open}</div><div class="stat-label">Дел в работе и планах</div></div><div class="stat-card"><div class="stat-icon">▤</div><div class="stat-value">${s.planned}</div><div class="stat-label">Постов в ближайшие 7 дней</div></div><div class="stat-card"><div class="stat-icon">↗</div><div class="stat-value">${s.published}</div><div class="stat-label">Опубликовано за месяц</div></div><div class="stat-card"><div class="stat-icon">▥</div><div class="stat-value">${s.academicDue}</div><div class="stat-label">Долгов и просроченных сдач</div></div></div>
    <div class="activity-preview"><div><strong>Активность за 7 дней</strong><p>Завершено ${periodStats(activitySeries(7)).done} · Пересмотрено ${periodStats(activitySeries(7)).reopened} · ${hoursString(periodStats(activitySeries(7)).minutes)} записанной работы</p></div><button class="btn btn-soft" data-nav="activity">Смотреть график ↗</button></div>
    <div class="main-grid"><div><div class="panel"><div class="panel-title"><h2>Ближайшие задачи</h2><button class="text-button" data-nav="tasks">Все задачи ↗</button></div>${openTasks.length?openTasks.map(t=>taskRow(t,true)).join(''):'<div class="empty"><span class="empty-icon">✳</span>Задач пока нет. Добавь первый шаг по проекту.</div>'}</div>
    <div class="panel"><div class="panel-title"><h2>В очереди на публикацию</h2><button class="text-button" data-nav="content">Контент-план ↗</button></div>${upcoming.length?upcoming.map(p=>`<div class="list-row"><div class="row-main"><div class="row-title">${escapeHtml(p.title)}</div><div class="row-sub">${escapeHtml(p.channel)} · ${STAGES[p.status]} · ${prettyDate(p.date)}</div></div><button class="icon-btn" data-action="edit-post" data-id="${escapeHtml(p.id)}" title="Редактировать">✎</button></div>`).join(''):'<div class="empty"><span class="empty-icon">▦</span>Идей для публикаций ещё нет.</div>'}</div></div>
    <div><div class="panel"><div class="panel-title"><h2>Публикации в этом месяце</h2><button class="text-button" data-nav="settings">Изменить цели ↗</button></div>${socialGoals()}<div class="subnote">Считаются посты со статусом «Опубликовано» и датой этого месяца.</div></div><div class="panel overview-lessons"><div class="panel-title"><h2>ВУЗ · пары на день</h2><button class="text-button" data-nav="university">Открыть журнал ↗</button></div>
    ${renderOverviewLessons()}
    </div><div class="panel"><div class="panel-title"><h2>Небольшое напоминание</h2></div><p style="color:var(--muted);font-size:13px">Можно использовать один рабочий материал для разных площадок: короткое видео в Instagram и Shorts, подробный рассказ в Telegram, законченный кейс на ArtStation.</p><button class="text-button" data-action="add-post" style="margin-top:15px">Записать идею ↗</button></div></div></div>`;
  }
  function hasHabitCheck(id,date=today()){return window.MasterskayaHabits.checked(data.habitChecks,id,date);}
  function recordHabit(id){
    const h=data.habits.find(x=>x.id===id);if(!h)return;
    const date=today();
    if(hasHabitCheck(id,date)){toast('Эта привычка уже отмечена сегодня');return;}
    if(!window.MasterskayaHabits.add(data.habitChecks,id,date))return;
    if(save()){render();toast('Привычка отмечена за '+prettyDate(date,true));}else render();
  }
  function habitCounter(h){return window.MasterskayaHabits.count(data.habitChecks,h.id);}
  function renderHabitsWidget(){
    const weekday=new Date().toLocaleDateString('ru-RU',{weekday:'long'});
    const cards=data.habits.map(h=>{
      const done=hasHabitCheck(h.id);
      return `<button class="habit-tap ${done?'is-checked':''}" data-action="tap-habit" data-id="${escapeHtml(h.id)}" style="--habit-color:${escapeHtml(h.color)}" ${done?'disabled':''} title="${done?'Уже отмечено сегодня':'Отметить сегодня'}"><span class="habit-emoji">${escapeHtml(h.icon)}</span><span class="habit-text">${escapeHtml(h.title)}</span><span class="habit-tick">${done?'✓':'+'}</span></button>`;
    }).join('');
    return `<section class="panel habits-mini"><div class="panel-title"><div><h2>Привычки сегодня</h2><p class="subnote" style="margin-top:3px">${escapeHtml(weekday)}, ${prettyDate(today(),true)} · ${data.habits.filter(h=>hasHabitCheck(h.id)).length}/${data.habits.length}</p></div><button class="text-button" data-nav="habits">Настроить ↗</button></div><div class="habit-mini-grid">${cards||'<p class="subnote">Добавь первую привычку в разделе «Привычки».</p>'}</div></section>`;
  }
  function renderHabits(){
    const mon=getMonday(new Date()),week=Array.from({length:7},(_,i)=>iso(shiftDate(mon,i)));
    const current=data.habits.filter(h=>hasHabitCheck(h.id)).length;
    return `${heading('ЕЖЕДНЕВНЫЕ РИТУАЛЫ','Привычки','Одна отметка в день по местной дате устройства. Историю за предыдущие дни можно посмотреть, но нельзя накрутить.','<button class="btn btn-accent" data-action="add-habit">+ Новая привычка</button>')}
      <div class="panel"><div class="panel-title"><h2>Сегодня · ${prettyDate(today(),true)}</h2><span>${current} из ${data.habits.length} выполнено</span></div><div class="habit-mini-grid">${data.habits.map(h=>{const done=hasHabitCheck(h.id);return `<button class="habit-tap ${done?'is-checked':''}" data-action="tap-habit" data-id="${escapeHtml(h.id)}" style="--habit-color:${escapeHtml(h.color)}" ${done?'disabled':''}><span class="habit-emoji">${escapeHtml(h.icon)}</span><span class="habit-text">${escapeHtml(h.title)}</span><span class="habit-tick">${done?'✓':'+'}</span></button>`;}).join('')||'<div class="empty">Ни одной привычки. Начни с одной небольшой.</div>'}</div></div>
      <div class="panel"><div class="panel-title"><h2>Текущая неделя</h2><span class="subnote">Даты и дни недели</span></div><div class="habit-table-wrap"><table class="habit-table"><thead><tr><th>Привычка</th>${week.map(day=>`<th class="${day===today()?'habit-today':''}">${escapeHtml(dateObj(day).toLocaleDateString('ru-RU',{weekday:'short'}))}<small>${day.slice(8)}</small></th>`).join('')}<th>Всего</th><th>Действия</th></tr></thead><tbody>${data.habits.map(h=>`<tr><td><span class="color-dot" style="background:${escapeHtml(h.color)}"></span> ${escapeHtml(h.icon)} ${escapeHtml(h.title)}</td>${week.map(day=>`<td><span class="habit-mark ${hasHabitCheck(h.id,day)?'yes':'no'}">${day>today()?'·':hasHabitCheck(h.id,day)?'✓':'–'}</span></td>`).join('')}<td>${habitCounter(h)}</td><td><button class="icon-btn" data-action="edit-habit" data-id="${escapeHtml(h.id)}" title="Редактировать">✎</button><button class="icon-btn" data-action="delete-habit" data-id="${escapeHtml(h.id)}" title="Удалить">✕</button></td></tr>`).join('')||'<tr><td colspan="10">Пока нет привычек</td></tr>'}</tbody></table></div><p class="subnote">Отметка сохраняется с местной календарной датой устройства. Время телефона должно быть настроено правильно. После изменения часового пояса ориентиром становится дата устройства.</p></div>`;
  }
  function renderTasks(){
    const list=visibleTasks();
    const controls=`<select id="task-sort" aria-label="Сортировать задачи">${Object.entries(TASK_SORTS).map(([value,label])=>`<option value="${value}" ${data.taskSort===value?'selected':''}>${label}</option>`).join('')}</select>`;
    const hint=data.taskSort==='manual'&&!query?'Порядок можно изменить: перетащи за значок ⠿ или нажми ↑ ↓. На телефоне используй стрелки.':data.taskSort==='manual'?'Чтобы менять порядок вручную, очисти поиск.':'Для ручного перетаскивания выбери «Мой порядок».';
    return `${heading('ПРОЕКТЫ И ПОВСЕДНЕВНОСТЬ','Задачи','«В работе», «Запланировано» и «Выполнено» не смешиваются.','<button class="btn btn-accent" data-action="add-task">+ Добавить задачу</button>')}
      ${renderHabitsWidget()}
      <div class="toolbar"><select id="task-filter" aria-label="Фильтр задач">${Object.entries({doing:'В работе',todo:'Запланировано',done:'Выполненные',all:'Все задачи'}).map(([v,l])=>`<option value="${v}" ${taskFilter===v?'selected':''}>${l} (${v==='all'?data.tasks.length:data.tasks.filter(t=>t.status===v).length})</option>`).join('')}</select>${controls}<input class="grow" id="task-search" placeholder="Поиск по задачам" value="${escapeHtml(query)}" aria-label="Поиск по задачам"><span style="color:var(--muted);font-size:12px">Найдено: ${list.length}</span></div><p class="task-order-hint">${hint}</p><div class="task-list">${list.length?list.map(t=>taskRow(t)).join(''):'<div class="empty">В этой категории пока ничего нет. Изменить статус можно в редакторе задачи.</div>'}</div>`;
  }
  function renderContent(){return `${heading('КОНТЕНТ-КАЛЕНДАРЬ','Публикации','Перетаскивать карточки не требуется: меняй стадию внизу каждого поста. Сюда можно складывать даже сырые идеи.','<button class="btn btn-accent" data-action="add-post">+ Новая публикация</button>')}<div class="kanban">${Object.entries(STAGES).map(([stage,label])=>{const list=data.posts.filter(p=>p.status===stage).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));return `<section class="lane"><div class="lane-header"><h3>${label}</h3><span>${list.length}</span></div>${list.map(p=>`<article class="post-card"><div class="post-channel">${escapeHtml(p.channel)} · ${escapeHtml(p.format)}</div><div class="post-title">${escapeHtml(p.title)}</div><div class="post-sub">${prettyDate(p.date)} · ${escapeHtml(projectLabel(p.projectId))}</div>${p.notes?`<div class="post-note">${escapeHtml(p.notes)}</div>`:''}${p.link?`<div style="margin-top:7px"><a href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer" style="font-size:11px">Открыть публикацию ↗</a></div>`:''}<div class="post-controls"><select data-post-stage="${escapeHtml(p.id)}" aria-label="Статус поста ${escapeHtml(p.title)}">${Object.entries(STAGES).map(([v,l])=>`<option value="${v}" ${stage===v?'selected':''}>${l}</option>`).join('')}</select><button class="icon-btn" data-action="edit-post" data-id="${escapeHtml(p.id)}" title="Изменить">✎</button><button class="icon-btn" data-action="copy-post" data-id="${escapeHtml(p.id)}" title="Создать копию">⧉</button><button class="icon-btn" data-action="delete-post" data-id="${escapeHtml(p.id)}" title="Удалить">✕</button></div></article>`).join('')||'<div style="font-size:12px;color:#758293;text-align:center;padding:18px 5px">Пока пусто</div>'}</section>`;}).join('')}</div>`;}
  function studyMinutes(x){return (x.sessions||[]).reduce((sum,y)=>sum+n(y.minutes),0);}
  function lessonsWord(v){const a=v%100,b=v%10;return a>=11&&a<=14?'занятий':b===1?'занятие':b>=2&&b<=4?'занятия':'занятий';}
  function formatMinutes(v){const h=Math.floor(v/60),m=v%60;return [h?`${h} ч`:'',m?`${m} мин`:''].filter(Boolean).join(' ')||'0 мин';}
  function universitySessionLabel(id){return data.universitySessions.find(x=>x.id===id)?.title||'Без сессии';}
  function academicOverdue(x){return x.status!=='passed'&&Boolean(x.due)&&x.due<today();}
  function uniSubject(id){return data.universitySubjects.find(s=>s.id===id);}
  function uniWorkSteps(work){const list=work.subtasks||[];const done=list.filter(s=>s.done).length;return {done,total:list.length,pct:list.length?Math.round(done/list.length*100):0};}
  function subjectOptions(value){return `<option value="">Выбери предмет</option>`+data.universitySubjects.map(s=>`<option value="${escapeHtml(s.id)}" ${value===s.id?'selected':''}>${escapeHtml(s.title)}${s.sessionId?' · '+escapeHtml(universitySessionLabel(s.sessionId)):''}</option>`).join('');}
  function uniWorkCard(x){
    const overdue=academicOverdue(x),count=uniWorkSteps(x);
    const steps=(x.subtasks||[]).map(st=>`<div class="uni-step"><label class="uni-step-label"><input type="checkbox" class="check" data-uni-step="${escapeHtml(st.id)}" data-work="${escapeHtml(x.id)}" ${st.done?'checked':''}><span class="${st.done?'uni-checked':''}">${escapeHtml(st.title)}</span></label><div class="study-buttons"><button class="icon-btn" data-action="edit-uni-step" data-id="${escapeHtml(st.id)}" data-work="${escapeHtml(x.id)}" title="Изменить шаг" aria-label="Изменить шаг">✎</button><button class="icon-btn" data-action="delete-uni-step" data-id="${escapeHtml(st.id)}" data-work="${escapeHtml(x.id)}" title="Удалить шаг" aria-label="Удалить шаг">✕</button></div></div>`).join('');
    return `<article class="academic-card uni-work ${x.status==='passed'?'uni-work-done':''}" data-uni-work-id="${escapeHtml(x.id)}">
      <div class="uni-work-top"><label class="uni-work-complete"><input type="checkbox" class="check" data-uni-work-check="${escapeHtml(x.id)}" ${x.status==='passed'?'checked':''} aria-label="Закрыть работу ${escapeHtml(x.title)}"></label><div class="uni-work-body"><div class="academic-card-head"><span class="tag">${ACADEMIC_TYPES[x.type]}</span><span class="pill ${x.status==='passed'?'done':x.status==='debt'||overdue?'overdue':''}">${ACADEMIC_STATUSES[x.status]}</span></div><h3 class="uni-work-title">${escapeHtml(x.title)}</h3><div class="row-sub">${x.due?`${overdue?'Просрочено: ':'Срок: '}${prettyDate(x.due,true)}`:'Без срока'} · ${PRIORITIES[x.priority]} · Шаги: ${count.done}/${count.total}</div></div><div class="study-buttons"><button class="icon-btn" data-action="edit-academic" data-id="${escapeHtml(x.id)}" title="Редактировать работу" aria-label="Редактировать работу">✎</button><button class="icon-btn" data-action="delete-academic" data-id="${escapeHtml(x.id)}" title="Удалить работу" aria-label="Удалить работу">✕</button></div></div>
      ${count.total?`<div class="progress uni-work-progress"><span style="width:${count.pct}%"></span></div>`:''}
      <div class="uni-steps" aria-label="Подзадачи работы">${steps}</div>
      <form class="uni-quick-form" data-uni-quick="${escapeHtml(x.id)}"><input name="step" required maxlength="300" placeholder="Новый шаг (например, чертёж №1)" aria-label="Новая подзадача для ${escapeHtml(x.title)}"><button class="btn btn-small" type="submit">+ Шаг</button></form>
      ${count.total&&count.done===count.total&&x.status!=='passed'?'<p class="subnote">Все шаги готовы. Отметь работу закрытой после сдачи или принятия преподавателем.</p>':''}
      ${x.nextStep?`<p class="row-sub">Следующее действие: ${escapeHtml(x.nextStep)}</p>`:''}${x.notes?`<p class="academic-notes">${escapeHtml(x.notes)}</p>`:''}
      <div class="uni-work-footer"><select data-academic-status="${escapeHtml(x.id)}" aria-label="Статус работы ${escapeHtml(x.title)}">${optionList(ACADEMIC_STATUSES,x.status)}</select></div>
    </article>`;
  }
  function uniSubjectCard(sub,works){
    const state=window.MasterskayaUniversity.condition(sub,works,today());
    const closed=works.filter(x=>x.status==='passed').length;
    const filtered=works.filter(x=>academicFilter==='all'||(academicFilter==='doing'?['progress','ready','submitted','debt'].includes(x.status):academicFilter==='planned'?x.status==='planned':academicFilter==='passed'?x.status==='passed':academicFilter==='debt'?x.status==='debt'||academicOverdue(x):ACADEMIC_EXAMS.has(x.type)));
    filtered.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    return `<section class="panel uni-subject" data-uni-subject-id="${escapeHtml(sub.id)}"><div class="uni-subject-head"><div class="uni-subject-info"><div class="eyebrow">ПРЕДМЕТ</div><h2>${escapeHtml(sub.title)}</h2><p class="uni-subject-meta">${sub.teacher?'Преподаватель: '+escapeHtml(sub.teacher)+' · ':''}${escapeHtml(universitySessionLabel(sub.sessionId))}${sub.due?' · Общий срок: '+prettyDate(sub.due,true):''}</p><div class="uni-subject-tags"><span class="pill ${state.key==='debt'||state.key==='overdue'?'overdue':state.key==='complete'?'done':''}">${state.label}</span><span class="tag">${closed} / ${works.length} работ закрыто</span></div>${sub.notes?`<p class="row-sub">${escapeHtml(sub.notes)}</p>`:''}</div><div class="study-buttons"><button class="btn btn-small btn-accent" data-action="add-academic" data-subject="${escapeHtml(sub.id)}">+ Работа</button><button class="icon-btn" data-action="edit-uni-subject" data-id="${escapeHtml(sub.id)}" title="Редактировать предмет" aria-label="Редактировать предмет">✎</button><button class="icon-btn" data-action="delete-uni-subject" data-id="${escapeHtml(sub.id)}" title="Удалить предмет" aria-label="Удалить предмет">✕</button></div></div>
      <div class="uni-work-list">${filtered.map(uniWorkCard).join('')||'<div class="empty">В выбранной категории работ нет. Нажми «+ Работа», чтобы добавить ЛР, КР или экзамен.</div>'}</div></section>`;
  }
  function renderUniversity(){
    const tabs=[['attendance','Посещаемость'],['works','Работы и долги'],['sessions','Сессии']];
    return `${heading('УНИВЕРСИТЕТ','ВУЗ','Предметы, вложенные работы, подзадачи, посещаемость и сессии.','<button class="btn btn-accent" data-action="add-uni-subject">+ Предмет</button>')}
      <div class="university-tabs" role="group" aria-label="Разделы университета">${tabs.map(([key,title])=>`<button class="uni-tab ${universityTab===key?'active':''}" type="button" data-action="uni-tab" data-tab="${key}" aria-pressed="${universityTab===key}">${title}</button>`).join('')}</div>
      ${universityTab==='attendance'?renderUniversityAttendance():universityTab==='works'?renderUniversityWorks():renderUniversitySessions()}`;
  }
  function scheduleOccurs(schedule,date){
    const weekday=dateObj(date).getDay()||7;
    if(weekday!==schedule.weekday)return false;
    if(schedule.parity==='every')return true;
    if(!data.universityWeekAnchor)return false;
    const week=weekNumberRelative(date,data.universityWeekAnchor);
    return (Math.abs(week)%2) === (schedule.parity==='odd'?1:0);
  }
  function scheduleInstances(from,to){
    const rows=[]; let cursor=dateObj(from);let end=dateObj(to);
    for(let day=0;cursor<=end&&day<365;day++,cursor=shiftDate(cursor,1)){
      const date=iso(cursor);
      for(const schedule of data.timetable){if(scheduleOccurs(schedule,date))rows.push({...schedule,scheduleId:schedule.id,date});}
    }
    return rows;
  }
  function attendanceRecord(scheduleId,date){return data.attendance.find(x=>x.scheduleId===scheduleId&&x.date===date);}
  function attendanceItems(from,to){
    const base=scheduleInstances(from,to).map(x=>{
      const record=attendanceRecord(x.scheduleId,x.date);
      // Уже сохранённые посещения сохраняют название дисциплины и время на момент записи.
      return {...x,...(record?{subject:record.subject,teacher:record.teacher,kind:record.kind,start:record.start,end:record.end}:{}),record};
    });
    // Сохраняем отдельные занятия и историю после удаления шаблона расписания.
    const ids=new Set(base.map(x=>x.scheduleId+'|'+x.date));
    for(const x of data.attendance){if(x.date>=from&&x.date<=to&&(!x.scheduleId||!ids.has(x.scheduleId+'|'+x.date))){
      base.push({...x,scheduleId:x.scheduleId||'',record:x,manual:true});
    }}
    return base.sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'').localeCompare(b.start||'')||a.subject.localeCompare(b.subject,'ru'));
  }
  function attendanceStats(records){
    const count={attended:0,missed:0,excused:0,cancelled:0};
    records.forEach(x=>{if(Object.hasOwn(count,x.status))count[x.status]++;});
    const denom=count.attended+count.missed+count.excused;
    return {...count,considered:denom,percent:denom?Math.round(count.attended/denom*100):null};
  }
  function lessonStatusLabel(item,date,start=''){
    if(item?.status==='attended')return 'Посещено';
    if(item?.status&&ATTENDANCE_STATUSES[item.status])return ATTENDANCE_STATUSES[item.status];
    if(date>today()||(date===today()&&start&&start>new Date().toTimeString().slice(0,5)))return 'Предстоит';
    return 'Не отмечено';
  }
  function lessonCheck(x){
    const record=x.record;
    return `<label class="lesson-check"><input type="checkbox" class="check" data-attendance-check="1" data-attendance-id="${escapeHtml(record?.id||'')}" data-schedule-id="${escapeHtml(x.scheduleId||'')}" data-date="${escapeHtml(x.date)}" aria-label="Посетил: ${escapeHtml(x.subject)}" ${record?.status==='attended'?'checked':''}><span>Посетил</span></label>`;
  }
  function attendanceLessonRow(x){
    const item=x.record, status=item?.status||'', title=LESSON_TYPES[x.kind]||'Пара';
    const meta=[title,x.start?(x.start+(x.end?'–'+x.end:'')):'',x.teacher||''].filter(Boolean).map(escapeHtml).join(' · ');
    const actions=item?`<button class="icon-btn" data-action="edit-attendance" data-id="${escapeHtml(item.id)}" aria-label="Редактировать пару">✎</button><button class="icon-btn" data-action="delete-attendance" data-id="${escapeHtml(item.id)}" aria-label="Удалить запись о паре" title="Удалить пару из журнала">✕</button>`:
      `<button class="icon-btn" data-action="edit-lesson-instance" data-id="${escapeHtml(x.scheduleId)}" data-date="${x.date}" aria-label="Редактировать пару">✎</button>`;
    return `<div class="lesson-row ${status?'lesson-'+status:''}"><div class="lesson-main"><strong>${escapeHtml(x.subject)}</strong><span class="lesson-meta">${meta}</span><span class="lesson-status ${status==='attended'?'is-attended':''}">${escapeHtml(lessonStatusLabel(item,x.date,x.start))}</span>${item?.notes?`<small class="lesson-note">${escapeHtml(item.notes)}</small>`:''}</div>
      <div class="lesson-actions">${lessonCheck(x)}${actions}<button class="btn btn-small" data-action="make-academic-lesson" data-id="${escapeHtml(x.scheduleId||'')}" data-record="${escapeHtml(item?.id||'')}" data-date="${x.date}" title="Создать учебную работу по паре">+ Работа</button></div></div>`;
  }
  function renderAttendanceGraph(){
    const weekly=[];const monday=getMonday(new Date());
    for(let i=5;i>=0;i--){const from=iso(shiftDate(monday,-7*i)),to=iso(shiftDate(dateObj(from),6));
      const d=attendanceStats(data.attendance.filter(x=>x.date>=from&&x.date<=to));
      weekly.push({from,percent:d.percent,attended:d.attended,missed:d.missed,excused:d.excused});}
    return `<div class="attendance-chart" aria-label="Посещаемость по неделям">${weekly.map((w,i)=>`<div class="attendance-bar-col" title="${prettyDate(w.from,true)}: ${w.percent===null?'нет отметок':w.percent+'%'}"><div class="attendance-bar-track"><div class="attendance-bar-fill" style="height:${w.percent??0}%"></div></div><span>${w.percent===null?'—':w.percent+'%'}</span><small>${i===5?'Эта':prettyDate(w.from)}</small></div>`).join('')}</div><p class="subnote">Процент = посещённые / (посещённые + пропущенные + уважительные) × 100. Отменённые и неотмеченные не учитываются. Отдых и отсутствие отметок не считаются пропусками.</p>`;
  }
  function renderUniversityAttendance(){
    const counts=attendanceStats(data.attendance); const from=attendanceStart,to=iso(shiftDate(dateObj(from),13));
    const items=attendanceItems(from,to);const grouped=new Map();for(const x of items){if(!grouped.has(x.date))grouped.set(x.date,[]);grouped.get(x.date).push(x);}
    const subjects=[...new Set([...data.timetable.map(x=>x.subject),...data.attendance.map(x=>x.subject)])].sort((a,b)=>a.localeCompare(b,'ru'));
    const rows=subjects.map(subject=>{const stats=attendanceStats(data.attendance.filter(x=>x.subject===subject));return `<tr><td>${escapeHtml(subject)}</td><td>${stats.attended}</td><td>${stats.missed}</td><td>${stats.excused}</td><td>${stats.percent===null?'—':stats.percent+'%'}</td></tr>`;}).join('');
    const needsAnchor=data.timetable.some(x=>x.parity!=='every')&&!data.universityWeekAnchor;
    return `<div class="study-summary"><div class="stat-card"><div class="stat-icon">✓</div><div class="stat-value">${counts.attended}</div><div class="stat-label">Посетил пар</div></div><div class="stat-card"><div class="stat-icon">○</div><div class="stat-value">${counts.missed}</div><div class="stat-label">Пропустил</div></div><div class="stat-card"><div class="stat-icon">◷</div><div class="stat-value">${counts.excused}</div><div class="stat-label">Уважительная причина</div></div><div class="stat-card"><div class="stat-icon">▥</div><div class="stat-value">${counts.percent===null?'—':counts.percent+'%'}</div><div class="stat-label">Посещаемость по отметкам</div></div></div>
      <div class="panel journal-panel"><div class="panel-title"><h2>Журнал посещений</h2><div class="actions-inline"><button class="btn btn-small btn-accent" data-action="add-attendance">+ Добавить пару в журнал</button><button class="btn btn-small" data-action="add-timetable">+ Повторяющееся расписание</button></div></div>
      <p class="subnote">Добавляй разовые пары прямо в журнал, даже если они ещё предстоят. Галочка «Посетил» меняет только отметку, но не удаляет занятие. Для регулярных занятий есть повторяющееся расписание.</p>
      <div class="attendance-nav"><button class="btn btn-small" data-action="attendance-prev">← Ранее</button><button class="btn btn-small" data-action="attendance-today">Текущая неделя</button><button class="btn btn-small" data-action="attendance-next">Позже →</button><span>${prettyDate(from,true)} — ${prettyDate(to,true)}</span></div>
      ${needsAnchor?'<div class="warning">В расписании есть пары по чётным/нечётным неделям. Сначала укажи первую нечётную неделю ниже, иначе такие пары не появятся в журнале.</div>':''}
      <div class="lesson-days">${[...grouped].map(([date,lessons])=>`<section class="lesson-day"><div class="lesson-day-title"><b>${new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</b><span>${lessons.length} пар</span></div>${lessons.map(attendanceLessonRow).join('')}</section>`).join('')||'<div class="empty">На эти две недели пар нет. Нажми «Добавить пару в журнал», чтобы запланировать занятие.</div>'}</div></div>
      <div class="attendance-panels"><div class="panel"><div class="panel-title"><h2>Посещаемость по неделям</h2></div>${renderAttendanceGraph()}</div>
      <div class="panel"><div class="panel-title"><h2>По дисциплинам</h2></div><div class="table-scroll"><table class="attendance-table"><thead><tr><th>Предмет</th><th>✓</th><th>Проп.</th><th>Уваж.</th><th>%</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Пока нет дисциплин</td></tr>'}</tbody></table></div></div></div>
      <div class="panel"><div class="panel-title"><h2>Повторяющееся расписание</h2><button class="text-button" data-action="add-timetable">+ Добавить пару</button></div>
      <div class="week-anchor"><label for="uni-week-anchor">Дата в первой нечётной неделе семестра</label><input type="date" id="uni-week-anchor" value="${escapeHtml(data.universityWeekAnchor)}"><span>Нужна только для чётных и нечётных недель. Можно выбрать любой день первой нечётной недели.</span></div>
      <div class="timetable-list">${[...data.timetable].sort((a,b)=>a.weekday-b.weekday||a.start.localeCompare(b.start)).map(x=>`<div class="timetable-row"><div><strong>${escapeHtml(x.subject)}</strong><div class="lesson-meta">${WEEK_DAYS[x.weekday]} · ${x.start}–${x.end} · ${LESSON_TYPES[x.kind]} · ${WEEK_PARITIES[x.parity]}${x.teacher?' · '+escapeHtml(x.teacher):''}</div></div><div class="study-buttons"><button class="icon-btn" data-action="edit-timetable" data-id="${escapeHtml(x.id)}" aria-label="Редактировать">✎</button><button class="icon-btn" data-action="delete-timetable" data-id="${escapeHtml(x.id)}" aria-label="Удалить">✕</button></div></div>`).join('')||'<div class="empty">Расписание пока пустое. Добавь первую пару, чтобы её можно было отмечать каждую неделю.</div>'}</div>
      <p class="subnote">Изменение или удаление расписания не стирает уже сделанные отметки о посещениях.</p></div>`;
  }
  function renderUniversityWorks(){
    const works=data.academic,total=works.length,debts=works.filter(x=>x.status==='debt').length;
    const overdue=works.filter(x=>academicOverdue(x)&&x.status!=='debt').length;
    const upcoming=works.filter(x=>x.status!=='passed'&&x.due&&x.due>=today()&&x.due<=iso(shiftDate(new Date(),14))).length;
    const passed=works.filter(x=>x.status==='passed').length;
    const subjects=[...data.universitySubjects].sort((a,b)=>String(a.title).localeCompare(String(b.title),'ru'));
    const shown=subjects.filter(x=>(academicSubjectFilter==='all'||x.id===academicSubjectFilter)&&(academicSessionFilter==='all'||(academicSessionFilter==='none'?!x.sessionId:x.sessionId===academicSessionFilter)));
    return `<div class="study-summary"><div class="stat-card"><div class="stat-icon">!</div><div class="stat-value">${debts}</div><div class="stat-label">Учебных долгов</div></div><div class="stat-card"><div class="stat-icon">◷</div><div class="stat-value">${overdue}</div><div class="stat-label">Просрочено без долга</div></div><div class="stat-card"><div class="stat-icon">▤</div><div class="stat-value">${upcoming}</div><div class="stat-label">Сдач за 14 дней</div></div><div class="stat-card"><div class="stat-icon">✓</div><div class="stat-value">${passed} / ${total}</div><div class="stat-label">Закрыто работ</div></div></div>
      <div class="panel-title academic-list-header"><h2>Предметы и работы</h2><span>${subjects.length} предметов · ${total} работ</span></div>
      <div class="toolbar"><select id="academic-filter" aria-label="Фильтр учебных работ">${Object.entries({all:'Все работы',doing:'В работе',planned:'Запланировано',debt:'Долги и просроченное',exams:'Зачёты и экзамены',passed:'Закрытые'}).map(([v,label])=>`<option value="${v}" ${academicFilter===v?'selected':''}>${label}</option>`).join('')}</select><select id="academic-subject-filter" aria-label="Фильтр по предметам"><option value="all">Все предметы</option>${subjects.map(x=>`<option value="${escapeHtml(x.id)}" ${academicSubjectFilter===x.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><select id="academic-session-filter" aria-label="Фильтр по сессиям"><option value="all">Все сессии</option><option value="none" ${academicSessionFilter==='none'?'selected':''}>Без сессии</option>${data.universitySessions.map(x=>`<option value="${escapeHtml(x.id)}" ${academicSessionFilter===x.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><button class="btn btn-small btn-accent" data-action="add-uni-subject">+ Предмет</button><button class="btn btn-small" data-action="add-academic">+ Работа</button></div>
      <p class="subnote">Структура: предмет → работа (ЛР, КР, зачёт) → небольшие шаги. Галочка шага означает выполнение шага, но <b>не закрывает автоматически работу</b>: её нужно отдельно сдать. «Долг» ставится вручную, «Просрочено без долга» рассчитывается по датам.</p>
      <div class="uni-subject-list">${shown.map(sub=>uniSubjectCard(sub,works.filter(x=>x.subjectId===sub.id))).join('')||'<div class="panel empty">Предметов пока нет. Создай первый предмет и добавь к нему работы.</div>'}</div>`;
  }
  function renderUniversitySessions(){
    const sessions=[...data.universitySessions].sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999'));
    return `      <div class="panel"><div class="panel-title"><h2>Сессии и экзаменационные периоды</h2><button class="text-button" data-action="add-session">+ Добавить период</button></div>
      <div class="session-grid">${sessions.map(x=>`<div class="session-card"><div><h3>${escapeHtml(x.title)}</h3><p>${x.start?prettyDate(x.start,true):'Дата начала не задана'}${x.end?' — '+prettyDate(x.end,true):''}</p><span>${data.universitySubjects.filter(a=>a.sessionId===x.id).length} предметов · ${data.academic.filter(a=>a.sessionId===x.id).length} работ</span>${x.notes?`<p>${escapeHtml(x.notes)}</p>`:''}</div><div class="study-buttons"><button class="icon-btn" data-action="edit-session" data-id="${escapeHtml(x.id)}" aria-label="Редактировать сессию">✎</button><button class="icon-btn" data-action="delete-session" data-id="${escapeHtml(x.id)}" aria-label="Удалить сессию">✕</button></div></div>`).join('')||'<div class="row-sub">Добавь, например, зимнюю сессию и диапазон дат. Сдачи и экзамены появятся ниже отдельными карточками.</div>'}</div></div>
<div class="panel study-hint"><p>Здесь хранятся периоды сессий. Создай предмет в разделе «Работы и долги» и выбери эту сессию. Затем добавляй внутрь предмета зачёты, лабораторные, курсовые и их шаги.</p><button class="btn btn-accent" data-action="add-uni-subject">+ Добавить предмет</button></div>`;
  }
  function renderCalendar(){
    const first=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth(),1),start=shiftDate(first,-(first.getDay()+6)%7),ym=iso(first).slice(0,7);
    const monthName=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
    const markers=[];
    for(const x of data.posts)if(x.date)markers.push({date:x.date,text:`Публикация · ${x.channel} · ${x.title}`,short:`${CHANNEL_SHORT[x.channel]} · ${x.title}`,type:'post',done:x.status==='published'});
    for(const x of data.tasks)if(x.due)markers.push({date:x.due,text:`Задача · ${x.title}`,short:`✓ ${x.title}`,type:'task',done:x.status==='done'});
    for(const x of data.academic)if(x.due)markers.push({date:x.due,text:`ВУЗ · ${x.subject?x.subject+' · ':''}${x.title}`,short:`▥ ${x.title}`,type:'academic',done:x.status==='passed'});
    for(const x of data.universitySessions){if(x.start)markers.push({date:x.start,text:`Начало сессии · ${x.title}`,short:`▥ ${x.title}`,type:'session',done:false});if(x.end)markers.push({date:x.end,text:`Конец сессии · ${x.title}`,short:`▥ ${x.title}`,type:'session',done:false});}
    // Повторяющиеся пары показываем в календаре в пределах видимых 42 дней.
    const last=iso(shiftDate(start,41));
    for(const x of attendanceItems(iso(start),last))markers.push({date:x.date,text:`Пара · ${x.subject} · ${ATTENDANCE_STATUSES[x.record?.status]||'не отмечено'}`,short:`▣ ${x.subject}`,type:'attendance',done:x.record?.status==='attended'});
    let days='';
    for(let i=0;i<42;i++){const d=shiftDate(start,i),ds=iso(d),month=d.getMonth()===first.getMonth();const items=markers.filter(x=>x.date===ds);days+=`<div class="calendar-day ${month?'':'muted'} ${ds===today()?'today':''}"><div class="calendar-date">${d.getDate()}</div>${items.slice(0,5).map(x=>`<span class="calendar-item ${x.type} ${x.done?'done':''}" title="${escapeHtml(x.text)}">${escapeHtml(x.short)}</span>`).join('')}${items.length>5?`<small style="color:#9ca6b7">ещё ${items.length-5}</small>`:''}</div>`;}
    const agenda=markers.filter(x=>monthOf(x.date)===ym).sort((a,b)=>a.date.localeCompare(b.date));
    return `${heading('РАСПИСАНИЕ','Календарь','Публикации, задачи, пары, дедлайны по вузу и границы сессий в одном месте.','<button class="btn btn-accent" data-action="add-academic">+ Сдача в вузе</button>')}<div class="panel"><div class="calendar-top"><h2>${escapeHtml(monthName)}</h2><div class="calendar-controls"><button class="btn btn-small" data-action="prev-month" aria-label="Предыдущий месяц">←</button><button class="btn btn-small" data-action="current-month">Сегодня</button><button class="btn btn-small" data-action="next-month" aria-label="Следующий месяц">→</button></div></div><div class="calendar-desktop"><div class="calendar-head">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${days}</div></div><div class="calendar-mobile">${agenda.map(x=>`<div class="agenda-row"><span class="agenda-date">${prettyDate(x.date)}</span><span class="agenda-type ${x.type}">${x.type==='post'?'▤':x.type==='academic'||x.type==='session'?'▥':x.type==='attendance'?'▣':'☑'}</span><span class="agenda-text">${escapeHtml(x.text)}</span></div>`).join('')||'<div class="empty">На этот месяц ничего не запланировано.</div>'}</div><div class="subnote" style="margin-top:15px">Горчичный = публикации · Голубой = задачи · Фиолетовый = вуз и сессии · Бирюзовый = пары. На телефоне отображается список событий.</div></div>`;
  }
  function projectTaskItem(t){
    const st=subtaskStats(t);
    return `<div class="project-task-row"><input type="checkbox" class="check" data-check-task="${escapeHtml(t.id)}" ${t.status==='done'?'checked':''} aria-label="Выполнено: ${escapeHtml(t.title)}"><div class="project-task-text"><div class="row-title ${t.status==='done'?'is-done':''}">${escapeHtml(t.title)}</div><div class="row-sub">${TASK_STATES[t.status]} · ${t.due?prettyDate(t.due,true):'Без срока'} · ${PRIORITIES[t.priority]}${st.total?` · ${st.done}/${st.total} шагов`:''}</div></div><div class="project-task-actions"><select class="task-status-control" data-task-status="${escapeHtml(t.id)}" aria-label="Статус задачи ${escapeHtml(t.title)}">${optionList(TASK_STATES,t.status)}</select><button class="btn btn-small" data-action="go-to-task" data-id="${escapeHtml(t.id)}" aria-label="Открыть задачу ${escapeHtml(t.title)}">Открыть ↗</button><button class="icon-btn" data-action="edit-task" data-id="${escapeHtml(t.id)}" aria-label="Редактировать задачу ${escapeHtml(t.title)}" title="Редактировать">✎</button></div></div>`;
  }
  function renderProjectDetail(p){
    const tasks=orderedTasks(data.tasks.filter(t=>t.projectId===p.id));
    const active=tasks.filter(t=>t.status==='doing'),planned=tasks.filter(t=>t.status==='todo'),done=tasks.filter(t=>t.status==='done');
    const posts=data.posts.filter(t=>t.projectId===p.id);
    const percent=tasks.length?Math.round(done.length/tasks.length*100):0;
    return `<button class="btn btn-small project-back" data-action="back-projects">← Все проекты</button>
      ${heading('КАРТОЧКА ПРОЕКТА',escapeHtml(p.name),'Все связанные задачи доступны здесь. Можно изменить статус, редактировать запись или перейти к полной карточке задачи.',`<button class="btn btn-accent" data-action="add-task" data-project="${escapeHtml(p.id)}">+ Задача для проекта</button><button class="btn" data-action="edit-project" data-id="${escapeHtml(p.id)}">Изменить проект</button>`)}
      <div class="project-detail-summary"><div class="stat-card"><div class="stat-icon">☑</div><div class="stat-value">${active.length}</div><div class="stat-label">В работе</div></div><div class="stat-card"><div class="stat-icon">◷</div><div class="stat-value">${planned.length}</div><div class="stat-label">Запланировано</div></div><div class="stat-card"><div class="stat-icon">✓</div><div class="stat-value">${done.length}</div><div class="stat-label">Выполнено</div></div><div class="stat-card"><div class="stat-icon">▤</div><div class="stat-value">${posts.length}</div><div class="stat-label">Публикаций</div></div></div>
      <div class="panel project-progress-panel"><div class="social-meta"><strong>Готовность задач проекта</strong><span>${done.length} / ${tasks.length} · ${percent}%</span></div><div class="progress"><span style="width:${percent}%"></span></div><div class="subnote">Считаются завершённые основные задачи. Если задача разбита на шаги, их прогресс виден в её карточке.</div></div>
      <div class="project-task-sections"><section class="panel project-section"><div class="panel-title"><h2>В работе</h2><span class="project-section-count">${active.length}</span></div>${active.length?active.map(projectTaskItem).join(''):'<div class="empty">Активных задач пока нет.</div>'}</section>
      <section class="panel project-section"><div class="panel-title"><h2>Запланировано</h2><span class="project-section-count">${planned.length}</span></div>${planned.length?planned.map(projectTaskItem).join(''):'<div class="empty">Запланированных задач нет.</div>'}</section>
      <section class="panel project-section"><div class="panel-title"><h2>Выполнено</h2><span class="project-section-count">${done.length}</span></div>${done.length?done.map(projectTaskItem).join(''):'<div class="empty">Выполненных задач пока нет.</div>'}</section></div>`;
  }
  function renderProjects(){
    if(selectedProjectId){const p=project(selectedProjectId);if(p)return renderProjectDetail(p);selectedProjectId=null;}
    return `${heading('КАРТА ТВОРЧЕСТВА','Проекты','Открой проект, чтобы увидеть его текущие и завершённые задачи и перейти к любой из них.','<button class="btn btn-accent" data-action="add-project">+ Новый проект</button>')}<div class="project-grid">${data.projects.map(p=>{const tasks=data.tasks.filter(t=>t.projectId===p.id),posts=data.posts.filter(t=>t.projectId===p.id);const active=tasks.filter(t=>t.status==='doing').length,planned=tasks.filter(t=>t.status==='todo').length,done=tasks.filter(t=>t.status==='done').length;return `<div class="project-card"><div class="project-heading"><h2><span class="project-color" style="background:${p.color}"></span>${escapeHtml(p.name)}</h2><button class="icon-btn" data-action="edit-project" data-id="${escapeHtml(p.id)}" title="Переименовать">✎</button></div><p style="font-size:12px;color:var(--muted)">Задачи и публикации этого направления.</p><div class="project-counts"><span>${active} в работе</span><span>${planned} запланировано</span><span>${done} выполнено</span><span>${posts.length} публикаций</span></div><div class="actions-inline" style="margin-top:15px"><button class="btn btn-accent btn-small" data-action="open-project" data-id="${escapeHtml(p.id)}">Открыть проект ↗</button><button class="btn btn-small" data-action="add-task" data-project="${escapeHtml(p.id)}">+ Задача</button><button class="btn btn-small btn-danger" data-action="delete-project" data-id="${escapeHtml(p.id)}">Удалить</button></div></div>`;}).join('')}</div>`;
  }
  function renderSettings(){return `${heading('ЛИЧНЫЕ НАСТРОЙКИ','Цели и резервная копия','Цели нужны как ориентир, а не как повод ругать себя за пропущенную неделю.')}<div class="settings-grid"><div class="panel"><div class="panel-title"><h2>Месячные цели по публикациям</h2></div><form id="goals-form">${CHANNELS.map(c=>`<label class="field-row"><span>${escapeHtml(c)}</span><input type="number" name="${escapeHtml(c)}" min="0" max="100" step="1" value="${n(data.goals[c])}" aria-label="Цель для ${escapeHtml(c)}"></label>`).join('')}<button type="submit" class="btn btn-accent" style="margin-top:19px">Сохранить цели</button></form></div><div class="panel"><div class="panel-title"><h2>Данные и перенос</h2></div><p style="color:var(--muted);font-size:13px">Все задачи, публикации, посещения и учебные записи сохраняются в браузере этого устройства. На другой компьютер они сами не переносятся.</p><div class="warning"><b>Обязательно сделай резервную копию.</b><br>Очистка данных браузера или работа в другом профиле может удалить записи.</div><div class="actions-inline" style="margin-top:18px"><button class="btn btn-accent" data-action="export">↓ Скачать JSON-копию</button><button class="btn" data-action="import">↑ Восстановить из JSON</button></div><p class="subnote">Импорт заменяет текущие записи, поэтому перед ним полезно экспортировать копию. Секреты и пароли в планере хранить не нужно.</p></div></div>${data.study.length?`<div class="panel"><div class="panel-title"><h2>Архив самообучения из v2.0</h2></div><p class="subnote">Сохранено ${data.study.length} старых тем. Они остались в резервной копии JSON и не смешиваются с учебными дисциплинами университета.</p>${data.study.slice(0,30).map(x=>`<div class="list-row"><div class="row-title">${escapeHtml(x.title)}</div></div>`).join('')}</div>`:''}<div class="install-card"><h2>Установка на iPhone и iPad</h2><p>Открой сайт в <strong>Safari</strong>. Нажми <strong>«Поделиться»</strong> (квадрат со стрелкой вверх), затем <strong>«На экран Домой»</strong> и <strong>«Добавить»</strong>. Если пункт не виден, прокрути меню «Поделиться» ниже.</p><ol><li>Запускай приложение с появившейся иконки «МАСТЕРСКАЯ».</li><li>После первого открытия с интернетом интерфейс сможет загружаться без сети. Данные сохраняются локально.</li><li>Если используешь планер на компьютере, перенеси задачи через «Скачать JSON-копию» и «Восстановить из JSON».</li></ol><p class="subnote">Важно: данные Safari и версии с экрана «Домой» могут храниться раздельно. Экспортируй копию до перехода. iOS может удалять локальные данные при очистке хранилища; автоматической синхронизации и уведомлений пока нет.</p></div><div class="panel"><div class="panel-title"><h2>Как опубликовать этот сайт на GitHub Pages</h2></div><p style="color:var(--muted);font-size:13px">Загрузи index.html, style.css и app.js в публичный репозиторий, затем открой Settings → Pages и выбери Deploy from a branch → main → / (root). GitHub опубликует сайт по адресу вида username.github.io/repository. Публикуется только код сайта, не твои личные записи из браузера.</p></div>`;}
  function optionList(obj,value){return Object.entries(obj).map(([k,v])=>`<option value="${escapeHtml(k)}" ${value===k?'selected':''}>${escapeHtml(v)}</option>`).join('');}
  function projectOptions(value){return `<option value="">Без проекта</option>`+data.projects.map(p=>`<option value="${escapeHtml(p.id)}" ${value===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');}
  function sessionOptions(value){return `<option value="">Без привязки к сессии</option>`+data.universitySessions.map(x=>`<option value="${escapeHtml(x.id)}" ${value===x.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('');}
  function field(label,name,inner){return `<div class="form-group"><label for="fld-${name}">${label}</label>${inner}</div>`;}
  function input(name,value,attrs=''){return `<input id="fld-${name}" name="${name}" value="${escapeHtml(value)}" ${attrs}>`;}
  function select(name,options){return `<select id="fld-${name}" name="${name}">${options}</select>`;}
  function openEditor(type,id=null,prefProject=''){
    editMode={type,id,parentId:prefProject};let item;
    if(type==='task')item=id?data.tasks.find(t=>t.id===id):{title:'',projectId:prefProject,due:'',priority:'normal',status:'doing',color:'',notes:''};
    if(type==='subtask'){const parent=data.tasks.find(t=>t.id===prefProject);item=parent?(id?parent.subtasks.find(x=>x.id===id):{title:'',done:false}):null;}
    if(type==='work')item=id?data.workSessions.find(x=>x.id===id):{date:today(),minutes:45,area:'3D / Арт',projectId:'',note:''};
    if(type==='post')item=id?data.posts.find(p=>p.id===id):{title:'',projectId:prefProject,date:'',channel:'Telegram',format:'Пост',status:'idea',notes:'',link:''};
    if(type==='project')item=id?data.projects.find(p=>p.id===id):{name:'',color:COLORS[data.projects.length%COLORS.length]};
    if(type==='habit')item=id?data.habits.find(h=>h.id===id):{title:'',icon:'✳',color:'#91b9b0'};
    if(type==='study')item=id?data.study.find(x=>x.id===id):{title:'',area:'3D и материалы',projectId:prefProject,status:'planned',progress:0,due:'',nextStep:'',notes:'',sessions:[]};
    if(type==='study-log')item=data.study.find(x=>x.id===id);
    if(type==='academic')item=id?data.academic.find(x=>x.id===id):{title:'',subjectId:prefProject,subject:'',type:'lab',status:'planned',due:'',priority:'normal',sessionId:'',teacher:'',nextStep:'',notes:'',subtasks:[]};
    if(type==='uni-subject')item=id?uniSubject(id):{title:'',teacher:'',sessionId:'',due:'',debt:false,notes:''};
    if(type==='uni-step'){const work=data.academic.find(x=>x.id===prefProject);item=work?(id?work.subtasks.find(s=>s.id===id):{title:'',done:false}):null;}
    if(type==='session')item=id?data.universitySessions.find(x=>x.id===id):{title:'',start:'',end:'',notes:''};
    if(type==='timetable')item=id?data.timetable.find(x=>x.id===id):{subject:'',teacher:'',weekday:1,start:'09:00',end:'10:30',kind:'lecture',parity:'every',notes:''};
    if(type==='attendance'){
      if(id)item=data.attendance.find(x=>x.id===id);
      else if(typeof prefProject==='string'&&prefProject.includes('|')){
        const [scheduleId,date]=prefProject.split('|'),schedule=data.timetable.find(x=>x.id===scheduleId);
        item=schedule?{scheduleId,date,subject:schedule.subject,teacher:schedule.teacher,kind:schedule.kind,start:schedule.start,end:schedule.end,status:'',notes:''}:null;
      } else item={scheduleId:'',date:today(),subject:'',teacher:'',kind:'lecture',start:'09:00',end:'10:30',status:'',notes:''};
    }
    if(!item)return;
    if(type==='attendance')editMode.prefill={scheduleId:item.scheduleId||''};
    document.querySelector('#editor-title').textContent=(type==='study-log'?'Записать ':id?'Редактировать ':'Добавить ')+(type==='uni-subject'?'предмет':type==='uni-step'?'шаг работы':type==='subtask'?'подзадачу':type==='work'?'рабочую сессию':type==='task'?'задачу':type==='post'?'публикацию':type==='study'?'тему обучения':type==='study-log'?'занятие':type==='academic'?'работу по вузу':type==='session'?'сессию':type==='timetable'?'пару в расписании':type==='attendance'?'пару в журнал':type==='habit'?'привычку':'проект');
    const f=document.querySelector('#editor-fields');
    if(type==='task')f.innerHTML=field('Задача *','title',input('title',item.title,'required maxlength="300" placeholder="Например: подобрать материалы для стены"'))+field('Проект','projectId',select('projectId',projectOptions(item.projectId)))+`<div class="form-cols">${field('Срок','due',input('due',item.due,'type="date"'))}${field('Приоритет','priority',select('priority',optionList(PRIORITIES,item.priority)))}</div>`+field('Состояние','status',select('status',optionList(TASK_STATES,item.status)))+field('Индивидуальный цвет (необязательно)','color',`<div class="color-setting"><input type="color" name="color" id="fld-color" value="${escapeHtml(item.color||'#91b9b0')}"><label class="inline-check"><input type="checkbox" name="customColor" ${item.color?'checked':''}> Свой цвет вместо цвета проекта</label></div>`)+field('Заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Коротко о следующем шаге">${escapeHtml(item.notes)}</textarea>`);
    if(type==='uni-subject')f.innerHTML=field('Название предмета *','title',input('title',item.title,'required maxlength="160" placeholder="Например: Фундаменты"'))+field('Преподаватель','teacher',input('teacher',item.teacher,'maxlength="160" placeholder="Линовский"'))+field('Сессия','sessionId',select('sessionId',sessionOptions(item.sessionId)))+field('Общий срок (при необходимости)','due',input('due',item.due,'type="date"'))+field('Долг','debt',`<label class="inline-check"><input id="fld-debt" type="checkbox" name="debt" ${item.debt?'checked':''}> Пометить предмет как долг (иначе просрочка считается по срокам)</label>`)+field('Заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="10000">${escapeHtml(item.notes)}</textarea>`);
    if(type==='uni-step')f.innerHTML=field('Название маленького шага *','title',input('title',item.title,'required maxlength="300" placeholder="Например: Расчёт КР / Чертёж №1"'));
    if(type==='subtask')f.innerHTML=`<p class="dialog-context">Подзадачи не имеют дедлайна. Отмечай каждый шаг по мере выполнения.</p>`+field('Название шага *','title',input('title',item.title,'required maxlength="300" placeholder="Например: подготовить UV-развёртку"'));
    if(type==='work')f.innerHTML=`<div class="form-cols">${field('Дата','date',input('date',item.date,'type="date" required'))}${field('Время, минуты','minutes',input('minutes',item.minutes,'type="number" min="1" max="1440" required'))}</div>`+field('Направление','area',select('area',WORK_AREAS.map(a=>`<option value="${escapeHtml(a)}" ${item.area===a?'selected':''}>${escapeHtml(a)}</option>`).join('')))+field('Связанный проект','projectId',select('projectId',projectOptions(item.projectId)))+field('Что сделал','note',`<textarea id="fld-note" name="note" maxlength="1000" placeholder="Можно записать даже небольшой шаг">${escapeHtml(item.note)}</textarea>`);
    if(type==='post')f.innerHTML=field('Тема публикации *','title',input('title',item.title,'required maxlength="300" placeholder="Например: как я исправил Weight Paint"'))+`<div class="form-cols">${field('Площадка','channel',select('channel',CHANNELS.map(c=>`<option ${item.channel===c?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')))}${field('Формат','format',select('format',FORMATS.map(c=>`<option ${item.format===c?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')))}</div>`+field('Проект','projectId',select('projectId',projectOptions(item.projectId)))+`<div class="form-cols">${field('Дата','date',input('date',item.date,'type="date"'))}${field('Стадия','status',select('status',optionList(STAGES,item.status)))}</div>`+field('Идея / текст / что подготовить','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Кадры, тезисы, ссылка на исходные материалы…">${escapeHtml(item.notes)}</textarea>`)+field('Ссылка на опубликованный пост','link',input('link',item.link,'type="url" maxlength="2000" placeholder="https://…"'));
    if(type==='study')f.innerHTML=field('Чему хочешь научиться *','title',input('title',item.title,'required maxlength="300" placeholder="Например: Hand-painted материалы"'))+`<div class="form-cols">${field('Направление','area',select('area',STUDY_AREAS.map(a=>`<option value="${escapeHtml(a)}" ${item.area===a?'selected':''}>${escapeHtml(a)}</option>`).join('')))}${field('Состояние','status',select('status',optionList(STUDY_STATES,item.status)))}</div>`+`<div class="form-cols">${field('Прогресс, %','progress',input('progress',item.progress,'type="number" min="0" max="100" step="5"'))}${field('Желаемая дата','due',input('due',item.due,'type="date"'))}</div>`+field('Связанный проект','projectId',select('projectId',projectOptions(item.projectId)))+field('Следующий маленький шаг','nextStep',input('nextStep',item.nextStep,'maxlength="500" placeholder="Протестировать текстуру на модели"'))+field('Материалы и заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Ссылки, важные понятия, заметки…">${escapeHtml(item.notes)}</textarea>`);
    if(type==='study-log')f.innerHTML=`<p class="dialog-context">Тема: ${escapeHtml(item.title)}</p><div class="form-cols">${field('Дата занятия','date',input('date',today(),'type="date" required'))}${field('Продолжительность, мин','minutes',input('minutes',30,'type="number" min="1" max="1440" required'))}</div>`+field('Что получилось / что изучил','note',`<textarea id="fld-note" name="note" maxlength="1000" placeholder="Например: исправил веса на рукавах и проверил деформации"></textarea>`);
    if(type==='academic')f.innerHTML=field('Название работы *','title',input('title',item.title,'required maxlength="300" placeholder="Например: ЛР №1 или КР"'))+field('Предмет *','subjectId',select('subjectId',subjectOptions(item.subjectId)))+`<div class="form-cols">${field('Тип','type',select('type',optionList(ACADEMIC_TYPES,item.type)))}${field('Статус','status',select('status',optionList(ACADEMIC_STATUSES,item.status)))}</div>`+`<div class="form-cols">${field('Срок сдачи','due',input('due',item.due,'type="date"'))}${field('Приоритет','priority',select('priority',optionList(PRIORITIES,item.priority)))}</div>`+field('Следующее действие (необязательно)','nextStep',input('nextStep',item.nextStep,'maxlength="500" placeholder="Например: показать чертёж преподавателю"'))+field('Примечания','notes',`<textarea id="fld-notes" name="notes" maxlength="10000">${escapeHtml(item.notes)}</textarea>`);
    if(type==='timetable')f.innerHTML=field('Дисциплина *','subject',input('subject',item.subject,'required maxlength="160" placeholder="Например: Строительная механика"'))+`<div class="form-cols">${field('День недели','weekday',select('weekday',optionList(WEEK_DAYS,item.weekday)))}${field('Тип пары','kind',select('kind',optionList(LESSON_TYPES,item.kind)))}</div>`+`<div class="form-cols">${field('Начало','start',input('start',item.start,'type="time" required'))}${field('Конец','end',input('end',item.end,'type="time" required'))}</div>`+field('Повторение','parity',select('parity',optionList(WEEK_PARITIES,item.parity)))+field('Преподаватель','teacher',input('teacher',item.teacher,'maxlength="160"'))+field('Заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="1000">${escapeHtml(item.notes)}</textarea>`);
    if(type==='attendance')f.innerHTML=field('Дисциплина *','subject',input('subject',item.subject,'required maxlength="160"'))+`<div class="form-cols">${field('Дата пары','date',input('date',item.date,'type="date" required'))}${field('Отметка посещения','status',select('status',`<option value="" ${!item.status?'selected':''}>Не отмечено (пара остаётся в журнале)</option>`+optionList(ATTENDANCE_STATUSES,item.status)))}</div>`+`<div class="form-cols">${field('Тип пары','kind',select('kind',optionList(LESSON_TYPES,item.kind)))}${field('Преподаватель','teacher',input('teacher',item.teacher,'maxlength="160"'))}</div>`+`<div class="form-cols">${field('Начало','start',input('start',item.start,'type="time"'))}${field('Конец','end',input('end',item.end,'type="time"'))}</div>`+field('Заметки','notes',`<textarea id="fld-notes" name="notes" maxlength="1500" placeholder="Например: тема лекции, что задали">${escapeHtml(item.notes)}</textarea>`);
    if(type==='session')f.innerHTML=field('Название сессии *','title',input('title',item.title,'required maxlength="120" placeholder="Например: Зимняя сессия 2026/27"'))+`<div class="form-cols">${field('Начало','start',input('start',item.start,'type="date"'))}${field('Конец','end',input('end',item.end,'type="date"'))}</div>`+field('Примечания','notes',`<textarea id="fld-notes" name="notes" maxlength="10000" placeholder="Допуски, расписание, важные особенности">${escapeHtml(item.notes)}</textarea>`);
    if(type==='habit')f.innerHTML=field('Название привычки *','title',input('title',item.title,'required maxlength="100" placeholder="Например: читать 20 минут"'))+`<div class="form-cols">${field('Значок (эмодзи или символ)','icon',input('icon',item.icon,'maxlength="10" placeholder="📚"'))}${field('Цвет привычки','color',`<input name="color" id="fld-color" type="color" value="${escapeHtml(item.color)}">`)}</div>`;
    if(type==='project')f.innerHTML=field('Название проекта *','name',input('name',item.name,'required maxlength="90" placeholder="Новый проект"'))+field('Цвет проекта','color',`<input id="fld-color" name="color" type="color" value="${escapeHtml(item.color)}">`);
    editor.showModal();setTimeout(()=>f.querySelector('input')?.focus(),50);
  }
  function saveEntry(){const fd=new FormData(form);const id=editMode.id??safeId();const txt=k=>String(fd.get(k)||'').trim();const type=editMode.type;
    if(type==='task'){const title=txt('title');if(!title)return;const prev=data.tasks.find(x=>x.id===id);const entry={id,title:title.slice(0,300),projectId:txt('projectId'),due:hasDate(txt('due'))?txt('due'):'',priority:PRIORITIES[txt('priority')]?txt('priority'):'normal',status:TASK_STATES[txt('status')]?txt('status'):'todo',lastOpenStatus:txt('status')==='done'?(prev?.status==='done'?(prev.lastOpenStatus||'doing'):(prev?.status||'doing')):txt('status'),color:fd.has('customColor')?window.MasterskayaAnalytics.color(txt('color')):'',notes:txt('notes').slice(0,10000),subtasks:prev?.subtasks||[]};transition('task',title,prev?.status==='done',entry.status==='done',entry);if(prev)upsert(data.tasks,entry);else data.tasks.unshift(entry);} 
    if(type==='subtask'){const parent=data.tasks.find(t=>t.id===editMode.parentId);const title=txt('title');if(!parent||!title)return;const old=parent.subtasks.find(x=>x.id===id);upsert(parent.subtasks,{id,title:title.slice(0,300),done:old?.done||false});}
    if(type==='work'){const prev=data.workSessions.find(x=>x.id===id);const entry={id,date:hasDate(txt('date'))?txt('date'):today(),minutes:Math.max(1,Math.min(1440,Math.floor(n(txt('minutes'))||1))),area:WORK_AREAS.includes(txt('area'))?txt('area'):'Другое',projectId:txt('projectId'),note:txt('note').slice(0,1000)};upsert(data.workSessions,entry);}

    if(type==='post'){const title=txt('title');if(!title)return;const previous=data.posts.find(x=>x.id===id);const link=txt('link');if(link&&!validUrl(link)){alert('Ссылка должна начинаться с http:// или https://');return;}const entry={id,title:title.slice(0,300),channel:CHANNELS.includes(txt('channel'))?txt('channel'):'Telegram',format:FORMATS.includes(txt('format'))?txt('format'):'Пост',projectId:txt('projectId'),date:hasDate(txt('date'))?txt('date'):'',status:STAGES[txt('status')]?txt('status'):'idea',notes:txt('notes').slice(0,10000),link};transition('post',title,previous?.status==='published',entry.status==='published',entry);upsert(data.posts,entry);}
    if(type==='study'){const title=txt('title');if(!title)return;const previous=data.study.find(x=>x.id===id);const entry={id,title:title.slice(0,300),area:STUDY_AREAS.includes(txt('area'))?txt('area'):'Другое',projectId:txt('projectId'),status:STUDY_STATES[txt('status')]?txt('status'):'planned',progress:Math.max(0,Math.min(100,Math.floor(n(txt('progress'))))),due:hasDate(txt('due'))?txt('due'):'',nextStep:txt('nextStep').slice(0,500),notes:txt('notes').slice(0,10000),sessions:previous?.sessions||[]};upsert(data.study,entry);}
    if(type==='study-log'){const topic=data.study.find(x=>x.id===id);if(!topic)return;topic.sessions.push({id:safeId(),date:hasDate(txt('date'))?txt('date'):today(),minutes:Math.max(1,Math.min(1440,Math.floor(n(txt('minutes'))||1))),note:txt('note').slice(0,1000)});if(topic.status==='planned')topic.status='learning';}
    if(type==='uni-subject'){const title=txt('title');if(!title)return;upsert(data.universitySubjects,{id,title:title.slice(0,160),teacher:txt('teacher').slice(0,160),sessionId:txt('sessionId'),due:hasDate(txt('due'))?txt('due'):'',debt:fd.has('debt'),notes:txt('notes').slice(0,10000)});for(const work of data.academic.filter(w=>w.subjectId===id)){work.subject=title.slice(0,160);work.teacher=txt('teacher').slice(0,160);work.sessionId=txt('sessionId');}}
    if(type==='uni-step'){const work=data.academic.find(x=>x.id===editMode.parentId);const title=txt('title');if(!work||!title)return;const previous=work.subtasks.find(x=>x.id===id);upsert(work.subtasks,{id,title:title.slice(0,300),done:previous?.done||false});}
    if(type==='academic'){const title=txt('title'),subject=uniSubject(txt('subjectId'));if(!title||!subject){alert('Сначала выбери предмет.');return;}const previous=data.academic.find(x=>x.id===id);const entry={id,title:title.slice(0,300),subjectId:subject.id,subject:subject.title,type:ACADEMIC_TYPES[txt('type')]?txt('type'):'other',status:ACADEMIC_STATUSES[txt('status')]?txt('status'):'planned',due:hasDate(txt('due'))?txt('due'):'',priority:PRIORITIES[txt('priority')]?txt('priority'):'normal',sessionId:subject.sessionId,teacher:subject.teacher,nextStep:txt('nextStep').slice(0,500),notes:txt('notes').slice(0,10000),subtasks:previous?.subtasks||[]};transition('academic',title,previous?.status==='passed',entry.status==='passed');upsert(data.academic,entry);}
    if(type==='timetable'){
      const subject=txt('subject'),start=txt('start'),end=txt('end');if(!subject)return;
      if(!hhmm(start)||!hhmm(end)||start>=end){alert('Проверь время: конец пары должен быть позже начала.');return;}
      upsert(data.timetable,{id,subject:subject.slice(0,160),teacher:txt('teacher').slice(0,160),weekday:WEEK_DAYS[txt('weekday')]?Number(txt('weekday')):1,start,end,kind:LESSON_TYPES[txt('kind')]?txt('kind'):'other',parity:WEEK_PARITIES[txt('parity')]?txt('parity'):'every',notes:txt('notes').slice(0,1000)});
    }
    if(type==='attendance'){
      const subject=txt('subject'),date=txt('date');if(!subject||!hasDate(date)){alert('Укажи название предмета и дату.');return;}
      const base=editMode.prefill||{};const linked=base.scheduleId?data.attendance.find(x=>x.scheduleId===base.scheduleId&&x.date===date):null;
      const entry={id:id||linked?.id||safeId(),scheduleId:base.scheduleId||'',date,subject:subject.slice(0,160),teacher:txt('teacher').slice(0,160),kind:LESSON_TYPES[txt('kind')]?txt('kind'):'other',start:hhmm(txt('start'))?txt('start'):'',end:hhmm(txt('end'))?txt('end'):'',status:ATTENDANCE_STATUSES[txt('status')]?txt('status'):'',notes:txt('notes').slice(0,1500)};
      upsert(data.attendance,entry);
      if(date<attendanceStart||date>iso(shiftDate(dateObj(attendanceStart),13))) attendanceStart=iso(getMonday(dateObj(date)));
    }
    if(type==='session'){const title=txt('title');if(!title)return;const start=hasDate(txt('start'))?txt('start'):'';const end=hasDate(txt('end'))?txt('end'):'';if(start&&end&&start>end){alert('Конец сессии должен быть не раньше её начала.');return;}upsert(data.universitySessions,{id,title:title.slice(0,120),start,end,notes:txt('notes').slice(0,10000)});}
    if(type==='project'){const name=txt('name');if(!name)return;const entry={id,name:name.slice(0,90),color:window.MasterskayaAnalytics.color(txt('color'),COLORS[0])};upsert(data.projects,entry);}
    if(type==='habit'){const title=txt('title');if(!title)return;const existing=data.habits.find(h=>h.id===id);upsert(data.habits,{id,title:title.slice(0,100),icon:txt('icon').slice(0,10)||'✳',color:window.MasterskayaAnalytics.color(txt('color'),'#91b9b0'),createdAt:existing?.createdAt||today()});}
    save();editor.close();render();toast('Сохранено');
  }
  function upsert(list,entry){const i=list.findIndex(x=>x.id===entry.id);if(i<0)list.push(entry);else list[i]=entry;}
  function ensureUniSubject(title,teacher=''){
    let subject=data.universitySubjects.find(x=>x.title.toLocaleLowerCase('ru-RU')===String(title).toLocaleLowerCase('ru-RU')&&x.teacher===teacher);
    if(!subject){subject={id:safeId(),title:String(title).slice(0,160),teacher:String(teacher).slice(0,160),sessionId:'',due:'',debt:false,notes:''};data.universitySubjects.push(subject);save();}
    return subject;
  }
  function removeUniSubject(id){
    const sub=uniSubject(id);if(!sub)return;
    const count=data.academic.filter(w=>w.subjectId===id).length;
    if(!confirm(`Удалить предмет «${sub.title}»? ${count?`Его ${count} работ(ы) останутся в разделе «Без предмета», чтобы их можно было перенести.`:'Работ внутри нет.'}`))return;
    // Не удаляем работы каскадом: создаём контейнер для сирот и сохраняем подзадачи.
    if(count){let orphan=data.universitySubjects.find(s=>s.title==='Без предмета'&&s.id!==id);if(!orphan){orphan={id:safeId(),title:'Без предмета',teacher:'',sessionId:'',due:'',debt:false,notes:''};data.universitySubjects.push(orphan);}data.academic.filter(w=>w.subjectId===id).forEach(w=>{w.subjectId=orphan.id;w.subject=orphan.title;w.teacher='';w.sessionId='';});}
    data.universitySubjects=data.universitySubjects.filter(s=>s.id!==id);
    if(academicSubjectFilter===id)academicSubjectFilter='all';save();render();toast('Предмет удалён; работы сохранены');
  }
  function remove(type,id){const list=data[type];const i=list.findIndex(x=>x.id===id);if(i<0)return;const target=list[i];const label=target.title||target.name||target.subject||(type==='workSessions'?`${prettyDate(target.date,true)} · ${hoursString(target.minutes)}`:'запись');const extra=type==='projects'?' Задачи, посты и темы обучения останутся без привязки.':'';if(!confirm(`Удалить «${label}»?${extra}`))return;list.splice(i,1);if(type==='universitySessions'){data.universitySubjects.forEach(x=>{if(x.sessionId===id)x.sessionId='';});data.academic.forEach(x=>{if(x.sessionId===id)x.sessionId='';});if(academicSessionFilter===id)academicSessionFilter='all';}if(type==='habits')data.habitChecks=data.habitChecks.filter(c=>c.habitId!==id);if(type==='projects'){if(selectedProjectId===id)selectedProjectId=null;data.tasks.forEach(x=>{if(x.projectId===id)x.projectId='';});data.posts.forEach(x=>{if(x.projectId===id)x.projectId='';});data.study.forEach(x=>{if(x.projectId===id)x.projectId='';});}save();render();toast('Удалено');}
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
  function downloadText(filename,text){
    const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  function exportBrokenData(){
    const text=window.MasterskayaStorage.corruptedText();
    if(!text){alert('Исходные повреждённые данные недоступны.');return;}
    downloadText('masterskaya_damaged_original_'+today()+'.txt',text);
    toast('Исходные повреждённые данные скачаны, не удаляй файл');
  }
  function restoreLocalBackup(){
    if(!confirm('Восстановить последнюю исправную локальную копию? Повреждённые данные рекомендуется сначала скачать.'))return;
    const result=window.MasterskayaStorage.recover(normalize);
    if(!result.ok){alert('Восстановление не удалось. Скачай JSON-копию и попробуй импорт из файла.');return;}
    Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,result.data);
    storageReadOnly=false;storageError='';render();toast('Последняя исправная копия восстановлена');
  }
  async function importData(file){if(!file)return;if(file.size>5*1024*1024){alert('Файл слишком большой для планера.');return;}
    let newData;try{newData=normalize(JSON.parse(await file.text()));}catch(e){alert('Не удалось прочитать файл. Нужна JSON-копия планера.');return;}
    if(!confirm('Импорт полностью заменит текущие задачи, публикации и университетские записи. Продолжить?'))return;
    const result=window.MasterskayaStorage.write(newData,normalize,{restore:storageReadOnly});
    if(!result.ok){warnSave('Импорт не сохранён. Текущие данные не были заменены.');return;}
    Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,newData);
    storageReadOnly=false;storageError='';selectedProjectId=null;render();toast('Данные восстановлены');
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){page=nav.dataset.nav;selectedProjectId=null;query='';window.scrollTo({top:0,behavior:'instant'});render();return;}
    const arrow=e.target.closest('[data-task-move]');if(arrow){stepTask(arrow.dataset.taskMove,Number(arrow.dataset.direction));return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;const id=btn.dataset.id,p=btn.dataset.project||'';
    switch(btn.dataset.action){
      case 'uni-tab':if(['attendance','works','sessions'].includes(btn.dataset.tab)){universityTab=btn.dataset.tab;render();}break;
      case 'overview-day-prev':overviewDate=iso(shiftDate(dateObj(overviewDate),-1));render();break;
      case 'overview-day-next':overviewDate=iso(shiftDate(dateObj(overviewDate),1));render();break;
      case 'overview-day-today':overviewDate=today();render();break;
      case 'attendance-prev':attendanceStart=iso(shiftDate(dateObj(attendanceStart),-14));render();break;
      case 'attendance-next':attendanceStart=iso(shiftDate(dateObj(attendanceStart),14));render();break;
      case 'attendance-today':attendanceStart=iso(getMonday(new Date()));render();break;
      case 'add-timetable':openEditor('timetable');break;
      case 'edit-timetable':openEditor('timetable',id);break;
      case 'delete-timetable':remove('timetable',id);break;
      case 'add-attendance':openEditor('attendance');break;
      case 'edit-attendance':openEditor('attendance',id);break;
      case 'delete-attendance':remove('attendance',id);break;
      case 'edit-lesson-instance':openEditor('attendance',null,id+'|'+btn.dataset.date);break;
      case 'make-academic-lesson':{
        const record=data.attendance.find(x=>x.id===btn.dataset.record);
        const schedule=data.timetable.find(x=>x.id===id);
        const item=record||schedule;if(!item)break;
        universityTab='works';const sub=ensureUniSubject(item.subject,item.teacher||'');openEditor('academic',null,sub.id);
        document.querySelector('#fld-title').value='Задание по паре от '+prettyDate(btn.dataset.date,true);
        document.querySelector('#fld-notes').value=`Занятие: ${prettyDate(btn.dataset.date,true)}. ${LESSON_TYPES[item.kind]||'Пара'}.`;
        break;
      }
      case 'add-academic':if(!data.universitySubjects.length){openEditor('uni-subject');toast('Сначала добавь предмет');}else openEditor('academic',null,btn.dataset.subject||'');break;
      case 'add-uni-subject':openEditor('uni-subject');break;case 'edit-uni-subject':openEditor('uni-subject',id);break;case 'delete-uni-subject':removeUniSubject(id);break;
      case 'edit-uni-step':openEditor('uni-step',id,btn.dataset.work);break;
      case 'delete-uni-step':{const work=data.academic.find(x=>x.id===btn.dataset.work),step=work?.subtasks.find(s=>s.id===id);if(step&&confirm(`Удалить шаг «${step.title}»?`)){work.subtasks=work.subtasks.filter(s=>s.id!==id);save();render();toast('Шаг удалён');}break;}case 'edit-academic':openEditor('academic',id);break;case 'delete-academic':remove('academic',id);break;
      case 'add-session':openEditor('session');break;case 'edit-session':openEditor('session',id);break;case 'delete-session':remove('universitySessions',id);break;
      case 'add-study':openEditor('study',null,p);break;case 'edit-study':openEditor('study',id);break;case 'log-study':openEditor('study-log',id);break;case 'delete-study':remove('study',id);break;
      case 'add-subtask':openEditor('subtask',null,p);break;case 'edit-subtask':openEditor('subtask',id,p);break;
      case 'delete-subtask':{const parent=data.tasks.find(t=>t.id===p);const sub=parent?.subtasks.find(x=>x.id===id);if(sub&&confirm(`Удалить подзадачу «${sub.title}»?`)){parent.subtasks=parent.subtasks.filter(x=>x.id!==id);save();render();toast('Шаг удалён');}break;}
      case 'add-habit':openEditor('habit');break;case 'edit-habit':openEditor('habit',id);break;case 'delete-habit':remove('habits',id);break;case 'tap-habit':recordHabit(id);break;
      case 'add-work':openEditor('work');break;case 'edit-work':openEditor('work',id);break;case 'delete-work':remove('workSessions',id);break;
      case 'activity-period':activityDays=[7,30,90].includes(Number(btn.dataset.days))?Number(btn.dataset.days):30;render();break;
      case 'open-project':selectedProjectId=id;page='projects';window.scrollTo({top:0,behavior:'instant'});render();break;
      case 'back-projects':selectedProjectId=null;render();break;
      case 'go-to-task':goToTask(id);break;
      case 'add-task':openEditor('task',null,p);break;case 'add-post':openEditor('post',null,p);break;case 'add-project':openEditor('project');break;
      case 'edit-task':openEditor('task',id);break;case 'edit-post':openEditor('post',id);break;case 'edit-project':openEditor('project',id);break;
      case 'delete-task':remove('tasks',id);break;case 'delete-post':remove('posts',id);break;case 'delete-project':remove('projects',id);break;
      case 'copy-post':{const post=data.posts.find(p=>p.id===id);if(post){data.posts.push({...clone(post),id:safeId(),title:post.title+' (копия)',status:'idea',link:''});save();render();toast('Создана копия: можно выбрать другую площадку');}break;}
      case 'close-dialog':editor.close();break;
      case 'prev-month':selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()-1,1);render();break;
      case 'next-month':selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,1);render();break;
      case 'current-month':selectedMonth=new Date();selectedMonth.setDate(1);render();break;
      case 'export':exportData();break;case 'import':document.querySelector('#restore-file').click();break;
      case 'recover-storage':restoreLocalBackup();break;case 'export-broken':exportBrokenData();break;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-task-status]')){const t=data.tasks.find(x=>x.id===e.target.dataset.taskStatus);if(t&&TASK_STATES[e.target.value]){const before=t.status==='done';if(t.status!=='done')t.lastOpenStatus=t.status;t.status=e.target.value;if(t.status!=='done')t.lastOpenStatus=t.status;transition('task',t.title,before,t.status==='done',t);save();render();toast('Статус задачи обновлён');}}
    if(e.target.matches('[data-check-task]')){const t=data.tasks.find(x=>x.id===e.target.dataset.checkTask);if(t){const before=t.status==='done';if(e.target.checked){t.lastOpenStatus=t.status==='todo'?'todo':'doing';t.status='done';}else t.status=t.lastOpenStatus||'doing';transition('task',t.title,before,t.status==='done',t);save();render();}}
    if(e.target.matches('[data-check-subtask]')){const parent=data.tasks.find(t=>t.id===e.target.dataset.parent);const sub=parent?.subtasks.find(st=>st.id===e.target.dataset.checkSubtask);if(sub){const before=sub.done;sub.done=e.target.checked;transition('subtask',sub.title,before,sub.done,parent);save();render();}}
    if(e.target.matches('[data-uni-step]')){const work=data.academic.find(x=>x.id===e.target.dataset.work),step=work?.subtasks.find(x=>x.id===e.target.dataset.uniStep);if(step){const prev=step.done;step.done=e.target.checked;transition('subtask',`ВУЗ · ${work.subject} · ${work.title} · ${step.title}`,prev,step.done,{color:'#96accb'});save();render();}}
    if(e.target.matches('[data-uni-work-check]')){const work=data.academic.find(x=>x.id===e.target.dataset.uniWorkCheck);if(work){const was=work.status==='passed';work.status=e.target.checked?'passed':'progress';transition('academic',work.title,was,work.status==='passed');save();render();}}
    if(e.target.matches('[data-post-stage]')){const p=data.posts.find(x=>x.id===e.target.dataset.postStage);if(p&&STAGES[e.target.value]){const before=p.status==='published';p.status=e.target.value;transition('post',p.title,before,p.status==='published',p);save();render();toast('Этап обновлён');}}
    if(e.target.matches('#task-sort')){if(TASK_SORTS[e.target.value]){data.taskSort=e.target.value;save();render();}}
    if(e.target.matches('#task-filter')){taskFilter=e.target.value;render();}
    if(e.target.matches('#uni-week-anchor')){data.universityWeekAnchor=hasDate(e.target.value)?e.target.value:'';save();render();toast('Первая нечётная неделя сохранена');}
    if(e.target.matches('[data-attendance-check]')){
      const el=e.target,record=data.attendance.find(x=>x.id===el.dataset.attendanceId);
      const schedule=data.timetable.find(x=>x.id===el.dataset.scheduleId);
      const source=record||schedule;
      if(!source)return;
      const entry={id:record?.id||safeId(),scheduleId:record?.scheduleId||schedule?.id||'',date:el.dataset.date,
        subject:source.subject,teacher:source.teacher||'',kind:source.kind||'other',start:source.start||'',end:source.end||'',
        status:el.checked?'attended':'',notes:record?.notes||''};
      upsert(data.attendance,entry);save();render();toast(el.checked?'Посещение отмечено':'Отметка снята, пара осталась в журнале');
    }
    if(e.target.matches('#academic-filter')){academicFilter=e.target.value;render();}
    if(e.target.matches('#academic-subject-filter')){academicSubjectFilter=e.target.value;render();}
    if(e.target.matches('#academic-session-filter')){academicSessionFilter=e.target.value;render();}
    if(e.target.matches('[data-academic-status]')){const x=data.academic.find(a=>a.id===e.target.dataset.academicStatus);if(x&&ACADEMIC_STATUSES[e.target.value]){const before=x.status==='passed';x.status=e.target.value;transition('academic',x.title,before,x.status==='passed');save();render();toast('Статус работы обновлён');}}
  });
  document.addEventListener('input',e=>{if(e.target.matches('#task-search')){query=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector('#task-search');input.focus();input.setSelectionRange(pos,pos);}});
  app.addEventListener('dragstart',e=>{
    const handle=e.target.closest('[data-task-drag]');if(!handle||!canReorder())return;
    draggedTaskId=handle.dataset.taskDrag; e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedTaskId);
    handle.closest('.task-card')?.classList.add('task-dragging');
  });
  app.addEventListener('dragover',e=>{
    if(!draggedTaskId||!canReorder())return;const card=e.target.closest('[data-task-id]');if(!card||card.dataset.taskId===draggedTaskId)return;
    e.preventDefault();e.dataTransfer.dropEffect='move';app.querySelectorAll('.task-drop-target').forEach(el=>el.classList.remove('task-drop-target'));card.classList.add('task-drop-target');
  });
  app.addEventListener('drop',e=>{
    const card=e.target.closest('[data-task-id]');if(!card||!draggedTaskId)return;e.preventDefault();const dragged=draggedTaskId;draggedTaskId=null;
    app.querySelectorAll('.task-drop-target,.task-dragging').forEach(el=>el.classList.remove('task-drop-target','task-dragging'));const box=card.getBoundingClientRect();moveTaskBefore(dragged,card.dataset.taskId,e.clientY>box.top+box.height/2);
  });
  app.addEventListener('dragend',()=>{draggedTaskId=null;app.querySelectorAll('.task-drop-target,.task-dragging').forEach(el=>el.classList.remove('task-drop-target','task-dragging'));});
  app.addEventListener('submit',e=>{
    const box=e.target.closest('[data-uni-quick]');if(!box)return;e.preventDefault();
    const work=data.academic.find(x=>x.id===box.dataset.uniQuick),value=box.elements.step.value.trim();
    if(!work||!value)return;work.subtasks.push({id:safeId(),title:value.slice(0,300),done:false});
    save();render();toast('Шаг добавлен');
  });
  form.addEventListener('submit',e=>{e.preventDefault();saveEntry();});
  document.addEventListener('submit',e=>{if(e.target.id==='goals-form'){e.preventDefault();const fd=new FormData(e.target);CHANNELS.forEach(ch=>data.goals[ch]=Math.max(0,Math.min(100,Math.floor(n(fd.get(ch))))));save();render();toast('Цели сохранены');}});
  document.querySelector('#restore-file').addEventListener('change',async e=>{const file=e.target.files?.[0];await importData(file);e.target.value='';});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){const result=window.MasterskayaStorage.read(defaultData,normalize);Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,result.data);storageReadOnly=result.locked;storageError=result.reason;render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lastSavedDay!==today()){lastSavedDay=today();render();}});
  window.addEventListener('focus',()=>{if(lastSavedDay!==today()){lastSavedDay=today();render();}});
  setInterval(()=>{if(lastSavedDay!==today()){lastSavedDay=today();render();}},60000);
  render();
})();
