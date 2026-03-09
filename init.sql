CREATE DATABASE providers_db;

\c providers

CREATE TABLE providers (
  provider_id SERIAL PRIMARY KEY,
  provider_name VARCHAR(255) NOT NULL,
  provider_city VARCHAR(255) NOT NULL
);

INSERT INTO providers (provider_name, provider_city) VALUES
  ('Tech Solutions Inc', 'San Francisco'),
  ('Global Services Ltd', 'New York'),
  ('Innovation Partners', 'Austin');
