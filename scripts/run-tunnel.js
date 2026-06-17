const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'tunnel.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, formattedMsg, 'utf8');
  console.log(msg);
}

fs.writeFileSync(logFile, 'Starting auto-restarting tunnel with local_host 127.0.0.1...\n', 'utf8');

async function startTunnel() {
  try {
    log('Attempting to open tunnel...');
    const tunnel = await localtunnel({ 
      port: 3000, 
      host: 'http://loca.lt',
      local_host: '127.0.0.1'
    });
    log(`Tunnel opened successfully! your url is: ${tunnel.url}`);

    tunnel.on('close', () => {
      log('Tunnel closed. Reconnecting in 5 seconds...');
      setTimeout(startTunnel, 5000);
    });

    tunnel.on('error', (err) => {
      log(`Tunnel error: ${err.message}. Reconnecting in 5 seconds...`);
      setTimeout(startTunnel, 5000);
    });

  } catch (err) {
    log(`Failed to start tunnel: ${err.message}. Retrying in 10 seconds...`);
    setTimeout(startTunnel, 10000);
  }
}

startTunnel();
