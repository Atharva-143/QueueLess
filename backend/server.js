require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

// Prevent simultaneous queue operations for the same service
const serviceLocks = new Map();

function withServiceLock(serviceId, operation) {
    const key = String(serviceId);
    const previous = serviceLocks.get(key) || Promise.resolve();

    const current = previous
        .catch(() => { })
        .then(operation);

    serviceLocks.set(key, current);

    return current.finally(() => {
        if (serviceLocks.get(key) === current) {
            serviceLocks.delete(key);
        }
    });
}

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.use(cors({
    origin: "http://localhost:5173"
}));
app.use(express.json());

// Rate limit for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // Maximum 10 requests per IP per window
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many authentication attempts. Please try again later."
    }
});

const queueLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many queue requests. Please try again later."
    }
});

// ===============================
// JWT AUTHENTICATION MIDDLEWARE
// ===============================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Access token required."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({
                error: "Invalid or expired token."
            });
        }

        req.user = user;
        next();
    });
};

// ===============================
// ROLE-BASED AUTHORIZATION
// ===============================

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: "Access denied. Insufficient permissions."
            });
        }

        next();
    };
};

// ===============================
// USER REGISTRATION
// ===============================

app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name, email, password } = req.body;

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        name.trim().length === 0 ||
        name.trim().length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 254 ||
        Buffer.byteLength(password, "utf8") < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({
            error: "Enter a valid name, email address, and password between 8 and 72 bytes."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users
            (name, email, password_hash, role)
            VALUES (?, ?, ?, 'customer')
        `;

        db.query(
            sql,
            [name.trim(), email.trim(), hashedPassword],
            (error, result) => {
                if (error) {
                    if (error.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            error: "Email already registered."
                        });
                    }

                    console.error("Registration error:", error);

                    return res.status(500).json({
                        error: "Failed to register user."
                    });
                }

                res.status(201).json({
                    message: "User registered successfully.",
                    userId: result.insertId
                });
            }
        );
    } catch (error) {
        console.error("Password hashing error:", error);

        res.status(500).json({
            error: "Failed to register user."
        });
    }
});

// ===============================
// USER LOGIN
// ===============================

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required."
        });
    }

    const sql = `
        SELECT id, name, email, password_hash, role
        FROM users
        WHERE email = ?
    `;

    db.query(sql, [email.trim()], async (error, results) => {
        if (error) {
            console.error("Login database error:", error);

            return res.status(500).json({
                error: "Login failed."
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const user = results[0];

        try {
            const passwordMatch = await bcrypt.compare(
                password,
                user.password_hash
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    error: "Invalid email or password."
                });
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    role: user.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );

            res.json({
                message: "Login successful.",
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error("Login error:", error);

            res.status(500).json({
                error: "Login failed."
            });
        }
    });
});

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "queueless"
});

// ===============================
// PROTECTED USER TEST
// ===============================

app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({
        message: "Authentication successful.",
        user: req.user
    });
});

// ===============================
// STAFF / ADMIN TEST
// ===============================

app.get(
    "/api/auth/staff-test",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    (req, res) => {
        res.json({
            message: "Staff/Admin access successful.",
            user: req.user
        });
    }
);

// ===============================
// ADMIN TEST
// ===============================

app.get(
    "/api/auth/admin-test",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        res.json({
            message: "Admin access successful.",
            user: req.user
        });
    }
);


db.connect((err) => {
    if (err) {
        console.log("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully!");
});

app.get("/", (req, res) => {
    db.query("SELECT DATABASE() AS database_name", (err, result) => {
        if (err) {
            console.error("Database check failed:", err);

            return res.status(500).json({
                error: "Internal server error."
            });
        }

        res.json(result);
    });
});


// =========================
// SERVICES
// =========================

app.get("/api/services", (req, res) => {
    db.query("SELECT * FROM services", (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
                error: "Internal server error."
            });
        }

        res.json(result);
    });
});

app.post("/api/services", authenticateToken, authorizeRoles("admin"), (req, res) => {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).json({
            error: "Service name is required"
        });
    }

    const sql = `
        INSERT INTO services (name, description)
        VALUES (?, ?)
    `;

    db.query(
        sql,
        [name.trim(), description || null],
        (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                    error: "Internal server error."
                });
            }

            res.status(201).json({
                message: "Service added successfully",
                serviceId: result.insertId
            });
        }
    );
});


// =========================
// CUSTOMER JOINS QUEUE
// =========================

app.post("/api/queue", queueLimiter, (req, res) => {
    const { service_id, customer_name } = req.body;

    if (
        service_id === null ||
        service_id === undefined ||
        !Number.isInteger(Number(service_id)) ||
        Number(service_id) <= 0 ||
        String(service_id).trim() === "" ||
        !customer_name ||
        typeof customer_name !== "string" ||
        customer_name.trim() === "" ||
        customer_name.trim().length > 100
    ) {
        return res.status(400).json({
            error: "Invalid service ID or customer name. Name must be between 1 and 100 characters."
        });
    }

    // Verify that the requested service exists and is active.
    const serviceSql = `
        SELECT id
        FROM services
        WHERE id = ? AND is_active = 1
    `;

    db.query(serviceSql, [service_id], (err, serviceResult) => {
        if (err) {
            console.error("Service validation error:", err);
            return res.status(500).json({
                error: "Unable to validate service"
            });
        }

        if (serviceResult.length === 0) {
            return res.status(404).json({
                error: "Service not found or inactive"
            });
        }

        const tokenSql = `
            SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
            FROM queue_entries
            WHERE service_id = ?
        `;

        db.query(tokenSql, [service_id], (err, tokenResult) => {
            if (err) {
                console.error("Token generation error:", err);
                return res.status(500).json({
                    error: "Unable to generate queue token"
                });
            }

            const tokenNumber = tokenResult[0].next_token;

            const insertSql = `
                INSERT INTO queue_entries
                (service_id, token_number, customer_name)
                VALUES (?, ?, ?)
            `;

            db.query(
                insertSql,
                [service_id, tokenNumber, customer_name.trim()],
                (err, result) => {
                    if (err) {
                        console.error("Queue insertion error:", err);
                        return res.status(500).json({
                            error: "Unable to join queue"
                        });
                    }

                    io.emit("queueUpdated", {
                        serviceId: Number(service_id)
                    });

                    return res.status(201).json({
                        message: "Joined queue successfully",
                        queueId: result.insertId,
                        tokenNumber: tokenNumber
                    });
                }
            );
        });
    });
});


// =========================
// GET QUEUE
// =========================

app.get("/api/queue/:service_id", (req, res) => {
    const { service_id } = req.params;

    if (!/^\d+$/.test(service_id) || Number(service_id) <= 0) {
        return res.status(400).json({
            error: "Invalid service ID."
        });
    }

    const sql = `
    SELECT
        id,
        token_number,
        status,
        joined_at,
        serving_started_at,
        completed_at
    FROM queue_entries
    WHERE service_id = ?
    AND status IN ('waiting', 'serving')
    ORDER BY token_number ASC
    `;

    db.query(sql, [service_id], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
                error: "Internal server error."
            });
        }

        res.json(result);
    });
});


// =========================
// SERVE NEXT CUSTOMER
// =========================

app.post(
    "/api/queue/:service_id/serve-next",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    (req, res) => {
        const { service_id } = req.params;

        withServiceLock(service_id, () => {
            return new Promise((resolve) => {

                // Check if someone is already being served
                const servingSql = `
                    SELECT id, token_number, customer_name
                    FROM queue_entries
                    WHERE service_id = ?
                    AND status = 'serving'
                    LIMIT 1
                `;

                db.query(servingSql, [service_id], (err, servingResult) => {
                    if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                            error: "Internal server error."
                        });
                    }

                    if (servingResult.length > 0) {
                        res.status(400).json({
                            error: `Token #${servingResult[0].token_number} is currently being served.`
                        });
                        return resolve();
                    }

                    // Find the first waiting customer
                    const findNextSql = `
                        SELECT id, token_number, customer_name
                        FROM queue_entries
                        WHERE service_id = ?
                        AND status = 'waiting'
                        ORDER BY token_number ASC
                        LIMIT 1
                    `;

                    db.query(findNextSql, [service_id], (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            res.status(500).json({ error: "Internal server error." });
                            return resolve();
                        }

                        if (result.length === 0) {
                            res.status(404).json({
                                error: "No waiting customers in the queue."
                            });
                            return resolve();
                        }

                        const nextCustomer = result[0];

                        // Mark the customer as serving
                        const updateSql = `
                            UPDATE queue_entries
                            SET
                                status = 'serving',
                                serving_started_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            AND status = 'waiting'
                        `;

                        db.query(updateSql, [nextCustomer.id], (err, updateResult) => {
                            if (err) {
                                console.error("Database error:", err);
                                res.status(500).json({ error: "Internal server error." });
                                return resolve();
                            }

                            if (updateResult.affectedRows === 0) {
                                res.status(409).json({
                                    error: "Queue status changed. Please try again."
                                });
                                return resolve();
                            }

                            // Notify connected clients
                            io.emit("queueUpdated", {
                                serviceId: Number(service_id)
                            });

                            res.json({
                                message: "Customer is now being served",
                                tokenNumber: nextCustomer.token_number,
                                customerName: nextCustomer.customer_name
                            });

                            resolve();
                        });
                    });
                });
            });
        }).catch((err) => {
            console.error("Serve-next operation failed:", err);

            if (!res.headersSent) {
                res.status(500).json({
                    error: "Unable to process the next customer."
                });
            }
        });
    }
);


// =========================
// COMPLETE CURRENT CUSTOMER
// =========================

app.post(
    "/api/queue/:service_id/complete-current",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    (req, res) => {
        const { service_id } = req.params;

        withServiceLock(service_id, () => {
            return new Promise((resolve) => {

                const findServingSql = `
                    SELECT id, token_number, customer_name
                    FROM queue_entries
                    WHERE service_id = ?
                    AND status = 'serving'
                    LIMIT 1
                `;

                db.query(findServingSql, [service_id], (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        res.status(500).json({ error: "Internal server error." });
                        return resolve();
                    }

                    if (result.length === 0) {
                        res.status(404).json({
                            error: "No customer is currently being served."
                        });
                        return resolve();
                    }

                    const currentCustomer = result[0];

                    const updateSql = `
                        UPDATE queue_entries
                        SET
                            status = 'completed',
                            completed_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        AND status = 'serving'
                    `;

                    db.query(updateSql, [currentCustomer.id], (err, updateResult) => {
                        if (err) {
                            console.error("Database error:", err);
                            res.status(500).json({ error: "Internal server error." });
                            return resolve();
                        }

                        if (updateResult.affectedRows === 0) {
                            res.status(409).json({
                                error: "Queue status changed. Please try again."
                            });
                            return resolve();
                        }

                        io.emit("queueUpdated", {
                            serviceId: Number(service_id)
                        });

                        res.json({
                            message: "Customer completed successfully",
                            tokenNumber: currentCustomer.token_number,
                            customerName: currentCustomer.customer_name
                        });

                        resolve();
                    });
                });
            });
        }).catch((err) => {
            console.error("Complete-current operation failed:", err);

            if (!res.headersSent) {
                res.status(500).json({
                    error: "Unable to complete the current customer."
                });
            }
        });
    }
);

// =========================
// START SERVER
// =========================

app.get(
    "/api/queue/:service_id/statistics",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    (req, res) => {
        const { service_id } = req.params;

        const sql = `
        SELECT
            COUNT(CASE WHEN status = 'waiting' THEN 1 END) AS people_waiting,

            COUNT(CASE WHEN status = 'serving' THEN 1 END) AS currently_serving,

            COUNT(
                CASE
                    WHEN status = 'completed'
                    AND DATE(completed_at) = CURDATE()
                    THEN 1
                END
            ) AS completed_today,

            COALESCE(
                ROUND(
                    AVG(
                        TIMESTAMPDIFF(
                            SECOND,
                            serving_started_at,
                            completed_at
                        )
                    ) / 60,
                    1
                ),
                0
            ) AS average_service_time

        FROM queue_entries
        WHERE service_id = ?
    `;

        db.query(sql, [service_id], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                    error: "Internal server error."
                });
            }

            res.json(result[0]);
        });
    });

// ===============================
// ADMIN ANALYTICS
// ===============================

app.get(
    "/api/admin/analytics",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {

        const dashboardSql = `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM services
                    WHERE is_active = 1
                ) AS total_services,

                (
                    SELECT COUNT(*)
                    FROM users
                    WHERE role = 'customer'
                ) AS total_customers,

                (
                    SELECT COUNT(*)
                    FROM queue_entries
                    WHERE status = 'waiting'
                ) AS waiting_now,

                (
                    SELECT COUNT(*)
                    FROM queue_entries
                    WHERE status = 'serving'
                ) AS currently_serving,

                (
                    SELECT COUNT(*)
                    FROM queue_entries
                    WHERE status = 'completed'
                    AND DATE(completed_at) = CURDATE()
                ) AS completed_today,

                (
                    SELECT COUNT(*)
                    FROM queue_entries
                    WHERE DATE(joined_at) = CURDATE()
                ) AS total_tokens_today,

                (
                    SELECT COALESCE(
                        ROUND(
                            AVG(
                                TIMESTAMPDIFF(
                                    SECOND,
                                    serving_started_at,
                                    completed_at
                                )
                            ) / 60,
                            1
                        ),
                        0
                    )
                    FROM queue_entries
                    WHERE status = 'completed'
                    AND serving_started_at IS NOT NULL
                    AND completed_at IS NOT NULL
                ) AS average_service_time
        `;

        const serviceSql = `
            SELECT
                s.id,
                s.name,

                COUNT(
                    CASE
                        WHEN q.status = 'waiting'
                        THEN 1
                    END
                ) AS waiting_count,

                COUNT(
                    CASE
                        WHEN q.status = 'serving'
                        THEN 1
                    END
                ) AS serving_count,

                COUNT(q.id) AS total_tokens

            FROM services s

            LEFT JOIN queue_entries q
                ON s.id = q.service_id

            GROUP BY
                s.id,
                s.name

            ORDER BY s.id ASC
        `;

        db.query(dashboardSql, (error, dashboardResult) => {
            if (error) {
                console.error(
                    "Admin dashboard analytics error:",
                    error
                );

                return res.status(500).json({
                    error: "Failed to fetch admin analytics."
                });
            }

            db.query(serviceSql, (error, serviceResult) => {
                if (error) {
                    console.error(
                        "Service analytics error:",
                        error
                    );

                    return res.status(500).json({
                        error: "Failed to fetch service analytics."
                    });
                }

                res.json({
                    dashboard: dashboardResult[0],
                    services: serviceResult
                });
            });
        });
    }
);


// Admin: Get completed customer history
app.get(
    "/api/admin/completed-history",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        const { service_id, date, search } = req.query;

        let sql = `
            SELECT
                q.id,
                q.token_number,
                q.customer_name,
                q.status,
                q.joined_at,
                q.serving_started_at,
                q.completed_at,
                s.name AS service_name
            FROM queue_entries q
            INNER JOIN services s
                ON q.service_id = s.id
            WHERE q.status = 'completed'
        `;

        const params = [];

        if (service_id) {
            sql += ` AND q.service_id = ?`;
            params.push(service_id);
        }

        if (date) {
            sql += ` AND DATE(q.completed_at) = ?`;
            params.push(date);
        }

        if (search && search.trim() !== "") {
            sql += ` AND (
                q.customer_name LIKE ?
                OR CAST(q.token_number AS CHAR) LIKE ?
            )`;

            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }

        sql += ` ORDER BY q.completed_at DESC`;

        db.query(sql, params, (error, results) => {
            if (error) {
                console.error("Completed history error:", error);

                return res.status(500).json({
                    error: "Failed to fetch completed customer history."
                });
            }

            res.json(results);
        });
    }
);


server.listen(5000, () => {
    console.log("QueueLess backend running on port 5000");
});