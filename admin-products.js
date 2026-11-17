
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
  let saving = false;
  const categoryOpenState = new Map();

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

    const toolbar = element('div', undefined, 'ds-category-toolbar');
    for (const [label, shouldOpen] of [['Expand All', true], ['Collapse All', false]]) {
      const button = element('button', label, 'ghost');
      button.type = 'button';
      button.onclick = () => {
        root.querySelectorAll('.ds-product-category-section').forEach(section => {
          categoryOpenState.set(section.dataset.category, shouldOpen);
          section.open = shouldOpen;
        });
      };
      toolbar.append(button);
    }
    root.append(toolbar);

    const categories = ['Coffee', 'Non-Coffee', ...new Set(products.map(p => p.category).filter(c => c && c !== 'Coffee' && c !== 'Non-Coffee'))];

    for (const category of categories) {
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

      if (product.image_path) {
        const img = document.createElement('img');
        img.className = 'ds-product-thumb';
        img.alt = product.name;
        img.loading = 'lazy';
        img.src = db.storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl;
        card.append(img);
      }

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

    for (const value of ['Coffee', 'Non-Coffee']) {
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
        !['Coffee', 'Non-Coffee'].includes(newCategory)
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

    .ds-category-toolbar { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .ds-category-toolbar button { padding: 7px 12px; }
    .ds-product-category-section { margin: 18px 0 26px; }
    .ds-product-category-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; padding: 11px 14px; border-radius: 10px; background: #321e12; color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; list-style: none; }
    .ds-product-category-heading::-webkit-details-marker { display: none; }
    .ds-product-category-heading::after { content: '⌄'; font-size: 23px; line-height: 1; transition: transform .15s ease; }
    .ds-product-category-section[open] > .ds-product-category-heading::after { transform: rotate(180deg); }
    .ds-product-category-heading:focus-visible { outline: 3px solid #a8794b; outline-offset: 2px; }
    .ds-product-identity { display: flex; flex: none; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
    .ds-product-identity strong { flex: none; }
    .ds-product-identity .ds-product-code { align-self: flex-start; }

    .ds-product-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 9px; }
    .ds-product-description { color: #705f51; font-size: 12px; flex: 1 1 100%; }
    .ds-product-preview { width: 120px; height: 120px; object-fit: cover; border-radius: 9px; margin-top: 8px; }
    .ds-product-preview[hidden] { display: none; }
    .ds-product-form textarea { width: 100%; height: 88px; min-height: 88px; max-height: 88px; box-sizing: border-box; resize: none; }

    .ds-product-card { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(130px, 0.45fr) auto; align-items: center; gap: 12px; }
    .ds-product-thumb { grid-column: 1; grid-row: 1; }
    .ds-product-info { grid-column: 2; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
    .ds-product-meta { grid-column: 3; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }
    .ds-product-actions { grid-column: 4; }
    .ds-product-identity { flex: none; }
    .ds-product-card strong { flex: none; }
    .ds-product-description { flex: none; overflow-wrap: anywhere; line-height: 1.45; }
    @media (max-width: 800px) {
      .ds-product-card { grid-template-columns: 56px minmax(0, 1fr); gap: 10px; }
      .ds-product-thumb { width: 56px; height: 56px; grid-column: 1; grid-row: 1; }
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
