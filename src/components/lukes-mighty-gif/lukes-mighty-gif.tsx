import { Component, Host, h, Prop, Watch, Event, EventEmitter, State, Listen } from '@stencil/core';
import Gif from '../../utils/Gif';
import { clamp, throttle } from 'lodash';

@Component({
  tag: 'lukes-mighty-gif',
  styleUrl: 'lukes-mighty-gif.css',
  shadow: true,
})
export class LukesMightyGif {
  gif: Gif;
  startedPlayingAt = 0;
  resetShowControlsIntervalRef: number | null;
  containerRef: HTMLDivElement | null = null;
  canvasRef: HTMLCanvasElement | null = null;
  canvasCtxRef: CanvasRenderingContext2D | null = null;
  progressBarRef: HTMLDivElement | null = null;
  mouseIsDownForSeek = false;

  @Prop() src: string;
  /**
   * Whether or not to show the controls. Defaults to true.
   */
  @Prop() controls: boolean = true;

  /**
   * The current time in milliseconds. Defaults to 0. Setting this value will
   * seek to the provided time.
   */
  @Prop({ mutable: true }) currentTime: number = 0;
  /**
   * Whether or not the gif is paused. Defaults to true.
   */
  @Prop({ mutable: true }) paused: boolean = true;
  /**
   * How fast the gif should play in multiples of the base speed. Defaults to 1.
   */
  @Prop({ mutable: true }) playbackRate: number = 1;

  /**
   * The width of the gif. Defaults to 0. Read-only.
   */
  @Prop({ mutable: true }) width: number = 0;
  /**
   * The height of the gif. Defaults to 0. Read-only.
   */
  @Prop({ mutable: true }) height: number = 0;
  /**
   * The duration of the gif. Defaults to 0. Read-only.
   */
  @Prop({ mutable: true }) duration: number = 0;

  @Event({ eventName: 'canplay' }) oncanplay: EventEmitter;
  @Event({ eventName: 'canplaythrough' }) oncanplaythrough: EventEmitter;
  @Event({ eventName: 'durationchange' }) ondurationchange: EventEmitter;
  @Event({ eventName: 'error' }) onerror: EventEmitter<Error>;
  @Event({ eventName: 'loadedmetadata' }) onloadedmetadata: EventEmitter;
  @Event({ eventName: 'loadstart' }) onloadstart: EventEmitter;
  @Event({ eventName: 'load' }) onload: EventEmitter;
  @Event({ eventName: 'pause' }) onpause: EventEmitter;
  @Event({ eventName: 'play' }) onplay: EventEmitter;
  @Event({ eventName: 'progress' }) onprogress: EventEmitter;
  @Event({ eventName: 'seeked' }) onseeked: EventEmitter;

  @Listen('mousemove', { target: 'body' })
  mouseMoved(e: MouseEvent) {
    if (!this.mouseIsDownForSeek) return;
    this.throttledBindCurrentTimeToMouse(e);
  }
  @Listen('mouseup', { target: 'body' })
  handleMouseUp() {
    this.mouseIsDownForSeek = false;
  }

  @State()
  shouldShowControls = false;

  componentDidLoad() {
    if (this.src) {
      this.handleSrcChange();
    }
  }

  @Watch('controls')
  controlsChanged(_newControls: any, _oldControls: any) {
    const newControls = !!_newControls;
    const oldControls = !!_oldControls;

    if (newControls === oldControls) return;
    if (newControls) {
      this.shouldShowControls = true;
      return;
    }
    this.shouldShowControls = false;
  }

  @Watch('shouldShowControls')
  shouldShowControlsChanged(newShouldShowControls: boolean, oldShouldShowControls: boolean) {
    if (newShouldShowControls === oldShouldShowControls) return;
    if (!newShouldShowControls) return;
    this.resetShowControlsInterval();
  }

  @Watch('src')
  srcChanged(newSrc: any, oldSrc: any) {
    if (typeof newSrc !== 'string') return;
    if (newSrc && newSrc !== oldSrc) {
      this.handleSrcChange();
    }
  }

  @Watch('currentTime')
  seek() {
    if (!this.paused) return;
    this.showFrame(this.currentTime);
    this.onseeked.emit();
  }

  @Watch('playbackRate')
  handlePlaybackRateChange() {
    if (Math.abs(this.playbackRate) > 8) {
      console.warn(`Bro chill... playbackRate is currently ${this.playbackRate}.`);
    }
    const adj = (() => {
      if (this.playbackRate === 0) return 0;
      if (this.playbackRate > 0) return (this.currentTime / this.playbackRate) * (this.playbackRate - 1);
      return (this.currentTime / this.playbackRate) * (this.playbackRate + 1);
    })();
    this.startedPlayingAt += adj;
  }

  handleSrcChange() {
    this.gif = new Gif(this.src);
    this.gif.onLoad = () => this.onload.emit();
    this.gif.onLoadStart = () => this.onloadstart.emit();
    this.gif.onError = (error: Error) => {
      console.error(error);
      this.onerror.emit(error);
    };
    this.gif.onDurationChange = (durationMS: number) => {
      this.duration = durationMS / 1000;
      this.ondurationchange.emit();
    };
    this.gif.onProgress = throttle(() => {
      this.onprogress.emit();
    }, 150);
    this.gif.onLoadedMetadata = () => {
      this.duration = this.gif.duration;
      this.width = this.gif.width;
      this.height = this.gif.height;
      this.onloadedmetadata.emit();
    };
    this.gif.onCanPlay = () => {
      this.oncanplay.emit();
    };
    this.gif.onCanPlayThrough = () => {
      this.oncanplaythrough.emit();
      this.gif.showFrame(0, { display_ctx: this.canvasCtxRef! });
    };
  }

  resetShowControlsInterval() {
    if (this.resetShowControlsIntervalRef) {
      window.clearTimeout(this.resetShowControlsIntervalRef);
    }
    this.resetShowControlsIntervalRef = window.setTimeout(() => {
      this.shouldShowControls = false;
    }, 2000);
  }

  public play() {
    this.startedPlayingAt = performance.now() / 1000 - this.currentTime;
    this.paused = false;
    this._play();
    this.onplay.emit();
  }

  public pause() {
    this.paused = true;
  }

  showFrame(time: number) {
    const timeMS = time * 1000;
    // @ts-expect-error findLastIndex
    const targetFrameNumber = this.gif.frames.findLastIndex((frame: typeof this['gif']['frames'][number]) => {
      return frame.renderAtMs <= timeMS;
    });

    if (targetFrameNumber !== this.gif.currentFrame) {
      this.gif.showFrame(targetFrameNumber, { display_ctx: this.canvasCtxRef! });
    }
  }

  private _play() {
    const timeElapsed = performance.now() / 1000 - this.startedPlayingAt;
    const stepSize = (timeElapsed - this.currentTime) % this.duration;
    const dirtyTargetTime = (this.currentTime + stepSize * this.playbackRate) % this.duration;
    const targetTime = dirtyTargetTime < 0 ? this.duration + dirtyTargetTime : dirtyTargetTime;
    this.startedPlayingAt -= stepSize * (this.playbackRate - 1);

    this.currentTime = targetTime;

    this.showFrame(targetTime);

    requestAnimationFrame(() => {
      if (!this.paused) {
        this._play();
      } else {
        this.onpause.emit();
      }
    });
  }

  handleError(error: any) {
    console.error(error);
  }

  bindCurrentTimeToMouse(e: MouseEvent) {
    const rect = this.progressBarRef.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, this.width);
    const percent = x / rect.width;
    const newCurrentTime = percent * this.duration;
    this.currentTime = newCurrentTime;
    this.startedPlayingAt = performance.now() / 1000 - newCurrentTime;
  }
  // This isn't that great, but it's better than nothing
  throttledBindCurrentTimeToMouse = throttle(this.bindCurrentTimeToMouse, 100);

  render() {
    return (
      <Host>
        <div
          class="gif-container"
          style={{
            width: `${this.width}px`,

            height: `${this.height}px`,
          }}
          onClick={() => {
            if (this.paused) {
              this.play();
            } else {
              this.pause();
            }
            this.shouldShowControls = true;
            this.resetShowControlsInterval();
          }}
          onMouseEnter={() => {
            this.shouldShowControls = true;
            this.resetShowControlsInterval();
          }}
          onMouseMove={() => {
            this.shouldShowControls = true;
            this.resetShowControlsInterval();
          }}
          ref={el => {
            this.containerRef = el;
          }}
        >
          <canvas
            id="canvas-display"
            class="gif-canvas"
            ref={el => {
              this.canvasRef = el;
              this.canvasCtxRef = el.getContext('2d');
            }}
            width={this.width}
            height={this.height}
          ></canvas>

          {this.shouldShowControls && (
            <div id="control-bar" class="control-bar" onClick={e => e.stopPropagation()}>
              <div
                class="play-pause-button"
                onClick={e => {
                  e.stopPropagation();
                  if (this.paused) {
                    this.play();
                  } else {
                    this.pause();
                  }
                }}
              >
                {this.paused ? <div class="play-button" /> : <div class="pause-button" />}
              </div>
              <div
                class="progress-bar"
                ref={el => {
                  this.progressBarRef = el;
                }}
                onMouseDown={() => {
                  this.mouseIsDownForSeek = true;
                }}
                onClick={e => {
                  e.stopPropagation();
                  this.bindCurrentTimeToMouse(e);
                }}
              >
                <div class="progress-bar__filler" style={{ width: `${(100 * this.currentTime) / this.duration}%` }} />
              </div>
            </div>
          )}
        </div>
        <div id="render-canvas-mount-point" class="sr-only" />
        <div id="error-message" style={{ color: 'red' }} />
      </Host>
    );
  }
}
