// Browser integration smoke test with a fake Supabase client. No LIVE access.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let server;
test.beforeAll(async () => {
  const allowed=new Set([
    'inventory-persistent-admin-panel-DRAFT.js',
    'inventory-admin-session-gateway-DRAFT.js',
    'inventory-persistence-controller-DRAFT.js',
    'inventory-rpc-adapter-v2-DRAFT.js',
    'inventory-readonly-provider-v1-DRAFT.js',
    'inventory-costing-snapshot-DRAFT.js'
  ]);
  server=createServer((req,res)=>{
    const path=decodeURIComponent((req.url||'/').split('?')[0]);
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><main id="inventory"></main></body></html>');return;}
    const name=path.slice('/inventory/'.length);
    if(!path.startsWith('/inventory/')||!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('Content-Type','text/javascript');
    res.end(readFileSync(resolve(process.cwd(),'inventory',name)));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
});
test.afterAll(async()=>{if(server)await new Promise(ok=>server.close(ok));});

test('admin panel loads persisted mock data, WAC, and recipe switching',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const requests=[];
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(async()=>{
    const bean='00000000-0000-4000-8000-000000000001';
    const milk='00000000-0000-4000-8000-000000000002';
    const coffee='00000000-0000-4000-8000-000000000003';
    const tea='00000000-0000-4000-8000-000000000004';
    const recipe='00000000-0000-4000-8000-000000000005';
    const tables={
      inventory_items:[
        {id:bean,name:'Coffee Beans',base_unit:'g',preferred_purchase_unit:'kg',is_active:true},
        {id:milk,name:'Milk',base_unit:'ml',preferred_purchase_unit:'l',is_active:true}
      ],
      inventory_stock_movements:[
        {id:'m1',item_id:bean,quantity_after:1000,value_after:20,created_at:'2026-11-01T00:00:00Z'}
      ],
      inventory_recipes:[{id:recipe,product_id:coffee,recipe_revision:1,approved_revision:null}],
      inventory_recipe_lines:[{id:'line1',recipe_id:recipe,item_id:bean,quantity_base:20}]
    };
    const products=[{id:coffee,name:'Latte',price:5},{id:tea,name:'Tea',price:3}];
    const client={
      auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},
      rpc:async(name)=>name==='is_admin'?{data:true,error:null}:{data:null,error:new Error('Writes disabled in smoke test')},
      from:table=>({
        select:()=>({
          order:()=>({range:async(from,to)=>({data:(tables[table]||[]).slice(from,to+1),error:null})}),
          then:(resolve)=>resolve({data:table==='products'?products:[],error:null})
        })
      })
    };
    const {mountInventoryPersistentAdminPanel}=await import('/inventory/inventory-persistent-admin-panel-DRAFT.js');
    await mountInventoryPersistentAdminPanel(document.getElementById('inventory'),client);
  });
  await expect(page.getByRole('status')).toContainText('Loaded 2 inventory items and 1 recipes');
  await expect(page.getByRole('heading',{name:'Recipe costing overview'})).toBeVisible();
  await expect(page.locator('table').first()).toContainText('0.0200');
  await expect(page.locator('table').nth(1)).toContainText('0.4000');
  await expect(page.locator('ul li')).toContainText(['Coffee Beans — 20 g Remove']);
  await page.locator('select').filter({has:page.locator('option', {hasText:'Tea'})}).selectOption({label:'Tea — 3'});
  await expect(page.locator('ul li')).toHaveCount(0);
  await expect(page.getByText('Saved selling price: 3')).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.every(url=>new URL(url).origin===new URL(page.url()).origin)).toBe(true);
});
