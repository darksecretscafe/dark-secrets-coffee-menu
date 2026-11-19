/**
 * Read-only costing projection from persisted SQL 017 movement balances.
 * No writes, no stock deductions. Values are illustrative until validated
 * against Supabase production-equivalent data and price/VAT rules.
 */
export function calculateInventoryCosting(snapshot, products = []) {
  if (!snapshot || !Array.isArray(snapshot.items) || !Array.isArray(snapshot.movements) ||
      !Array.isArray(snapshot.recipes) || !Array.isArray(snapshot.recipeLines) || !Array.isArray(products)) {
    throw new TypeError('Inventory snapshot and products arrays required');
  }
  const byItem = new Map(snapshot.items.map(item => [item.id,item]));
  const latest = new Map();
  for (const movement of snapshot.movements) {
    if (!byItem.has(movement.item_id)) continue;
    const timestamp=Date.parse(movement.created_at);
    if (!Number.isFinite(timestamp)) throw new TypeError('Invalid movement timestamp');
    const previous=latest.get(movement.item_id);
    // Deterministic tie break by movement UUID if timestamps match.
    if (!previous || timestamp>previous.timestamp ||
        (timestamp===previous.timestamp && String(movement.id)>String(previous.row.id))) {
      latest.set(movement.item_id,{row:movement,timestamp});
    }
  }
  const balances=snapshot.items.map(item=>{
    const row=latest.get(item.id)?.row;
    const quantity=row?Number(row.quantity_after):0;
    const value=row?Number(row.value_after):0;
    if (![quantity,value].every(Number.isFinite) || quantity<0 || value<0) throw new RangeError('Invalid stock balance');
    const wac=quantity>0?value/quantity:0;
    return Object.freeze({itemId:item.id,name:item.name,baseUnit:item.base_unit,quantity,value,wac});
  });
  const balanceById=new Map(balances.map(b=>[b.itemId,b]));
  const productsById=new Map(products.map(p=>[p.id,p]));
  const recipes=snapshot.recipes.map(recipe=>{
    const lines=snapshot.recipeLines.filter(line=>line.recipe_id===recipe.id);
    let cost=0;
    const breakdown=lines.map(line=>{
      const balance=balanceById.get(line.item_id);
      if(!balance)throw new Error('Recipe references unknown inventory item');
      const quantity=Number(line.quantity_base);
      if(!Number.isFinite(quantity)||quantity<=0)throw new RangeError('Invalid recipe line quantity');
      const lineCost=quantity*balance.wac;
      cost+=lineCost;
      return Object.freeze({itemId:line.item_id,quantity,unitCost:balance.wac,lineCost});
    });
    const product=productsById.get(recipe.product_id);
    const price=product?.price==null?null:Number(product.price);
    if(price!==null&&!Number.isFinite(price))throw new RangeError('Invalid menu price');
    const profit=price===null?null:price-cost;
    const margin=price>0?profit/price*100:null;
    const approved=recipe.approved_revision!=null &&
      Number(recipe.approved_revision)===Number(recipe.recipe_revision) &&
      price!==null && Number(recipe.approved_price)===price;
    return Object.freeze({recipeId:recipe.id,productId:recipe.product_id,
      productName:product?.name??'Unknown product',price,cost,profit,margin,
      approved,lines:Object.freeze(breakdown)});
  });
  return Object.freeze({balances:Object.freeze(balances),recipes:Object.freeze(recipes)});
}
