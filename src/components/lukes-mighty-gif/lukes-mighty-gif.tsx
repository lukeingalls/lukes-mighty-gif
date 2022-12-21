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

  @Prop() src: string;

  @State() duration: number;
  @State() currentTime: number;

  @Event({ eventName: 'ondurationchange' }) durationchange: EventEmitter;
  @Event({ eventName: 'onerror' }) error: EventEmitter<Error>;
  @Event({ eventName: 'onloadstart' }) loadstart: EventEmitter;
  @Event({ eventName: 'onload' }) load: EventEmitter;
  @Event({ eventName: 'onprogress' }) progress: EventEmitter;

  componentDidLoad() {
    if (this.src) {
      this.handleSrcChange();
    }
  }

  @Watch('src')
  srcChanged(newSrc, oldSrc) {
    if (newSrc && newSrc !== oldSrc) {
      this.handleSrcChange();
    }
  }
  handleSrcChange() {
    this.gif = new Gif(this.src);
    this.gif.onLoad = () => this.load.emit();
    this.gif.onLoadStart = () => this.loadstart.emit();
    this.gif.onError = (error: Error) => this.error.emit(error);
    this.gif.onDurationChange = (duration: number) => {
      this.durationchange.emit();
      this.duration = duration;
    };
    this.gif.onProgress = (currentTime: number) => {
      this.currentTime = currentTime;
      this.progress.emit(currentTime);
    };
  }

  handleError(error) {
    console.error(error);
  }

  render() {
    return (
      <Host>
        <img src={this.src} />

        <div id="content">
          <div id="bubble-spacer">
            <div id="image-holder">
              <canvas id="canvas-display"></canvas>
            </div>

            <div id="scrubber-bar" class="progress-bar">
              <div class="progress-bar__filler" style={{ width: `${(100 * this.currentTime) / this.duration}%` }} />
            </div>
          </div>
        </div>
        <div id="render-canvas-mount-point" class="sr-only" />
        <div id="error-message" style={{ color: 'red' }} />
      </Host>
    );
  }
}
