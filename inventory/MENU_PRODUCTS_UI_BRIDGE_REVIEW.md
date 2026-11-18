# Draft UI wiring — authorized menu loading

This bridge works with `menu-products-readonly-adapter-v1-DRAFT.js`. Both are **inert** until a future inventory UI explicitly calls `DSInventoryMenuBridge.attach` and the user clicks its load button.

Example wiring, after explicit authorization and review:

```js
DSInventoryMenuBridge.attach({
  button: document.getElementById('loadAuthorizedMenu'),
  clientProvider: () => window.DS_INVENTORY_APPROVED_CLIENT,
  onProducts: rows => {
    // Join each row.id (immutable UUID) with recipe records; never duplicate products.
    // Re-render No Recipe → Draft → Completed with 5 rows per page.
  },
  onError: message => showError(message),
  onStatus: message => showStatus(message)
});
```

The host is responsible for authenticating the existing admin user and checking RLS SELECT permission before injecting a client. This code **does not** use LIVE configuration, make requests on import, write data, or change menu prices. The current compact UI still displays sample products until actual integration is explicitly approved.

Next: connect the bridge to a reviewed UI entry point and test with a mocked client first. Production database access remains off.
