import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {api} from './src/mcp.js';
if(Number(process.versions.node.split('.')[0])<22){console.error('需要 Node.js 22 或更新版本。请升级 Node.js 后重新运行 npm start。');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const port=Number(process.env.PORT || 3000);
const host=process.env.HOST || '127.0.0.1';
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname==='/api/mcp') {
      const buffers=[]; let size=0; for await(const chunk of req) {size+=chunk.length;if(size>32768){res.writeHead(413);res.end();return;}buffers.push(chunk);}
      const response=await api(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(buffers)})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const routes={'/':'public/index.html','/style.css':'public/style.css','/app.js':'public/app.js','/rules.js':'src/rules.js','/sync.js':'src/sync.js','/art.png':'public/art.png'};
    if(!routes[url.pathname]){res.writeHead(404);res.end('Not found');return;}
    const file=routes[url.pathname],bytes=await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'Content-Type':types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{res.writeHead(500);res.end('服务暂不可用');}
}).listen(port,host,()=>console.log(host==='127.0.0.1'?`Local: http://localhost:${port}`:`Listening: http://${host}:${port}`));
