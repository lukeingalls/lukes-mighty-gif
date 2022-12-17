import { newSpecPage } from '@stencil/core/testing';
import { LukesMightyGif } from '../lukes-mighty-gif';

describe('lukes-mighty-gif', () => {
  it('renders', async () => {
    const page = await newSpecPage({
      components: [LukesMightyGif],
      html: `<lukes-mighty-gif></lukes-mighty-gif>`,
    });
    expect(page.root).toEqualHtml(`
      <lukes-mighty-gif>
        <mock:shadow-root>
          <slot></slot>
        </mock:shadow-root>
      </lukes-mighty-gif>
    `);
  });
});
