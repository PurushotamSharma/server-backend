// backend/src/routes/serverRoutes.js
const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const SSHService = require('../services/sshService');

// Get all servers
router.get('/', async (req, res) => {
    try {
        const servers = await Server.find().select('-privateKey');
        console.log(`Found ${servers.length} servers`);
        res.json({ success: true, servers });
    } catch (err) {
        console.error('Error fetching servers:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add new server
router.post('/', async (req, res) => {
    try {
        const { name, host, username, privateKey } = req.body;
        console.log(`Adding new server: ${name} (${host})`);

        // Test connection before saving
        const isConnected = await SSHService.checkConnection({
            host,
            username,
            privateKey
        });

        if (!isConnected) {
            return res.status(400).json({
                success: false,
                message: 'Could not establish SSH connection'
            });
        }

        const server = new Server({
            name,
            host,
            username,
            privateKey,
            isConnected: true,
            lastChecked: new Date()
        });

        await server.save();
        console.log('Server saved successfully:', server._id);

        res.status(201).json({
            success: true,
            server: {
                id: server._id,
                name: server.name,
                host: server.host,
                isConnected: true
            }
        });
    } catch (err) {
        console.error('Error adding server:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// Execute command
router.post('/:serverId/execute', async (req, res) => {
    try {
        const { command } = req.body;
        const server = await Server.findById(req.params.serverId)
            .select('+privateKey');

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        console.log(`Executing command on ${server.name}: ${command}`);

        // Build command with current directory context
        let fullCommand = command;
        if (server.currentDirectory && !command.startsWith('cd')) {
            fullCommand = `cd ${server.currentDirectory} && ${command}`;
        }

        const result = await SSHService.executeCommand({
            host: server.host,
            username: server.username,
            privateKey: server.privateKey
        }, fullCommand);

        // Update current directory for cd commands
        if (command.startsWith('cd ') && result.success) {
            server.currentDirectory = result.output.trim();
        }

        // Add command to history
        await server.addToHistory(command, result);

        res.json({
            success: result.success,
            output: result.output,
            error: result.error,
            currentDirectory: server.currentDirectory,
            executionTime: result.executionTime
        });
    } catch (error) {
        console.error('Command execution error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get command history
router.get('/:serverId/history', async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        res.json({
            success: true,
            history: server.commandHistory
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Check server status
router.get('/:serverId/status', async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId)
            .select('+privateKey');

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const isConnected = await SSHService.checkConnection({
            host: server.host,
            username: server.username,
            privateKey: server.privateKey
        });

        await Server.findByIdAndUpdate(req.params.serverId, {
            isConnected,
            lastChecked: new Date()
        });

        res.json({
            success: true,
            isConnected,
            serverName: server.name,
            currentDirectory: server.currentDirectory
        });
    } catch (err) {
        console.error('Status check error:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;