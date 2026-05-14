import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, FileText, MapPin, Check, TriangleAlert as AlertTriangle } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/forms/Input";
import { ImagePicker } from "@/components/forms/ImagePicker";
import { FilePicker } from "@/components/forms/FilePicker";
import { Button } from "@/components/actions/Button";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { useTranslation } from "react-i18next";
import { resubmitRegistration } from "@/services/registrationService";
import { getTempleIdCardEnabled } from "@/services/settingsService";
import { getCategories } from "@/services/categoryService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { RegistrationFormData } from "@/types";
import type { Category } from "@/types/database";

export default function ResubmitScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, registration, refreshRegistration } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  const STEPS = [
    { title: t("onboarding.stepPersonalInfo"), icon: User },
    { title: t("onboarding.stepAddress"), icon: MapPin },
    { title: t("onboarding.stepDocuments"), icon: FileText },
  ];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<RegistrationFormData>({
    fullName: "",
    fatherName: "",
    age: "",
    allotmentNumber: "",
    categoryIds: [],
    aadharNumber: "",
    aadharCardUri: null,
    permanentAddress: "",
    permanentCity: "Puri",
    permanentState: "Odisha",
    permanentPincode: "",
    presentSameAsPermanent: true,
    presentAddress: "",
    presentCity: "",
    presentState: "",
    presentPincode: "",
    templeHealthCardId: "",
    templeHealthCardUri: null,
    templeIdCardNumber: "",
    templeIdCardUri: null,
    photoUri: null,
  });

  useEffect(() => {
    if (registration) {
      setFormData({
        fullName: registration.full_name || "",
        fatherName: registration.father_name || "",
        age: registration.age != null ? String(registration.age) : "",
        allotmentNumber: registration.allotment_number || "",
        categoryIds: registration.category_ids || (registration.category_id ? [registration.category_id] : []),
        aadharNumber: registration.aadhar_number || "",
        aadharCardUri: registration.aadhar_card_url || null,
        permanentAddress: registration.permanent_address || "",
        permanentCity: registration.permanent_city || "Puri",
        permanentState: registration.permanent_state || "Odisha",
        permanentPincode: registration.permanent_pincode || "",
        presentSameAsPermanent: registration.present_same_as_permanent ?? true,
        presentAddress: registration.present_address || "",
        presentCity: registration.present_city || "",
        presentState: registration.present_state || "",
        presentPincode: registration.present_pincode || "",
        templeHealthCardId: registration.temple_health_card_id || "",
        templeHealthCardUri: registration.temple_health_card_url || null,
        templeIdCardNumber: registration.temple_id_card_number || "",
        templeIdCardUri: registration.temple_id_card_url || null,
        photoUri: registration.photo_url || null,
      });
    }
  }, [registration]);

  const [templeIdCardEnabled, setTempleIdCardEnabled] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getTempleIdCardEnabled().then(setTempleIdCardEnabled);
    getCategories().then(setCategories);
  }, []);

  const updateField = <K extends keyof RegistrationFormData>(
    field: K,
    value: RegistrationFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.fullName.trim()) newErrors.fullName = t("onboarding.validationFullNameRequired");
      if (!formData.fatherName.trim()) newErrors.fatherName = t("onboarding.validationFatherNameRequired");
      if (!formData.age.trim()) {
        newErrors.age = t("onboarding.validationAgeRequired");
      } else if (!/^\d+$/.test(formData.age) || parseInt(formData.age) < 1 || parseInt(formData.age) > 120) {
        newErrors.age = t("onboarding.validationAgeInvalid");
      }
      if (!formData.allotmentNumber.trim()) newErrors.allotmentNumber = t("onboarding.validationAllotmentRequired");
      if (formData.categoryIds.length === 0) newErrors.categoryIds = t("onboarding.validationCategoryRequired");
      if (!formData.aadharNumber.trim()) {
        newErrors.aadharNumber = t("onboarding.validationAadharRequired");
      } else if (!/^\d{12}$/.test(formData.aadharNumber)) {
        newErrors.aadharNumber = t("onboarding.validationAadharInvalid");
      }
      if (!formData.aadharCardUri) newErrors.aadharCardUri = t("onboarding.validationAadharCardRequired");
      if (!formData.templeHealthCardId.trim()) {
        newErrors.templeHealthCardId = t("onboarding.validationHealthCardRequired");
      } else if (!/^\d{1,6}$/.test(formData.templeHealthCardId)) {
        newErrors.templeHealthCardId = t("onboarding.validationHealthCardInvalid");
      }
    } else if (step === 1) {
      if (!formData.permanentAddress.trim()) newErrors.permanentAddress = t("onboarding.validationPermanentAddressRequired");
      if (!formData.permanentCity.trim()) newErrors.permanentCity = t("onboarding.validationCityRequired");
      if (!formData.permanentState.trim()) newErrors.permanentState = t("onboarding.validationStateRequired");
      if (!formData.permanentPincode.trim()) {
        newErrors.permanentPincode = t("onboarding.validationPincodeRequired");
      } else if (!/^\d{6}$/.test(formData.permanentPincode)) {
        newErrors.permanentPincode = t("onboarding.validationPincodeInvalid");
      }
      if (!formData.presentSameAsPermanent) {
        if (!formData.presentAddress.trim()) newErrors.presentAddress = t("onboarding.validationPresentAddressRequired");
        if (!formData.presentCity.trim()) newErrors.presentCity = t("onboarding.validationCityRequired");
        if (!formData.presentState.trim()) newErrors.presentState = t("onboarding.validationStateRequired");
        if (!formData.presentPincode.trim()) {
          newErrors.presentPincode = t("onboarding.validationPincodeRequired");
        } else if (!/^\d{6}$/.test(formData.presentPincode)) {
          newErrors.presentPincode = t("onboarding.validationPincodeInvalid");
        }
      }
    } else if (step === 2) {
      if (templeIdCardEnabled) {
        if (!formData.templeIdCardNumber.trim()) newErrors.templeIdCardNumber = t("onboarding.validationIdCardRequired");
        if (formData.templeIdCardNumber && !/^\d{5}$/.test(formData.templeIdCardNumber)) {
          newErrors.templeIdCardNumber = t("onboarding.validationIdCardInvalid");
        }
      }
      if (!formData.photoUri) newErrors.photoUri = t("onboarding.validationPhotoRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep) || !user || !registration) return;

    setLoading(true);
    setError("");

    try {
      await resubmitRegistration(registration.id, user.id, formData);
      await refreshRegistration();
      router.replace("/(onboarding)/submitted");
    } catch (err: any) {
      setError(err?.message || err?.error_description || t("onboarding.failedSubmit"));
    } finally {
      setLoading(false);
    }
  };

  const renderExistingImage = (uri: string | null, label: string) => {
    if (!uri || uri.startsWith("file://") || uri.startsWith("data:")) return null;
    return (
      <View style={styles.existingImageContainer}>
        <Text style={styles.existingImageLabel}>Current {label}</Text>
        <Image source={{ uri }} style={styles.existingImage} resizeMode="cover" />
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.formSection}>
            <Input
              label={t("onboarding.fullName")}
              placeholder={t("onboarding.fullNamePlaceholder")}
              value={formData.fullName}
              onChangeText={(text) => updateField("fullName", text)}
              error={errors.fullName}
              autoCapitalize="words"
            />
            <Input
              label={t("onboarding.fatherName")}
              placeholder={t("onboarding.fatherNamePlaceholder")}
              value={formData.fatherName}
              onChangeText={(text) => updateField("fatherName", text)}
              error={errors.fatherName}
              autoCapitalize="words"
            />
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <Input
                  label={t("onboarding.age")}
                  placeholder={t("onboarding.agePlaceholder")}
                  value={formData.age}
                  onChangeText={(text) => updateField("age", text.replace(/\D/g, "").slice(0, 3))}
                  error={errors.age}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.rowHalf}>
                <Input
                  label={t("onboarding.allotmentNumber")}
                  placeholder={t("onboarding.allotmentNumberPlaceholder")}
                  value={formData.allotmentNumber}
                  onChangeText={(text) => updateField("allotmentNumber", text)}
                  error={errors.allotmentNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t("onboarding.categories")}</Text>
              {errors.categoryIds ? <Text style={styles.fieldError}>{errors.categoryIds}</Text> : null}
              <View style={styles.categoryChips}>
                {categories.map((cat) => {
                  const selected = formData.categoryIds.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      onPress={() => {
                        const next = selected
                          ? formData.categoryIds.filter((id) => id !== cat.id)
                          : [...formData.categoryIds, cat.id];
                        updateField("categoryIds", next);
                      }}
                      activeOpacity={0.7}
                    >
                      {selected && <Check size={13} color={COLORS.surface} style={styles.chipCheck} />}
                      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Input
              label={t("onboarding.aadharNumber")}
              placeholder={t("onboarding.aadharNumberPlaceholder")}
              value={formData.aadharNumber}
              onChangeText={(text) => updateField("aadharNumber", text.replace(/\D/g, "").slice(0, 12))}
              error={errors.aadharNumber}
              keyboardType="number-pad"
              maxLength={12}
            />
            {formData.aadharCardUri?.startsWith("http") && (
              <View style={styles.existingFileNote}>
                <Check size={14} color={COLORS.success} />
                <Text style={styles.existingFileText}>{t("onboarding.aadharCardUploaded")}</Text>
              </View>
            )}
            <FilePicker
              label={formData.aadharCardUri?.startsWith("http") ? t("onboarding.replaceAadharCard") : t("onboarding.aadharCard")}
              value={formData.aadharCardUri?.startsWith("http") ? null : formData.aadharCardUri}
              onChange={(uri) => updateField("aadharCardUri", uri ?? formData.aadharCardUri)}
              error={errors.aadharCardUri}
            />
            <Input
              label={t("onboarding.templeHealthCardId")}
              placeholder={t("onboarding.templeHealthCardIdPlaceholder")}
              value={formData.templeHealthCardId}
              onChangeText={(text) => updateField("templeHealthCardId", text.replace(/\D/g, "").slice(0, 6))}
              error={errors.templeHealthCardId}
              keyboardType="number-pad"
              maxLength={6}
            />
            {renderExistingImage(formData.templeHealthCardUri, "Temple Health Card")}
            <ImagePicker
              label={formData.templeHealthCardUri ? t("onboarding.replaceHealthCard") : t("onboarding.templeHealthCardOptional")}
              value={formData.templeHealthCardUri?.startsWith("http") ? null : formData.templeHealthCardUri}
              onChange={(uri) => updateField("templeHealthCardUri", uri)}
            />
          </View>
        );

      case 1:
        return (
          <View style={styles.formSection}>
            <Text style={styles.sectionHeading}>{t("onboarding.permanentAddress")}</Text>
            <Input
              label={t("onboarding.addressLine")}
              placeholder={t("onboarding.addressLinePlaceholder")}
              value={formData.permanentAddress}
              onChangeText={(text) => updateField("permanentAddress", text)}
              error={errors.permanentAddress}
              autoCapitalize="sentences"
            />
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <Input
                  label={t("onboarding.city")}
                  placeholder={t("onboarding.cityPlaceholder")}
                  value={formData.permanentCity}
                  onChangeText={(text) => updateField("permanentCity", text)}
                  error={errors.permanentCity}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.rowHalf}>
                <Input
                  label={t("onboarding.pincode")}
                  placeholder={t("onboarding.pincodePlaceholder")}
                  value={formData.permanentPincode}
                  onChangeText={(text) => updateField("permanentPincode", text.replace(/\D/g, "").slice(0, 6))}
                  error={errors.permanentPincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
            <Input
              label={t("onboarding.state")}
              placeholder={t("onboarding.statePlaceholder")}
              value={formData.permanentState}
              onChangeText={(text) => updateField("permanentState", text)}
              error={errors.permanentState}
              autoCapitalize="words"
            />

            <View style={styles.sameAddressToggle}>
              <View style={styles.sameAddressText}>
                <Text style={styles.sectionHeading}>{t("onboarding.presentAddress")}</Text>
                <Text style={styles.sameAddressHint}>{t("onboarding.sameAsPermanentHint")}</Text>
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t("onboarding.sameAsPermanent")}</Text>
                <Switch
                  value={formData.presentSameAsPermanent}
                  onValueChange={(val) => updateField("presentSameAsPermanent", val)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={formData.presentSameAsPermanent ? COLORS.surface : COLORS.textMuted}
                />
              </View>
            </View>

            {!formData.presentSameAsPermanent && (
              <>
                <Input
                  label={t("onboarding.addressLine")}
                  placeholder={t("onboarding.addressLinePlaceholder")}
                  value={formData.presentAddress}
                  onChangeText={(text) => updateField("presentAddress", text)}
                  error={errors.presentAddress}
                  autoCapitalize="sentences"
                />
                <View style={styles.row}>
                  <View style={styles.rowHalf}>
                    <Input
                      label={t("onboarding.city")}
                      placeholder={t("onboarding.cityPlaceholder")}
                      value={formData.presentCity}
                      onChangeText={(text) => updateField("presentCity", text)}
                      error={errors.presentCity}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.rowHalf}>
                    <Input
                      label={t("onboarding.pincode")}
                      placeholder={t("onboarding.pincodePlaceholder")}
                      value={formData.presentPincode}
                      onChangeText={(text) => updateField("presentPincode", text.replace(/\D/g, "").slice(0, 6))}
                      error={errors.presentPincode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
                <Input
                  label={t("onboarding.state")}
                  placeholder={t("onboarding.statePlaceholder")}
                  value={formData.presentState}
                  onChangeText={(text) => updateField("presentState", text)}
                  error={errors.presentState}
                  autoCapitalize="words"
                />
              </>
            )}

            {formData.presentSameAsPermanent && (
              <View style={styles.sameAddressBadge}>
                <Check size={16} color={COLORS.success} />
                <Text style={styles.sameAddressBadgeText}>{t("onboarding.presentSameConfirm")}</Text>
              </View>
            )}
          </View>
        );

      case 2:
        return (
          <View style={styles.formSection}>
            {templeIdCardEnabled && (
              <>
                <Input
                  label={t("onboarding.templeIdCardNumber")}
                  placeholder={t("onboarding.templeIdCardNumberPlaceholder")}
                  value={formData.templeIdCardNumber}
                  onChangeText={(text) => updateField("templeIdCardNumber", text.replace(/\D/g, "").slice(0, 5))}
                  error={errors.templeIdCardNumber}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                {renderExistingImage(formData.templeIdCardUri, "Temple ID Card")}
                <ImagePicker
                  label={formData.templeIdCardUri ? t("onboarding.replaceIdCard") : t("onboarding.templeIdCardOptional")}
                  value={formData.templeIdCardUri?.startsWith("http") ? null : formData.templeIdCardUri}
                  onChange={(uri) => updateField("templeIdCardUri", uri)}
                />
              </>
            )}
            {renderExistingImage(formData.photoUri, "Photo")}
            <ImagePicker
              label={formData.photoUri ? t("onboarding.replacePhoto") : t("onboarding.yourPhoto")}
              value={formData.photoUri?.startsWith("http") ? null : formData.photoUri}
              onChange={(uri) => updateField("photoUri", uri)}
              error={errors.photoUri}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("onboarding.resubmitTitle")}</Text>
        <Text style={styles.headerSubtitle}>{t("onboarding.resubmitSubtitle")}</Text>
      </View>

      <View style={styles.rejectionNotice}>
        <View style={styles.rejectionIcon}>
          <AlertTriangle size={18} color={COLORS.error} />
        </View>
        <Text style={styles.rejectionText}>
          {registration?.rejection_reason
            ? t("onboarding.resubmitReason", { reason: registration.rejection_reason })
            : t("onboarding.resubmitWarning")}
        </Text>
      </View>

      <View style={styles.stepsContainer}>
        <View style={styles.stepsCard}>
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <View key={index} style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCircleCompleted,
                  isCurrent && styles.stepCircleCurrent,
                ]}>
                  {isCompleted ? (
                    <Check size={14} color={COLORS.surface} />
                  ) : (
                    <StepIcon size={14} color={isCurrent ? COLORS.surface : COLORS.textMuted} />
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  isCurrent && styles.stepLabelCurrent,
                  isCompleted && styles.stepLabelCompleted,
                ]} numberOfLines={1}>
                  {step.title}
                </Text>
                {index < STEPS.length - 1 && (
                  <View style={[
                    styles.stepConnector,
                    isCompleted && styles.stepConnectorCompleted,
                  ]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{STEPS[currentStep].title}</Text>
              <Text style={styles.cardSubtitle}>
                {t("onboarding.stepOf", { current: currentStep + 1, total: STEPS.length })}
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {renderStep()}
          </View>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>{t("common.back")}</Text>
              </TouchableOpacity>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button
                title={t("common.continue")}
                onPress={handleNext}
                style={styles.nextButton}
                size="large"
              />
            ) : (
              <Button
                title={t("onboarding.resubmitBtn")}
                onPress={handleSubmit}
                loading={loading}
                style={styles.nextButton}
                size="large"
              />
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {loading && <LoadingOverlay message={t("onboarding.resubmitting")} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  rejectionNotice: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  rejectionIcon: {
    marginTop: 2,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    lineHeight: 18,
    fontWeight: "500",
  },
  stepsContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  stepsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    ...SHADOWS.medium,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.xs,
    flexShrink: 0,
  },
  stepCircleCurrent: {
    backgroundColor: COLORS.primary,
  },
  stepCircleCompleted: {
    backgroundColor: COLORS.success,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.textMuted,
    flex: 1,
  },
  stepLabelCurrent: {
    color: COLORS.text,
    fontWeight: "600",
  },
  stepLabelCompleted: {
    color: COLORS.success,
  },
  stepConnector: {
    width: 16,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
    flexShrink: 0,
  },
  stepConnectorCompleted: {
    backgroundColor: COLORS.success,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    ...SHADOWS.medium,
  },
  cardHeader: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  formSection: {
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  rowHalf: {
    flex: 1,
  },
  sameAddressToggle: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sameAddressText: {
    marginBottom: SPACING.sm,
  },
  sameAddressHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  sameAddressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#D1FAE5",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  sameAddressBadgeText: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: "500",
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: "500",
    marginBottom: SPACING.xs,
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 4,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipCheck: {
    marginRight: 2,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  categoryChipTextSelected: {
    color: COLORS.surface,
    fontWeight: "600",
  },
  existingFileNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  existingFileText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "500",
  },
  existingImageContainer: {
    marginBottom: SPACING.xs,
  },
  existingImageLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  existingImage: {
    width: "100%",
    height: 160,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorContainer: {
    backgroundColor: COLORS.errorLight,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: "center",
  },
  footer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  backButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  nextButton: {
    flex: 1,
  },
});
