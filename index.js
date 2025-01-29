// @ts-check

/// <reference types="coldsky" />

const button = /** @type {HTMLButtonElement} */(document.querySelector('button'));
button.onclick = startPlaying;

var currentPlaying = 0;
/** @type {AudioContext} */
var audioCtx;
/** @type {OscillatorNode} */
var oscillator;
var gainNode;
var sample1 = document.querySelector('#sample1');
var sample2 = document.querySelector('#sample2');
var lastSample = sample2;
var lastSampleChange = Date.now();
var lastLetter = Date.now();
var flyingLetterCount = 0;
var lastFreq = 0;
var startPlayingTime;

function startPlaying() {
  startPlayingTime = Date.now();

  if (!oscillator) {
    // create web audio api context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // create Oscillator and gain node
    oscillator = audioCtx.createOscillator();
    // oscillator.type = 'square';
    oscillator.detune.value = 99;
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 5;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);


    // set options for the oscillator
    oscillator.detune.value = 100; // value in cents
  }

  button.onclick = stopPlaying;
  button.textContent = 'Connecting 50Hz...';

  oscillator.frequency.value = 50;
  oscillator.frequency.setValueAtTime(50, audioCtx.currentTime);

  oscillator.start(0);

  let lastSnapshot = Date.now();
  let msgCount = 0;
  let lastMsg;

  document.body.onmousemove = playCurrent;
  document.body.onclick = playCurrent;
  document.body.onmousedown = playCurrent;
  document.body.onmouseup = playCurrent;

  pumpFirehose();

  async function pumpFirehose() {
    const playing = currentPlaying = currentPlaying + 1;
    let startTime = Date.now();
    let totalMsgCount = 0;

    // @ts-ignore
    const cs = /** @type {import('coldsky')} */(coldsky);
    for await (const block of cs.firehose()) {
      if (currentPlaying !== playing) return;
      msgCount +=
        block?.length || 0;
      if (!totalMsgCount) {
        totalMsgCount = msgCount;
        startTime = Date.now(); // reset timer, to account for load connection latency;
      }

      if (block?.length) {
        for (const rec of block) {
          if (!rec.text) continue;
          lastMsg = rec;

          if (flyingLetterCount < 600) {
            lastLetter = Date.now();
            flyingLetterCount++;
            const letters = [...rec.text.replace(/\s/g, '')];


            const flyTimeSec = 6 + Math.random() * 30;

            const letterElem = document.createElement('div');
            letterElem.className = 'letter';
            letterElem.style.left = (Math.random() * 100) + '%';
            letterElem.style.transitionDuration = flyTimeSec.toFixed(1) + 's';

            for (let i = 0; i < Math.min(5, letters.length); i++) {
              const letter = letters[i];
              const letterXElem = document.createElement('div');
              letterXElem.className = 'letter-' + (i + 1);
              letterXElem.textContent = letter.toUpperCase();
              if (letterElem.firstChild) letterElem.insertBefore(letterXElem, letterElem.firstChild);
              else letterElem.appendChild(letterXElem);
            }

            document.body.appendChild(letterElem);
            setTimeout(() => {
              letterElem.style.transform = 'translateY(125vh)';
              setTimeout(() => {
                letterElem.remove();
                flyingLetterCount--;
              }, flyTimeSec * 1000 + 10);
            }, 1);
          }
        }
      }

      playCurrent();
      await new Promise(
        resolve => setTimeout(resolve, 30));
    }
  }

  function playCurrent() {
    if (msgCount < 5) return;
    const now = Date.now();

    let freq = msgCount / (now - lastSnapshot) * 1000;
    var FREQ_START_ADJUST = 40;
    var FREQ_MIN = 9;
    var FREQ_AMPLIFY_LOW = 200;

    if (freq < FREQ_START_ADJUST) freq = freq * (FREQ_START_ADJUST - FREQ_MIN) / FREQ_START_ADJUST + FREQ_MIN;
    const gain = freq > FREQ_AMPLIFY_LOW ? 1 : (FREQ_AMPLIFY_LOW + 1 - freq) / FREQ_AMPLIFY_LOW * 7;

    const targetTime =
      audioCtx.currentTime +
      ((now - lastSnapshot) / 2000);

    if (lastFreq) {
      const steps = [];
      const timeStep = Math.max(
        Math.min(3 / lastFreq, 3 / freq),
        0.0025);

      for (let i = timeStep; i < targetTime - audioCtx.currentTime - timeStep; i += timeStep) {
        const tm = audioCtx.currentTime + i;
        const tmFreq = lastFreq + (freq - lastFreq) * (i / (targetTime - audioCtx.currentTime));
        const tmGain = tmFreq > 200 ? 1 : (201 - tmFreq) / 200 * 5

        oscillator.frequency.setValueAtTime(tmFreq, tm);
        gainNode.gain.setValueAtTime(tmGain, tm);
        steps.push(tmFreq);
      }
    }
    oscillator.frequency.setValueAtTime(freq, targetTime);
    gainNode.gain.setValueAtTime(gain, targetTime);

    lastFreq = freq;

    const hz = Math.round(msgCount / (now - lastSnapshot) * 1000);
    addChartFreq(msgCount);
    button.textContent = hz + 'Hz firehose...';
    document.title = 'Firehose Geiger ' + hz + 'Hz';
    if (lastMsg && now - lastSampleChange > 600) {
      var nextSample = lastSample === sample1 ? sample2 : sample1;
      nextSample.textContent = '';
      const lines = (lastMsg.text || '').split('\n');
      for (const ln of lines.slice(0, 5)) {
        const lnDiv = document.createElement('div');
        lnDiv.textContent = ln;
        nextSample.appendChild(lnDiv);
      }
      lastSample.style.transition =
        nextSample.style.transition =
        'opacity ' + Math.round((now - lastSampleChange) * 1) + 'ms';
      const set1 = nextSample;
      const set0 = lastSample;
      setTimeout(() => {
        set1.style.opacity = 1;
        set0.style.opacity = 0;
      }, 0);

      lastSampleChange = now;
      lastSample = nextSample;
    }

    console.log({ msgCount, elapsed: now - lastSampleChange });

    msgCount = 0;
    lastSnapshot = now;
  }
}

/**
 * @type {{
 *  start: number;
 *  end: number;
 *  messages: number;
 *  elem: HTMLElement;
 * }[]}
 */
var chartFreqs = [];
/** @type {HTMLElement} */
var line100;
/** @type {HTMLElement} */
var line50;

var CHART_FREQ_COUNT = 50;
var CHART_FREQ_INTERVAL_MSEC = 1500;
var minichart;
var minichartHeightVw = 10;

/**
* @param {number} msgCount
*/
function addChartFreq(msgCount) {

  if (!minichart) {
    minichart = /** @type {HTMLElement} */(document.getElementById('minichart'));
    minichart.style.height = '10vw';
    minichartHeightVw = 10 * button.getBoundingClientRect().height / minichart.getBoundingClientRect().height;
    minichart.style.height = '100%';
  }

  const now = Date.now();

  if (!chartFreqs.length || now - chartFreqs[chartFreqs.length - 1].start > CHART_FREQ_INTERVAL_MSEC) {
    chartFreqs.push({
      start: chartFreqs.length ? chartFreqs[chartFreqs.length - 1].end : startPlayingTime,
      end: now,
      messages: msgCount,
      elem: document.createElement('div')
    });
    chartFreqs[chartFreqs.length - 1].elem.className = 'chart-freq';
    minichart.appendChild(chartFreqs[chartFreqs.length - 1].elem);
    if (chartFreqs.length > CHART_FREQ_COUNT) {
      const cf = chartFreqs.shift();
      cf?.elem.remove();
    }
  } else {
    chartFreqs[chartFreqs.length - 1].end = now;
    chartFreqs[chartFreqs.length - 1].messages += msgCount;
  }

  updateTransforms();

  function updateTransforms() {
    let maxFreq = chartFreqs[0].messages / (now - chartFreqs[0].start) * 1000;
    let allEqual = true;
    for (const cf of chartFreqs) {
      const freq = cf.messages / (cf.end - cf.start) * 1000;
      if (freq !== maxFreq) allEqual = false;
      if (freq > maxFreq) maxFreq = freq;
    }

    const w = (92 / CHART_FREQ_COUNT).toFixed(1) + '%';
    for (let i = 0; i < chartFreqs.length; i++) {
      const cf = chartFreqs[i];
      const freq = cf.messages / (cf.end - cf.start) * 1000;
      const tr = allEqual ? 'translateY(-' + (minichartHeightVw / 2).toFixed(1) + 'vw)' :
        'translateY(-' + (0.1 + 0.7 * minichartHeightVw * freq / maxFreq).toFixed(1) + 'vw)';

      if (cf.elem.style.transform !== tr)
        cf.elem.style.transform = tr;
      const left = (100 * (i + CHART_FREQ_COUNT - chartFreqs.length) / CHART_FREQ_COUNT).toFixed(1) + '%';
      if (cf.elem.style.left !== left)
        cf.elem.style.left = left;
      if (cf.elem.style.width !== w)
        cf.elem.style.width = w;
    }

    if (chartFreqs.length && !line100) {
      line100 = document.createElement('div');
      line50 = document.createElement('div');
      line100.className = 'line-100';
      line50.className = 'line-50';
      line50.style.cssText = line100.style.cssText =
        'position: absolute; bottom: 0; left: 0; width: 100%; height: 1px;' +
        'background: lime; z-index: 1000; pointer-events: none;' +
        'transition: transform 0.5s, opacity 0.5s';
      minichart.appendChild(line100);
      minichart.appendChild(line50);
    }
  
    if (line100) {
      line100.style.transform =
        'translateY(-' + (0.1 + 0.7 * minichartHeightVw * Math.min(100, maxFreq) / maxFreq).toFixed(1) + 'vw)';
      line50.style.transform =
        'translateY(-' + (0.1 + 0.7 * minichartHeightVw * Math.min(50, maxFreq) / maxFreq).toFixed(1) + 'vw)';
      line100.style.opacity = chartFreqs.length > 2 && maxFreq > 100 ? '1' : '0';
      line50.style.opacity = chartFreqs.length > 2 && maxFreq > 50 ? '0.3' : '0';
    }
  }

}

function stopPlaying() {
  currentPlaying++;
  button.onclick = startPlaying;
  button.textContent = 'Listen again!';
  document.title = 'Firehose Geiger';
  oscillator.stop();
  oscillator = undefined;
}

button.textContent = 'Listen!';
if (/start|play|listen/i.test(location.search || '')) startPlaying();