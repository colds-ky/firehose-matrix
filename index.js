const button = document.querySelector('button');
button.onclick = startPlaying;

var currentPlaying = 0;
var audioCtx, oscillator, gainNode;
var sample1 = document.querySelector('#sample1');
var sample2 = document.querySelector('#sample2');
var lastSample = sample2;
var lastSampleChange = Date.now();
var lastLetter = Date.now();
var flyingLetterCount = 0;
var lastFreq = 0;

function startPlaying() {
  if (!oscillator) {
    // create web audio api context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // create Oscillator and gain node
    oscillator = audioCtx.createOscillator();
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

    for await (const blockList of coldsky.firehose()) {
      if (currentPlaying !== playing) return;
      for (const block of blockList) {
        msgCount +=
          (block.messages?.length || 0) +
          (block.unexpected?.length || 0);
        if (block.messages?.length) {
          for (const rec of block.messages) {
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
      }

      playCurrent();
      await new Promise(
        resolve => setTimeout(resolve, 30));
    }
  }

  function playCurrent() {
    if (msgCount < 5) return;
    const now = Date.now();

    const freq = Math.max(msgCount / (now - lastSnapshot) * 1000, 16);
    const gain = freq > 200 ? 1 : (201 - freq) / 200 * 5;

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

    button.textContent = Math.round(msgCount / (now - lastSnapshot) * 1000) + 'Hz firehose...';
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

  };

}

function stopPlaying() {
  currentPlaying++;
  button.onclick = startPlaying;
  button.textContent = 'Listen again!';
  oscillator.stop();
  oscillator = undefined;
}

button.textContent = 'Listen!';