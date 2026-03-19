import express from 'express';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all clients (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const clients = await Client.find()
      .populate('userId', 'name email')
      .populate('projectIds', 'name')
      .sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single client
router.get('/:id', authenticate, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('projectIds', 'name');
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if user is super admin or the client owner
    if (req.user.role !== 'super_admin' && client.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new client (super admin only)
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { companyName, contactEmail, planType, monthlyCost, projectIds } = req.body;

    if (!companyName || !contactEmail) {
      return res.status(400).json({ error: 'Company name and contact email are required' });
    }

    // Check if user with this email already exists
    let user = await User.findOne({ email: contactEmail.toLowerCase() });
    
    if (!user) {
      // Generate password from email: extract part before @, lowercase, add "123"
      const emailPrefix = contactEmail.toLowerCase().split('@')[0];
      const generatedPassword = `${emailPrefix}123`;
      
      // Create new user for client
      user = new User({
        name: companyName,
        email: contactEmail.toLowerCase(),
        password: generatedPassword,
        role: 'client'
      });
      await user.save();
    } else if (user.role !== 'client') {
      return res.status(400).json({ error: 'Email already exists with different role' });
    }

    // Check if client already exists
    const existingClient = await Client.findOne({ contactEmail: contactEmail.toLowerCase() });
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }

    const client = new Client({
      companyName,
      contactEmail: contactEmail.toLowerCase(),
      userId: user._id,
      planType: planType || 'Starter',
      monthlyCost: monthlyCost || 0,
      projectIds: projectIds || []
    });

    await client.save();
    await client.populate('userId', 'name email');
    await client.populate('projectIds', 'name');

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Client created',
      user: adminUser?.name || 'Super Admin',
      target: companyName,
      type: 'info'
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update client (super admin only)
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const {
      companyName,
      contactEmail,
      planType,
      status,
      monthlyCost,
      projectIds,
      serverConfig,
      databaseConfig
    } = req.body;

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const oldStatus = client.status;
    if (companyName) client.companyName = companyName;
    if (contactEmail) client.contactEmail = contactEmail.toLowerCase();
    if (planType) client.planType = planType;
    if (status) client.status = status;
    if (monthlyCost !== undefined) client.monthlyCost = monthlyCost;
    if (projectIds !== undefined) client.projectIds = projectIds;
    if (serverConfig !== undefined) {
      client.serverConfig = { ...client.serverConfig.toObject(), ...serverConfig };
    }
    if (databaseConfig !== undefined) {
      client.databaseConfig = { ...client.databaseConfig.toObject(), ...databaseConfig };
    }

    await client.save();
    await client.populate('userId', 'name email');
    await client.populate('projectIds', 'name');

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    let action = 'Client updated';
    let logType = 'info';
    
    if (status && status !== oldStatus) {
      action = status === 'Suspended' ? 'Client suspended' : 'Client activated';
      logType = status === 'Suspended' ? 'warning' : 'success';
    }
    
    await ActivityLog.create({
      action,
      user: adminUser?.name || 'Super Admin',
      target: client.companyName,
      type: logType
    });

    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete client (super admin only)
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const companyName = client.companyName;
    await Client.findByIdAndDelete(req.params.id);

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Client deleted',
      user: adminUser?.name || 'Super Admin',
      target: companyName,
      type: 'warning'
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign database to client (super admin only)
router.post('/:id/assign-database', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { databaseConfig } = req.body;
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (databaseConfig) {
      client.databaseConfig = { ...client.databaseConfig, ...databaseConfig };
      await client.save();
      await client.populate('userId', 'name email');

      // Create activity log
      const adminUser = await User.findById(req.user.id);
      await ActivityLog.create({
        action: 'Database allocated',
        user: adminUser?.name || 'Super Admin',
        target: `${client.companyName} - ${databaseConfig.type || client.databaseConfig.type}`,
        type: 'info'
      });
    }

    res.json(client);
  } catch (error) {
    console.error('Assign database error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
