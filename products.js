
/*
 * Dark Secrets Coffee
 * Dynamic Product Loader
 * GitHub review branch — not deployed to LIVE
 */

(() => {
  "use strict";

  const menuProducts = document.getElementById("menuProducts");
  const menuLoading = document.getElementById("menuLoading");
  const menuError = document.getElementById("menuError");

  const supabaseUrl = window.DS_SUPABASE_URL;
  const supabaseKey = window.DS_SUPABASE_KEY;

  if (!menuProducts || !menuLoading || !menuError) {
    console.error("Dynamic menu containers not found.");
    return;
  }

  function showError() {
    menuLoading.hidden = true;
    menuProducts.hidden = true;
    menuError.hidden = false;
  }

  function createProductElement(product) {
    const item = document.createElement("div");
    item.className = "menu-item";

    item.dataset.productId = product.id;
    item.dataset.name = product.name;
    item.dataset.price = String(product.price);
    item.dataset.drink = "true";
    item.dataset.oatEligible = String(product.oat_eligible);

    const name = document.createElement("span");
    name.textContent = product.name;

    const price = document.createElement("b");
    price.textContent =
      `₱${Number(product.price).toLocaleString("en-PH")}`;

    const button = document.createElement("button");
    button.className = "add-btn";
    button.type = "button";
    button.textContent = "+ ADD";

    if (product.image_path) {
      const image = document.createElement('img');
      image.className = 'ds-menu-product-image';
      image.alt = product.name;
      image.loading = 'lazy';
      image.src = `${supabaseUrl}/storage/v1/object/public/product-images/${product.image_path.split('/').map(encodeURIComponent).join('/')}`;
      item.append(image);
    }
    const info = document.createElement('div');
    info.className = 'ds-menu-product-info';
    info.append(name);
    info.append(price);
    if (product.description && product.description.trim()) {
      const details = document.createElement('details');
      details.className = 'ds-menu-product-details';
      const summary = document.createElement('summary');
      summary.textContent = 'Description';
      summary.setAttribute('aria-label', 'Toggle description for ' + product.name);
      const desc = document.createElement('p');
      desc.className = 'ds-menu-product-description';
      desc.textContent = product.description;
      details.append(summary, desc);
      info.append(details);
    }
    item.append(info, button);

    return item;
  }

  function renderProducts(products) {
    menuProducts.replaceChildren();

    const categories = ["Coffee", "Non-Coffee"];

    for (const category of categories) {
      const categoryProducts = products.filter(
        (product) => product.category === category
      );

      if (!categoryProducts.length) continue;

      const group = document.createElement("div");
      group.className = "group";

      const heading = document.createElement("h2");
      heading.textContent =
        category === "Coffee"
          ? "☕ Coffee"
          : "◒ Non-Coffee";

      group.appendChild(heading);

      for (const product of categoryProducts) {
        group.appendChild(createProductElement(product));
      }

      if (category === "Coffee") {
        const note = document.createElement("small");
        note.textContent =
          "All of our coffee drinks are standard double-shot.";
        group.appendChild(note);
      }

      menuProducts.appendChild(group);
    }

    if (!menuProducts.children.length) {
      showError();
      return;
    }

    menuLoading.hidden = true;
    menuError.hidden = true;
    menuProducts.hidden = false;

    window.DS_PRODUCTS = products;

    window.dispatchEvent(
      new CustomEvent("ds:products-loaded", {
        detail: { products }
      })
    );
  }

  async function loadProducts() {
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase configuration missing.");
      showError();
      return;
    }

    try {
      const url = new URL(
        `${supabaseUrl}/rest/v1/products`
      );

      url.searchParams.set(
        "select",
        "id,product_code,name,price,category,is_active,oat_eligible,description,image_path"
      );

      url.searchParams.set("is_active", "eq.true");
      url.searchParams.set("order", "product_code.asc");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Product request failed: ${response.status}`
        );
      }

      const products = await response.json();

      if (!Array.isArray(products)) {
        throw new Error("Invalid products response.");
      }

      renderProducts(products);
    } catch (error) {
      console.error("Product loading error:", error);
      showError();
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .menu-item:has(.ds-menu-product-info) { display: grid !important; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px; }
    .menu-item:has(.ds-menu-product-image) { grid-template-columns: 100px minmax(0,1fr) auto; }
    .ds-menu-product-image { width: 100px; height: 100px; flex: 0 0 100px; object-fit: cover; border-radius: 10px; }
    .ds-menu-product-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; text-align: left; }
    .ds-menu-product-info > span { text-align: left; font-style: normal; }
    .ds-menu-product-info > b { text-align: left; }
    .ds-menu-product-details { font-size: 12px; text-align: left; min-width: 0; }
    .ds-menu-product-details > summary { display: inline-flex; align-items: center; gap: 5px; color: #79563c; font: 600 12px/1.4 Arial, sans-serif; cursor: pointer; list-style: none; }
    .ds-menu-product-details > summary::-webkit-details-marker { display: none; }
    .ds-menu-product-details > summary::after { content: '⌄'; font-size: 16px; line-height: 12px; transition: transform .15s ease; }
    .ds-menu-product-details[open] > summary::after { transform: rotate(180deg); }
    .ds-menu-product-description { display: block; margin: 7px 0 0; color: #786c62; font: normal 12px/1.45 Arial, sans-serif; text-align: left; }
    @media (min-width: 768px) { .ds-menu-product-image { width: 120px; height: 120px; } .menu-item:has(.ds-menu-product-image) { grid-template-columns: 120px minmax(0,1fr) auto; } }
  `;
  document.head.append(style);
  loadProducts();
})();
