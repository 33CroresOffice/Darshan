import { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
import * as ExpoImagePicker from "expo-image-picker";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";

interface ImagePickerProps {
  label?: string;
  value: string | null;
  onChange: (uri: string | null) => void;
  error?: string;
}

export function ImagePicker({ label, value, onChange, error }: ImagePickerProps) {
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;

      setLoading(true);
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onChange(result.assets[0].uri);
      }
    } catch {
      // permission denied or picker closed
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;

      setLoading(true);
      const result = await ExpoImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onChange(result.assets[0].uri);
      }
    } catch {
      // permission denied or camera unavailable
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    onChange(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Processing…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {value ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: value }}
            style={styles.image}
            resizeMode="cover"
            onError={() => onChange(null)}
          />
          <TouchableOpacity style={styles.removeButton} onPress={removeImage} activeOpacity={0.8}>
            <X size={16} color={COLORS.surface} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.pickerButton, error && styles.pickerError]}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <ImageIcon size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerButton, error && styles.pickerError]}
            onPress={takePhoto}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Camera size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  pickerError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  imageContainer: {
    position: "relative",
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: RADIUS.md,
  },
  removeButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.small,
  },
  loadingBox: {
    height: 80,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  error: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
});
