/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// SSL configuration script for development
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

// Self-signed certificate generation (for development only)
// For production environments, use Let's Encrypt or valid certificates

const app = express();

// Serve VS Code static files
app.use(express.static(path.join(__dirname, 'out')));

const httpsOptions = {
	// Self-signed certificate (for development)
	// openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
	// key: fs.readFileSync('key.pem'),
	// cert: fs.readFileSync('cert.pem')
};

console.log('To run VS Code Web with HTTPS:');
console.log('1. Generate certificate:');
console.log('   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes');
console.log('2. Access from mobile: https://192.168.35.209:8443');
console.log('3. In browser click "Advanced" → "Proceed to unsafe"');
