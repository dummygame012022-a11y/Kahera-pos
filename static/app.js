const defaultStore = {
  name: "Tindahan Kahera",
  address: "Your store address",
  contact: "Your contact number",
  startingCash: 1000.00,
  footerMsg: "Thank you, come again!",
  enableTax: false,
  enableService: false
};

const defaultCategories = [
  { id: 1, name: "Load", color: "#3b82f6" },
  { id: 2, name: "Inumin", color: "#06b6d4" },
  { id: 3, name: "Snacks", color: "#8b5cf6" },
  { id: 4, name: "Grocery", color: "#22c55e" }
];

let categories = JSON.parse(localStorage.getItem('totskie_categories')) || defaultCategories;
let storeInfo = JSON.parse(localStorage.getItem('totskie_store')) || defaultStore;
if (storeInfo.startingCash === undefined) storeInfo.startingCash = 1000.00;

const defaultProducts = [
  { id: 1001, name: "Load 50 (sample)", price: 50, cost: 48, stock: 100, category: "Load" },
  { id: 1002, name: "Load 100 (sample)", price: 100, cost: 96, stock: 100, category: "Load" },
  { id: 1003, name: "Softdrinks", price: 20, cost: 15, stock: 24, category: "Inumin" },
  { id: 1004, name: "Kape (sachet)", price: 8, cost: 6, stock: 50, category: "Snacks" },
  { id: 1005, name: "Noodles", price: 15, cost: 11, stock: 30, category: "Grocery" }
];

let products = JSON.parse(localStorage.getItem('totskie_products')) || defaultProducts;
let salesHistory = JSON.parse(localStorage.getItem('totskie_sales')) || [];
let kitchenOrders = JSON.parse(localStorage.getItem('totskie_kds')) || [];
let utangPayments = JSON.parse(localStorage.getItem('totskie_utang')) || [];
function saveUtangStorage() { localStorage.setItem('totskie_utang', JSON.stringify(utangPayments)); syncToServer('totskie_utang', utangPayments); }

let cart = [];
let currentCustomer = "Customer";
let currentCategory = 'All';
let rawPriceInput = '0';
let discountPercent = 0;
let cartNote = "";
let selectedPaymentMethod = "Cash";
let lastReceiptText = "";
let confirmCallback = null;

function saveCategoriesToStorage() { (localStorage.setItem('totskie_categories', JSON.stringify(categories)), syncToServer('totskie_categories', categories)); }
function saveProductsToStorage() { (localStorage.setItem('totskie_products', JSON.stringify(products)), syncToServer('totskie_products', products)); }
function saveSalesToStorage() { (localStorage.setItem('totskie_sales', JSON.stringify(salesHistory)), syncToServer('totskie_sales', salesHistory)); }
function saveStoreStorage() { (localStorage.setItem('totskie_store', JSON.stringify(storeInfo)), syncToServer('totskie_store', storeInfo)); }
function saveKdsStorage() { (localStorage.setItem('totskie_kds', JSON.stringify(kitchenOrders)), syncToServer('totskie_kds', kitchenOrders)); }

function applyStoreInfo() {
  document.getElementById('headerStoreName').innerText = storeInfo.name;
  document.getElementById('pageTitle').innerText = storeInfo.name;
}
applyStoreInfo();

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = `<button class="category-tab ${currentCategory === 'All' ? 'active' : ''}" onclick="filterCategory('All')">All Items</button>`;
  categories.forEach(cat => {
    const activeClass = currentCategory === cat.name ? 'active' : '';
    container.innerHTML += `<button class="category-tab ${activeClass}" onclick="filterCategory('${cat.name}')">${cat.name}</button>`;
  });
}
renderCategoryTabs();

function showCustomAlert(msg) {
  document.getElementById('customAlertMessage').innerText = msg;
  document.getElementById('customAlertModal').style.display = 'flex';
}
function closeCustomAlert() { document.getElementById('customAlertModal').style.display = 'none'; }

function showCustomConfirm(msg, onConfirm) {
  document.getElementById('customConfirmMessage').innerText = msg;
  confirmCallback = onConfirm;
  document.getElementById('confirmYesBtn').onclick = () => { closeCustomConfirm(true); };
  document.getElementById('customConfirmModal').style.display = 'flex';
}
function closeCustomConfirm(result) {
  document.getElementById('customConfirmModal').style.display = 'none';
  if (result && confirmCallback) confirmCallback();
  confirmCallback = null;
}

function openCustomerModal() {
  document.getElementById('inputCustomerName').value = currentCustomer === "Customer" ? "" : currentCustomer;
  document.getElementById('customerModal').style.display = 'flex';
}
function closeCustomerModal() { document.getElementById('customerModal').style.display = 'none'; }
function saveCustomerName() {
  const name = document.getElementById('inputCustomerName').value.trim();
  if (name) {
    currentCustomer = name;
    document.getElementById('customerNameDisplay').innerText = `👤 ${currentCustomer}`;
  }
  closeCustomerModal();
}

function openNoteModal() {
  document.getElementById('inputOrderNote').value = cartNote;
  document.getElementById('noteModal').style.display = 'flex';
}
function closeNoteModal() { document.getElementById('noteModal').style.display = 'none'; }
function saveOrderNote() {
  cartNote = document.getElementById('inputOrderNote').value.trim();
  closeNoteModal();
  showCustomAlert("Order note saved successfully!");
}

function renderProducts(items) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; font-size: 10px; margin-top: 20px;">No menu items found</div>';
    return;
  }
  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.cursor = 'pointer';
    
    const catObj = categories.find(c => c.name === p.category);
    card.style.setProperty('--cat-color', catObj ? catObj.color : '#3b82f6');

    let stockClass = p.stock <= 5 ? 'product-stock low' : 'product-stock';
    let stockText = p.stock <= 5 ? `⚠️ Low: ${p.stock}` : `Stock: ${p.stock}`;

    card.innerHTML = `
      <div class="product-name" style="pointer-events: none;">${p.name}</div>
      <div class="product-footer" style="pointer-events: none;">
        <div class="product-price">₱${p.price.toFixed(2)}</div>
        <div class="${stockClass}">${stockText}</div>
      </div>
    `;
    
    // Bind click securely using dataset and direct event listener
    card.addEventListener('click', () => {
      console.log("Card clicked for product ID:", p.id);
      addToCart(p.id);
    });

    grid.appendChild(card);
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebarDrawer');
  sidebar.style.display = sidebar.style.display === 'flex' ? 'none' : 'flex';
}

function setOrderType(btn) {
  document.querySelectorAll('.order-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function filterCategory(category) {
  currentCategory = category;
  renderCategoryTabs();
  filterProducts();
}

function filterProducts() {
  const query = document.getElementById('searchBox').value.toLowerCase();
  const filtered = products.filter(p => {
    const matchesCategory = currentCategory === 'All' || p.category === currentCategory;
    const matchesSearch = p.name.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  renderProducts(filtered);
}


/* CATEGORY MANAGER LOGIC */
function toggleCategorySection() {
  const sec = document.getElementById('categoryManagerContainer');
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
  if (sec.style.display === 'block') { document.getElementById('productFormContainer').style.display = 'none'; renderCategoryList(); }
}

function renderCategoryList() {
  const container = document.getElementById('categoryListContainer');
  container.innerHTML = '';
  categories.forEach((cat, index) => {
    const div = document.createElement('div');
    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 4px 6px; border-radius: 4px; font-size: 10px;";
    div.innerHTML = `
      <span style="color: #fff; font-weight: bold;">${cat.name}</span>
      <div style="display: flex; gap: 8px;">
        <button style="background: #334155; color: #38bdf8; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="renameCategory(${index})">Edit</button>
        <button style="background: #7f1d1d; color: #fca5a5; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="deleteCategory(${index})">Del</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function addNewCategory() {
  const name = document.getElementById('newCategoryInput').value.trim();
  if (!name) { showCustomAlert("Please enter a category name."); return; }
  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { showCustomAlert("Category already exists!"); return; }
  
  const colors = ["#3b82f6", "#8b5cf6", "#ef4444", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  categories.push({ id: Date.now(), name, color: randomColor });
  saveCategoriesToStorage();
  document.getElementById('newCategoryInput').value = '';
  renderCategoryList();
  renderCategoryTabs();
  populateCategorySelect();
}

function renameCategoryApply(index, newName) {
  const oldName = categories[index].name;
  if (newName && newName.trim() !== "") {
    const trimmed = newName.trim();
    categories[index].name = trimmed;
    products.forEach(p => { if (p.category === oldName) p.category = trimmed; });
    if (currentCategory === oldName) currentCategory = trimmed;
    saveCategoriesToStorage();
    saveProductsToStorage();
    renderCategoryList();
    renderCategoryTabs();
    populateCategorySelect();
    filterProducts();
  }
}

function deleteCategory(index) {
  showCustomConfirm("Delete this category? Items under this will revert to 'All Items'.", () => {
    categories.splice(index, 1);
    saveCategoriesToStorage();
    renderCategoryList();
    renderCategoryTabs();
    populateCategorySelect();
    filterProducts();
  });
}

function populateCategorySelect() {
  const select = document.getElementById('inputItemCategory');
  select.innerHTML = '';
  categories.forEach(c => {
    select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });
}


function exportSalesCsv() {
  if (salesHistory.length === 0) { showCustomAlert("No sales history available to export!"); return; }
  let csvContent = "data:text/csv;charset=utf-8,TransactionID,Customer,ItemsCount,TotalAmount,PaymentMethod,Status,Time\n";
  salesHistory.forEach(s => {
    csvContent += `${s.id},"${s.customer}",${s.itemsCount},${s.total},${s.paymentMethod || 'Cash'},${s.isVoided ? 'VOIDED' : 'ACTIVE'},"${s.time}"\n`;
  });
  triggerFileDownload(csvContent, "totskie_sales_report.csv");
}

function exportInventoryCsv() {
  if (products.length === 0) { showCustomAlert("No inventory items available to export!"); return; }
  let csvContent = "data:text/csv;charset=utf-8,ID,ItemName,Category,Price,Stock\n";
  products.forEach(p => {
    csvContent += `${p.id},"${p.name}",${p.category},${p.price},${p.stock}\n`;
  });
  triggerFileDownload(csvContent, "totskie_inventory.csv");
}

function triggerFileDownload(content, filename) {
  const encodedUri = encodeURI(content);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

let kdsPollTimer = null;
let kdsPollBusy = false;
let kdsMutateStamp = 0;
function startKdsPolling() { stopKdsPolling(); kdsPollTimer = setInterval(pollKds, 4000); }
function stopKdsPolling() { if (kdsPollTimer) { clearInterval(kdsPollTimer); kdsPollTimer = null; } }
function pollKds() {
  if (kdsPollBusy) return;
  kdsPollBusy = true;
  const stamp = kdsMutateStamp;
  fetch('/api/kds')
    .then(r => { if (r.status === 401) { location.reload(); return null; } return r.ok ? r.json() : null; })
    .then(list => {
      if (!Array.isArray(list) || stamp !== kdsMutateStamp) return;
      if (JSON.stringify(list) !== JSON.stringify(kitchenOrders)) { applyKdsList(list); renderKdsOrders(); }
    })
    .catch(() => {})
    .finally(() => { kdsPollBusy = false; });
}
function openKdsModal() { renderKdsOrders(); document.getElementById('kdsModal').style.display = 'flex'; startKdsPolling(); }
function closeKdsModal() { stopKdsPolling(); document.getElementById('kdsModal').style.display = 'none'; }
function renderKdsOrders() {
  const container = document.getElementById('kdsContainer');
  container.innerHTML = '';
  if (kitchenOrders.length === 0) {
    container.innerHTML = '<div class="cart-empty" style="grid-column: 1/-1;">No active kitchen orders</div>';
    return;
  }
  kitchenOrders.forEach((order, index) => {
    const card = document.createElement('div');
    card.className = `kds-card ${order.status}`;
    let itemsHtml = '';
    order.items.forEach(i => { itemsHtml += `<div style="font-size: 10px; color: #f8fafc;">• ${i.name} <strong>x${i.qty}</strong></div>`; });
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 4px;">
        <span style="font-weight: bold; color: #38bdf8; font-size: 11px;">${order.customer}</span>
        <span style="font-size: 8px; color: #94a3b8;">${order.time}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px;">${itemsHtml}</div>
      ${order.note ? `<div style="font-size: 9px; color: #f59e0b; background: #1e293b; padding: 3px; border-radius: 3px;">Note: ${order.note}</div>` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
        <span style="font-size: 9px; font-weight: bold; color: ${order.status === 'pending' ? '#f59e0b' : '#22c55e'};">${order.status.toUpperCase()}</span>
        <button class="modal-btn" style="padding: 3px 6px; font-size: 8px; background: ${order.status === 'pending' ? '#22c55e' : '#334155'}; color: ${order.status === 'pending' ? '#0f172a' : '#fff'};" onclick="toggleKdsStatus(${order.id})">${order.status === 'pending' ? 'Mark Ready' : 'Clear Order'}</button>
      </div>
    `;
    const printBtn = document.createElement('button');
    printBtn.className = 'modal-btn';
    printBtn.style.cssText = 'min-height: 44px; width: 100%; margin-top: 6px; background: #334155; color: #fff; font-size: 11px;';
    printBtn.innerText = '\uD83D\uDDA8\uFE0F Print';
    printBtn.onclick = () => printKdsTicket(index);
    card.appendChild(printBtn);
    container.appendChild(card);
  });
}
function printKdsTicket(index) {
  const order = kitchenOrders[index];
  const box = document.getElementById('kdsTicket');
  if (!order || !box) { showCustomAlert('Ticket block not ready yet.'); return; }
  box.innerHTML = '';
  const add = (text, cls) => {
    const d = document.createElement('div');
    d.className = cls || 'kt-line';
    d.textContent = text;
    box.appendChild(d);
  };
  add('KITCHEN ORDER', 'kt-title');
  if (order.orderType) add(order.orderType, 'kt-type');
  add(order.customer, 'kt-line');
  add(order.time, 'kt-line');
  add('--------------------', 'kt-line');
  order.items.forEach(i => add(i.qty + 'x ' + i.name, 'kt-item'));
  if (order.note) {
    add('--------------------', 'kt-line');
    add('NOTE: ' + order.note, 'kt-note');
  }
  document.body.classList.add('printing-ticket');
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-ticket'), { once: true });
  window.print();
}
function applyKdsList(list) {
  if (!Array.isArray(list)) return;
  kitchenOrders = list;
  localStorage.setItem('totskie_kds', JSON.stringify(kitchenOrders));
}
function kdsCall(url, body) {
  kdsMutateStamp++;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }).then(r => {
    if (r.status === 401) { location.reload(); return null; }
    if (!r.ok) throw new Error('bad status');
    return r.json();
  }).then(d => { if (d && d.orders) applyKdsList(d.orders); return d; })
    .catch(() => { showCustomAlert('Could not reach server for kitchen orders.'); return null; });
}
function toggleKdsStatus(id) {
  const o = kitchenOrders.find(x => x.id === id);
  const path = (o && o.status === 'pending') ? '/ready' : '/remove';
  kdsCall('/api/kds/' + id + path).then(() => renderKdsOrders());
}

function openPaymentModal() {
  if (cart.length === 0) { showCustomAlert("Please add items to cart before checkout."); return; }
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discAmount = (subtotal * discountPercent) / 100;
  let taxableBase = subtotal - discAmount;
  let taxAmount = storeInfo.enableTax ? taxableBase * 0.12 : 0;
  let serviceAmount = storeInfo.enableService ? taxableBase * 0.05 : 0;
  let grandTotal = Math.round((taxableBase + taxAmount + serviceAmount) * 100) / 100;

  document.getElementById('payModalTotal').innerText = `₱${grandTotal.toFixed(2)}`;
  document.getElementById('cashTenderedInput').value = '';
  document.getElementById('changeDisplay').innerText = '₱0.00';

  
  
  
  const qrImg = document.getElementById('gcashQrImage');
  const qrBox = qrImg.parentElement;
  let qrNote = document.getElementById('gcashNoQrNote');
  if (!qrNote) {
    qrNote = document.createElement('div');
    qrNote.id = 'gcashNoQrNote';
    qrNote.style.cssText = 'font-size: 10px; color: #94a3b8; padding: 6px 0;';
    qrNote.innerText = 'No QR uploaded (owner: Settings)';
    qrBox.parentNode.insertBefore(qrNote, qrBox);
  }
  if (storeInfo.gcashQr) { qrImg.src = storeInfo.gcashQr; qrBox.style.display = 'flex'; qrNote.style.display = 'none'; }
  else { qrImg.removeAttribute('src'); qrBox.style.display = 'none'; qrNote.style.display = 'block'; }
  const gcashRefBox = document.getElementById('gcashRefInput'); if (gcashRefBox) gcashRefBox.value = '';
  document.getElementById('qrStoreLabel').innerText = storeInfo.name;
  document.getElementById('qrContactLabel').innerText = storeInfo.contact;
  switchPaymentMethod('Cash');
  document.getElementById('paymentModal').style.display = 'flex';
}
function closePaymentModal() { document.getElementById('paymentModal').style.display = 'none'; }
function calculateChange() {
  // Auto enable/disable Confirm button based on cash tendered vs grand total
  let confirmBtn = document.querySelector('button[onclick="confirmAndProcessPayment()"]');
  if (confirmBtn && document.getElementById('tabCash').classList.contains('active')) {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let discAmount = (subtotal * discountPercent) / 100;
    let taxableBase = subtotal - discAmount;
    let taxAmount = storeInfo.enableTax ? taxableBase * 0.12 : 0;
    let serviceAmount = storeInfo.enableService ? taxableBase * 0.05 : 0;
    let grandTotal = Math.round((taxableBase + taxAmount + serviceAmount) * 100) / 100;
    
    let tendered = parseFloat(document.getElementById('cashTenderedInput').value) || 0;
    if (tendered < grandTotal) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    }
  }
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discAmount = (subtotal * discountPercent) / 100;
  let taxableBase = subtotal - discAmount;
  let taxAmount = storeInfo.enableTax ? taxableBase * 0.12 : 0;
  let serviceAmount = storeInfo.enableService ? taxableBase * 0.05 : 0;
  let grandTotal = Math.round((taxableBase + taxAmount + serviceAmount) * 100) / 100;
  let tendered = parseFloat(document.getElementById('cashTenderedInput').value) || 0;
  let change = tendered - grandTotal;
  const changeDisplay = document.getElementById('changeDisplay');
  if (change >= 0) { changeDisplay.innerText = `₱${change.toFixed(2)}`; changeDisplay.style.color = '#22c55e'; }
  else { changeDisplay.innerText = `Insufficient cash by ₱${Math.abs(change).toFixed(2)}`; changeDisplay.style.color = '#ef4444'; }
}
function confirmAndProcessPayment() {
  const needed = {};
  cart.forEach(item => { if (!item.isCustom) needed[String(item.id)] = (needed[String(item.id)] || 0) + item.qty; });
  for (const pid in needed) {
    const prod = products.find(p => String(p.id) === pid);
    if (prod && needed[pid] > prod.stock) { showCustomAlert("Not enough stock for " + prod.name + ". Available: " + prod.stock); return; }
  }
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discAmount = (subtotal * discountPercent) / 100;
  let taxableBase = subtotal - discAmount;
  let taxAmount = storeInfo.enableTax ? taxableBase * 0.12 : 0;
  let serviceAmount = storeInfo.enableService ? taxableBase * 0.05 : 0;
  let grandTotal = Math.round((taxableBase + taxAmount + serviceAmount) * 100) / 100;
  if (selectedPaymentMethod === 'Utang') {
    const un = (document.getElementById('utangNameInput').value || '').trim();
    if (!un) { showCustomAlert("Enter the customer name for utang."); return; }
    window.currentTendered = 0; window.currentUtangName = un;
  } else if (selectedPaymentMethod === 'Cash') {
    let tendered = parseFloat(document.getElementById('cashTenderedInput').value) || 0;
    if (tendered < grandTotal) { showCustomAlert("Cash tendered is less than the total amount due!"); return; }
    window.currentTendered = tendered;
  } else {
    window.currentTendered = 0;
    const refEl = document.getElementById('gcashRefInput');
    const ref = refEl ? refEl.value.replace(/\s+/g, '') : '';
    if (!/^[0-9A-Za-z]{4,20}$/.test(ref)) { showCustomAlert("Enter the reference number (at least 4 letters or digits) before confirming."); return; }
    window.currentGcashRef = ref;
  }
  closePaymentModal();
  processPaymentFinal(grandTotal);
}

function openSettingsModal() {
  document.getElementById('settingStoreName').value = storeInfo.name;
  document.getElementById('settingStoreAddress').value = storeInfo.address;
  document.getElementById('settingStoreContact').value = storeInfo.contact;
  document.getElementById('settingFooterMessage').value = storeInfo.footerMsg || "Thank you, come again!";
  pendingGcashQr = undefined;
  const qrFileEl = document.getElementById('settingGcashQrFile'); if (qrFileEl) qrFileEl.value = '';
  updateQrPreview(storeInfo.gcashQr || '');
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
let pendingGcashQr;
function updateQrPreview(src) {
  const img = document.getElementById('settingGcashQrPreview');
  const btn = document.getElementById('settingGcashQrRemove');
  if (!img || !btn) return;
  if (src) { img.src = src; img.style.display = 'block'; btn.style.display = 'block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; btn.style.display = 'none'; }
}
function handleGcashQrFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showCustomAlert('Could not read that image.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => showCustomAlert('That file is not a usable image.');
    img.onload = () => {
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      pendingGcashQr = cv.toDataURL('image/png');
      updateQrPreview(pendingGcashQr);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function removeGcashQr() {
  pendingGcashQr = '';
  const f = document.getElementById('settingGcashQrFile'); if (f) f.value = '';
  updateQrPreview('');
}
function saveStoreSettings() {
  storeInfo.name = document.getElementById('settingStoreName').value.trim() || "TOTSKIE POS";
  storeInfo.address = document.getElementById('settingStoreAddress').value.trim() || "";
  storeInfo.contact = document.getElementById('settingStoreContact').value.trim() || "";
  storeInfo.footerMsg = document.getElementById('settingFooterMessage').value.trim() || "Thank you, come again!";
  storeInfo.enableTax = false;
  storeInfo.enableService = false;
  if (pendingGcashQr !== undefined) {
    if (pendingGcashQr) storeInfo.gcashQr = pendingGcashQr; else delete storeInfo.gcashQr;
    pendingGcashQr = undefined;
  }
  saveStoreStorage(); applyStoreInfo(); closeSettingsModal(); updateCart();
  showCustomAlert("Store settings saved successfully!");
}

function openSalesHistoryModal() { renderSalesHistoryTable(); document.getElementById('salesHistoryModal').style.display = 'flex'; }
function closeSalesHistoryModal() { document.getElementById('salesHistoryModal').style.display = 'none'; }
function renderSalesHistoryTable() {
  const tbody = document.getElementById('salesHistoryTableBody');
  tbody.innerHTML = '';
  let totalRevenue = 0; let totalProfit = 0;
  if (salesHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #64748b;">No transactions recorded today</td></tr>';
    document.getElementById('totalRevenueDisplay').innerText = `₱${(utangPayments.filter(e => e.type === 'payment' && new Date(e.time).toDateString() === new Date().toDateString()).reduce((a, e) => a + e.amount, 0)).toFixed(2)}`; document.getElementById('totalProfitDisplay').innerText = '₱' + utangProfitToday().toFixed(2);
    return;
  }
  salesHistory.forEach((sale, index) => {
    if (!sale.isVoided && sale.paymentMethod !== 'Utang') { totalRevenue += sale.total; if (sale.items.every(i => i.cost !== undefined)) totalProfit += sale.total - sale.items.reduce((c, i) => c + i.cost * i.qty, 0); }
    const tr = document.createElement('tr');
    let statusStyle = sale.isVoided ? 'text-decoration: line-through; color: #ef4444;' : 'color: #22c55e; font-weight: bold;';
    tr.innerHTML = `
      <td><div style="font-weight: bold; color: #38bdf8;">${_custTap(_custName(sale))} (${_pmLabel(sale)})</div><div style="font-size: 8px; color: #94a3b8;">${sale.time}${sale.gcashRef ? ' | Ref: ' + sale.gcashRef : ''}</div></td>
      <td style="${statusStyle}">₱${sale.total.toFixed(2)}${sale.isVoided ? ' (VOID)' : ''}</td>
      <td>${sale.isVoided ? '<span style="font-size: 8px; color: #ef4444;">Voided</span>' : `<button style="background: #7f1d1d; color: #fca5a5; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="promptVoidTransaction(${index})">Void</button>`}</td>
    `;
    tbody.appendChild(tr);
  });
  const _pays = utangPayments.filter(e => e.type === 'payment').slice().reverse();
  if (_pays.length) {
    const hr = document.createElement('tr');
    hr.innerHTML = '<td colspan="3" style="color:#38bdf8; font-weight:bold; font-size:11px; padding-top:12px;">Utang Payments</td>';
    tbody.appendChild(hr);
    _pays.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><div style="font-weight:bold; color:#38bdf8;">' + e.name + ' (Utang Payment)</div><div style="font-size:8px; color:#94a3b8;">' + fmtUtangDate(e.time) + '</div></td><td style="color:#22c55e; font-weight:bold;">₱' + e.amount.toFixed(2) + '</td><td><span style="font-size:8px; color:#22c55e;">Paid</span></td>';
      tbody.appendChild(tr);
    });
  }
  const _up = utangPayments.filter(e => e.type === 'payment' && new Date(e.time).toDateString() === new Date().toDateString()).reduce((a, e) => a + e.amount, 0); document.getElementById('totalRevenueDisplay').innerText = `₱${(totalRevenue + _up).toFixed(2)}`; document.getElementById('totalProfitDisplay').innerText = `₱${(totalProfit + utangProfitToday()).toFixed(2)}`;
}

function promptVoidTransaction(index) {
  showCustomConfirm("Are you sure you want to void this transaction? Stock will be restored and revenue adjusted.", () => {
    let sale = salesHistory[index];
    { const _vk = (sale.utangName || '').trim().toLowerCase(); if (sale.paymentMethod === 'Utang' && _vk && utangPayments.some(e => e.type === 'payment' && (e.name || '').trim().toLowerCase() === _vk)) { showCustomAlert('This Utang already has payments. Void is not allowed.'); return; } }
    sale.isVoided = true; utangPayments = utangPayments.filter(e => !(e.type === 'charge' && e.saleId === sale.id)); saveUtangStorage();
    sale.items.forEach(item => {
      if (!item.isCustom) {
        let p = products.find(prod => prod.id === item.id);
        if (p) p.stock += item.qty;
      }
    });
    saveProductsToStorage(); saveSalesToStorage(); renderSalesHistoryTable(); renderProducts(products);
    showCustomAlert("Transaction voided successfully and inventory stock restored.");
  });
}

function clearSalesHistory() {
  showCustomConfirm("Are you sure you want to reset all sales history?", () => {
    salesHistory = []; saveSalesToStorage(); renderSalesHistoryTable();
    showCustomAlert("Sales history reset successfully.");
  });
}

function openItemManagerModal() {
  populateCategorySelect();
  renderManagerTable();
  cancelProductForm();
  document.getElementById('itemManagerModal').style.display = 'flex';
}
function closeItemManagerModal() { document.getElementById('itemManagerModal').style.display = 'none'; filterProducts(); }
function renderManagerTable() {
  const tbody = document.getElementById('managerTableBody');
  tbody.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: bold; color: #f8fafc;">${p.name}</td>
      <td>${p.category}</td>
      <td style="color: #22c55e;">₱${p.price.toFixed(2)}</td>
      <td style="color: #fbbf24;">${p.cost ? '₱' + p.cost : '-'}</td>
      <td style="${p.stock <= 5 ? 'color:#ef4444; font-weight:bold;' : ''}">${p.stock}${p.restocks && p.restocks.length ? `<div style="font-size: 8px; color: #94a3b8; font-weight: normal;">Last restock: ${new Date(p.restocks[p.restocks.length - 1].date).toLocaleDateString()} +${p.restocks[p.restocks.length - 1].qty}</div>` : ''}</td>
      <td>
        <button style="background: #334155; color: #38bdf8; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="editProduct(${p.id})">Edit</button>
                <button style="background: #14532d; color: #86efac; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="restockProduct(${p.id})">Restock</button>
        <button style="background: #7f1d1d; color: #fca5a5; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 0; min-width: 0; cursor: pointer;" onclick="promptDeleteProduct(${p.id})">Del</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
function openAddProductForm() {
  populateCategorySelect();
  document.getElementById('formTitle').innerText = "Add New Product";
  document.getElementById('editProductId').value = '';
  document.getElementById('inputItemName').value = '';
  document.getElementById('inputItemPrice').value = '';
  document.getElementById('inputItemStock').value = '10'; document.getElementById('inputItemCost').value = '';
  document.getElementById('categoryManagerContainer').style.display = 'none'; document.getElementById('productFormContainer').style.display = 'block';
}
function cancelProductForm() { document.getElementById('productFormContainer').style.display = 'none'; }
function editProduct(id) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  populateCategorySelect();
  document.getElementById('formTitle').innerText = "Edit Product";
  document.getElementById('editProductId').value = p.id;
  document.getElementById('inputItemName').value = p.name;
  document.getElementById('inputItemPrice').value = p.price;
  document.getElementById('inputItemStock').value = p.stock; document.getElementById('inputItemCost').value = p.cost || '';
  document.getElementById('inputItemCategory').value = p.category;
  document.getElementById('categoryManagerContainer').style.display = 'none'; document.getElementById('productFormContainer').style.display = 'block';
}
function saveProductData() {
  const editId = document.getElementById('editProductId').value;
  const name = document.getElementById('inputItemName').value.trim();
  const price = parseFloat(document.getElementById('inputItemPrice').value);
  const stock = parseInt(document.getElementById('inputItemStock').value); const cost = parseFloat(document.getElementById('inputItemCost').value) || 0;
  const category = document.getElementById('inputItemCategory').value;
  if (!name || isNaN(price) || price <= 0 || isNaN(stock)) { showCustomAlert("Please enter valid product details."); return; }

  if (editId) {
    const p = products.find(item => item.id == editId);
    if (p) { p.name = name; p.price = price; p.stock = stock; p.cost = cost; p.category = category; }
  } else {
    products.push({ id: Date.now(), name, price, cost, stock, category });
  }
  saveProductsToStorage(); renderManagerTable(); cancelProductForm();
}
function restockProduct(id) {
  const p = products.find(x => x.id == id);
  if (!p) return;
  document.getElementById('promptMessage').innerText = 'How many ' + p.name + ' added? (now: ' + p.stock + ')';
  const inp = document.getElementById('promptInput');
  inp.value = '';
  const ok = document.getElementById('promptOkBtn');
  ok.onclick = () => {
    const k = parseInt(inp.value);
    if (isNaN(k) || k <= 0) { showCustomAlert('Please enter a valid number.'); return; }
    document.getElementById('customPromptModal').style.display = 'none';
    restockApply(id, k);
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok.click(); };
  document.getElementById('customPromptModal').style.display = 'flex';
  setTimeout(() => inp.focus(), 50);
}
function restockApply(id, k) {
  const p = products.find(x => x.id == id);
  if (!p) return;
  p.stock += k;
  p.restocks = (p.restocks || []).concat([{ date: new Date().toISOString(), qty: k }]).slice(-20);
  saveProductsToStorage(); renderManagerTable();
  showCustomAlert("Added " + k + " to " + p.name + ". Stock is now " + p.stock + ".");
}
function promptDeleteProduct(id) {
  showCustomConfirm("Are you sure you want to delete this product?", () => {
    products = products.filter(item => item.id !== id);
    saveProductsToStorage(); renderManagerTable();
  });
}


function openCustomModal() { rawPriceInput = '0'; document.getElementById('customName').value = ''; updateNumpadDisplay(); document.getElementById('customModal').style.display = 'flex'; }
function closeCustomModal() { document.getElementById('customModal').style.display = 'none'; }
function pressNumpad(val) { if (rawPriceInput === '0') rawPriceInput = val; else if (rawPriceInput.length < 7) rawPriceInput += val; updateNumpadDisplay(); }
function clearNumpad() { rawPriceInput = '0'; updateNumpadDisplay(); }
function backspaceNumpad() { rawPriceInput = rawPriceInput.slice(0, -1); if (rawPriceInput === '') rawPriceInput = '0'; updateNumpadDisplay(); }
function updateNumpadDisplay() { document.getElementById('numpadDisplay').innerText = `₱${(parseFloat(rawPriceInput) || 0).toFixed(2)}`; }
function addCustomItemToCart() {
  const name = document.getElementById('customName').value.trim() || "Custom Item";
  const price = parseFloat(rawPriceInput) || 0;
  if (price <= 0) { showCustomAlert("Please enter a valid price."); return; }
  cart.push({ id: "custom_" + Date.now(), name, price, qty: 1, isCustom: true });
  updateCart(); closeCustomModal();
}

function changeQty(id, change) {
  const item = cart.find(i => String(i.id) === String(id));
  if (!item) return;
  if (!item.isCustom) {
    const prod = products.find(p => String(p.id) === String(id));
    if (prod && change > 0 && item.qty >= prod.stock) { showCustomAlert("Stock limit reached!"); return; }
  }
  item.qty += change;
  if (item.qty <= 0) cart = cart.filter(i => String(i.id) !== String(id));
  updateCart();
}
function clearCart() { cart = []; discountPercent = 0; cartNote = ""; currentCustomer = "Customer"; document.getElementById('customerNameDisplay').innerText = `👤 ${currentCustomer}`; updateCart(); }

function updateCart() {
  const container = document.getElementById('cartItems');
  container.innerHTML = '';
  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-empty">No items added yet</div>';
    document.getElementById('cartCount').innerText = '0 items';
    document.getElementById('subtotalText').innerText = '₱0.00';
    document.getElementById('totalText').innerText = '₱0.00';
    document.getElementById('discountRow').style.display = 'none';
    document.getElementById('taxRow').style.display = 'none';
    return;
  }
  let totalItems = 0, subtotal = 0;
  cart.forEach(item => {
    totalItems += item.qty;
    subtotal += item.price * item.qty;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-price">₱${(item.price * item.qty).toFixed(2)}</div></div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
        <span class="item-qty">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });

  let discAmount = (subtotal * discountPercent) / 100;
  let taxableBase = subtotal - discAmount;
  let taxAmount = storeInfo.enableTax ? taxableBase * 0.12 : 0;
  let serviceAmount = storeInfo.enableService ? taxableBase * 0.05 : 0;
  let grandTotal = Math.round((taxableBase + taxAmount + serviceAmount) * 100) / 100;

  if (discountPercent > 0) {
    document.getElementById('discountRow').style.display = 'flex';
    document.getElementById('discountText').innerText = `-₱${discAmount.toFixed(2)}`;
  } else { document.getElementById('discountRow').style.display = 'none'; }

  if (storeInfo.enableTax || storeInfo.enableService) {
    document.getElementById('taxRow').style.display = 'flex';
    let labels = [];
    if (storeInfo.enableTax) labels.push("VAT (12%)");
    if (storeInfo.enableService) labels.push("SrvC (5%)");
    document.getElementById('taxLabel').innerText = labels.join(" + ");
    document.getElementById('taxText').innerText = `₱${(taxAmount + serviceAmount).toFixed(2)}`;
  } else { document.getElementById('taxRow').style.display = 'none'; }

  document.getElementById('cartCount').innerText = `${totalItems} items`;
  document.getElementById('subtotalText').innerText = `₱${subtotal.toFixed(2)}`;
  document.getElementById('totalText').innerText = `₱${grandTotal.toFixed(2)}`;
}

function processPaymentFinal(grandTotal) {
  cart.forEach(item => {
    if (!item.isCustom) {
      const p = products.find(prod => prod.id === item.id);
      if (p) p.stock = Math.max(0, p.stock - item.qty);
    }
  });
  saveProductsToStorage(); renderProducts(products);

  let totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

  if (storeInfo.kds_on) kdsCall('/api/kds', {
    customer: currentCustomer, items: JSON.parse(JSON.stringify(cart)), note: cartNote,
    orderType: ((document.querySelector('.order-type-btn.active') || {}).innerText || '').trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }).then(() => renderKdsOrders());

  const _sid = Date.now(); if (selectedPaymentMethod === 'Utang') { utangPayments.push({ type: 'charge', saleId: _sid, name: window.currentUtangName || '', amount: grandTotal, time: new Date().toISOString() }); saveUtangStorage(); } salesHistory.unshift({
    id: _sid, customer: currentCustomer, items: cart.map(i => { const q = products.find(x => x.id === i.id); return Object.assign({}, i, { cost: (q && q.cost) || 0 }); }), itemsCount: totalItemsCount,
    total: grandTotal, paymentMethod: selectedPaymentMethod, ewallet: (selectedPaymentMethod === 'GCash' ? (window.currentEwallet || 'GCash') : ''), utangName: selectedPaymentMethod === 'Utang' ? (window.currentUtangName || '') : '', gcashRef: selectedPaymentMethod === 'GCash' ? (window.currentGcashRef || '') : '', isVoided: false,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  });
  saveSalesToStorage();

  document.getElementById('receiptStoreHeader').innerText = storeInfo.name;
  { const _a = (storeInfo.address && storeInfo.address !== 'Your store address') ? storeInfo.address : ''; const _c = (storeInfo.contact && storeInfo.contact !== 'Your contact number') ? storeInfo.contact : ''; document.getElementById('receiptStoreSub').innerText = [_a, _c ? 'Tel: ' + _c : ''].filter(Boolean).join(' | '); }
  document.getElementById('receiptPaymentDetails').innerText = `Payment Method: ${selectedPaymentMethod}`;
  document.getElementById('receiptFooterMessage').innerText = storeInfo.footerMsg || "Thank you, come again!";
  
  let randomBarcode = "*" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000) + "*";
  document.getElementById('receiptBarcode').innerText = randomBarcode;

  const receiptBody = document.getElementById('receiptBody');
  receiptBody.innerHTML = '';
  const activeOrderType = document.querySelector('.order-type-btn.active').innerText;
  
  const custRow = document.createElement('div');
  custRow.style.cssText = "margin-bottom: 4px; font-weight: bold; color: #000;";
  const _rc = (selectedPaymentMethod === 'Utang' && window.currentUtangName) ? window.currentUtangName : currentCustomer;
  custRow.innerText = `Customer: ${_rc}`;
  if (_rc && _rc !== 'Customer') receiptBody.appendChild(custRow);

  let textLines = [];
  textLines.push(`=== ${storeInfo.name} ===`);
  textLines.push(`${storeInfo.address} | Tel: ${storeInfo.contact}`);
  textLines.push(`Customer: ${_rc}`);
  textLines.push(`--------------------------------`);

  cart.forEach(item => {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.justifyContent = 'space-between';
    row.innerHTML = `<span>${item.name} x${item.qty}</span><span>₱${(item.price * item.qty).toFixed(2)}</span>`;
    receiptBody.appendChild(row);
    textLines.push(`${item.name} x${item.qty} - ₱${(item.price * item.qty).toFixed(2)}`);
  });

  if (storeInfo.enableTax) {
    let subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    let taxable = subtotal - ((subtotal * discountPercent) / 100);
    let tax = taxable * 0.12;
    const taxRow = document.createElement('div');
    taxRow.style.cssText = "display: flex; justify-content: space-between; color: #444; font-size: 9px;";
    taxRow.innerHTML = `<span>VAT (12%) Included</span><span>₱${tax.toFixed(2)}</span>`;
    receiptBody.appendChild(taxRow);
    textLines.push(`VAT (12%): ₱${tax.toFixed(2)}`);
  }

  if (cartNote) {
    const noteRow = document.createElement('div');
    noteRow.style.cssText = "font-size: 9px; color: #555; margin-top: 4px;";
    noteRow.innerText = `Note: ${cartNote}`;
    receiptBody.appendChild(noteRow);
    textLines.push(`Note: ${cartNote}`);
  }

  textLines.push(`--------------------------------`);
  if (selectedPaymentMethod === 'GCash' && window.currentGcashRef) textLines.push(`GCash Ref: ${window.currentGcashRef}`);
  textLines.push(selectedPaymentMethod === 'Utang' ? `UTANG (NOT YET PAID): ₱${grandTotal.toFixed(2)}` : `TOTAL PAID: ₱${grandTotal.toFixed(2)} (${selectedPaymentMethod})`);
  textLines.push(`${storeInfo.footerMsg || 'Thank you, come again!'}`);

  lastReceiptText = textLines.join("\n");

  
    let receiptSubtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    let receiptDiscAmount = (receiptSubtotal * discountPercent) / 100;
    let paymentDetailsText = `Payment: ${selectedPaymentMethod}`;
    if (selectedPaymentMethod === 'GCash' && window.currentGcashRef) { paymentDetailsText += ` | Ref: ${window.currentGcashRef}`; }
    if (selectedPaymentMethod === 'Cash' && typeof currentTendered !== 'undefined') {
        let changeAmt = currentTendered - grandTotal;
        paymentDetailsText += ` | Tendered: ₱${currentTendered.toFixed(2)} | Change: ₱${changeAmt >= 0 ? changeAmt.toFixed(2) : '0.00'}`;
    }
    if (discountPercent > 0) {
        paymentDetailsText += ` | Discount (${discountPercent}%): -₱${receiptDiscAmount.toFixed(2)}`;
    }
    document.getElementById('receiptPaymentDetails').innerText = paymentDetailsText;
    document.getElementById('receiptTotal').innerText = `₱${grandTotal.toFixed(2)}`;

  document.getElementById('receiptModal').style.display = 'flex';
}


function closeModal() { document.getElementById('receiptModal').style.display = 'none'; clearCart(); }

renderProducts(products);
updateCart();


// Quick Cash Preset Helper Functions
function setExactCash() {
  let modalTotalElem = document.getElementById('payModalTotal');
  if (modalTotalElem) {
    let cleanTotal = parseFloat(modalTotalElem.innerText.replace(/[^0-9.]/g, '')) || 0;
    let inputElem = document.getElementById('cashTenderedInput');
    if (inputElem) {
      inputElem.value = cleanTotal.toFixed(2);
      calculateChange();
    }
  }
}

function setPresetCash(amount) {
  let inputElem = document.getElementById('cashTenderedInput');
  if (inputElem) {
    inputElem.value = amount.toFixed(2);
    calculateChange();
  }
}

// Barcode Scanner Listener for Fast Checkout
function handleBarcodeScan(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    let query = event.target.value.trim().toLowerCase();
    if (!query) return;

    // Pangitaon ang product matching barcode or exact name
    let found = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === query) || 
      p.name.toLowerCase() === query
    );

    if (found) {
      addToCart(found.id);
      event.target.value = '';
      filterProducts(); // Reset filter/display
    } else {
      // Kung dili exact match sa barcode, subayon ang filtered list
      let matches = products.filter(p => p.name.toLowerCase().includes(query));
      if (matches.length === 1) {
        addToCart(matches[0].id);
        event.target.value = '';
        filterProducts();
      }
    }
  }
}


// Camera Barcode Scanner Logic
let html5QrCodeScanner = null;

function openCameraScanner() {
  document.getElementById('cameraModal').style.display = 'flex';
  document.getElementById('scanResultStatus').innerText = "Point camera at barcode";
  document.getElementById('scanResultStatus').style.color = "#4b5563";

  if (!html5QrCodeScanner) {
    html5QrCodeScanner = new Html5Qrcode("interactive");
  }

  const config = { fps: 10, qrbox: { width: 250, height: 150 } };
  
  html5QrCodeScanner.start(
    { facingMode: "environment" }, 
    config, 
    (decodedText) => {
      // Success scan
      let code = decodedText.trim().toLowerCase();
      document.getElementById('scanResultStatus').innerText = "Scanned: " + decodedText;
      document.getElementById('scanResultStatus').style.color = "#16a34a";

      let found = products.find(p => 
        (p.barcode && p.barcode.toLowerCase() === code) || 
        p.name.toLowerCase() === code
      );

      if (found) {
        addToCart(found.id);
        if (navigator.vibrate) navigator.vibrate(100); // Haptic feedback
        closeCameraScanner();
      } else {
        document.getElementById('scanResultStatus').innerText = "No product found for code: " + decodedText;
        document.getElementById('scanResultStatus').style.color = "#dc2626";
      }
    },
    (errorMessage) => {
      // scanning... ignore frame errors
    }
  ).catch(err => {
    showCustomAlert("Camera access error: " + err);
    closeCameraScanner();
  });
}

function closeCameraScanner() {
  if (html5QrCodeScanner) {
    html5QrCodeScanner.stop().then(() => {
      document.getElementById('cameraModal').style.display = 'none';
    }).catch(err => {
      document.getElementById('cameraModal').style.display = 'none';
    });
  } else {
    document.getElementById('cameraModal').style.display = 'none';
  }
}


// --- Restaurant Item Modifiers Logic ---
let currentCustomizingProduct = null;

// Override or enhance addToCart to support modifiers
function addToCart(productId) {
  let product = products.find(p => p.id === productId);
  if (!product) return;
  if (product.stock <= 0) { showCustomAlert("This item is currently out of stock!"); return; }
  const inCartQty = cart.filter(i => i.id === productId).reduce((sum, i) => sum + i.qty, 0);
  if (inCartQty >= product.stock) { showCustomAlert("Reached maximum available stock limit!"); return; }

  // If product has custom modifiers configured, show modal
  if (product.modifiers && product.modifiers.length > 0) {
    currentCustomizingProduct = product;
    openModifierModal(product);
  } else {
    // Normal add to cart for standard items
    let existing = cart.find(item => item.id === productId && (!item.modifiers || item.modifiers.length === 0));
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1, modifiers: [], finalPrice: product.price, cartItemId: Date.now() });
    }
    updateCart();
  }
}

function openModifierModal(product) {
  document.getElementById('modProductName').innerText = product.name + " (₱" + product.price + ")";
  let container = document.getElementById('modifierOptionsList');
  container.innerHTML = "";

  product.modifiers.forEach((group, gIndex) => {
    let groupHtml = `<div style="margin-bottom: 12px;">
      <label style="font-weight: bold; font-size: 14px; color: #374151; display: block; margin-bottom: 4px;">${group.name}</label>
      <div style="display: flex; flex-direction: column; gap: 6px;">`;
    
    group.options.forEach((opt, oIndex) => {
      let inputType = group.type === 'single' ? 'radio' : 'checkbox';
      let nameAttr = `mod_group_${gIndex}`;
      let priceTag = opt.price > 0 ? ` (+₱${opt.price})` : '';
      
      groupHtml += `
        <label style="font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="${inputType}" name="${nameAttr}" value="${oIndex}" ${oIndex === 0 && group.type === 'single' ? 'checked' : ''} data-group="${gIndex}" style="accent-color: #2563eb;">
          ${opt.name} ${priceTag}
        </label>`;
    });

    groupHtml += `</div></div>`;
    container.innerHTML += groupHtml;
  });

  document.getElementById('modifierModal').style.display = 'flex';
}

function closeModifierModal() {
  document.getElementById('modifierModal').style.display = 'none';
  currentCustomizingProduct = null;
}

function confirmModifiers() {
  if (!currentCustomizingProduct) return;
  const inCartQty = cart.filter(i => String(i.id) === String(currentCustomizingProduct.id)).reduce((sum, i) => sum + i.qty, 0);
  if (inCartQty >= currentCustomizingProduct.stock) { showCustomAlert("Reached maximum available stock limit!"); closeModifierModal(); return; }

  let selectedModifiers = [];
  let additionalCost = 0;

  currentCustomizingProduct.modifiers.forEach((group, gIndex) => {
    let inputs = document.querySelectorAll(`input[name="mod_group_${gIndex}"]:checked`);
    inputs.forEach(input => {
      let optIndex = parseInt(input.value);
      let opt = group.options[optIndex];
      selectedModifiers.push({ group: group.name, name: opt.name, price: opt.price });
      additionalCost += opt.price;
    });
  });

  let finalPrice = currentCustomizingProduct.price + additionalCost;
  let cartItemId = Date.now() + Math.random(); // Unique identifier for customized item variants

  // Check if identical item with same modifiers already in cart
  let existing = cart.find(item => 
    item.id === currentCustomizingProduct.id && 
    JSON.stringify(item.modifiers) === JSON.stringify(selectedModifiers)
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      ...currentCustomizingProduct,
      qty: 1,
      modifiers: selectedModifiers,
      finalPrice: finalPrice,
      cartItemId: cartItemId
    });
  }

  closeModifierModal();
  updateCart();
}


// --- Kitchen Order Ticket (KOT) Logic ---
let activeKitchenOrders = [];

// Hook into checkout/payment to send order to KOT automatically
function sendOrderToKitchen(orderData) {
  activeKitchenOrders.unshift({
    id: 'KOT-' + Math.floor(1000 + Math.random() * 9000),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: orderData.items,
    status: 'Pending'
  });
}

function openKotModal() {
  renderKotOrders();
  document.getElementById('kotModal').style.display = 'flex';
}

function closeKotModal() {
  document.getElementById('kotModal').style.display = 'none';
}

function renderKotOrders() {
  let container = document.getElementById('kotOrdersList');
  if (activeKitchenOrders.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#6b7280; padding:20px;">No active kitchen orders right now.</p>';
    return;
  }

  container.innerHTML = "";
  activeKitchenOrders.forEach((order, index) => {
    let itemsHtml = "";
    order.items.forEach(item => {
      let modsHtml = "";
      if (item.modifiers && item.modifiers.length > 0) {
        modsHtml = `<ul style="margin: 4px 0 0 15px; padding:0; font-size:12px; color:#4b5563;">`;
        item.modifiers.forEach(m => {
          modsHtml += `<li>• ${m.group}: <b>${m.name}</b></li>`;
        });
        modsHtml += `</ul>`;
      }
      itemsHtml += `
        <div style="padding: 6px 0; border-bottom: 1px dashed #e5e7eb;">
          <div style="display:flex; justify-content:space-between; font-weight:bold;">
            <span>${item.qty}x ${item.name}</span>
          </div>
          ${modsHtml}
        </div>`;
    });

    container.innerHTML += `
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-left:4px solid #d97706; padding:12px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <b style="color:#d97706;">${order.id}</b>
          <span style="color:#6b7280;">${order.time}</span>
        </div>
        <div>${itemsHtml}</div>
        <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:8px;">
          <button onclick="completeKotOrder(${index})" style="padding:6px 12px; background:#16a34a; color:white; border:none; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Mark as Done</button>
        </div>
      </div>`;
  });
}

function completeKotOrder(index) {
  activeKitchenOrders.splice(index, 1);
  renderKotOrders();
}


// --- Camera Barcode Scanner Logic ---
let html5QrCode = null;

function openScannerModal() {
  document.getElementById('scannerModal').style.display = 'flex';
  
  // Make sure html5-qrcode library is loaded, if not load it dynamically
  if (typeof Html5Qrcode === 'undefined') {
    let script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.onload = function() {
      startScannerCamera();
    };
    document.head.appendChild(script);
  } else {
    startScannerCamera();
  }
}

function startScannerCamera() {
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };
  
  html5QrCode.start(
    { facingMode: "environment" }, 
    config, 
    onScanSuccess, 
    onScanFailure
  ).catch(err => {
    console.error("Error starting scanner:", err);
    showCustomAlert("Cannot access the camera. Please allow camera permission in your browser.");
  });
}

function onScanSuccess(decodedText, decodedResult) {
  console.log(`Code matched = ${decodedText}`, decodedResult);
  // Close scanner and process the scanned barcode/item
  closeScannerModal();
  handleScannedBarcode(decodedText);
}

function onScanFailure(error) {
  // Handle scan failure, usually ignore to keep scanning
}

function closeScannerModal() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      document.getElementById('scannerModal').style.display = 'none';
    }).catch(err => {
      console.error("Failed to stop scanner", err);
      document.getElementById('scannerModal').style.display = 'none';
    });
  } else {
    document.getElementById('scannerModal').style.display = 'none';
  }
}

function handleScannedBarcode(code) {
  // Search product by barcode or SKU in cart/items
  if (typeof cart !== 'undefined' && typeof products !== 'undefined') {
    let found = products.find(p => p.barcode === code || p.id === code);
    if (found) {
      addToCart(found.id);
    } else {
      showCustomAlert("No product found for barcode: " + code);
    }
  } else {
    showCustomAlert("Scanned Code: " + code);
  }
}



// --- Confirm button gray-out fix ---
function switchPaymentMethod(method) {
  selectedPaymentMethod = method;
  const confirmBtn = document.querySelector('button[onclick="confirmAndProcessPayment()"]');
  if (method === 'Cash') {
    document.getElementById('tabCash').classList.add('active');
    document.getElementById('tabGcash').classList.remove('active');
    document.getElementById('cashPaymentSection').style.display = 'block';
    document.getElementById('gcashPaymentSection').style.display = 'none';
    calculateChange();
  } else {
    document.getElementById('tabGcash').classList.add('active');
    document.getElementById('tabCash').classList.remove('active');
    document.getElementById('cashPaymentSection').style.display = 'none';
    document.getElementById('gcashPaymentSection').style.display = 'block';
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    }
  }
}


// --- Added missing handlers for ATS validation ---

function switchTab(tabName) { console.log("switchTab called:", tabName); }

function closeInventoryModal() { const modals = document.querySelectorAll(".modal"); modals.forEach(m => m.style.display = "none"); }



let renameCatIndex = -1;
function renameCategory(index) {
  renameCatIndex = index;
  document.getElementById('renameCatInput').value = categories[index].name;
  document.getElementById('renameCatModal').style.display = 'flex';
  setTimeout(() => document.getElementById('renameCatInput').focus(), 100);
}
function closeRenameCat() { document.getElementById('renameCatModal').style.display = 'none'; }
function saveRenameCat() {
  const v = document.getElementById('renameCatInput').value.trim();
  if (!v) { showCustomAlert("Please enter a category name."); return; }
  renameCategoryApply(renameCatIndex, v);
  closeRenameCat();
}


function syncFetch(key, opts) {
  var track = (key === 'totskie_sales' || key === 'totskie_products');
  var flag = 'totskie_unsynced_' + key;
  window.__syncSeq = window.__syncSeq || {};
  var my = (window.__syncSeq[key] || 0) + 1;
  window.__syncSeq[key] = my;
  if (track) { try { localStorage.setItem(flag, '1'); } catch (e) { console.error(e); } }
  return fetch('/api/state/' + key, opts).then(function (r) {
    if (r.status === 403) {
      r.clone().json().then(function (d) { if (d && d.error === 'Trial ended') { location.href = '/pay'; } }).catch(function () {});
    }
    if (track && r.ok && window.__syncSeq[key] === my) {
      try { localStorage.removeItem(flag); } catch (e) { console.error(e); }
    }
    return r;
  });
}

function syncToServer(key, val) {
  try {
    syncFetch(key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(val) })
    }).then(r => { if (r.status === 401) { location.reload(); } else if (!r.ok) { showCustomAlert('Warning: could not save to server.'); } })
      .catch(function (e) { console.log('offline: will sync later'); });
  } catch (e) { console.error(e); }
}


// ===== Login, roles, staff PINs =====
function logoutNow() {
  try{sessionStorage.removeItem('kh_off')}catch(e){} fetch('/api/auth/logout', { method: 'POST' }).finally(() => location.reload());
}

function openStaffModal() {
  document.getElementById('staffModal').style.display = 'flex';
  loadStaff();
}
function closeStaffModal() { document.getElementById('staffModal').style.display = 'none'; }

function loadStaff() {
  fetch('/api/users').then(r => r.json()).then(list => {
    const box = document.getElementById('staffList');
    box.innerHTML = '';
    if (!Array.isArray(list)) return;
    list.forEach(u => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#0f172a;padding:6px 8px;border-radius:4px;font-size:12px;';
      const label = document.createElement('span');
      label.textContent = u.name + ' (' + u.role + ')';
      const btn = document.createElement('button');
      btn.textContent = 'Del';
      btn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:none;padding:10px 14px;border-radius:6px;font-size:13px;min-height:44px;min-width:44px;cursor:pointer;';
      btn.onclick = () => deleteStaff(u.id);
      row.appendChild(label);
      row.appendChild(btn);
      box.appendChild(row);
    });
  });
}

function addStaff() {
  const name = document.getElementById('staffName').value.trim();
  const role = document.getElementById('staffRole').value;
  const pin = document.getElementById('staffPin').value.trim();
  fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, role: role, pin: pin })
  }).then(r => r.json().then(d => ({ ok: r.ok, d: d }))).then(res => {
    if (!res.ok) { showCustomAlert(res.d.error || 'Could not add.'); return; }
    document.getElementById('staffName').value = '';
    document.getElementById('staffPin').value = '';
    loadStaff();
  });
}

function deleteStaff(id) {
  showCustomConfirm('Delete this staff account?', () => {
    fetch('/api/users/' + id, { method: 'DELETE' }).then(r => r.json().then(d => ({ ok: r.ok, d: d }))).then(res => {
      if (!res.ok) { showCustomAlert(res.d.error || 'Could not delete.'); return; }
      loadStaff();
    });
  });
}

(function () {
  function guard(name, allowed, msg) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (!allowed.includes(window.currentRole)) { showCustomAlert(msg); return; }
      return orig.apply(this, arguments);
    };
  }
  guard('promptVoidTransaction', ['admin'], 'Only an admin can void sales.');
  guard('openItemManagerModal', ['admin'], 'Admin access required.');
  guard('openSettingsModal', ['admin'], 'Admin access required.');
  guard('openStaffModal', ['admin'], 'Admin access required.');
  guard('openPaymentModal', ['admin', 'cashier'], 'Cashier or admin login required.');
})();

function applyRoleUI() {
  const role = window.currentRole;
  if (!role) return;
  const hideFor = {
    cashier: ['openItemManagerModal', 'openSettingsModal', 'openStaffModal'],
    kitchen: ['openItemManagerModal', 'openSalesHistoryModal', 'openSettingsModal', 'openStaffModal']
  };
  document.querySelectorAll('.sidebar-item').forEach(el => {
    const oc = el.getAttribute('onclick') || '';
    if ((hideFor[role] || []).some(fn => oc.includes(fn)) || (!storeInfo.kds_on && oc.includes('openKdsModal'))) el.style.display = 'none';
  });
  if (role === 'kitchen' && storeInfo.kds_on) openKdsModal();
}
window.addEventListener('load', applyRoleUI);


// ===== Data: export sales and reset =====
function openDataModal() {
  if (window.currentRole !== 'admin') { showCustomAlert('Admin access required.'); return; }
  document.getElementById('dataModal').style.display = 'flex';
}
function closeDataModal() {
  document.getElementById('dataModal').style.display = 'none';
  document.getElementById('resetPinInput').value = '';
}
function csvCell(v) {
  let s = String(v === undefined || v === null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function exportSalesRange() {
  if (window.currentRole !== 'admin') { showCustomAlert('Admin access required.'); return; }
  const f = document.getElementById('exportFrom').value;
  const t = document.getElementById('exportTo').value;
  const from = f ? new Date(f + 'T00:00:00').getTime() : 0;
  const to = t ? new Date(t + 'T23:59:59.999').getTime() : Infinity;
  const rows = salesHistory.filter(s => s.id >= from && s.id <= to);
  if (rows.length === 0) { showCustomAlert('No sales found for that date range.'); return; }
  const header = ['Receipt ID', 'Date', 'Time', 'Customer', 'Items', 'Item count', 'Payment method', 'GCash ref', 'Total', 'Status'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach(s => {
    const items = (s.items || []).map(i => i.name + ' x' + i.qty).join('; ');
    lines.push([s.id, ymd(new Date(s.id)), s.time, s.customer, items, s.itemsCount, s.paymentMethod, s.gcashRef || '', Number(s.total).toFixed(2), s.isVoided ? 'Voided' : 'OK'].map(csvCell).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sales_' + ymd(new Date()) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showCustomAlert('Exported ' + rows.length + ' sales.'); try { localStorage.setItem('kh_backup', String(Date.now())); localStorage.removeItem('kh_dismiss'); } catch (e) {} khBannerCheck();
}
function resetToDefaults() {
  if (window.currentRole !== 'admin') { showCustomAlert('Admin access required.'); return; }
  const pin = document.getElementById('resetPinInput').value.trim();
  if (!/^[0-9]{4,6}$/.test(pin)) { showCustomAlert('Enter your admin PIN to confirm.'); return; }
  showCustomConfirm('Delete ALL products and sales and restore defaults? Staff accounts are kept. This cannot be undone. Did you export your sales first?', () => {
    fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    }).then(r => r.json().then(d => ({ ok: r.ok, d: d }))).then(res => {
      if (!res.ok) { showCustomAlert(res.d.error || 'Reset failed.'); return; }
      ['totskie_categories', 'totskie_products', 'totskie_sales', 'totskie_store', 'totskie_kds', 'totskie_utang', 'totskie_expenses'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }).catch(() => showCustomAlert('Reset failed. Check the server.'));
  });
}
window.addEventListener('load', () => {
  if (window.currentRole !== 'admin') {
    document.querySelectorAll('.sidebar-item').forEach(el => {
      if ((el.getAttribute('onclick') || '').includes('openDataModal')) el.style.display = 'none';
    });
  }
});

let stockViewCat = 'All';
let stockViewPage = 1;
function openStockViewModal() {
  if (window.currentRole !== 'admin') { showCustomAlert('Admin access required.'); return; }
  document.getElementById('stockSearch').value = '';
  stockViewCat = 'All';
  stockViewPage = 1;
  renderStockView();
  document.getElementById('stockViewModal').style.display = 'flex';
}
function renderStockView() {
  const q = (document.getElementById('stockSearch').value || '').toLowerCase();
  if (stockViewCat !== 'All' && !categories.some(c => c.name === stockViewCat)) stockViewCat = 'All';
  const catBox = document.getElementById('stockCatBtns');
  catBox.innerHTML = '';
  ['All'].concat(categories.map(c => c.name)).forEach(name => {
    const b = document.createElement('button');
    b.textContent = name;
    const on = name === stockViewCat;
    b.style.cssText = 'padding:5px 10px; border:none; border-radius:14px; font-size:12px; cursor:pointer; ' + (on ? 'background:#3b82f6; color:#fff;' : 'background:#334155; color:#cbd5e1;');
    b.onclick = function () { stockViewCat = name; stockViewPage = 1; renderStockView(); };
    catBox.appendChild(b);
  });
  const list = products.slice().sort((x, y) => x.stock - y.stock).filter(p => (stockViewCat === 'All' || p.category === stockViewCat) && p.name.toLowerCase().includes(q));
  const per = 10;
  const pages = Math.max(1, Math.ceil(list.length / per));
  if (stockViewPage > pages) stockViewPage = pages;
  if (stockViewPage < 1) stockViewPage = 1;
  const tb = document.getElementById('stockViewBody');
  tb.innerHTML = '';
  list.slice((stockViewPage - 1) * per, stockViewPage * per).forEach(p => {
    const out = p.stock <= 0;
    const low = !out && p.stock <= 5;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = p.name;
    const td2 = document.createElement('td');
    td2.textContent = out ? 'OUT' : (p.stock + (low ? ' ⚠️' : ''));
    if (out || low) td2.style.cssText = 'color:#ef4444; font-weight:bold;';
    tr.appendChild(td1);
    tr.appendChild(td2);
    tb.appendChild(tr);
  });
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.style.textAlign = 'center';
    td.textContent = 'No items';
    tr.appendChild(td);
    tb.appendChild(tr);
  }
  const pg = document.getElementById('stockPager');
  pg.innerHTML = '';
  if (pages > 1) {
    const mk = (label, target, active, disabled) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = !!disabled;
      b.style.cssText = 'min-width:32px; padding:5px 8px; border:none; border-radius:6px; font-size:13px; cursor:pointer; ' + (active ? 'background:#3b82f6; color:#fff;' : 'background:#334155; color:#cbd5e1;') + (disabled ? ' opacity:0.4;' : '');
      b.onclick = function () { stockViewPage = target; renderStockView(); };
      pg.appendChild(b);
    };
    mk('‹', stockViewPage - 1, false, stockViewPage === 1);
    for (let n = 1; n <= pages; n++) mk(String(n), n, n === stockViewPage, false);
    mk('›', stockViewPage + 1, false, stockViewPage === pages);
  }
}
function closeStockViewModal() { document.getElementById('stockViewModal').style.display = 'none'; }

(function () {
  const orig = switchPaymentMethod;
  window.switchPaymentMethod = function (method) {
    const us = document.getElementById('utangPaymentSection');
    const ut = document.getElementById('tabUtang');
    if (method === 'Utang') {
      orig('GCash');
      document.getElementById('gcashPaymentSection').style.display = 'none';
      document.getElementById('tabGcash').classList.remove('active');
      ut.classList.add('active');
      us.style.display = 'block';
      document.getElementById('utangNameInput').value = '';
      selectedPaymentMethod = 'Utang';
    } else {
      ut.classList.remove('active');
      us.style.display = 'none';
      orig(method);
    }
  };
})();

function utangProfitToday() {
  const today = new Date().toDateString();
  const ratio = {};
  utangPayments.forEach(e => {
    if (e.type !== 'charge') return;
    const k = (e.name || '').trim().toLowerCase();
    const sl = salesHistory.find(x => x.id === e.saleId && !x.isVoided);
    if (!k || !sl || !sl.total) return;
    if (!sl.items.every(i => i.cost !== undefined)) return;
    const pr = sl.total - sl.items.reduce((c, i) => c + i.cost * i.qty, 0);
    if (!ratio[k]) ratio[k] = { p: 0, t: 0 };
    ratio[k].p += pr; ratio[k].t += sl.total;
  });
  let sum = 0;
  utangPayments.forEach(e => {
    if (e.type !== 'payment' || new Date(e.time).toDateString() !== today) return;
    const r = ratio[(e.name || '').trim().toLowerCase()];
    if (r && r.t > 0) sum += e.amount * (r.p / r.t);
  });
  return sum;
}

let utangPayTarget = null;
function fmtUtangDate(t) { if (!t) return '-'; var d = new Date(t); if (isNaN(d)) return '-'; return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function utangBalances() {
  const m = {};
  utangPayments.forEach(e => {
    const k = (e.name || '').trim().toLowerCase();
    if (!k) return;
    if (!m[k]) m[k] = { name: e.name.trim(), bal: 0 };
    var _z = m[k].bal <= 0.004; m[k].bal += (e.type === 'payment' ? -1 : 1) * e.amount; if (e.type !== 'payment' && _z) m[k].since = e.time;
  });
  return Object.values(m).map(x => ({ name: x.name, since: x.since, bal: Math.round(x.bal * 100) / 100 })).filter(x => x.bal > 0.004).sort((a, b) => b.bal - a.bal);
}
function toggleUtangDetail(tr, name) {
  const nx = tr.nextSibling;
  if (nx && nx.className === 'utang-detail') { nx.remove(); return; }
  const k = (name || '').trim().toLowerCase();
  const rows = utangPayments.filter(e => (e.name || '').trim().toLowerCase() === k).slice().sort((a, b) => new Date(a.time) - new Date(b.time));
  const dr = document.createElement('tr'); dr.className = 'utang-detail';
  const td = document.createElement('td'); td.colSpan = 4;
  td.style.cssText = 'background:#0b1220; font-size:11px; padding:8px;';
  rows.forEach(e => {
    const d = document.createElement('div');
    d.style.cssText = 'padding:3px 0; border-bottom:1px dashed #334155;';
    let txt;
    if (e.type === 'payment') {
      txt = fmtUtangDate(e.time) + ' - Payment: ₱' + e.amount.toFixed(2); d.style.color = '#22c55e';
    } else {
      const sl = salesHistory.find(x => x.id === e.saleId);
      const its = sl ? sl.items.map(i => i.name + ' x' + i.qty).join(', ') : '';
      txt = fmtUtangDate(e.time) + ' - Utang: ₱' + e.amount.toFixed(2) + (its ? ' (' + its + ')' : ''); d.style.color = '#f59e0b';
    }
    d.textContent = txt; td.appendChild(d);
  });
  dr.appendChild(td); tr.after(dr);
}

function renderUtangList() {
  const tb = document.getElementById('utangListBody');
  tb.innerHTML = '';
  const list = utangBalances();
  let total = 0;
  if (!list.length) { tb.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">No utang</td></tr>'; }
  list.forEach(x => {
    total += x.bal;
    const tr = document.createElement('tr');
    const t1 = document.createElement('td'); t1.textContent = x.name; t1.style.cursor = 'pointer'; t1.style.textDecoration = 'underline'; t1.onclick = () => toggleUtangDetail(tr, x.name);
    const t2 = document.createElement('td'); t2.textContent = '₱' + x.bal.toFixed(2); t2.style.color = '#f59e0b'; const t4 = document.createElement('td'); t4.style.fontSize = '10px'; t4.style.color = '#94a3b8'; t4.textContent = fmtUtangDate(x.since);
    const t3 = document.createElement('td');
    const b = document.createElement('button'); b.textContent = 'Pay';
    b.style.cssText = 'background:none; color:#22c55e; border:1px solid #22c55e; padding:3px 10px; border-radius:6px; font-size:11px; min-height:0; font-weight:bold;';
    b.onclick = () => startUtangPay(x.name, x.bal);
    t3.appendChild(b); tr.appendChild(t1); tr.appendChild(t4); tr.appendChild(t2); tr.appendChild(t3); tb.appendChild(tr);
  });
  document.getElementById('utangTotal').textContent = '₱' + total.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function openUtangModal() {
  if (window.currentRole !== 'admin' && window.currentRole !== 'cashier') { showCustomAlert('Cashier or admin login required.'); return; }
  utangPayTarget = null;
  document.getElementById('utangPayBox').style.display = 'none';
  renderUtangList();
  document.getElementById('utangModal').style.display = 'flex';
}
function closeUtangModal() { document.getElementById('utangModal').style.display = 'none'; }
function startUtangPay(name, bal) {
  utangPayTarget = { name: name, bal: bal };
  document.getElementById('utangPayLabel').textContent = name + ' owes ₱' + bal.toFixed(2);
  document.getElementById('utangPayAmount').value = '';
  document.getElementById('utangPayBox').style.display = 'block';
}
function confirmUtangPay() {
  if (!utangPayTarget) return;
  const amt = Math.round((parseFloat(document.getElementById('utangPayAmount').value) || 0) * 100) / 100;
  if (amt <= 0) { showCustomAlert('Enter the amount received.'); return; }
  if (amt > utangPayTarget.bal) { showCustomAlert('Amount is more than the balance of ₱' + utangPayTarget.bal.toFixed(2) + '.'); return; }
  utangPayments.push({ type: 'payment', name: utangPayTarget.name, amount: amt, method: ((document.getElementById('utangPayMethod') || {}).value || 'Cash'), time: new Date().toISOString() });
  saveUtangStorage();
  utangPayTarget = null;
  document.getElementById('utangPayBox').style.display = 'none';
  renderUtangList();
  showCustomAlert('Payment recorded.');
}

let salesRange = 'today';
function setSalesRange(r) { salesRange = r; renderSalesHistoryTable(); }
function _rangeStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (salesRange === 'week') d.setDate(d.getDate() - 6);
  else if (salesRange === 'month') d.setDate(d.getDate() - 29);
  return d.getTime();
}
function _utangProfitSince(start) {
  const ratio = {};
  utangPayments.forEach(e => {
    if (e.type !== 'charge') return;
    const k = (e.name || '').trim().toLowerCase();
    const sl = salesHistory.find(x => x.id === e.saleId && !x.isVoided);
    if (!k || !sl || !sl.total) return;
    if (!sl.items.every(i => i.cost !== undefined)) return;
    const pr = sl.total - sl.items.reduce((c, i) => c + i.cost * i.qty, 0);
    if (!ratio[k]) ratio[k] = { p: 0, t: 0 };
    ratio[k].p += pr; ratio[k].t += sl.total;
  });
  let sum = 0;
  utangPayments.forEach(e => {
    if (e.type !== 'payment' || new Date(e.time).getTime() < start) return;
    const r = ratio[(e.name || '').trim().toLowerCase()];
    if (r && r.t > 0) sum += e.amount * (r.p / r.t);
  });
  return sum;
}
function updateSalesSummary() {
  const start = _rangeStart();
  let rev = 0, prof = 0;
  salesHistory.forEach(s => {
    if (s.isVoided || s.paymentMethod === 'Utang' || s.id < start) return;
    rev += s.total;
    if (s.items.every(i => i.cost !== undefined)) prof += s.total - s.items.reduce((c, i) => c + i.cost * i.qty, 0);
  });
  utangPayments.forEach(e => { if (e.type === 'payment' && new Date(e.time).getTime() >= start) rev += e.amount; });
  prof += _utangProfitSince(start);
  const r = document.getElementById('totalRevenueDisplay'); if (r) r.innerText = '₱' + rev.toFixed(2);
  const p = document.getElementById('totalProfitDisplay'); if (p) p.innerText = '₱' + prof.toFixed(2);
  const sp = document.getElementById('stockPuhunanDisplay');
  if (sp) { let pv = 0; products.forEach(x => { pv += (x.cost || 0) * Math.max(0, x.stock || 0); }); sp.innerText = '₱' + pv.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
  const l = document.getElementById('revLabel');
  if (l) l.innerText = salesRange === 'week' ? 'Revenue (Last 7 Days)' : salesRange === 'month' ? 'Revenue (Last 30 Days)' : 'Total Revenue Today';
  [['Today','today'],['Week','week'],['Month','month']].forEach(x => {
    const b = document.getElementById('rng' + x[0]); if (!b) return;
    const on = salesRange === x[1];
    b.style.background = on ? '#0ea5e9' : '#334155'; b.style.color = on ? '#fff' : '#94a3b8';
  });
}
const _origRSHT = renderSalesHistoryTable;
renderSalesHistoryTable = function () { _origRSHT(); updateSalesSummary(); };

let khBannerAct = '';
function khBannerCheck() {
  const box = document.getElementById('khBanner'); if (!box) return;
  const txt = document.getElementById('khBannerText');
  let msg = ''; khBannerAct = '';
  try {
    if (localStorage.getItem('kh_dismiss') === new Date().toDateString()) { box.style.display = 'none'; return; }
    const days = (typeof KH !== 'undefined' && KH.days) ? KH.days : 30;
    const last = parseInt(localStorage.getItem('kh_last') || '0', 10);
    if (last > 0) {
      const used = Math.floor((Date.now() - last) / 86400000);
      if (used >= days - 5) { msg = 'Connect to the internet soon (' + Math.max(days - used, 0) + ' days left)'; }
    }
    if (!msg && window.currentRole === 'admin' && window.hasRecovery === false) { msg = 'Save your Recovery Code: Staff PINs > Generate (tap here)'; khBannerAct = 'recovery'; }
    if (!msg && window.currentRole === 'admin') {
      let b = parseInt(localStorage.getItem('kh_backup') || '0', 10);
      if (!b) { b = Date.now(); localStorage.setItem('kh_backup', String(b)); }
      if (Date.now() - b >= 30 * 86400000) { msg = 'Backup your sales: Export CSV (I-tap dito)'; khBannerAct = 'backup'; }
    }
  } catch (e) {}
  if (msg) { txt.innerText = msg; box.style.display = 'flex'; } else { box.style.display = 'none'; }
}
function khBannerTap() { if (khBannerAct === 'backup') openSalesHistoryModal(); else if (khBannerAct === 'recovery') openStaffModal(); }
function khBannerClose() {
  try { localStorage.setItem('kh_dismiss', new Date().toDateString()); } catch (e) {}
  const box = document.getElementById('khBanner'); if (box) box.style.display = 'none';
}
window.addEventListener('load', () => { setTimeout(khBannerCheck, 2500); setInterval(khBannerCheck, 600000); });

function refreshRecStatus() {
  fetch('/api/recovery/status').then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return;
    window.hasRecovery = !!d.has_code;
    const s = document.getElementById('recStatus');
    if (s) { s.innerText = d.has_code ? 'Recovery Code is set. A new one replaces the old.' : 'No Recovery Code yet.'; s.style.color = d.has_code ? '#22c55e' : '#fca5a5'; }
    khBannerCheck();
  }).catch(() => {});
}
function generateRecovery() {
  showCustomConfirm('Generate a new Recovery Code? The old one will stop working.', () => {
    fetch('/api/recovery/generate', { method: 'POST' }).then(r => r.json().then(d => ({ ok: r.ok, d: d }))).then(res => {
      if (!res.ok) { showCustomAlert(res.d.error || 'Could not generate code.'); return; }
      const sh = document.getElementById('recShown'); if (sh) sh.innerText = res.d.code;
      showCustomAlert('Your Recovery Code: ' + res.d.code + ' -- Write it down or take a screenshot. It will not be shown again.');
      refreshRecStatus();
    }).catch(() => showCustomAlert('No internet. Try again when online.'));
  });
}
if (typeof openStaffModal === 'function') {
  const _origOSM = openStaffModal;
  openStaffModal = function () { _origOSM(); const sh = document.getElementById('recShown'); if (sh) sh.innerText = ''; refreshRecStatus(); };
}
window.addEventListener('load', () => setTimeout(() => { if (window.currentRole === 'admin') refreshRecStatus(); }, 2000));


/* CUSTOMER-HISTORY */
function _custKey(n) { return (n || '').trim().toLowerCase(); }
function _custIsDefault(n) { const k = _custKey(n); return !k || k === 'customer' || k === 'walk-in customer'; }
function _custEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _custTap(n) {
  if (_custIsDefault(n)) return _custEsc(n || '');
  return '<span style="cursor:pointer; text-decoration:underline;" data-n="' + _custEsc(n) + '" onclick="openCustHistory(this.dataset.n)">' + _custEsc(n) + '</span>';
}
function openCustHistory(name) {
  if (_custIsDefault(name)) return;
  const k = _custKey(name);
  const list = salesHistory.filter(s => !s.isVoided && _custKey(_custName(s)) === k).slice().sort((x, y) => y.id - x.id);
  const tb = document.getElementById('custHistBody');
  tb.innerHTML = '';
  let total = 0;
  list.forEach(s => {
    total += s.total;
    const tr = document.createElement('tr');
    const t1 = document.createElement('td');
    let d = fmtUtangDate(s.id);
    if (d === '-') d = s.time || '-';
    t1.textContent = d;
    t1.style.fontSize = '10px';
    const t2 = document.createElement('td');
    t2.textContent = s.items.map(i => i.name + ' x' + i.qty).join(', ') + (s.paymentMethod === 'Utang' ? ' (Utang)' : '');
    t2.style.fontSize = '10px';
    const t3 = document.createElement('td');
    t3.textContent = '₱' + s.total.toFixed(2);
    t3.style.color = '#22c55e';
    tr.appendChild(t1); tr.appendChild(t2); tr.appendChild(t3);
    tb.appendChild(tr);
  });
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.style.textAlign = 'center'; td.textContent = 'No purchases';
    tr.appendChild(td); tb.appendChild(tr);
  }
  document.getElementById('custHistName').textContent = name.trim();
  document.getElementById('custHistTotal').textContent = '₱' + total.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  document.getElementById('custHistModal').style.display = 'flex';
}
function closeCustHistory() { document.getElementById('custHistModal').style.display = 'none'; }


/* PAY-CUSTOMER-NAME */
function _custName(s) {
  if (_custIsDefault(s.customer) && s.utangName && s.utangName.trim()) return s.utangName;
  return s.customer;
}
function _payCustShow() {
  const w = document.getElementById('payCustWrap');
  const u = document.getElementById('tabUtang');
  if (w) w.style.display = (u && u.classList.contains('active')) ? 'none' : 'block';
}
(function () {
  const oOpen = window.openPaymentModal;
  window.openPaymentModal = function () {
    const r = oOpen.apply(this, arguments);
    const i = document.getElementById('payCustName');
    if (i) i.value = '';
    _payCustShow();
    return r;
  };
  const oSw = window.switchPaymentMethod;
  window.switchPaymentMethod = function () {
    const r = oSw.apply(this, arguments);
    _payCustShow();
    return r;
  };
  const oConfirm = window.confirmAndProcessPayment;
  window.confirmAndProcessPayment = function () {
    const src = selectedPaymentMethod === 'Utang' ? 'utangNameInput' : 'payCustName';
    const n = (document.getElementById(src).value || '').trim();
    currentCustomer = n || 'Customer';
    return oConfirm.apply(this, arguments);
  };
})();


/* EWALLET-TYPE */
function _pmLabel(s) {
  if (s.paymentMethod === 'GCash') return 'E-Wallet' + (s.ewallet ? ' - ' + s.ewallet : '');
  return s.paymentMethod || 'Cash';
}
(function () {
  const oOpen2 = window.openPaymentModal;
  window.openPaymentModal = function () {
    const r = oOpen2.apply(this, arguments);
    const s = document.getElementById('ewalletType');
    if (s) s.value = 'GCash';
    return r;
  };
  const oConf2 = window.confirmAndProcessPayment;
  window.confirmAndProcessPayment = function () {
    const s = document.getElementById('ewalletType');
    window.currentEwallet = s ? s.value : 'GCash';
    return oConf2.apply(this, arguments);
  };
})();


/* UTANG-PAY-METHOD */
(function () {
  const oStart = window.startUtangPay;
  window.startUtangPay = function () {
    const r = oStart.apply(this, arguments);
    const s = document.getElementById('utangPayMethod');
    if (s) s.value = 'Cash';
    return r;
  };
})();


/* EXPENSES */
let expenses = [];
try { expenses = JSON.parse(localStorage.getItem('totskie_expenses') || '[]'); if (!Array.isArray(expenses)) expenses = []; } catch (e) { expenses = []; }
function saveExpensesStorage() { try { localStorage.setItem('totskie_expenses', JSON.stringify(expenses)); } catch (e) { /* ignore */ } }
function _money(n) { return '₱' + n.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
let expShowAll = false;
function renderExpenses() {
  const tb = document.getElementById('expInlineBody');
  tb.innerHTML = '';
  if (!expenses.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.style.textAlign = 'center'; td.style.color = '#64748b'; td.textContent = 'No expenses';
    tr.appendChild(td); tb.appendChild(tr);
    return;
  }
  const all = expenses.slice().sort((x, y) => y.id - x.id);
  const list = expShowAll ? all : all.slice(0, 5);
  list.forEach(e => {
    const tr = document.createElement('tr');
    const t1 = document.createElement('td');
    const d1 = document.createElement('div');
    d1.textContent = (e.reason || '-') + ' (' + e.source + ')';
    d1.style.fontWeight = 'bold';
    const d2 = document.createElement('div');
    d2.textContent = fmtUtangDate(e.id);
    d2.style.cssText = 'font-size:9px; color:#94a3b8;';
    t1.appendChild(d1); t1.appendChild(d2);
    const t2 = document.createElement('td');
    t2.textContent = '₱' + e.amount.toFixed(2);
    t2.style.color = '#f59e0b';
    const t3 = document.createElement('td');
    const b = document.createElement('button');
    b.textContent = 'Delete';
    b.style.cssText = 'background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:3px 8px; font-size:10px; min-height:0;';
    b.onclick = function () { deleteExpense(e.id); };
    t3.appendChild(b);
    tr.appendChild(t1); tr.appendChild(t2); tr.appendChild(t3);
    tb.appendChild(tr);
  });
  if (all.length > 5) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.style.textAlign = 'center';
    const l = document.createElement('span');
    l.textContent = expShowAll ? 'Show less' : 'Show all (' + all.length + ')';
    l.style.cssText = 'color:#38bdf8; text-decoration:underline; cursor:pointer; font-size:11px;';
    l.onclick = function () { expShowAll = !expShowAll; renderExpenses(); };
    td.appendChild(l); tr.appendChild(td); tb.appendChild(tr);
  }
}
function openExpenses() {
  document.getElementById('expAmount').value = '';
  document.getElementById('expReason').value = '';
  document.getElementById('expSource').value = 'Cash';
  renderExpenses();
  document.getElementById('expModal').style.display = 'flex';
}
function closeExpenses() {
  document.getElementById('expModal').style.display = 'none';
  updateSalesSummary();
}
function saveExpense() {
  const amt = Math.round((parseFloat(document.getElementById('expAmount').value) || 0) * 100) / 100;
  if (amt <= 0) { showCustomAlert('Enter the expense amount.'); return; }
  const reason = (document.getElementById('expReason').value || '').trim();
  const src = document.getElementById('expSource').value === 'E-Wallet' ? 'E-Wallet' : 'Cash';
  expenses.push({ id: Date.now(), amount: amt, reason: reason, source: src });
  saveExpensesStorage();
  document.getElementById('expAmount').value = '';
  document.getElementById('expReason').value = '';
  renderExpenses();
  closeExpenses();
}
function deleteExpense(id) {
  showCustomConfirm('Delete this expense?', () => {
    expenses = expenses.filter(x => x.id !== id);
    saveExpensesStorage();
    renderExpenses();
    updateSalesSummary();
  });
}
function _drawerSummary() {
  renderExpenses();
  let cash = 0, ew = 0;
  salesHistory.forEach(s => {
    if (s.isVoided) return;
    if (s.paymentMethod === 'Cash') cash += s.total;
    else if (s.paymentMethod === 'GCash') ew += s.total;
  });
  utangPayments.forEach(e => {
    if (e.type !== 'payment') return;
    if (e.method === 'E-Wallet') ew += e.amount; else cash += e.amount;
  });
  expenses.forEach(x => { if (x.source === 'E-Wallet') ew -= x.amount; else cash -= x.amount; });
  let owed = 0;
  utangBalances().forEach(x => { owed += x.bal; });
  const c = document.getElementById('drawerCashDisplay'); if (c) { c.innerText = _money(cash); c.style.color = cash < 0 ? '#ef4444' : '#22c55e'; }
  const w = document.getElementById('drawerEwalletDisplay'); if (w) { w.innerText = _money(ew); w.style.color = ew < 0 ? '#ef4444' : '#38bdf8'; }
  const u = document.getElementById('utangCollectDisplay'); if (u) u.innerText = _money(owed);
}
(function () {
  const oSum = window.updateSalesSummary;
  window.updateSalesSummary = function () {
    const r = oSum.apply(this, arguments);
    _drawerSummary();
    return r;
  };
})();
