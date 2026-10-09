-- 03_views.sql

USE campusbite;

-- Available Menu View
CREATE OR REPLACE VIEW vw_available_menu AS
SELECT
    fi.item_id,
    fi.shop_id,
    s.name AS shop_name,
    fi.name AS item_name,
    c.name AS category_name,
    fi.price
FROM Food_Item fi
JOIN Shop s ON fi.shop_id = s.shop_id
JOIN Category c ON fi.category_id = c.category_id
WHERE fi.is_available = TRUE;

-- Active Orders View (PLACED, PREPARING, READY)
CREATE OR REPLACE VIEW vw_active_orders AS
SELECT
    o.order_id,
    o.shop_id,
    s.name AS shop_name,
    o.customer_id,
    u.full_name AS customer_name,
    o.status,
    o.order_time,
    o.total_amount
FROM Orders o
JOIN Shop s ON o.shop_id = s.shop_id
JOIN Users u ON o.customer_id = u.user_id
WHERE o.status IN ('PLACED', 'PREPARING', 'READY');

-- Customer Order History View
CREATE OR REPLACE VIEW vw_customer_order_history AS
SELECT
    o.order_id,
    o.customer_id,
    s.shop_id,
    s.name AS shop_name,
    o.status,
    o.order_time,
    o.total_amount
FROM Orders o
JOIN Shop s ON o.shop_id = s.shop_id
ORDER BY o.order_time DESC;

-- Shop Rating View
CREATE OR REPLACE VIEW vw_shop_rating AS
SELECT
    shop_id,
    COUNT(review_id) AS total_reviews,
    ROUND(AVG(rating), 1) AS average_rating
FROM Review
GROUP BY shop_id;

-- Daily Shop Revenue View
CREATE OR REPLACE VIEW vw_daily_shop_revenue AS
SELECT
    shop_id,
    DATE(order_time) AS order_date,
    COUNT(order_id) AS total_orders,
    SUM(total_amount) AS daily_revenue
FROM Orders
WHERE status = 'COMPLETED'
GROUP BY shop_id, DATE(order_time);
