// Browser smoke of the original approved v16 template using an isolated fake Supabase client.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let server;
test.beforeAll(async()=>{
  const allowed=new Set(['inventory-v16-approved-live-controller.js','inventory-v16-approved-live-template.html',
    'inventory-v16-approved-style-WIP.css','inventory-admin-session-gateway-DRAFT.js',
    'inventory-persistence-controller-DRAFT.js','inventory-rpc-adapter-v2-DRAFT.js',
    'inventory-readonly-provider-v1-DRAFT.js','inventory-costing-snapshot-DRAFT.js']);
  server=createServer((req,res)=>{
    const path=decodeURIComponent((req.url||'/').split('?')[0]);
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head></head><body><div id="inventory"></div></body></html>');return;}
    const name=path.slice('/inventory/'.length);
    if(!path.startsWith('/inventory/')||!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'text/javascript');
    res.end(readFileSync(resolve(process.cwd(),'inventory',name)));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
});
test.afterAll(async()=>{if(server)await new Promise(ok=>server.close(ok));});

test('approved v16 loads, switches tabs and displays persisted mock stock and recipes',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(async()=>{
    const bean='00000000-0000-4000-8000-000000000001';
    const coffee='00000000-0000-4000-8000-000000000002';
    const recipe='00000000-0000-4000-8000-000000000003';
    const tables={
      inventory_items:[{id:bean,item_code:'BEAN',name:'Coffee Beans',category:'Coffee',item_type:'ingredient',
        base_unit:'g',preferred_purchase_unit:'kg',minimum_stock:100,is_active:true}],
      inventory_stock_movements:[{id:'00000000-0000-4000-8000-000000000004',item_id:bean,
        movement_type:'receive',quantity_delta:1000,value_delta:200,quantity_after:1000,
        value_after:200,reference:'INV-100',created_at:'2026-11-20T00:00:00Z'}],
      inventory_recipes:[{id:recipe,product_id:coffee,recipe_revision:1,approved_revision:null,
        price_reviewed_at:null,price_review_revision:null}],
      inventory_recipe_lines:[{id:'00000000-0000-4000-8000-000000000005',
        recipe_id:recipe,item_id:bean,quantity_base:20}]
    };
    const products=[{id:coffee,name:'Americano',price:100}];
    const client={
      auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},
      rpc:async(name)=>name==='is_admin'?{data:true,error:null}:{data:null,error:new Error('Mock writes disabled')},
      from:table=>({
        select:()=>({
          order:()=>({
            range:async(from,to)=>({data:(tables[table]||[]).slice(from,to+1),error:null}),
            then:(resolve)=>resolve({data:table==='products'?products:[],error:null})
          })
        })
      })
    };
    const {mountApprovedV16Inventory}=await import('/inventory/inventory-v16-approved-live-controller.js');
    await mountApprovedV16Inventory(document.getElementById('inventory'),client);
  });
  await expect(page.locator('#inventoryV16 #count')).toHaveText('1');
  await page.getByRole('button',{name:'Stock Master',exact:true}).click();
  await expect(page.locator('#inventoryV16 #stockRows')).toContainText('Coffee Beans');
  await expect(page.locator('#inventoryV16 #stockRows button',{hasText:'Edit'})).toHaveCount(1);
  await expect(page.locator('#inventoryV16 #stockRows button',{hasText:'Delete'})).toHaveCount(1);
  await page.locator('#inventoryV16 #stockRows button',{hasText:'Edit'}).click();
  await expect(page.locator('#inventoryV16 #saveStockItem')).toHaveText('Save changes');
  await expect(page.locator('#inventoryV16 #stockForm [name="name"]')).toHaveValue('Coffee Beans');
  await expect(page.locator('#inventoryV16 #stockForm [name="unit"]')).toBeDisabled();
  await page.locator('#inventoryV16 #cancelStockEdit').click();
  await expect(page.locator('#inventoryV16 #saveStockItem')).toHaveText('Add stock item');
  await expect(page.locator('#inventoryV16 #stockRows')).toContainText('0.2000');
  await page.getByRole('button',{name:'Receive Stock',exact:true}).click();
  await expect(page.locator('#inventoryV16 #costHistoryRows')).toContainText('INV-100');
  await page.getByRole('button',{name:'Recipes & Costing',exact:true}).click();
  await expect(page.locator('#inventoryV16 #productRows')).toContainText('Americano');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.locator('#inventoryV16 #lines')).toContainText('Coffee Beans');
  await expect(page.locator('#inventoryV16 #estimate')).toContainText('₱4.00');
  await expect(page.locator('#inventoryV16 #priceApproval')).toBeVisible();
  await page.evaluate(()=>{
    const tab=document.createElement('button');tab.id='tabProducts';document.body.append(tab);
    window.DS_selectAdminTab=name=>{window.__lastAdminTab=name;};
    window.addEventListener('ds:inventory-price-review',e=>{window.__priceHandoff=e.detail;});
  });
  await page.locator('#inventoryV16 #customPriceInput').fill('125');
  await page.locator('#inventoryV16 #applyCustomPrice').click();
  await expect.poll(()=>page.evaluate(()=>window.__lastAdminTab)).toBe('Products');
  await expect.poll(()=>page.evaluate(()=>window.__priceHandoff?.proposedPrice)).toBe(125);
  await expect.poll(()=>page.evaluate(()=>window.__priceHandoff?.productId)).toBe('00000000-0000-4000-8000-000000000002');
  await expect(page.locator('#inventoryV16 #stockForm [name="code"]')).toHaveCount(0);
  await expect(page.locator('#inventoryV16 #stockForm [name="category"]')).toHaveCount(0);
  await expect(page.locator('#inventoryV16 #stockForm [name="supplier"]')).toHaveCount(0);
  await expect(page.locator('#inventoryV16 #stockForm .grid label')).toHaveCount(4);
  await expect(page.locator('#inventoryV16 .costing-tile')).toHaveCount(6);
  await expect(page.locator('#inventoryV16 .requirement')).toHaveCount(4);
  await expect(page.locator('#inventoryV16 #lines button',{hasText:'Edit'})).toHaveCount(1);
  await expect(page.locator('#inventoryV16 .ds-guide-glow')).toHaveCount(1);
  await expect(page.locator('#inventoryV16 #customPriceInput')).toBeVisible();
  await expect(page.locator('#inventoryV16 #applyCustomPrice')).toBeVisible();
  const layout = await page.locator('#inventoryV16 .shell').evaluate(node=>{
    const rect=node.getBoundingClientRect();
    return {width:rect.width,viewport:document.documentElement.clientWidth};
  });
  expect(layout.width).toBeGreaterThan(900);
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  await page.screenshot({path:'test-results/approved-v16-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Stock Master',exact:true}).click();
  await expect(page.locator('#inventoryV16 #priceApproval')).toBeHidden();
  await page.getByRole('button',{name:'Recipes & Costing',exact:true}).click();
  await expect(page.locator('#inventoryV16 #priceApproval')).toBeVisible();
  expect(errors).toEqual([]);
});
