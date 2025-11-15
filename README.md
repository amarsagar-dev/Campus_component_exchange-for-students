# Campus_component_exchange-for-students

 # 📚 DBMS Project – Campus Exchange  
A complete Database Management System project implementing full SQL database design, constraints, triggers, stored procedures, functions, and admin utilities.

---

## 📖 Overview  
Campus Exchange is a campus-based marketplace where students can list, buy, sell, and exchange products.  
This DBMS project includes:

- Full database schema  
- Data insertion  
- Triggers  
- Stored Procedures  
- Functions  
- Views  
- Transactions  
- ER Diagram + Normalized schema  

This project is fully tested and optimized for MySQL.

---

## 🏛 Database Features Implemented  

### ✔️ **1. Database Schema (DDL)**  
Includes the following tables:
- Users  
- Projects  
- Items  
- Orders  
- Categories  
- Feedback  
- Admin logs  
- Transaction history  

All tables include:
- Primary Keys  
- Foreign Keys  
- Unique constraints  
- Default values  
- Cascading delete/update  

---

### ✔️ **2. Triggers (DML Automation)**  
This project includes multiple MySQL triggers such as:

- **Insert Log Trigger** – Logs every new user registration  
- **Update Stock Trigger** – Automatically updates product quantity on order  
- **Feedback Validation Trigger** – Prevents inserting invalid review values  
- **Prevent Recursive Trigger Use** – Ensures safe operations  

Triggers follow MySQL safety rules (Error 1442 avoided).

---

### ✔️ **3. Stored Procedures**  
Reusable procedures for:

- Adding new items  
- Fetching user purchase history  
- Updating product details  
- Admin removing unwanted listings




project/
│
├── .vscode/
│
├── frontend/ 
│ ├── index.html
│ ├── style.css
│ └── app.js
│
├── node_modules/ 
│
├── .env 
│
├── package.json 
│
├── package-lock.json 
│
├── server.js 
│
├── tempCodeRunnerFile.js 
│
└── README.md 








