import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera, IdCard, Upload } from "lucide-react-native";
import * as ExpoImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { createGumasta, uploadGumastaPhoto, uploadGumastaAadhar, updateGumasta } from "@/services/gumastaService";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/actions/Button";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";

export default function GumastaAddScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { registration } = useAuth();
  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [aadharUri, setAadharUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickPhoto = async () => {
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickAadhar = async () => {
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAadharUri(result.assets[0].uri);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t("gumasta.nameRequired");
    if (!contactNumber.trim()) newErrors.contactNumber = t("gumasta.contactRequired");
    if (!photoUri) newErrors.photo = t("gumasta.photoRequired");
    if (!aadharUri) newErrors.aadhar = t("gumasta.aadharRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !registration?.id) return;
    setSaving(true);
    setError("");

    try {
      const created = await createGumasta(registration.id, {
        name: name.trim(),
        contact_number: contactNumber.trim(),
        photo_url: null,
        aadhar_card_url: null,
      });

      const updates: { photo_url?: string; aadhar_card_url?: string } = {};

      if (photoUri) {
        updates.photo_url = await uploadGumastaPhoto(registration.id, created.id, photoUri);
      }
      if (aadharUri) {
        updates.aadhar_card_url = await uploadGumastaAadhar(registration.id, created.id, aadharUri);
      }

      if (Object.keys(updates).length > 0) {
        await updateGumasta(created.id, updates);
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("gumasta.addGumasta")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.form}>
          {/* Profile photo */}
          <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <View style={[styles.photoPlaceholder, errors.photo ? styles.photoPlaceholderError : undefined]}>
                <Camera size={28} color={errors.photo ? COLORS.error : COLORS.textMuted} />
                <Text style={[styles.photoText, errors.photo ? { color: COLORS.error } : undefined]}>{t("gumasta.uploadPhoto")}</Text>
              </View>
            )}
          </TouchableOpacity>
          {errors.photo ? <Text style={styles.fieldError}>{errors.photo}</Text> : null}

          <Input
            label={t("gumasta.name")}
            placeholder={t("gumasta.namePlaceholder")}
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <Input
            label={t("gumasta.contactNumber")}
            placeholder={t("gumasta.contactPlaceholder")}
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
            error={errors.contactNumber}
          />

          {/* Aadhaar card upload */}
          <View style={styles.aadharSection}>
            <View style={styles.aadharHeader}>
              <IdCard size={16} color={errors.aadhar ? COLORS.error : COLORS.textSecondary} />
              <Text style={[styles.aadharLabel, errors.aadhar ? { color: COLORS.error } : undefined]}>{t("gumasta.aadharCard")}</Text>
            </View>

            <TouchableOpacity
              style={[styles.aadharPicker, aadharUri && styles.aadharPickerFilled, errors.aadhar && !aadharUri && styles.aadharPickerError]}
              onPress={pickAadhar}
              activeOpacity={0.8}
            >
              {aadharUri ? (
                <View style={styles.aadharPreviewRow}>
                  <Image source={{ uri: aadharUri }} style={styles.aadharPreview} />
                  <View style={styles.aadharPreviewInfo}>
                    <Text style={styles.aadharUploadedText}>{t("gumasta.aadharUploaded")}</Text>
                    <Text style={styles.aadharChangeText}>{t("gumasta.tapToChange")}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.aadharEmpty}>
                  <View style={styles.aadharIconBg}>
                    <Upload size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.aadharEmptyTitle}>{t("gumasta.uploadAadhar")}</Text>
                  <Text style={styles.aadharEmptySubtitle}>{t("gumasta.uploadAadharHint")}</Text>
                </View>
              )}
            </TouchableOpacity>
            {errors.aadhar ? <Text style={styles.fieldError}>{errors.aadhar}</Text> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            title={t("common.save")}
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: SPACING.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  form: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  photoPicker: {
    alignSelf: "center",
    marginBottom: SPACING.lg,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceSecondary,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  photoPlaceholderError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  photoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  aadharSection: {
    marginTop: SPACING.md,
  },
  aadharHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  aadharLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  aadharPicker: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    overflow: "hidden",
  },
  aadharPickerFilled: {
    borderStyle: "solid",
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  aadharPickerError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  aadharEmpty: {
    alignItems: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  aadharIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  aadharEmptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  aadharEmptySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  aadharPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
  },
  aadharPreview: {
    width: 72,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  aadharPreviewInfo: {
    flex: 1,
  },
  aadharUploadedText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  aadharChangeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: "center",
  },
});
