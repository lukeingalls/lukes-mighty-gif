import { Component, Host, h, Prop, Watch, Event, EventEmitter } from '@stencil/core';
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

  @Event({ eventName: 'onloadstart' }) loadstart: EventEmitter;
  @Event({ eventName: 'onload' }) load: EventEmitter;
  @Event({ eventName: 'onerror' }) error: EventEmitter<Error>;

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
  }

  handleError(error) {
    console.error(error);
  }

  render() {
    return (
      <Host>
        <img src={this.src} />

        <div id="content">
          <div id="bubble-spacer" class="displayed">
            <div id="image-holder" class="cf">
              <canvas id="canvas-display"></canvas>
              <canvas id="canvas-render" style={{ display: 'none' }}></canvas>
            </div>

            <div id="scrubber-bar">
              <div id="scrubber-bar-line"></div>
              <div id="scrubber-bar-filler"></div>
              <div id="scrubber-bar-controller"></div>
            </div>
          </div>
        </div>
        <div id="error-message" style={{ color: 'red' }} />
      </Host>
    );
  }
}
