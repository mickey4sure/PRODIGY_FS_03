const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3005;

// We set up cross-origin resource sharing and JSON parsing, 
// and serve our static web files from the public folder.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. GET /api/products - Retrieve products with filtering and sorting
// This route helps users search, filter by category, and sort our products.
app.get('/api/products', (req, res) => {
  const { category, search, sort } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (sort === 'price_asc') {
    query += ' ORDER BY price ASC';
  } else if (sort === 'price_desc') {
    query += ' ORDER BY price DESC';
  } else {
    query += ' ORDER BY id ASC';
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "We ran into an issue retrieving the catalog. Please try again soon!" });
    }
    res.json(rows);
  });
});

// 2. GET /api/products/:id - Single product details
// Let's fetch details for a single specific item in our collection.
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "We had trouble loading the details for this product." });
    }
    if (!row) {
      return res.status(404).json({ error: "We couldn't find that product in our catalog." });
    }
    res.json(row);
  });
});

// 3. GET /api/cart - Get shopping cart items and calculated totals
// We retrieve what's currently in the shopping cart and calculate subtotals and totals.
app.get('/api/cart', (req, res) => {
  const query = `
    SELECT cart.product_id, cart.quantity, products.name, products.price, products.image_path, products.stock
    FROM cart
    JOIN products ON cart.product_id = products.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "We had trouble accessing your shopping cart." });
    }
    
    // We calculate the total items and the grand total price for the customer.
    let totalItems = 0;
    let totalPrice = 0;
    rows.forEach(item => {
      totalItems += item.quantity;
      totalPrice += item.price * item.quantity;
    });

    res.json({
      items: rows,
      totalItems,
      totalPrice: Number(totalPrice.toFixed(2))
    });
  });
});

// 4. POST /api/cart - Add / update item in cart
// This endpoint lets customers add items to their cart or change quantities.
app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    return res.status(400).json({ error: "We need both a product ID and a valid quantity to update your cart." });
  }

  // We make sure the product exists and check its stock before updating.
  db.get('SELECT stock FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      return res.status(500).json({ error: "We couldn't check the product stock. Please try again." });
    }
    if (!product) {
      return res.status(404).json({ error: "We couldn't find that product in our catalog." });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ error: `We only have ${product.stock} of this item left in stock.` });
    }

    if (quantity <= 0) {
      // If quantity is zero or less, we clean it up and remove it from the cart.
      db.run('DELETE FROM cart WHERE product_id = ?', [productId], function(err) {
        if (err) {
          return res.status(500).json({ error: "We ran into an issue removing this item from your cart." });
        }
        res.json({ message: 'Item removed from cart', changes: this.changes });
      });
    } else {
      // Otherwise, we insert the item or update the quantity.
      db.run(`
        INSERT INTO cart (product_id, quantity)
        VALUES (?, ?)
        ON CONFLICT(product_id) DO UPDATE SET quantity = ?
      `, [productId, quantity, quantity], function(err) {
        if (err) {
          return res.status(500).json({ error: "We had trouble saving your cart changes." });
        }
        res.json({ message: 'Cart updated', id: this.lastID });
      });
    }
  });
});

// 5. DELETE /api/cart/:productId - Remove item from cart
// Completely remove an item from the shopping cart.
app.delete('/api/cart/:productId', (req, res) => {
  db.run('DELETE FROM cart WHERE product_id = ?', [req.params.productId], function(err) {
    if (err) {
      return res.status(500).json({ error: "We couldn't remove the item from your cart. Please try again." });
    }
    res.json({ message: 'Item removed from cart', changes: this.changes });
  });
});

// We keep a temporary in-memory store for generated OTP verification codes.
const activeOtps = {};

// Helper to generate a friendly 6-digit secure code.
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Gentle utility to obscure sensitive email addresses when displayed.
function obscureEmail(email) {
  if (!email) return '';
  const parts = email.split('@');
  const name = parts[0];
  const domain = parts[1];
  return name.substring(0, 2) + '*'.repeat(Math.max(2, name.length - 2)) + '@' + domain.substring(0, 2) + '*'.repeat(Math.max(2, domain.length - 2));
}

// Gentle utility to obscure phone numbers for privacy.
function obscurePhone(phone) {
  if (!phone || phone === 'N/A') return 'N/A';
  return phone.substring(0, 3) + '*'.repeat(Math.max(2, phone.length - 6)) + phone.substring(phone.length - 3);
}

// 6. POST /api/checkout - Process the checkout and place the order
app.post('/api/checkout', (req, res) => {
  const { name, email, phone, address } = req.body;

  if (!name || !email || !phone || !address) {
    return res.status(400).json({ error: "Please fill out all the shipping and contact details so we know where to send your package." });
  }

  // We fetch the current items in the cart to compile the order.
  const query = `
    SELECT cart.product_id, cart.quantity, products.price, products.stock
    FROM cart
    JOIN products ON cart.product_id = products.id
  `;

  db.all(query, [], (err, cartItems) => {
    if (err) {
      return res.status(500).json({ error: "We had trouble reading your shopping cart." });
    }
    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Your cart is empty! Add a few items to your cart before checking out." });
    }

    // Double-check stock availability for each item to avoid disappointment.
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return res.status(400).json({ error: `Oops! We don't have enough stock left to fulfill this quantity.` });
      }
    }

    // Sum up the total price of all items in the cart.
    let totalPrice = 0;
    cartItems.forEach(item => {
      totalPrice += item.price * item.quantity;
    });
    totalPrice = Number(totalPrice.toFixed(2));

    // We process the order and update the stock within a transaction to ensure everything stays consistent.
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Create a new order record.
      db.run(`
        INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, total_price, status)
        VALUES (?, ?, ?, ?, ?, 'Processing')
      `, [name, email, phone, address, totalPrice], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: "We had trouble creating your order. Please try again." });
        }

        const orderId = this.lastID;

        // Add each cart item to the order items list and adjust the store stock.
        let errorOccurred = false;
        const stmtItem = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (?, ?, ?, ?)
        `);

        const stmtStock = db.prepare(`
          UPDATE products SET stock = stock - ? WHERE id = ?
        `);

        cartItems.forEach(item => {
          stmtItem.run(orderId, item.product_id, item.quantity, item.price, (err) => {
            if (err) errorOccurred = true;
          });
          stmtStock.run(item.quantity, item.product_id, (err) => {
            if (err) errorOccurred = true;
          });
        });

        stmtItem.finalize();
        stmtStock.finalize();

        if (errorOccurred) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: "We ran into an issue processing the items in your order." });
        }

        // Empty the cart since the order has been successfully placed.
        db.run('DELETE FROM cart', [], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: "We had trouble clearing your shopping cart." });
          }

          db.run('COMMIT');
          res.json({
            message: 'Order placed successfully',
            orderId,
            totalPrice
          });
        });
      });
    });
  });
});

// 7. POST /api/orders/:orderId/request-otp - Send an OTP code to track an order
app.post('/api/orders/:orderId/request-otp', (req, res) => {
  const { orderId } = req.params;
  db.get('SELECT customer_email, customer_phone FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: "We couldn't retrieve the details for this order." });
    }
    if (!order) {
      return res.status(404).json({ error: "We couldn't find an order with that ID." });
    }

    const otp = generateOtp();
    activeOtps[orderId] = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes validity
    };

    console.log(`\n📩 [Simulating sending a notification to customer]`);
    console.log(`Hi! We are sending a secure verification code to the customer for Order #${orderId}.`);
    console.log(`Sending to: ${order.customer_email} / ${order.customer_phone || 'N/A'}`);
    console.log(`Your secure verification code is: ${otp}`);
    console.log(`--------------------------------------------------\n`);

    res.json({
      message: 'OTP sent successfully',
      obscuredEmail: obscureEmail(order.customer_email),
      obscuredPhone: obscurePhone(order.customer_phone || 'N/A')
    });
  });
});

// 8. POST /api/orders/:orderId/verify-otp - Verify OTP and retrieve full order details
app.post('/api/orders/:orderId/verify-otp', (req, res) => {
  const { orderId } = req.params;
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({ error: "Please enter the verification code sent to you." });
  }

  const storedOtp = activeOtps[orderId];
  if (!storedOtp || storedOtp.code !== otp || Date.now() > storedOtp.expires) {
    return res.status(400).json({ error: "That verification code is either invalid or has expired. Let's try requesting a new one." });
  }

  // Clear OTP after successful verification to keep things secure.
  delete activeOtps[orderId];

  // Retrieve complete order details & items.
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: "We couldn't retrieve the details for this order." });
    }
    if (!order) {
      return res.status(404).json({ error: "We couldn't find an order with that ID." });
    }

    const query = `
      SELECT order_items.quantity, order_items.price, products.name, products.image_path
      FROM order_items
      JOIN products ON order_items.product_id = products.id
      WHERE order_items.order_id = ?
    `;

    db.all(query, [orderId], (err, items) => {
      if (err) {
        return res.status(500).json({ error: "We had trouble loading the items for this order." });
      }
      res.json({
        order,
        items
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is up and running! Welcome to KRONOS at http://localhost:${PORT}`);
});
