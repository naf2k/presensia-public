import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface CapturedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

// Web tidak memakai CameraView live: foto diambil lewat kamera sistem
// (<input type="file" capture>, kamera depan). Native tidak berubah.
export const usesSystemCamera = Platform.OS === "web";

export async function captureSelfie(): Promise<CapturedPhoto | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: false,
    quality: 0.5,
    exif: false,
  });
  if (result.canceled || result.assets == null || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}
