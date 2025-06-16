const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { 
    type: String, 
    enum: ['order_created', 'order_status_updated', 'payment_success', 'payment_failed', 'welcome'],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  channels: [{
    type: { type: String, enum: ['email', 'sms', 'push'] },
    status: { type: String, enum: ['pending', 'sent', 'failed'] },
    sentAt: Date,
    error: String
  }],
  metadata: {
    orderId: mongoose.Schema.Types.ObjectId,
    paymentId: String,
    amount: Number
  },
  createdAt: { type: Date, default: Date.now },
  sentAt: Date
});

const Notification = mongoose.model('Notification', notificationSchema);

// Email Templates
const emailTemplates = {
  order_created: (data) => ({
    subject: `Order Confirmation #${data.orderId}`,
    html: `
      <h2>Order Confirmation</h2>
      <p>Thank you for your order!</p>
      <p>Order ID: ${data.orderId}</p>
      <p>Total Amount: ${data.amount}</p>
      <p>We'll notify you when your order ships.</p>
    `
  }),
  order_status_updated: (data) => ({
    subject: `Order Update #${data.orderId}`,
    html: `
      <h2>Order Status Update</h2>
      <p>Your order status has been updated.</p>
      <p>Order ID: ${data.orderId}</p>
      <p>New Status: ${data.status}</p>
    `
  }),
  payment_success: (data) => ({
    subject: 'Payment Successful',
    html: `
      <h2>Payment Confirmed</h2>
      <p>Your payment has been processed successfully.</p>
      <p>Amount: ${data.amount}</p>
      <p>Payment ID: ${data.paymentId}</p>
    `
  }),
  welcome: (data) => ({
    subject: 'Welcome to Our Store!',
    html: `
      <h2>Welcome ${data.name}!</h2>
      <p>Thank you for joining our store.</p>
      <p>Start shopping now and enjoy great deals!</p>
    `
  })
};

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'notification-service',
    timestamp: new Date().toISOString() 
  });
});

// Send notification
app.post('/notifications/send', async (req, res) => {
  try {
    const { type, userId, message, metadata = {} } = req.body;

    // Create notification record
    const notification = new Notification({
      userId,
      type,
      title: getNotificationTitle(type, metadata),
      message,
      metadata
    });

    // Simulate sending email
    const emailTemplate = emailTemplates[type];
    if (emailTemplate) {
      const emailContent = emailTemplate(metadata);
      
      try {
        // Simulate email sending (replace with actual email service)
        await simulateEmailSend(userId, emailContent);
        
        notification.channels.push({
          type: 'email',
          status: 'sent',
          sentAt: new Date()
        });
        notification.status = 'sent';
        notification.sentAt = new Date();
        
        console.log(`Email sent to user ${userId}: ${emailContent.subject}`);
      } catch (emailError) {
        notification.channels.push({
          type: 'email',
          status: 'failed',
          error: emailError.message
        });
        notification.status = 'failed';
      }
    }

    await notification.save();

    res.json({ 
      message: 'Notification processed', 
      notificationId: notification._id,
      status: notification.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user notifications
app.get('/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      userId: req.params.userId 
    }).sort({ createdAt: -1 }).limit(50);
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function getNotificationTitle(type, metadata) {
  const titles = {
    order_created: 'Order Confirmed',
    order_status_updated: 'Order Status Updated',
    payment_success: 'Payment Successful',
    payment_failed: 'Payment Failed',
    welcome: 'Welcome!'
  };
  return titles[type] || 'Notification';
}

async function simulateEmailSend(userId, emailContent) {
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error('Email service temporarily unavailable');
  }
  
  return { messageId: `msg_${Date.now()}_${userId}` };
}

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});