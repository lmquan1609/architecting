CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  quantity INTEGER DEFAULT 0
);

INSERT INTO products (name, price, quantity) VALUES
  ('Laptop', 999.99, 10),
  ('Mouse', 29.99, 50),
  ('Keyboard', 79.99, 30);
