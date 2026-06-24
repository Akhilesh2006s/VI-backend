import express from 'express';
import Expense from '../models/Expense.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildDateFilter = (query) => {
  const { period, month, year, dateFrom, dateTo } = query;
  const now = new Date();

  if (period === 'today') {
    return { date: { $gte: startOfDay(now), $lte: endOfDay(now) } };
  }
  if (period === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return { date: { $gte: startOfDay(weekStart), $lte: endOfDay(now) } };
  }
  if (period === 'month' || (month && year)) {
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) - 1 : now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { date: { $gte: start, $lte: end } };
  }
  if (dateFrom || dateTo) {
    const filter = {};
    if (dateFrom) filter.$gte = startOfDay(dateFrom);
    if (dateTo) filter.$lte = endOfDay(dateTo);
    return { date: filter };
  }
  return {};
};

const buildQuery = (query) => {
  const filter = buildDateFilter(query);
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }
  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [{ title: regex }, { notes: regex }];
  }
  return filter;
};

// List expenses with filters
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const filter = buildQuery(req.query);
    const expenses = await Expense.find(filter)
      .sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Summary stats for filtered period
router.get('/summary', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const filter = buildQuery(req.query);
    const expenses = await Expense.find(filter);

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;

    const byCategory = {};
    const byDay = {};

    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      const dayKey = startOfDay(e.date).toISOString().split('T')[0];
      byDay[dayKey] = (byDay[dayKey] || 0) + e.amount;
    });

    res.json({
      total,
      count,
      average: count > 0 ? Math.round(total / count) : 0,
      byCategory: Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      byDay: Object.entries(byDay)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create expense
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { title, amount, category, notes, date } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (amount == null || amount < 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const expense = new Expense({
      title: title.trim(),
      amount: Number(amount),
      category: category || 'Other',
      notes: notes?.trim() || '',
      date: new Date(date),
      createdBy: req.user.id,
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update expense
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { title, amount, category, notes, date } = req.body;
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (title !== undefined) expense.title = title.trim();
    if (amount !== undefined) expense.amount = Number(amount);
    if (category !== undefined) expense.category = category;
    if (notes !== undefined) expense.notes = notes.trim();
    if (date !== undefined) expense.date = new Date(date);

    await expense.save();
    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete expense
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
