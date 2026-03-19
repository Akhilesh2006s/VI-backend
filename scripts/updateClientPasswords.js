import mongoose from 'mongoose';
import User from '../models/User.js';
import { config } from '../config.js';

// Connect to MongoDB
mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    updateClientPasswords();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function updateClientPasswords() {
  try {
    // Get all client users
    const clients = await User.find({ role: 'client' });
    
    console.log(`Found ${clients.length} client users to update...`);
    
    let updated = 0;
    for (const client of clients) {
      // Generate new password from email
      const emailPrefix = client.email.toLowerCase().split('@')[0];
      const newPassword = `${emailPrefix}123`;
      
      // Update password (will be hashed by pre-save hook)
      client.password = newPassword;
      await client.save();
      
      console.log(`✓ Updated password for ${client.email} -> ${newPassword}`);
      updated++;
    }
    
    console.log(`\n✅ Successfully updated ${updated} client passwords!`);
    console.log('\nPassword format: {email_prefix}123');
    console.log('Example: asli@gmail.com -> asli123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating passwords:', error);
    process.exit(1);
  }
}
