import {payload,orderRows,orderId,orderItems,orderState,mergeOrderDetail} from './rules.js';

// Technical parameters are resolved by the app, never delegated to the visitor.
export function automaticArgs(tool, context={}) {
  if(!tool) throw new Error('当前账户暂不支持这项查询，请重新连接后重试。');
  const properties=tool.inputSchema?.properties || {}, args={};
  for(const [key,definition] of Object.entries(properties)) {
    if(definition.default!==undefined) args[key]=definition.default;
    if(context[key]!==undefined) args[key]=context[key];
  }
  for(const key of tool.inputSchema?.required || []) {
    if(args[key]===undefined || args[key]===null || args[key]==='') {
      throw new Error('官方查询要求已更新，当前版本暂不支持自动读取，请稍后更新重试。');
    }
  }
  return args;
}

export async function synchronize(tools, call, progress=()=>{}, isCurrent=()=>true) {
  const get=name=>tools.find(t=>t.name===name);
  const request=async(name,context={})=>{
    if(!isCurrent()) throw new Error('连接已切换，请重新操作。');
    const response=await call({action:'call',name,args:automaticArgs(get(name),context)});
    if(!isCurrent()) throw new Error('连接已切换，请重新操作。');
    return payload(response.result);
  };
  progress('正在读取你的近期订单和餐品营养…');
  const [ordersResult,nutritionResult]=await Promise.allSettled([request('order-list'),request('list-nutrition-foods')]);
  if(ordersResult.status==='rejected') throw ordersResult.reason;
  const warnings=[];
  if(nutritionResult.status==='rejected') warnings.push('营养数据暂时不可用，已确认的餐品仍可收藏，属性待补全。');
  const rawOrders=ordersResult.value, list=orderRows(rawOrders);
  const byId=new Map();
  for(const order of list) if(orderId(order)) byId.set(String(orderId(order)),order);
  const detailTool=get('query-order');
  const candidates=[...byId.values()].filter(o=>orderState(o)!=='excluded' && (orderState(o)==='unknown'||!orderItems(o).length));
  if(detailTool) {
    // Bound automatic work and show a partial result if a larger history is returned.
    const selected=candidates.slice(0,20); let completed=0,failed=0;
    for(let i=0;i<selected.length;i+=3) {
      if(!isCurrent()) throw new Error('连接已切换，请重新操作。');
      const results=await Promise.allSettled(selected.slice(i,i+3).map(async order=>{
        const id=String(orderId(order));
        const response=await request('query-order',{orderId:id});
        const detail=response?.data?.order || response?.data || response?.result?.order || response?.result || response?.order || response;
        if(!detail || typeof detail!=='object' || Array.isArray(detail) || detail.unparsedText) throw new Error('订单详情格式待适配');
        byId.set(id,mergeOrderDetail(order,detail));
      }));
      completed+=results.length;failed+=results.filter(r=>r.status==='rejected').length;
      progress(`正在整理你的订单（${completed} / ${selected.length}）…`);
    }
    if(failed) warnings.push(`${failed} 笔订单详情暂未读取成功，已保留其他可确认的收藏。`);
    if(candidates.length>selected.length) warnings.push('本次优先整理了最近 20 笔待补全订单，其余待后续同步。');
  } else if(candidates.length) warnings.push('部分订单信息尚不完整，暂时保留为待确认。');
  return {orders:{orders:[...byId.values()]},nutrition:nutritionResult.status==='fulfilled'?nutritionResult.value:null,warnings};
}

// Local-development diagnostics: types and status only, never tokens or order identifiers.
export function safeDiagnostics(rawOrders,rawNutrition) {
  const shape=(v,depth=0)=>{
    if(v===null) return 'null';
    if(Array.isArray(v)) return {arrayLength:v.length,item:depth<4&&v.length?shape(v[0],depth+1):'omitted'};
    if(typeof v==='object') return depth>=4?'object':Object.fromEntries(Object.entries(v).slice(0,60).map(([k,value])=>[k,shape(value,depth+1)]));
    return typeof v;
  };
  const statusKeys=['statusName','orderStatusName','statusDesc','orderStatusDesc','orderStatusText','stateName','status','orderStatus','state'];
  const statuses=orderRows(rawOrders).slice(0,3).map(order=>Object.fromEntries(statusKeys.filter(k=>order[k]!==undefined).map(k=>[k,String(order[k]).slice(0,40)])));
  return {orders:shape(rawOrders),nutrition:shape(rawNutrition),statuses};
}
