const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const expenseRoutes = require('../backend/routes/expenses');

require('dotenv').config({ path: './backend/.env' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

let mongoConnectionPromise = null;

function connectMongo() {
  if (!process.env.MONGODB_URI || mongoose.connection.readyState === 1) {
    return Promise.resolve();
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(process.env.MONGODB_URI)
      .catch(error => {
        console.error('MongoDB connection error:', error.message);
        mongoConnectionPromise = null;
      });
  }

  return mongoConnectionPromise;
}

app.use(async (req, res, next) => {
  await connectMongo();
  next();
});

app.get('/api', (req, res) => {
  res.json({ status: 'API is running' });
});

app.use('/api/expenses', expenseRoutes);

module.exports = app;
