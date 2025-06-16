const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create PostgreSQL connection pool
const pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
});

// Test DB connection before starting the server
pool.connect()
    .then(() => {
        console.log('✅ DB connected');
        app.listen(PORT, () => {
            console.log(`🚀 Server is listening on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to connect to DB:', err);
        process.exit(1); // Exit if DB not connected
    });
