import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Submit support ticket (authenticated users)
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const user = await User.findById(req.user.id);
    const client = req.user.role === 'client'
      ? await Client.findOne({ userId: req.user.id })
      : null;

    const ticket = await SupportTicket.create({
      userId: req.user.id,
      clientId: client?._id || null,
      subject: subject.trim(),
      message: message.trim(),
      status: 'Open',
    });

    await ActivityLog.create({
      action: 'Support ticket submitted',
      user: user?.name || req.user.email || 'User',
      target: subject.trim(),
      type: 'info'
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Submit support ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all support tickets (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('userId', 'name email role')
      .populate('clientId', 'companyName')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
