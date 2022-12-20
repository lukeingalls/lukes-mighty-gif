import { Component, Host, h, Prop, Event, EventEmitter, State, Watch } from '@stencil/core';

@Component({
  tag: 'lukes-mighty-gif',
  styleUrl: 'lukes-mighty-gif.css',
  shadow: true,
})
export class LukesMightyGif {
  @Prop() src: string;

  render() {
    return (
      <Host>
        <img src={this.src} />
      </Host>
    );
  }
}
