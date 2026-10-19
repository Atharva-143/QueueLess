CREATE DATABASE IF NOT EXISTS queueless
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE queueless;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'staff', 'admin') DEFAULT 'customer',
    PRIMARY KEY (id),
    UNIQUE KEY email (email)
) ENGINE=InnoDB;

-- 2. Services
CREATE TABLE IF NOT EXISTS services (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 3. Queues
CREATE TABLE IF NOT EXISTS queues (
    id INT NOT NULL AUTO_INCREMENT,
    service_id INT NOT NULL,
    queue_date DATE NOT NULL,
    status ENUM('active', 'paused', 'closed') DEFAULT 'active',
    PRIMARY KEY (id),
    KEY service_id (service_id),
    CONSTRAINT queues_service_fk
        FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

-- 4. Counters
CREATE TABLE IF NOT EXISTS counters (
    id INT NOT NULL AUTO_INCREMENT,
    service_id INT NOT NULL,
    counter_number INT NOT NULL,
    status ENUM('available', 'busy', 'offline') DEFAULT 'available',
    PRIMARY KEY (id),
    KEY service_id (service_id),
    CONSTRAINT counters_service_fk
        FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

-- 5. Queue entries
CREATE TABLE IF NOT EXISTS queue_entries (
    id INT NOT NULL AUTO_INCREMENT,
    service_id INT NOT NULL,
    token_number INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    serving_started_at TIMESTAMP NULL DEFAULT NULL,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    is_test TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY service_id (service_id),
    CONSTRAINT queue_entries_service_fk
        FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

-- 6. Queue-counter mapping
CREATE TABLE IF NOT EXISTS queue_counters (
    id INT NOT NULL AUTO_INCREMENT,
    queue_id INT NOT NULL,
    counter_id INT NOT NULL,
    PRIMARY KEY (id),
    KEY queue_id (queue_id),
    KEY counter_id (counter_id),
    CONSTRAINT queue_counters_queue_fk
        FOREIGN KEY (queue_id) REFERENCES queues(id),
    CONSTRAINT queue_counters_counter_fk
        FOREIGN KEY (counter_id) REFERENCES counters(id)
) ENGINE=InnoDB;

-- 7. Tokens
CREATE TABLE IF NOT EXISTS tokens (
    id INT NOT NULL AUTO_INCREMENT,
    queue_id INT NOT NULL,
    user_id INT NOT NULL,
    token_number INT NOT NULL,
    status ENUM('waiting', 'serving', 'completed', 'cancelled')
        DEFAULT 'waiting',
    joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY queue_id (queue_id),
    KEY user_id (user_id),
    CONSTRAINT tokens_queue_fk
        FOREIGN KEY (queue_id) REFERENCES queues(id),
    CONSTRAINT tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 8. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    KEY token_id (token_id),
    CONSTRAINT notifications_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT notifications_token_fk
        FOREIGN KEY (token_id) REFERENCES tokens(id)
) ENGINE=InnoDB;

-- 9. Test data
CREATE TABLE IF NOT EXISTS test_data (
    id INT NOT NULL AUTO_INCREMENT,
    message VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB;