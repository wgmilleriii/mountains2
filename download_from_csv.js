import fs from 'fs';
import path from 'path';
import https from 'https';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, 'data', 'data.csv');
const DOWNLOAD_DIR = path.join(__dirname, 'dem_files');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// Helper to download a file
function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const filepath = path.join(DOWNLOAD_DIR, filename);
        if (fs.existsSync(filepath)) {
            console.log(`Already exists: ${filename}`);
            return resolve();
        }
        console.log(`Downloading: ${url}`);
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(filepath, () => {});
                return reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function main() {
    const rl = readline.createInterface({
        input: fs.createReadStream(CSV_FILE),
        crlfDelay: Infinity
    });

    const tiffUrls = [];
    for await (const line of rl) {
        // Look for .tif links
        const match = line.match(/https?:[^,\s]+\.tif/);
        if (match) {
            tiffUrls.push(match[0]);
        }
    }
    console.log(`Found ${tiffUrls.length} GeoTIFF URLs.`);

    for (const url of tiffUrls) {
        const filename = url.split('/').pop();
        try {
            await downloadFile(url, filename);
            // Optional: add a delay to be polite
            await new Promise(res => setTimeout(res, 500));
        } catch (err) {
            console.error(`Error downloading ${url}:`, err.message);
        }
    }
    console.log('All downloads complete!');
}

main().catch(console.error); 