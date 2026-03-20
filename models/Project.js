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
    enum: ['Vallunex', 'AmenityForge', 'AWS', 'DigitalOcean', 'GCP', 'Custom'],
    default: 'Vallunex'
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
    default: ''
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

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  clients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  serverConfig: {
    type: serverConfigSchema,
    default: () => ({})
  },
  databaseConfig: {
    type: databaseConfigSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
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

projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Project', projectSchema);
