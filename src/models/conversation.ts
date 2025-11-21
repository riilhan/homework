import mongoose, { Schema, model, models } from 'mongoose';

const MessageSchema = new Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Number, default: Date.now }
});

const ConversationSchema = new Schema({
  userId: { type: String, default: 'user-1' }, // 简易版，暂定单用户
  title: { type: String, default: '新对话' },
  messages: [MessageSchema],
  updatedAt: { type: Date, default: Date.now }
});

// 更新 updateAt 的中间件
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Conversation = models.Conversation || model('Conversation', ConversationSchema);

export default Conversation;
