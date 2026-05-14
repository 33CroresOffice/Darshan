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
import { Pencil, X, Check, CircleAlert, LogOut, Camera, IdCard, Bell, FileText, Heart, User } from "lucide-react-native";
import * as ExpoImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { Button } from "@/components/actions/Button";
import { Input } from "@/components/forms/Input";
import { Dropdown } from "@/components/forms/Dropdown";
import { DatePicker } from "@/components/forms/DatePicker";
import { useTranslation } from "react-i18next";
import { signOut } from "@/services/authService";
import { updateAddress, updateDateOfBirth, updateProfilePhoto } from "@/services/registrationService";
import { getCategories } from "@/services/categoryService";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { COLORS, INDIAN_STATES, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Category } from "@/types";

export default function ProfileScreen() {
  const router = useRouter();
  const { registration, profile, user, refreshRegistration } = useAuth();
  const { unreadCount } = useNotifications();
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingDob, setIsEditingDob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
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
        address: registration.permanent_address || registration.address || "",
        city: registration.permanent_city || registration.city || "",
        state: registration.permanent_state || registration.state || "",
        pincode: registration.permanent_pincode || registration.pincode || "",
      });
      setDobForm(registration.date_of_birth ? new Date(registration.date_of_birth) : null);
    }
  }, [registration]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const stateOptions = INDIAN_STATES.map((s) => ({ label: s, value: s }));

  const { t } = useTranslation();

  const validateAddress = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (addressForm.pincode && !/^\d{6}$/.test(addressForm.pincode)) {
      newErrors.pincode = t("app.profile.pincodeInvalid");
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
      setError(err instanceof Error ? err.message : t("app.profile.failedAddress"));
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
      setError(err instanceof Error ? err.message : t("app.profile.failedDob"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAddressEdit = () => {
    setAddressForm({
      address: registration?.permanent_address || registration?.address || "",
      city: registration?.permanent_city || registration?.city || "",
      state: registration?.permanent_state || registration?.state || "",
      pincode: registration?.permanent_pincode || registration?.pincode || "",
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

  const handlePickPhoto = async () => {
    const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError(t("app.profile.photoPermission"));
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
        setError(err instanceof Error ? err.message : t("app.profile.failedPhoto"));
      } finally {
        setSavingPhoto(false);
      }
    }
  };

  const openImagePreview = (uri: string, title: string) => {
    setPreviewImage({ uri, title });
    setImagePreviewVisible(true);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getCategoryNames = () => {
    const ids: string[] = registration?.category_ids || (registration?.category_id ? [registration.category_id] : []);
    if (!ids.length || !categories.length) return null;
    return ids
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const permanentAddr = registration?.permanent_address || registration?.address;
  const permanentCity = registration?.permanent_city || registration?.city;
  const permanentState = registration?.permanent_state || registration?.state;
  const permanentPincode = registration?.permanent_pincode || registration?.pincode;
  const hasPermanentAddress = permanentAddr || permanentCity || permanentState || permanentPincode;

  const presentAddr = registration?.present_same_as_permanent
    ? permanentAddr
    : registration?.present_address;
  const presentCity = registration?.present_same_as_permanent
    ? permanentCity
    : registration?.present_city;
  const presentState = registration?.present_same_as_permanent
    ? permanentState
    : registration?.present_state;
  const presentPincode = registration?.present_same_as_permanent
    ? permanentPincode
    : registration?.present_pincode;
  const hasPresentAddress = presentAddr || presentCity || presentState || presentPincode;
  const presentSameAsPermanent = registration?.present_same_as_permanent;

  const categoryNames = getCategoryNames();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("app.profile.title")}</Text>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => router.push("/(app)/notifications")}
        >
          <Bell size={20} color={COLORS.textSecondary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              {registration?.photo_url ? (
                <TouchableOpacity onPress={() => openImagePreview(registration.photo_url, t("app.profile.photoLabel"))}>
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
              <Text style={styles.userName}>{registration?.full_name}</Text>
              <Text style={styles.userPhone}>{profile?.phone_number}</Text>
              {registration?.allotment_number && (
                <View style={styles.allotmentBadge}>
                  <Text style={styles.allotmentBadgeText}>
                    {t("app.profile.allotmentNo")}: {registration.allotment_number}
                  </Text>
                </View>
              )}
              {savingPhoto && <Text style={styles.savingText}>{t("app.profile.updatingPhoto")}</Text>}
            </View>
          </View>

          {/* Language */}
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>{t("app.profile.language")}</Text>
            <LanguagePicker />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Personal Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <User size={16} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>{t("app.profile.personalInfo")}</Text>
              </View>
              {!isEditingDob && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditingDob(true)}
                >
                  <Pencil size={14} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>
                    {registration?.date_of_birth ? t("common.edit") : t("common.add")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.card}>
              <InfoRow label={t("app.profile.fullName")} value={registration?.full_name} />
              {registration?.father_name && (
                <>
                  <View style={styles.divider} />
                  <InfoRow label={t("app.profile.fatherName")} value={registration.father_name} />
                </>
              )}
              {registration?.age != null && (
                <>
                  <View style={styles.divider} />
                  <InfoRow label={t("app.profile.age")} value={String(registration.age)} />
                </>
              )}
              {categoryNames && (
                <>
                  <View style={styles.divider} />
                  <InfoRow label={t("app.profile.nijog")} value={categoryNames} />
                </>
              )}
              <View style={styles.divider} />
              {isEditingDob ? (
                <View style={styles.editSection}>
                  <DatePicker
                    label={t("app.profile.dateOfBirth")}
                    value={dobForm}
                    onChange={setDobForm}
                    maxDate={new Date()}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelDobEdit}>
                      <X size={18} color={COLORS.textSecondary} />
                      <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, (!dobForm || saving) && styles.saveButtonDisabled]}
                      onPress={handleSaveDob}
                      disabled={saving || !dobForm}
                    >
                      <Check size={18} color={COLORS.surface} />
                      <Text style={styles.saveButtonText}>
                        {saving ? t("common.saving") : t("common.save")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <InfoRow
                  label={t("app.profile.dateOfBirth")}
                  value={
                    registration?.date_of_birth
                      ? new Date(registration.date_of_birth).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : undefined
                  }
                />
              )}
            </View>
          </View>

          {/* Permanent Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t("app.profile.permanentAddress")}</Text>
              </View>
              {!isEditingAddress && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditingAddress(true)}
                >
                  <Pencil size={14} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>
                    {hasPermanentAddress ? t("common.edit") : t("common.add")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditingAddress ? (
              <View style={styles.card}>
                <Input
                  label={t("app.profile.address")}
                  placeholder={t("app.profile.addressPlaceholder")}
                  value={addressForm.address}
                  onChangeText={(text) => setAddressForm((prev) => ({ ...prev, address: text }))}
                  multiline
                  numberOfLines={3}
                />
                <Input
                  label={t("app.profile.city")}
                  placeholder={t("app.profile.cityPlaceholder")}
                  value={addressForm.city}
                  onChangeText={(text) => setAddressForm((prev) => ({ ...prev, city: text }))}
                />
                <Dropdown
                  label={t("app.profile.state")}
                  placeholder={t("app.profile.statePlaceholder")}
                  options={stateOptions}
                  value={addressForm.state}
                  onChange={(value) => setAddressForm((prev) => ({ ...prev, state: value }))}
                />
                <Input
                  label={t("app.profile.pincode")}
                  placeholder={t("app.profile.pincodePlaceholder")}
                  value={addressForm.pincode}
                  onChangeText={(text) =>
                    setAddressForm((prev) => ({ ...prev, pincode: text.replace(/\D/g, "").slice(0, 6) }))
                  }
                  error={errors.pincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={handleCancelAddressEdit}>
                    <X size={18} color={COLORS.textSecondary} />
                    <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveAddress}
                    disabled={saving}
                  >
                    <Check size={18} color={COLORS.surface} />
                    <Text style={styles.saveButtonText}>
                      {saving ? t("common.saving") : t("common.save")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                {hasPermanentAddress ? (
                  <>
                    {permanentAddr && <InfoRow label={t("app.profile.address")} value={permanentAddr} />}
                    {permanentCity && <><View style={styles.divider} /><InfoRow label={t("app.profile.city")} value={permanentCity} /></>}
                    {permanentState && <><View style={styles.divider} /><InfoRow label={t("app.profile.state")} value={permanentState} /></>}
                    {permanentPincode && <><View style={styles.divider} /><InfoRow label={t("app.profile.pincode")} value={permanentPincode} /></>}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{t("app.profile.noAddress")}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Present Address */}
          {!presentSameAsPermanent && hasPresentAddress && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{t("app.profile.presentAddress")}</Text>
                </View>
              </View>
              <View style={styles.card}>
                {presentAddr && <InfoRow label={t("app.profile.address")} value={presentAddr} />}
                {presentCity && <><View style={styles.divider} /><InfoRow label={t("app.profile.city")} value={presentCity} /></>}
                {presentState && <><View style={styles.divider} /><InfoRow label={t("app.profile.state")} value={presentState} /></>}
                {presentPincode && <><View style={styles.divider} /><InfoRow label={t("app.profile.pincode")} value={presentPincode} /></>}
              </View>
            </View>
          )}

          {/* Documents */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <FileText size={16} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>{t("app.profile.documents")}</Text>
              </View>
            </View>
            <View style={styles.documentsGrid}>

              {/* Aadhaar */}
              {(registration?.aadhar_number || registration?.aadhar_card_url) && (
                <View style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentIcon}>
                      <IdCard size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.documentHeaderInfo}>
                      <Text style={styles.documentLabel}>{t("app.profile.aadhaarCard")}</Text>
                      {registration?.aadhar_number && (
                        <Text style={styles.documentNumber}>{registration.aadhar_number}</Text>
                      )}
                    </View>
                  </View>
                  {registration?.aadhar_card_url ? (
                    <TouchableOpacity onPress={() => openImagePreview(registration.aadhar_card_url!, t("app.profile.aadhaarCard"))}>
                      <Image
                        source={{ uri: registration.aadhar_card_url }}
                        style={styles.documentImage}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noDocumentRow}>
                      <Text style={styles.noDocumentText}>{t("app.profile.noDocumentImage")}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Temple Health Card */}
              {(registration?.temple_health_card_id || registration?.temple_health_card_url) && (
                <View style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={[styles.documentIcon, { backgroundColor: "#FFF0EB" }]}>
                      <Heart size={20} color="#E05C2A" />
                    </View>
                    <View style={styles.documentHeaderInfo}>
                      <Text style={styles.documentLabel}>{t("app.profile.templeHealthCard")}</Text>
                      {registration?.temple_health_card_id && (
                        <Text style={styles.documentNumber}>{registration.temple_health_card_id}</Text>
                      )}
                    </View>
                  </View>
                  {registration?.temple_health_card_url ? (
                    <TouchableOpacity onPress={() => openImagePreview(registration.temple_health_card_url!, t("app.profile.templeHealthCard"))}>
                      <Image
                        source={{ uri: registration.temple_health_card_url }}
                        style={styles.documentImage}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noDocumentRow}>
                      <Text style={styles.noDocumentText}>{t("app.profile.noDocumentImage")}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Temple ID Card */}
              <View style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <IdCard size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.documentHeaderInfo}>
                    <Text style={styles.documentLabel}>{t("app.profile.templeIdCard")}</Text>
                    {registration?.temple_id_card_number && (
                      <Text style={styles.documentNumber}>{registration.temple_id_card_number}</Text>
                    )}
                  </View>
                </View>
                {registration?.temple_id_card_url ? (
                  <TouchableOpacity onPress={() => openImagePreview(registration.temple_id_card_url!, t("app.profile.templeIdCard"))}>
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
                      <Text style={styles.uploadTitle}>{t("app.profile.noTempleIdCard")}</Text>
                      <Text style={styles.uploadSubtitle}>{t("app.profile.templeIdCardNotAssigned")}</Text>
                    </View>
                  </View>
                )}
              </View>

            </View>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={COLORS.error} />
            <Text style={styles.signOutText}>{t("common.signOut")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "-"}</Text>
    </View>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
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
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  userPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  allotmentBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  allotmentBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  languageSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  errorContainer: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: "center",
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 15,
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
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
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
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  noDocumentRow: {
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  noDocumentText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: "italic",
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
