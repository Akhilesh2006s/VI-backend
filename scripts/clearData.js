import mongoose from 'mongoose';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Project from '../models/Project.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import ActivityLog from '../models/ActivityLog.js';
import SupportTicket from '../models/SupportTicket.js';
import { config } from '../config.js';

const clearData = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    const results = await Promise.all([
      Payment.deleteMany({}),
      Invoice.deleteMany({}),
      SupportTicket.deleteMany({}),
      ActivityLog.deleteMany({}),
      Client.deleteMany({}),
      Project.deleteMany({}),
      User.deleteMany({ role: { $ne: 'super_admin' } }),
    ]);

    const labels = ['payments', 'invoices', 'support tickets', 'activity logs', 'clients', 'projects', 'client users'];
    results.forEach((result, i) => {
      console.log(`Deleted ${result.deletedCount} ${labels[i]}`);
    });

    const remainingAdmins = await User.find({ role: 'super_admin' }).select('email name');
    console.log(`\nKept ${remainingAdmins.length} super admin account(s):`);
    remainingAdmins.forEach(admin => console.log(`  - ${admin.name} (${admin.email})`));

    await mongoose.connection.close();
    console.log('\nData cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearData();
