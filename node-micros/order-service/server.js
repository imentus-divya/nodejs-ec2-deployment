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

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: String
  }],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: String,
  shippingAddress: {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: String
  },
  trackingNumber: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Cart Schema (temporary cart storage)
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true }
  }],
  updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', cartSchema);

// Middleware to verify user
const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const response = await axios.post(`${process.env.USER_SERVICE_URL}/auth/verify`, {
      token
    });

    if (response.data.valid) {
      req.user = response.data.user;
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'order-service',
    timestamp: new Date().toISOString() 
  });
});

// Cart Management
app.get('/cart', verifyUser, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.json({ items: [], total: 0 });
    }

    // Get product details for cart items
    const cartWithDetails = [];
    let total = 0;

    for (let item of cart.items) {
      try {
        const productResponse = await axios.get(
          `${process.env.PRODUCT_SERVICE_URL}/products/${item.productId}`
        );
        const product = productResponse.data;
        
        const cartItem = {
          productId: item.productId,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          image: product.image,
          subtotal: product.price * item.quantity
        };
        
        cartWithDetails.push(cartItem);
        total += cartItem.subtotal;
      } catch (error) {
        console.error(`Product ${item.productId} not found`);
      }
    }

    res.json({ items: cartWithDetails, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to cart
app.post('/cart/add', verifyUser, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Verify product exists
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/products/${productId}`
    );
    
    if (!productResponse.data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId: req.user.userId });
    
    if (!cart) {
      cart = new Cart({ userId: req.user.userId, items: [] });
    }

    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    cart.updatedAt = new Date();
    await cart.save();

    res.json({ message: 'Product added to cart', cart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create order from cart
app.post('/orders', verifyUser, async (req, res) => {
  try {
    const { shippingAddress } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Get product details and calculate total
    const orderItems = [];
    let totalAmount = 0;

    for (let item of cart.items) {
      const productResponse = await axios.get(
        `${process.env.PRODUCT_SERVICE_URL}/products/${item.productId}`
      );
      const product = productResponse.data;

      // Check stock availability
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}` 
        });
      }

      const orderItem = {
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.image
      };

      orderItems.push(orderItem);
      totalAmount += product.price * item.quantity;
    }

    // Create order
    const order = new Order({
      userId: req.user.userId,
      items: orderItems,
      totalAmount,
      shippingAddress
    });

    await order.save();

    // Update product stock
    for (let item of orderItems) {
      await axios.patch(
        `${process.env.PRODUCT_SERVICE_URL}/products/${item.productId}/stock`,
        {
          quantity: item.quantity,
          operation: 'decrease'
        }
      );
    }

    // Clear cart
    await Cart.deleteOne({ userId: req.user.userId });

    // Send notification
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notifications/send`, {
        type: 'order_created',
        userId: req.user.userId,
        orderId: order._id,
        message: `Order #${order._id} has been created successfully`
      });
    } catch (notificationError) {
      console.error('Notification service error:', notificationError.message);
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user orders
app.get('/orders', verifyUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order
app.get('/orders/:id', verifyUser, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (admin only)
app.patch('/orders/:id/status', verifyUser, async (req, res) => {
  try {
    // For demo purposes, allowing user to update their own orders
    // In production, this should be admin only
    const { status } = req.body;
    
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Send notification about status change
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notifications/send`, {
        type: 'order_status_updated',
        userId: req.user.userId,
        orderId: order._id,
        message: `Order #${order._id} status updated to ${status}`
      });
    } catch (notificationError) {
      console.error('Notification service error:', notificationError.message);
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});