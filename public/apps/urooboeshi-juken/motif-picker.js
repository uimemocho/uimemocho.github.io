/* Persist a Fisher–Yates bag: every motif once per round, no boundary repeat. */
function createMotifPicker(catalog,storage,random=Math.random){
 const key='urooboeshi-juken-motifs-v1',ids=catalog.map(x=>x.id),signature=ids.slice().sort().join('|');
 let state={signature,bag:[],last:null};
 try{const saved=JSON.parse(storage.getItem(key));if(saved?.signature===signature&&Array.isArray(saved.bag)&&new Set(saved.bag).size===saved.bag.length&&saved.bag.every(id=>ids.includes(id)))state=saved}catch{}
 const save=()=>{try{storage.setItem(key,JSON.stringify(state))}catch{}};
 return {
  next(selection='random'){
   if(selection!=='random'){const art=catalog.find(x=>x.id===selection);if(art){state.last=art.id;save();return art}}
   if(!state.bag.length){state.bag=[...ids];for(let i=state.bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[state.bag[i],state.bag[j]]=[state.bag[j],state.bag[i]]}}
   if(state.bag.length>1&&state.bag.at(-1)===state.last){[state.bag[0],state.bag[state.bag.length-1]]=[state.bag.at(-1),state.bag[0]]}
   const id=state.bag.pop();state.last=id;save();return catalog.find(x=>x.id===id)
  },
  get remaining(){return state.bag.length}
 };
}
