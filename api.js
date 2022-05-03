const {parentPort} = require('worker_threads');
const express = require('express');
const pigpio = require('js-pigpio');

const PORT = 8080;
const MAX_DURATION = 15 * 60 * 1000;

const app = express();
const PiGPIO = new pigpio();

var heaterEnabled = false;
var timerEnabled = false;
var timerStart = Date.now();
var timerEnd = Date.now();

app.use(express.json());

app.get('/status', function (req, res) {
  res.json({
    heater: heaterEnabled,
    timer: {
      enabled: timerEnabled,
      start: timerStart,
      end: timerEnd
    }
  });
});

app.post('/timer', function (req, res) {
  let {enable, duration} = req.body.enable;

  if (typeof(enable) !== 'boolean')
    return res.status(400).json({error: 'enable is not a boolean'});

  if (typeof(duration) !== 'number' && !isNaN(duration))
    return res.status(400).json({error: 'duration is not a valid number'});

  duration = Math.floor(duration);
  if (duration > MAX_DURATION)
    return res.status(400).json({error: 'duration is too high'});

  if (heaterEnabled === true && enable === true)
    return res.status(400).json({error: 'Can not start another timer while one is active'});

  if (enable === false) {
    timerEnabled = false;
    timerEnd = Date.now();

    PiGPIO.write(17, 0, (level) => {
      heaterEnabled = level === 1;

      res.json({
        heater: heaterEnabled,
        timer: {
          enabled: timerEnabled,
          start: timerStart,
          end: timerEnd
        }
      });
    });
  } else {
    timerEnabled = true;
    timerStart = Date.now();
    timerEnd = Date.now() + duration;

    PiGPIO.write(17, 1, (level) => {
      heaterEnabled = level === 1;

      res.json({
        heater: heaterEnabled,
        timer: {
          enabled: timerEnabled,
          start: timerStart,
          end: timerEnd
        }
      });
    });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Listening on 0.0.0.0:${PORT}`);
  PiGPIO.pi('127.0.0.1', 8888, (err) => {
    PiGPIO.write(17, 0);

    setInterval(timerWorker, 50);
  });
});

function timerWorker() {
  if (timerEnabled && Date.now() >= timerEnd) {
    timerEnabled = false;
    PiGPIO.write(17, 0, (level) => {
      heaterEnabled = level === 1;
    });
  }
}

parentPort.on('message', (nonce) => {
  parentPort.postMessage(nonce);
});
