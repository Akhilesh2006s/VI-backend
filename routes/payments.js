import express from 'express';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all payments (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('invoiceId', 'invoiceId total')
      .populate('clientId', 'companyName')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get payments for current client
router.get('/my-payments', authenticate, async (req, res) => {
  try {
    const client = await Client.findOne({ userId: req.user.id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const payments = await Payment.find({ clientId: client._id })
      .populate('invoiceId', 'invoiceId total')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit payment (client only)
router.post('/submit', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Only clients can submit payments' });
    }

    const { invoiceId, transactionId, utrNumber, screenshotUrl } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const client = await Client.findOne({ userId: req.user.id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice || invoice.clientId.toString() !== client._id.toString()) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const payment = new Payment({
      invoiceId: invoice._id,
      clientId: client._id,
      transactionId: transactionId || '',
      utrNumber: utrNumber || '',
      screenshotUrl: screenshotUrl || '',
      status: 'Pending'
    });

    await payment.save();

    // Create activity log
    const user = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Payment submitted',
      user: user?.name || 'Client',
      target: `${client.companyName} - ${invoice.invoiceId}`,
      type: 'info'
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify payment (super admin only)
router.post('/:id/verify', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { status, remarks } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const payment = await Payment.findById(req.params.id)
      .populate('invoiceId')
      .populate('clientId', 'companyName');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payment.status = status;
    payment.remarks = remarks || '';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    
    if (status === 'Approved') {
      payment.receiptId = `RCP-${Date.now()}`;
      // Update invoice status to Paid
      await Invoice.findByIdAndUpdate(payment.invoiceId._id, { status: 'Paid' });
    }

    await payment.save();

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Payment verified',
      user: adminUser?.name || 'Super Admin',
      target: `${payment.clientId.companyName} - ${payment.invoiceId.invoiceId}`,
      type: status === 'Approved' ? 'success' : 'warning'
    });

    res.json(payment);
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
