const cart = new Map();
const peso = n => `₱${n}`;
const items = [...document.querySelectorAll('.menu-item')];
const cartBar = document.getElementById('cartBar');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const ctaCount = document.getElementById('ctaCount');
const modal = document.getElementById('orderModal');
const lines = document.getElementById('orderLines');
const modalTotal = document.getElementById('modalTotal');

items.forEach(el => el.querySelector('.add-btn').addEventListener('click', () => {
  const name = el.dataset.name, price = Number(el.dataset.price);
  const current = cart.get(name) || {name, price, qty:0};
  current.qty++;
  cart.set(name,current);
  updateUI();
}));

function totals(){
  let count=0,total=0;
  cart.forEach(i=>{count+=i.qty;total+=i.qty*i.price});
  return {count,total};
}
function updateUI(){
  const {count,total}=totals();
  cartCount.textContent=count; cartTotal.textContent=total; ctaCount.textContent=count;
  cartBar.hidden=count===0;
  items.forEach(el=>{
    const q=cart.get(el.dataset.name)?.qty||0;
    const btn=el.querySelector('.add-btn');
    btn.textContent=q?`+ ADD (${q})`:'+ ADD'; btn.classList.toggle('active',q>0);
  });
  if(modal.classList.contains('open')) renderOrder();
}
function renderOrder(){
  lines.innerHTML='';
  cart.forEach(i=>{
    if(!i.qty)return;
    const row=document.createElement('div'); row.className='order-line';
    row.innerHTML=`<div><div class="order-line-name">${i.name}</div><div class="order-line-price">${peso(i.price)} each • ${peso(i.price*i.qty)}</div></div><div class="qty"><button type="button" data-act="minus" aria-label="Remove one">−</button><b>${i.qty}</b><button type="button" data-act="plus" aria-label="Add one">+</button></div>`;
    row.querySelector('[data-act="minus"]').onclick=()=>changeQty(i.name,-1);
    row.querySelector('[data-act="plus"]').onclick=()=>changeQty(i.name,1);
    lines.appendChild(row);
  });
  const {total,count}=totals(); modalTotal.textContent=total;
  document.getElementById('messengerOrder').disabled=count===0;
  if(!count) lines.innerHTML='<p style="text-align:center;color:#776a60;padding:18px 0">Your order is empty.</p>';
}
function changeQty(name,delta){
  const i=cart.get(name); if(!i)return; i.qty+=delta;
  if(i.qty<=0)cart.delete(name); else cart.set(name,i);
  updateUI();
}
function openModal(){renderOrder();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
cartBar.onclick=openModal; document.getElementById('openOrder').onclick=openModal;
document.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeModal);

function orderText(){
  const name=document.getElementById('customerName').value.trim();
  const method=document.querySelector('input[name="orderMethod"]:checked')?.value || '';
  const notes=document.getElementById('orderNotes').value.trim();
  const {total}=totals();
  const out=['Hi Dark Secrets! I’d like to order:',''];
  cart.forEach(i=>out.push(`• ${i.qty}× ${i.name} — ${peso(i.qty*i.price)}`));
  out.push('',`Total: ${peso(total)}`);
  if(name) out.push(`Name: ${name}`);
  if(method) out.push(`Order Method: ${method}`);
  if(notes) out.push(`Notes: ${notes}`);
  return out.join('\n');
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch(e){
    const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();
    const ok=document.execCommand('copy');t.remove();return ok;
  }
}
document.getElementById('messengerOrder').onclick=async()=>{
  if(!totals().count)return;
  const btn=document.getElementById('messengerOrder');
  btn.textContent='COPYING ORDER…';
  const copied=await copyText(orderText());
  btn.textContent=copied?'COPIED! OPENING MESSENGER…':'OPENING MESSENGER…';
  setTimeout(()=>{window.location.href='https://m.me/DarkSecretsCoffee';},350);
};
updateUI();


/* Cross-browser clipboard fallback */
async function dsCopyText(text){
  if (navigator.clipboard && window.isSecureContext){
    try { await navigator.clipboard.writeText(text); return true; } catch(e){}
  }
  try{
    const t=document.createElement('textarea');
    t.value=text; t.setAttribute('readonly','');
    t.style.position='fixed'; t.style.left='-9999px';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0,t.value.length);
    const ok=document.execCommand('copy');
    document.body.removeChild(t);
    return !!ok;
  }catch(e){ return false; }
}
function dsShowFallback(text){
  const box=document.getElementById('orderTextFallback');
  const area=document.getElementById('generatedOrderText');
  if(!box||!area)return;
  area.value=text; box.hidden=false;
  area.style.height='auto'; area.style.height=Math.min(Math.max(area.scrollHeight,140),320)+'px';
}
document.getElementById('copyOrderOnly')?.addEventListener('click',async function(){
  const area=document.getElementById('generatedOrderText');
  const ok=await dsCopyText(area.value);
  if(ok){this.textContent='✓ COPIED!';setTimeout(()=>this.textContent='COPY ORDER',1600);}
  else{area.focus();area.select();area.setSelectionRange(0,area.value.length);alert('Automatic copy is blocked. Tap and hold the selected order, then choose Copy.');}
});


const dsCombinedBtn = Array.from(document.querySelectorAll('button,a')).find(el => /copy order.*open messenger/i.test((el.textContent||'').trim()));
if(dsCombinedBtn){
  dsCombinedBtn.addEventListener('click',async function(e){
    e.preventDefault(); e.stopImmediatePropagation();
    let text='';
    if(typeof buildOrderMessage==='function') text=buildOrderMessage();
    else if(typeof buildMessage==='function') text=buildMessage();
    else if(typeof getOrderText==='function') text=getOrderText();
    if(!text) return;
    dsShowFallback(text);
    const ok=await dsCopyText(text);
    if(ok){
      this.textContent='✓ COPIED! OPENING MESSENGER…';
      setTimeout(()=>location.href='https://m.me/DarkSecretsCoffee',650);
    }else{
      this.textContent='COPY BLOCKED — USE COPY ORDER BELOW';
      const area=document.getElementById('generatedOrderText');
      area?.focus(); area?.select(); area?.setSelectionRange(0,area.value.length);
    }
  },true);
}
