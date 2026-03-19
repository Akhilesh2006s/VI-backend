import express from 'express';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all projects (super admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('clients', 'companyName contactEmail status')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single project
router.get('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('clients', 'companyName contactEmail status monthlyCost');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new project (super admin only)
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, serverConfig, databaseConfig, clientIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = new Project({
      name,
      description: description || '',
      clients: clientIds || [],
      serverConfig: serverConfig || {},
      databaseConfig: databaseConfig || {},
      status: 'Active'
    });

    await project.save();

    // Update clients to reference this project
    if (clientIds && clientIds.length > 0) {
      await Client.updateMany(
        { _id: { $in: clientIds } },
        { $set: { projectId: project._id } }
      );
    }

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Project created',
      user: adminUser?.name || 'Super Admin',
      target: name,
      type: 'info'
    });

    await project.populate('clients', 'companyName contactEmail status');
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update project (super admin only)
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, status, serverConfig, databaseConfig, clientIds } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (serverConfig) project.serverConfig = { ...project.serverConfig, ...serverConfig };
    if (databaseConfig) project.databaseConfig = { ...project.databaseConfig, ...databaseConfig };

    // Update client assignments
    if (clientIds !== undefined) {
      // Remove project reference from old clients
      await Client.updateMany(
        { projectId: project._id },
        { $unset: { projectId: '' } }
      );

      // Add project reference to new clients
      project.clients = clientIds;
      if (clientIds.length > 0) {
        await Client.updateMany(
          { _id: { $in: clientIds } },
          { $set: { projectId: project._id } }
        );
      }
    }

    await project.save();

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Project updated',
      user: adminUser?.name || 'Super Admin',
      target: project.name,
      type: 'info'
    });

    await project.populate('clients', 'companyName contactEmail status');
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project (super admin only)
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectName = project.name;

    // Remove project reference from clients
    await Client.updateMany(
      { projectId: project._id },
      { $unset: { projectId: '' } }
    );

    await Project.findByIdAndDelete(req.params.id);

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Project deleted',
      user: adminUser?.name || 'Super Admin',
      target: projectName,
      type: 'warning'
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign clients to project
router.post('/:id/assign-clients', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { clientIds } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove project reference from old clients
    await Client.updateMany(
      { projectId: project._id },
      { $unset: { projectId: '' } }
    );

    // Add new clients
    project.clients = clientIds || [];
    if (clientIds && clientIds.length > 0) {
      await Client.updateMany(
        { _id: { $in: clientIds } },
        { $set: { projectId: project._id } }
      );
    }

    await project.save();

    // Create activity log
    const adminUser = await User.findById(req.user.id);
    await ActivityLog.create({
      action: 'Clients assigned to project',
      user: adminUser?.name || 'Super Admin',
      target: `${project.name} - ${clientIds?.length || 0} clients`,
      type: 'info'
    });

    await project.populate('clients', 'companyName contactEmail status');
    res.json(project);
  } catch (error) {
    console.error('Assign clients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
