# KRONOS // Tech & Desk Essentials

Welcome to **KRONOS**, a warm and cozy e-commerce store dedicated to premium tech and desk setup essentials. 

This repository houses a clean, single-page application built on a lightweight Node.js/Express backend and powered by an SQLite database. It features a conversational, humanized developer experience with friendly code comments, warm logs, and helpful error alerts.

---

## 🛠️ Tech Stack

- **Backend**: [Express.js](https://expressjs.com/) (Node.js framework)
- **Database**: [SQLite3](https://www.sqlite.org/) (for lightweight local storage)
- **Frontend**: Vanilla HTML5, CSS3, and modern Javascript (ES6+)
- **Icons & Fonts**: Font Awesome & Google Fonts (Outfit, JetBrains Mono)

---

## ✨ Features

- **Product Catalog**: Explore selected desk items with details, pricing, and stock status.
- **Dynamic Filters**: Sort products by price or filter them by category (Office, Electronics, Style) instantly without page reloads.
- **Stateful Shopping Cart**: Add products, adjust quantities, or remove items with automatic subtotal calculations.
- **Checkout Flow**: Complete shipping details and submit your order seamlessly.
- **Secure Order Tracking**: Track your orders via a secure Order ID and a simulated One-Time Password (OTP) verification code.
- **Humanized Codebase**: The internal codebase is designed to be friendly and approachable, featuring narrative code comments, helpful server startup logs, and conversational error notifications.

---

## 📂 Project Structure

```text
├── db.js                # Database initialization, schema setup, and catalog seeding
├── server.js            # Express API server, routes, and OTP generator simulation
├── package.json         # Project dependencies and script runner commands
├── public/              # Static files served to the web browser
│   ├── index.html       # Storefront and modal layout templates
│   ├── index.css        # Custom minimalist CSS design system
│   ├── index.js         # Frontend interactive states, rendering logic, and API client
│   └── images/          # Local product static assets
```

---

## 🚀 Getting Started

Follow these steps to run the application locally on your computer:

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 2. Start the Server
Launch the server in development mode:
```bash
npm run dev
```

You should see these friendly startup logs in your terminal:
```text
Server is up and running! Welcome to KRONOS at http://localhost:3005
Hello! We have successfully connected to our cozy SQLite database.
Database seeded successfully! We've populated it with some wonderful desk essentials for our customers.
```

### 3. Open the App
Open your browser and navigate to:
[http://localhost:3005](http://localhost:3005)

---

## 📬 Simulating OTP Verification
When you place an order or track it, the system will simulate sending a secure verification code (OTP). Since this is running locally, you can find your verification code printed directly in your terminal console logs:
```text
📩 [Simulating sending a notification to customer]
Hi! We are sending a secure verification code to the customer for Order #1.
Sending to: jo**@ex****** / +1 *******199
Your secure verification code is: 382901
```
Simply copy this 6-digit code and paste it into the tracking modal in your browser to verify and view the full order details.
