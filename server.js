// Importing required modules
const http = require('http');
const https = require('https');
const fs = require('fs');
const ws = require('ws');

// Create a Set to store clients (websockets)
const clients = new Set();

// Create options object to provide server keys
const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/example.com/privkey.pem'), // Remember to change the domain name
    cert: fs.readFileSync('/etc/letsencrypt/live/example.com/fullchain.pem') // Remember to change the domain name
};

// Function to handle a new socket connection
const handleSocketConnection = (socket) => {
    // Add the new client to the clients Set
    clients.add(socket);
    console.log('new connection');

    // Send a welcome message to the new client
    socket.send(`Welcome to the chat room! There are ${clients.size} users online.`);

    // Send a message to all connected clients that a new client has joined
    for (const client of clients) {
        if (client.readyState === ws.OPEN && client !== socket) {
            client.send(`A new user has joined the chat room. There are now ${clients.size} users online.`);
        }
    }

    // Handle the 'message' event on the socket
    socket.on('message', (message) => {
        // Truncate the message to 500 characters
        const truncatedMessage = message.slice(0, 500);
        // Send the truncated message to all connected clients
        for (const client of clients) {
            if (client.readyState === ws.OPEN) {
                client.send(truncatedMessage, { binary: false });
            }
        }
    });

    // Handle the 'close' event on the socket
    socket.on('close', () => {
        // Remove the client from the clients Set
        clients.delete(socket);
        console.log('connection closed');

        // Send a message to all connected clients that a client has left
        for (const client of clients) {
            if (client.readyState === ws.OPEN) {
                client.send(`A user has left the chat room. There are now ${clients.size} users online.`);
            }
        }
    });
};

// Function to handle an HTTP request
const handleHttpRequest = (request, response) => {
    // If the request is for a WebSocket connection, upgrade the connection
    if (request.url === '/ws' && request.headers.upgrade &&
        request.headers.upgrade.toLowerCase() === 'websocket' &&
        request.headers.connection.match(/\bupgrade\b/i)) {
        wss.handleUpgrade(request, request.socket, Buffer.alloc(0), handleSocketConnection);
    }
    // If the request is for the home page, serve the index.html file
    else if (request.url === '/') {
        fs.access('./public/index.html', fs.constants.F_OK, (err) => {
            if (err) {
                response.writeHead(404);
                response.end();
                return;
            }
            fs.createReadStream('./public/index.html').pipe(response);
        });
    }
    // For all other requests,

    // respond with a 404 error
    else {
        response.writeHead(404);
        response.end();
    }
};

// Create the HTTP server
const server = http.createServer(handleHttpRequest);

// Create the WebSocket server and attach it to the HTTP server
const wss = new ws.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, handleSocketConnection);
});

// Create the HTTPS server
const secureServer = https.createServer(options, handleHttpRequest);

// Create the secure WebSocket server and attach it to the HTTPS server
const secureWss = new ws.Server({ noServer: true });
secureServer.on('upgrade', (request, socket, head) => {
    secureWss.handleUpgrade(request, socket, head, handleSocketConnection);
});

// Start listening for HTTP and HTTPS requests
const PORT = process.env.PORT || 8080;
const SECURE_PORT = process.env.SECURE_PORT || 8443;

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${ PORT }`);
});

secureServer.listen(SECURE_PORT, () => {
    console.log(`HTTPS server listening on port ${ SECURE_PORT }`);
});

// Handle errors
server.on('error', (error) => {
    console.error('HTTP server error:', error);
});

secureServer.on('error', (error) => {
    console.error('HTTPS server error:', error);
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

secureWss.on('error', (error) => {
    console.error('Secure WebSocket server error:', error);
});
