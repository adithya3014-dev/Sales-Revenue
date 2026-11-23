USE sales_revenue_dashboard;

INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@salesdashboard.com', '$2b$12$X6C5s2i0K3H9R2S28M3dV.gV3Wl77FN7F9Igp5H9JKz3sGlmC0hJ6', 'admin'),
('Operations Manager', 'ops@salesdashboard.com', '$2b$12$X6C5s2i0K3H9R2S28M3dV.gV3Wl77FN7F9Igp5H9JKz3sGlmC0hJ6', 'manager');

INSERT INTO categories (category_name, description) VALUES
('Electronics', 'Consumer electronics and digital devices'),
('Furniture', 'Office and home furniture'),
('Accessories', 'Supplementary work and lifestyle accessories'),
('Office', 'Office consumables and work essentials');

INSERT INTO products (product_name, category, unit_price, stock_quantity) VALUES
('Laptop Pro 14', 'Electronics', 1699.00, 120),
('4K Monitor', 'Electronics', 750.00, 80),
('Smart Speaker', 'Electronics', 320.00, 140),
('Executive Desk', 'Furniture', 1300.00, 40),
('Webcam', 'Electronics', 160.00, 160),
('USB-C Hub', 'Accessories', 70.00, 200),
('Noise Cancelling Headset', 'Electronics', 410.00, 90),
('Tablet Pro', 'Electronics', 680.00, 75),
('Desk Organizer', 'Accessories', 62.00, 250),
('Standing Lamp', 'Furniture', 260.00, 120);

INSERT INTO customers (customer_name, customer_id, segment, region) VALUES
('Alicia N', 'CUST-101', 'Enterprise', 'North'),
('Michael S', 'CUST-102', 'SMB', 'West'),
('Emma R', 'CUST-103', 'Retail', 'East'),
('Priya D', 'CUST-104', 'Enterprise', 'South'),
('Jason P', 'CUST-105', 'SMB', 'Central');

INSERT INTO sales (order_id, order_date, product_name, product_category, quantity_sold, sales_revenue, unit_price, discount, customer_name, profit, promotion_details, region) VALUES
('SO-1001', '2024-01-04', 'Laptop Pro 14', 'Electronics', 2, 3299.00, 1649.50, 5.00, 'Alicia N', 890.00, 'Winter Launch', 'North'),
('SO-1002', '2024-01-18', 'Wireless Mouse', 'Accessories', 12, 720.00, 60.00, 8.00, 'Michael S', 190.00, 'New Year Offer', 'West'),
('SO-1003', '2024-02-06', 'Office Chair', 'Furniture', 5, 2100.00, 420.00, 10.00, 'Rita K', 620.00, 'Office Upgrade', 'South'),
('SO-1004', '2024-02-16', '4K Monitor', 'Electronics', 4, 2800.00, 700.00, 12.00, 'David T', 760.00, 'Product Bundles', 'Central'),
('SO-1005', '2024-03-02', 'Ergonomic Keyboard', 'Accessories', 9, 990.00, 110.00, 7.00, 'Emma R', 225.00, 'Spring Sale', 'East');

INSERT INTO model_metrics (model_name, mae, rmse, mape, evaluation_period) VALUES
('Linear Regression', 4821.0000, 6190.0000, 11.9000, '12 Month Window'),
('Random Forest', 2640.0000, 3580.0000, 7.4000, '12 Month Window'),
('Time-Series Model', 3480.0000, 4700.0000, 9.1000, '12 Month Window');
