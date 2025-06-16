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

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, default: 'https://via.placeholder.com/300' },
  stock: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  specifications: {
    brand: String,
    model: String,
    weight: String,
    dimensions: String
  },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add text index for search
productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);

// Middleware to verify user (calls user service) - OPTIONAL FOR TESTING
const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('No token provided, proceeding without auth for testing');
      req.user = { role: 'admin' }; // Mock admin user for testing
      return next();
    }

    const response = await axios.post(`${process.env.USER_SERVICE_URL}/auth/verify`, {
      token
    });

    if (response.data.valid) {
      req.user = response.data.user;
      next();
    } else {
      // For testing, allow without valid token
      console.log('Invalid token, proceeding without auth for testing');
      req.user = { role: 'admin' };
      next();
    }
  } catch (error) {
    console.log('Auth service unavailable, proceeding without auth for testing');
    req.user = { role: 'admin' };
    next();
  }
};


// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'product-service',
    timestamp: new Date().toISOString() 
  });
});

// Get all products with filtering and pagination
app.get('/products', async (req, res) => {
  try {
    const { 
      category, 
      featured, 
      minPrice, 
      maxPrice, 
      limit = 20, 
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (category) query.category = category;
    if (featured) query.featured = featured === 'true';
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Product.countDocuments(query);

    console.log(`Found ${products.length} products (total: ${total})`);

    res.json({
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single product
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product (NO AUTH REQUIRED FOR TESTING)
app.post('/products', async (req, res) => {
  try {
    console.log('Creating product:', req.body);
    
    const product = new Product(req.body);
    const savedProduct = await product.save();
    
    console.log('Product created successfully:', savedProduct._id);
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ error: error.message });
  }
});

// Search products
app.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query;
    const query = {};

    if (q) {
      query.$text = { $search: q };
    }

    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(query).limit(20);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    console.log('Found categories:', categories);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update stock (for order service)
app.patch('/products/:id/stock', async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'decrease' or 'increase'
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (operation === 'decrease') {
      if (product.stock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      product.stock -= quantity;
    } else if (operation === 'increase') {
      product.stock += quantity;
    }

    await product.save();
    res.json({ message: 'Stock updated', newStock: product.stock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize sample data endpoint
app.post('/init-data', async (req, res) => {
  try {
    console.log('Initializing sample data...');
    
    // Clear existing products first
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    const sampleProducts = [
      {
        name: "iPhone 14 Pro",
        description: "Latest Apple smartphone with Pro features",
        price: 999,
        category: "Electronics",
        stock: 50,
        featured: true,
        image: "https://picsum.photos/300/300?random=1"
      },
      {
        name: "Samsung Galaxy S23",
        description: "Powerful Android smartphone",
        price: 899,
        category: "Electronics",
        stock: 30,
        featured: true,
        image: "https://picsum.photos/300/300?random=2"
      },
      {
        name: "MacBook Air M2",
        description: "Ultra-thin laptop with M2 chip",
        price: 1199,
        category: "Computers",
        stock: 25,
        featured: true,
        image: "https://picsum.photos/300/300?random=3"
      },
      {
        name: "Nike Air Max 270",
        description: "Comfortable running shoes",
        price: 150,
        category: "Shoes",
        stock: 100,
        featured: false,
        image: "https://picsum.photos/300/300?random=4"
      },
      {
        name: "Sony WH-1000XM5",
        description: "Noise-cancelling wireless headphones",
        price: 349,
        category: "Audio",
        stock: 40,
        featured: true,
        image: "https://picsum.photos/300/300?random=5"
      },
      {
        name: "iPad Pro 12.9",
        description: "Professional tablet with M2 chip",
        price: 1099,
        category: "Electronics",
        stock: 20,
        featured: false,
        image: "https://picsum.photos/300/300?random=6"
      }
    ];

    const createdProducts = await Product.insertMany(sampleProducts);
    console.log(`Created ${createdProducts.length} products`);
    
    res.json({
      message: 'Sample data initialized successfully',
      productsCreated: createdProducts.length,
      products: createdProducts
    });
  } catch (error) {
    console.error('Error initializing data:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});