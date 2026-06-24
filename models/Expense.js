import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    enum: [
      'Hosting',
      'Software & Tools',
      'Hardware',
      'Salaries & Labor',
      'Marketing',
      'Travel',
      'Utilities',
      'Office & Supplies',
      'Other',
    ],
    default: 'Other',
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);
