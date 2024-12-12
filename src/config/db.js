// src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;