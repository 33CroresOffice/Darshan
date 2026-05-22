import { Platform } from "react-native";

function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mime });
}

// XHR handles local file:// and content:// URIs on Android/iOS where fetch() throws "Network request failed".
function uriToBlobXHR(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (xhr.status === 0 || xhr.status === 200) {
        resolve(xhr.response as Blob);
      } else {
        reject(new Error(`XHR failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("XHR network error reading local file"));
    xhr.open("GET", uri);
    xhr.send();
  });
}

export async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith("data:")) {
    const [header, base64Data] = uri.split(",");
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    return base64ToBlob(base64Data, mime);
  }
  if (Platform.OS !== "web") {
    return uriToBlobXHR(uri);
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
  return response.blob();
}

export async function uriToBase64DataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const blob = await uriToBlob(uri);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
