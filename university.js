/* МАСТЕРСКАЯ v2.9: схема дисциплин и совместимость со старыми вузовскими работами. */
(() => {
  'use strict';
  const cleanText=(v,max)=>String(v??'').slice(0,max);
  const steps=(items,id)=>Array.isArray(items)?items.slice(0,250).filter(x=>x&&typeof x.title==='string').map(x=>({id:cleanText(x.id||id(),90),title:cleanText(x.title,300),done:x.done===true})):[];
  // Стабильный идентификатор для миграции: повторная проверка JSON не меняет ссылки.
  const legacyId=(key)=>{let h=2166136261;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}return 'legacy-uni-'+(h>>>0).toString(36);};
  const matchKey=(name,teacher,session)=>[name,teacher,session].map(x=>String(x||'').trim().toLocaleLowerCase('ru-RU')).join('|');
  function migrate(subjects,works,id){
    const lookup=new Map(subjects.map(s=>[matchKey(s.title,s.teacher,s.sessionId),s]));
    for(const work of works){
      let subject=subjects.find(s=>s.id===work.subjectId);
      if(!subject){
        const key=matchKey(work.subject||'Без предмета',work.teacher,work.sessionId);
        subject=lookup.get(key);
        if(!subject){
          const preferred=legacyId(key);
          // Старые одинаковые названия в разных сессиях намеренно не смешиваются.
          subject={id:subjects.some(s=>s.id===preferred)?id():preferred,title:work.subject||'Без предмета',teacher:work.teacher||'',sessionId:work.sessionId||'',due:'',debt:false,notes:''};
          subjects.push(subject);lookup.set(key,subject);
        }
      }
      work.subjectId=subject.id;
      work.subject=subject.title;
      work.teacher=subject.teacher;
      work.sessionId=subject.sessionId;
    }
    return subjects;
  }
  function condition(subject,works,date){
    const outstanding=works.filter(x=>x.status!=='passed');
    const debt=!!subject.debt||outstanding.some(x=>x.status==='debt');
    const overdue=!debt && outstanding.length>0 && ((!!subject.due&&subject.due<date)||outstanding.some(x=>x.due&&x.due<date));
    return {key:debt?'debt':overdue?'overdue':works.length&&outstanding.length===0?'complete':'clear',label:debt?'Долг':overdue?'Просрочено без долга':works.length&&outstanding.length===0?'Все работы закрыты':'Без долга'};
  }
  window.MasterskayaUniversity={steps,migrate,condition};
})();
