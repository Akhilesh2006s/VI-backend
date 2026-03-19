import express from 'express';
import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all invoices (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('clientId', 'companyName contactEmail')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get invoices for current client
router.get('/my-invoices', authenticate, async (req, res) => {
  try {
    const client = await Client.findOne({ userId: req.user.id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const invoices = await Invoice.find({ clientId: client._id })
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId', 'companyName contactEmail');
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if user is super admin or the client owner
    if (req.user.role !== 'super_admin') {
      const client = await Client.findOne({ userId: req.user.id });
      if (!client || client._id.toString() !== invoice.clientId._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create invoice (super admin only)
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { invoiceId, clientId, items, breakdown, total, dueDate, billingType, extraCost, projectId } = req.body;

    if (!invoiceId || !clientId || !total || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const invoice = new Invoice({
      invoiceId,
      clientId,
      items: items || [],
      breakdown: breakdown || {},
      total,
      dueDate: new Date(dueDate),
      status: 'Pending',
      billingType: billingType || 'single',
      extraCost: extraCost || 0,
      projectId: projectId || null
    });

    await invoice.save();
    await invoice.populate('clientId', 'companyName contactEmail');
    if (projectId) {
      await invoice.populate('projectId', 'name');
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Invoice ID already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update invoice (super admin only)
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status, breakdown, total, dueDate } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (status) invoice.status = status;
    if (breakdown) invoice.breakdown = { ...invoice.breakdown, ...breakdown };
    if (total) invoice.total = total;
    if (dueDate) invoice.dueDate = new Date(dueDate);

    await invoice.save();
    await invoice.populate('clientId', 'companyName contactEmail');

    res.json(invoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
