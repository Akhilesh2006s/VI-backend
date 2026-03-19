import mongoose from 'mongoose';
import User from '../models/User.js';
import { config } from '../config.js';

const initAdmin = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ email: 'amenityforge@gmail.com' });
    
    if (existingAdmin) {
      console.log('Super admin already exists');
      // Update password if needed
      existingAdmin.password = 'AmenityForge123';
      await existingAdmin.save();
      console.log('Super admin password updated');
    } else {
      // Create super admin
      const admin = new User({
        name: 'Super Admin',
        email: 'amenityforge@gmail.com',
        password: 'AmenityForge123',
        role: 'super_admin'
      });
      await admin.save();
      console.log('Super admin created successfully');
      console.log('Email: amenityforge@gmail.com');
      console.log('Password: AmenityForge123');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error initializing admin:', error);
    process.exit(1);
  }
};

initAdmin();
