import mongoose, { Schema, model, models } from 'mongoose';

const MessageSchema = new Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  reasoning: { type: String },
  evaluation: { type: String },
  imageUrls: { type: [String], default: [] },
  timestamp: { type: Number, default: Date.now }
});

const ConversationSchema = new Schema({
  userId: { type: String, default: 'user-1' },
  title: { type: String, default: '新对话' },
  messages: [MessageSchema],
  updatedAt: { type: Date, default: Date.now }
});

ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Conversation = models.Conversation || model('Conversation', ConversationSchema);

export default Conversation;
