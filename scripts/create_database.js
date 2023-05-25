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

const usersTable = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.users (
  u_id INT NOT NULL AUTO_INCREMENT,
  Name VARCHAR(60) NOT NULL,
  Email VARCHAR(100) NOT NULL,
  Password VARCHAR(255) NOT NULL,
  PRIMARY KEY (u_id));`;
conn.query(usersTable);

const questionsTable = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.questions (
  q_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question TEXT NOT NULL,
  u_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered INT NOT NULL DEFAULT 0,
  name VARCHAR(60),
  FOREIGN KEY (u_id) REFERENCES users(u_id)
);`;
conn.query(questionsTable);

const postsTable = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.posts (
  p_id INT AUTO_INCREMENT PRIMARY KEY,
  question TEXT,
  answer TEXT,
  u_id INT,
  q_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  likes INT DEFAULT 0,
  dislikes INT DEFAULT 0,
  name VARCHAR(60),
  FOREIGN KEY (u_id) REFERENCES users(u_id),
  FOREIGN KEY (q_id) REFERENCES questions(q_id));`;
conn.query(postsTable);

const commentsTable = `
CREATE TABLE IF NOT EXISTS ${process.env.DB_DATABASE}.comments (
  c_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT,
  comment TEXT,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  likes INT DEFAULT 0,
  dislikes INT DEFAULT 0,
  name VARCHAR(60),
  FOREIGN KEY (post_id) REFERENCES posts(p_id),
  FOREIGN KEY (user_id) REFERENCES users(u_id));`;
conn.query(commentsTable);

console.log('Completed');

conn.end();