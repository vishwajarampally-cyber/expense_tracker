const router = require('express').Router();
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Expense = require('../models/Expense');
const { analyzeBillImage, classifyExpense, CATEGORIES } = require('../services/grokClassifier');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'expenses.json');
let memoryExpenses = readStoredExpenses();

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function readStoredExpenses() {
  try {
    if (!fs.existsSync(dataFile)) return [];
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    console.error('Could not read fallback expense store:', error.message);
    return [];
  }
}

function writeStoredExpenses() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(memoryExpenses, null, 2));
  } catch (error) {
    console.error('Could not write fallback expense store:', error.message);
  }
}

async function saveExpense(data) {
  const expenseData = {
    title: data.title,
    amount: data.amount,
    image: data.image || '',
    date: data.date || new Date().toISOString(),
    category: data.category || 'Other',
    notes: data.notes || ''
  };

  if (!isMongoReady()) {
    const expense = {
      _id: Date.now().toString(),
      ...expenseData
    };
    memoryExpenses.push(expense);
    writeStoredExpenses();
    return expense;
  }

  return Expense.create(expenseData);
}

router.get('/', async (req, res) => {
  try {
    if (!isMongoReady()) {
      return res.json([...memoryExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)));
    }

    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const category = req.body.category || await classifyExpense(req.body);
    const expense = await saveExpense({ ...req.body, category });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/analyze-bill', upload.single('bill'), async (req, res) => {
  try {
    const analysis = await analyzeBillImage(req.file);
    const image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const expense = await saveExpense({ ...analysis, image });

    res.status(201).json({
      expense,
      analysis,
      categories: CATEGORIES
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/classify', async (req, res) => {
  try {
    const category = await classifyExpense(req.body);
    res.json({ category, categories: CATEGORIES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!isMongoReady()) {
      const index = memoryExpenses.findIndex(expense => expense._id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Expense not found' });
      memoryExpenses[index] = { ...memoryExpenses[index], ...req.body };
      writeStoredExpenses();
      return res.json(memoryExpenses[index]);
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isMongoReady()) {
      const originalLength = memoryExpenses.length;
      memoryExpenses = memoryExpenses.filter(expense => expense._id !== req.params.id);
      if (memoryExpenses.length === originalLength) return res.status(404).json({ error: 'Expense not found' });
      writeStoredExpenses();
      return res.json({ message: 'Deleted successfully' });
    }

    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
