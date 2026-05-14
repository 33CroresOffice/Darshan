import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
} from "react-native";
import {
  Users,
  Save,
  Check,
  CircleAlert as AlertCircle,
  Clock,
  Tag,
  Plus,
  Pencil,
  X,
  LogOut,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Smartphone,
  CreditCard,
  ShieldCheck,
  Printer,
  Image,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/services/authService";
import {
  getDailyBookingCapPerUser,
  getTicketValidityMinutes,
  updateSystemSetting,
  getOtpChannels,
  updateOtpChannels,
  getDarshanSlotsEnabled,
  updateDarshanSlotsEnabled,
  getTempleIdCardEnabled,
  updateTempleIdCardEnabled,
  getApprovalRule,
  updateApprovalRule,
  getPrintTokenEnabled,
  updatePrintTokenEnabled,
  getPrintTokenIncludePhoto,
  updatePrintTokenIncludePhoto,
  type OtpChannels,
  type ApprovalRule,
} from "@/services/settingsService";
import {
  getAllCategories,
  createCategory,
  updateCategory,
} from "@/services/categoryService";
import {
  getAllSlots,
  createSlot,
  updateSlot,
  toggleSlotActive,
} from "@/services/slotService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Category, DarshanSlot } from "@/types";

export default function SettingsScreen() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "superadmin";

  const [maxDevotees, setMaxDevotees] = useState("");
  const [originalMaxDevotees, setOriginalMaxDevotees] = useState(0);
  const [ticketValidity, setTicketValidity] = useState("");
  const [originalTicketValidity, setOriginalTicketValidity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryActive, setCategoryActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [dailyLimitsExpanded, setDailyLimitsExpanded] = useState(false);
  const [ticketSettingsExpanded, setTicketSettingsExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [slotsExpanded, setSlotsExpanded] = useState(false);
  const [darshanSlotsEnabled, setDarshanSlotsEnabled] = useState(true);
  const [savingDarshanSlots, setSavingDarshanSlots] = useState(false);
  const [templeIdCardEnabled, setTempleIdCardEnabled] = useState(true);
  const [savingTempleIdCard, setSavingTempleIdCard] = useState(false);
  const [otpChannelsExpanded, setOtpChannelsExpanded] = useState(false);
  const [otpChannels, setOtpChannels] = useState<OtpChannels>({ whatsapp: true, sms: true });
  const [savingOtpChannels, setSavingOtpChannels] = useState(false);
  const [approvalRule, setApprovalRule] = useState<ApprovalRule>("all_admins");
  const [savingApprovalRule, setSavingApprovalRule] = useState(false);

  const [printTokenEnabled, setPrintTokenEnabled] = useState(false);
  const [savingPrintToken, setSavingPrintToken] = useState(false);
  const [printTokenIncludePhoto, setPrintTokenIncludePhoto] = useState(false);
  const [savingPrintTokenPhoto, setSavingPrintTokenPhoto] = useState(false);

  const [slots, setSlots] = useState<DarshanSlot[]>([]);
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DarshanSlot | null>(null);
  const [slotName, setSlotName] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [slotDuration, setSlotDuration] = useState("");
  const [slotMaxBookings, setSlotMaxBookings] = useState("");
  const [slotMaxPerUser, setSlotMaxPerUser] = useState("");
  const [slotActive, setSlotActive] = useState(true);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    try {
      const data = await getAllSlots();
      setSlots(data);
    } catch (err) {
      console.error("Failed to load slots:", err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadCategories();
    if (isSuperAdmin) loadSlots();
  }, [loadCategories, loadSlots, isSuperAdmin]);

  const loadSettings = async () => {
    try {
      const [maxDevoteesValue, ticketValidityValue, otpChannelsValue, slotsEnabledValue, templeIdCardEnabledValue, approvalRuleValue, printTokenEnabledValue, printTokenPhotoValue] = await Promise.all([
        getDailyBookingCapPerUser(),
        getTicketValidityMinutes(),
        getOtpChannels(),
        getDarshanSlotsEnabled(),
        getTempleIdCardEnabled(),
        getApprovalRule(),
        getPrintTokenEnabled(),
        getPrintTokenIncludePhoto(),
      ]);
      setMaxDevotees(maxDevoteesValue.toString());
      setOriginalMaxDevotees(maxDevoteesValue);
      setTicketValidity(ticketValidityValue.toString());
      setOriginalTicketValidity(ticketValidityValue);
      setOtpChannels(otpChannelsValue);
      setDarshanSlotsEnabled(slotsEnabledValue);
      setTempleIdCardEnabled(templeIdCardEnabledValue);
      setApprovalRule(approvalRuleValue);
      setPrintTokenEnabled(printTokenEnabledValue);
      setPrintTokenIncludePhoto(printTokenPhotoValue);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDarshanSlots = async (value: boolean) => {
    if (!profile?.id) return;
    setSavingDarshanSlots(true);
    const result = await updateDarshanSlotsEnabled(value, profile.id);
    if (result.success) {
      setDarshanSlotsEnabled(value);
    }
    setSavingDarshanSlots(false);
  };

  const handleToggleTempleIdCard = async (value: boolean) => {
    if (!profile?.id) return;
    setSavingTempleIdCard(true);
    const result = await updateTempleIdCardEnabled(value, profile.id);
    if (result.success) {
      setTempleIdCardEnabled(value);
    }
    setSavingTempleIdCard(false);
  };

  const handleTogglePrintToken = async (value: boolean) => {
    if (!profile?.id) return;
    setSavingPrintToken(true);
    const result = await updatePrintTokenEnabled(value, profile.id);
    if (result.success) {
      setPrintTokenEnabled(value);
      if (!value) setPrintTokenIncludePhoto(false);
    }
    setSavingPrintToken(false);
  };

  const handleTogglePrintTokenPhoto = async (value: boolean) => {
    if (!profile?.id) return;
    setSavingPrintTokenPhoto(true);
    const result = await updatePrintTokenIncludePhoto(value, profile.id);
    if (result.success) {
      setPrintTokenIncludePhoto(value);
    }
    setSavingPrintTokenPhoto(false);
  };

  const handleSelectApprovalRule = async (rule: ApprovalRule) => {
    if (!profile?.id || rule === approvalRule) return;
    setSavingApprovalRule(true);
    const result = await updateApprovalRule(rule, profile.id);
    if (result.success) {
      setApprovalRule(rule);
      setSuccess("Approval rule updated");
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.message);
      setTimeout(() => setError(null), 4000);
    }
    setSavingApprovalRule(false);
  };

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryActive(category.is_active);
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryActive(true);
    }
    setCategoryError(null);
    setCategoryModalVisible(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalVisible(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryActive(true);
    setCategoryError(null);
  };

  const handleSaveCategory = async () => {
    setCategoryError(null);
    setSavingCategory(true);

    try {
      if (editingCategory) {
        const result = await updateCategory(editingCategory.id, {
          name: categoryName,
          is_active: categoryActive,
        });
        if (!result.success) {
          setCategoryError(result.message);
          return;
        }
      } else {
        const result = await createCategory(categoryName);
        if (!result.success) {
          setCategoryError(result.message);
          return;
        }
      }

      await loadCategories();
      closeCategoryModal();
      setSuccess(editingCategory ? "Nijog updated" : "Nijog created");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setCategoryError("Failed to save nijog");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryStatus = async (category: Category) => {
    try {
      const result = await updateCategory(category.id, {
        is_active: !category.is_active,
      });
      if (result.success) {
        await loadCategories();
      }
    } catch (err) {
      console.error("Failed to toggle category status:", err);
    }
  };

  const openSlotModal = (slot?: DarshanSlot) => {
    if (slot) {
      setEditingSlot(slot);
      setSlotName(slot.name);
      setSlotStartTime(slot.start_time);
      setSlotEndTime(slot.end_time);
      setSlotDuration(slot.duration_minutes.toString());
      setSlotMaxBookings(slot.max_bookings.toString());
      setSlotMaxPerUser(slot.max_bookings_per_user.toString());
      setSlotActive(slot.is_active);
    } else {
      setEditingSlot(null);
      setSlotName("");
      setSlotStartTime("");
      setSlotEndTime("");
      setSlotDuration("180");
      setSlotMaxBookings("4000");
      setSlotMaxPerUser("10");
      setSlotActive(true);
    }
    setSlotError(null);
    setSlotModalVisible(true);
  };

  const closeSlotModal = () => {
    setSlotModalVisible(false);
    setEditingSlot(null);
    setSlotError(null);
  };

  const handleSaveSlot = async () => {
    setSlotError(null);
    setSavingSlot(true);

    const durationNum = parseInt(slotDuration, 10);
    const maxBookingsNum = parseInt(slotMaxBookings, 10);
    const maxPerUserNum = parseInt(slotMaxPerUser, 10);

    if (!slotName.trim()) {
      setSlotError("Slot name is required");
      setSavingSlot(false);
      return;
    }

    if (!slotStartTime || !slotEndTime) {
      setSlotError("Start and end times are required (HH:MM)");
      setSavingSlot(false);
      return;
    }

    if (slotStartTime >= slotEndTime) {
      setSlotError("End time must be after start time");
      setSavingSlot(false);
      return;
    }

    if (isNaN(durationNum) || durationNum < 1) {
      setSlotError("Duration must be at least 1 minute");
      setSavingSlot(false);
      return;
    }

    if (isNaN(maxBookingsNum) || maxBookingsNum < 1) {
      setSlotError("Max bookings must be at least 1");
      setSavingSlot(false);
      return;
    }

    if (isNaN(maxPerUserNum) || maxPerUserNum < 1) {
      setSlotError("Max bookings per user must be at least 1");
      setSavingSlot(false);
      return;
    }

    try {
      if (editingSlot) {
        const result = await updateSlot(editingSlot.id, {
          name: slotName.trim(),
          start_time: slotStartTime,
          end_time: slotEndTime,
          duration_minutes: durationNum,
          max_bookings: maxBookingsNum,
          max_bookings_per_user: maxPerUserNum,
          is_active: slotActive,
        });
        if (!result.success) {
          setSlotError(result.message);
          return;
        }
      } else {
        const result = await createSlot(
          {
            name: slotName.trim(),
            start_time: slotStartTime,
            end_time: slotEndTime,
            duration_minutes: durationNum,
            max_bookings: maxBookingsNum,
            max_bookings_per_user: maxPerUserNum,
          },
          profile!.id
        );
        if (!result.success) {
          setSlotError(result.message);
          return;
        }
      }

      await loadSlots();
      closeSlotModal();
      setSuccess(editingSlot ? "Slot updated" : "Slot created");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setSlotError("Failed to save slot");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleToggleSlotStatus = async (slot: DarshanSlot) => {
    try {
      const result = await toggleSlotActive(slot.id, !slot.is_active);
      if (result.success) {
        await loadSlots();
      }
    } catch (err) {
      console.error("Failed to toggle slot status:", err);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    const maxDevoteesNum = parseInt(maxDevotees, 10);
    const ticketValidityNum = parseInt(ticketValidity, 10);

    if (isNaN(maxDevoteesNum) || maxDevoteesNum < 1) {
      setError("Daily devotee limit must be at least 1");
      return;
    }

    if (maxDevoteesNum > 500) {
      setError("Daily devotee limit cannot exceed 500");
      return;
    }

    if (isNaN(ticketValidityNum) || ticketValidityNum < 15) {
      setError("Ticket validity must be at least 15 minutes");
      return;
    }

    if (ticketValidityNum > 480) {
      setError("Ticket validity cannot exceed 480 minutes (8 hours)");
      return;
    }

    const maxDevoteesChanged = maxDevoteesNum !== originalMaxDevotees;
    const ticketValidityChanged = ticketValidityNum !== originalTicketValidity;

    if (!maxDevoteesChanged && !ticketValidityChanged) {
      setSuccess("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const results = [];

      if (maxDevoteesChanged) {
        results.push(
          await updateSystemSetting("daily_booking_cap_per_user", maxDevoteesNum, profile!.id)
        );
      }

      if (ticketValidityChanged) {
        results.push(
          await updateSystemSetting("ticket_validity_minutes", ticketValidityNum, profile!.id)
        );
      }

      const failed = results.find((r) => !r.success);
      if (failed) {
        setError(failed.message);
      } else {
        setSuccess("Settings updated successfully");
        if (maxDevoteesChanged) setOriginalMaxDevotees(maxDevoteesNum);
        if (ticketValidityChanged) setOriginalTicketValidity(ticketValidityNum);
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOtpChannels = async (updated: OtpChannels) => {
    if (!updated.whatsapp && !updated.sms) {
      setError("At least one OTP channel must be enabled");
      return;
    }
    setSavingOtpChannels(true);
    try {
      const result = await updateOtpChannels(updated, profile!.id);
      if (result.success) {
        setOtpChannels(updated);
        setSuccess("OTP channel settings saved");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Failed to save OTP channel settings");
    } finally {
      setSavingOtpChannels(false);
    }
  };

  const hasChanges =
    parseInt(maxDevotees, 10) !== originalMaxDevotees ||
    parseInt(ticketValidity, 10) !== originalTicketValidity;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>System Settings</Text>
          <Text style={styles.subtitle}>
            Configure application parameters and limits
          </Text>
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

        <Text style={styles.sectionLabel}>Daily Limits</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.settingHeader, !dailyLimitsExpanded && styles.settingHeaderCollapsed]}
            onPress={() => setDailyLimitsExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Users size={22} color={COLORS.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Daily Devotee Limit</Text>
              <Text style={styles.settingDescription}>
                Maximum devotees a sebayat can take per day
              </Text>
            </View>
            <View style={styles.collapseActions}>
              {dailyLimitsExpanded ? (
                <ChevronUp size={20} color={COLORS.textSecondary} />
              ) : (
                <ChevronDown size={20} color={COLORS.textSecondary} />
              )}
            </View>
          </TouchableOpacity>

          {dailyLimitsExpanded && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Maximum Persons Per Day</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={maxDevotees}
                  onChangeText={setMaxDevotees}
                  keyboardType="number-pad"
                  placeholder="50"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={3}
                />
                <Text style={styles.inputSuffix}>persons/day</Text>
              </View>
              <Text style={styles.inputHint}>
                Max total persons a sebayat can bring across all tickets per day
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Ticket Settings</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.settingHeader, !ticketSettingsExpanded && styles.settingHeaderCollapsed]}
            onPress={() => setTicketSettingsExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, { backgroundColor: "#FEF3C7" }]}>
              <Clock size={22} color={COLORS.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Ticket Validity Period</Text>
              <Text style={styles.settingDescription}>
                How long a ticket remains valid before expiring
              </Text>
            </View>
            <View style={styles.collapseActions}>
              {ticketSettingsExpanded ? (
                <ChevronUp size={20} color={COLORS.textSecondary} />
              ) : (
                <ChevronDown size={20} color={COLORS.textSecondary} />
              )}
            </View>
          </TouchableOpacity>

          {ticketSettingsExpanded && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Validity Duration</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={ticketValidity}
                  onChangeText={setTicketValidity}
                  keyboardType="number-pad"
                  placeholder="120"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={3}
                />
                <Text style={styles.inputSuffix}>minutes</Text>
              </View>
              <Text style={styles.inputHint}>
                Minimum 15 minutes, maximum 480 minutes (8 hours)
              </Text>
            </View>
          )}
        </View>

        {(dailyLimitsExpanded || ticketSettingsExpanded) && <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || saving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.8}
        >
          <Save size={20} color="#fff" />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>}

        <Text style={styles.sectionLabel}>Print Token</Text>

        <View style={styles.card}>
          <View style={styles.featureToggleRow}>
            <View style={[styles.settingIcon, { backgroundColor: printTokenEnabled ? "#ECFDF5" : COLORS.surfaceSecondary }]}>
              <Printer size={22} color={printTokenEnabled ? COLORS.success : COLORS.textMuted} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, !printTokenEnabled && styles.settingTitleDisabled]}>
                Enable Print Token
              </Text>
              <Text style={styles.settingDescription}>
                {printTokenEnabled
                  ? "Print/share buttons are visible to supervisors, admins and superadmins"
                  : "No print or share options are shown anywhere in the app"}
              </Text>
            </View>
            <Switch
              value={printTokenEnabled}
              onValueChange={handleTogglePrintToken}
              disabled={savingPrintToken}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={printTokenEnabled ? COLORS.primary : COLORS.textMuted}
            />
          </View>

          {printTokenEnabled && (
            <>
              <View style={styles.printTokenDivider} />
              <View style={[styles.featureToggleRow, { opacity: printTokenEnabled ? 1 : 0.4 }]}>
                <View style={[styles.settingIcon, { backgroundColor: printTokenIncludePhoto ? "#EFF6FF" : COLORS.surfaceSecondary }]}>
                  <Image size={22} color={printTokenIncludePhoto ? COLORS.primary : COLORS.textMuted} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, !printTokenIncludePhoto && styles.settingTitleDisabled]}>
                    Include Sebayat Photo
                  </Text>
                  <Text style={styles.settingDescription}>
                    {printTokenIncludePhoto
                      ? "The registered photo will be embedded in the printed token"
                      : "Token will be printed without the sebayat photo"}
                  </Text>
                </View>
                <Switch
                  value={printTokenIncludePhoto}
                  onValueChange={handleTogglePrintTokenPhoto}
                  disabled={savingPrintTokenPhoto || !printTokenEnabled}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={printTokenIncludePhoto ? COLORS.primary : COLORS.textMuted}
                />
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>Darshan Nijog</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.settingHeader, !categoriesExpanded && styles.settingHeaderCollapsed]}
            onPress={() => setCategoriesExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, { backgroundColor: "#E0E7FF" }]}>
              <Tag size={22} color="#6366F1" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Manage Nijog</Text>
              <Text style={styles.settingDescription}>
                Create and manage sebayat nijog
              </Text>
            </View>
            <View style={styles.collapseActions}>
              {categoriesExpanded && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={(e) => { e.stopPropagation(); openCategoryModal(); }}
                  activeOpacity={0.7}
                >
                  <Plus size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {categoriesExpanded ? (
                <ChevronUp size={20} color={COLORS.textSecondary} />
              ) : (
                <ChevronDown size={20} color={COLORS.textSecondary} />
              )}
            </View>
          </TouchableOpacity>

          {categoriesExpanded && (categories.length === 0 ? (
            <View style={styles.emptyCategories}>
              <Tag size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyCategoriesText}>No nijog yet</Text>
              <Text style={styles.emptyCategoriesSubtext}>
                Tap + to create your first nijog
              </Text>
            </View>
          ) : (
            <View style={styles.categoryList}>
              {categories.map((cat, index) => (
                <View
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    index < categories.length - 1 && styles.categoryItemBorder,
                  ]}
                >
                  <View style={styles.categoryInfo}>
                    <Text
                      style={[
                        styles.categoryName,
                        !cat.is_active && styles.categoryNameInactive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                    <View
                      style={[
                        styles.categoryStatus,
                        cat.is_active
                          ? styles.categoryStatusActive
                          : styles.categoryStatusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryStatusText,
                          cat.is_active
                            ? styles.categoryStatusTextActive
                            : styles.categoryStatusTextInactive,
                        ]}
                      >
                        {cat.is_active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      style={styles.categoryActionButton}
                      onPress={() => openCategoryModal(cat)}
                      activeOpacity={0.7}
                    >
                      <Pencil size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <Switch
                      value={cat.is_active}
                      onValueChange={() => handleToggleCategoryStatus(cat)}
                      trackColor={{
                        false: COLORS.border,
                        true: COLORS.primaryLight,
                      }}
                      thumbColor={cat.is_active ? COLORS.primary : COLORS.textMuted}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {isSuperAdmin && (
          <>
            <Text style={styles.sectionLabel}>Registration Fields</Text>

            <View style={styles.card}>
              <View style={styles.featureToggleRow}>
                <View style={[styles.settingIcon, { backgroundColor: templeIdCardEnabled ? "#EFF6FF" : COLORS.surfaceSecondary }]}>
                  <CreditCard size={22} color={templeIdCardEnabled ? COLORS.primary : COLORS.textMuted} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, !templeIdCardEnabled && styles.settingTitleDisabled]}>
                    Temple ID Card
                  </Text>
                  <Text style={styles.settingDescription}>
                    {templeIdCardEnabled
                      ? "Users must enter their Temple ID card number and upload a photo"
                      : "Temple ID card fields are hidden from the registration form"}
                  </Text>
                </View>
                <Switch
                  value={templeIdCardEnabled}
                  onValueChange={handleToggleTempleIdCard}
                  disabled={savingTempleIdCard}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={templeIdCardEnabled ? COLORS.primary : COLORS.textMuted}
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>OTP Settings</Text>

            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.settingHeader, !otpChannelsExpanded && styles.settingHeaderCollapsed]}
                onPress={() => setOtpChannelsExpanded((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.settingIcon, { backgroundColor: "#E0F2FE" }]}>
                  <MessageCircle size={22} color="#0EA5E9" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>OTP Delivery Channels</Text>
                  <Text style={styles.settingDescription}>
                    Control which channels users can choose on login
                  </Text>
                </View>
                <View style={styles.collapseActions}>
                  {otpChannelsExpanded ? (
                    <ChevronUp size={20} color={COLORS.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={COLORS.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              {otpChannelsExpanded && (
                <View style={styles.otpChannelSection}>
                  <TouchableOpacity
                    style={[
                      styles.otpChannelRow,
                      otpChannels.whatsapp && styles.otpChannelRowActive,
                    ]}
                    onPress={() => {
                      const updated = { ...otpChannels, whatsapp: !otpChannels.whatsapp };
                      handleSaveOtpChannels(updated);
                    }}
                    activeOpacity={0.7}
                    disabled={savingOtpChannels}
                  >
                    <View style={[styles.otpChannelIcon, otpChannels.whatsapp && styles.otpChannelIconActive]}>
                      <MessageCircle size={20} color={otpChannels.whatsapp ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={styles.otpChannelLabel}>
                      <Text style={[styles.otpChannelName, otpChannels.whatsapp && styles.otpChannelNameActive]}>WhatsApp</Text>
                      <Text style={styles.otpChannelDesc}>Send OTP via WhatsApp message</Text>
                    </View>
                    <Switch
                      value={otpChannels.whatsapp}
                      onValueChange={(v) => handleSaveOtpChannels({ ...otpChannels, whatsapp: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                      thumbColor={otpChannels.whatsapp ? COLORS.primary : COLORS.textMuted}
                      disabled={savingOtpChannels}
                    />
                  </TouchableOpacity>

                  <View style={styles.otpChannelDivider} />

                  <TouchableOpacity
                    style={[
                      styles.otpChannelRow,
                      otpChannels.sms && styles.otpChannelRowActive,
                    ]}
                    onPress={() => {
                      const updated = { ...otpChannels, sms: !otpChannels.sms };
                      handleSaveOtpChannels(updated);
                    }}
                    activeOpacity={0.7}
                    disabled={savingOtpChannels}
                  >
                    <View style={[styles.otpChannelIcon, otpChannels.sms && styles.otpChannelIconActiveSms]}>
                      <Smartphone size={20} color={otpChannels.sms ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={styles.otpChannelLabel}>
                      <Text style={[styles.otpChannelName, otpChannels.sms && styles.otpChannelNameActive]}>SMS</Text>
                      <Text style={styles.otpChannelDesc}>Send OTP via text message</Text>
                    </View>
                    <Switch
                      value={otpChannels.sms}
                      onValueChange={(v) => handleSaveOtpChannels({ ...otpChannels, sms: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                      thumbColor={otpChannels.sms ? COLORS.primary : COLORS.textMuted}
                      disabled={savingOtpChannels}
                    />
                  </TouchableOpacity>

                  <View style={styles.otpChannelHint}>
                    <Text style={styles.otpChannelHintText}>
                      {otpChannels.whatsapp && otpChannels.sms
                        ? "Users can choose between WhatsApp and SMS on the login screen."
                        : otpChannels.whatsapp
                        ? "Only WhatsApp will be available. The channel selector will be hidden."
                        : otpChannels.sms
                        ? "Only SMS will be available. The channel selector will be hidden."
                        : "Warning: at least one channel must be enabled."}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.sectionLabel}>Approval Settings</Text>

            <View style={styles.card}>
              <View style={styles.approvalRuleHeader}>
                <View style={[styles.settingIcon, { backgroundColor: "#EFF6FF" }]}>
                  <ShieldCheck size={22} color={COLORS.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Registration Approval Rule</Text>
                  <Text style={styles.settingDescription}>
                    Determines how many admins must approve a registration
                  </Text>
                </View>
              </View>

              {(
                [
                  {
                    key: "all_admins" as ApprovalRule,
                    label: "All Admins Must Approve",
                    description: "Every active admin must cast an approval vote before a registration is accepted",
                  },
                  {
                    key: "majority" as ApprovalRule,
                    label: "Majority Approval",
                    description: "More than half of admins approving immediately activates the account; majority rejecting rejects it",
                  },
                  {
                    key: "any_admin" as ApprovalRule,
                    label: "Any Admin Approves",
                    description: "The first admin to approve immediately activates the registration",
                  },
                  {
                    key: "superadmin_only" as ApprovalRule,
                    label: "Super Admin Only",
                    description: "Only a direct Super Admin approval activates the account; admin votes are recorded for reference only",
                  },
                ] as { key: ApprovalRule; label: string; description: string }[]
              ).map((option, index, arr) => {
                const isActive = approvalRule === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.approvalRuleOption,
                      isActive && styles.approvalRuleOptionActive,
                      index < arr.length - 1 && styles.approvalRuleOptionBorder,
                    ]}
                    onPress={() => handleSelectApprovalRule(option.key)}
                    activeOpacity={0.7}
                    disabled={savingApprovalRule}
                  >
                    <View style={[styles.approvalRuleRadio, isActive && styles.approvalRuleRadioActive]}>
                      {isActive && <View style={styles.approvalRuleRadioDot} />}
                    </View>
                    <View style={styles.approvalRuleOptionText}>
                      <Text style={[styles.approvalRuleOptionLabel, isActive && styles.approvalRuleOptionLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.approvalRuleOptionDesc}>{option.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Darshan Slots</Text>

            <View style={styles.card}>
              <View style={styles.slotsMasterRow}>
                <TouchableOpacity
                  style={[styles.settingHeader, styles.settingHeaderInline, !slotsExpanded && styles.settingHeaderCollapsed]}
                  onPress={() => setSlotsExpanded((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: darshanSlotsEnabled ? "#ECFDF5" : COLORS.surfaceSecondary }]}>
                    <CalendarClock size={22} color={darshanSlotsEnabled ? COLORS.success : COLORS.textMuted} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, !darshanSlotsEnabled && styles.settingTitleDisabled]}>Manage Slots</Text>
                    <Text style={styles.settingDescription}>
                      {darshanSlotsEnabled ? "Configure time slots, capacities and per-user limits" : "Darshan slots are globally disabled"}
                    </Text>
                  </View>
                  <View style={styles.collapseActions}>
                    {slotsExpanded && darshanSlotsEnabled && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => { e.stopPropagation(); openSlotModal(); }}
                        activeOpacity={0.7}
                      >
                        <Plus size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {slotsExpanded ? (
                      <ChevronUp size={20} color={COLORS.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={COLORS.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>
                <Switch
                  value={darshanSlotsEnabled}
                  onValueChange={handleToggleDarshanSlots}
                  disabled={savingDarshanSlots}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={darshanSlotsEnabled ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              {!darshanSlotsEnabled && slotsExpanded && (
                <View style={styles.slotsDisabledBanner}>
                  <AlertCircle size={15} color={COLORS.warning} />
                  <Text style={styles.slotsDisabledBannerText}>
                    Slots are globally OFF. No slot UI will be shown to any user. Toggle the switch above to re-enable.
                  </Text>
                </View>
              )}

              {slotsExpanded && (slots.length === 0 ? (
                <View style={styles.emptyCategories}>
                  <CalendarClock size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyCategoriesText}>No slots configured</Text>
                  <Text style={styles.emptyCategoriesSubtext}>
                    Tap + to create your first slot
                  </Text>
                </View>
              ) : (
                <View style={styles.categoryList}>
                  {slots.map((slot, index) => (
                    <View
                      key={slot.id}
                      style={[
                        styles.slotItem,
                        index < slots.length - 1 && styles.categoryItemBorder,
                      ]}
                    >
                      <View style={styles.slotInfo}>
                        <View style={styles.slotNameRow}>
                          <Text
                            style={[
                              styles.categoryName,
                              !slot.is_active && styles.categoryNameInactive,
                            ]}
                          >
                            {slot.name}
                          </Text>
                          <View
                            style={[
                              styles.categoryStatus,
                              slot.is_active
                                ? styles.categoryStatusActive
                                : styles.categoryStatusInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryStatusText,
                                slot.is_active
                                  ? styles.categoryStatusTextActive
                                  : styles.categoryStatusTextInactive,
                              ]}
                            >
                              {slot.is_active ? "Active" : "Inactive"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.slotTime}>
                          {slot.start_time} – {slot.end_time} · {slot.duration_minutes} min
                        </Text>
                        <View style={styles.slotQuotaRow}>
                          <View style={styles.slotQuotaBadge}>
                            <Text style={styles.slotQuotaLabel}>Total</Text>
                            <Text style={styles.slotQuotaValue}>{slot.max_bookings.toLocaleString()}</Text>
                          </View>
                          <View style={styles.slotQuotaDivider} />
                          <View style={styles.slotQuotaBadge}>
                            <Text style={styles.slotQuotaLabel}>Per User</Text>
                            <Text style={styles.slotQuotaValue}>{slot.max_bookings_per_user}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.categoryActions}>
                        <TouchableOpacity
                          style={styles.categoryActionButton}
                          onPress={() => openSlotModal(slot)}
                          activeOpacity={0.7}
                        >
                          <Pencil size={16} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <Switch
                          value={slot.is_active}
                          onValueChange={() => handleToggleSlotStatus(slot)}
                          trackColor={{
                            false: COLORS.border,
                            true: COLORS.primaryLight,
                          }}
                          thumbColor={slot.is_active ? COLORS.primary : COLORS.textMuted}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => signOut()}
            activeOpacity={0.8}
          >
            <LogOut size={20} color={COLORS.error} />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={slotModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeSlotModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalContent, { marginTop: "auto" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingSlot ? "Edit Slot" : "New Darshan Slot"}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeSlotModal}
                >
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {slotError && (
                <View style={styles.modalError}>
                  <AlertCircle size={16} color={COLORS.error} />
                  <Text style={styles.modalErrorText}>{slotError}</Text>
                </View>
              )}

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Slot Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={slotName}
                  onChangeText={setSlotName}
                  placeholder="e.g. Morning Slot"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={100}
                />
              </View>

              <View style={styles.slotTimeRow}>
                <View style={[styles.modalInputGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={slotStartTime}
                    onChangeText={setSlotStartTime}
                    placeholder="06:00"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={5}
                  />
                </View>
                <View style={[styles.modalInputGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>End Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={slotEndTime}
                    onChangeText={setSlotEndTime}
                    placeholder="09:00"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Duration (minutes)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={slotDuration}
                  onChangeText={setSlotDuration}
                  placeholder="180"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>

              <View style={styles.slotTimeRow}>
                <View style={[styles.modalInputGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>Max Bookings (Total)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={slotMaxBookings}
                    onChangeText={setSlotMaxBookings}
                    placeholder="4000"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <View style={[styles.modalInputGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>Max Per User</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={slotMaxPerUser}
                    onChangeText={setSlotMaxPerUser}
                    placeholder="10"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              {editingSlot && (
                <View style={styles.modalSwitchGroup}>
                  <Text style={styles.modalInputLabel}>Status</Text>
                  <View style={styles.modalSwitchRow}>
                    <Text style={styles.modalSwitchLabel}>
                      {slotActive ? "Active" : "Inactive"}
                    </Text>
                    <Switch
                      value={slotActive}
                      onValueChange={setSlotActive}
                      trackColor={{
                        false: COLORS.border,
                        true: COLORS.primaryLight,
                      }}
                      thumbColor={slotActive ? COLORS.primary : COLORS.textMuted}
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={closeSlotModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    savingSlot && styles.modalSaveButtonDisabled,
                  ]}
                  onPress={handleSaveSlot}
                  disabled={savingSlot}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSaveButtonText}>
                    {savingSlot ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? "Edit Nijog" : "New Nijog"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeCategoryModal}
              >
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {categoryError && (
              <View style={styles.modalError}>
                <AlertCircle size={16} color={COLORS.error} />
                <Text style={styles.modalErrorText}>{categoryError}</Text>
              </View>
            )}

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Nijog Name</Text>
              <TextInput
                style={styles.modalInput}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Enter nijog name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                maxLength={100}
              />
            </View>

            {editingCategory && (
              <View style={styles.modalSwitchGroup}>
                <Text style={styles.modalInputLabel}>Status</Text>
                <View style={styles.modalSwitchRow}>
                  <Text style={styles.modalSwitchLabel}>
                    {categoryActive ? "Active" : "Inactive"}
                  </Text>
                  <Switch
                    value={categoryActive}
                    onValueChange={setCategoryActive}
                    trackColor={{
                      false: COLORS.border,
                      true: COLORS.primaryLight,
                    }}
                    thumbColor={categoryActive ? COLORS.primary : COLORS.textMuted}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeCategoryModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!categoryName.trim() || savingCategory) &&
                    styles.modalSaveButtonDisabled,
                ]}
                onPress={handleSaveCategory}
                disabled={!categoryName.trim() || savingCategory}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveButtonText}>
                  {savingCategory ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 12,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingHeaderCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  settingHeaderInline: {
    flex: 1,
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  settingTitleDisabled: {
    color: COLORS.textMuted,
  },
  featureToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
  },
  printTokenDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  slotsMasterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  slotsDisabledBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: "#FFFBEB",
    borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  slotsDisabledBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inputSection: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    minWidth: 60,
    flex: 0,
  },
  inputSuffix: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    marginTop: 8,
    ...SHADOWS.small,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  collapseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyCategories: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyCategoriesText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  emptyCategoriesSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  categoryList: {
    marginTop: 4,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  categoryItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryInfo: {
    flex: 1,
    gap: 6,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  categoryNameInactive: {
    color: COLORS.textMuted,
  },
  categoryStatus: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  categoryStatusActive: {
    backgroundColor: "#D1FAE5",
  },
  categoryStatusInactive: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  categoryStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  categoryStatusTextActive: {
    color: COLORS.success,
  },
  categoryStatusTextInactive: {
    color: COLORS.textMuted,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoryActionButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  slotItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  slotInfo: {
    flex: 1,
    gap: 4,
  },
  slotNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  slotTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  slotQuotaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginTop: 4,
  },
  slotQuotaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slotQuotaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  slotQuotaValue: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: "700",
  },
  slotQuotaDivider: {
    width: 8,
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  slotTimeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 0,
  },
  otpChannelSection: {
    marginTop: 4,
  },
  otpChannelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: RADIUS.md,
  },
  otpChannelRowActive: {
    backgroundColor: COLORS.primaryLight + "55",
  },
  otpChannelIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  otpChannelIconActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  otpChannelIconActiveSms: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  otpChannelLabel: {
    flex: 1,
  },
  otpChannelName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  otpChannelNameActive: {
    color: COLORS.text,
  },
  otpChannelDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  otpChannelDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  otpChannelHint: {
    marginTop: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  otpChannelHintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  approvalRuleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  approvalRuleOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  approvalRuleOptionActive: {
    backgroundColor: "#EFF6FF",
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
  },
  approvalRuleOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  approvalRuleRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  approvalRuleRadioActive: {
    borderColor: COLORS.primary,
  },
  approvalRuleRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  approvalRuleOptionText: {
    flex: 1,
  },
  approvalRuleOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  approvalRuleOptionLabelActive: {
    color: COLORS.primary,
  },
  approvalRuleOptionDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 19,
  },
  signOutSection: {
    marginTop: 32,
    marginBottom: 20,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  modalError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: RADIUS.md,
    marginBottom: 16,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
  },
  modalInputGroup: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  modalSwitchGroup: {
    marginBottom: 24,
  },
  modalSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalSwitchLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
