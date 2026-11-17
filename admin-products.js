
'use strict';

(() => {
  const root = document.getElementById('productsList');
  const addButton = document.getElementById('addProductButton');
  const formContainer = document.getElementById('productFormContainer');

  if (!root || !addButton || !formContainer) return;

  const db = window.DS_adminDb;

  if (!db) {
    root.textContent = 'Admin connection unavailable.';
    return;
  }

  let products = [];
  let categories = [];
  let saving = false;
  const categoryOpenState = new Map();
  let categoryManagerOpen = false;

  const money = value => '₱' + Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function element(tag, content, className) {
    const el = document.createElement(tag);
    if (content !== undefined) el.textContent = content;
    if (className) el.className = className;
    return el;
  }

  async function checkAdmin() {
    const { data: { user }, error: authError } =
      await db.auth.getUser();

    if (authError || !user) {
      throw new Error('Please sign in again.');
    }

    const { data, error } = await db.rpc('is_admin');

    if (error || data !== true) {
      throw new Error('Admin permission required.');
    }
  }

  async function loadProducts() {
    root.textContent = 'Loading products…';

    try {
      await checkAdmin();

      const { data, error } = await db
        .from('products')
        .select(
          'id,product_code,name,price,category,is_active,oat_eligible,description,image_path'
        )
        .order('product_code');

      if (error) throw error;

      products = data || [];
      const categoryResult = await db.from('categories').select('id,name,sort_order').order('sort_order').order('id');
      if (categoryResult.error) throw categoryResult.error;
      categories = categoryResult.data || [];
      renderCategories();
      renderProducts();

    } catch (error) {
      root.textContent = 'Could not load products: ' + error.message;
    }
  }

  function renderProducts() {
    root.replaceChildren();

    if (!products.length) {
      root.textContent = 'No products found.';
      return;
    }

    for (const entry of categories) {
      const category = entry.name;
      const groupedProducts = products.filter(p => p.category === category);
      if (!groupedProducts.length) continue;

      const section = element('details', undefined, 'ds-product-category-section');
      section.dataset.category = category;
      section.open = categoryOpenState.get(category) ?? true;
      section.addEventListener('toggle', () => categoryOpenState.set(category, section.open));
      const heading = element('summary', `${category} (${groupedProducts.length})`, 'ds-product-category-heading');
      const list = element('div', undefined, 'ds-products-grid');

      for (const product of groupedProducts) {
      const card = element('article', undefined, 'ds-product-card');

      const name = element('strong', product.name);

      const code = element(
        'span',
        product.product_code || 'No Product Code',
        'ds-product-code'
      );

      const identity = element('div', undefined, 'ds-product-identity');
      identity.append(code, name);

      const detail = element(
        'span',
        `${money(product.price)} · ${product.category}`,
        'ds-product-detail'
      );

      const description = product.description ? element('span', product.description, 'ds-product-description') : null;

      const oatStatus = element(
        'span',
        product.oat_eligible ? 'Oat Milk Available' : 'No Oat Milk',
        'ds-product-oat'
      );

      const status = element(
        'span',
        product.is_active ? 'Available' : 'Unavailable',
        'ds-product-status' + (product.is_active ? '' : ' inactive')
      );

      const actions = element(
        'div',
        undefined,
        'ds-product-actions'
      );

      const edit = element('button', 'Edit', 'ghost');
      edit.type = 'button';
      edit.onclick = () => showForm(product);

      const toggle = element(
        'button',
        product.is_active ? 'Mark Unavailable' : 'Mark Available',
        'ghost'
      );

      toggle.type = 'button';
      toggle.onclick = () => changeAvailability(product, toggle);

      const remove = element('button', 'Delete', 'ghost ds-product-delete');
      remove.type = 'button';
      remove.title = 'Permanently delete only if this product has no order history';
      remove.onclick = () => deleteUnusedProduct(product, remove);

      actions.append(edit, toggle, remove);

      const thumb = element('div', undefined, 'ds-product-thumb-slot');
      const camera = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      camera.setAttribute('viewBox', '0 0 24 24');
      camera.setAttribute('width', '26');
      camera.setAttribute('height', '26');
      camera.setAttribute('fill', 'none');
      camera.setAttribute('stroke', 'currentColor');
      camera.setAttribute('stroke-width', '1.8');
      camera.setAttribute('stroke-linecap', 'round');
      camera.setAttribute('stroke-linejoin', 'round');
      camera.setAttribute('aria-hidden', 'true');
      for (const d of ['M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4Z', 'M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z']) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        camera.append(path);
      }
      thumb.append(camera);
      thumb.setAttribute('role', 'img');
      thumb.setAttribute('aria-label', 'No product image');
      if (product.image_path) {
        const img = document.createElement('img');
        img.className = 'ds-product-thumb';
        img.alt = product.name;
        img.loading = 'lazy';
        img.onload = () => { camera.hidden = true; };
        img.onerror = () => { img.remove(); camera.hidden = false; };
        img.src = db.storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl;
        thumb.append(img);
      }
      card.append(thumb);

      const info = element('div', undefined, 'ds-product-info');
      info.append(identity);
      if (description) info.append(description);

      const meta = element('div', undefined, 'ds-product-meta');
      meta.append(detail, oatStatus, status);

      card.append(info, meta, actions);

      list.append(card);
      }

      section.append(heading, list);
      root.append(section);
    }
  }

  const categoryHost = document.getElementById('categoryManagement');
  function renderCategories() {
    if (!categoryHost) return;
    categoryHost.replaceChildren();
    const panel = element('details', undefined, 'ds-category-manager-panel');
    panel.open = categoryManagerOpen;
    panel.addEventListener('toggle', () => { categoryManagerOpen = panel.open; });
    const summary = element('summary', undefined, 'ds-category-manager-summary');
    const summaryTitle = element('strong', 'Product Categories');
    const badge = element('span', categories.length + (categories.length === 1 ? ' category' : ' categories'), 'ds-category-count');
    const summaryHint = element('span', 'Manage categories', 'ds-category-manage-label');
    summary.append(summaryTitle, badge, summaryHint);
    const body = element('div', undefined, 'ds-category-manager-body');
    const hint = element('p', 'Drag categories to reorder. Rename or delete unused categories.');
    const chips = element('div', undefined, 'ds-category-chips');
    for (const entry of categories) {
      const count = products.filter(p => p.category === entry.name).length;
      chips.append(element('span', entry.name + ' (' + count + ')', 'ds-category-chip'));
    }
    const list = element('div', undefined, 'ds-category-list');
    const notice = element('p', '', 'ds-product-feedback');
    notice.setAttribute('role', 'status');
    let dragging = null;
    for (const entry of categories) {
      const count = products.filter(p => p.category === entry.name).length;
      const line = element('div', undefined, 'ds-category-line');
      line.draggable = true;
      line.dataset.id = String(entry.id);
      const handle = element('span', '☰', 'ds-category-handle');
      handle.title = 'Drag to reorder';
      const name = element('strong', entry.name + ' (' + count + ')');
      const rename = element('button', 'Rename', 'ghost');
      rename.type = 'button';
      rename.onclick = async () => {
        const next = prompt('New category name:', entry.name)?.trim();
        if (!next || next === entry.name) return;
        if (next.length > 50 || categories.some(c => c.id !== entry.id && c.name.toLowerCase() === next.toLowerCase())) {
          notice.textContent = 'Enter a unique category name (1–50 characters).'; return;
        }
        await categoryMutation(() => db.from('categories').update({name:next}).eq('id',entry.id).select('id'), notice, () => {
          const previousName = entry.name;
          entry.name = next;
          products.forEach(product => { if (product.category === previousName) product.category = next; });
        });
      };
      const remove = element('button', 'Delete', 'ghost');
      remove.type = 'button';
      remove.disabled = count > 0;
      remove.title = count ? 'Move or delete products first' : 'Delete empty category';
      remove.onclick = async () => {
        if (!confirm('Delete empty category "' + entry.name + '"?')) return;
        await categoryMutation(() => db.from('categories').delete().eq('id',entry.id).select('id'),notice);
      };
      line.append(handle,name,rename,remove);
      line.addEventListener('dragstart', e => { dragging = entry.id; e.dataTransfer.effectAllowed = 'move'; });
      line.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      line.addEventListener('drop', async e => {
        e.preventDefault();
        if (dragging === null || dragging === entry.id) return;
        const ordered = categories.map(c => c.id);
        ordered.splice(ordered.indexOf(dragging),1);
        ordered.splice(ordered.indexOf(entry.id),0,dragging);
        dragging = null;
        await categoryMutation(async () => {
          for (let i=0;i<ordered.length;i++) {
            const {error} = await db.from('categories').update({sort_order:i+1}).eq('id',ordered[i]);
            if (error) return {error};
          }
          return {data:[{id:1}]};
        },notice);
      });
      line.addEventListener('dragend',()=>{dragging=null;});
      list.append(line);
    }
    const add = element('button', '+ Add Category');
    add.type = 'button';
    add.onclick = async () => {
      const name = prompt('New category name:')?.trim();
      if (!name) return;
      if (name.length > 50 || categories.some(c=>c.name.toLowerCase()===name.toLowerCase())) {
        notice.textContent = 'Enter a unique category name (1–50 characters).';return;
      }
      await categoryMutation(()=>db.from('categories').insert({name,sort_order:Math.max(0,...categories.map(c=>c.sort_order))+1}).select('id'),notice);
    };
    body.append(hint, list, add, notice);
    panel.append(summary, chips, body);
    categoryHost.append(panel);
  }

  async function categoryMutation(operation, notice, onSuccess) {
    if (saving) return;
    saving = true;
    notice.textContent = 'Saving category…';
    try {
      await checkAdmin();
      const result = await operation();
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error('Category change was not saved.');

      // Show the confirmed rename immediately; no manual page refresh needed.
      if (onSuccess) {
        onSuccess();
        renderCategories();
        renderProducts();
      }

      await loadProducts();
    } catch (error) {
      // The original notice may have been detached by a successful render.
      const currentNotice = categoryHost?.querySelector('.ds-product-feedback') || notice;
      currentNotice.textContent = 'Category refresh failed: ' + error.message;
    } finally { saving = false; }
  }

  function closeForm() {
    formContainer.replaceChildren();
    formContainer.hidden = true;
  }

  function showForm(product = null) {
    if (saving) return;

    formContainer.replaceChildren();
    formContainer.hidden = false;

    const editing = !!product;
    const form = element('form', undefined, 'ds-product-form');

    const heading = element(
      'h3',
      editing ? 'Edit Product' : 'Add New Product'
    );

    function field(labelText, type, value = '') {
      const label = element('label', labelText);
      const input = document.createElement('input');

      input.type = type;
      input.value = value;
      input.required = true;

      label.append(input);
      return { label, input };
    }

    const name = field(
      'Product name',
      'text',
      product?.name || ''
    );

    name.input.maxLength = 80;

    const price = field(
      'Price (₱)',
      'number',
      product?.price ?? ''
    );

    price.input.min = '0.01';
    price.input.max = '99999.99';
    price.input.step = '0.01';

    const categoryLabel = element('label', 'Category');
    const category = document.createElement('select');

    for (const value of categories.map(c => c.name)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category.append(option);
    }

    category.value = product?.category || 'Coffee';
    categoryLabel.append(category);

    const descriptionLabel = element('label', 'Description (optional, max 150 characters)');
    const descriptionInput = document.createElement('textarea');
    descriptionInput.maxLength = 150;
    descriptionInput.rows = 3;
    descriptionInput.value = product?.description || '';
    descriptionLabel.append(descriptionInput);

    const imageLabel = element('label', 'Product image (recommended: 800 × 800 px, square; JPG, PNG, WebP; max 2 MB)');
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/jpeg,image/png,image/webp';
    const imagePreview = document.createElement('img');
    imagePreview.className = 'ds-product-preview';
    imagePreview.alt = 'Product image preview';
    imagePreview.hidden = !product?.image_path;
    if (product?.image_path) imagePreview.src = db.storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl;
    let previewUrl = null;
    imageInput.onchange = () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const file = imageInput.files?.[0];
      if (!file) return;
      previewUrl = URL.createObjectURL(file);
      imagePreview.src = previewUrl;
      imagePreview.hidden = false;
    };
    imageLabel.append(imageInput, imagePreview);

    const oatLabel = element(
      'label',
      undefined,
      'ds-product-oat-label'
    );

    const oatCheckbox = document.createElement('input');
    oatCheckbox.type = 'checkbox';
    oatCheckbox.checked = product?.oat_eligible === true;

    oatLabel.append(
      oatCheckbox,
      document.createTextNode(' Oat Milk Eligible (+₱30)')
    );

    const actions = element(
      'div',
      undefined,
      'ds-product-form-actions'
    );

    const save = element(
      'button',
      editing ? 'Save Changes' : 'Save Product'
    );

    save.type = 'submit';

    const cancel = element('button', 'Cancel', 'ghost');
    cancel.type = 'button';
    cancel.onclick = closeForm;

    const feedback = element(
      'p',
      '',
      'ds-product-feedback'
    );

    feedback.setAttribute('role', 'status');

    actions.append(save, cancel);

    form.append(
      heading,
      name.label,
      price.label,
      categoryLabel,
      descriptionLabel,
      imageLabel,
      oatLabel,
      actions,
      feedback
    );

    formContainer.append(form);
    name.input.focus();

    form.onsubmit = async event => {
      event.preventDefault();

      if (saving) return;

      const newName = name.input.value.trim().replace(/\s+/g, ' ');
      const rawPrice = price.input.value.trim();
      const newPrice = Number(rawPrice);
      const newCategory = category.value;
      const selectedCategory = categories.find(c => c.name === newCategory);
      const newDescription = descriptionInput.value.trim();
      const imageFile = imageInput.files?.[0] || null;
      if (imageFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 2 * 1024 * 1024 || imageFile.size === 0)) {
        feedback.textContent = 'Choose a JPG, PNG or WebP image under 2 MB.';
        return;
      }

      if (
        newDescription.length > 150 ||
        !newName ||
        newName.length > 80 ||
        !/^\d+(\.\d{1,2})?$/.test(rawPrice) ||
        !Number.isFinite(newPrice) ||
        newPrice <= 0 ||
        newPrice > 99999.99 ||
        !selectedCategory
      ) {
        feedback.textContent = 'Enter valid product details.';
        return;
      }

      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      feedback.textContent = 'Saving…';

      try {
        await checkAdmin();

        const duplicate = products.some(p =>
          p.id !== product?.id &&
          p.name.trim().toLowerCase() === newName.toLowerCase()
        );

        if (duplicate) {
          throw new Error('Product name already exists.');
        }

        const values = {
          name: newName,
          price: newPrice,
          category: newCategory,
          category_id: selectedCategory.id,
          oat_eligible: oatCheckbox.checked,
          description: newDescription || null,
          updated_at: new Date().toISOString()
        };

        let result;

        if (editing) {
          result = await db
            .from('products')
            .update(values)
            .eq('id', product.id)
            .select('id,product_code');
        } else {
          result = await db
            .from('products')
            .insert({
              ...values,
              is_active: true
            })
            .select('id,product_code');
        }

        if (result.error) throw result.error;

        if (!result.data?.length) {
          throw new Error(
            'No product was saved. Check permissions.'
          );
        }

        if (imageFile) {
          const savedId = result.data[0].id;
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[imageFile.type];
          const path = `${savedId}/${crypto.randomUUID()}.${ext}`;
          feedback.textContent = 'Uploading image…';
          const upload = await db.storage.from('product-images').upload(path, imageFile, { contentType: imageFile.type, upsert: false });
          if (upload.error) throw new Error('Product saved, but image upload failed: ' + upload.error.message);
          const updated = await db.from('products').update({ image_path: path, updated_at: new Date().toISOString() }).eq('id', savedId).select('id');
          if (updated.error || !updated.data?.length) {
            await db.storage.from('product-images').remove([path]);
            throw new Error('Product saved, but image link could not be saved: ' + (updated.error?.message || 'Permission denied'));
          }
        }

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        closeForm();
        await loadProducts();

      } catch (error) {
        feedback.textContent =
          'Save failed: ' + error.message;

      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
  }

  async function changeAvailability(product, button) {
    if (saving) return;

    const next = !product.is_active;

    const action = next
      ? 'Mark Available'
      : 'Mark Unavailable';

    if (!confirm(`${action}: "${product.name}"?`)) return;

    saving = true;
    button.disabled = true;

    try {
      await checkAdmin();

      const { data, error } = await db
        .from('products')
        .update({
          is_active: next,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .eq('is_active', product.is_active)
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          'Product was not updated. Refresh and retry.'
        );
      }

      await loadProducts();

    } catch (error) {
      alert('Update failed: ' + error.message);

    } finally {
      saving = false;
      button.disabled = false;
    }
  }

  async function deleteUnusedProduct(product, button) {
    if (saving) return;

    if (!confirm(`Permanently delete "${product.name}"?\n\nThis cannot be undone. Products with order history cannot be deleted.`)) return;

    saving = true;
    button.disabled = true;

    try {
      await checkAdmin();

      const { data, error } = await db
        .from('products')
        .delete()
        .eq('id', product.id)
        .select('id');

      if (error) {
        if (error.code === '23503') {
          throw new Error('Cannot delete: this product has order history.');
        }
        throw error;
      }
      if (!data?.length) {
        throw new Error('Product was not deleted. Check admin permissions.');
      }

      closeForm();
      await loadProducts();
    } catch (error) {
      alert('Delete failed: ' + error.message);
    } finally {
      saving = false;
      button.disabled = false;
    }
  }

  addButton.onclick = () => {
    if (formContainer.hidden) {
      showForm();
    } else {
      closeForm();
    }
  };

  const style = document.createElement('style');

  style.textContent = `
    #categoryManagement { margin: 0 0 22px; }
    .ds-category-manager-panel { border:1px solid #ddcfc1; border-radius:12px; background:#f9f3ea; overflow:hidden; }
    .ds-category-manager-summary { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:15px 17px; cursor:pointer; list-style:none; }
    .ds-category-manager-summary::-webkit-details-marker { display:none; }
    .ds-category-manager-summary:focus-visible { outline:3px solid #a8794b; outline-offset:-3px; }
    .ds-category-manager-summary::before { content:'▸'; font-size:17px; color:#705f51; }
    .ds-category-manager-panel[open] .ds-category-manager-summary::before { content:'▾'; }
    .ds-category-manager-summary strong { font-size:15px; }
    .ds-category-count { font-size:12px; color:#705f51; background:#eee4d8; border-radius:20px; padding:4px 9px; }
    .ds-category-manage-label { margin-left:auto; font-size:12px; color:#705f51; }
    .ds-category-chips { display:flex; flex-wrap:wrap; gap:7px; padding:0 17px 15px; }
    .ds-category-manager-panel[open] .ds-category-chips { display:none; }
    .ds-category-chip { padding:6px 10px; border-radius:7px; background:#eee4d8; font-size:12px; font-weight:600; }
    .ds-category-manager-body { padding:0 17px 17px; border-top:1px solid #e4d7c9; }
    .ds-category-manager-body > p:first-child { font-size:13px; color:#705f51; }
    .ds-category-list { display:grid; gap:8px; margin:12px 0; }
    .ds-category-line { display:flex; gap:12px; align-items:center; background:#f9f3ea; padding:10px; border:1px solid #ddcfc1; border-radius:9px; }
    .ds-category-line strong { flex:1; }
    .ds-category-handle { cursor:grab; font-size:20px; }

    #addProductButton {
      margin: 8px 0 18px;
    }

    .ds-products-grid {
      display: grid;
      gap: 9px;
    }

    .ds-product-card {
      background: #f9f3ea;
      border: 1px solid #ddcfc1;
      border-radius: 12px;
      padding: 13px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ds-product-category-section { margin: 18px 0 26px; }
    .ds-product-category-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; padding: 11px 14px; border-radius: 10px; background: #321e12; color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; list-style: none; }
    .ds-product-category-heading::-webkit-details-marker { display: none; }
    .ds-product-category-heading::after { content: '⌄'; font-size: 23px; line-height: 1; transition: transform .15s ease; }
    .ds-product-category-section[open] > .ds-product-category-heading::after { transform: rotate(180deg); }
    .ds-product-category-heading:focus-visible { outline: 3px solid #a8794b; outline-offset: 2px; }
    .ds-product-identity { display: flex; flex: none; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
    .ds-product-identity strong { flex: none; }
    .ds-product-identity .ds-product-code { align-self: flex-start; }

    .ds-product-thumb-slot { width: 64px; height: 64px; display: grid; place-items: center; background: #f0e7dd; color: #a38c78; border-radius: 9px; overflow: hidden; }
    .ds-product-thumb-slot > * { grid-area: 1 / 1; }
    .ds-product-thumb-slot svg[hidden] { display: none; }
    .ds-product-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 9px; }
    .ds-product-description { color: #705f51; font-size: 12px; flex: 1 1 100%; }
    .ds-product-preview { width: 120px; height: 120px; object-fit: cover; border-radius: 9px; margin-top: 8px; }
    .ds-product-preview[hidden] { display: none; }
    .ds-product-form textarea { width: 100%; height: 88px; min-height: 88px; max-height: 88px; box-sizing: border-box; resize: none; }

    .ds-product-card { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(130px, 0.45fr) auto; align-items: center; gap: 12px; }
    .ds-product-thumb-slot { grid-column: 1; grid-row: 1; }
    .ds-product-info { grid-column: 2; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
    .ds-product-meta { grid-column: 3; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }
    .ds-product-actions { grid-column: 4; }
    .ds-product-identity { flex: none; }
    .ds-product-card strong { flex: none; }
    .ds-product-description { flex: none; overflow-wrap: anywhere; line-height: 1.45; }
    @media (max-width: 800px) {
      .ds-product-card { grid-template-columns: 56px minmax(0, 1fr); gap: 10px; }
      .ds-product-thumb-slot, .ds-product-thumb { width: 56px; height: 56px; }
      .ds-product-thumb-slot { grid-column: 1; grid-row: 1; }
      .ds-product-info { grid-column: 2; grid-row: 1; }
      .ds-product-meta { grid-column: 1 / -1; grid-row: 2; flex-direction: row; flex-wrap: wrap; align-items: center; }
      .ds-product-actions { grid-column: 1 / -1; grid-row: 3; flex-wrap: wrap; }
    }

    .ds-product-code {
      color: #806b55;
      font-size: 12px;
      font-weight: 700;
      background: #eee4d8;
      border-radius: 6px;
      padding: 4px 8px;
      letter-spacing: 0.4px;
    }

    .ds-product-detail {
      color: #705f51;
      font-size: 13px;
    }

    .ds-product-status {
      background: #d9ebd9;
      color: #1e582c;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .ds-product-status.inactive {
      background: #e9dbcd;
      color: #705f51;
    }

    .ds-product-oat {
      color: #705f51;
      font-size: 12px;
    }

    .ds-product-oat-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .ds-product-oat-label input {
      width: 17px;
      height: 17px;
      accent-color: #65452c;
    }

    .ds-product-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .ds-product-actions button {
      padding: 7px 11px;
      font-size: 12px;
    }

    .ds-product-delete {
      color: #9c332a;
      border-color: #c69c93;
    }

    .ds-product-form {
      background: #f9f3ea;
      border: 1px solid #ddcfc1;
      border-radius: 14px;
      padding: 18px;
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
    }

    .ds-product-form h3 {
      margin: 0;
    }

    .ds-product-form-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ds-product-feedback {
      margin: 0;
      font-size: 13px;
    }

    #productFormContainer[hidden] {
      display: none;
    }
  `;

  document.head.append(style);
  loadProducts();
})();
