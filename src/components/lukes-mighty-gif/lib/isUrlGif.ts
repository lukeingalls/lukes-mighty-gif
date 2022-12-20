/**
 * This function takes the given url and checks that the file it points to is a gif.
 * @param url
 */
type isUrlGifReturn = { type: 'error'; reason: string } | { type: 'gif'; url: string };

export default function isUrlGif(url: string) {
  return new Promise<isUrlGifReturn>(resolve => {
    if (!url) return resolve({ type: 'error', reason: 'no url' });
    const gifRequest = new XMLHttpRequest();
    gifRequest.open('GET', url);
    gifRequest.setRequestHeader('Range', 'bytes=0-5');
    gifRequest.onload = () => {
      const validHeaders = ['GIF87a', 'GIF89a'];
      if (validHeaders.includes(gifRequest.responseText.substring(0, 6))) {
        resolve({ type: 'gif', url });
      } else {
        resolve({ type: 'error', reason: 'bad header' });
      }
    };
    gifRequest.onerror = () => resolve({ type: 'error', reason: "Couldn't fetch resource" });
    gifRequest.send(null);
  });
}
