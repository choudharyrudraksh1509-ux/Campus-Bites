-- 01_schema.sql

CREATE DATABASE IF NOT EXISTS campusbite;
USE campusbite;

-- Users
CREATE TABLE Users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Student Profile
CREATE TABLE Student_Profile (
    user_id BIGINT PRIMARY KEY,
    reg_no VARCHAR(30) NOT NULL UNIQUE,
    hostel_area_id INT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Teacher Profile
CREATE TABLE Teacher_Profile (
    user_id BIGINT PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL UNIQUE,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Roles
CREATE TABLE Roles (
    role_id SMALLINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE User_Roles (
    user_id BIGINT NOT NULL,
    role_id SMALLINT NOT NULL,

    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES Roles(role_id) ON DELETE CASCADE
);

-- Area
CREATE TABLE Area (
    area_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- Shop
CREATE TABLE Shop (
    shop_id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    area_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,

    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',

    FOREIGN KEY (owner_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (area_id) REFERENCES Area(area_id) ON DELETE RESTRICT
);

-- Shop Staff
CREATE TABLE Shop_Staff (
    shop_id INT NOT NULL,
    staff_id BIGINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (shop_id, staff_id),
    FOREIGN KEY (shop_id) REFERENCES Shop(shop_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Shop Timing
CREATE TABLE Shop_Timing (
    timing_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shop_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,

    CHECK (day_of_week BETWEEN 0 AND 6),
    CHECK (open_time <> close_time),

    FOREIGN KEY (shop_id) REFERENCES Shop(shop_id) ON DELETE CASCADE
);

-- Category
CREATE TABLE Category (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    parent_category_id INT NULL,
    name VARCHAR(100) NOT NULL,

    FOREIGN KEY (parent_category_id) REFERENCES Category(category_id) ON DELETE SET NULL
);

-- Food Item
CREATE TABLE Food_Item (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    shop_id INT NOT NULL,
    category_id INT NOT NULL,

    name VARCHAR(140) NOT NULL,
    description VARCHAR(500),

    price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (price >= 0),

    FOREIGN KEY (shop_id) REFERENCES Shop(shop_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES Category(category_id) ON DELETE RESTRICT
);

-- Food Item Price History
CREATE TABLE Food_Item_Price_History (
    price_history_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP NULL,
    changed_by BIGINT NULL,

    CHECK (price >= 0),
    FOREIGN KEY (item_id) REFERENCES Food_Item(item_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- Orders
CREATE TABLE Orders (
    order_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    shop_id INT NOT NULL,

    status ENUM(
        'PAYMENT_PENDING',
        'PLACED',
        'PREPARING',
        'READY',
        'COMPLETED',
        'CANCELLED',
        'PAYMENT_FAILED'
    ) NOT NULL DEFAULT 'PAYMENT_PENDING',

    order_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,

    CHECK (total_amount >= 0),

    FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (shop_id) REFERENCES Shop(shop_id) ON DELETE RESTRICT
);

-- Order Items
CREATE TABLE Order_Items (
    order_item_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    item_id INT NOT NULL,

    quantity INT NOT NULL,
    price_at_order DECIMAL(10,2) NOT NULL,

    CHECK (quantity > 0),
    CHECK (price_at_order >= 0),

    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Food_Item(item_id) ON DELETE RESTRICT
);

-- Order Status History
CREATE TABLE Order_Status_History (
    history_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    changed_by BIGINT NULL,

    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- Payment Attempt
CREATE TABLE Payment_Attempt (
    payment_attempt_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,

    provider_name VARCHAR(50),
    provider_reference VARCHAR(150),

    amount DECIMAL(10,2) NOT NULL,
    status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (amount >= 0),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE RESTRICT
);

-- Review
CREATE TABLE Review (
    review_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    shop_id INT NOT NULL,

    rating TINYINT NOT NULL,
    comment VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (shop_id) REFERENCES Shop(shop_id) ON DELETE RESTRICT
);

-- Audit Log
CREATE TABLE Audit_Log (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,

    entity_name VARCHAR(80) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(80) NOT NULL,

    old_value JSON NULL,
    new_value JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL
);
