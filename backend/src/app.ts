import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

import apiRoutes from './routes';
import { ensureStallStaffSeeded } from './services/seedService';

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'CampusBite API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    try {
        await ensureStallStaffSeeded();
    } catch (err) {
        console.error('Failed to auto-seed stall staff on startup:', err);
    }
});

