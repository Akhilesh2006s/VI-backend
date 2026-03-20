import express from 'express';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { config } from '../config.js';

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

// Create Cashfree order for an invoice (client only)
router.post('/cashfree/create-order', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Only clients can initiate payment' });
    }

    if (!config.cashfreeAppId || !config.cashfreeSecretKey) {
      return res.status(500).json({ error: 'Cashfree is not configured on server' });
    }

    const { invoiceId } = req.body;
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

    if (invoice.status === 'Paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const orderId = `ORD-${invoice.invoiceId}-${Date.now()}`;
    const baseUrl = config.cashfreeEnvironment === 'sandbox'
      ? 'https://sandbox.cashfree.com/pg/orders'
      : 'https://api.cashfree.com/pg/orders';

    const returnUrl = `${config.frontendUrl}/client/billing?order_id={order_id}`;
    const orderPayload = {
      order_id: orderId,
      order_amount: Number(invoice.total),
      order_currency: 'INR',
      customer_details: {
        customer_id: client._id.toString(),
        customer_email: req.user.email || client.contactEmail,
        customer_phone: '9999999999',
      },
    };

    // Cashfree requires HTTPS return_url in order_meta. Skip in local HTTP dev.
    if (returnUrl.startsWith('https://')) {
      orderPayload.order_meta = {
        return_url: returnUrl,
      };
    }

    const cashfreeResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.cashfreeAppId,
        'x-client-secret': config.cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(orderPayload),
    });

    const result = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) {
      console.error('Cashfree create order failed:', result);
      return res.status(400).json({ error: result.message || 'Failed to create Cashfree order' });
    }

    await Payment.create({
      invoiceId: invoice._id,
      clientId: client._id,
      cashfreeOrderId: result.order_id,
      cashfreeCfOrderId: result.cf_order_id || '',
      status: 'Pending',
      remarks: 'Cashfree payment initiated',
    });

    await ActivityLog.create({
      action: 'Payment order created',
      user: client.companyName,
      target: `${client.companyName} - ${invoice.invoiceId}`,
      type: 'info'
    });

    res.json({
      orderId: result.order_id,
      paymentSessionId: result.payment_session_id,
      cfOrderId: result.cf_order_id,
      amount: invoice.total,
    });
  } catch (error) {
    console.error('Create Cashfree order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch Cashfree payment status for an order (client only)
router.get('/cashfree/order-status/:orderId', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Only clients can check payment status' });
    }

    if (!config.cashfreeAppId || !config.cashfreeSecretKey) {
      return res.status(500).json({ error: 'Cashfree is not configured on server' });
    }

    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const client = await Client.findOne({ userId: req.user.id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const paymentsUrlBase = config.cashfreeEnvironment === 'sandbox'
      ? 'https://sandbox.cashfree.com/pg/orders'
      : 'https://api.cashfree.com/pg/orders';
    const cashfreeResponse = await fetch(`${paymentsUrlBase}/${orderId}/payments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.cashfreeAppId,
        'x-client-secret': config.cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
    });

    const result = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) {
      return res.status(400).json({ error: result.message || 'Failed to fetch payment status' });
    }

    const txns = Array.isArray(result) ? result : [];
    let orderStatus = 'Failure';
    if (txns.some(t => t.payment_status === 'SUCCESS')) {
      orderStatus = 'Success';
    } else if (txns.some(t => t.payment_status === 'PENDING')) {
      orderStatus = 'Pending';
    }

    // Update internal records when a successful transaction is detected.
    if (orderStatus === 'Success') {
      const successTxn = txns.find(t => t.payment_status === 'SUCCESS');
      const paymentDoc = await Payment.findOne({ clientId: client._id, cashfreeOrderId: orderId });
      if (paymentDoc) {
        paymentDoc.status = 'Approved';
        paymentDoc.transactionId = successTxn?.cf_payment_id || paymentDoc.transactionId;
        paymentDoc.verifiedAt = new Date();
        await paymentDoc.save();
        await Invoice.findByIdAndUpdate(paymentDoc.invoiceId, { status: 'Paid' });
      }
    }

    res.json({ orderStatus, transactions: txns });
  } catch (error) {
    console.error('Cashfree order status error:', error);
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
