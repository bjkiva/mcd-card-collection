const ALLOWED = new Set(['list-nutrition-foods','order-list','query-order','now-time-info']);
export async function readRPC(response, id) {
  if (!response.ok) {
    const messages = {401:'Token 无效或已过期，请重新申请。',403:'当前 Token 无权使用此工具。',429:'请求过于频繁，请稍后重试。'};
    throw new Error(messages[response.status] || `麦当劳 MCP 返回 HTTP ${response.status}`);
  }
  if (!(response.headers.get('content-type') || '').includes('text/event-stream')) return response.json();
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      buffer += decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0,end); buffer = buffer.slice(end+2);
        const data = block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
        if (!data) continue;
        try { const message=JSON.parse(data); if (message.id === id) return message; } catch {}
      }
    }
  } finally { await reader.cancel().catch(()=>{}); }
  throw new Error('MCP 流未返回对应结果，请重试。');
}
export async function mcpRequest(token, action, name, args = {}, fetcher = fetch) {
  let session, protocol='2025-03-26', next=0;
  const controller = new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
  const send = async (method,params,notify=false) => {
    const id=++next;
    const headers={'Authorization':`Bearer ${token}`,'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':protocol};
    if(session) headers['Mcp-Session-Id']=session;
    const response=await fetcher('https://mcp.mcd.cn',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(notify?{}:{id}),method,params}),signal:controller.signal});
    session=response.headers.get('Mcp-Session-Id') || session;
    if(notify && response.ok) { await response.body?.cancel(); return; }
    const result=await readRPC(response,id);
    if(result.error) throw new Error('MCP 调用失败，请检查工具参数和账户权限。');
    return result.result;
  };
  try {
    const init=await send('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'maimai-card-collection',version:'1.0.0'}});
    protocol=init.protocolVersion || protocol;
    await send('notifications/initialized',{},true);
    const discovered=[]; let cursor;
    do { const page=await send('tools/list',cursor?{cursor}:{}); discovered.push(...page.tools); cursor=page.nextCursor; if(discovered.length>500) throw new Error('工具目录过大'); } while(cursor);
    const tools=discovered.filter(t=>ALLOWED.has(t.name));
    if(action==='connect') return {tools};
    if(!ALLOWED.has(name) || !tools.some(t=>t.name===name)) throw new Error('仅允许查询订单、营养与时间工具。');
    const schema=tools.find(t=>t.name===name).inputSchema;
    for(const key of schema?.required || []) if(args[key]===undefined || args[key]===null || args[key]==='') throw new Error(`请填写工具必填参数：${key}`);
    const result=await send('tools/call',{name,arguments:args});
    if(result.isError) throw new Error('工具返回错误，请核对参数；未更新收藏。');
    return {result};
  } finally {
    clearTimeout(timer);
    if(session) { const close=new AbortController(); const closeTimer=setTimeout(()=>close.abort(),1500); await fetcher('https://mcp.mcd.cn',{method:'DELETE',headers:{'Authorization':`Bearer ${token}`,'Mcp-Session-Id':session,'MCP-Protocol-Version':protocol},signal:close.signal}).catch(()=>{}); clearTimeout(closeTimer); }
  }
}
export async function api(request) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try {
    if(request.method!=='POST') return new Response(JSON.stringify({error:'仅支持 POST'}),{status:405,headers});
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin) return new Response(JSON.stringify({error:'请求来源不匹配'}),{status:403,headers});
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if(!token || token.length<8 || token.length>8192 || /[\r\n]/.test(token)) throw new Error('请输入有效的个人 MCP Token。');
    const text=await request.text(); if(text.length>32768) throw new Error('请求参数过大');
    const {action,name,args}=JSON.parse(text);
    return new Response(JSON.stringify(await mcpRequest(token,action,name,args)),{headers});
  } catch(error) {
    const message=error.name==='AbortError'?'MCP 响应超时，请重试。':error.message;
    return new Response(JSON.stringify({error:message}),{status:400,headers});
  }
}
