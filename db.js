const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');

// We open a connection to our local SQLite database. 
// If anything goes wrong, we'll log a friendly error message to help debug.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Oh no, we ran into an issue opening the database connection:', err);
  } else {
    console.log('Hello! We have successfully connected to our cozy SQLite database.');
  }
});

db.serialize(() => {
  // Let's set up the products table to store all the beautiful desk essentials in our store.
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      category TEXT,
      image_path TEXT
    )
  `);

  // Next, we create the cart table to remember what items our shoppers are interested in.
  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER UNIQUE,
      quantity INTEGER NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // We'll need an orders table to store customer shipping info and order details.
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'Processing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // This order items table connects specific products and quantities to each order.
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // Just in case our database already exists from an older version, 
  // we perform a gentle migration to add the phone number column if it's missing.
  db.run("ALTER TABLE orders ADD COLUMN customer_phone TEXT", (err) => {
    // If it's already there, SQLite will complain, but we can safely ignore it.
  });

  // To make sure our storefront always has the latest descriptions and local image paths,
  // we clean up existing catalog records and seed it fresh.
  db.run("DELETE FROM products", [], () => {
    const products = [
      {
        name: 'Minimalist Desk Organizer',
        description: 'An elegant warm oak desk organizer designed to hold your phone, keys, and writing utensils with a clean slot layout.',
        price: 49.99,
        stock: 15,
        category: 'Office',
        image_path: 'images/organizer.png'
      },
      {
        name: 'Studio Mechanical Keyboard',
        description: 'Hot-swappable keyboard with warm sand keycaps, quiet linear switches, and soft ambient cream backlighting.',
        price: 129.99,
        stock: 8,
        category: 'Electronics',
        image_path: 'images/keyboard.png'
      },
      {
        name: 'Terracotta Wool Felt Desk Mat',
        description: 'Soft wool felt desk mat in a beautiful terracotta hue, providing warmth and texture to any workstation setup.',
        price: 24.99,
        stock: 25,
        category: 'Style',
        image_path: 'images/mat.png'
      },
      {
        name: 'Ambient Warm Smart Lightstrip',
        description: '2-meter smart lightstrip specialized in warm light gradients, cozy yellows, and sunset simulation modes.',
        price: 39.99,
        stock: 12,
        category: 'Electronics',
        image_path: 'images/lightstrip.png'
      },
      {
        name: 'Ceramic Insulation Travel Tumbler',
        description: 'Double-walled ceramic travel tumbler with a leak-proof bamboo wooden lid, designed to match warm aesthetic spaces.',
        price: 34.99,
        stock: 20,
        category: 'Style',
        image_path: 'images/tumbler.png'
      },
      {
        name: 'Ergonomic Cork Wrist Rest',
        description: 'Made from 100% natural compressed cork. Naturally warm to the touch and contoured for typing comfort.',
        price: 19.99,
        stock: 30,
        category: 'Office',
        image_path: 'images/wristrest.png'
      }
    ];

    const stmt = db.prepare("INSERT INTO products (name, description, price, stock, category, image_path) VALUES (?, ?, ?, ?, ?, ?)");
    products.forEach((p) => {
      stmt.run(p.name, p.description, p.price, p.stock, p.category, p.image_path);
    });
    stmt.finalize();
    console.log("Database seeded successfully! We've populated it with some wonderful desk essentials for our customers.");
  });
});

module.exports = db;
