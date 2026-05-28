import { useEffect, useState } from "react";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  User,
  Calendar,
  Phone,
  TriangleAlert as AlertTriangle,
  Check,
  Pencil,
  Power,
  Eye,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  History,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { updateUserProfile, promoteUserRole, checkApprovedSebayatRegistration } from "@/services/userService";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { useAuth } from "@/context/AuthContext";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Profile, UserRole } from "@/types";

export default function EditUserScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: currentUser } = useAuth();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("sebayat");
  const [editedName, setEditedName] = useState("");
  const [editedPhone, setEditedPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasApprovedRegistration, setHasApprovedRegistration] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, [id]);

  useEffect(() => {
    if (user) {
      const nameChanged = editedName !== (user.full_name || "");
      const phoneChanged = editedPhone !== (user.phone_number || "");
      const roleChanged = selectedRole !== user.role;
      const activeChanged = isActive !== user.is_active;
      setHasChanges(nameChanged || phoneChanged || roleChanged || activeChanged);
    }
  }, [editedName, editedPhone, selectedRole, isActive, user]);

  const fetchUser = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setUser(data as Profile);
        setSelectedRole(data.role);
        setEditedName(data.full_name || "");
        setEditedPhone(data.phone_number || "");
        setIsActive(data.is_active ?? true);

        const regStatus = await checkApprovedSebayatRegistration(data.id);
        setHasApprovedRegistration(regStatus.hasApproved);
        setRegistrationId(regStatus.registrationId);
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !hasChanges) {
      router.back();
      return;
    }

    setRoleChangeError(null);

    const roleChanged = selectedRole !== user.role;
    const isPromotingToStaffRole = roleChanged &&
      ["supervisor", "admin", "superadmin"].includes(selectedRole) &&
      user.role === "sebayat";

    if (isPromotingToStaffRole && !hasApprovedRegistration) {
      setRoleChangeError("User must have an approved sebayat registration to be assigned this role");
      return;
    }

    setSaving(true);
    try {
      const roleChanged = selectedRole !== user.role;
      const isRolePromotion = roleChanged && ["supervisor", "admin", "superadmin"].includes(selectedRole);

      if (isRolePromotion) {
        const result = await promoteUserRole(user.id, selectedRole as "admin" | "superadmin" | "supervisor");
        if (!result.success) {
          setRoleChangeError(result.message);
          setSaving(false);
          return;
        }
      }

      const profileUpdates: {
        full_name?: string;
        phone_number?: string;
        is_active?: boolean;
        role?: UserRole;
      } = {};

      if (editedName !== (user.full_name || "")) {
        profileUpdates.full_name = editedName;
      }
      if (editedPhone !== (user.phone_number || "")) {
        profileUpdates.phone_number = editedPhone;
      }
      if (isActive !== user.is_active) {
        profileUpdates.is_active = isActive;
      }
      if (roleChanged && !isRolePromotion) {
        profileUpdates.role = selectedRole;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await updateUserProfile(user.id, profileUpdates);
      }

      router.back();
    } catch (err) {
      console.error("Failed to update user:", err);
      Alert.alert("Error", "Failed to update user. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "superadmin";
  const isAdmin = currentUser?.role === "admin";
  const isTargetSuperAdmin = user?.role === "superadmin";
  const isTargetAdmin = user?.role === "admin";
  const isTargetAdminOrAbove = isTargetAdmin || isTargetSuperAdmin;
  const canEditProfile = (isSuperAdmin || isAdmin) && !isTargetSuperAdmin;
  const canEditRole = isSuperAdmin && !isTargetSuperAdmin;

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return "#0EA5E9";
      case "admin":
        return COLORS.primary;
      case "supervisor":
        return COLORS.warning;
      default:
        return COLORS.textSecondary;
    }
  };

  const getRoleBgColor = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return "#E0F2FE";
      case "admin":
        return COLORS.primaryLight;
      case "supervisor":
        return COLORS.warningLight;
      default:
        return COLORS.surfaceSecondary;
    }
  };

  const renderRoleOption = (
    value: UserRole,
    label: string,
    description: string,
    icon: React.ReactNode,
    disabled?: boolean
  ) => {
    const isSelected = selectedRole === value;
    const roleColor = getRoleColor(value);
    const roleBgColor = getRoleBgColor(value);

    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.roleOption,
          isSelected && { borderColor: roleColor, backgroundColor: roleBgColor + "40" },
          disabled && styles.roleOptionDisabled,
        ]}
        onPress={() => !disabled && setSelectedRole(value)}
        disabled={disabled}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <View style={[styles.roleIconContainer, { backgroundColor: isSelected ? roleBgColor : COLORS.surfaceSecondary }]}>
          {icon}
        </View>
        <View style={styles.roleInfo}>
          <Text style={[styles.roleLabel, isSelected && { color: roleColor }]}>
            {label}
          </Text>
          <Text style={styles.roleDescription}>{description}</Text>
        </View>
        <View
          style={[
            styles.radioOuter,
            isSelected && { borderColor: roleColor, backgroundColor: roleColor },
          ]}
        >
          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingOverlay message="Loading user..." />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.notFoundContainer}>
            <View style={styles.notFoundIcon}>
              <User size={48} color={COLORS.textMuted} />
            </View>
            <Text style={styles.notFoundText}>User not found</Text>
          </View>
        </View>
      </View>
    );
  }

  const getRoleIcon = (role: UserRole, size: number = 32) => {
    const color = getRoleColor(role);
    switch (role) {
      case "superadmin":
        return <ShieldCheck size={size} color={color} />;
      case "admin":
        return <Shield size={size} color={color} />;
      case "supervisor":
        return <Eye size={size} color={color} />;
      default:
        return <User size={size} color={color} />;
    }
  };

  return (
    <View style={styles.container}>
      {saving && <LoadingOverlay message="Saving..." />}
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

        <View style={styles.userHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: getRoleBgColor(user.role) }]}>
            {getRoleIcon(user.role, 36)}
          </View>
          <Text style={styles.userName}>{user.full_name || "No name"}</Text>

          <View style={styles.userMeta}>
            <View style={styles.metaItem}>
              <Phone size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{user.phone_number || user.phone}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Calendar size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>
                {new Date(user.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>

          {!user.is_active && (
            <View style={styles.inactiveBadge}>
              <Power size={14} color={COLORS.error} />
              <Text style={styles.inactiveBadgeText}>Account Disabled</Text>
            </View>
          )}
        </View>

        {isTargetSuperAdmin && !isSuperAdmin && (
          <View style={styles.warningCard}>
            <AlertTriangle size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>
              Super admin accounts cannot be edited
            </Text>
          </View>
        )}

        {roleChangeError && (
          <View style={styles.errorCard}>
            <AlertCircle size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{roleChangeError}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <CheckCircle size={18} color={hasApprovedRegistration ? COLORS.success : COLORS.textMuted} />
            <Text style={styles.sectionTitle}>Darshan Registration</Text>
          </View>
          <View style={[styles.registrationStatus, { backgroundColor: hasApprovedRegistration ? COLORS.successLight : COLORS.surfaceSecondary }]}>
            <Text style={[styles.registrationStatusText, { color: hasApprovedRegistration ? COLORS.success : COLORS.textSecondary }]}>
              {hasApprovedRegistration ? "Approved Registration" : "No Approved Registration"}
            </Text>
            {!hasApprovedRegistration && (
              <Text style={styles.registrationHint}>
                User must complete sebayat registration before being assigned supervisor/admin roles
              </Text>
            )}
          </View>
          {registrationId && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/user-history/[id]",
                  params: { id: registrationId, name: user.full_name || "User" },
                })
              }
              activeOpacity={0.8}
            >
              <History size={16} color={COLORS.primary} />
              <Text style={styles.historyButtonText}>View Activity History</Text>
            </TouchableOpacity>
          )}
        </View>

        {canEditProfile && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Pencil size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Edit Profile</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter full name"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={editedPhone}
                onChangeText={setEditedPhone}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Power size={20} color={isActive ? COLORS.success : COLORS.error} />
                <View>
                  <Text style={styles.toggleLabel}>Account Status</Text>
                  <Text style={styles.toggleDescription}>
                    {isActive ? "Account is active" : "Account is disabled"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{
                  false: COLORS.errorLight,
                  true: COLORS.successLight,
                }}
                thumbColor={isActive ? COLORS.success : COLORS.error}
              />
            </View>
          </View>
        )}

        {isSuperAdmin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>User Role</Text>
            <View style={styles.roleOptions}>
              {renderRoleOption(
                "sebayat",
                "Darshan",
                "Regular user with basic access",
                <User size={24} color={selectedRole === "sebayat" && canEditRole ? COLORS.textSecondary : COLORS.textMuted} />,
                !canEditRole
              )}
              {renderRoleOption(
                "supervisor",
                "Supervisor",
                "Can oversee and monitor activities",
                <Eye size={24} color={selectedRole === "supervisor" && canEditRole ? COLORS.warning : COLORS.textMuted} />,
                !canEditRole
              )}
              {renderRoleOption(
                "admin",
                "Admin",
                "Can review and approve registrations",
                <Shield size={24} color={selectedRole === "admin" && canEditRole ? COLORS.primary : COLORS.textMuted} />,
                !canEditRole
              )}
              {renderRoleOption(
                "superadmin",
                "Super Admin",
                "Full access including user management",
                <ShieldCheck size={24} color={selectedRole === "superadmin" && canEditRole ? "#0EA5E9" : COLORS.textMuted} />,
                !canEditRole
              )}
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  userHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  userName: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.errorLight,
  },
  inactiveBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
  },
  card: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + "40",
  },
  warningText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: "500",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "500",
  },
  registrationStatus: {
    padding: 14,
    borderRadius: RADIUS.md,
  },
  registrationStatusText: {
    fontSize: 15,
    fontWeight: "600",
  },
  registrationHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  notFoundIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  notFoundText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginTop: 4,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  toggleDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleOptions: {
    gap: 12,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 14,
  },
  roleOptionDisabled: {
    opacity: 0.5,
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  roleInfo: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 3,
  },
  roleDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: {
    gap: 16,
  },
  saveButton: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
