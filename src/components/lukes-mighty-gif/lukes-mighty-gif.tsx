import { Component, Host, h, Prop, Watch } from '@stencil/core';
import { doGif } from '../helpers';

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
      doGif(this.src);
    }
  }

  @Watch('src')
  srcChanged(newSrc, oldSrc) {
    if (newSrc && newSrc !== oldSrc) {
      doGif(this.src);
    }
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
      </Host>
    );
  }
}
