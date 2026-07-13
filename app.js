
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const storageKey = 'granburyGirlsTrip';

function getState(){
  return JSON.parse(localStorage.getItem(storageKey) || '{"selected":[],"itinerary":{"Friday":[],"Saturday":[],"Sunday":[]},"lodging":null}');
}
function saveState(s){ localStorage.setItem(storageKey, JSON.stringify(s)); }
function money(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
async function getData(){ const r = await fetch('data.json'); return r.json(); }

function setupCountdown(){
  const el = $('#countdown'); if(!el) return;
  const target = Date.UTC(2026, 10, 13, 15, 0, 0);
  function tick(){
    const diff = Math.max(0,target-Date.now());
    const d=Math.floor(diff/86400000), h=Math.floor(diff/3600000)%24, m=Math.floor(diff/60000)%60, s=Math.floor(diff/1000)%60;
    el.innerHTML = `<div><strong>${d}</strong>Days</div><div><strong>${h}</strong>Hours</div><div><strong>${m}</strong>Minutes</div><div><strong>${s}</strong>Seconds</div>`;
  }
  tick(); setInterval(tick,1000);
}

async function setupPlanner(){
  const list=$('#activity-list'); if(!list) return;
  const data=await getData(); let current='All';
  const toolbar=$('#category-toolbar');
  ['All',...new Set(data.activities.map(x=>x.category))].forEach(c=>{
    const b=document.createElement('button'); b.textContent=c; if(c==='All') b.classList.add('active');
    b.addEventListener('click',()=>{current=c; $$('#category-toolbar button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); render();});
    toolbar.appendChild(b);
  });
  function render(){
    const state=getState(); list.innerHTML='';
    data.activities.filter(x=>current==='All'||x.category===current).forEach(item=>{
      const selected=state.selected.includes(item.id);
      const card=document.createElement('article'); card.className='card';
      card.innerHTML=`<div class="card-body">
        <span class="badge">${item.category}</span><h3>${item.name}</h3>
        <p class="price">${item.priceLabel}</p><p>${item.desc}</p>
        <p class="muted"><strong>When:</strong> ${item.time}</p>
        <p class="card-note">${item.notes}</p>
        <div class="card-actions"><a class="btn secondary" href="${item.link}" target="_blank" rel="noopener">Official site</a></div>
        <label class="checkrow"><input type="checkbox" ${selected?'checked':''}><span>Add to our choices (${money(item.price)} planning amount)</span></label>
      </div>`;
      card.querySelector('input').addEventListener('change',e=>{
        const s=getState(); s.selected=e.target.checked?[...new Set([...s.selected,item.id])]:s.selected.filter(id=>id!==item.id);
        saveState(s); updateTotal(data); updateChoiceCount();
      });
      list.appendChild(card);
    });
  }
  render(); updateTotal(data); updateChoiceCount();
}

async function updateTotal(dataArg){
  const els = $$('#trip-total, #home-trip-total');
  if(!els.length) return;
  const data=dataArg || await getData(); const s=getState();
  let total=data.activities.filter(x=>s.selected.includes(x.id)).reduce((a,b)=>a+b.price,0);
  const lodging=data.lodging.find(x=>x.id===s.lodging); if(lodging) total+=lodging.price;
  els.forEach(el=>el.textContent=money(total));
}

function updateChoiceCount(){
  const count=getState().selected.length;
  const a=$('#choice-count'); if(a) a.textContent=count;
  const b=$('#home-choice-count'); if(b) b.textContent=count;
}

async function setupLodging(){
  const root=$('#lodging-list'); if(!root) return;
  const data=await getData(); const s=getState();
  data.lodging.forEach(item=>{
    const pros=item.pros.map(x=>`<li>${x}</li>`).join('');
    const cons=item.cons.map(x=>`<li>${x}</li>`).join('');
    const card=document.createElement('article'); card.className='card';
    card.innerHTML=`<div class="card-body"><span class="badge">${item.badge}</span><h3>${item.name}</h3>
      <p class="price">${item.priceLabel}</p><p>${item.desc}</p>
      <div class="pros-cons"><div><strong>Why choose it</strong><ul>${pros}</ul></div><div><strong>Keep in mind</strong><ul>${cons}</ul></div></div>
      <div class="card-actions"><a class="btn secondary" href="${item.link}" target="_blank" rel="noopener">View property</a></div>
      <label class="checkrow"><input type="radio" name="lodging" value="${item.id}" ${s.lodging===item.id?'checked':''}><span>Choose this lodging</span></label></div>`;
    card.querySelector('input').addEventListener('change',e=>{const st=getState();st.lodging=e.target.value;saveState(st);updateTotal(data);});
    root.appendChild(card);
  });
}

async function setupRestaurants(){
  const root=$('#restaurant-list'); if(!root) return;
  const data=await getData();
  data.restaurants.forEach(item=>{
    const card=document.createElement('article'); card.className='card';
    card.innerHTML=`<div class="card-body"><h3>${item.name}</h3><p class="price">${item.priceLabel}</p><p>${item.desc}</p><p class="card-note">${item.notes}</p>
      <div class="card-actions"><a class="btn secondary" href="${item.link}" target="_blank" rel="noopener">Menu / website</a></div></div>`;
    root.appendChild(card);
  });
}

async function setupItinerary(){
  const root=$('#itinerary-builder'); if(!root) return;
  const data=await getData(); const state=getState();
  const all=[...data.activities,...data.restaurants.map(r=>({...r,category:'Dining',priceLabel:r.priceLabel}))];
  const select=$('#itinerary-item');
  all.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=`${x.name} — ${x.priceLabel}`;select.appendChild(o);});
  function render(){
    ['Friday','Saturday','Sunday'].forEach(day=>{
      const ul=$(`#${day.toLowerCase()}-list`); ul.innerHTML='';
      state.itinerary[day].forEach((id,idx)=>{
        const item=all.find(x=>x.id===id); if(!item) return;
        const li=document.createElement('li'); li.innerHTML=`<span>${item.name}</span><button type="button" class="btn secondary">Remove</button>`;
        li.querySelector('button').addEventListener('click',()=>{state.itinerary[day].splice(idx,1);saveState(state);render();});
        ul.appendChild(li);
      });
    });
  }
  $('#add-itinerary').addEventListener('click',()=>{
    const day=$('#itinerary-day').value,id=select.value;
    if(id&&!state.itinerary[day].includes(id)){state.itinerary[day].push(id);saveState(state);render();}
  });
  render();
}

function setupReset(){
  const b=$('#reset-trip'); if(!b) return;
  b.addEventListener('click',()=>{if(confirm('Clear all saved trip choices on this device?')){localStorage.removeItem(storageKey);location.reload();}});
}
function setupMobileMenu(){
  const button=$('#menu-toggle'), nav=$('#nav-links');
  if(!button||!nav) return;
  button.addEventListener('click',()=>nav.classList.toggle('open'));
}
document.addEventListener('DOMContentLoaded',()=>{setupCountdown();setupPlanner();setupLodging();setupRestaurants();setupItinerary();setupReset();setupMobileMenu();updateChoiceCount();updateTotal();setupPlannerTools();setupPlanTransfer();});


function getExtendedState(){
  const base = getState();
  base.packing = base.packing || [];
  base.reservations = base.reservations || [];
  return base;
}

async function setupPlannerTools(){
  const packingRoot = $('#packing-list');
  const reservationRoot = $('#reservation-list');
  if(!packingRoot && !reservationRoot) return;

  const data = await getData();
  const state = getExtendedState();

  if(packingRoot){
    data.packing.forEach((item, index)=>{
      const id = `pack-${index}`;
      const row = document.createElement('label');
      row.className = 'checklist-row';
      row.innerHTML = `<input type="checkbox" ${state.packing.includes(id)?'checked':''}><span>${item}</span>`;
      row.querySelector('input').addEventListener('change', e=>{
        const s=getExtendedState();
        s.packing=e.target.checked?[...new Set([...s.packing,id])]:s.packing.filter(x=>x!==id);
        saveState(s);
      });
      packingRoot.appendChild(row);
    });
  }

  if(reservationRoot){
    data.reservations.forEach(item=>{
      const row = document.createElement('label');
      row.className = 'checklist-row';
      row.innerHTML = `<input type="checkbox" ${state.reservations.includes(item.id)?'checked':''}><span><strong>${item.name}</strong><small>${item.category}</small></span>`;
      row.querySelector('input').addEventListener('change', e=>{
        const s=getExtendedState();
        s.reservations=e.target.checked?[...new Set([...s.reservations,item.id])]:s.reservations.filter(x=>x!==item.id);
        saveState(s);
      });
      reservationRoot.appendChild(row);
    });
  }
}

function setupPlanTransfer(){
  const exportButton=$('#export-plan');
  const importInput=$('#import-plan');
  const status=$('#share-status');

  if(exportButton){
    exportButton.addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify(getExtendedState(),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download='granbury-trip-plan.json';
      a.click();
      URL.revokeObjectURL(url);
      if(status) status.textContent='Trip plan downloaded.';
    });
  }

  if(importInput){
    importInput.addEventListener('change', async e=>{
      const file=e.target.files[0];
      if(!file) return;
      try{
        const imported=JSON.parse(await file.text());
        localStorage.setItem(storageKey,JSON.stringify(imported));
        if(status) status.textContent='Trip plan imported. Refreshing…';
        setTimeout(()=>location.reload(),600);
      }catch(error){
        if(status) status.textContent='That file could not be imported.';
      }
    });
  }
}
