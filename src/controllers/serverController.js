// src/controllers/serverController.js
const Server = require('../models/Server');
const SSHService = require('../services/sshService');

const DEFAULT_COMMANDS = [
    'df -h',              // Disk usage
    'free -h',           // Memory usage
    'uptime',           // System uptime
    'w',               // Who is logged in
    'top -b -n 1'     // Process information
];

const serverController = {
    async addServer(req, res) {
        try {
            const { name, host, username, privateKey } = req.body;
            
            // Test connection before saving
            const testConnection = await SSHService.checkConnection({
                host,
                username,
                privateKey
            });

            if (!testConnection) {
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
                defaultCommands: DEFAULT_COMMANDS
            });

            await server.save();

            res.status(201).json({
                success: true,
                server: {
                    id: server._id,
                    name: server.name,
                    host: server.host,
                    isConnected: server.isConnected
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async executeCommand(req, res) {
        try {
            const { serverId, command } = req.body;
            const server = await Server.findById(serverId);

            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Server not found'
                });
            }

            const result = await SSHService.executeCommand(server, command);
            
            // Format the output
            const formattedOutput = result.output
                .split('\n')
                .filter(line => line.trim())
                .join('\n');

            res.json({
                success: true,
                output: formattedOutput
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async checkServerStatus(req, res) {
        try {
            const { serverId } = req.params;
            const server = await Server.findById(serverId);

            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Server not found'
                });
            }

            const isConnected = await SSHService.checkConnection(server);
            
            await Server.findByIdAndUpdate(serverId, {
                isConnected,
                lastChecked: new Date()
            });

            res.json({
                success: true,
                isConnected
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async addCustomCommand(req, res) {
        try {
            const { serverId, command, description } = req.body;
            const server = await Server.findById(serverId);

            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Server not found'
                });
            }

            server.customCommands.push({
                command,
                description
            });

            await server.save();

            res.json({
                success: true,
                command: server.customCommands[server.customCommands.length - 1]
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = serverController;