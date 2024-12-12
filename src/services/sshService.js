// backend/src/services/sshService.js
const { Client } = require('ssh2');

class SSHService {
    static async executeCommand(serverDetails, command, options = {}) {
        const startTime = Date.now();
        const timeout = options.timeout || 60000; // Default 1 minute timeout

        return new Promise((resolve, reject) => {
            const conn = new Client();
            let commandOutput = '';
            let errorOutput = '';
            let commandTimeout;

            // Modify command based on type
            const finalCommand = this.preprocessCommand(command);

            // Set command timeout
            commandTimeout = setTimeout(() => {
                conn.end();
                reject(new Error(`Command timed out after ${timeout/1000} seconds`));
            }, timeout);

            conn.on('ready', () => {
                console.log(`SSH Connection established to ${serverDetails.host}`);
                
                // Execute with pseudo-terminal for interactive commands
                conn.exec(finalCommand, { pty: true }, (err, stream) => {
                    if (err) {
                        clearTimeout(commandTimeout);
                        conn.end();
                        return reject(err);
                    }

                    stream.on('data', (data) => {
                        const output = data.toString();
                        commandOutput += output;
                        
                        // Handle interactive prompts
                        this.handleInteractivePrompts(stream, output);
                    });

                    stream.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                        console.error('Command error output:', data.toString());
                    });

                    stream.on('close', (code) => {
                        clearTimeout(commandTimeout);
                        conn.end();
                        
                        const executionTime = Date.now() - startTime;
                        resolve({
                            success: code === 0,
                            output: commandOutput.trim(),
                            error: errorOutput.trim(),
                            code,
                            executionTime
                        });
                    });
                });
            });

            conn.on('error', (err) => {
                clearTimeout(commandTimeout);
                console.error('SSH connection error:', err);
                reject(err);
            });

            // Connection config
            conn.connect({
                host: serverDetails.host,
                username: serverDetails.username,
                privateKey: serverDetails.privateKey,
                readyTimeout: 20000,
                keepaliveInterval: 10000,
                debug: process.env.NODE_ENV === 'development' ? 
                    (msg) => console.log('SSH Debug:', msg) : undefined
            });
        });
    }

    static preprocessCommand(command) {
        if (command.startsWith('cd ')) {
            // For cd commands, combine with pwd to show new location
            return `cd ${command.slice(3)} && pwd`;
        } else if (command.includes('apt-get') || command.includes('apt')) {
            // Auto-confirm apt commands
            return command
                .replace('apt-get', 'apt-get -y')
                .replace('apt ', 'apt -y ');
        } else if (command.includes('sudo')) {
            // Handle sudo commands
            return `sudo -S ${command.replace('sudo ', '')}`;
        }
        return command;
    }

    static handleInteractivePrompts(stream, output) {
        const lowerOutput = output.toLowerCase();
        
        // Handle different types of prompts
        if (lowerOutput.includes('password')) {
            stream.write('\n'); // For sudo password prompts
        } else if (lowerOutput.includes('[y/n]') || 
                   lowerOutput.includes('(y/n)') ||
                   lowerOutput.includes('yes/no')) {
            stream.write('y\n');
        } else if (lowerOutput.includes('[ok]')) {
            stream.write('\n');
        }
    }

    static async checkConnection(serverDetails) {
        try {
            console.log('Testing connection to:', serverDetails.host);
            const result = await this.executeCommand(
                serverDetails,
                'echo "Connection Test"',
                { timeout: 10000 }
            );
            return result.success;
        } catch (error) {
            console.error('Connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = SSHService;