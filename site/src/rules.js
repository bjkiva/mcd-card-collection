export const normalizeName = v => String(v ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function attributes(n) {
  if (!n || n.basis !== 'per-serving') return { atk: null, def: null };
  const score = (v, factor) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * factor) : null;
  return { atk: score(n.protein, 100), def: score(n.carbs, 40) };
}
export function payload(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  try { return JSON.parse(text); } catch { return { unparsedText: text }; }
}
export function rows(value, keys) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const k of keys) if (Array.isArray(value[k])) return value[k];
  for (const k of ['data','result','response']) { const nested = rows(value[k], keys); if (nested.length) return nested; }
  return [];
}
const pick = (o, keys) => keys.map(k => o?.[k]).find(v => v !== undefined && v !== null);
const numeric = v => typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
export const orderRows = raw => rows(raw, ['orders','orderList','list','records','items']);
export const orderId = order => pick(order,['orderId','orderNo','id']);
export const orderItems = order => rows(order,['products','items','orderItems','goodsList','productList']);
const statusKeys = ['statusName','orderStatusName','statusDesc','orderStatusDesc','orderStatusText','stateName','status','orderStatus','state'];
const completedStates = new Set(['completed','finished','fulfilled','已完成','订单完成','订单已完成','已取餐','已送达','交易成功']);
const excludedStates = new Set(['canceled','cancelled','refunded','已取消','订单已取消','退款成功','已退款','退款中','部分退款','部分退款成功']);
export function orderState(order) {
  const values = statusKeys.map(k=>String(order?.[k]??'').trim().toLowerCase());
  if(values.some(v=>excludedStates.has(v)) || order?.refunded===true || order?.isRefunded===true || order?.cancelled===true) return 'excluded';
  if(values.some(v=>completedStates.has(v))) return 'completed';
  return 'unknown';
}
export function mergeOrderDetail(order,detail) {
  const id=orderId(order);
  if(orderId(detail)!==undefined && String(orderId(detail))!==String(id)) throw new Error('订单标识不匹配');
  const merged={...order};
  // A fresh detail status must not inherit a stale completed label from the list.
  if(statusKeys.some(k=>detail[k]!==undefined)) for(const key of statusKeys) delete merged[key];
  Object.assign(merged,detail);
  const items=orderItems(detail);
  if(items.length) merged.products=items;
  return merged;
}
export function adaptNutrition(raw) {
  return rows(raw, ['foods','nutritionFoods','list','records','items']).map(x => ({
    name: pick(x,['foodName','productName','name','餐品名称']),
    basis: pick(x,['basis','nutritionBasis']) === 'per-serving' ? 'per-serving' : 'unknown',
    protein: numeric(pick(x,['protein','proteinG'])), carbs: numeric(pick(x,['carbs','carbohydrate','carbohydrates'])),
    fat: numeric(x.fat), energy: numeric(pick(x,['energy','calories'])), energyUnit: x.energyUnit || '未标明', sodium: numeric(x.sodium)
  })).filter(x => x.name);
}
export function collectOrders(raw, nutrition, catalog) {
  const cards = new Map(), pending = [], seen = new Set();
  const orders = orderRows(raw);
  for (const order of orders) {
    const id = orderId(order);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    // Explicit human-readable state wins over an unknown numeric code; refunds always veto.
    if (orderState(order) !== 'completed') {
      pending.push({ reason: '订单状态未确认为已完成', name: '一笔订单' }); continue;
    }
    const lines = orderItems(order);
    if (!lines.length) pending.push({ name:'一笔订单', reason:'列表未包含餐品，请通过订单详情补充' });
    const visit = line => {
      const children = rows(line,['children','subItems','components','subProducts']);
      if (children.length) { children.forEach(visit); return; }
      const name = pick(line,['productName','foodName','name','goodsName']);
      const card = catalog.find(c => normalizeName(c.name) === normalizeName(name) || (c.aliases || []).some(a => normalizeName(a) === normalizeName(name)));
      if (!card) { pending.push({ name: name || '未知餐品', reason:'未找到精确的餐品及规格映射' }); return; }
      const n = nutrition.find(n => normalizeName(n.name) === normalizeName(name));
      const quantity = numeric(pick(line,['quantity','qty','count'])) ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1) { pending.push({name,reason:'数量格式待确认'}); return; }
      const previous = cards.get(card.id);
      cards.set(card.id, { ...card, quantity: (previous?.quantity || 0) + quantity, nutrition: n || null, demo:false });
    };
    lines.forEach(visit);
  }
  return { cards:[...cards.values()], pending, orderCount:seen.size };
}
