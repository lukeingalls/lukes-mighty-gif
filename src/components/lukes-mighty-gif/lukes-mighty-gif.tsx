import { Component, Host, h, Prop, Event, EventEmitter, State, Watch } from '@stencil/core';

@Component({
  tag: 'lukes-mighty-gif',
  styleUrl: 'lukes-mighty-gif.css',
  shadow: true,
})
export class LukesMightyGif {
  @Prop() src: string;

  @State() isGif: boolean = false;
  @State() isGifError: string;

  @Event() onError: EventEmitter<string>;

  @Watch('isGif')
  isGifHandler(newIsGif, oldIsGif) {
    console.log(`isGif changed to ${newIsGif} from ${oldIsGif}`);
  }

  @Watch('src')
  handleSrcChange(newSrc) {
    this.setIsGif(newSrc);
  }

  setIsGif(src) {
    return new Promise<void>(resolve => {
      if (!src) {
        this.isGif = false;
        this.isGifError = 'No source provided!';
        resolve();
        return;
      }
      const request = new XMLHttpRequest();
      request.open('GET', src);
      request.setRequestHeader('Range', 'bytes=0-5');
      request.onload = () => {
        const validHeaders = ['GIF87a', 'GIF89a'];
        if (validHeaders.includes(request.responseText.substring(0, 6))) {
          this.isGif = true;
        } else {
          this.isGif = false;
          this.isGifError = 'Source is not supported.';
        }
        resolve();
      };
      request.onerror = () => {
        this.isGif = false;
        this.isGifError = "Couldn't load provided source.";
        resolve();
      };
      request.send();
    });
  }

  componentWillLoad() {
    console.log('here');
    console.log(this.src);
    if (this.src) this.setIsGif(this.src);
  }

  render() {
    return (
      <Host>
        <img src={this.src} />
      </Host>
    );
  }
}
