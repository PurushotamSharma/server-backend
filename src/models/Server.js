const mongoose = require('mongoose');

const commandHistorySchema = new mongoose.Schema({
    command: String,
    output: String,
    error: String,
    executionTime: Number,
    status: { type: String, enum: ['success', 'error'] },
    timestamp: { type: Date, default: Date.now }
});

const serverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    host: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    privateKey: {
        type: String,
        required: true,
        select: false // Won't be returned in queries by default
    },
    isConnected: {
        type: Boolean,
        default: false
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    currentDirectory: {
        type: String,
        default: '/home/ubuntu'
    },
    systemInfo: {
        type: Map,
        of: String,
        default: {}
    },
    commandHistory: [commandHistorySchema],
    bookmarkedDirectories: [{
        name: String,
        path: String
    }]
}, {
    timestamps: true
});

// Add method to add command to history
serverSchema.methods.addToHistory = async function(command, result) {
    this.commandHistory.push({
        command,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
        status: result.success ? 'success' : 'error'
    });

    if (this.commandHistory.length > 100) {
        this.commandHistory.shift(); // Keep only last 100 commands
    }

    return this.save();
};

module.exports = mongoose.model('Server', serverSchema);

