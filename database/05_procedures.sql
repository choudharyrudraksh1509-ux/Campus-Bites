-- 05_procedures.sql

USE campusbite;

DELIMITER //

-- Procedure: Change Order Status
-- Ensures authorized transitions and records audit history via triggers
CREATE PROCEDURE sp_change_order_status(
    IN p_order_id BIGINT,
    IN p_new_status VARCHAR(30),
    IN p_staff_id BIGINT
)
BEGIN
    DECLARE v_current_status VARCHAR(30);
    DECLARE v_shop_id INT;
    DECLARE v_is_authorized INT DEFAULT 0;

    -- Exit if any error occurs
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1. Find Order & Lock Row
    SELECT status, shop_id INTO v_current_status, v_shop_id
    FROM Orders
    WHERE order_id = p_order_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
    END IF;

    -- 2. Validate Staff Authorization
    SELECT COUNT(*) INTO v_is_authorized
    FROM Shop_Staff
    WHERE shop_id = v_shop_id AND staff_id = p_staff_id;

    IF v_is_authorized = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Staff not authorized for this shop';
    END IF;

    -- 3. Validate State Transition (Simplified logic)
    IF (v_current_status = 'PLACED' AND p_new_status = 'PREPARING') OR
       (v_current_status = 'PREPARING' AND p_new_status = 'READY') OR
       (v_current_status = 'READY' AND p_new_status = 'COMPLETED') THEN
       
        -- 4. Update order status (Trigger handles history insertion)
        UPDATE Orders
        SET status = p_new_status
        WHERE order_id = p_order_id;
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid state transition';
    END IF;

    COMMIT;
END //

DELIMITER ;
