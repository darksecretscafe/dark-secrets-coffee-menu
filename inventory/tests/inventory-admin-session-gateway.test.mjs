// Offline auth gate contract; no Supabase connection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const adapter = readFileSync('inventory/inventory-rpc-adapter-v2-DRAFT.js','utf8');
const gateway = readFileSync('inventory/inventory-admin-session-gateway-DRAFT.js','utf8')
 .replace("import { createInventoryDraftApi } from './inventory-rpc-adapter-v2-DRAFT.js';",'');
const src = adapter + '\n' + gateway.replace('export async function','async function') + '\nexport { createInventoryAdminSessionGateway };';
const { createInventoryAdminSessionGateway } = await import('data:text/javascript,'+encodeURIComponent(src));
let admin=true, userId='admin-1';
const client={
 auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
 rpc:async name=>({data:name==='is_admin'?admin:null,error:null}),
 from:()=>({select:async()=>({data:[],error:null})})
};
const session=await createInventoryAdminSessionGateway(client);
assert.equal(session.userId,'admin-1');
assert.equal(await session.verifyBeforeWrite(),true);
await session.api.approveRecipe('product-1');
admin=false;
await assert.rejects(()=>session.verifyBeforeWrite(),/revoked/);
await assert.rejects(()=>session.api.approveRecipe('product-1'),/revoked/);
await assert.rejects(()=>session.api.receive({}),/revoked/);
await assert.rejects(()=>createInventoryAdminSessionGateway(client),/admin privileges/);
admin=true; userId='admin-2';
await assert.rejects(()=>session.verifyBeforeWrite(),/session changed/);
await assert.rejects(()=>createInventoryAdminSessionGateway({...client,auth:{getUser:async()=>({data:{user:null},error:null})}}),/sign-in/);
console.log('PASS: offline admin session gate, revocation, session-change and unauthenticated denial');
