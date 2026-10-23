import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticArgs,synchronize,safeDiagnostics} from '../src/sync.js';
import {orderState,mergeOrderDetail,collectOrders} from '../src/rules.js';

// Input schemas observed from the real connected MCP, without account data.
const tools=[
  {name:'order-list',inputSchema:{type:'object',properties:{}}},
  {name:'list-nutrition-foods',inputSchema:{type:'object',properties:{}}},
  {name:'query-order',inputSchema:{type:'object',properties:{orderId:{type:'string'}},required:['orderId']}}
];
const result=value=>({result:{structuredContent:value}});
test('zero-argument tools run automatically and order IDs come from the list',async()=>{
  const calls=[];
  const snapshot=await synchronize(tools,async request=>{
    calls.push(request);
    if(request.name==='order-list')return result({orders:[{orderId:'test-1',status:9}]});
    if(request.name==='list-nutrition-foods')return result({foods:[]});
    assert.deepEqual(request.args,{orderId:'test-1'});
    return result({data:{orderStatusName:'已完成',items:[{name:'巨无霸'}]}});
  });
  assert.deepEqual(calls.slice(0,2).map(c=>c.args),[{},{}]);
  assert.equal(snapshot.orders.orders[0].orderId,'test-1');
  assert.equal(orderState(snapshot.orders.orders[0]),'completed');
  assert.equal(collectOrders(snapshot.orders,[],[{id:'001',name:'巨无霸'}]).cards.length,1);
});
test('unknown numeric code does not mask explicit completed text; refund takes priority',()=>{
  assert.equal(orderState({status:9,orderStatusName:'已完成'}),'completed');
  assert.equal(orderState({statusName:'已完成',orderStatus:'已退款'}),'excluded');
  assert.equal(orderState({statusName:'已完成',isRefunded:true}),'excluded');
  assert.equal(orderState({status:9}),'unknown');
});
test('detail status supersedes stale list label, and mismatched order is rejected',()=>{
  const merged=mergeOrderDetail({orderId:'one',statusName:'已完成'},{status:5});
  assert.equal(orderState(merged),'unknown');
  assert.throws(()=>mergeOrderDetail({orderId:'one'},{orderId:'two'}),/标识不匹配/);
});
test('nutrition failure does not discard valid orders',async()=>{
  const snapshot=await synchronize(tools,async request=>{
    if(request.name==='list-nutrition-foods')throw new Error('temporary outage');
    return result({orders:[{orderId:'one',status:'已完成',items:[{name:'巨无霸'}]}]});
  });
  assert.equal(snapshot.orders.orders.length,1);assert.equal(snapshot.nutrition,null);assert.equal(snapshot.warnings.length,1);
});
test('failed detail leaves the list record and does not invent completion',async()=>{
  const snapshot=await synchronize(tools,async request=>{
    if(request.name==='order-list')return result({orders:[{orderId:'one',status:7}]});
    if(request.name==='query-order')throw new Error('temporary outage');
    return result([]);
  });
  assert.equal(orderState(snapshot.orders.orders[0]),'unknown');assert.equal(snapshot.warnings.length,1);
});
test('canceled orders are not unnecessarily queried; duplicate list IDs are collapsed',async()=>{
  let details=0;
  const snapshot=await synchronize(tools,async request=>{
    if(request.name==='order-list')return result([{orderId:'one',status:'已取消'},{orderId:'one',status:'已取消'}]);
    if(request.name==='query-order')details++;
    return result([]);
  });
  assert.equal(details,0);assert.equal(snapshot.orders.orders.length,1);
});
test('an invalidated connection cannot continue receiving data',async()=>{
  let current=true;
  await assert.rejects(()=>synchronize(tools,async()=>{current=false;return result([]);},()=>{},()=>current),/连接已切换/);
});
test('new mandatory API fields fail gracefully, without a JSON form',()=>{
  assert.throws(()=>automaticArgs({inputSchema:{required:['unknownField'],properties:{}}}),/暂不支持自动读取/);
});
test('local diagnostics omit order identifiers, addresses and arbitrary response values',()=>{
  const safe=JSON.stringify(safeDiagnostics({orders:[{orderId:'PRIVATE_ORDER',address:'PRIVATE_ADDRESS',status:9,items:[{name:'PRIVATE_FOOD'}]}]},{}));
  assert.ok(!safe.includes('PRIVATE_'));assert.ok(safe.includes('orderId'));assert.ok(safe.includes('statuses'));
});
