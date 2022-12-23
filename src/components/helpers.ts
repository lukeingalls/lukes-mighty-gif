import clamp from 'lodash.clamp';
import download from './lukes-mighty-gif/lib/download';
import { bits, concat } from './utils';

const chainPromises = [(x: any, y: any) => x.then(y), Promise.resolve()] as const;

const COULDNT_FETCH_RESOURCE = new Error('Could not fetch resource');
const COULDNT_DECODE_GIF = new Error('Could not decode GIF');
const NOT_READY = new Error('Not ready');
const NOT_SUPPORTED = new Error('Not supported');

type Frame = {
  pos: {
    x: number;
    y: number;
  };
  size: {
    w: number;
    h: number;
  };
  disposalMethod: number;
  isRendered: boolean;
  drawable?: ImageBitmap;
  blob?: ImageBitmapSource;
  delayTime: number;
  backup?: ImageData;
  putable?: ImageData;
  number: number;
  isKeyFrame: boolean;
  transparent: boolean;
};

export default class Gif {
  private _url: string;
  private gif_data: ArrayBuffer;
  private render_canvas: HTMLCanvasElement;
  private render_canvas_ctx: CanvasRenderingContext2D;

  // =====================
  // READ-ONLY PROPERTIES
  // =====================

  private _frames: Array<Frame>;
  get frames() {
    return this._frames;
  }

  private _width: number;
  get width() {
    return this._width;
  }

  private _height: number;
  get height() {
    return this._height;
  }

  private _duration: number;
  get duration() {
    return this._duration;
  }

  private setMetadata({ width, height, duration }: { width?: number; height?: number; duration?: number }) {
    if (typeof width === 'number') this._width = width;
    if (typeof height === 'number') this._height = height;
    if (typeof duration === 'number') {
      this._duration = duration;
      this.onDurationChange(duration);
    }
    this.onLoadedMetadata();
  }

  public error: Error;

  // =====================
  // EVENT LISTENERS
  // =====================

  private _onDurationChange: (duration: number) => void = () => {};

  get onDurationChange() {
    return this._onDurationChange;
  }

  set onDurationChange(fn: (duration: number) => void) {
    this._onDurationChange = fn;
  }

  private _onError: (error: Error) => void = error => {
    this.error = error;
  };

  get onError() {
    return this._onError;
  }

  set onError(fn: (error: Error) => void) {
    this._onError = (error: Error) => {
      this.error = error;
      fn(error);
    };
  }

  private _onLoad: () => void = () => {
    this.doGif();
  };

  get onLoad() {
    return this._onLoad;
  }

  set onLoad(fn: () => void) {
    this._onLoad = () => {
      this.doGif();
      fn();
    };
  }

  private _onLoadedMetadata: () => void = () => {};

  get onLoadedMetadata() {
    return this._onLoadedMetadata;
  }

  set onLoadedMetadata(fn: () => void) {
    this._onLoadedMetadata = () => {
      if (this.width ?? this.height ?? this.duration) {
        fn();
      }
    };
  }

  private _onLoadStart: () => void = () => {
    download(this._url)
      .then(data => {
        this.gif_data = data;
        this._onLoad();
      })
      .catch(this.onError);
  };

  get onLoadStart() {
    return this._onLoadStart;
  }

  set onLoadStart(fn: () => void) {
    this._onLoadStart = () => {
      download(this._url)
        .then(data => {
          this.gif_data = data;
          this._onLoad();
          fn();
        })
        .catch(this.onError);
    };
  }

  private _onProgress: (currentTime: number) => void = () => {};

  get onProgress() {
    return this._onProgress;
  }

  set onProgress(fn: (currentTime: number) => void) {
    this._onProgress = fn;
  }

  constructor(url: string) {
    this._url = url;
    this.render_canvas = document.createElement('canvas');
    this.render_canvas_ctx = this.render_canvas.getContext('2d', { willReadFrequently: true });

    const render_canvas_mount_point = document.getElementById('render-canvas-mount-point');

    if (!render_canvas_mount_point) {
      this.onError(NOT_READY);
      return;
    }
    if (!this.render_canvas_ctx) {
      this.onError(NOT_READY);
      return;
    }

    render_canvas_mount_point.appendChild(this.render_canvas);
    this.isGif();
  }

  private isGif() {
    if (!this._url) {
      this.onError(COULDNT_FETCH_RESOURCE);
      return;
    }
    const gifRequest = new XMLHttpRequest();
    gifRequest.open('GET', this._url);
    gifRequest.setRequestHeader('Range', 'bytes=0-5');
    gifRequest.onload = () => {
      const validHeaders = ['GIF87a', 'GIF89a'];
      if (validHeaders.includes(gifRequest.responseText.substring(0, 6))) {
        this._onLoadStart();
      } else {
        this.onError(NOT_SUPPORTED);
      }
    };
    gifRequest.onerror = () => {
      this.onError(COULDNT_FETCH_RESOURCE);
    };
    gifRequest.send(null);
  }

  private doGif() {
    const dom = {
      bar: document.querySelector('#scrubber-bar') as HTMLDivElement,
    };

    const display_canvas = document.querySelector('#canvas-display') as HTMLCanvasElement;

    const display_ctx = display_canvas.getContext('2d');

    // Validate URL
    // ============

    const state = {
      currentFrame: 0,
      hasTransparency: false,
      keyFrameRate: 15, // Performance: Pre-render every n frames
      playTimeoutId: null as number | null,
      speed: 1,
      firstFrameChecked: false,
    };

    const frameDelay = (() => {
      return this.frames[state.currentFrame].delayTime / Math.abs(state.speed);
    }).bind(this);

    // GIF parsing
    // ===========

    const parseFrames = ((buffer: ArrayBuffer, pos: number, gct: Uint8Array, keyFrameRate: number) => {
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
            const frame: Frame = {
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
            pos += Gif.colorTableSize(bytes[pos + 9]) + 11;

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
            const duration = frames.reduce((sum, frame) => sum + frame.delayTime, 0);
            this.setMetadata({ duration });
            return frames;
          default:
            this.onError(COULDNT_DECODE_GIF);
            return [];
        }
      }
    }).bind(this);

    // Drawing to canvas
    // =================

    const renderAndSave = ((frame: Frame) => {
      const { render_canvas_ctx, width, height } = this;
      renderFrame(frame, render_canvas_ctx);
      if (frame.isRendered || !frame.isKeyFrame) {
        frame.isKeyFrame = true;
        return Promise.resolve();
      }
      return new Promise(function (resolve, _reject) {
        frame.putable = render_canvas_ctx.getImageData(0, 0, width, height);
        frame.blob = null;
        frame.drawable = null;
        frame.isRendered = true;
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').putImageData(frame.putable, 0, 0);
        setTimeout(resolve, 0);
      });
    }).bind(this);

    const renderFrame = ((frame: Frame, ctx: CanvasRenderingContext2D) => {
      const [_xy, _wh, method] = [frame.pos, frame.size, frame.disposalMethod];
      const full = [0, 0, this.width, this.height] as const;
      const prevFrame = this.frames[frame.number - 2];

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
        const data = ctx.getImageData(0, 0, this.width, this.height).data;
        for (let i = 0, l = data.length; i < l; i += 4) {
          if (data[i + 3] === 0) {
            // Check alpha of each pixel in frame 0
            state.hasTransparency = true;
            break;
          }
        }
      }
    }).bind(this);

    const renderKeyFrames = (() => {
      return this.frames
        .map(frame => () => {
          return createImageBitmap(frame.blob)
            .then(bitmap => {
              frame.drawable = bitmap;
              return frame;
            })
            .then(renderAndSave);
        })
        .reduce(...chainPromises);
    }).bind(this);

    const renderIntermediateFrames = (() => {
      return this.frames.map(frame => () => renderAndSave(frame)).reduce(...chainPromises);
    }).bind(this);

    const advanceFrame = (() => {
      let frameNumber = state.currentFrame;
      frameNumber += state.speed > 0 ? 1 : -1;

      const loopBackward = frameNumber < 0;
      const loopForward = frameNumber >= this.frames.length;
      const lastFrame = this.frames.length - 1;

      if (loopBackward || loopForward) {
        frameNumber = loopForward ? 0 : lastFrame;
      }

      showFrame(frameNumber);

      state.playTimeoutId = window.setTimeout(advanceFrame, frameDelay());
    }).bind(this);

    // Initialize player
    // =================

    const handleGIF = (() => {
      const bytes = new Uint8Array(this.gif_data);

      // Image dimensions
      const dimensions = new Uint16Array(this.gif_data, 6, 2);
      const [width, height] = dimensions;
      this.setMetadata({ width, height });

      this.render_canvas.width = display_canvas.width = this.width;
      this.render_canvas.height = display_canvas.height = this.height;
      dom.bar.style.width = `${this.width}px`;

      // Record global color table
      let pos = 13 + Gif.colorTableSize(bytes[10]);
      const gct = bytes.subarray(13, pos);

      this._frames = parseFrames(this.gif_data, pos, gct, state.keyFrameRate);

      return renderKeyFrames()
        .then(renderIntermediateFrames)
        .then(advanceFrame)
        .catch((err: any) => console.error('Rendering GIF failed!', err));
    }).bind(this);

    // Download GIF
    // ============

    handleGIF(this.gif_data);

    const showFrame = ((frameNumber: number) => {
      const lastFrame = this.frames.length - 1;
      frameNumber = clamp(frameNumber, 0, lastFrame);
      const currentTime = this.frames.slice(0, frameNumber + 1).reduce((sum, frame) => sum + frame.delayTime, 0);
      const frame = this.frames[(state.currentFrame = frameNumber)];

      this.onProgress(currentTime);

      // Draw current frame only if it's already rendered
      if (frame.isRendered) {
        if (state.hasTransparency) {
          display_ctx.clearRect(0, 0, this.width, this.height);
        }
        return drawFrame(frame, display_ctx);
      }

      // Rendering not complete. Draw all frames since latest key frame as well
      const first = Math.max(0, frameNumber - (frameNumber % state.keyFrameRate));
      for (let i = first; i <= frameNumber; i++) {
        renderFrame(this.frames[i], display_ctx);
      }
    }).bind(this);

    const drawFrame = ((frame: Frame, ctx: CanvasRenderingContext2D) => {
      if (frame.drawable) ctx.drawImage(frame.drawable, 0, 0, this.width, this.height);
      else ctx.putImageData(frame.putable, 0, 0);
    }).bind(this);
  }

  private static colorTableSize(packedHeader: number) {
    const tableFlag = bits(packedHeader, 0, 1);
    if (tableFlag !== 1) return 0;
    const size = bits(packedHeader, 5, 3);
    return 3 * Math.pow(2, size + 1);
  }
}
