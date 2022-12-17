import { Component, Host, h, Prop } from '@stencil/core';

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
