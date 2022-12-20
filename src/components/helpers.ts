import clamp from 'lodash.clamp';
import isEmpty from 'lodash.isempty';
import { bits, concat } from './utils';

export const doGif = (url: string) => {
  // DOM Cache

  // =========

  const dom = {
    errorMessage: document.querySelector('#error-message'),
    filler: document.querySelector('#scrubber-bar-filler') as HTMLDivElement,
    bar: document.querySelector('#scrubber-bar') as HTMLDivElement,
    image: document.querySelector('#image-holder'),
    line: document.querySelector('#scrubber-bar-line') as HTMLDivElement,
    spacer: document.querySelector('#bubble-spacer'),
  };

  const canvas = {
    display: document.querySelector('#canvas-display') as HTMLCanvasElement,
    render: document.querySelector('#canvas-render') as HTMLCanvasElement,
  };
  console.log({ canvas, canvi: document.querySelectorAll('canvas') });

  const context = {
    display: canvas.display.getContext('2d'),
    render: canvas.render.getContext('2d'),
  };

  // Validate URL
  // ============

  let downloadReady;
  let state: any = {};

  function confirmGIF(url) {
    return new Promise(function (ignore, use) {
      if (url === 'undefined') return ignore('undefined');
      const h = new XMLHttpRequest();
      h.open('GET', url);
      h.setRequestHeader('Range', 'bytes=0-5');
      h.onload = () => {
        const validHeaders = ['GIF87a', 'GIF89a'];
        if (validHeaders.includes(h.responseText.substr(0, 6))) use(url);
        else ignore('bad header');
      };
      h.onerror = () => ignore('error loading');
      h.send(null);
    });
  }

  // Download GIF
  // ============

  confirmGIF(url).then(
    reason => {
      showError('Not a valid GIF file.');
      console.log('Could not load GIF from URL because: ', reason);
    },
    validURL => {
      console.log('downloading...', validURL);
      console.time('download');
      const h = new XMLHttpRequest();
      h.responseType = 'arraybuffer';
      h.onload = request => (downloadReady = handleGIF((request.target as any).response));
      h.onerror = showError.bind(null, validURL);
      h.open('GET', validURL, true);
      h.send();
      url = validURL;
    },
  );

  // Initialize player
  // =================

  function init() {
    // Clean up any previous scrubbing
    if (!isEmpty(state)) {
      context.display.clearRect(0, 0, state.width, state.height);
    }

    state = {
      barWidth: null,
      currentFrame: 0,
      debug: {
        showRawFrames: false,
      },
      hasTransparency: false,
      keyFrameRate: 15, // Performance: Pre-render every n frames
      frame() {
        return this.frames[this.currentFrame];
      },
      frameDelay() {
        return this.frame().delayTime / Math.abs(this.speed);
      },
      frames: [],
      playing: false,
      playTimeoutId: null,
      scrubbing: false,
      speed: 1,
      height: 1,
      width: 1,
    };
    (window as any).state = state;
  }

  function showError(msg) {
    dom.errorMessage.innerHTML = `<span class="error">${msg}</span>`;
  }

  function handleGIF(buffer) {
    console.timeEnd('download');
    console.time('parse');
    const bytes = new Uint8Array(buffer);
    init();

    // Image dimensions
    const dimensions = new Uint16Array(buffer, 6, 2);
    [state.width, state.height] = dimensions;
    canvas.render.width = canvas.display.width = state.width;
    canvas.render.height = canvas.display.height = state.height;
    dom.bar.style.width = dom.line.style.width = state.barWidth = `${Math.max(state.width, 450)}px`;
    const content = document.querySelector('#content') as HTMLDivElement;
    content.style.width = state.barWidth;
    content.style.height = state.height;

    // Record global color table
    let pos = 13 + colorTableSize(bytes[10]);
    const gct = bytes.subarray(13, pos);

    state.frames = parseFrames(buffer, pos, gct, state.keyFrameRate);
    console.timeEnd('parse');

    return renderKeyFrames()
      .then(renderIntermediateFrames)
      .then(advanceFrame)
      .catch(err => console.error('Rendering GIF failed!', err));
  }

  function advanceFrame(direction = 'auto') {
    let frameNumber = state.currentFrame;
    if (direction === 'auto') frameNumber += state.speed > 0 ? 1 : -1;
    else frameNumber += direction;

    const loopBackward = frameNumber < 0;
    const loopForward = frameNumber >= state.frames.length;
    const lastFrame = state.frames.length - 1;

    if (loopBackward || loopForward) {
      frameNumber = loopForward ? 0 : lastFrame;
    }

    showFrame(frameNumber);

    if (direction === 'auto') {
      state.playTimeoutId = setTimeout(advanceFrame, state.frameDelay());
    }
  }

  function showFrame(frameNumber) {
    const lastFrame = state.frames.length - 1;
    frameNumber = clamp(frameNumber, 0, lastFrame);
    const frame = state.frames[(state.currentFrame = frameNumber)];
    let fillX = (frameNumber / lastFrame) * state.barWidth - 2;
    dom.filler.style.left = `${Math.max(0, fillX)}`;

    // Draw current frame only if it's already rendered
    if (frame.isRendered || state.debug.showRawFrames) {
      if (state.hasTransparency) {
        context.display.clearRect(0, 0, state.width, state.height);
      }
      return drawFrame(frame, context.display);
    }

    // Rendering not complete. Draw all frames since latest key frame as well
    const first = Math.max(0, frameNumber - (frameNumber % state.keyFrameRate));
    for (let i = first; i <= frameNumber; i++) {
      renderFrame(state.frames[i], context.display);
    }
  }

  const chainPromises = [(x, y) => x.then(y), Promise.resolve()];

  function renderKeyFrames() {
    console.time('render-keyframes');
    return state.frames
      .map(frame => () => {
        return createImageBitmap(frame.blob)
          .then(bitmap => {
            frame.drawable = bitmap;
            return frame;
          })
          .then(renderAndSave);
      })
      .reduce(...chainPromises);
  }

  function renderIntermediateFrames() {
    console.time('background-render');
    return state.frames.map(frame => () => renderAndSave(frame)).reduce(...chainPromises);
  }

  // GIF parsing
  // ===========

  function colorTableSize(packedHeader) {
    const tableFlag = bits(packedHeader, 0, 1);
    if (tableFlag !== 1) return 0;
    const size = bits(packedHeader, 5, 3);
    return 3 * Math.pow(2, size + 1);
  }

  function parseFrames(buffer, pos, gct, keyFrameRate) {
    const bytes = new Uint8Array(buffer);
    const trailer = new Uint8Array([0x3b]);
    const frames = [];
    let gce: any = {
      disposalMethod: 0,
      transparent: 0,
      delayTime: 10,
    };
    let packed;

    // Rendering 87a GIFs didn't work right for some reason.
    // Forcing the 89a header made them work.
    const headerBytes = 'GIF89a'.split('').map(x => x.charCodeAt(0), []);
    const nextBytes = bytes.subarray(6, 13);
    const header = new Uint8Array(13);
    header.set(headerBytes);
    header.set(nextBytes, 6);

    while (pos < bytes.length) {
      switch (bytes[pos]) {
        case 0x21:
          switch (bytes[pos + 1]) {
            case 0xf9: // Graphics control extension...
              packed = bytes[pos + 3];
              gce = {
                pos: pos,
                disposalMethod: bits(packed, 3, 3),
                transparent: bits(packed, 7, 1),
                delayTime: bytes[pos + 4],
                tci: bytes[pos + 6],
              };
              pos += 8;
              break;
            case 0xfe:
              pos -= 12; // Comment extension fallthrough...
            case 0xff:
              pos -= 1; // Application extension fallthrough...
            case 0x01:
              pos += 15; // Plain Text extension fallthrough...
            default: // Skip data sub-blocks
              while (bytes[pos] !== 0x00) pos += bytes[pos] + 1;
              pos++;
          }
          break;
        case 0x2c: {
          // `New image frame at ${pos}`
          const [x, y, w, h] = new Uint16Array(buffer.slice(pos + 1, pos + 9));
          const frame = {
            disposalMethod: gce.disposalMethod,
            delayTime: gce.delayTime < 2 ? 100 : gce.delayTime * 10,
            isKeyFrame: frames.length % keyFrameRate === 0 && !!frames.length,
            isRendered: false,
            number: frames.length + 1,
            transparent: gce.transparent,
            pos: { x, y },
            size: { w, h },
          };

          // We try to detect transparency in first frame after drawing...
          // But we assume transparency if using method 2 since the background
          // could show through
          if (frame.disposalMethod === 2) {
            state.hasTransparency = true;
          }

          // Skip local color table
          const imageStart = pos;
          pos += colorTableSize(bytes[pos + 9]) + 11;

          // Skip data blocks
          while (bytes[pos] !== 0x00) pos += bytes[pos] + 1;
          let imageBlocks = bytes.subarray(imageStart, ++pos);

          // Use a Graphics Control Extension
          if (typeof gce.pos !== 'undefined') {
            const _1 = bytes.subarray(gce.pos, gce.pos + 4); // Begin ext
            const _2 = concat(_1, new Uint8Array([0x00, 0x00])); // Zero out the delay time
            const _3 = concat(_2, bytes.subarray(gce.pos + 6, gce.pos + 8)); // End ext
            imageBlocks = concat(_3, imageBlocks);
          }
          const _1 = concat(header, gct);
          const _2 = concat(_1, imageBlocks);
          const data = concat(_2, trailer);
          (frame as any).blob = new Blob([data], { type: 'image/gif' });
          frames.push(frame);
          break;
        }
        case 0x3b: // End of file
          return frames;
        default:
          return showError('Error: Could not decode GIF');
      }
    }
  }

  // Drawing to canvas
  // =================

  function renderAndSave(frame) {
    renderFrame(frame, context.render);
    if (frame.isRendered || !frame.isKeyFrame) {
      frame.isKeyFrame = true;
      return Promise.resolve();
    }
    return new Promise(function (resolve, _reject) {
      frame.putable = context.render.getImageData(0, 0, state.width, state.height);
      frame.blob = null;
      frame.drawable = null;
      frame.isRendered = true;
      const c = (frame.canvas = document.createElement('canvas'));
      [c.width, c.height] = [state.width, state.height];
      c.getContext('2d').putImageData(frame.putable, 0, 0);
      setTimeout(resolve, 0);
    });
  }

  function renderFrame(frame, ctx) {
    const [_xy, _wh, method] = [frame.pos, frame.size, frame.disposalMethod];
    const full = [0, 0, state.width, state.height];
    const prevFrame = state.frames[frame.number - 2];

    if (!prevFrame) {
      ctx.clearRect(...full); // First frame, wipe the canvas clean
    } else {
      // Disposal method 0 or 1: draw image only
      // Disposal method 2: draw image then erase portion just drawn
      // Disposal method 3: draw image then revert to previous frame
      const [{ x, y }, { w, h }, method] = [prevFrame.pos, prevFrame.size, prevFrame.disposalMethod];
      if (method === 2) ctx.clearRect(x, y, w, h);
      if (method === 3) ctx.putImageData(prevFrame.backup, 0, 0);
    }

    frame.backup = method === 3 ? ctx.getImageData(...full) : null;
    drawFrame(frame, ctx);

    // Check first frame for transparency
    if (!prevFrame && !state.hasTransparency && !state.firstFrameChecked) {
      state.firstFrameChecked = true;
      const data = ctx.getImageData(0, 0, state.width, state.height).data;
      for (let i = 0, l = data.length; i < l; i += 4) {
        if (data[i + 3] === 0) {
          // Check alpha of each pixel in frame 0
          state.hasTransparency = true;
          break;
        }
      }
    }
  }

  function drawFrame(frame, ctx) {
    if (frame.drawable) ctx.drawImage(frame.drawable, 0, 0, state.width, state.height);
    else ctx.putImageData(frame.putable, 0, 0);
  }
};
