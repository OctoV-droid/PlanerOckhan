/* МАСТЕРСКАЯ v2.8: группировка статистики по проектам и типам событий. */
(() => {
  'use strict';
  const VALID_COLOR=/^#[0-9a-fA-F]{6}$/;
  const color=(x,fallback='#929bac')=>VALID_COLOR.test(x||'')?x:fallback;
  function bucket(event,projects){
    if(event.kind==='subtask')return {key:'subtask',label:'Подзадачи',color:'#77bad9'};
    if(event.kind==='academic')return {key:'university',label:'ВУЗ · работы',color:'#b49bd7'};
    if(event.projectId){const p=projects.find(x=>x.id===event.projectId);if(p){if(event.color)return {key:'custom:'+p.id+':'+event.color,label:p.name+' · личный цвет задачи',color:color(event.color)};return {key:'project:'+p.id,label:p.name,color:color(p.color)};}}
    if(event.kind==='post')return {key:'content',label:'Публикации',color:'#d1ad6a'};
    return {key:'other',label:'Другое / старые события',color:color(event.color)};
  }
  function timeBucket(session,projects){
    if(session.projectId){const p=projects.find(x=>x.id===session.projectId);if(p)return {key:'project:'+p.id,label:p.name,color:color(p.color)};}
    if(session.area==='Учёба в вузе')return {key:'university',label:'ВУЗ',color:'#b49bd7'};
    if(session.area==='Другое')return {key:'other',label:'Другое',color:'#929bac'};
    const byArea={'3D / Арт':'#84b89f','Разработка игр':'#a7acdb','Соцсети / портфолио':'#d1ad6a'};
    return {key:'area:'+session.area,label:session.area,color:byArea[session.area]||'#929bac'};
  }
  function build(dates,items,projects,keyFn,quantityFn){
    const datesSet=new Set(dates),counts=new Map(),categories=new Map();
    for(const it of items){if(!datesSet.has(it.date))continue;const cat=keyFn(it,projects);categories.set(cat.key,cat);
      const key=it.date+'|'+cat.key;counts.set(key,(counts.get(key)||0)+quantityFn(it));}
    return {categories:[...categories.values()],days:dates.map(date=>({date,parts:[...categories.values()].map(cat=>({...cat,value:counts.get(date+'|'+cat.key)||0})).filter(x=>x.value>0)}))};
  }
  const api={color,bucket,timeBucket,build,
    actions(dates,events,projects){return build(dates,events.filter(x=>x.delta>0),projects,bucket,()=>1);},
    minutes(dates,sessions,projects){return build(dates,sessions,projects,timeBucket,x=>x.minutes);}
  };
  window.MasterskayaAnalytics=api;
})();
