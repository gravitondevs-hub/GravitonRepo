import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("truckflow.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    bank_account TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'available', -- available, busy, maintenance
    location_lat REAL,
    location_lng REAL,
    last_service_date TEXT,
    odometer INTEGER DEFAULT 0,
    fuel_level INTEGER DEFAULT 100,
    owner_id INTEGER,
    plate_number TEXT,
    FOREIGN KEY(owner_id) REFERENCES owners(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    material TEXT,
    pickup_address TEXT,
    delivery_address TEXT,
    status TEXT DEFAULT 'pending', -- pending, scheduled, in_transit, delivered, cancelled
    truck_id INTEGER,
    driver_id INTEGER,
    price REAL,
    distance_km REAL DEFAULT 0,
    earnings_owner REAL DEFAULT 0, -- Amount the truck owner gets
    scheduled_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(truck_id) REFERENCES trucks(id),
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'unpaid', -- unpaid, paid, overdue
    due_date TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT, -- license, permit, insurance
    expiry_date TEXT,
    file_path TEXT
  );
`);

// Seed data if empty
const truckCount = db.prepare("SELECT COUNT(*) as count FROM trucks").get() as { count: number };
if (truckCount.count === 0) {
  db.prepare("INSERT INTO trucks (name, status, location_lat, location_lng, odometer) VALUES (?, ?, ?, ?, ?)").run("Truck 01", "available", -26.2041, 28.0473, 12500);
  db.prepare("INSERT INTO trucks (name, status, location_lat, location_lng, odometer) VALUES (?, ?, ?, ?, ?)").run("Truck 02", "available", -26.1076, 28.0567, 8400);
  db.prepare("INSERT INTO trucks (name, status, location_lat, location_lng, odometer) VALUES (?, ?, ?, ?, ?)").run("Truck 03", "maintenance", -26.2044, 28.0416, 45000);
  
  db.prepare("INSERT INTO drivers (name, phone, license_number) VALUES (?, ?, ?)").run("John Doe", "012-345-6789", "DL12345");
  db.prepare("INSERT INTO drivers (name, phone, license_number) VALUES (?, ?, ?)").run("Jane Smith", "098-765-4321", "DL67890");

  // Seed an owner
  db.prepare("INSERT INTO owners (name, email, phone, bank_account) VALUES (?, ?, ?, ?)").run("Mike Owner", "mike@example.com", "011-222-3333", "SA-BANK-12345");
  
  // Update Truck 01 to be owned by Mike
  db.prepare("UPDATE trucks SET owner_id = 1 WHERE id = 1").run();

  // Seed some jobs with distance and owner earnings
  db.prepare(`
    INSERT INTO jobs (customer_name, material, pickup_address, delivery_address, status, truck_id, driver_id, price, distance_km, earnings_owner, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("BuildIt Co.", "River Sand", "Quarry North", "Construction Site A", "delivered", 1, 1, 1250.00, 25.5, 1000.00, "2026-03-08");

  db.prepare(`
    INSERT INTO jobs (customer_name, material, pickup_address, delivery_address, status, truck_id, driver_id, price, distance_km, earnings_owner, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("City Roads Dept", "Crushed Stone", "Quarry South", "Main St Repair", "in_transit", 2, 2, 850.00, 15.2, 680.00, "2026-03-09");

  db.prepare(`
    INSERT INTO jobs (customer_name, material, pickup_address, delivery_address, status, price, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("Private Homeowner", "Topsoil", "Garden Center", "123 Oak Lane", "pending", 450.00, "2026-03-10");

  // Seed some invoices
  db.prepare("INSERT INTO invoices (job_id, amount, status, due_date) VALUES (?, ?, ?, ?)").run(1, 1250.00, "paid", "2026-03-15");
  db.prepare("INSERT INTO invoices (job_id, amount, status, due_date) VALUES (?, ?, ?, ?)").run(2, 850.00, "unpaid", "2026-03-20");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/dashboard/stats", (req, res) => {
    const totalJobs = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as any;
    const completedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'delivered'").get() as any;
    const activeTrucks = db.prepare("SELECT COUNT(*) as count FROM trucks WHERE status = 'busy'").get() as any;
    const revenue = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid'").get() as any;
    
    res.json({
      totalJobs: totalJobs.count,
      completedJobs: completedJobs.count,
      activeTrucks: activeTrucks.count,
      revenue: revenue.total || 0
    });
  });

  app.get("/api/trucks", (req, res) => {
    const trucks = db.prepare("SELECT * FROM trucks").all();
    res.json(trucks);
  });

  app.get("/api/jobs", (req, res) => {
    const jobs = db.prepare(`
      SELECT j.*, t.name as truck_name, d.name as driver_name 
      FROM jobs j
      LEFT JOIN trucks t ON j.truck_id = t.id
      LEFT JOIN drivers d ON j.driver_id = d.id
      ORDER BY j.created_at DESC
    `).all();
    res.json(jobs);
  });

  app.post("/api/jobs", (req, res) => {
    const { customer_name, material, pickup_address, delivery_address, price, scheduled_date } = req.body;
    const result = db.prepare(`
      INSERT INTO jobs (customer_name, material, pickup_address, delivery_address, price, scheduled_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customer_name, material, pickup_address, delivery_address, price, scheduled_date);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.patch("/api/jobs/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE jobs SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.get("/api/invoices", (req, res) => {
    const invoices = db.prepare(`
      SELECT i.*, j.customer_name 
      FROM invoices i
      JOIN jobs j ON i.job_id = j.id
    `).all();
    res.json(invoices);
  });

  // Owner Portal APIs
  app.post("/api/owners/enroll", (req, res) => {
    const { name, email, phone, bank_account, truck_name, plate_number } = req.body;
    
    try {
      const ownerResult = db.prepare(`
        INSERT INTO owners (name, email, phone, bank_account)
        VALUES (?, ?, ?, ?)
      `).run(name, email, phone, bank_account);
      
      const ownerId = ownerResult.lastInsertRowid;
      
      const truckResult = db.prepare(`
        INSERT INTO trucks (name, plate_number, owner_id, status)
        VALUES (?, ?, ?, 'available')
      `).run(truck_name, plate_number, ownerId);
      
      res.json({ success: true, ownerId, truckId: truckResult.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/owners/:id/stats", (req, res) => {
    const { id } = req.params;
    const stats = db.prepare(`
      SELECT 
        COUNT(j.id) as total_trips,
        SUM(j.distance_km) as total_distance,
        SUM(j.earnings_owner) as total_earnings,
        (SELECT COUNT(*) FROM trucks WHERE owner_id = ?) as truck_count
      FROM jobs j
      JOIN trucks t ON j.truck_id = t.id
      WHERE t.owner_id = ? AND j.status = 'delivered'
    `).get(id, id) as any;
    
    const recentTrips = db.prepare(`
      SELECT j.*, t.name as truck_name
      FROM jobs j
      JOIN trucks t ON j.truck_id = t.id
      WHERE t.owner_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5
    `).all(id);

    res.json({ ...stats, recentTrips });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
