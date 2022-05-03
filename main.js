const crypto = require('crypto');
const {Worker} = require('worker_threads');

const pigpio = require('js-pigpio');

const MAX_RESTARTS = 5;
const MAX_TIMEOUT = 10 * 1000;

const PiGPIO = new pigpio();

function main() {
  let restarts = 0;

  function onError() {
    // ESTOP
    PiGPIO.pi('127.0.0.1', 8888, (err) => {
      PiGPIO.write(17, 0);
    });

    if (restarts >= MAX_RESTARTS) return;

    restarts++;
    console.log(`[Watchdog] Attemping restart... (${restarts}/${MAX_RESTARTS})`);
    startWatchdog(onError);
  }

  startWatchdog(onError);
}

function startWatchdog(onError) {
  let lastPong = Date.now();
  let nonce;

  let worker = new Worker('./api.js');

  worker.on('error', (err) => {
    console.log(`[Watchdog] Error thrown: ${err}`);
  });
  worker.on('exit', (exitCode) => {
    console.log(`[Watchdog] Thread exited with code: ${exitCode}`);
    clearInterval(timer);
    onError();
  });
  worker.on('message', (recvNonce) => {
    recvNonce = Buffer.from(recvNonce);

    if (!nonce.equals(recvNonce)) {
      console.log('[Watchdog] Nonce mismatch triggered');
      worker.terminate();
    } else {
      lastPong = Date.now();
    }
  });

  let timer = setInterval(() => {
    if ((Date.now() - lastPong) > MAX_TIMEOUT) {
      console.log('[Watchdog] Timeout triggered')
      worker.terminate();
    } else {
      nonce = crypto.randomBytes(10);
      worker.postMessage(nonce);
    }
  }, 2 * 1000);
}

main();
