// Welcome to the core logic of our store! This script manages our catalog, search, filtering, and shopping cart.
document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  // Here are the elements on the page that we interact with to handle customer requests.
  const productsGrid = document.getElementById('products-grid');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const filterChips = document.querySelectorAll('.filter-chip');
  
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartCountBadge = document.getElementById('cart-count-badge');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const cartTotal = document.getElementById('cart-total');
  
  const proceedToCheckoutBtn = document.getElementById('proceed-to-checkout-btn');
  const checkoutForm = document.getElementById('checkout-form');
  const cancelCheckoutBtn = document.getElementById('cancel-checkout-btn');
  const cartActionsContainer = document.querySelector('.cart-actions-container');
  
  const trackOrderBtn = document.getElementById('track-order-btn');
  const trackModal = document.getElementById('track-modal');
  const closeTrackBtn = document.getElementById('close-track-btn');
  
  const trackStep1 = document.getElementById('track-step-1');
  const trackStep2 = document.getElementById('track-step-2');
  const requestOtpBtn = document.getElementById('request-otp-btn');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const trackOrderIdInput = document.getElementById('track-order-id');
  const trackOtpCodeInput = document.getElementById('track-otp-code');
  const otpDestinationMsg = document.getElementById('otp-destination-msg');
  const backToStep1Btn = document.getElementById('back-to-step1-btn');
  
  const orderDetailsResult = document.getElementById('order-details-result');
  
  const toastContainer = document.getElementById('toast-container');

  // --- State Variables ---
  // We keep track of the loaded products, current cart items, and search/sorting selections.
  let products = [];
  let cart = { items: [], totalItems: 0, totalPrice: 0 };
  let selectedCategory = 'all';
  let searchQuery = '';
  let currentSort = 'default';
  
  // This keeps track of whether the user is checking out or simply browsing their cart.
  let checkoutState = 'cart-view';

  // --- Toast Notification System ---
  // A simple, friendly way to display status updates, successes, and warnings to our shoppers.
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Fetch and Render Catalog ---
  // Let's retrieve products from our database based on search terms, categories, and sorting choice.
  async function fetchProducts() {
    try {
      let url = '/api/products?';
      if (selectedCategory !== 'all') url += `category=${encodeURIComponent(selectedCategory)}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (currentSort !== 'default') url += `sort=${currentSort}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch products');
      products = await res.json();
      renderProducts();
    } catch (err) {
      console.error(err);
      showToast("We couldn't load the product catalog right now. Please try again soon.", 'error');
    }
  }

  // We draw each product card on the screen.
  function renderProducts() {
    if (products.length === 0) {
      productsGrid.innerHTML = `
        <div class="empty-cart-msg" style="grid-column: 1 / -1; padding: 40px 0;">
          <i class="fa-solid fa-box-open"></i>
          <p>No products found matching filters.</p>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = products.map(product => {
      let stockStatusClass = 'stock-instock';
      let stockText = 'IN_STOCK';
      let isOut = false;

      if (product.stock === 0) {
        stockStatusClass = 'stock-out';
        stockText = 'OUT_OF_STOCK';
        isOut = true;
      } else if (product.stock <= 5) {
        stockStatusClass = 'stock-low';
        stockText = `LOW_STOCK: ${product.stock} LEFT`;
      }

      // Check if product is in cart to disable or show quantities
      const cartItem = cart.items.find(item => item.product_id === product.id);
      const inCartQty = cartItem ? cartItem.quantity : 0;
      const isMaxed = inCartQty >= product.stock;

      return `
        <div class="product-card">
          <span class="category-badge">${product.category}</span>
          <span class="stock-badge ${stockStatusClass}">${stockText}</span>
          <div class="product-image-wrapper">
            <img src="${product.image_path}" alt="${product.name}" class="product-image">
          </div>
          <div class="product-details">
            <h4 class="product-name">${product.name}</h4>
            <p class="product-description">${product.description}</p>
            <div class="product-footer">
              <span class="product-price">$${product.price.toFixed(2)}</span>
              <button 
                class="btn btn-primary add-to-cart-btn" 
                data-id="${product.id}"
                ${isOut || isMaxed ? 'disabled' : ''}
              >
                ${isOut ? 'OUT OF STOCK' : isMaxed ? 'MAX IN CART' : 'ADD TO CART'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to all the Add to Cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        addToCart(id);
      });
    });
  }

  // --- Stateful Cart Actions & Sync ---
  // We fetch the current items in the cart and update our user interface.
  async function fetchCart() {
    try {
      const res = await fetch('/api/cart');
      if (!res.ok) throw new Error('Failed to fetch cart');
      cart = await res.json();
      updateCartUI();
    } catch (err) {
      console.error(err);
      showToast("We had trouble updating your cart. Let's try again.", 'error');
    }
  }

  // Let's add an item or increment its quantity in the cart.
  async function addToCart(productId) {
    const cartItem = cart.items.find(item => item.product_id === productId);
    const newQty = cartItem ? cartItem.quantity + 1 : 1;
    await updateCartQty(productId, newQty);
  }

  // Send an update to the server with the new quantity for a product.
  async function updateCartQty(productId, quantity) {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update cart');
      }
      showToast(quantity === 0 ? 'Item removed from your cart.' : 'Your cart is up to date!');
      await fetchCart();
      await fetchProducts(); // Refresh stocks/buttons on catalog
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  // Completely delete an item from the cart.
  async function removeCartItem(productId) {
    try {
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove item');
      showToast('Item removed from your cart.');
      await fetchCart();
      await fetchProducts();
    } catch (err) {
      console.error(err);
      showToast("We couldn't remove that item. Please try again.", 'error');
    }
  }

  // Draw the shopping cart sidebar with the latest contents.
  function updateCartUI() {
    // Update badge counter
    cartCountBadge.textContent = cart.totalItems;

    // Render sidebar cart items
    if (cart.items.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="empty-cart-msg">
          <i class="fa-solid fa-cart-arrow-down"></i>
          <p>YOUR_CART_IS_EMPTY</p>
        </div>
      `;
      cartSubtotal.textContent = '$0.00';
      cartTotal.textContent = '$0.00';
      proceedToCheckoutBtn.disabled = true;
      setCheckoutState('cart-view');
      return;
    }

    proceedToCheckoutBtn.disabled = false;
    cartItemsContainer.innerHTML = cart.items.map(item => `
      <div class="cart-item">
        <img src="${item.image_path}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-details">
          <h5 class="cart-item-name">${item.name}</h5>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn dec-qty-btn" data-id="${item.product_id}">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn inc-qty-btn" data-id="${item.product_id}" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
            <button class="remove-item-btn" data-id="${item.product_id}">REMOVE</button>
          </div>
        </div>
      </div>
    `).join('');

    cartSubtotal.textContent = `$${cart.totalPrice.toFixed(2)}`;
    cartTotal.textContent = `$${cart.totalPrice.toFixed(2)}`;

    // Add listeners to cart item controls (increment, decrement, and delete)
    document.querySelectorAll('.dec-qty-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        const item = cart.items.find(i => i.product_id === id);
        updateCartQty(id, item.quantity - 1);
      });
    });

    document.querySelectorAll('.inc-qty-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        const item = cart.items.find(i => i.product_id === id);
        updateCartQty(id, item.quantity + 1);
      });
    });

    document.querySelectorAll('.remove-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        removeCartItem(id);
      });
    });
  }

  // --- Checkout State Machine Transitions ---
  // Switch back and forth between viewing the shopping cart and inputting shipping info.
  function setCheckoutState(state) {
    checkoutState = state;
    if (state === 'checkout-view') {
      cartActionsContainer.classList.add('hidden');
      checkoutForm.classList.remove('hidden');
    } else {
      cartActionsContainer.classList.remove('hidden');
      checkoutForm.classList.add('hidden');
    }
  }

  proceedToCheckoutBtn.addEventListener('click', () => {
    setCheckoutState('checkout-view');
  });

  cancelCheckoutBtn.addEventListener('click', () => {
    setCheckoutState('cart-view');
  });

  // Handle the submission of the checkout form.
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const phone = document.getElementById('customer-phone').value;
    const address = document.getElementById('customer-address').value;
 
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      showToast(`Thank you! Your order #${data.orderId} has been placed successfully.`);
      checkoutForm.reset();
      setCheckoutState('cart-view');
      closeCart();

      // View confirmation
      showOrderTrackingDetails(data.orderId);
      trackModal.classList.remove('hidden');

      // Refresh data states
      await fetchCart();
      await fetchProducts();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  });

  // --- Sidebar Open/Close handlers ---
  function openCart() {
    cartSidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  }

  function closeCart() {
    cartSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    setCheckoutState('cart-view');
  }

  cartToggleBtn.addEventListener('click', openCart);
  cartCloseBtn.addEventListener('click', closeCart);
  sidebarOverlay.addEventListener('click', closeCart);

  // --- Filtering & Searching Events ---
  filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      filterChips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      selectedCategory = e.target.dataset.category;
      fetchProducts();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    fetchProducts();
  });

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    fetchProducts();
  });

  // --- Order Tracking Modal ---
  trackOrderBtn.addEventListener('click', () => {
    trackModal.classList.remove('hidden');
    resetTrackingModal();
  });

  closeTrackBtn.addEventListener('click', () => {
    trackModal.classList.add('hidden');
  });

  trackModal.addEventListener('click', (e) => {
    if (e.target === trackModal) {
      trackModal.classList.add('hidden');
    }
  });

  function resetTrackingModal() {
    trackStep1.classList.remove('hidden');
    trackStep2.classList.add('hidden');
    orderDetailsResult.classList.add('hidden');
    trackOrderIdInput.value = '';
    trackOtpCodeInput.value = '';
  }

  // Request a simulated verification code (OTP) for the order.
  requestOtpBtn.addEventListener('click', async () => {
    const orderId = trackOrderIdInput.value;
    if (!orderId) {
      showToast('Please enter a valid Order ID so we can find your order.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/request-otp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request OTP');

      // Transition to Step 2
      trackStep1.classList.add('hidden');
      trackStep2.classList.remove('hidden');
      otpDestinationMsg.innerHTML = `OTP code sent. Please check your contact details:<br>
        <strong>Email:</strong> ${data.obscuredEmail}<br>
        <strong>Phone:</strong> ${data.obscuredPhone}<br>
        <span style="font-size: 11px; color: var(--primary);">[Simulated in Node.js server console]</span>`;
      trackOtpCodeInput.focus();
      showToast('A verification code has been sent.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  });

  backToStep1Btn.addEventListener('click', () => {
    trackStep2.classList.add('hidden');
    trackStep1.classList.remove('hidden');
  });

  // Verify the verification code typed by the customer.
  verifyOtpBtn.addEventListener('click', async () => {
    const orderId = trackOrderIdInput.value;
    const otp = trackOtpCodeInput.value;

    if (!otp || otp.length !== 6) {
      showToast('Please enter the 6-digit code sent to you.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Success - show order details
      trackStep2.classList.add('hidden');
      renderOrderTrackingDetails(data);
      showToast('Verification successful!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  });

  // Draw the tracking details table once verified.
  function renderOrderTrackingDetails(data) {
    orderDetailsResult.innerHTML = `
      <div class="order-meta-info">
        <div class="order-meta-row">
          <span class="mono-label">ORDER_ID:</span>
          <span class="accent-text">#${data.order.id}</span>
        </div>
        <div class="order-meta-row">
          <span class="mono-label">STATUS:</span>
          <span class="accent-text" style="color: var(--primary); font-weight: bold;">${data.order.status}</span>
        </div>
        <div class="order-meta-row">
          <span class="mono-label">TOTAL:</span>
          <span class="accent-text">$${data.order.total_price.toFixed(2)}</span>
        </div>
        <div class="order-meta-row">
          <span class="mono-label">SHIPPING_TO:</span>
          <span>${data.order.customer_name}</span>
        </div>
        <div class="order-meta-row">
          <span class="mono-label">ADDRESS:</span>
          <span style="font-size: 11px;">${data.order.shipping_address}</span>
        </div>
      </div>
      <div class="order-items-summary">
        <span class="mono-label">// ORDERED_ITEMS</span>
        ${data.items.map(item => `
          <div class="order-item-row">
            <img src="${item.image_path}" class="order-item-thumb">
            <div class="order-item-desc">
              <div class="order-item-title">${item.name}</div>
              <div class="order-item-qty">QTY: ${item.quantity} @ $${item.price.toFixed(2)}</div>
            </div>
            <div class="order-item-subtotal">$${(item.quantity * item.price).toFixed(2)}</div>
          </div>
        `).join('')}
      </div>
    `;
    orderDetailsResult.classList.remove('hidden');
  }

  // Immediate modal verification on checkout success.
  async function showOrderTrackingDetails(orderId) {
    trackOrderIdInput.value = orderId;
    trackStep1.classList.add('hidden');
    trackStep2.classList.remove('hidden');
    try {
      const res = await fetch(`/api/orders/${orderId}/request-otp`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        otpDestinationMsg.innerHTML = `Order placed successfully! Check console for simulated OTP code:<br>
          <strong>Email:</strong> ${data.obscuredEmail}<br>
          <strong>Phone:</strong> ${data.obscuredPhone}`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // --- Initial Launch Setup ---
  // When the page first loads, we fetch the cart and products to populate the page.
  fetchCart();
  fetchProducts();
});
