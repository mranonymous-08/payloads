const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Helper to generate unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const server = http.createServer((req, res) => {
    
    // 1. Serve main.html
    if (req.url === '/' || req.url === '/main.html') {
        const filePath = path.join(__dirname, 'main.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // 2. API: Assign Session
    if (req.method === 'POST' && req.url === '/api/assign-section') {
        const sessionId = generateId();
        const sectionId = `Main.${Math.floor(Math.random() * 1000)}`;
        
        console.log(`Assigned Section: ${sectionId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessionId, sectionId }));
        return;
    }

    // 3. API: Handle Video Upload (Multipart/Form-Data parsing manually)
    if (req.method === 'POST' && req.url === '/api/upload') {
        let body = '';
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('multipart/form-data')) {
            res.writeHead(400);
            res.end('Invalid content type');
            return;
        }

        // Extract boundary from content-type header
        const boundary = contentType.split('=')[1];
        
        req.on('data', (chunk) => {
            body += chunk;
        });

        req.on('end', () => {
            try {
                // Simple parsing for multipart form data
                const boundaryMarker = `\r\n--${boundary}\r\n`;
                const parts = body.split(boundaryMarker).filter(p => p.length > 0);
                
                // The last part usually ends with --\r\n, so we ignore empty strings
                let videoData = null;
                let fileName = 'chunk_0.webm';
                let sectionId = 'default';
                let chunkIndex = '0';

                for (let part of parts) {
                    if (part.includes('filename="video"')) {
                        // This is the video part
                        const headerEnd = part.indexOf('\r\n\r\n');
                        if (headerEnd !== -1) {
                            videoData = part.slice(headerEnd + 4);
                            // Remove trailing boundary marker if present
                            if (videoData.endsWith('\r\n')) {
                                videoData = videoData.slice(0, -2);
                            }
                        }
                    } else if (part.includes('name="sectionId"')) {
                        // Extract text value
                        const match = part.match(/(.+)\r\n\r\n/);
                        if (match) sectionId = match[1].trim();
                    } else if (part.includes('name="chunkIndex"')) {
                        const match = part.match(/(.+)\r\n\r\n/);
                        if (match) chunkIndex = match[1].trim();
                    }
                }

                if (videoData) {
                    // Ensure directory exists
                    const sectionDir = path.join(UPLOAD_DIR, sectionId);
                    if (!fs.existsSync(sectionDir)) {
                        fs.mkdirSync(sectionDir, { recursive: true });
                    }

                    // Save file
                    const filePath = path.join(sectionDir, `chunk_${chunkIndex}.webm`);
                    fs.writeFileSync(filePath, Buffer.isBuffer(videoData) ? videoData : Buffer.from(videoData));
                    
                    console.log(`Saved chunk ${chunkIndex} for section ${sectionId}`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Chunk saved' }));
                } else {
                    throw new Error('No video data received');
                }

            } catch (e) {
                console.error('Error saving video:', e);
                res.writeHead(500);
                res.end('Error saving video');
            }
        });
        return;
    }

    // Fallback
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/main.html in your browser`);
    console.log('NO INSTALLATION REQUIRED! Just run: node server.js');
});