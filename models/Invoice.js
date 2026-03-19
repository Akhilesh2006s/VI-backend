import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  rate: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  items: [{
    type: invoiceItemSchema
  }],
  // Keep breakdown for backward compatibility
  breakdown: {
    baseInfrastructure: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    aiUsage: { type: Number, default: 0 }
  },
  total: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue'],
    default: 'Pending'
  },
  billingType: {
    type: String,
    enum: ['single', 'recurring'],
    default: 'single'
  },
  extraCost: {
    type: Number,
    default: 0
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  dueDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Invoice', invoiceSchema);
