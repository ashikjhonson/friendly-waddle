/**
 * Created by Ashik on 24/05/2023
 */
require('dotenv').config();
const mysql = require('mysql')

const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
})

const createDB = 'CREATE DATABASE IF NOT EXISTS '+process.env.DB_DATABASE;
conn.query(createDB);

// users
let table = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.users (
  u_id INT NOT NULL AUTO_INCREMENT,
  Name VARCHAR(60) NOT NULL,
  Email VARCHAR(100) NOT NULL,
  Password VARCHAR(255) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  About varchar(255) DEFAULT NULL,
  PRIMARY KEY (u_id));`;
conn.query(table);

// questions
table = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.questions (
  q_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question TEXT NOT NULL,
  u_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  answered INT NOT NULL DEFAULT 0,
  name VARCHAR(60),
  replies int DEFAULT 0
);`;
conn.query(table);

// posts
table = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.posts (
  p_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question TEXT,
  answer TEXT,
  u_id INT NOT NULL,
  q_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  likes INT DEFAULT 0,
  name VARCHAR(60),
  About varchar(255) DEFAULT NULL)`;
conn.query(table);

// comments
table = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.comments (
  c_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  comment TEXT,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(60));`;
conn.query(table);

// likes
table = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.likes (
  p_id int NOT NULL,
  u_id int NOT NULL
)`;
conn.query(table);

console.log('Completed');

conn.end();