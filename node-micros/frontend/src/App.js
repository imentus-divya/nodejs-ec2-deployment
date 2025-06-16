import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from 'react-query';
import { Toaster, toast } from 'react-hot-toast';
import { ShoppingCart, Search, Star, Plus, Minus, Package, Home, Grid } from 'lucide-react';
import axios from 'axios';

// API Configuration - ONLY CHANGE: Use direct Product Service URL
const API_URL = 'http://localhost:5002';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// React Query Client - ONLY CHANGE: Less aggressive refetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// API Functions - ONLY CHANGE: Adjust endpoints for direct service
const fetchProducts = async (params = {}) => {
  const { data } = await api.get('/products', { params });
  return data;
};

const searchProducts = async (query) => {
  const { data } = await api.get('/search', { params: { q: query } });
  return data;
};

const fetchCategories = async () => {
  const { data } = await api.get('/categories');
  return data;
};

const initializeData = async () => {
  const { data } = await api.post('/init-data');
  return data;
};

// Components - KEEPING YOUR ORIGINAL UI EXACTLY THE SAME
const Header = ({ cartItems, onSearch, searchQuery, setSearchQuery }) => {
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">
          <Package className="logo-icon" />
          <span>EcomStore</span>
        </Link>
        
        <div className="search-bar">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch(searchQuery)}
          />
          <button onClick={() => onSearch(searchQuery)} className="search-btn">
            Search
          </button>
        </div>
        
        <div className="cart-icon">
          <ShoppingCart />
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </div>
      </div>
    </header>
  );
};

const ProductCard = ({ product, onAddToCart }) => {
  const [imgError, setImgError] = useState(false);
  
  const handleImageError = () => {
    setImgError(true);
  };

  const getImageSrc = () => {
    if (imgError) {
      // Fallback to a more reliable image service
      const fallbackImages = {
        'iPhone 14 Pro': 'https://picsum.photos/300/300?random=1',
        'Samsung Galaxy S23': 'https://picsum.photos/300/300?random=2', 
        'MacBook Air M2': 'https://picsum.photos/300/300?random=3',
        'Nike Air Max 270': 'https://picsum.photos/300/300?random=4',
        'Sony WH-1000XM5': 'https://picsum.photos/300/300?random=5',
        'iPad Pro 12.9': 'https://picsum.photos/300/300?random=6'
      };
      return fallbackImages[product.name] || 'https://picsum.photos/300/300?random=7';
    }
    return product.image;
  };

  return (
    <div className="product-card">
      <div className="product-image">
        <img 
          src={getImageSrc()} 
          alt={product.name}
          onError={handleImageError}
          style={{ 
            width: '100%', 
            height: '200px', 
            objectFit: 'cover',
            backgroundColor: '#f0f0f0'
          }}
        />
        {product.featured && <span className="featured-badge">Featured</span>}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.description}</p>
        <div className="product-meta">
          <span className="product-category">{product.category}</span>
          <div className="product-rating">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`star ${i < 4 ? 'filled' : ''}`} />
            ))}
          </div>
        </div>
        <div className="product-footer">
          <span className="product-price">${product.price}</span>
          <button 
            className="add-to-cart-btn"
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
        <div className="stock-info">
          Stock: {product.stock} items
        </div>
      </div>
    </div>
  );
};

const CategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => {
  return (
    <div className="category-filter">
      <h3>Categories</h3>
      <div className="category-list">
        <button 
          className={`category-btn ${!selectedCategory ? 'active' : ''}`}
          onClick={() => onCategoryChange('')}
        >
          All Products
        </button>
        {categories?.map(category => (
          <button 
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

const Cart = ({ items, onUpdateQuantity, onRemoveItem }) => {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <ShoppingCart size={48} />
        <p>Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="cart">
      <h2>Shopping Cart</h2>
      <div className="cart-items">
        {items.map(item => (
          <div key={item._id} className="cart-item">
            <img src={item.image} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h4>{item.name}</h4>
              <p className="cart-item-price">${item.price}</p>
            </div>
            <div className="cart-item-controls">
              <button 
                onClick={() => onUpdateQuantity(item._id, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                <Minus size={16} />
              </button>
              <span className="quantity">{item.quantity}</span>
              <button onClick={() => onUpdateQuantity(item._id, item.quantity + 1)}>
                <Plus size={16} />
              </button>
            </div>
            <button 
              className="remove-btn"
              onClick={() => onRemoveItem(item._id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="cart-total">
        <h3>Total: ${total.toFixed(2)}</h3>
        <button className="checkout-btn">Proceed to Checkout</button>
      </div>
    </div>
  );
};

const ProductsPage = ({ cartItems, onAddToCart, searchResults }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);
  
  const { data: productsData, isLoading, error } = useQuery(
    ['products', selectedCategory, showFeatured],
    () => fetchProducts({ 
      category: selectedCategory || undefined, 
      featured: showFeatured || undefined 
    })
  );

  const { data: categories } = useQuery('categories', fetchCategories);

  const displayProducts = searchResults || productsData?.products || [];

  if (isLoading) return <div className="loading">Loading products...</div>;
  if (error) return <div className="error">Error loading products</div>;

  return (
    <div className="products-page">
      <div className="sidebar">
        <CategoryFilter 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <div className="filters">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={showFeatured}
              onChange={(e) => setShowFeatured(e.target.checked)}
            />
            Featured Products Only
          </label>
        </div>
      </div>
      
      <div className="main-content">
        <div className="products-header">
          <h2>
            {searchResults ? 'Search Results' : 
             selectedCategory ? selectedCategory : 'All Products'}
          </h2>
          <p>{displayProducts.length} products found</p>
        </div>
        
        <div className="products-grid">
          {displayProducts.map(product => (
            <ProductCard 
              key={product._id} 
              product={product} 
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
        
        {displayProducts.length === 0 && (
          <div className="no-products">
            <Grid size={48} />
            <p>No products found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const queryClient = useQueryClient();
  
  const initDataMutation = useMutation(initializeData, {
    onSuccess: () => {
      queryClient.invalidateQueries('products');
      toast.success('Sample data initialized successfully!');
    },
    onError: () => {
      toast.error('Failed to initialize data');
    }
  });

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      <div className="admin-actions">
        <button 
          className="admin-btn"
          onClick={() => initDataMutation.mutate()}
          disabled={initDataMutation.isLoading}
        >
          {initDataMutation.isLoading ? 'Initializing...' : 'Initialize Sample Data'}
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item._id === product._id);
      if (existing) {
        return prev.map(item =>
          item._id === product._id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart!`);
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems(prev =>
      prev.map(item =>
        item._id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleRemoveItem = (productId) => {
    setCartItems(prev => prev.filter(item => item._id !== productId));
    toast.success('Item removed from cart');
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    
    try {
      const results = await searchProducts(query);
      setSearchResults(results);
    } catch (error) {
      toast.error('Search failed');
      console.error('Search error:', error);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Header 
            cartItems={cartItems}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          <main className="main">
            <Routes>
              <Route 
                path="/" 
                element={
                  <ProductsPage 
                    cartItems={cartItems}
                    onAddToCart={handleAddToCart}
                    searchResults={searchResults}
                  />
                } 
              />
              <Route 
                path="/cart" 
                element={
                  <Cart 
                    items={cartItems}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                  />
                } 
              />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </main>
          
          <nav className="bottom-nav">
            <Link to="/" className="nav-item">
              <Home size={20} />
              <span>Home</span>
            </Link>
            <Link to="/cart" className="nav-item">
              <ShoppingCart size={20} />
              <span>Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})</span>
            </Link>
            <Link to="/admin" className="nav-item">
              <Package size={20} />
              <span>Admin</span>
            </Link>
          </nav>
          
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App;