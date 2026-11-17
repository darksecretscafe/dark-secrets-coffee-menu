
/*
 * Dark Secrets Coffee
 * Dynamic Product Loader
 * Integration Preview only
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

    item.append(name, price, button);

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
        "id,product_code,name,price,category,is_active,oat_eligible"
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

  loadProducts();
})();
