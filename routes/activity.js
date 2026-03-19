import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all activity logs (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
