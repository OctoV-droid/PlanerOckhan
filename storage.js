/* МАСТЕРСКАЯ v2.8–2.9: изолированное хранилище, проверка записи и последняя исправная копия. */
(() => {
  'use strict';
  const KEY='atelier_planner_v1';
  const BACKUP=KEY+'_last_good';
  const check=(text, normalize)=>normalize(JSON.parse(text));
  const api={
    key:KEY, backupKey:BACKUP,
    read(defaultData,normalize){
      try {
        const primary=localStorage.getItem(KEY);
        if(primary!==null){
          try{return {data:check(primary,normalize),locked:false,reason:''};}
          catch(e){
            const backup=localStorage.getItem(BACKUP);
            if(backup){try{return {data:check(backup,normalize),locked:true,reason:'Основные данные повреждены. Показана последняя исправная копия, запись заблокирована до восстановления.'};}catch{}}
            return {data:defaultData(),locked:true,reason:'Данные в браузере повреждены. Запись заблокирована, чтобы не перезаписать оригинал.'};
          }
        }
        // Если основное хранилище было очищено отдельно от резервного, не затираем копию.
        const backup=localStorage.getItem(BACKUP);
        if(backup){try{return {data:check(backup,normalize),locked:true,reason:'Основное хранилище пустое, но найдена резервная копия. Подтверди восстановление.'};}catch{}}
        return {data:defaultData(),locked:false,reason:''};
      }catch(e){
        return {data:defaultData(),locked:true,reason:'Не удаётся прочитать хранилище браузера. Сохранение заблокировано.'};
      }
    },
    write(value,normalize,{restore=false}={}){
      const json=JSON.stringify(value);
      check(json,normalize); // Не записывать недопустимую структуру.
      try {
        const old=localStorage.getItem(KEY);
        // Прежде чем заменить последнюю исправную версию, сохраним её отдельно.
        if(old!==null&&!restore){
          try{check(old,normalize);if(localStorage.getItem(BACKUP)!==old)localStorage.setItem(BACKUP,old);}
          catch(e){if(e instanceof SyntaxError){/* повреждённую запись не копируем */}else throw e;}
        }
        localStorage.setItem(KEY,json);
        if(localStorage.getItem(KEY)!==json)throw Error('Данные после записи не совпадают');
        // При первом сохранении резервная копия также должна существовать.
        if(localStorage.getItem(BACKUP)===null){try{localStorage.setItem(BACKUP,json);}catch(e){console.warn('Резервная копия не создана',e);}}
        return {ok:true};
      }catch(error){console.error('Сохранение планера не удалось',error);return {ok:false,error};}
    },
    recover(normalize){
      try {const text=localStorage.getItem(BACKUP);if(!text)throw Error('Копии нет');
        const data=check(text,normalize);const result=this.write(data,normalize,{restore:true});
        if(!result.ok)throw result.error;return {ok:true,data};
      }catch(error){return {ok:false,error};}
    },
    corruptedText(){try{return localStorage.getItem(KEY)||'';}catch{return '';}}
  };
  window.MasterskayaStorage=api;
})();
