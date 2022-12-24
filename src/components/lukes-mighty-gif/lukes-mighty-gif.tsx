import { Component, Host, h, Prop, Watch, Event, EventEmitter, State } from '@stencil/core';
import Gif from '../helpers';

@Component({
  tag: 'lukes-mighty-gif',
  styleUrl: 'lukes-mighty-gif.css',
  // TODO: undo this
  shadow: false,
})
export class LukesMightyGif {
  gif: Gif;
  startedPlayingAt = 0;
  resetShowControlsIntervalRef: number | null;
  ref: HTMLDivElement | null = null;

  @Prop() src: string;
  @Prop() controls: boolean;

  @Prop({ mutable: true }) currentTime: number;
  @Prop({ mutable: true }) paused: boolean;

  /**
   * The next few props are meant to be treated as read-only. I don't know
   * how to make them read-only in Stencil, so this is all you get 🤷‍♂️.
   */
  @Prop({ mutable: true }) width: number;
  @Prop({ mutable: true }) height: number;
  @Prop({ mutable: true }) duration: number;

  @Event({ eventName: 'oncanplay' }) canplay: EventEmitter;
  @Event({ eventName: 'oncanplaythrough' }) canplaythrough: EventEmitter;
  @Event({ eventName: 'ondurationchange' }) durationchange: EventEmitter;
  @Event({ eventName: 'onerror' }) error: EventEmitter<Error>;
  @Event({ eventName: 'onloadedmetadata' }) loadedmetadata: EventEmitter;
  @Event({ eventName: 'onloadstart' }) loadstart: EventEmitter;
  @Event({ eventName: 'onload' }) load: EventEmitter;
  @Event({ eventName: 'onprogress' }) progress: EventEmitter;

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

  handleSrcChange() {
    this.gif = new Gif(this.src);
    this.gif.onLoad = () => this.load.emit();
    this.gif.onLoadStart = () => this.loadstart.emit();
    this.gif.onError = (error: Error) => {
      console.error(error);
      this.error.emit(error);
    };
    this.gif.onDurationChange = (duration: number) => {
      this.durationchange.emit();
      this.duration = duration;
    };
    this.gif.onProgress = (currentTime: number) => {
      this.currentTime = currentTime;
      this.progress.emit(currentTime);
    };
    this.gif.onLoadedMetadata = () => {
      this.duration = this.gif.duration;
      this.width = this.gif.width;
      this.height = this.gif.height;
      this.loadedmetadata.emit();
    };
    this.gif.onCanPlay = () => {
      this.canplay.emit();
    };
    this.gif.onCanPlayThrough = () => {
      this.canplaythrough.emit();
      this.startPlaying();
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

  startPlaying() {
    this.startedPlayingAt = performance.now() - this.gif.frames[this.gif.currentFrame].renderAtMs;
    this.paused = false;
    this.play();
  }

  pause() {
    this.paused = true;
  }

  play() {
    const targetTime = (performance.now() - this.startedPlayingAt) % this.duration;

    // @ts-expect-error findLastIndex
    const targetFrameNumber = this.gif.frames.findLastIndex((frame: typeof this['gif']['frames'][number]) => {
      return frame.renderAtMs <= targetTime;
    });

    if (targetFrameNumber !== this.gif.currentFrame) {
      this.gif.showFrame(targetFrameNumber);
    }

    requestAnimationFrame(() => {
      if (!this.paused) this.play();
    });
  }

  handleError(error: any) {
    console.error(error);
  }

  render() {
    return (
      <Host>
        <div
          class="gif-container"
          style={{
            width: `${this.width}px`,

            height: `${this.height}px`,
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
            this.ref = el;
          }}
        >
          <canvas id="canvas-display" class="gif-canvas" width={this.width} height={this.height}></canvas>

          {this.shouldShowControls && (
            <div id="control-bar" class="control-bar">
              <div
                class="play-pause-button"
                onClick={() => {
                  if (this.paused) {
                    this.startPlaying();
                  } else {
                    this.pause();
                  }
                }}
              >
                {this.paused ? <div class="play-button" /> : <div class="pause-button" />}
              </div>
              <div class="progress-bar">
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
