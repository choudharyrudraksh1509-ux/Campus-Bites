import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool to avoid creating a new connection for every request
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'campusbite_app',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'campusbite',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;
