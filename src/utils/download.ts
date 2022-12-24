export default function download(url: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.onload = () => {
      if (request.readyState === 4) {
        resolve(request.response);
        return;
      }
      reject("Couldn't fetch resource");
    };
    request.onerror = () => reject("Couldn't fetch resource");
    request.open('GET', url, true);
    request.send();
  });
}
