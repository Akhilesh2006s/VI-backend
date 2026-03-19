import mongoose from 'mongoose';

const serverConfigSchema = new mongoose.Schema({
  cpu: {
    type: String,
    default: '2 vCPU'
  },
  ram: {
    type: String,
    default: '4GB'
  },
  storage: {
    type: String,
    default: '50GB'
  },
  hostingProvider: {
    type: String,
    enum: ['AmenityForge', 'AWS', 'DigitalOcean', 'GCP', 'Custom'],
    default: 'AmenityForge'
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  deploymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Active', 'Provisioning', 'Stopped'],
    default: 'Provisioning'
  }
});

const databaseConfigSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['MongoDB Atlas', 'MySQL', 'PostgreSQL'],
    default: 'MongoDB Atlas'
  },
  storageSize: {
    type: String,
    default: '10GB'
  },
  region: {
    type: String,
    default: 'us-east-1'
  },
  monthlyCost: {
    type: Number,
    default: 0
  },
  backupEnabled: {
    type: Boolean,
    default: true
  },
  connectionString: {
    type: String,
    default: ''
  }
});

const clientSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  planType: {
    type: String,
    enum: ['Starter', 'Professional', 'Enterprise'],
    default: 'Starter'
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended'],
    default: 'Active'
  },
  serverConfig: {
    type: serverConfigSchema,
    default: () => ({})
  },
  databaseConfig: {
    type: databaseConfigSchema,
    default: () => ({})
  },
  monthlyCost: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Client', clientSchema);
