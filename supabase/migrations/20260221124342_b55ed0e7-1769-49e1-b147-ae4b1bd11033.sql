-- Clean all products and their category links
TRUNCATE TABLE product_category_links;
TRUNCATE TABLE job_items CASCADE;
DELETE FROM products;
