// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Service URLs
const services = {
  user: process.env.USER_SERVICE_URL || 'http://user-service:5001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:5003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:5004',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:5005'
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: services
  });
});

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify token with user service
    const response = await fetch(`${services.user}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      const data = await response.json();
      req.user = data.user;
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
};

// Proxy configurations
const proxyOptions = {
  changeOrigin: true,
  timeout: 10000,
  proxyTimeout: 10000,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
};

// User Service Routes (Public routes)
app.use('/api/auth', createProxyMiddleware({
  ...proxyOptions,
  target: services.user,
  pathRewrite: {
    '^/api/auth': '/auth'
  }
}));

// User Service Routes (Protected routes)
app.use('/api/users', authenticateToken, createProxyMiddleware({
  ...proxyOptions,
  target: services.user,
  pathRewrite: {
    '^/api/users': '/users'
  }
}));

// Product Service Routes (Public routes)
app.use('/api/products', createProxyMiddleware({
  ...proxyOptions,
  target: services.product,
  pathRewrite: {
    '^/api/products': '/products'
  }
}));

app.use('/api/search', createProxyMiddleware({
  ...proxyOptions,
  target: services.product,
  pathRewrite: {
    '^/api/search': '/search'
  }
}));

app.use('/api/categories', createProxyMiddleware({
  ...proxyOptions,
  target: services.product,
  pathRewrite: {
    '^/api/categories': '/categories'
  }
}));

// Order Service Routes (Protected routes)
app.use('/api/orders', authenticateToken, createProxyMiddleware({
  ...proxyOptions,
  target: services.order,
  pathRewrite: {
    '^/api/orders': '/orders'
  }
}));

app.use('/api/cart', authenticateToken, createProxyMiddleware({
  ...proxyOptions,
  target: services.order,
  pathRewrite: {
    '^/api/cart': '/cart'
  }
}));

// Payment Service Routes (Protected routes)
app.use('/api/payments', authenticateToken, createProxyMiddleware({
  ...proxyOptions,
  target: services.payment,
  pathRewrite: {
    '^/api/payments': '/payments'
  }
}));

// Notification Service Routes (Protected routes)
app.use('/api/notifications', authenticateToken, createProxyMiddleware({
  ...proxyOptions,
  target: services.notification,
  pathRewrite: {
    '^/api/notifications': '/notifications'
  }
}));

// Demo route for initializing sample data (accessible without auth for testing)
app.post('/api/init-data', async (req, res) => {
  try {
    // Initialize sample products
    const sampleProducts = [
      {
        name: "iPhone 14 Pro",
        description: "Latest Apple smartphone with Pro features",
        price: 999,
        category: "Electronics",
        stock: 50,
        featured: true,
        image: "https://via.placeholder.com/300x300/007bff/ffffff?text=iPhone+14+Pro"
      },
      {
        name: "Samsung Galaxy S23",
        description: "Powerful Android smartphone",
        price: 899,
        category: "Electronics",
        stock: 30,
        featured: true,
        image: "https://via.placeholder.com/300x300/28a745/ffffff?text=Galaxy+S23"
      },
      {
        name: "MacBook Air M2",
        description: "Ultra-thin laptop with M2 chip",
        price: 1199,
        category: "Computers",
        stock: 25,
        featured: true,
        image: "https://via.placeholder.com/300x300/dc3545/ffffff?text=MacBook+Air"
      },
      {
        name: "Nike Air Max 270",
        description: "Comfortable running shoes",
        price: 150,
        category: "Shoes",
        stock: 100,
        featured: false,
        image: "https://via.placeholder.com/300x300/ffc107/000000?text=Nike+Air+Max"
      },
      {
        name: "Sony WH-1000XM5",
        description: "Noise-cancelling wireless headphones",
        price: 349,
        category: "Audio",
        stock: 40,
        featured: true,
        image: "https://via.placeholder.com/300x300/6f42c1/ffffff?text=Sony+Headphones"
      },
      {
        name: "iPad Pro 12.9",
        description: "Professional tablet with M2 chip",
        price: 1099,
        category: "Electronics",
        stock: 20,
        featured: false,
        image: "https://via.placeholder.com/300x300/fd7e14/ffffff?text=iPad+Pro"
      }
    ];

    // Send products to product service
    const productPromises = sampleProducts.map(async (product) => {
      try {
        const response = await fetch(`${services.product}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer demo-admin-token' // For demo purposes
          },
          body: JSON.stringify(product)
        });
        return response.ok;
      } catch (error) {
        console.error('Error creating product:', error);
        return false;
      }
    });

    await Promise.all(productPromises);

    res.json({ 
      message: 'Sample data initialized successfully',
      productsCreated: sampleProducts.length
    });
  } catch (error) {
    console.error('Error initializing data:', error);
    res.status(500).json({ error: 'Failed to initialize sample data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log('Service endpoints:');
  Object.entries(services).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
});