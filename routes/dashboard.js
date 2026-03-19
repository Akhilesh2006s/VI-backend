import express from 'express';
import Client from '../models/Client.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total clients
    const totalClients = await Client.countDocuments();
    
    // Clients created this month
    const clientsThisMonth = await Client.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Active clients (servers)
    const activeServers = await Client.countDocuments({
      'serverConfig.status': 'Active'
    });

    // Active clients
    const activeClients = await Client.countDocuments({
      status: 'Active'
    });

    // Monthly revenue (paid invoices this month)
    const paidInvoicesThisMonth = await Invoice.find({
      status: 'Paid',
      createdAt: { $gte: startOfMonth }
    });
    const monthlyRevenue = paidInvoicesThisMonth.reduce((sum, inv) => sum + inv.total, 0);

    // Last month revenue for comparison
    const paidInvoicesLastMonth = await Invoice.find({
      status: 'Paid',
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });
    const lastMonthRevenue = paidInvoicesLastMonth.reduce((sum, inv) => sum + inv.total, 0);
    const revenueChange = lastMonthRevenue > 0 
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0)
      : '0';

    // Pending payments
    const pendingPayments = await Invoice.countDocuments({
      status: 'Pending'
    });

    // Verified payments
    const verifiedPayments = await Payment.countDocuments({
      status: 'Approved'
    });

    res.json({
      totalClients,
      clientsThisMonth,
      activeServers,
      activeClients,
      monthlyRevenue,
      revenueChange: revenueChange !== '0' ? `${revenueChange > 0 ? '+' : ''}${revenueChange}% vs last month` : null,
      pendingPayments,
      verifiedPayments
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent clients
router.get('/recent-clients', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const clients = await Client.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(4)
      .select('companyName planType status monthlyCost');
    
    res.json(clients);
  } catch (error) {
    console.error('Recent clients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent activity logs
router.get('/recent-activity', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(5);
    
    res.json(logs);
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
