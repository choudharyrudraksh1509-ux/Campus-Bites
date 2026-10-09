-- 04_triggers.sql

USE campusbite;

DELIMITER //

-- Trigger: Order Status History
-- Automatically inserts a record into Order_Status_History when Orders.status changes.
CREATE TRIGGER after_order_status_update
AFTER UPDATE ON Orders
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO Order_Status_History (order_id, old_status, new_status, changed_at)
        VALUES (NEW.order_id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    END IF;
END //

-- Trigger: Price Audit
-- Automatically inserts a record into Food_Item_Price_History when Food_Item.price changes.
CREATE TRIGGER after_food_item_price_update
AFTER UPDATE ON Food_Item
FOR EACH ROW
BEGIN
    IF OLD.price <> NEW.price THEN
        -- Close the previous valid price interval
        UPDATE Food_Item_Price_History
        SET valid_to = CURRENT_TIMESTAMP
        WHERE item_id = OLD.item_id AND valid_to IS NULL;

        -- Insert the new price record
        INSERT INTO Food_Item_Price_History (item_id, price, valid_from)
        VALUES (NEW.item_id, NEW.price, CURRENT_TIMESTAMP);
    END IF;
END //

-- Trigger: Price Audit on Insert
-- Logs the initial price when a new food item is created.
CREATE TRIGGER after_food_item_insert
AFTER INSERT ON Food_Item
FOR EACH ROW
BEGIN
    INSERT INTO Food_Item_Price_History (item_id, price, valid_from)
    VALUES (NEW.item_id, NEW.price, CURRENT_TIMESTAMP);
END //

DELIMITER ;
