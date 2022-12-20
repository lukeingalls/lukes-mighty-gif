import { Component, Host, h, Prop, Watch } from '@stencil/core';
import { doGif } from '../helpers';
import isUrlGif from './lib/isUrlGif';

@Component({
  tag: 'lukes-mighty-gif',
  styleUrl: 'lukes-mighty-gif.css',
  // TODO: undo this
  shadow: false,
})
export class LukesMightyGif {
  @Prop() src: string;

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
    isUrlGif(this.src).then(result => {
      if (result.type === 'gif') {
        doGif(result.url);
        return;
      }
      this.handleError(result.reason);
    });
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
