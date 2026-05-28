import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  User,
  FileText,
  Check,
  CircleAlert as AlertCircle,
  UserPlus,
} from "lucide-react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Input } from "@/components/forms/Input";
import { Dropdown } from "@/components/forms/Dropdown";
import { ImagePicker } from "@/components/forms/ImagePicker";
import { Button } from "@/components/actions/Button";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { getCategories } from "@/services/categoryService";
import { registerSebayatByAdmin } from "@/services/registrationService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Category } from "@/types";

const STEPS = [
  { title: "Basic Info", icon: User },
  { title: "Documents", icon: FileText },
];

interface SebayatFormData {
  phoneNumber: string;
  fullName: string;
  categoryId: string;
  templeHealthCardId: string;
  templeHealthCardUri: string | null;
  templeIdCardNumber: string;
  templeIdCardUri: string | null;
  photoUri: string | null;
}

export default function RegisterSebayatScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState<SebayatFormData>({
    phoneNumber: "",
    fullName: "",
    categoryId: "",
    templeHealthCardId: "",
    templeHealthCardUri: null,
    templeIdCardNumber: "",
    templeIdCardUri: null,
    photoUri: null,
  });

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  const updateField = <K extends keyof SebayatFormData>(
    field: K,
    value: SebayatFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.phoneNumber.trim()) {
        newErrors.phoneNumber = "Phone number is required";
      } else if (!/^\d{10}$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = "Please enter a valid 10-digit phone number";
      }
      if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
      if (!formData.templeHealthCardId.trim()) {
        newErrors.templeHealthCardId = "Temple Health Card ID is required";
      }
      if (formData.templeHealthCardId && !/^\d{1,6}$/.test(formData.templeHealthCardId)) {
        newErrors.templeHealthCardId = "Invalid ID (must be up to 6 digits)";
      }
    } else if (step === 1) {
      if (!formData.templeIdCardNumber.trim()) newErrors.templeIdCardNumber = "Temple ID Card number is required";
      if (formData.templeIdCardNumber && !/^\d{5}$/.test(formData.templeIdCardNumber)) {
        newErrors.templeIdCardNumber = "Temple ID Card number must be exactly 5 digits";
      }
      if (!formData.photoUri) newErrors.photoUri = "Photo is required";
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
    if (!validateStep(currentStep)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await registerSebayatByAdmin({
        phoneNumber: `+91${formData.phoneNumber}`,
        fullName: formData.fullName,
        categoryId: formData.categoryId,
        templeHealthCardId: formData.templeHealthCardId,
        templeHealthCardUri: formData.templeHealthCardUri,
        templeIdCardNumber: formData.templeIdCardNumber,
        templeIdCardUri: formData.templeIdCardUri,
        photoUri: formData.photoUri!,
      });

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register sebayat");
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id }));

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.formSection}>
            <Input
              label="Phone Number"
              placeholder="Enter 10-digit phone number"
              value={formData.phoneNumber}
              onChangeText={(text) => updateField("phoneNumber", text.replace(/\D/g, "").slice(0, 10))}
              error={errors.phoneNumber}
              keyboardType="phone-pad"
              maxLength={10}
              prefix="+91"
            />
            <Input
              label="Full Name"
              placeholder="Enter full name"
              value={formData.fullName}
              onChangeText={(text) => updateField("fullName", text)}
              error={errors.fullName}
              autoCapitalize="words"
            />
            <Input
              label="Temple Health Card ID"
              placeholder="Enter ID number (up to 6 digits)"
              value={formData.templeHealthCardId}
              onChangeText={(text) => updateField("templeHealthCardId", text.replace(/\D/g, "").slice(0, 6))}
              error={errors.templeHealthCardId}
              keyboardType="number-pad"
              maxLength={6}
            />
            <ImagePicker
              label="Temple Health Card (Optional)"
              value={formData.templeHealthCardUri}
              onChange={(uri) => updateField("templeHealthCardUri", uri)}
            />
          </View>
        );
      case 1:
        return (
          <View style={styles.formSection}>
            <Input
              label="Temple ID Card Number"
              placeholder="Enter 5-digit ID number"
              value={formData.templeIdCardNumber}
              onChangeText={(text) => updateField("templeIdCardNumber", text.replace(/\D/g, "").slice(0, 5))}
              error={errors.templeIdCardNumber}
              keyboardType="number-pad"
              maxLength={5}
            />
            <ImagePicker
              label="Temple ID Card (Optional)"
              value={formData.templeIdCardUri}
              onChange={(uri) => updateField("templeIdCardUri", uri)}
            />
            <ImagePicker
              label="Photo"
              value={formData.photoUri}
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
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.headerIcon}>
              <UserPlus size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Register Darshan</Text>
            <Text style={styles.subtitle}>
              Register a new Darshan member directly
            </Text>
          </View>

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
                  ]}>
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

          {error && (
            <View style={styles.errorCard}>
              <AlertCircle size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successCard}>
              <Check size={20} color={COLORS.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{STEPS[currentStep].title}</Text>
              <Text style={styles.cardSubtitle}>
                Step {currentStep + 1} of {STEPS.length}
              </Text>
            </View>
            {renderStep()}
          </View>

          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backStepButton} onPress={handleBack}>
                <Text style={styles.backStepButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button
                title="Continue"
                onPress={handleNext}
                style={styles.nextButton}
                size="large"
              />
            ) : (
              <Button
                title="Register Darshan"
                onPress={handleSubmit}
                loading={loading}
                style={styles.nextButton}
                size="large"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && <LoadingOverlay message="Registering sebayat..." />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  stepsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.xs,
  },
  stepCircleCurrent: {
    backgroundColor: COLORS.primary,
  },
  stepCircleCompleted: {
    backgroundColor: COLORS.success,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  stepLabelCurrent: {
    color: COLORS.text,
    fontWeight: "600",
  },
  stepLabelCompleted: {
    color: COLORS.success,
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  stepConnectorCompleted: {
    backgroundColor: COLORS.success,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "500",
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#D1FAE5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successText: {
    flex: 1,
    color: COLORS.success,
    fontSize: 14,
    fontWeight: "500",
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    ...SHADOWS.small,
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
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  backStepButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backStepButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  nextButton: {
    flex: 1,
  },
});
