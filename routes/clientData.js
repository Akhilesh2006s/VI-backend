import express from 'express';
import Client from '../models/Client.js';
import Invoice from '../models/Invoice.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get current client's data
router.get('/me', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin does not have client data' });
    }

    const client = await Client.findOne({ userId: req.user.id })
      .populate('userId', 'name email')
      .populate('projectIds', 'name');

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Get client data error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current client's latest invoice
router.get('/latest-invoice', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin does not have client data' });
    }

    const client = await Client.findOne({ userId: req.user.id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const invoice = await Invoice.findOne({ clientId: client._id })
      .sort({ createdAt: -1 });

    res.json(invoice || null);
  } catch (error) {
    console.error('Get latest invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
