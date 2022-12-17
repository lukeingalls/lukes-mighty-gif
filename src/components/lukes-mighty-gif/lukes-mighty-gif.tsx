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

  // async downloadGif() {
  //   try {
  //     await this.isGif();
  //     const getGif = new XMLHttpRequest();
  //     getGif.responseType = 'arraybuffer';
  //     getGif.onload = request => {
  //       const downloadReady = handleGIF(request.target.response);
  //     };
  //     getGif.onprogress = e => e.lengthComputable && downloadBar.set(e.loaded / e.total);
  //     getGif.onerror = showError.bind(null, validURL);
  //     getGif.open('GET', this.src, true);
  //     getGif.send();
  //     url = validURL;
  //   } catch (e) {
  //     this.onError.emit(e);
  //   }
  // }

  // handleGif() {
  //   console.timeEnd('download');
  //   console.time('parse');
  //   const bytes = new Uint8Array(buffer);
  //   init();

  //   // Image dimensions
  //   const dimensions = new Uint16Array(buffer, 6, 2);
  //   [state.width, state.height] = dimensions;
  //   canvas.render.width = canvas.display.width = state.width;
  //   canvas.render.height = canvas.display.height = state.height;
  //   dom.bar[0].style.width = dom.line[0].style.width = state.barWidth = Math.max(state.width, 450);
  //   $('#content').css({ width: state.barWidth, height: state.height });

  //   // Adjust window size
  //   if (!preference('open-tabs')) {
  //     chrome.windows.getCurrent(win => {
  //       chrome.windows.update(win.id, {
  //         width: Math.max(state.width + 180, 640),
  //         height: clamp(state.height + 300, 410, 850),
  //       });
  //     });
  //   }

  //   // Record global color table
  //   let pos = 13 + colorTableSize(bytes[10]);
  //   const gct = bytes.subarray(13, pos);

  //   state.frames = parseFrames(buffer, pos, gct, state.keyFrameRate);
  //   console.timeEnd('parse');

  //   return renderKeyFrames()
  //     .then(showControls)
  //     .then(renderIntermediateFrames)
  //     .then(explodeFrames)
  //     .catch(err => console.error('Rendering GIF failed!', err));
  // }

  render() {
    return (
      <Host>
        <img src={this.src} />
      </Host>
    );
  }
}
