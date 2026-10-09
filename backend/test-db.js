import mysql from 'mysql2/promise';

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'Harsh@051007'
        });
        const [rows] = await connection.query('SHOW DATABASES;');
        console.log("SUCCESS:", rows);
        connection.end();
    } catch (err) {
        console.error("ERROR:", err.message);
    }
}
test();
