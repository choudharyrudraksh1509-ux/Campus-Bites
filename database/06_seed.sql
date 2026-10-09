-- 06_seed.sql

USE campusbite;

-- Create Users
INSERT INTO Users (full_name, email, password_hash, is_active) VALUES 
('Alice Customer', 'alice@vit.edu', '$2a$10$C8.6Gj3M.V1ZcQZ8VqYfzeX0iXh2M7M3gI/o1v4jB6F.yW.M8y0/K', TRUE), -- pass: password
('Bob Staff', 'bob@vit.edu', '$2a$10$C8.6Gj3M.V1ZcQZ8VqYfzeX0iXh2M7M3gI/o1v4jB6F.yW.M8y0/K', TRUE),
('Charlie Owner', 'charlie@vit.edu', '$2a$10$C8.6Gj3M.V1ZcQZ8VqYfzeX0iXh2M7M3gI/o1v4jB6F.yW.M8y0/K', TRUE);

-- Insert Roles
INSERT INTO Roles (role_name) VALUES ('CUSTOMER'), ('STAFF'), ('OWNER');
INSERT INTO User_Roles (user_id, role_id) VALUES (1, 1), (2, 2), (3, 3);

-- Create Area
INSERT INTO Area (name, description) VALUES ('Food Court 1', 'Main food court');

-- Create Shop
INSERT INTO Shop (owner_id, area_id, name, status) VALUES (3, 1, 'FC1 Bites', 'ACTIVE');

-- Assign Staff to Shop
INSERT INTO Shop_Staff (shop_id, staff_id) VALUES (1, 2);

-- Create Categories
INSERT INTO Category (name) VALUES ('Fast Food'), ('Beverages');

-- Create Food Items
INSERT INTO Food_Item (shop_id, category_id, name, description, price, is_available) VALUES 
(1, 1, 'Cheese Burger', 'Classic veg cheese burger', 80.00, TRUE),
(1, 2, 'Cold Coffee', 'Thick cold coffee with ice cream', 50.00, TRUE);
