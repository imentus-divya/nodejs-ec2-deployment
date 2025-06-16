const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI);

// Payment Schema
const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  paymentMethod: {
    type: { type: String, enum: ['card', 'paypal', 'stripe'], required: true },
    cardLast4: String,
    brand: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  externalPaymentId: String, // Stripe/PayPal payment ID
  failureReason: String,
  refundAmount: { type: Number, default: 0 },
  refundReason: String,
  metadata: {
    customerEmail: String,
    customerName: String,
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'payment-service',
    timestamp: new Date().toISOString() 
  });
});

// Process payment
app.post('/payments/process', async (req, res) => {
  try {
    const {
      orderId,
      userId,
      amount,
      paymentMethod,
      customerInfo
    } = req.body;

    // Create payment record
    const payment = new Payment({
      orderId,
      userId,
      amount,
      paymentMethod,
      status: 'processing',
      metadata: {
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        billingAddress: customerInfo.billingAddress
      }
    });

    await payment.save();

    try {
      // Simulate payment processing
      const paymentResult = await processPaymentWithProvider(paymentMethod, amount, customerInfo);
      
      if (paymentResult.success) {
        payment.status = 'completed';
        payment.transactionId = paymentResult.transactionId;
        payment.externalPaymentId = paymentResult.externalId;
        payment.updatedAt = new Date();
        
        await payment.save();

        // Notify notification service
        try {
          await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notifications/send`, {
            type: 'payment_success',
            userId: userId,
            message: `Payment of ${amount} processed successfully`,
            metadata: {
              paymentId: payment._id,
              amount: amount,
              orderId: orderId
            }
          });
        } catch (notificationError) {
          console.error('Notification service error:', notificationError.message);
        }

        res.json({
          success: true,
          paymentId: payment._id,
          transactionId: payment.transactionId,
          status: payment.status
        });
      } else {
        payment.status = 'failed';
        payment.failureReason = paymentResult.error;
        payment.updatedAt = new Date();
        
        await payment.save();

        // Notify about failure
        try {
          await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notifications/send`, {
            type: 'payment_failed',
            userId: userId,
            message: `Payment of ${amount} failed: ${paymentResult.error}`,
            metadata: {
              paymentId: payment._id,
              amount: amount,
              orderId: orderId
            }
          });
        } catch (notificationError) {
          console.error('Notification service error:', notificationError.message);
        }

        res.status(400).json({
          success: false,
          error: paymentResult.error,
          paymentId: payment._id
        });
      }
    } catch (processingError) {
      payment.status = 'failed';
      payment.failureReason = processingError.message;
      payment.updatedAt = new Date();
      await payment.save();

      res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        paymentId: payment._id
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment details
app.get('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payments by order
app.get('/payments/order/:orderId', async (req, res) => {
  try {
    const payments = await Payment.find({ orderId: req.params.orderId });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process refund
app.post('/payments/:id/refund', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Payment not eligible for refund' });
    }

    if (amount > (payment.amount - payment.refundAmount)) {
      return res.status(400).json({ error: 'Refund amount exceeds available amount' });
    }

    // Simulate refund processing
    const refundResult = await processRefund(payment.externalPaymentId, amount);
    
    if (refundResult.success) {
      payment.refundAmount += amount;
      payment.refundReason = reason;
      payment.status = payment.refundAmount >= payment.amount ? 'refunded' : 'completed';
      payment.updatedAt = new Date();
      
      await payment.save();

      res.json({
        success: true,
        refundAmount: amount,
        totalRefunded: payment.refundAmount,
        status: payment.status
      });
    } else {
      res.status(400).json({
        success: false,
        error: refundResult.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function processPaymentWithProvider(paymentMethod, amount, customerInfo) {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate different payment providers
  switch (paymentMethod.type) {
    case 'stripe':
      return simulateStripePayment(amount, customerInfo);
    case 'paypal':
      return simulatePayPalPayment(amount, customerInfo);
    case 'card':
      return simulateCardPayment(amount, customerInfo);
    default:
      throw new Error('Unsupported payment method');
  }
}

function simulateStripePayment(amount, customerInfo) {
  // Simulate 95% success rate
  if (Math.random() < 0.95) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      externalId: `pi_${Date.now()}_stripe`
    };
  } else {
    return {
      success: false,
      error: 'Card declined'
    };
  }
}

function simulatePayPalPayment(amount, customerInfo) {
  // Simulate 97% success rate
  if (Math.random() < 0.97) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      externalId: `PAYID-${Date.now()}`
    };
  } else {
    return {
      success: false,
      error: 'Insufficient funds'
    };
  }
}

function simulateCardPayment(amount, customerInfo) {
  // Simulate 92% success rate
  if (Math.random() < 0.92) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      externalId: `card_${Date.now()}`
    };
  } else {
    return {
      success: false,
      error: 'Transaction declined'
    };
  }
}

async function processRefund(externalPaymentId, amount) {
  // Simulate refund processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate 98% success rate for refunds
  if (Math.random() < 0.98) {
    return {
      success: true,
      refundId: `rf_${Date.now()}`
    };
  } else {
    return {
      success: false,
      error: 'Refund processing failed'
    };
  }
}

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});