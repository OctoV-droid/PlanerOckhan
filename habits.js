/* МАСТЕРСКАЯ v2.8: правила отметок привычек. Локальная календарная дата, не UTC. */
(() => {
  'use strict';
  const key=(id,date)=>id+'|'+date;
  window.MasterskayaHabits={
    checked(entries,id,date){return entries.some(x=>key(x.habitId,x.date)===key(id,date));},
    add(entries,id,date,limit=40000){
      if(this.checked(entries,id,date))return false;
      entries.push({habitId:id,date});
      if(entries.length>limit)entries.splice(0,entries.length-limit);
      return true;
    },
    count(entries,id){return entries.filter(x=>x.habitId===id).length;},
    clean(entries,habits,validDate){
      const known=new Set(habits.map(x=>x.id)),seen=new Set();
      return entries.slice(-40000).filter(x=>{
        if(!x||!known.has(x.habitId)||!validDate(x.date))return false;
        const k=key(x.habitId,x.date);if(seen.has(k))return false;seen.add(k);return true;
      }).map(x=>({habitId:String(x.habitId).slice(0,90),date:x.date}));
    }
  };
})();
