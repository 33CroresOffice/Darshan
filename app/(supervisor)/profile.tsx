import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pencil, X, Check, CircleAlert, LogOut, Camera, IdCard } from "lucide-react-native";
import * as ExpoImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/actions/Button";
import { Input } from "@/components/forms/Input";
import { Dropdown } from "@/components/forms/Dropdown";
import { DatePicker } from "@/components/forms/DatePicker";
import { signOut } from "@/services/authService";
import { updateAddress, updateDateOfBirth, updateProfilePhoto } from "@/services/registrationService";
import { COLORS, INDIAN_STATES, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "@/components/ui/LanguagePicker";

export default function SupervisorProfileScreen() {
  const { t } = useTranslation();
  const { registration, profile, user, refreshRegistration } = useAuth();
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingDob, setIsEditingDob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [addressForm, setAddressForm] = useState({
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [dobForm, setDobForm] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string } | null>(null);

  useEffect(() => {
    if (registration) {
      setAddressForm({
        address: registration.address || "",
        city: registration.city || "",
        state: registration.state || "",
        pincode: registration.pincode || "",
      });
      setDobForm(registration.date_of_birth ? new Date(registration.date_of_birth) : null);
    }
  }, [registration]);

  const handleSignOut = async () => {
    await signOut();
  };

  const stateOptions = INDIAN_STATES.map((s) => ({ label: s, value: s }));

  const isProfileIncomplete =
    !registration?.date_of_birth ||
    !registration?.address ||
    !registration?.city ||
    !registration?.state ||
    !registration?.pincode;

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!registration?.date_of_birth) missing.push(t('supervisor.profile.dateOfBirth'));
    if (!registration?.address || !registration?.city || !registration?.state || !registration?.pincode) {
      missing.push(t('supervisor.profile.address'));
    }
    return missing;
  };

  const validateAddress = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (addressForm.pincode && !/^\d{6}$/.test(addressForm.pincode)) {
      newErrors.pincode = t('supervisor.profile.pincodeInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAddress = async () => {
    if (!validateAddress() || !registration) return;
    setSaving(true);
    setError("");
    try {
      await updateAddress(registration.id, addressForm);
      await refreshRegistration();
      setIsEditingAddress(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('supervisor.profile.failedAddress'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDob = async () => {
    if (!dobForm || !registration) return;
    setSaving(true);
    setError("");
    try {
      await updateDateOfBirth(registration.id, dobForm);
      await refreshRegistration();
      setIsEditingDob(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('supervisor.profile.failedDob'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAddressEdit = () => {
    setAddressForm({
      address: registration?.address || "",
      city: registration?.city || "",
      state: registration?.state || "",
      pincode: registration?.pincode || "",
    });
    setErrors({});
    setError("");
    setIsEditingAddress(false);
  };

  const handleCancelDobEdit = () => {
    setDobForm(registration?.date_of_birth ? new Date(registration.date_of_birth) : null);
    setError("");
    setIsEditingDob(false);
  };

  const hasAddress =
    registration?.address || registration?.city || registration?.state || registration?.pincode;

  const handlePickPhoto = async () => {
    const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError(t('supervisor.profile.photoPermission'));
      return;
    }
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && registration && user) {
      setSavingPhoto(true);
      setError("");
      try {
        await updateProfilePhoto(registration.id, user.id, result.assets[0].uri);
        await refreshRegistration();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('supervisor.profile.failedPhoto'));
      } finally {
        setSavingPhoto(false);
      }
    }
  };

  const openImagePreview = (uri: string, title: string) => {
    setPreviewImage({ uri, title });
    setImagePreviewVisible(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {registration?.photo_url ? (
              <TouchableOpacity onPress={() => openImagePreview(registration.photo_url, "Profile Photo")}>
                <Image source={{ uri: registration.photo_url }} style={styles.avatar} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {registration?.full_name ? getInitials(registration.full_name) : "S"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editPhotoButton}
              onPress={handlePickPhoto}
              disabled={savingPhoto}
            >
              <Camera size={14} color={COLORS.surface} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{registration?.full_name || profile?.full_name}</Text>
            <Text style={styles.userPhone}>{profile?.phone_number}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{t('supervisor.profile.supervisor')}</Text>
            </View>
            {savingPhoto && <Text style={styles.savingText}>{t('supervisor.profile.updatingPhoto')}</Text>}
          </View>
        </View>

        <View style={styles.languageSection}>
          <Text style={styles.languageLabel}>{t('supervisor.profile.language')}</Text>
          <LanguagePicker />
        </View>

        {isProfileIncomplete && registration && (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <CircleAlert size={20} color={COLORS.warning} />
            </View>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>{t('supervisor.profile.completeProfile')}</Text>
              <Text style={styles.bannerText}>
                {t('supervisor.profile.addFieldsPrompt', { fields: getMissingFields().join(` ${t('auth.and')} `) })}
              </Text>
            </View>
          </View>
        )}

        {registration && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('supervisor.profile.personalInfo')}</Text>
                {!isEditingDob && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setIsEditingDob(true)}
                  >
                    <Pencil size={14} color={COLORS.primary} />
                    <Text style={styles.editButtonText}>
                      {registration?.date_of_birth ? t('common.edit') : t('common.add')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {error && !isEditingAddress && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('supervisor.profile.fullName')}</Text>
                  <Text style={styles.infoValue}>{registration?.full_name || "-"}</Text>
                </View>
                <View style={styles.divider} />
                {isEditingDob ? (
                  <View style={styles.editSection}>
                    <DatePicker
                      label={t('supervisor.profile.dateOfBirth')}
                      value={dobForm}
                      onChange={setDobForm}
                      maxDate={new Date()}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.cancelButton} onPress={handleCancelDobEdit}>
                        <X size={18} color={COLORS.textSecondary} />
                        <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveButton, (!dobForm || saving) && styles.saveButtonDisabled]}
                        onPress={handleSaveDob}
                        disabled={saving || !dobForm}
                      >
                        <Check size={18} color={COLORS.surface} />
                        <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('common.save')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('supervisor.profile.dateOfBirth')}</Text>
                    <Text style={styles.infoValue}>
                      {registration?.date_of_birth
                        ? new Date(registration.date_of_birth).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('supervisor.profile.address')}</Text>
                {!isEditingAddress && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setIsEditingAddress(true)}
                  >
                    <Pencil size={14} color={COLORS.primary} />
                    <Text style={styles.editButtonText}>{hasAddress ? t('common.edit') : t('common.add')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {error && isEditingAddress && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {isEditingAddress ? (
                <View style={styles.card}>
                  <Input
                    label={t('supervisor.profile.address')}
                    placeholder={t('supervisor.profile.addressPlaceholder')}
                    value={addressForm.address}
                    onChangeText={(text) => setAddressForm((prev) => ({ ...prev, address: text }))}
                    multiline
                    numberOfLines={3}
                  />
                  <Input
                    label={t('supervisor.profile.city')}
                    placeholder={t('supervisor.profile.cityPlaceholder')}
                    value={addressForm.city}
                    onChangeText={(text) => setAddressForm((prev) => ({ ...prev, city: text }))}
                  />
                  <Dropdown
                    label={t('supervisor.profile.state')}
                    placeholder={t('supervisor.profile.statePlaceholder')}
                    options={stateOptions}
                    value={addressForm.state}
                    onChange={(value) => setAddressForm((prev) => ({ ...prev, state: value }))}
                  />
                  <Input
                    label={t('supervisor.profile.pincode')}
                    placeholder={t('supervisor.profile.pincodePlaceholder')}
                    value={addressForm.pincode}
                    onChangeText={(text) =>
                      setAddressForm((prev) => ({
                        ...prev,
                        pincode: text.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    error={errors.pincode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelAddressEdit}>
                      <X size={18} color={COLORS.textSecondary} />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                      onPress={handleSaveAddress}
                      disabled={saving}
                    >
                      <Check size={18} color={COLORS.surface} />
                      <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('common.save')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  {hasAddress ? (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('supervisor.profile.address')}</Text>
                        <Text style={styles.infoValue}>{registration?.address || "-"}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('supervisor.profile.city')}</Text>
                        <Text style={styles.infoValue}>{registration?.city || "-"}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('supervisor.profile.state')}</Text>
                        <Text style={styles.infoValue}>{registration?.state || "-"}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('supervisor.profile.pincode')}</Text>
                        <Text style={styles.infoValue}>{registration?.pincode || "-"}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        {t('supervisor.profile.noAddress')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('supervisor.profile.documents')}</Text>
              <View style={styles.documentsGrid}>
                <View style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentIcon}>
                      <IdCard size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.documentHeaderInfo}>
                      <Text style={styles.documentLabel}>{t('supervisor.profile.templeIdCard')}</Text>
                      {registration?.temple_id_card_number && (
                        <Text style={styles.documentNumber}>
                          {registration.temple_id_card_number}
                        </Text>
                      )}
                    </View>
                  </View>
                  {registration?.temple_id_card_url ? (
                    <TouchableOpacity
                      onPress={() =>
                        openImagePreview(registration.temple_id_card_url!, t('supervisor.profile.templeIdCard'))
                      }
                    >
                      <Image
                        source={{ uri: registration.temple_id_card_url }}
                        style={styles.documentImage}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.uploadCard}>
                      <View style={styles.uploadContent}>
                        <View style={styles.uploadIconContainer}>
                          <IdCard size={24} color={COLORS.primary} />
                        </View>
                        <Text style={styles.uploadTitle}>{t('supervisor.profile.noTempleIdCard')}</Text>
                        <Text style={styles.uploadSubtitle}>{t('supervisor.profile.templeIdCardNotAssigned')}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={COLORS.error} />
          <Text style={styles.signOutText}>{t('common.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{previewImage?.title}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setImagePreviewVisible(false)}
              >
                <X size={24} color={COLORS.surface} />
              </TouchableOpacity>
            </View>
            {previewImage && (
              <Image
                source={{ uri: previewImage.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.border,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.surface,
  },
  editPhotoButton: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  savingText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  banner: {
    flexDirection: "row",
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  bannerIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bannerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.medium,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  emptyState: {
    paddingVertical: SPACING.lg,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: "center",
  },
  editSection: {
    paddingTop: SPACING.sm,
  },
  editActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.surface,
  },
  documentsGrid: {
    gap: SPACING.md,
  },
  documentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.medium,
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  documentHeaderInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  documentNumber: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  documentImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  uploadCard: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surfaceSecondary,
  },
  uploadContent: {
    alignItems: "center",
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  languageSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    paddingTop: 60,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.surface,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    flex: 1,
    width: "100%",
  },
});
