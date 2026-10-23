import {attributes,adaptNutrition,collectOrders} from '/rules.js';
import {synchronize,safeDiagnostics} from '/sync.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const catalog=[
 {id:'001',name:'巨无霸',category:'主餐',rarity:'SR',art:0,skill:'双层快乐',lore:'把熟悉的经典，叠成今天的小满足。',nutrition:{basis:'per-serving',protein:24,carbs:42,fat:28,energy:520,energyUnit:'kcal',sodium:980}},
 {id:'002',name:'薯条（中）',aliases:['中薯条'],category:'配餐',rarity:'R',art:1,skill:'黄金搭档',lore:'一根接一根，是快乐最简单的形状。',nutrition:{basis:'per-serving',protein:4,carbs:40,fat:16,energy:320,energyUnit:'kcal',sodium:220}},
 {id:'003',name:'可口可乐（中）',aliases:['中杯可口可乐'],category:'饮品',rarity:'R',art:2,skill:'气泡时刻',lore:'让每一个普通的瞬间，冒一点快乐的泡。',nutrition:{basis:'per-serving',protein:0,carbs:35,fat:0,energy:140,energyUnit:'kcal',sodium:15}},
 {id:'004',name:'麦乐鸡（5块）',aliases:['5块麦乐鸡'],category:'配餐',rarity:'SR',art:3,skill:'分享加成',lore:'金黄酥脆的默契，留一块给喜欢的人。',nutrition:{basis:'per-serving',protein:13,carbs:12,fat:14,energy:230,energyUnit:'kcal',sodium:460}},
 {id:'005',name:'圆筒冰淇淋',category:'甜品',rarity:'R',art:4,skill:'甜蜜暂停',lore:'给忙碌按下暂停，接住这一口温柔。',nutrition:{basis:'per-serving',protein:4,carbs:25,fat:5,energy:160,energyUnit:'kcal',sodium:80}},
 {id:'006',name:'猪柳蛋麦满分',category:'早餐',rarity:'SR',art:5,skill:'早安启动',lore:'用热腾腾的好心情，打开今天的第一章。',nutrition:{basis:'per-serving',protein:21,carbs:30,fat:22,energy:400,energyUnit:'kcal',sodium:780}}
].map(c=>({...c,demo:true}));
let mode='preview',collection=[],deck=[],filter='全部',onlyOwned=false,token='',tools=[],generation=0,nutrition=[],rawOrders=null,activeCard=null,busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const position=i=>`${(i%3)*50}% ${Math.floor(i/3)*100}%`;
const artStyle=c=>`background-position:${position(c.art)}`;
function cardHTML(c,{button=false,hero=false}={}) {const a=attributes(c.nutrition);return `<${button?'button':'div'} class="card ${c.rarity==='SR'?'holo':''}" ${button?`data-card="${c.id}" aria-label="查看${esc(c.name)}卡牌"`:''}><div class="card-inner"><div class="card-top"><span>${esc(c.name)}</span><small>✦ ${c.rarity}</small></div><div class="card-image" style="${artStyle(c)}"><span class="card-tag">${esc(c.category)} · FOOD COMPANION</span></div><div class="card-lore"><strong>✧ ${esc(c.skill)}</strong><p>${esc(c.lore)}</p></div><div class="card-stats"><span>ATK <b>${a.atk??'—'}</b></span><span>DEF <b>${a.def??'—'}</b></span></div></div><div class="card-foot"><span>MC–${c.id} / VOL. 01</span><span>${c.demo?'示例数据 · 非官方营养':'MCP 收藏 · 属性见来源'}</span></div></${button?'button':'div'}>`;}
function current(c){return collection.find(x=>x.id===c.id) || {...c,...(mode==='real'?{nutrition:null,demo:false}:{})};}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function modal(id){$(id).showModal();}
function render(){
 const query=$('#search').value.trim();const visible=catalog.filter(c=>(filter==='全部'||c.category===filter)&&(!onlyOwned||collection.some(x=>x.id===c.id))&&c.name.includes(query));
 $('#gallery').innerHTML=visible.length?visible.map(c=>`<div class="gallery-item">${cardHTML(current(c),{button:true})}<div class="item-caption"><span>${collection.some(x=>x.id===c.id)?'● 已收藏':'○ 未解锁'}</span><span>${c.category} / ${c.id}</span></div></div>`).join(''):'<p class="empty">这里还没有卡牌。换个分类，或同步你的订单。</p>';
 $('#mode-label').textContent=mode==='preview'?'○ 图鉴预览 · 连接真实订单，解锁属于你的收藏':mode==='demo'?`● 演示卡册 · 示例订单已解锁 ${collection.length} 种餐品`:`● 真实 MCP 卡册 · 已识别 ${collection.length} 种餐品`;
 $('#count-label').textContent=`${visible.length} 张卡牌 / VOL. 01`;
 $('#deck-slots').innerHTML=Array.from({length:3},(_,i)=>deck[i]?`<div class="deck-slot">${cardHTML(deck[i])}<button class="remove-card" data-remove="${deck[i].id}" aria-label="移除${esc(deck[i].name)}">×</button></div>`:`<div class="deck-slot"><div class="empty-slot"><span>＋</span>选择一张心头好</div></div>`).join('');
 $('#export-deck').disabled=deck.length!==3;
}
function demo(){generation++;abortRequests();busy=false;token='';tools=[];rawOrders=null;nutrition=[];$('#token').value='';connectionUI(false);$('#sync-summary').hidden=true;$('#sync-diagnostics').textContent='';mode='demo';collection=catalog.slice(0,3).map(c=>({...c,quantity:1}));deck=[];render();reveal(collection,true);}
function reveal(cards,isDemo){$('#reveal-summary').textContent=`${isDemo?'示例订单':'本次查询'} · 共收录 ${cards.length} 种餐品卡，点击卡背翻开`;$('#reveal-cards').innerHTML=cards.slice(0,6).map(c=>`<button class="card sealed" data-reveal="${c.id}" aria-label="翻开${esc(c.name)}"><span>✦</span><small>一份快乐，待开启</small></button>`).join('');modal('#reveal-modal');}
function detail(id){const c=current(catalog.find(c=>c.id===id));activeCard=c;const a=attributes(c.nutrition),n=c.nutrition;
 $('#card-content').innerHTML=`<button class="close" data-close aria-label="关闭">×</button><div class="modal-layout">${cardHTML(c)}<div><p class="eyebrow">FOOD COMPANION / ${c.id}</p><h2>${esc(c.name)}</h2><p>${esc(c.lore)}</p><div class="nutrition-table">${[['蛋白质',n?.protein,'g'],['碳水',n?.carbs,'g'],['脂肪',n?.fat,'g'],['能量',n?.energy,n?.energyUnit||''],['钠',n?.sodium,'mg'],['口径',n?.basis==='per-serving'?'每份':'待核验','']].map(([label,v,u])=>`<div>${label}<b>${v===undefined||v===null?'待补全':esc(v)+' '+esc(u)}</b></div>`).join('')}</div><p>${c.demo?'示例数值，非官方营养数据。':'来源：当前连接用户的 MCP 营养查询；仅明确标注每份口径时计算属性。'}<br>ATK＝蛋白质 ×100；DEF＝碳水 ×40。娱乐换算，不代表健康评分。</p><div class="modal-actions"><button class="button red" id="add-deck">加入招牌卡组 ＋</button><button class="button dark" id="export-card">导出卡牌 ↗</button></div></div></div>`;modal('#card-modal');}
function addDeck(){if(!collection.some(c=>c.id===activeCard.id)){toast('先同步订单解锁，或在演示中收藏这张卡');return;}if(deck.some(c=>c.id===activeCard.id)){toast('这张卡已经在卡组里了');return;}if(deck.length===3){toast('卡组已满，先移除一张卡吧');return;}deck.push(activeCard);render();toast('已加入你的快乐阵容');}
const requests=new Set();
function abortRequests(){for(const request of requests)request.abort();requests.clear();}
const call=async(body,ownGeneration=generation)=>{
 if(ownGeneration!==generation)throw new Error('连接已切换，请重新操作。');
 const controller=new AbortController();requests.add(controller);
 try{
  const response=await fetch('/api/mcp',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  const data=await response.json();
  if(ownGeneration!==generation)throw new Error('连接已切换，请重新操作。');
  if(!response.ok)throw new Error(data.error||'连接失败');return data;
 }finally{requests.delete(controller);}
};
function connectionUI(connected, working=false) {
 $('#token-entry').hidden=connected;
 $('#connect').hidden=connected;
 $('#connected-state').hidden=!connected;
 $('#sync').hidden=!connected;
 $('#disconnect').hidden=!connected;
 $('#connect').disabled=working;
 $('#sync').disabled=working;
 $('#sync').textContent=working?'正在整理你的卡册…':'重新同步我的卡册 ↻';
}
function disconnect(){
 generation++;abortRequests();busy=false;token='';tools=[];collection=[];deck=[];nutrition=[];rawOrders=null;mode='preview';
 $('#token').value='';$('#sync-diagnostics').textContent='';$('#sync-summary').hidden=true;
 connectionUI(false);$('#connect-status').textContent='已断开，凭证和当前收藏已清除。';render();
}
function reportCollection(raw,warnings=[]){
 const result=collectOrders(raw,nutrition,catalog);collection=result.cards;
 deck=deck.filter(c=>collection.some(x=>x.id===c.id)).map(c=>collection.find(x=>x.id===c.id));mode='real';render();
 const unknown=result.pending.filter(p=>p.reason==='订单状态未确认为已完成').length;
 let message=collection.length?`已整理 ${result.orderCount} 笔订单，为你解锁 ${collection.length} 种餐品卡。`:
   result.orderCount?`已读取 ${result.orderCount} 笔订单，暂未找到可确认解锁的卡牌。`:'暂未发现可识别的近期订单。';
 if(unknown) message+=`\n${unknown} 笔订单的状态还需确认，暂未计入收藏。`;
 if(!result.orderCount) message+=' 如果你近期有消费记录，可能需要更新订单数据适配。';
 if(warnings.length) message+='\n'+warnings.join('\n');
 $('#connect-status').textContent=message;
 $('#sync-summary').hidden=!result.pending.length;
 $('#sync-summary-title').textContent=`${result.pending.length} 项信息待补全`;
 $('#sync-pending').replaceChildren(...result.pending.slice(0,15).map(p=>{const item=document.createElement('li');item.textContent=`${p.name}：${p.reason}`;return item;}));
 if(collection.length){$('#connect-modal').close();reveal(collection,false);}return result;
}
async function sync(){
 if(busy||!token)return;const gen=generation;busy=true;connectionUI(true,true);$('#sync-summary').hidden=true;
 try{
  const snapshot=await synchronize(tools,body=>call(body,gen),message=>{if(gen===generation)$('#connect-status').textContent=message;},()=>gen===generation);
  if(gen!==generation)return;
  rawOrders=snapshot.orders;nutrition=adaptNutrition(snapshot.nutrition);
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1')$('#sync-diagnostics').textContent=JSON.stringify(safeDiagnostics(snapshot.orders,snapshot.nutrition),null,2);
  reportCollection(rawOrders,snapshot.warnings);
 }catch(e){if(gen===generation)$('#connect-status').textContent=e.message+' 可点击重新同步重试。';}
 finally{if(gen===generation){busy=false;connectionUI(true);}}
}
async function connect(){
 if(busy)return;const value=$('#token').value.trim();if(!value){toast('请先输入你的 MCP Token');return;}
 generation++;const gen=generation;token=value;$('#token').value='';collection=[];deck=[];rawOrders=null;nutrition=[];tools=[];
 mode='real';render();busy=true;connectionUI(false,true);$('#connect-status').textContent='正在连接你的麦当劳账户…';
 let connected=false;
 try{
  const data=await call({action:'connect'},gen);tools=data.tools;
  if(!tools.some(t=>t.name==='order-list')||!tools.some(t=>t.name==='list-nutrition-foods'))throw new Error('当前账户暂不支持订单或营养查询。');
  connected=true;connectionUI(true);$('#connect-status').textContent='连接成功，正在准备你的卡册…';
 }catch(e){if(gen===generation){token='';tools=[];connectionUI(false);$('#connect-status').textContent=e.message;}}
 finally{if(gen===generation){busy=false;$('#connect').disabled=false;}}
 if(connected&&gen===generation)await sync();
}
async function download(cards,name){try{const image=new Image();image.src='/art.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=cards.length===1?800:1600;canvas.height=cards.length===1?1130:1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#f6f3eb';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#c63327';ctx.font='bold 26px sans-serif';ctx.fillText('✦ 麦麦卡牌图鉴 / MAIMAI CARD CLUB',55,65);ctx.fillStyle='#252620';ctx.font='bold 42px sans-serif';ctx.fillText(name,55,135);const w=cards.length===1?640:460,gap=32,start=(canvas.width-(w*cards.length+gap*(cards.length-1)))/2;
 cards.forEach((c,i)=>{const x=start+i*(w+gap),y=185,h=w*1.48;ctx.fillStyle='#e9d6a5';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#645b41';ctx.lineWidth=2;ctx.strokeRect(x+8,y+8,w-16,h-16);ctx.fillStyle='#252620';ctx.font=`bold ${w*.055}px sans-serif`;ctx.fillText(c.name,x+24,y+46);const sw=image.width/3,sh=image.height/2;ctx.drawImage(image,(c.art%3)*sw,Math.floor(c.art/3)*sh,sw,sh,x+18,y+68,w-36,w-36);ctx.font=`bold ${w*.037}px sans-serif`;ctx.fillText('✦ '+c.skill,x+24,y+w+62);ctx.font=`${w*.027}px sans-serif`;ctx.fillText(c.lore,x+24,y+w+96,w-48);const a=attributes(c.nutrition);ctx.font=`bold ${w*.06}px Georgia`;ctx.fillText(`ATK ${a.atk??'—'}    DEF ${a.def??'—'}`,x+24,y+h-55);ctx.font=`${w*.024}px sans-serif`;ctx.fillText(c.demo?'示例数值 · 非官方营养数据':'MCP 收藏 · 数值按已核验口径展示',x+24,y+h-23);});ctx.fillStyle='#837b68';ctx.font='18px sans-serif';ctx.fillText('独立开发者作品 · 娱乐属性不代表健康评分 · 无兑换权益',55,canvas.height-45);const a=document.createElement('a');a.download=`麦麦卡牌-${name.replace(/[\\/:*?"<>|]/g,'')}.png`;a.href=canvas.toDataURL('image/png');a.textContent='下载 PNG 海报 ↗';a.className='button red';let out=document.querySelector('#export-modal');if(!out){out=document.createElement('dialog');out.id='export-modal';document.body.append(out);}out.replaceChildren();const close=document.createElement('button');close.className='close';close.textContent='×';close.setAttribute('aria-label','关闭');close.onclick=()=>out.close();const note=document.createElement('p');note.textContent='海报已生成，可下载或长按图片保存。';const img=document.createElement('img');img.src=a.href;img.alt='生成的麦麦卡组海报';img.style.cssText='width:100%;display:block;margin:20px 0';out.append(close,note,img,a);out.showModal();toast('海报已生成');}catch{toast('图片生成失败，请稍后重试');}}
$('#hero-cards').innerHTML=`<div class="hero-card tertiary">${cardHTML(catalog[2])}</div><div class="hero-card secondary">${cardHTML(catalog[1])}</div><div class="hero-card">${cardHTML(catalog[0])}</div>`;
document.addEventListener('click',event=>{const el=event.target.closest('button');if(!el)return;if(el.matches('[data-connect]'))modal('#connect-modal');if(el.matches('[data-close]'))el.closest('dialog').close();if(el.dataset.card)detail(el.dataset.card);if(el.dataset.filter){filter=el.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b===el));render();}if(el.dataset.remove){deck=deck.filter(c=>c.id!==el.dataset.remove);render();}if(el.dataset.reveal){const c=collection.find(c=>c.id===el.dataset.reveal);el.outerHTML=cardHTML(c);}if(el.id==='add-deck')addDeck();if(el.id==='export-card')download([activeCard],activeCard.name);});
$('#demo').onclick=demo;$('#search').oninput=render;$('#owned').onclick=()=>{onlyOwned=!onlyOwned;$('#owned').setAttribute('aria-pressed',onlyOwned);render();};$('#connect').onclick=connect;$('#sync').onclick=sync;$('#disconnect').onclick=disconnect;$('#finish-reveal').onclick=()=>{$('#reveal-modal').close();$('#collection').scrollIntoView({behavior:'smooth'});};$('#export-deck').onclick=()=>download(deck,$('#deck-name').value||'我的快乐三件套');
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));render();
