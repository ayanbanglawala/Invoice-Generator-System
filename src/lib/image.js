// Resizes + compresses an image File down to a JPEG data URL. Keeps parcel
// photos small (typically 100-400kb) so uploads are fast on mobile data and
// comfortably under the ~4.5mb request-size limit on Vercel serverless
// functions, and well within a free Blob storage budget.
export function fileToCompressedDataUrl(file, { maxDimension = 1280, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the selected photo."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl, filename) {
  const [meta, base64] = dataUrl.split(",");
  const contentType = /:(.*?);/.exec(meta)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: contentType });
}
