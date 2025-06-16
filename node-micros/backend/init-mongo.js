// MongoDB initialization script
db = db.getSiblingDB('ecommerce');

// Create collections with validation
db.createCollection('products', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'description', 'price', 'category'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Product name must be a string and is required'
        },
        description: {
          bsonType: 'string',
          description: 'Product description must be a string and is required'
        },
        price: {
          bsonType: 'number',
          minimum: 0,
          description: 'Price must be a positive number and is required'
        },
        category: {
          bsonType: 'string',
          description: 'Category must be a string and is required'
        },
        stock: {
          bsonType: 'number',
          minimum: 0,
          description: 'Stock must be a non-negative number'
        },
        featured: {
          bsonType: 'bool',
          description: 'Featured must be a boolean'
        }
      }
    }
  }
});

db.createCollection('users');
db.createCollection('orders');

// Create indexes for better performance
db.products.createIndex({ category: 1 });
db.products.createIndex({ featured: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ name: 'text', description: 'text' });

db.users.createIndex({ email: 1 }, { unique: true });

db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ createdAt: -1 });

print('Database initialized successfully!');