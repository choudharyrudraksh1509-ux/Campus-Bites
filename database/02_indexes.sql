-- 02_indexes.sql

USE campusbite;

-- Shop queries often filter by area
CREATE INDEX idx_shop_area ON Shop(area_id);

-- Customer browsing the menu
CREATE INDEX idx_food_shop_available ON Food_Item(shop_id, is_available);

-- Customer viewing order history
CREATE INDEX idx_orders_customer_time ON Orders(customer_id, order_time);

-- Staff dashboard finding pending/preparing orders
CREATE INDEX idx_orders_shop_status_time ON Orders(shop_id, status, order_time);

-- Fast lookup of items for an order
CREATE INDEX idx_order_items_order ON Order_Items(order_id);

-- Fast lookup for order timeline
CREATE INDEX idx_history_order_time ON Order_Status_History(order_id, changed_at);
